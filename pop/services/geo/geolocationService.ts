// =============================================================================
// ParkWise — Browser Geolocation Service
// =============================================================================
// Wraps the browser Geolocation API with proper permission handling,
// error states, and TypeScript types.
//
// LIMITATIONS (documented for transparency):
// - Browser geolocation requires HTTPS in production.
// - Accuracy varies by device and environment.
// - Continuous background tracking is NOT reliable on the web.
//   For background tracking, a native mobile app is needed.
// - Some browsers block geolocation in iframes.
// =============================================================================

import type { UserLocation, LocationError } from '@/types/user';

/**
 * Check if the Geolocation API is available in the current browser.
 */
export function isGeolocationSupported(): boolean {
  return typeof window !== 'undefined' && 'geolocation' in navigator;
}

/**
 * Request the user's current position.
 *
 * @param options - PositionOptions for the Geolocation API
 * @returns Promise resolving to UserLocation
 * @throws LocationError on failure
 */
export function getCurrentPosition(
  options?: PositionOptions
): Promise<UserLocation> {
  return new Promise((resolve, reject) => {
    if (!isGeolocationSupported()) {
      reject({
        code: 'NOT_SUPPORTED',
        message: 'Geolocation is not supported by this browser.',
      } as LocationError);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        resolve({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracy: position.coords.accuracy,
          timestamp: position.timestamp,
        });
      },
      (error) => {
        reject(mapGeolocationError(error));
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 60000, // Accept cached position up to 1 minute old
        ...options,
      }
    );
  });
}

/**
 * Watch the user's position (continuous updates).
 *
 * NOTE: On the web, this only works while the page is in the foreground.
 * Background tracking requires a native mobile application.
 *
 * @param onUpdate - Callback for position updates
 * @param onError - Callback for errors
 * @param options - PositionOptions
 * @returns watchId — pass to clearWatch() to stop
 */
export function watchPosition(
  onUpdate: (location: UserLocation) => void,
  onError: (error: LocationError) => void,
  options?: PositionOptions
): number | null {
  if (!isGeolocationSupported()) {
    onError({
      code: 'NOT_SUPPORTED',
      message: 'Geolocation is not supported by this browser.',
    });
    return null;
  }

  return navigator.geolocation.watchPosition(
    (position) => {
      onUpdate({
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
        accuracy: position.coords.accuracy,
        timestamp: position.timestamp,
      });
    },
    (error) => {
      onError(mapGeolocationError(error));
    },
    {
      enableHighAccuracy: true,
      timeout: 15000,
      maximumAge: 30000,
      ...options,
    }
  );
}

/**
 * Stop watching user's position.
 */
export function clearWatch(watchId: number): void {
  if (isGeolocationSupported()) {
    navigator.geolocation.clearWatch(watchId);
  }
}

/**
 * Check the current geolocation permission status.
 * Uses the Permissions API if available.
 *
 * @returns 'granted' | 'denied' | 'prompt' | 'unknown'
 */
export async function checkPermissionStatus(): Promise<string> {
  if (typeof navigator === 'undefined' || !navigator.permissions) {
    return 'unknown';
  }

  try {
    const result = await navigator.permissions.query({ name: 'geolocation' });
    return result.state; // 'granted', 'denied', or 'prompt'
  } catch {
    return 'unknown';
  }
}

/**
 * Map browser GeolocationPositionError to our LocationError type.
 */
function mapGeolocationError(error: GeolocationPositionError): LocationError {
  switch (error.code) {
    case error.PERMISSION_DENIED:
      return {
        code: 'PERMISSION_DENIED',
        message:
          'Location permission was denied. Please enable location access in your browser settings.',
      };
    case error.POSITION_UNAVAILABLE:
      return {
        code: 'POSITION_UNAVAILABLE',
        message:
          'Your location could not be determined. Please check your device settings.',
      };
    case error.TIMEOUT:
      return {
        code: 'TIMEOUT',
        message:
          'Location request timed out. Please try again.',
      };
    default:
      return {
        code: 'POSITION_UNAVAILABLE',
        message: error.message || 'An unknown error occurred.',
      };
  }
}
