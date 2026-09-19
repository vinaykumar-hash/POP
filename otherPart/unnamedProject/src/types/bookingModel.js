/**
 * ParkSync - Booking Domain Data Model & Lifecycle Specifications
 * 
 * ============================================================================
 * BOOKING ARCHITECTURE & STATUS LIFECYCLE
 * ============================================================================
 * 
 * Discrete Lifecycle States:
 * - 'pending'   : Initial booking request created (awaiting confirmation / fulfillment)
 * - 'confirmed' : Booking confirmed for the parking slot
 * - 'cancelled' : Cancelled by host (or renter)
 * - 'completed' : Parking session successfully fulfilled
 * - 'expired'   : Pending booking timed out without confirmation
 * 
 * Permitted State Transitions:
 * - pending   -> confirmed
 * - pending   -> cancelled
 * - pending   -> expired
 * - confirmed -> cancelled
 * - confirmed -> completed
 * 
 * All other transitions are strictly forbidden.
 */

export const BOOKING_STATUS = {
  PENDING: 'pending',
  CONFIRMED: 'confirmed',
  CANCELLED: 'cancelled',
  COMPLETED: 'completed',
  EXPIRED: 'expired'
};

export const VALID_BOOKING_STATUSES = Object.values(BOOKING_STATUS);

/**
 * Transition state map defining permitted target states for each source state
 */
export const ALLOWED_STATUS_TRANSITIONS = {
  [BOOKING_STATUS.PENDING]: [
    BOOKING_STATUS.CONFIRMED,
    BOOKING_STATUS.CANCELLED,
    BOOKING_STATUS.EXPIRED
  ],
  [BOOKING_STATUS.CONFIRMED]: [
    BOOKING_STATUS.CANCELLED,
    BOOKING_STATUS.COMPLETED
  ],
  [BOOKING_STATUS.CANCELLED]: [],
  [BOOKING_STATUS.COMPLETED]: [],
  [BOOKING_STATUS.EXPIRED]: []
};

/**
 * Validate whether a status transition is permitted by the lifecycle rules
 */
export function isValidStatusTransition(currentStatus, targetStatus) {
  if (!currentStatus || !targetStatus) return false;
  const allowed = ALLOWED_STATUS_TRANSITIONS[currentStatus];
  return Array.isArray(allowed) && allowed.includes(targetStatus);
}

/**
 * Immutable booking fields that cannot be altered after creation
 */
export const IMMUTABLE_BOOKING_FIELDS = [
  'bookingId',
  'listingId',
  'hostId',
  'renterId',
  'startAt',
  'endAt',
  'pricing',
  'createdAt'
];

/**
 * Default operational parking session state
 */
export const DEFAULT_SESSION_STATE = {
  startedAt: null,
  completedAt: null
};

/**
 * Default access instruction model
 */
export const DEFAULT_ACCESS_STATE = {
  instructions: '',
  entryNotes: '',
  hostInstructions: ''
};

/**
 * Helper to determine if a booking currently has an active parking session
 * Active = status is 'confirmed' AND session.startedAt is set AND session.completedAt is null
 */
export function isSessionActive(booking) {
  if (!booking || booking.status !== BOOKING_STATUS.CONFIRMED) return false;
  return Boolean(booking.session?.startedAt && !booking.session?.completedAt);
}
