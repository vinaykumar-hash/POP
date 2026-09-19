// =============================================================================
// ParkWise — OSM KML Parser
// =============================================================================
// Server-side parser for OpenStreetMap parking KML data exported from
// Overpass/QGIS for Bengaluru Urban district.
//
// Handles TWO geometry types found in the user's KML files:
//   1. Point placemarks (nodes) — single lat/lng coordinate
//   2. Polygon placemarks (ways/relations) — boundary vertices → centroid
//
// Key OSM fields extracted:
//   - name           → parking name
//   - osm_id         → unique identifier
//   - parking        → type (underground, surface, multi-storey, street_side)
//   - fee            → yes/no → PAID/FREE
//   - capacity       → integer vehicle count
//   - access         → customers/private/yes/public
//   - covered        → yes/no
//   - operator       → who operates it
//   - addr:street    → street address
//   - opening_hours  → operating hours
//   - surface        → paved/unpaved/asphalt
//   - supervised     → yes/no
//   - lit            → yes/no (lighting)
//   - building       → yes/no (is a building/garage)
//   - charge         → pricing info
//
// IMPORTANT: All availability is set to UNKNOWN — OSM tells us "parking
// exists here" but NOT whether it's currently available.
// =============================================================================

import * as fs from 'fs';
import type { ParkingLocation, ParkingType } from '@/types/parking';

/** Result of parsing an OSM KML dataset */
export interface OsmKmlParseResult {
  locations: ParkingLocation[];
  errors: OsmKmlParseError[];
  totalPlacemarks: number;
  pointPlacemarks: number;
  polygonPlacemarks: number;
  sourceFile: string;
}

/** A single parse error */
export interface OsmKmlParseError {
  placemarkIndex: number;
  osmId?: string;
  message: string;
}

// ---------------------------------------------------------------------------
// Extended Bengaluru bounding box (OSM data covers wider metro area)
// ---------------------------------------------------------------------------
const BENGALURU_METRO_BOUNDS = {
  minLat: 12.7,
  maxLat: 13.25,
  minLng: 77.3,
  maxLng: 77.9,
};

// ---------------------------------------------------------------------------
// Rough capacity estimation for polygon placemarks without explicit capacity
// Same constant as OpenCity parser for consistency.
// ---------------------------------------------------------------------------
const AREA_PER_CAR_SPACE_M2 = 28;

/**
 * Parse an OSM-format parking KML file.
 *
 * Auto-detects whether each placemark uses Point or Polygon geometry.
 *
 * @param kmlFilePath - Absolute path to the KML file
 * @returns OsmKmlParseResult with parsed parking locations
 */
export function parseOsmKml(kmlFilePath: string): OsmKmlParseResult {
  const errors: OsmKmlParseError[] = [];
  const locations: ParkingLocation[] = [];
  let pointCount = 0;
  let polygonCount = 0;

  // Read the file
  let kmlContent: string;
  try {
    kmlContent = fs.readFileSync(kmlFilePath, 'utf-8');
  } catch (err) {
    return {
      locations: [],
      errors: [{
        placemarkIndex: -1,
        message: `Failed to read KML file: ${err instanceof Error ? err.message : String(err)}`,
      }],
      totalPlacemarks: 0,
      pointPlacemarks: 0,
      polygonPlacemarks: 0,
      sourceFile: kmlFilePath,
    };
  }

  // Extract all <Placemark>...</Placemark> blocks
  const placemarkRegex = /<Placemark>([\s\S]*?)<\/Placemark>/g;
  const placemarks: string[] = [];
  let match: RegExpExecArray | null;

  while ((match = placemarkRegex.exec(kmlContent)) !== null) {
    placemarks.push(match[1]);
  }

  for (let i = 0; i < placemarks.length; i++) {
    try {
      const xml = placemarks[i];
      const osmId = getField(xml, 'osm_id') || getField(xml, 'full_id');

      if (!osmId) {
        errors.push({ placemarkIndex: i, message: 'No osm_id or full_id found' });
        continue;
      }

      // Determine geometry type and extract coordinates
      let lat: number;
      let lng: number;
      let estimatedAreaM2: number | undefined;

      const pointMatch = /<Point>\s*<coordinates>([\s\S]*?)<\/coordinates>\s*<\/Point>/i.exec(xml);
      const polygonMatch = /<Polygon>[\s\S]*?<outerBoundaryIs>[\s\S]*?<coordinates>([\s\S]*?)<\/coordinates>/i.exec(xml);

      if (pointMatch) {
        // Point geometry: "lng,lat" or "lng,lat,alt"
        const parts = pointMatch[1].trim().split(',');
        if (parts.length < 2) {
          errors.push({ placemarkIndex: i, osmId, message: 'Invalid Point coordinates' });
          continue;
        }
        lng = parseFloat(parts[0]);
        lat = parseFloat(parts[1]);
        if (isNaN(lat) || isNaN(lng)) {
          errors.push({ placemarkIndex: i, osmId, message: 'Non-numeric Point coordinates' });
          continue;
        }
        pointCount++;
      } else if (polygonMatch) {
        // Polygon geometry: compute centroid
        const vertices = parseCoordinateString(polygonMatch[1]);
        if (vertices.length < 3) {
          errors.push({ placemarkIndex: i, osmId, message: `Polygon has < 3 vertices (${vertices.length})` });
          continue;
        }
        const centroid = computeCentroid(vertices);
        lat = centroid.lat;
        lng = centroid.lng;

        // Estimate area from polygon (rough shoelace formula in sq meters)
        estimatedAreaM2 = computePolygonAreaM2(vertices);
        polygonCount++;
      } else {
        errors.push({ placemarkIndex: i, osmId, message: 'No Point or Polygon geometry found' });
        continue;
      }

      // Validate coordinates are within Bengaluru metro area
      if (!isWithinBengaluruMetro(lat, lng)) {
        errors.push({
          placemarkIndex: i,
          osmId,
          message: `Coordinates (${lat.toFixed(4)}, ${lng.toFixed(4)}) outside Bengaluru metro bounds`,
        });
        continue;
      }

      // Extract OSM fields
      const nameTag = extractName(xml);
      const parkingType = getField(xml, 'parking');  // underground, surface, multi-storey, street_side
      const fee = getField(xml, 'fee');
      const access = getField(xml, 'access');
      const capacityStr = getField(xml, 'capacity');
      const operator = getField(xml, 'operator');
      const addrStreet = getField(xml, 'addr:street');
      const addrCity = getField(xml, 'addr:city');
      const covered = getField(xml, 'covered');
      const surface = getField(xml, 'surface');
      const supervised = getField(xml, 'supervised');
      const lit = getField(xml, 'lit');
      const building = getField(xml, 'building');
      const wheelchair = getField(xml, 'wheelchair');
      const osmType = getField(xml, 'osm_type');
      const charge = getField(xml, 'charge');
      const openingHours = getField(xml, 'opening_hours');
      const description = extractDescription(xml);

      // Map to ParkingType
      const type = mapOsmToParkingType(parkingType, fee, building);

      // Parse capacity
      let capacity: number | undefined;
      if (capacityStr) {
        const parsed = parseInt(capacityStr, 10);
        if (!isNaN(parsed) && parsed > 0) capacity = parsed;
      }
      // Fallback: estimate from polygon area
      if (!capacity && estimatedAreaM2 && estimatedAreaM2 > 50) {
        capacity = Math.max(1, Math.floor(estimatedAreaM2 / AREA_PER_CAR_SPACE_M2));
      }

      // Parse price from charge field (e.g., "₹20/hour", "20")
      let pricePerHour: number | undefined;
      if (charge) {
        const priceMatch = /(\d+)/.exec(charge);
        if (priceMatch) pricePerHour = parseInt(priceMatch[1], 10);
      }

      // Build name
      const name = nameTag
        || (operator ? `${operator} Parking` : null)
        || `OSM Parking #${osmId}`;

      // Build address
      const addressParts: string[] = [];
      if (addrStreet) addressParts.push(addrStreet);
      if (operator && !nameTag) addressParts.push(`(${operator})`);
      addressParts.push(addrCity || 'Bengaluru');
      const address = addressParts.join(', ');

      // Build facilities
      const isCovered = covered === 'yes' || building === 'yes' || parkingType === 'underground' || parkingType === 'multi-storey';

      // Build description
      const descParts: string[] = ['Source: OpenStreetMap.'];
      if (description) descParts.push(description);
      if (estimatedAreaM2 && estimatedAreaM2 > 50) {
        descParts.push(`Parking area: ~${Math.round(estimatedAreaM2).toLocaleString()} sq meters.`);
      }
      if (capacity) {
        if (capacityStr) {
          descParts.push(`Capacity: ${capacity} vehicles.`);
        } else {
          descParts.push(`Estimated capacity: ~${capacity} vehicles (based on area).`);
        }
      }

      const location: ParkingLocation = {
        id: `OSM-${osmId}`,
        name,
        latitude: lat,
        longitude: lng,
        type,
        source: 'OSM',
        capacity,
        areaSquareMeters: estimatedAreaM2,
        pricePerHour,
        vehicleTypes: ['CAR', 'TWO_WHEELER'],
        facilities: {
          covered: isCovered,
          cctv: false,
          security: supervised === 'yes',
          lighting: lit === 'yes',
          wheelchairAccessible: wheelchair === 'yes',
        },
        address,
        description: descParts.join(' '),
        currentAvailability: {
          status: 'UNKNOWN',
          confidence: 0,
          source: 'NONE',
        },
        sourceMetadata: {
          osmId,
          osmType,
          parkingType,
          fee,
          access,
          surface,
          covered,
          supervised,
          lit,
          building,
          charge,
          openingHours,
          operator,
          estimatedAreaM2,
        },
      };

      locations.push(location);
    } catch (err) {
      errors.push({
        placemarkIndex: i,
        message: `Unexpected error: ${err instanceof Error ? err.message : String(err)}`,
      });
    }
  }

  return {
    locations,
    errors,
    totalPlacemarks: placemarks.length,
    pointPlacemarks: pointCount,
    polygonPlacemarks: polygonCount,
    sourceFile: kmlFilePath,
  };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Extract a field from KML SimpleData.
 * Handles field names with special characters like "addr:street".
 */
function getField(xml: string, name: string): string {
  const escapedName = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const regex = new RegExp(`<SimpleData name="${escapedName}">(.*?)<\\/SimpleData>`, 's');
  const m = regex.exec(xml);
  return m ? m[1].trim() : '';
}

/**
 * Extract the <name> tag from the placemark (outside of ExtendedData).
 */
function extractName(xml: string): string {
  // Match <name> that is NOT inside <SimpleData>
  const m = /^\s*<name>(.*?)<\/name>/m.exec(xml);
  return m ? m[1].trim() : '';
}

/**
 * Extract the <description> tag from the placemark.
 */
function extractDescription(xml: string): string {
  const m = /<description>([\s\S]*?)<\/description>/.exec(xml);
  return m ? m[1].trim() : '';
}

/**
 * Parse a KML coordinate string into {lng, lat} pairs.
 * Handles both "lng,lat" and "lng,lat,alt" formats.
 */
function parseCoordinateString(coordStr: string): Array<{ lng: number; lat: number }> {
  const points: Array<{ lng: number; lat: number }> = [];
  const pairs = coordStr.trim().split(/\s+/);

  for (const pair of pairs) {
    if (!pair.trim()) continue;
    const parts = pair.split(',');
    if (parts.length < 2) continue;
    const lng = parseFloat(parts[0]);
    const lat = parseFloat(parts[1]);
    if (!isNaN(lng) && !isNaN(lat)) {
      points.push({ lng, lat });
    }
  }

  return points;
}

/**
 * Compute centroid (average of vertices).
 */
function computeCentroid(vertices: Array<{ lng: number; lat: number }>): { lat: number; lng: number } {
  let sumLat = 0;
  let sumLng = 0;
  for (const v of vertices) {
    sumLat += v.lat;
    sumLng += v.lng;
  }
  return { lat: sumLat / vertices.length, lng: sumLng / vertices.length };
}

/**
 * Compute approximate polygon area in square meters using the Shoelace formula
 * with a local coordinate projection (sufficient for Bengaluru-scale polygons).
 */
function computePolygonAreaM2(vertices: Array<{ lng: number; lat: number }>): number {
  if (vertices.length < 3) return 0;

  // Convert to approximate meters using equirectangular projection
  const refLat = vertices[0].lat;
  const latScale = 111320; // meters per degree latitude
  const lngScale = 111320 * Math.cos((refLat * Math.PI) / 180); // meters per degree longitude

  const meterVertices = vertices.map((v) => ({
    x: (v.lng - vertices[0].lng) * lngScale,
    y: (v.lat - vertices[0].lat) * latScale,
  }));

  // Shoelace formula
  let area = 0;
  for (let i = 0; i < meterVertices.length; i++) {
    const j = (i + 1) % meterVertices.length;
    area += meterVertices[i].x * meterVertices[j].y;
    area -= meterVertices[j].x * meterVertices[i].y;
  }

  return Math.abs(area / 2);
}

/**
 * Map OSM parking tag to ParkWise ParkingType.
 */
function mapOsmToParkingType(
  parkingType: string,
  fee: string,
  building: string
): ParkingType {
  const pt = parkingType.toLowerCase();

  if (pt === 'underground' || pt === 'multi-storey') return 'GARAGE';
  if (pt === 'street_side' || pt === 'on_street' || pt === 'lane') return 'FREE';
  if (building === 'yes' || building === 'parking' || building === 'public') return 'GARAGE';

  // If fee is explicitly yes
  if (fee === 'yes') return 'PAID';
  // If fee is explicitly no
  if (fee === 'no') return 'FREE';

  // Default: open surface parking
  if (pt === 'surface' || pt === '') return 'OPEN';
  return 'PUBLIC';
}

/**
 * Check if coordinates are within the Bengaluru metro bounding box.
 */
function isWithinBengaluruMetro(lat: number, lng: number): boolean {
  return (
    lat >= BENGALURU_METRO_BOUNDS.minLat &&
    lat <= BENGALURU_METRO_BOUNDS.maxLat &&
    lng >= BENGALURU_METRO_BOUNDS.minLng &&
    lng <= BENGALURU_METRO_BOUNDS.maxLng
  );
}
