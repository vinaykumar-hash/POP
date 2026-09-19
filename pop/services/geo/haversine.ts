// =============================================================================
// ParkWise — Haversine Distance Calculation
// =============================================================================
// Calculates the great-circle distance between two points on the Earth
// using the Haversine formula. This gives straight-line ("as the crow flies")
// distance, NOT road distance.
//
// Used as the first-stage filter before expensive routing calculations.
// =============================================================================

const EARTH_RADIUS_METERS = 6_371_000; // Earth's mean radius in meters

/**
 * Convert degrees to radians.
 */
function toRadians(degrees: number): number {
  return degrees * (Math.PI / 180);
}

/**
 * Calculate the Haversine (straight-line) distance between two geographic points.
 *
 * @param lat1 - Latitude of point 1 (in degrees)
 * @param lon1 - Longitude of point 1 (in degrees)
 * @param lat2 - Latitude of point 2 (in degrees)
 * @param lon2 - Longitude of point 2 (in degrees)
 * @returns Distance in meters
 */
export function calculateHaversineDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const dLat = toRadians(lat2 - lat1);
  const dLon = toRadians(lon2 - lon1);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRadians(lat1)) *
      Math.cos(toRadians(lat2)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return EARTH_RADIUS_METERS * c;
}

/**
 * Check if a point is within a given radius of another point.
 *
 * @param centerLat - Center latitude
 * @param centerLon - Center longitude
 * @param pointLat - Point latitude
 * @param pointLon - Point longitude
 * @param radiusMeters - Radius in meters
 * @returns true if the point is within the radius
 */
export function isWithinRadius(
  centerLat: number,
  centerLon: number,
  pointLat: number,
  pointLon: number,
  radiusMeters: number
): boolean {
  return (
    calculateHaversineDistance(centerLat, centerLon, pointLat, pointLon) <=
    radiusMeters
  );
}

/**
 * Format a distance in meters to a human-readable string.
 *
 * @param meters - Distance in meters
 * @returns Formatted string (e.g., "450 m" or "2.3 km")
 */
export function formatDistance(meters: number): string {
  if (meters < 1000) {
    return `${Math.round(meters)} m`;
  }
  return `${(meters / 1000).toFixed(1)} km`;
}

/**
 * Format duration in seconds to a human-readable string.
 *
 * @param seconds - Duration in seconds
 * @returns Formatted string (e.g., "2 min" or "1 hr 15 min")
 */
export function formatDuration(seconds: number): string {
  if (seconds < 60) {
    return '< 1 min';
  }
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) {
    return `${minutes} min`;
  }
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  if (remainingMinutes === 0) {
    return `${hours} hr`;
  }
  return `${hours} hr ${remainingMinutes} min`;
}
