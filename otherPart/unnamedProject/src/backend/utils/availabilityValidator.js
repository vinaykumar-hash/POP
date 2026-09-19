/**
 * ParkSync - Host Availability Validation Utility
 * 
 * Enforces strict server-side validation rules for parking availability:
 * A. At least one day must be selected.
 * B. Only valid weekdays (Monday - Sunday).
 * C. No duplicate days.
 * D. startTime must be valid HH:mm (24-hour format).
 * E. endTime must be valid HH:mm (24-hour format).
 * F. endTime must be strictly later than startTime (no overnight availability).
 * G. timezone must default to 'Asia/Kolkata'.
 * H. temporarilyUnavailable must be a boolean.
 */

export const VALID_WEEKDAYS = [
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
  'Sunday'
];

const TIME_REGEX = /^([01]\d|2[0-3]):[0-5]\d$/;

export function parseTimeToMinutes(timeStr) {
  const [hours, minutes] = timeStr.split(':').map(Number);
  return hours * 60 + minutes;
}

export function validateAvailability(data) {
  if (!data || typeof data !== 'object') {
    const err = new Error('Bad Request: Availability data must be an object.');
    err.statusCode = 400;
    throw err;
  }

  // 1. Validate Days Array
  if (!Array.isArray(data.days) || data.days.length === 0) {
    const err = new Error('Bad Request: At least one availability day must be selected.');
    err.statusCode = 400;
    throw err;
  }

  // Check for duplicate days
  const uniqueDays = new Set(data.days);
  if (uniqueDays.size !== data.days.length) {
    const err = new Error('Bad Request: Availability days must not contain duplicates.');
    err.statusCode = 400;
    throw err;
  }

  // Check valid weekday names
  for (const day of data.days) {
    if (!VALID_WEEKDAYS.includes(day)) {
      const err = new Error(`Bad Request: Invalid weekday '${day}'. Allowed days are: ${VALID_WEEKDAYS.join(', ')}.`);
      err.statusCode = 400;
      throw err;
    }
  }

  // 2. Validate startTime format
  if (typeof data.startTime !== 'string' || !TIME_REGEX.test(data.startTime)) {
    const err = new Error(`Bad Request: Invalid startTime '${data.startTime}'. Must be in 24-hour HH:mm format (e.g. 08:00).`);
    err.statusCode = 400;
    throw err;
  }

  // 3. Validate endTime format
  if (typeof data.endTime !== 'string' || !TIME_REGEX.test(data.endTime)) {
    const err = new Error(`Bad Request: Invalid endTime '${data.endTime}'. Must be in 24-hour HH:mm format (e.g. 20:00).`);
    err.statusCode = 400;
    throw err;
  }

  // 4. Validate endTime is strictly later than startTime
  const startMin = parseTimeToMinutes(data.startTime);
  const endMin = parseTimeToMinutes(data.endTime);
  if (endMin <= startMin) {
    const err = new Error(`Bad Request: End time (${data.endTime}) must be later than start time (${data.startTime}).`);
    err.statusCode = 400;
    throw err;
  }

  // 5. Validate timezone
  const timezone = data.timezone || 'Asia/Kolkata';
  if (typeof timezone !== 'string' || timezone.trim() === '') {
    const err = new Error('Bad Request: Timezone must be a valid string.');
    err.statusCode = 400;
    throw err;
  }

  // 6. Validate temporarilyUnavailable
  const temporarilyUnavailable = typeof data.temporarilyUnavailable === 'boolean' 
    ? data.temporarilyUnavailable 
    : false;

  return {
    days: data.days,
    startTime: data.startTime,
    endTime: data.endTime,
    timezone,
    mode: data.mode || 'recurring',
    temporarilyUnavailable
  };
}
