// =============================================================================
// ParkWise — Geocoding Service
// =============================================================================
// Abstraction for geocoding (converting place names → coordinates).
// Currently uses mock locations for popular Bengaluru areas.
//
// IMPORTANT: The geocoding provider is abstracted so it can be
// replaced later with Nominatim, Google Places, Mapbox, etc.
// Do NOT hardcode the application around any specific provider.
// =============================================================================

/** Geocoding result */
export interface GeocodingResult {
  /** Place name */
  name: string;
  /** Display name / formatted address */
  displayName: string;
  /** Latitude */
  latitude: number;
  /** Longitude */
  longitude: number;
  /** Result confidence (0-1) */
  confidence?: number;
}

/**
 * Mock popular Bengaluru locations for development.
 * Will be replaced with a real geocoding API later.
 */
const MOCK_LOCATIONS: GeocodingResult[] = [
  { name: 'MG Road', displayName: 'MG Road, Bengaluru', latitude: 12.9756, longitude: 77.6064, confidence: 1 },
  { name: 'Church Street', displayName: 'Church Street, Bengaluru', latitude: 12.9739, longitude: 77.6091, confidence: 1 },
  { name: 'Brigade Road', displayName: 'Brigade Road, Bengaluru', latitude: 12.9719, longitude: 77.6074, confidence: 1 },
  { name: 'Koramangala', displayName: 'Koramangala, Bengaluru', latitude: 12.9352, longitude: 77.6245, confidence: 1 },
  { name: 'Indiranagar', displayName: 'Indiranagar, Bengaluru', latitude: 12.9784, longitude: 77.6408, confidence: 1 },
  { name: 'HSR Layout', displayName: 'HSR Layout, Bengaluru', latitude: 12.9116, longitude: 77.6389, confidence: 1 },
  { name: 'Jayanagar', displayName: 'Jayanagar, Bengaluru', latitude: 12.9299, longitude: 77.5833, confidence: 1 },
  { name: 'Whitefield', displayName: 'Whitefield, Bengaluru', latitude: 12.9698, longitude: 77.7500, confidence: 1 },
  { name: 'Electronic City', displayName: 'Electronic City, Bengaluru', latitude: 12.8440, longitude: 77.6602, confidence: 1 },
  { name: 'Malleshwaram', displayName: 'Malleshwaram, Bengaluru', latitude: 12.9916, longitude: 77.5705, confidence: 1 },
  { name: 'Cubbon Park', displayName: 'Cubbon Park, Bengaluru', latitude: 12.9763, longitude: 77.5929, confidence: 1 },
  { name: 'UB City', displayName: 'UB City, Bengaluru', latitude: 12.9716, longitude: 77.5960, confidence: 1 },
  { name: 'Lalbagh', displayName: 'Lalbagh Botanical Garden, Bengaluru', latitude: 12.9507, longitude: 77.5848, confidence: 1 },
  { name: 'Bangalore Palace', displayName: 'Bangalore Palace, Bengaluru', latitude: 12.9987, longitude: 77.5922, confidence: 1 },
  { name: 'Majestic', displayName: 'Majestic / Kempegowda Bus Station, Bengaluru', latitude: 12.9772, longitude: 77.5720, confidence: 1 },
  { name: 'BTM Layout', displayName: 'BTM Layout, Bengaluru', latitude: 12.9166, longitude: 77.6101, confidence: 1 },
  { name: 'JP Nagar', displayName: 'JP Nagar, Bengaluru', latitude: 12.9063, longitude: 77.5857, confidence: 1 },
  { name: 'Marathahalli', displayName: 'Marathahalli, Bengaluru', latitude: 12.9591, longitude: 77.6974, confidence: 1 },
];

/**
 * Search for locations by query string.
 * Currently uses fuzzy matching against mock locations.
 *
 * @param query - User search query
 * @param limit - Maximum results to return
 * @returns Array of geocoding results
 */
export async function geocodeSearch(
  query: string,
  limit: number = 5
): Promise<GeocodingResult[]> {
  if (!query.trim()) return [];

  const normalizedQuery = query.toLowerCase().trim();

  // TODO: Replace with real geocoding API (Nominatim, Google Places, etc.)
  const matches = MOCK_LOCATIONS.filter(
    (loc) =>
      loc.name.toLowerCase().includes(normalizedQuery) ||
      loc.displayName.toLowerCase().includes(normalizedQuery)
  );

  return matches.slice(0, limit);
}

/**
 * Reverse geocode: convert coordinates to a place name.
 *
 * @param lat - Latitude
 * @param lng - Longitude
 * @returns Closest matching location, or null
 */
export async function reverseGeocode(
  lat: number,
  lng: number
): Promise<GeocodingResult | null> {
  // TODO: Replace with real reverse geocoding API
  // For now, return the closest mock location
  let closest: GeocodingResult | null = null;
  let minDist = Infinity;

  for (const loc of MOCK_LOCATIONS) {
    const dist = Math.sqrt(
      Math.pow(loc.latitude - lat, 2) + Math.pow(loc.longitude - lng, 2)
    );
    if (dist < minDist) {
      minDist = dist;
      closest = loc;
    }
  }

  return closest;
}
