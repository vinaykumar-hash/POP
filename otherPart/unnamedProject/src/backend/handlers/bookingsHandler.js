/**
 * ParkSync - Host Booking Management Handlers (Step 8)
 * 
 * ============================================================================
 * ARCHITECTURE & SECURITY INVARIANTS
 * ============================================================================
 * 
 * 1. IDENTITY & OWNERSHIP:
 *    - The host identity is extracted EXCLUSIVELY from verified Cognito claims (`authenticatedUser.sub`).
 *    - Never trust `hostId`, `ownerId`, or `renterId` supplied in request payloads or query parameters.
 *    - Bookings derive their `hostId` solely from the listing owner.
 * 
 * 2. CEDAR AUTHORIZATION:
 *    - Every host action evaluates Cedar policies:
 *      - `viewBooking`: host == principal
 *      - `cancelBooking`: host == principal
 *      - `completeBooking`: host == principal
 *    - Rejects unauthorized access with HTTP 403 Forbidden.
 * 
 * 3. LIFECYCLE STATE MACHINE:
 *    - Transitions strictly governed by ALLOWED_STATUS_TRANSITIONS.
 *    - Arbitrary status modifications via payload are forbidden.
 */

import { dynamoDbService } from '../dynamoDbService.js';
import { cedarAuthorizer } from '../authorization/cedar/cedarAuthorizer.js';
import {
  validateListingBookability,
  validateBookingTimes,
  isWithinListingAvailability,
  detectBookingConflict
} from '../utils/bookingValidator.js';
import { BOOKING_STATUS, isValidStatusTransition } from '../../types/bookingModel.js';

export const bookingsHandler = {
  /**
   * GET /api/host/bookings - Retrieve all bookings belonging to the authenticated host
   * Supports filters: { status, listingId }
   */
  async getHostBookings(query, authenticatedUser) {
    if (!authenticatedUser?.sub) {
      const err = new Error('Unauthorized: Missing authenticated host identity.');
      err.statusCode = 401;
      throw err;
    }

    const filters = {};
    if (query?.listingId) filters.listingId = query.listingId;

    // Direct status filter from DB
    if (query?.status && query.status !== 'active') {
      filters.status = query.status;
    }

    let bookings = await dynamoDbService.getBookingsByHost(authenticatedUser.sub, filters);

    // Filter active if requested
    if (query?.status === 'active') {
      bookings = bookings.filter(
        (b) => b.status === BOOKING_STATUS.CONFIRMED && b.session?.startedAt && !b.session?.completedAt
      );
    } else if (query?.status === BOOKING_STATUS.CONFIRMED) {
      // Confirmed bookings that haven't started session yet
      bookings = bookings.filter((b) => !b.session?.startedAt);
    }

    // Operational priority sorting:
    // 1. Active session in progress
    // 2. Upcoming confirmed
    // 3. Pending
    // 4. Completed
    // 5. Cancelled / Expired
    function getBookingOperationalRank(b) {
      if (b.status === BOOKING_STATUS.CONFIRMED && b.session?.startedAt && !b.session?.completedAt) return 1;
      if (b.status === BOOKING_STATUS.CONFIRMED && !b.session?.startedAt) return 2;
      if (b.status === BOOKING_STATUS.PENDING) return 3;
      if (b.status === BOOKING_STATUS.COMPLETED) return 4;
      return 5;
    }

    bookings.sort((a, b) => {
      const rankA = getBookingOperationalRank(a);
      const rankB = getBookingOperationalRank(b);
      if (rankA !== rankB) return rankA - rankB;
      if (rankA <= 3) {
        return new Date(a.startAt || a.createdAt) - new Date(b.startAt || b.createdAt);
      }
      return new Date(b.startAt || b.createdAt) - new Date(a.startAt || a.createdAt);
    });

    return {
      statusCode: 200,
      body: bookings
    };
  },

  /**
   * GET /api/host/bookings/:id - Retrieve a specific booking with Cedar authorization
   */
  async getBookingById(bookingId, authenticatedUser) {
    if (!authenticatedUser?.sub) {
      const err = new Error('Unauthorized: Missing authenticated host identity.');
      err.statusCode = 401;
      throw err;
    }

    const booking = await dynamoDbService.getBookingById(bookingId);
    if (!booking) {
      const err = new Error(`Booking not found: ${bookingId}`);
      err.statusCode = 404;
      throw err;
    }

    // 1. Evaluate Cedar Authorization: viewBooking
    const authDecision = await cedarAuthorizer.isAuthorized({
      principal: authenticatedUser.sub,
      action: 'viewBooking',
      resource: {
        id: booking.bookingId,
        bookingId: booking.bookingId,
        host: booking.hostId,
        hostId: booking.hostId,
        type: 'booking'
      }
    });

    if (authDecision.decision === 'DENY') {
      const err = new Error('Forbidden: Denied by Cedar authorization policy.');
      err.statusCode = 403;
      err.diagnostics = authDecision.diagnostics;
      throw err;
    }

    // 2. Defense-in-depth ownership verification
    if (booking.hostId !== authenticatedUser.sub) {
      const err = new Error('Forbidden: You do not have permission to access this booking.');
      err.statusCode = 403;
      throw err;
    }

    return {
      statusCode: 200,
      body: booking
    };
  },

  /**
   * POST /api/host/bookings/:id/cancel - Host cancels a booking for their listing
   */
  async cancelBooking(bookingId, authenticatedUser) {
    if (!authenticatedUser?.sub) {
      const err = new Error('Unauthorized: Missing authenticated host identity.');
      err.statusCode = 401;
      throw err;
    }

    const booking = await dynamoDbService.getBookingById(bookingId);
    if (!booking) {
      const err = new Error(`Booking not found: ${bookingId}`);
      err.statusCode = 404;
      throw err;
    }

    // 1. Evaluate Cedar Authorization: cancelBooking
    const authDecision = await cedarAuthorizer.isAuthorized({
      principal: authenticatedUser.sub,
      action: 'cancelBooking',
      resource: {
        id: booking.bookingId,
        bookingId: booking.bookingId,
        host: booking.hostId,
        hostId: booking.hostId,
        type: 'booking'
      }
    });

    if (authDecision.decision === 'DENY') {
      const err = new Error('Forbidden: Denied by Cedar authorization policy.');
      err.statusCode = 403;
      err.diagnostics = authDecision.diagnostics;
      throw err;
    }

    // 2. Defense-in-depth ownership verification
    if (booking.hostId !== authenticatedUser.sub) {
      const err = new Error('Forbidden: You do not have permission to cancel another host\'s booking.');
      err.statusCode = 403;
      throw err;
    }

    // 3. Lifecycle state machine validation
    if (booking.status === BOOKING_STATUS.COMPLETED || booking.status === BOOKING_STATUS.EXPIRED) {
      const err = new Error(`Bad Request: Cannot cancel a booking that is already '${booking.status}'.`);
      err.statusCode = 400;
      throw err;
    }

    if (booking.status === BOOKING_STATUS.CANCELLED) {
      const err = new Error('Bad Request: Booking is already cancelled.');
      err.statusCode = 400;
      throw err;
    }

    const updated = await dynamoDbService.updateBookingStatus(bookingId, BOOKING_STATUS.CANCELLED, {
      cancelledAt: new Date().toISOString(),
      cancelledBy: authenticatedUser.sub
    });

    return {
      statusCode: 200,
      body: updated
    };
  },

  /**
   * POST /api/host/bookings/:id/complete - Host marks a confirmed booking as completed
   */
  async completeBooking(bookingId, authenticatedUser) {
    if (!authenticatedUser?.sub) {
      const err = new Error('Unauthorized: Missing authenticated host identity.');
      err.statusCode = 401;
      throw err;
    }

    const booking = await dynamoDbService.getBookingById(bookingId);
    if (!booking) {
      const err = new Error(`Booking not found: ${bookingId}`);
      err.statusCode = 404;
      throw err;
    }

    // 1. Evaluate Cedar Authorization: completeBooking
    const authDecision = await cedarAuthorizer.isAuthorized({
      principal: authenticatedUser.sub,
      action: 'completeBooking',
      resource: {
        id: booking.bookingId,
        bookingId: booking.bookingId,
        host: booking.hostId,
        hostId: booking.hostId,
        type: 'booking'
      }
    });

    if (authDecision.decision === 'DENY') {
      const err = new Error('Forbidden: Denied by Cedar authorization policy.');
      err.statusCode = 403;
      err.diagnostics = authDecision.diagnostics;
      throw err;
    }

    // 2. Defense-in-depth ownership verification
    if (booking.hostId !== authenticatedUser.sub) {
      const err = new Error('Forbidden: You do not have permission to complete another host\'s booking.');
      err.statusCode = 403;
      throw err;
    }

    // 3. Lifecycle state machine validation (Only confirmed -> completed allowed)
    if (booking.status !== BOOKING_STATUS.CONFIRMED) {
      const err = new Error(`Bad Request: Cannot complete booking with status '${booking.status}'. Only confirmed bookings can be completed.`);
      err.statusCode = 400;
      throw err;
    }

    const now = new Date().toISOString();
    const updatedSession = {
      startedAt: booking.session?.startedAt || now,
      completedAt: now
    };

    const updated = await dynamoDbService.updateBookingStatus(bookingId, BOOKING_STATUS.COMPLETED, {
      session: updatedSession,
      completedAt: now
    });

    return {
      statusCode: 200,
      body: updated
    };
  },

  /**
   * POST /api/host/bookings/:id/start - Host marks parking session as started
   */
  async startSession(bookingId, authenticatedUser) {
    if (!authenticatedUser?.sub) {
      const err = new Error('Unauthorized: Missing authenticated host identity.');
      err.statusCode = 401;
      throw err;
    }

    const booking = await dynamoDbService.getBookingById(bookingId);
    if (!booking) {
      const err = new Error(`Booking not found: ${bookingId}`);
      err.statusCode = 404;
      throw err;
    }

    // 1. Evaluate Cedar Authorization: startBookingSession
    const authDecision = await cedarAuthorizer.isAuthorized({
      principal: authenticatedUser.sub,
      action: 'startBookingSession',
      resource: {
        id: booking.bookingId,
        bookingId: booking.bookingId,
        host: booking.hostId,
        hostId: booking.hostId,
        type: 'booking'
      }
    });

    if (authDecision.decision === 'DENY') {
      const err = new Error('Forbidden: Denied by Cedar authorization policy.');
      err.statusCode = 403;
      err.diagnostics = authDecision.diagnostics;
      throw err;
    }

    // 2. Defense-in-depth ownership verification
    if (booking.hostId !== authenticatedUser.sub) {
      const err = new Error('Forbidden: You do not have permission to start session for another host\'s booking.');
      err.statusCode = 403;
      throw err;
    }

    // 3. Lifecycle validation
    if (booking.status !== BOOKING_STATUS.CONFIRMED) {
      const err = new Error(`Bad Request: Cannot start session for booking with status '${booking.status}'. Only confirmed bookings can be started.`);
      err.statusCode = 400;
      throw err;
    }

    if (booking.session?.startedAt) {
      const err = new Error('Bad Request: Parking session has already been started.');
      err.statusCode = 400;
      throw err;
    }

    const now = new Date().toISOString();
    const updatedSession = {
      startedAt: now,
      completedAt: null
    };

    const updated = await dynamoDbService.updateBookingStatus(bookingId, BOOKING_STATUS.CONFIRMED, {
      session: updatedSession
    });

    return {
      statusCode: 200,
      body: updated
    };
  },

  /**
   * Core reusable booking creation method.
   * Derives hostId from listing, validates bookability, schedule fit, and conflicts.
   */
  async createBooking(payload, authenticatedUser) {
    if (!payload?.listingId) {
      const err = new Error('Bad Request: Missing listingId.');
      err.statusCode = 400;
      throw err;
    }

    // 1. Load listing to derive hostId (never trust client-supplied hostId)
    const listing = await dynamoDbService.getListingById(payload.listingId);
    if (!listing) {
      const err = new Error(`Listing not found: ${payload.listingId}`);
      err.statusCode = 404;
      throw err;
    }

    // 2. Check bookability of listing
    const bookability = validateListingBookability(listing);
    if (!bookability.bookable) {
      const err = new Error(`Bad Request: ${bookability.reason}`);
      err.statusCode = 400;
      throw err;
    }

    // 3. Validate booking times
    const timeValidation = validateBookingTimes(payload.startAt, payload.endAt);
    if (!timeValidation.valid) {
      const err = new Error(`Bad Request: ${timeValidation.error}`);
      err.statusCode = 400;
      throw err;
    }

    // 4. Validate listing recurring availability compatibility
    const availCheck = isWithinListingAvailability(listing, payload.startAt, payload.endAt);
    if (!availCheck.valid) {
      const err = new Error(`Bad Request: ${availCheck.reason}`);
      err.statusCode = 400;
      throw err;
    }

    // 5. Conflict detection against active bookings for this listing
    const activeBookings = await dynamoDbService.getActiveBookingsByListing(listing.listingId);
    const conflictCheck = detectBookingConflict(activeBookings, payload.startAt, payload.endAt);
    if (conflictCheck.hasConflict) {
      const err = new Error('Conflict: The parking space is already booked during this time interval.');
      err.statusCode = 409;
      err.conflictingBookingId = conflictCheck.conflictingBooking?.bookingId;
      throw err;
    }

    // 6. Pricing snapshot
    const hourlyRate = Number(listing.pricing?.hourly || 0);
    const durationHours = Math.max(1, Math.ceil(timeValidation.durationMinutes / 60));
    const totalAmount = hourlyRate * durationHours;

    const renterId = authenticatedUser?.sub || payload.renterId || 'cognito-renter-guest';

    // Access instructions populated from listing
    const access = {
      instructions: listing.parkingDetails?.instructions || 'Park in the designated space indicated by the host.',
      entryNotes: listing.parkingDetails?.parkingType ? `${listing.parkingDetails.parkingType} parking space` : 'Designated parking slot',
      hostInstructions: listing.instructions || ''
    };

    // 7. Persist booking with session metadata and access instructions
    const booking = await dynamoDbService.createBooking({
      listingId: listing.listingId,
      hostId: listing.hostId, // Strictly derived from listing owner
      renterId,
      status: payload.status || BOOKING_STATUS.CONFIRMED,
      startAt: payload.startAt,
      endAt: payload.endAt,
      timezone: 'Asia/Kolkata',
      durationMinutes: timeValidation.durationMinutes,
      pricing: {
        hourlyRate,
        totalAmount,
        currency: 'INR'
      },
      vehicle: {
        type: payload.vehicle?.type || 'car',
        registrationNumber: payload.vehicle?.registrationNumber || ''
      },
      session: {
        startedAt: null,
        completedAt: null
      },
      access
    });

    return {
      statusCode: 201,
      body: booking
    };
  }
};
