// =============================================================================
// ParkWise — Parking Data Parser
// =============================================================================
// Placeholder parser for converting external parking datasets into
// the ParkWise ParkingLocation schema.
//
// USAGE:
// When the user provides a parking dataset (CSV, JSON, or GeoJSON),
// implement the appropriate parser function below and call
// parkingDataService.importParkingLocations() with the results.
// =============================================================================

import type { ParkingLocation, ParkingType, ParkingSource } from '@/types/parking';

/** Raw record from a generic CSV/JSON parking dataset */
export interface RawParkingRecord {
  [key: string]: unknown;
}

/** Result of parsing a dataset */
export interface ParseResult {
  /** Successfully parsed parking locations */
  locations: ParkingLocation[];
  /** Records that failed validation */
  errors: ParseError[];
  /** Total records in the source file */
  totalRecords: number;
}

/** A single parse error */
export interface ParseError {
  recordIndex: number;
  field: string;
  message: string;
  rawValue?: unknown;
}

/**
 * Parse a JSON parking dataset.
 * The mapping function converts raw records to ParkingLocation schema.
 *
 * @param data - Raw JSON array
 * @param mapFn - Function to map a raw record to ParkingLocation
 * @returns ParseResult
 */
export function parseJsonDataset(
  data: RawParkingRecord[],
  mapFn: (record: RawParkingRecord, index: number) => ParkingLocation | null
): ParseResult {
  const locations: ParkingLocation[] = [];
  const errors: ParseError[] = [];

  data.forEach((record, index) => {
    try {
      const location = mapFn(record, index);
      if (location && isValidParkingLocation(location)) {
        locations.push(location);
      } else if (location) {
        errors.push({
          recordIndex: index,
          field: 'validation',
          message: 'Location failed validation',
        });
      }
    } catch (err) {
      errors.push({
        recordIndex: index,
        field: 'mapping',
        message: err instanceof Error ? err.message : 'Unknown mapping error',
      });
    }
  });

  return { locations, errors, totalRecords: data.length };
}

/**
 * Parse a GeoJSON FeatureCollection of parking locations.
 *
 * @param geojson - GeoJSON FeatureCollection
 * @param source - Data source label
 * @returns ParseResult
 */
export function parseGeoJsonDataset(
  geojson: GeoJSON.FeatureCollection,
  source: ParkingSource = 'OTHER'
): ParseResult {
  const locations: ParkingLocation[] = [];
  const errors: ParseError[] = [];

  const features = geojson.features || [];

  features.forEach((feature, index) => {
    try {
      if (
        feature.geometry.type !== 'Point' ||
        !feature.geometry.coordinates ||
        feature.geometry.coordinates.length < 2
      ) {
        errors.push({
          recordIndex: index,
          field: 'geometry',
          message: 'Expected Point geometry with coordinates',
        });
        return;
      }

      const [longitude, latitude] = feature.geometry.coordinates;
      const props = feature.properties || {};

      const location: ParkingLocation = {
        id: (props.id as string) || `${source}-${index}`,
        name: (props.name as string) || `Parking #${index + 1}`,
        latitude,
        longitude,
        type: mapParkingType(props.type as string | undefined),
        source,
        capacity: typeof props.capacity === 'number' ? props.capacity : undefined,
        pricePerHour: typeof props.fee === 'number' ? props.fee : undefined,
        address: (props.address as string) || undefined,
        description: (props.description as string) || undefined,
        sourceMetadata: props,
      };

      if (isValidParkingLocation(location)) {
        locations.push(location);
      } else {
        errors.push({
          recordIndex: index,
          field: 'validation',
          message: 'Location failed validation',
        });
      }
    } catch (err) {
      errors.push({
        recordIndex: index,
        field: 'parsing',
        message: err instanceof Error ? err.message : 'Unknown error',
      });
    }
  });

  return { locations, errors, totalRecords: features.length };
}

/**
 * Validate that a ParkingLocation has the minimum required fields.
 */
function isValidParkingLocation(location: ParkingLocation): boolean {
  return (
    typeof location.id === 'string' &&
    location.id.length > 0 &&
    typeof location.name === 'string' &&
    location.name.length > 0 &&
    typeof location.latitude === 'number' &&
    location.latitude >= -90 &&
    location.latitude <= 90 &&
    typeof location.longitude === 'number' &&
    location.longitude >= -180 &&
    location.longitude <= 180
  );
}

/**
 * Map a raw parking type string to our ParkingType enum.
 */
function mapParkingType(raw?: string): ParkingType {
  if (!raw) return 'OPEN';
  const upper = raw.toUpperCase();
  if (upper.includes('FREE')) return 'FREE';
  if (upper.includes('GARAGE') || upper.includes('MULTI')) return 'GARAGE';
  if (upper.includes('PAID') || upper.includes('FEE')) return 'PAID';
  if (upper.includes('PUBLIC')) return 'PUBLIC';
  return 'OPEN';
}

// GeoJSON types (minimal, for parser use)
declare namespace GeoJSON {
  interface FeatureCollection {
    type: 'FeatureCollection';
    features: Feature[];
  }
  interface Feature {
    type: 'Feature';
    geometry: Geometry;
    properties: Record<string, unknown> | null;
  }
  interface Geometry {
    type: string;
    coordinates: number[];
  }
}
