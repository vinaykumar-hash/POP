/**
 * ParkSync - Booking Validation & Eligibility Utilities
 * 
 * Centralized logic for:
 * 1. validateListingBookability - checks status: 'approved' and not paused
 * 2. validateBookingTimes - validates ISO timestamps, ordering, and duration
 * 3. isWithinListingAvailability - verifies schedule compatibility in Asia/Kolkata
 * 4. detectBookingConflict - detects overlapping active bookings
 */

import { parseTimeToMinutes, VALID_WEEKDAYS } from './availabilityValidator.js';

/**
 * Validates whether a parking listing is currently eligible to accept bookings.
 * 
 * Requirements:
 * - listing.status === 'approved' (rejects 'draft', 'pending_review', 'rejected', 'suspended')
 * - listing.availability.temporarilyUnavailable !== true
 * 
 * @param {Object} listing Listing record
 * @returns {{ bookable: boolean, reason?: string }}
 */
export function validateListingBookability(listing) {
  if (!listing || typeof listing !== 'object') {
    return { bookable: false, reason: 'Listing not found or invalid.' };
  }

  if (listing.status !== 'approved') {
    return {
      bookable: false,
      reason: listing.status === 'pending_review' 
        ? 'Listing is not approved (pending review).'
        : `Listing is not approved (status: ${listing.status}).`
    };
  }

  if (listing.availability?.temporarilyUnavailable === true) {
    return {
      bookable: false,
      reason: 'Listing is temporarily unavailable.'
    };
  }

  return { bookable: true };
}

/**
 * Validates booking start and end timestamps.
 * 
 * @param {string} startAt ISO 8601 string
 * @param {string} endAt ISO 8601 string
 * @returns {{ valid: boolean, durationMinutes?: number, error?: string }}
 */
export function validateBookingTimes(startAt, endAt) {
  if (!startAt || !endAt) {
    return { valid: false, error: 'Both startAt and endAt timestamps are required.' };
  }

  const startDate = new Date(startAt);
  const endDate = new Date(endAt);

  if (isNaN(startDate.getTime())) {
    return { valid: false, error: 'Invalid startAt timestamp format.' };
  }

  if (isNaN(endDate.getTime())) {
    return { valid: false, error: 'Invalid endAt timestamp format.' };
  }

  const durationMs = endDate.getTime() - startDate.getTime();
  if (durationMs <= 0) {
    return { valid: false, error: 'endAt must be strictly after startAt.' };
  }

  const durationMinutes = Math.round(durationMs / 60000);
  return { valid: true, durationMinutes, startDate, endDate };
}

/**
 * Helper to get date components in Asia/Kolkata timezone
 */
function getKolkataDateParts(date) {
  // Use Intl to format in Asia/Kolkata
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Kolkata',
    weekday: 'long',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  });

  const parts = formatter.formatToParts(date);
  const map = {};
  for (const p of parts) {
    map[p.type] = p.value;
  }

  // Handle midnight 24:00 formatting from Intl
  let hour = parseInt(map.hour, 10);
  if (hour === 24) hour = 0;

  return {
    weekday: map.weekday, // 'Monday', 'Tuesday', etc.
    year: map.year,
    month: map.month,
    day: map.day,
    hour,
    minute: parseInt(map.minute, 10),
    minutesFromMidnight: hour * 60 + parseInt(map.minute, 10),
    dateKey: `${map.year}-${map.month}-${map.day}`
  };
}

/**
 * Determines whether a requested booking interval fits within a listing's recurring availability.
 * 
 * Rules:
 * - Checks availability.temporarilyUnavailable
 * - Checks requested weekday is in availability.days
 * - Checks requested times are within daily startTime and endTime
 * - Operating in Asia/Kolkata timezone
 * 
 * @param {Object} listing
 * @param {string} startAt
 * @param {string} endAt
 * @returns {{ valid: boolean, reason?: string }}
 */
export function isWithinListingAvailability(listing, startAt, endAt) {
  const bookability = validateListingBookability(listing);
  if (!bookability.bookable) {
    return { valid: false, reason: bookability.reason };
  }

  const avail = listing.availability;
  if (!avail || !Array.isArray(avail.days) || avail.days.length === 0) {
    return { valid: false, reason: 'Listing has no operating schedule configured.' };
  }

  const timeValidation = validateBookingTimes(startAt, endAt);
  if (!timeValidation.valid) {
    return { valid: false, reason: timeValidation.error };
  }

  const startKolkata = getKolkataDateParts(timeValidation.startDate);
  const endKolkata = getKolkataDateParts(timeValidation.endDate);

  // Normalize available days (support both 'Monday' and 'mon' variations)
  const normalizedAvailDays = avail.days.map((d) => d.toLowerCase());
  const requestedWeekdayLower = startKolkata.weekday.toLowerCase();

  const isDayAllowed = normalizedAvailDays.some(
    (d) => d === requestedWeekdayLower || requestedWeekdayLower.startsWith(d) || d.startsWith(requestedWeekdayLower.slice(0, 3))
  );

  if (!isDayAllowed) {
    return {
      valid: false,
      reason: `Listing is not available on ${startKolkata.weekday}s.`
    };
  }

  // Cross-midnight / multi-day bookings across differing weekdays
  if (startKolkata.dateKey !== endKolkata.dateKey) {
    return {
      valid: false,
      reason: 'Bookings spanning multiple calendar days are not supported in recurring daily availability.'
    };
  }

  // Verify daily operating hours
  const availStartMin = parseTimeToMinutes(avail.startTime || '00:00');
  const availEndMin = parseTimeToMinutes(avail.endTime || '23:59');

  if (startKolkata.minutesFromMidnight < availStartMin) {
    return {
      valid: false,
      reason: `Requested start time is before operating hours (${avail.startTime}).`
    };
  }

  if (endKolkata.minutesFromMidnight > availEndMin) {
    return {
      valid: false,
      reason: `Requested end time is after operating hours (${avail.endTime}).`
    };
  }

  return { valid: true };
}

/**
 * Checks for interval overlap against existing active bookings for a listing.
 * 
 * Standard Interval Overlap Formula:
 * existing.startAt < requested.endAt AND requested.startAt < existing.endAt
 * 
 * - Only active bookings ('pending', 'confirmed') block availability.
 * - Inactive bookings ('cancelled', 'expired') do not block.
 * - Adjacent non-overlapping bookings (existing.endAt === requested.startAt) are permitted.
 * 
 * @param {Array<Object>} existingBookings
 * @param {string} requestedStartAt
 * @param {string} requestedEndAt
 * @returns {{ hasConflict: boolean, conflictingBooking?: Object }}
 */
export function detectBookingConflict(existingBookings, requestedStartAt, requestedEndAt) {
  if (!Array.isArray(existingBookings) || existingBookings.length === 0) {
    return { hasConflict: false };
  }

  const reqStart = new Date(requestedStartAt).getTime();
  const reqEnd = new Date(requestedEndAt).getTime();

  for (const booking of existingBookings) {
    // Only pending and confirmed bookings cause conflicts
    if (booking.status !== 'pending' && booking.status !== 'confirmed') {
      continue;
    }

    const exStart = new Date(booking.startAt).getTime();
    const exEnd = new Date(booking.endAt).getTime();

    // Standard interval overlap condition
    if (exStart < reqEnd && reqStart < exEnd) {
      return {
        hasConflict: true,
        conflictingBooking: booking
      };
    }
  }

  return { hasConflict: false };
}

/**
 * Determines whether a booking has passed its scheduled end time and should be expired.
 * A pending booking whose end time has elapsed is considered expired.
 * 
 * @param {Object} booking
 * @param {Date|string} [now=new Date()]
 * @returns {boolean}
 */
export function isBookingExpired(booking, now = new Date()) {
  if (!booking || !booking.endAt) return false;
  const currentTime = now instanceof Date ? now.getTime() : new Date(now).getTime();
  const endTime = new Date(booking.endAt).getTime();

  // Pending booking past scheduled end is expired
  if (booking.status === 'pending' && endTime < currentTime) {
    return true;
  }

  return false;
}

/**
 * Checks if a booking currently has an active parking session
 * 
 * @param {Object} booking
 * @returns {boolean}
 */
export function checkActiveSession(booking) {
  if (!booking || booking.status !== 'confirmed') return false;
  return Boolean(booking.session?.startedAt && !booking.session?.completedAt);
}
