/**
 * POP - Booking Domain Data Model & Types
 */

export const BOOKING_STATUS = {
  PENDING: 'pending',
  CONFIRMED: 'confirmed',
  ACTIVE: 'active',
  COMPLETED: 'completed',
  CANCELLED: 'cancelled',
  EXPIRED: 'expired',
} as const;

export type BookingStatus = (typeof BOOKING_STATUS)[keyof typeof BOOKING_STATUS];

export interface BookingRecord {
  bookingId: string;
  listingId: string;
  hostId: string;
  renterId: string;
  renterName?: string;
  renterPhone?: string;
  status: BookingStatus;
  session?: {
    startedAt?: string | null;
    completedAt?: string | null;
  };
  startAt: string;
  endAt: string;
  durationHours: number;
  durationMinutes?: number;
  vehicle?: {
    type?: string;
    registrationNumber?: string;
  };
  pricing: {
    hourlyRate: number;
    totalAmount: number;
    currency?: string;
  };
  listingSummary?: {
    title: string;
    address: string;
    locality: string;
    parkingType: string;
    vehicleType: string;
    photoUrl?: string;
  };
  access?: {
    instructions?: string;
    entryNotes?: string;
    hostInstructions?: string;
    gatePassCode?: string;
  };
  createdAt: string;
  completedAt?: string;
  cancelledAt?: string;
  timezone?: string;
}

export interface CreateBookingPayload {
  listingId: string;
  startAt: string;
  endAt: string;
  durationHours: number;
  vehicle: {
    type: string;
    registrationNumber: string;
  };
  pricing: {
    hourlyRate: number;
    totalAmount: number;
  };
}

export function isSessionActive(booking: BookingRecord): boolean {
  if (!booking || booking.status !== BOOKING_STATUS.CONFIRMED) return false;
  return Boolean(booking.session?.startedAt && !booking.session?.completedAt);
}
