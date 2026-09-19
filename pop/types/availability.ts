// =============================================================================
// ParkWise — Availability Types
// =============================================================================
// Types for the crowdsourced availability estimation system.
// The system progresses through maturity levels:
//   Level 0: No availability data (just "parking exists here")
//   Level 1: User reports ("I parked / I didn't park")
//   Level 2: Rule-based estimation (capacity - confirmed parked)
//   Level 3: Statistical estimation (time-of-day patterns)
//   Level 4: ML prediction (trained model, future)
// =============================================================================

import type { AvailabilityStatus, AvailabilityConfidenceSource } from './parking';

/** Complete availability estimate for a parking location */
export interface AvailabilityEstimate {
  /** Overall status label */
  status: AvailabilityStatus;

  /** Confidence percentage (0-100) */
  confidence: number;

  /** How this estimate was produced */
  source: AvailabilityConfidenceSource;

  /** Estimated range of available spaces */
  estimatedAvailableRange?: {
    min: number;
    max: number;
  };

  /** Human-readable description */
  description: string;

  /** When this estimate was computed */
  computedAt: string;

  /** Input signals used for this estimate */
  signals?: AvailabilitySignal[];
}

/** An individual signal contributing to an availability estimate */
export interface AvailabilitySignal {
  type: 'CONFIRMED_PARKED' | 'GEOFENCE_ENTRY' | 'USER_REPORT' | 'HISTORICAL';
  value: number;
  weight: number;
  timestamp: string;
}

/** Historical occupancy data point (future) */
export interface OccupancyDataPoint {
  /** Day of week (0=Sunday, 6=Saturday) */
  dayOfWeek: number;
  /** Hour of day (0-23) */
  hour: number;
  /** Average occupancy percentage (0-100) */
  averageOccupancy: number;
  /** Number of data points this average is based on */
  sampleSize: number;
}

/** Historical occupancy for a parking location (future) */
export interface ParkingOccupancyHistory {
  parkingId: string;
  dataPoints: OccupancyDataPoint[];
  lastUpdated: string;
}
