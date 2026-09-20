// =============================================================================
// ParkWise — User Types
// =============================================================================

/** User's geographic location from browser Geolocation API */
export interface UserLocation {
  latitude: number;
  longitude: number;
  /** Accuracy in meters */
  accuracy?: number;
  /** When this location was obtained */
  timestamp: number;
}

/** Browser geolocation permission states */
export type LocationPermissionState =
  | 'prompt'       // User hasn't been asked yet
  | 'requesting'   // Currently requesting permission
  | 'granted'      // Permission granted
  | 'denied'       // Permission explicitly denied
  | 'unavailable'  // Geolocation API not available
  | 'error';       // Error obtaining location

/** Geolocation error details */
export interface LocationError {
  code: 'PERMISSION_DENIED' | 'POSITION_UNAVAILABLE' | 'TIMEOUT' | 'NOT_SUPPORTED';
  message: string;
}

/**
 * Future user roles for the platform.
 * - USER: Regular user searching for parking
 * - HOST: Private parking space owner (Rent Parking feature)
 * - ADMIN: Platform administrator
 */
export type UserRole = 'USER' | 'HOST' | 'ADMIN';

/** User profile (future — will integrate with AWS Cognito) */
export interface UserProfile {
  id: string;
  role: UserRole;
  displayName?: string;
  email?: string;
  phone?: string;
  verificationStatus?: 'verified' | 'pending' | 'not_submitted';
  createdAt: string;
}

