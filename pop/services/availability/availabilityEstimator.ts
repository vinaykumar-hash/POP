// =============================================================================
// ParkWise — Availability Estimator
// =============================================================================
// Rule-based availability estimation. NO ML.
//
// This is a placeholder for the future crowdsourced + ML system.
// Currently, it simply reflects whatever availability data exists
// in the parking location record, without inventing data.
//
// IMPORTANT DESIGN PRINCIPLE:
// - Never represent an estimate as confirmed truth.
// - Always include confidence levels and source attribution.
// - Use cautious language: "Likely available", not "Available".
// - If no data exists, say "Unknown" — never guess.
// =============================================================================

import type { ParkingLocation, AvailabilityStatus } from '@/types/parking';
import type { AvailabilityEstimate } from '@/types/availability';

/**
 * Get the current availability estimate for a parking location.
 *
 * Currently returns the availability data from the parking record itself.
 * In the future, this will combine:
 *   - Base data (capacity, operating hours)
 *   - Crowdsourced signals (user confirmations, geofence events)
 *   - Historical patterns (time-of-day occupancy)
 *   - ML predictions
 *
 * @param parking - The parking location
 * @returns Availability estimate
 */
export function estimateAvailability(
  parking: ParkingLocation
): AvailabilityEstimate {
  const availability = parking.currentAvailability;

  // If no availability data exists, return UNKNOWN
  if (!availability) {
    return {
      status: 'UNKNOWN',
      confidence: 0,
      source: 'NONE',
      description: 'Availability information is not available for this location.',
      computedAt: new Date().toISOString(),
    };
  }

  return {
    status: availability.status,
    confidence: availability.confidence ?? 0,
    source: availability.source,
    description: getStatusDescription(
      availability.status,
      availability.confidence ?? 0,
      availability.availableSpaces
    ),
    estimatedAvailableRange: availability.availableSpaces !== undefined
      ? {
          min: Math.max(0, availability.availableSpaces - 3),
          max: availability.availableSpaces + 3,
        }
      : undefined,
    computedAt: new Date().toISOString(),
  };
}

/**
 * Generate a human-readable description for an availability status.
 * Uses cautious language — never claims certainty without data.
 */
function getStatusDescription(
  status: AvailabilityStatus,
  confidence: number,
  availableSpaces?: number
): string {
  const confidenceLabel =
    confidence >= 80
      ? 'High confidence'
      : confidence >= 50
        ? 'Moderate confidence'
        : confidence > 0
          ? 'Low confidence'
          : 'No data';

  switch (status) {
    case 'AVAILABLE':
      return availableSpaces !== undefined
        ? `Approximately ${availableSpaces} spaces likely available. ${confidenceLabel}.`
        : `Parking appears to be available. ${confidenceLabel}.`;

    case 'LIKELY_AVAILABLE':
      return `Parking is likely available. ${confidenceLabel}.`;

    case 'LIMITED':
      return availableSpaces !== undefined
        ? `Limited spaces — approximately ${availableSpaces} may be available. ${confidenceLabel}.`
        : `Parking may have limited availability. ${confidenceLabel}.`;

    case 'LIKELY_FULL':
      return `Parking is likely full or very busy. ${confidenceLabel}.`;

    case 'FULL':
      return `Parking appears to be full. ${confidenceLabel}.`;

    case 'UNKNOWN':
    default:
      return 'Availability information is not available for this location.';
  }
}

/**
 * Get a display label for an availability status.
 */
export function getStatusLabel(status: AvailabilityStatus): string {
  switch (status) {
    case 'AVAILABLE':
      return 'Available';
    case 'LIKELY_AVAILABLE':
      return 'Likely Available';
    case 'LIMITED':
      return 'Limited';
    case 'LIKELY_FULL':
      return 'Likely Full';
    case 'FULL':
      return 'Full';
    case 'UNKNOWN':
    default:
      return 'Unknown';
  }
}

/**
 * Get a CSS-friendly color class for an availability status.
 */
export function getStatusColor(status: AvailabilityStatus): string {
  switch (status) {
    case 'AVAILABLE':
      return 'available';
    case 'LIKELY_AVAILABLE':
      return 'likely-available';
    case 'LIMITED':
      return 'limited';
    case 'LIKELY_FULL':
      return 'likely-full';
    case 'FULL':
      return 'full';
    case 'UNKNOWN':
    default:
      return 'unknown';
  }
}
