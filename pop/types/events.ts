// =============================================================================
// ParkWise — Event Types
// =============================================================================
// Event model for the crowdsourced availability system.
// Events are recorded when users interact with parking locations.
// User identity is never exposed — only anonymous internal IDs are used.
// =============================================================================

/** All possible parking event types */
export type ParkingEventType =
  | 'USER_APPROACHING'          // User is moving toward parking
  | 'GEOFENCE_ENTERED'          // User entered the parking geofence
  | 'GEOFENCE_EXITED'           // User left the parking geofence
  | 'PARKING_CONFIRMED'         // User confirmed "I parked here"
  | 'PARKING_REJECTED'          // User said "No, I did not park"
  | 'USER_LEFT'                 // User left the parking area
  | 'AVAILABILITY_REPORTED'     // User manually reported availability
  | 'PARKING_FULL_REPORTED'     // User reported parking is full
  | 'PARKING_AVAILABLE_REPORTED'; // User reported parking is available

/** A single parking event */
export interface ParkingEvent {
  /** Unique event ID */
  id: string;

  /** Parking location this event relates to */
  parkingId: string;

  /** Type of event */
  eventType: ParkingEventType;

  /** When this event occurred */
  timestamp: string;

  /**
   * Anonymous internal user identifier.
   * NEVER expose this as a real user identity.
   * Used only for deduplication and signal correlation.
   */
  anonymousUserId: string;

  /** Additional event-specific data */
  metadata?: Record<string, unknown>;
}

/** Aggregated event summary for a parking location */
export interface ParkingEventSummary {
  parkingId: string;
  /** Number of confirmed parked users in the last N minutes */
  recentConfirmedParked: number;
  /** Number of users who entered geofence in the last N minutes */
  recentGeofenceEntries: number;
  /** Number of users who exited geofence in the last N minutes */
  recentGeofenceExits: number;
  /** Number of "parking full" reports in the last N minutes */
  recentFullReports: number;
  /** Number of "parking available" reports in the last N minutes */
  recentAvailableReports: number;
  /** Time window in minutes */
  windowMinutes: number;
  /** When this summary was computed */
  computedAt: string;
}
