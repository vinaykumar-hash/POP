// =============================================================================
// ParkWise — Parking Data Model
// =============================================================================
// This file defines the core parking data types used throughout the application.
// The model distinguishes between:
//   1. Parking location EXISTS (static data from OSM/OpenCity/etc.)
//   2. Parking is currently AVAILABLE (real-time or near-real-time)
//   3. Availability is ESTIMATED (rule-based, from crowdsourced signals)
//   4. Availability is PREDICTED (ML model, future feature)
// =============================================================================

/** Type of parking location */
export type ParkingType = 'FREE' | 'PAID' | 'PUBLIC' | 'GARAGE' | 'OPEN';

/** Where the parking data originated */
export type ParkingSource = 'OSM' | 'OPENCITY' | 'USER' | 'HOST' | 'OTHER';

/** Vehicle types supported at a parking location */
export type VehicleType = 'TWO_WHEELER' | 'CAR' | 'BICYCLE' | 'HEAVY';

/** Availability status — ordered from best to worst */
export type AvailabilityStatus =
  | 'AVAILABLE'       // Confirmed available
  | 'LIKELY_AVAILABLE' // Estimated to be available
  | 'LIMITED'          // Few spaces left (confirmed or estimated)
  | 'LIKELY_FULL'      // Estimated to be full
  | 'FULL'             // Confirmed full
  | 'UNKNOWN';         // No data available

/**
 * How the availability information was determined.
 * This is critical for transparency — users should know
 * whether availability is confirmed or just an estimate.
 */
export type AvailabilityConfidenceSource =
  | 'CONFIRMED'        // Direct sensor/manual confirmation
  | 'CROWDSOURCED'     // From user reports/signals
  | 'ESTIMATED'        // Rule-based estimation
  | 'PREDICTED'        // ML prediction (future)
  | 'HISTORICAL'       // Based on historical patterns
  | 'NONE';            // No availability data at all

/** Real-time or estimated availability for a parking location */
export interface CurrentAvailability {
  /** Number of spaces currently available (if known) */
  availableSpaces?: number;
  /** Number of spaces currently occupied (if known) */
  occupiedSpaces?: number;
  /** Overall availability status */
  status: AvailabilityStatus;
  /** Confidence in the availability estimate (0-100) */
  confidence?: number;
  /** How this availability was determined */
  source: AvailabilityConfidenceSource;
  /** When this availability information was last updated */
  lastUpdated?: string;
}

/** Facilities available at the parking location */
export interface ParkingFacilities {
  covered?: boolean;
  evCharging?: boolean;
  cctv?: boolean;
  security?: boolean;
  wheelchairAccessible?: boolean;
  restroom?: boolean;
  lighting?: boolean;
}

/**
 * Core parking location entity.
 *
 * Represents a known parking location from any data source.
 * Not all fields will be populated — data availability depends on the source.
 */
export interface ParkingLocation {
  /** Unique identifier */
  id: string;

  /** Human-readable name */
  name: string;

  /** WGS84 latitude */
  latitude: number;

  /** WGS84 longitude */
  longitude: number;

  /** Type of parking */
  type: ParkingType;

  /** Data source */
  source: ParkingSource;

  /** Total parking capacity (if known) */
  capacity?: number;

  /** Surveyed polygon area in square meters (if polygon data exists) */
  areaSquareMeters?: number;

  /** Price per hour in INR (if applicable) */
  pricePerHour?: number;

  /** Vehicle types supported */
  vehicleTypes?: VehicleType[];

  /** Facilities */
  facilities?: ParkingFacilities;

  /** Opening time (HH:MM format, 24h) */
  openingTime?: string;

  /** Closing time (HH:MM format, 24h) */
  closingTime?: string;

  /** Human-readable address */
  address?: string;

  /** Description or notes */
  description?: string;

  /** Current availability (may not be available for all locations) */
  currentAvailability?: CurrentAvailability;

  /** Raw tags/metadata from the data source (for debugging/future use) */
  sourceMetadata?: Record<string, unknown>;
}

/**
 * Parking search result — a parking location enriched with
 * distance and routing information relative to the user/destination.
 */
export interface ParkingSearchResult {
  /** The parking location */
  parking: ParkingLocation;

  /** Straight-line distance in meters (Haversine) */
  straightLineDistance: number;

  /** Road distance in meters (from OSRM, if available) */
  roadDistance?: number;

  /** Estimated driving time in seconds (from OSRM, if available) */
  estimatedDriveTime?: number;

  /** Walking distance in meters (if available) */
  walkingDistance?: number;

  /** Estimated walking time in seconds (if available) */
  estimatedWalkTime?: number;
}

/** Filters that can be applied to parking search */
export interface ParkingFilters {
  types?: ParkingType[];
  maxDistance?: number; // in meters
  maxPrice?: number;
  vehicleType?: VehicleType;
  covered?: boolean;
  evCharging?: boolean;
  availabilityStatus?: AvailabilityStatus[];
}

/** Sort options for parking results */
export type ParkingSortBy = 'distance' | 'price' | 'availability' | 'rating';
