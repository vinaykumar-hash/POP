// =============================================================================
// ParkWise — App Constants
// =============================================================================
// Non-mock constants used throughout the application.
// Extracted from the former data/mock/parkingData.ts.
// =============================================================================

/**
 * Default center coordinates for Bengaluru.
 * Used when user location is not available.
 */
export const BENGALURU_CENTER = {
  latitude: 12.9716,
  longitude: 77.5946,
};

/** Default search radius in meters (5km to accommodate city-wide datasets) */
export const DEFAULT_SEARCH_RADIUS = 5000;

/** Maximum search radius in meters (25km across Bengaluru metropolitan area) */
export const MAX_SEARCH_RADIUS = 25000;

/** Proximity radius in meters — threshold for "near a parking spot" */
export const PROXIMITY_RADIUS_METERS = 50;

/** Proximity tracking interval in milliseconds (30 seconds) */
export const PROXIMITY_TRACKING_INTERVAL_MS = 30_000;

/** Auto-dismiss timeout for confirmation dialogs (60 seconds) */
export const CONFIRMATION_DISMISS_TIMEOUT_MS = 60_000;
