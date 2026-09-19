// =============================================================================
// ParkWise — OpenCity KML Parser
// =============================================================================
// Server-side parser for OpenCity Bengaluru parking KML data.
//
// The KML file contains polygon boundaries of parking areas.
// Each placemark has:
//   - OBJECTID (unique numeric ID)
//   - Remarks / FinalRemarks (parking description + context)
//   - Optional_Text (named entity, often empty)
//   - SHAPE.STArea() (polygon area in sq meters)
//   - Polygon coordinates (boundary vertices in lng,lat format)
//
// This parser:
//   1. Extracts all placemarks from the KML XML
//   2. Computes the centroid of each polygon
//   3. Generates human-readable names
//   4. Estimates capacity from area (rough, clearly labeled)
//   5. Returns ParkingLocation[] with source='OPENCITY'
//
// IMPORTANT: All availability is set to UNKNOWN because this dataset
// only tells us "parking exists here" — NOT whether it's available.
// =============================================================================

import * as fs from 'fs';
import * as path from 'path';
import type { ParkingLocation } from '@/types/parking';

/** Result of parsing a KML dataset */
export interface KmlParseResult {
  locations: ParkingLocation[];
  errors: KmlParseError[];
  totalPlacemarks: number;
  sourceFile: string;
}

/** A single parse error */
export interface KmlParseError {
  placemarkIndex: number;
  objectId?: string;
  message: string;
}

/** Parsed raw placemark data before conversion */
interface RawPlacemark {
  objectId: string;
  lulcCode: string;
  lulcDesc1: string;
  remarks: string;
  finalRemarks: string;
  optionalText: string;
  areaSquareMeters: number;
  perimeterMeters: number;
  coordinates: Array<{ lng: number; lat: number }>;
}

// ---------------------------------------------------------------------------
// Bengaluru bounding box for coordinate validation
// ---------------------------------------------------------------------------
const BENGALURU_BOUNDS = {
  minLat: 12.7,
  maxLat: 13.2,
  minLng: 77.3,
  maxLng: 77.9,
};

// ---------------------------------------------------------------------------
// Rough capacity estimation
// ---------------------------------------------------------------------------
// Typical car parking space: ~12.5 m² (2.5m × 5m)
// With aisles/driveways, effective area per space: ~25-30 m²
// We use 28 m² as a conservative middle estimate.
// This is VERY rough and clearly labeled as estimated.
const AREA_PER_CAR_SPACE_M2 = 28;

/**
 * Parse the OpenCity Bengaluru parking KML file.
 *
 * @param kmlFilePath - Absolute path to the KML file
 * @returns KmlParseResult with parsed parking locations
 */
export function parseOpenCityKml(kmlFilePath: string): KmlParseResult {
  const errors: KmlParseError[] = [];
  const locations: ParkingLocation[] = [];

  // Read the file
  let kmlContent: string;
  try {
    kmlContent = fs.readFileSync(kmlFilePath, 'utf-8');
  } catch (err) {
    return {
      locations: [],
      errors: [
        {
          placemarkIndex: -1,
          message: `Failed to read KML file: ${err instanceof Error ? err.message : String(err)}`,
        },
      ],
      totalPlacemarks: 0,
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

  // Parse each placemark
  for (let i = 0; i < placemarks.length; i++) {
    try {
      const raw = extractPlacemarkData(placemarks[i]);

      if (!raw) {
        errors.push({
          placemarkIndex: i,
          message: 'Failed to extract placemark data',
        });
        continue;
      }

      if (raw.coordinates.length < 3) {
        errors.push({
          placemarkIndex: i,
          objectId: raw.objectId,
          message: `Polygon has fewer than 3 vertices (${raw.coordinates.length})`,
        });
        continue;
      }

      // Compute centroid
      const centroid = computePolygonCentroid(raw.coordinates);

      // Validate centroid is within Bengaluru
      if (!isWithinBengaluru(centroid.lat, centroid.lng)) {
        errors.push({
          placemarkIndex: i,
          objectId: raw.objectId,
          message: `Centroid (${centroid.lat.toFixed(4)}, ${centroid.lng.toFixed(4)}) is outside Bengaluru bounds`,
        });
        continue;
      }

      // Generate name
      const name = generateParkingName(raw, i);

      // Estimate capacity
      const estimatedCapacity =
        raw.areaSquareMeters > 0
          ? Math.max(1, Math.floor(raw.areaSquareMeters / AREA_PER_CAR_SPACE_M2))
          : undefined;

      // Build ParkingLocation
      const location: ParkingLocation = {
        id: `OPENCITY-${raw.objectId}`,
        name,
        latitude: centroid.lat,
        longitude: centroid.lng,
        type: 'OPEN',
        source: 'OPENCITY',
        capacity: estimatedCapacity,
        areaSquareMeters: raw.areaSquareMeters > 0 ? raw.areaSquareMeters : undefined,
        vehicleTypes: ['CAR', 'TWO_WHEELER'],
        facilities: {
          covered: false,
        },
        address: extractAddress(raw),
        description: buildDescription(raw, estimatedCapacity),
        currentAvailability: {
          status: 'UNKNOWN',
          confidence: 0,
          source: 'NONE',
        },
        sourceMetadata: {
          objectId: raw.objectId,
          lulcCode: raw.lulcCode,
          lulcDesc1: raw.lulcDesc1,
          remarks: raw.remarks,
          finalRemarks: raw.finalRemarks,
          optionalText: raw.optionalText,
          areaSquareMeters: raw.areaSquareMeters,
          perimeterMeters: raw.perimeterMeters,
          polygonVertexCount: raw.coordinates.length,
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
    sourceFile: kmlFilePath,
  };
}

/**
 * Extract raw data from a single Placemark XML block.
 */
function extractPlacemarkData(xml: string): RawPlacemark | null {
  const getField = (name: string): string => {
    // Handle field names with special chars like "SHAPE.STArea()"
    const escapedName = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(
      `<SimpleData name="${escapedName}">(.*?)<\\/SimpleData>`,
      's'
    );
    const m = regex.exec(xml);
    return m ? m[1].trim() : '';
  };

  const objectId = getField('OBJECTID');
  if (!objectId) return null;

  // Extract coordinates from the first <coordinates> block
  const coordMatch = /<coordinates>([\s\S]*?)<\/coordinates>/.exec(xml);
  if (!coordMatch) return null;

  const coordString = coordMatch[1].trim();
  const coordinates = parseCoordinateString(coordString);

  return {
    objectId,
    lulcCode: getField('LULC_Code'),
    lulcDesc1: getField('LULC_Desc_1'),
    remarks: getField('Remarks'),
    finalRemarks: getField('FinalRemarks'),
    optionalText: getField('Optional_Text'),
    areaSquareMeters: parseFloat(getField('SHAPE.STArea()')) || 0,
    perimeterMeters: parseFloat(getField('SHAPE.STLength()')) || 0,
    coordinates,
  };
}

/**
 * Parse a KML coordinate string into an array of {lng, lat} objects.
 * KML format: "lng,lat,alt lng,lat,alt ..." (space-separated, comma between components)
 */
function parseCoordinateString(
  coordStr: string
): Array<{ lng: number; lat: number }> {
  const points: Array<{ lng: number; lat: number }> = [];

  const pairs = coordStr.split(/\s+/);
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
 * Compute the centroid (geometric center) of a polygon.
 * Uses the simple average of all vertices — sufficient for our marker placement.
 */
function computePolygonCentroid(
  vertices: Array<{ lng: number; lat: number }>
): { lat: number; lng: number } {
  let sumLat = 0;
  let sumLng = 0;

  for (const v of vertices) {
    sumLat += v.lat;
    sumLng += v.lng;
  }

  return {
    lat: sumLat / vertices.length,
    lng: sumLng / vertices.length,
  };
}

/**
 * Check if coordinates are within the Bengaluru bounding box.
 */
function isWithinBengaluru(lat: number, lng: number): boolean {
  return (
    lat >= BENGALURU_BOUNDS.minLat &&
    lat <= BENGALURU_BOUNDS.maxLat &&
    lng >= BENGALURU_BOUNDS.minLng &&
    lng <= BENGALURU_BOUNDS.maxLng
  );
}

/**
 * Generate a human-readable parking name from the raw KML data.
 *
 * Priority:
 * 1. Optional_Text (named entity like "Depot 13 Kamayka")
 * 2. FinalRemarks with cleanup (e.g., "Park / Garden-Parking Area" → "Park / Garden Parking")
 * 3. Remarks (e.g., "Parking Area")
 * 4. Fallback: "Open Parking #N"
 */
function generateParkingName(raw: RawPlacemark, index: number): string {
  // If Optional_Text is populated, use it as primary context
  if (raw.optionalText.trim()) {
    const text = raw.optionalText.trim();
    return `${text} Parking`;
  }

  // Try to extract meaningful context from FinalRemarks
  if (raw.finalRemarks.trim()) {
    const cleaned = cleanFinalRemarks(raw.finalRemarks);
    if (cleaned && cleaned !== 'Parking' && cleaned !== 'Parking Area') {
      return cleaned;
    }
  }

  // Use Remarks
  if (raw.remarks.trim()) {
    const remark = raw.remarks.trim();
    if (remark.toLowerCase() !== 'parking') {
      return remark;
    }
  }

  return `Open Parking #${index + 1}`;
}

/**
 * Clean up the FinalRemarks field to produce a readable name.
 *
 * Examples:
 *   "Others-Parking Area" → "Parking Area"
 *   "Park / Garden-Parking" → "Park / Garden Parking"
 *   "School / Colleges-Delhi Public School, Bangalore East-Parking Area"
 *     → "Delhi Public School, Bangalore East Parking"
 *   "Recreational-Inner Circle Municipal Park-Parking Area"
 *     → "Inner Circle Municipal Park Parking"
 *   "Bengaluru-Parking" → "Bengaluru Parking"
 */
function cleanFinalRemarks(finalRemarks: string): string {
  const parts = finalRemarks.split('-');

  // If there are 3+ parts, the middle parts are the most descriptive
  // e.g., "School / Colleges-Delhi Public School, Bangalore East-Parking Area"
  if (parts.length >= 3) {
    // Take middle parts as the name, last part is usually "Parking Area"
    const middleParts = parts.slice(1, -1).join(' ').trim();
    if (middleParts && middleParts.toLowerCase() !== 'bengaluru') {
      return `${middleParts} Parking`;
    }
  }

  if (parts.length === 2) {
    const category = parts[0].trim();
    const parkingPart = parts[1].trim();

    // If category is generic ("Others"), just use the parking part
    if (
      category.toLowerCase() === 'others' ||
      category.toLowerCase() === 'vacant land'
    ) {
      return parkingPart;
    }

    // If category is descriptive, combine
    if (category && category.toLowerCase() !== 'bengaluru') {
      return `${category} ${parkingPart.replace(/\bParking\b\s*$/, '')} Parking`.replace(/\s+/g, ' ').trim();
    }

    return parkingPart;
  }

  return finalRemarks.trim();
}

/**
 * Extract a rough address from the available fields.
 */
function extractAddress(raw: RawPlacemark): string | undefined {
  const parts: string[] = [];

  if (raw.optionalText.trim()) {
    parts.push(raw.optionalText.trim());
  }

  parts.push('Bengaluru');
  return parts.join(', ');
}

/**
 * Build a description string for the parking location.
 */
function buildDescription(
  raw: RawPlacemark,
  estimatedCapacity?: number
): string {
  const parts: string[] = [
    'Source: OpenCity Bengaluru open parking dataset.',
  ];

  if (raw.areaSquareMeters > 0) {
    parts.push(`Parking area: ~${Math.round(raw.areaSquareMeters).toLocaleString()} sq meters.`);
  }

  if (estimatedCapacity !== undefined) {
    parts.push(
      `Estimated capacity: ~${estimatedCapacity} vehicles (rough estimate based on area, actual capacity may vary).`
    );
  }

  parts.push(
    'Availability information is not provided by this dataset.'
  );

  return parts.join(' ');
}

/**
 * Get the default KML file path.
 */
export function getDefaultKmlPath(): string {
  return path.join(
    process.cwd(),
    'data',
    'mock',
    '4681133c-2c40-4803-93bb-78a4d3fb2249.kml'
  );
}
