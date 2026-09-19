// =============================================================================
// ParkWise — OSRM Routing Service
// =============================================================================
// Provides road-based distance, estimated travel time, and route geometry
// using the Open Source Routing Machine (OSRM).
//
// IMPORTANT:
// - Uses the public OSRM demo server for development with timeouts.
// - Supports full GeoJSON geometries for drawing routes on the Leaflet map.
// - Fast batch enrichment for top parking candidates.
// =============================================================================

/** OSRM basic route result */
export interface RouteResult {
  /** Road distance in meters */
  distance: number;
  /** Estimated travel time in seconds */
  duration: number;
  /** Encoded polyline or geometry if requested */
  geometry?: string;
}

/** Detailed route with full coordinate path for map rendering */
export interface DetailedRouteResult {
  /** Road distance in meters */
  distance: number;
  /** Estimated travel time in seconds */
  duration: number;
  /** Array of [latitude, longitude] points ready for Leaflet polyline */
  coordinates: Array<[number, number]>;
}

const OSRM_BASE_URL =
  process.env.NEXT_PUBLIC_OSRM_URL || 'https://router.project-osrm.org';

const TIMEOUT_MS = 4000;

/**
 * Get driving route between two points using OSRM (distance & duration only).
 */
export async function getDrivingRoute(
  fromLat: number,
  fromLng: number,
  toLat: number,
  toLng: number
): Promise<RouteResult | null> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS);

    // OSRM expects coordinates as lng,lat
    const url = `${OSRM_BASE_URL}/route/v1/driving/${fromLng},${fromLat};${toLng},${toLat}?overview=false`;

    const response = await fetch(url, { signal: controller.signal });
    clearTimeout(timeoutId);

    if (!response.ok) {
      console.warn(`[OSRMService] HTTP ${response.status} from OSRM`);
      return null;
    }

    const data = await response.json();

    if (data.code !== 'Ok' || !data.routes || data.routes.length === 0) {
      return null;
    }

    const route = data.routes[0];
    return {
      distance: route.distance,
      duration: route.duration,
    };
  } catch (error) {
    // Graceful fallback on abort or network error
    return null;
  }
}

/**
 * Get full detailed route with GeoJSON coordinates for rendering on map.
 */
export async function getDetailedRoute(
  fromLat: number,
  fromLng: number,
  toLat: number,
  toLng: number
): Promise<DetailedRouteResult | null> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS);

    // Request full overview in GeoJSON format
    const url = `${OSRM_BASE_URL}/route/v1/driving/${fromLng},${fromLat};${toLng},${toLat}?overview=full&geometries=geojson`;

    const response = await fetch(url, { signal: controller.signal });
    clearTimeout(timeoutId);

    if (!response.ok) {
      console.warn(`[OSRMService] HTTP ${response.status} from OSRM`);
      return null;
    }

    const data = await response.json();

    if (data.code !== 'Ok' || !data.routes || data.routes.length === 0) {
      return null;
    }

    const route = data.routes[0];
    // OSRM GeoJSON geometry coordinates are [lng, lat].
    // Leaflet requires [lat, lng].
    const rawCoords: Array<[number, number]> = route.geometry?.coordinates || [];
    const leafletCoords: Array<[number, number]> = rawCoords.map(([lng, lat]) => [lat, lng]);

    return {
      distance: route.distance,
      duration: route.duration,
      coordinates: leafletCoords,
    };
  } catch (error) {
    console.warn('[OSRMService] Failed to fetch detailed route:', error);
    return null;
  }
}

/**
 * Get driving routes to multiple destinations from a single origin.
 * Enriches a shortlist of candidates with road distance and driving duration.
 */
export async function getRoutesToMultiple(
  fromLat: number,
  fromLng: number,
  destinations: Array<{ lat: number; lng: number }>
): Promise<Map<number, RouteResult>> {
  const results = new Map<number, RouteResult>();

  // Process in small parallel batches with concurrency control
  const BATCH_SIZE = 4;
  for (let i = 0; i < destinations.length; i += BATCH_SIZE) {
    const batch = destinations.slice(i, i + BATCH_SIZE);
    const promises = batch.map(async (dest, batchIdx) => {
      const result = await getDrivingRoute(
        fromLat,
        fromLng,
        dest.lat,
        dest.lng
      );
      if (result) {
        results.set(i + batchIdx, result);
      }
    });

    await Promise.all(promises);
  }

  return results;
}
