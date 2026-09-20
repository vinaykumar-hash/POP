/**
 * POP - In-Memory Backend Store
 * Simulates DynamoDB for listings, hosts, and bookings during development.
 */

import { ParkingListing, INITIAL_LISTING_STATE } from '@/types/listingModel';

// In-memory data stores
const hostProfiles = new Map<string, Record<string, unknown>>();
const listings = new Map<string, ParkingListing>();
const bookings = new Map<string, Record<string, unknown>>();

let listingCounter = 1;
let bookingCounter = 1;

/**
 * Extract user ID from Authorization header (mock JWT parsing)
 */
export function extractUserId(authHeader: string | null): string | null {
  if (!authHeader) return null;
  const token = authHeader.replace('Bearer ', '');
  // For mock tokens, extract embedded info
  try {
    const parts = token.split('.');
    if (parts.length === 3) {
      // Try to decode JWT payload
      const payload = JSON.parse(atob(parts[1]));
      return payload.sub || payload.email || null;
    }
  } catch {
    // For simple mock tokens like "mock_jwt_access_123"
  }
  return `user_from_${token.substring(0, 20)}`;
}

// Host Profile Operations
export function getHostProfile(userId: string) {
  if (!hostProfiles.has(userId)) {
    const isHost = userId.toLowerCase().includes('host') || userId === 'usr_demo_host_01' || userId === 'usr_demo_admin_01';
    hostProfiles.set(userId, {
      userId,
      verification: { status: isHost ? 'verified' : 'not_submitted' },
      createdAt: new Date().toISOString(),
    });
  }
  return hostProfiles.get(userId)!;
}

export function updateHostProfile(userId: string, data: Record<string, unknown>) {
  const existing = getHostProfile(userId);
  const updated = { ...existing, ...data, userId, updatedAt: new Date().toISOString() };
  hostProfiles.set(userId, updated);
  return updated;
}

// Listing Operations
export function createListing(userId: string, data: Record<string, unknown>): ParkingListing {
  const listingId = `listing_${Date.now()}_${listingCounter++}`;
  const listing: ParkingListing = {
    ...INITIAL_LISTING_STATE,
    ...data,
    listingId,
    hostId: userId,
    status: 'pending_review',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  } as ParkingListing;
  listings.set(listingId, listing);
  return listing;
}

export function getHostListings(userId: string): ParkingListing[] {
  return Array.from(listings.values()).filter((l) => l.hostId === userId);
}

export function getListing(listingId: string, userId: string): ParkingListing | null {
  const listing = listings.get(listingId);
  if (!listing || listing.hostId !== userId) return null;
  return listing;
}

export function updateListing(listingId: string, userId: string, data: Record<string, unknown>): ParkingListing | null {
  const listing = listings.get(listingId);
  if (!listing || listing.hostId !== userId) return null;
  const updated = { ...listing, ...data, updatedAt: new Date().toISOString() } as ParkingListing;
  listings.set(listingId, updated);
  return updated;
}

export function deleteListing(listingId: string, userId: string): boolean {
  const listing = listings.get(listingId);
  if (!listing || listing.hostId !== userId) return false;
  listings.delete(listingId);
  return true;
}

export function resubmitListing(listingId: string, userId: string): ParkingListing | null {
  const listing = listings.get(listingId);
  if (!listing || listing.hostId !== userId) return null;
  listing.status = 'pending_review';
  listing.rejectionReason = null;
  listing.updatedAt = new Date().toISOString();
  return listing;
}

export function updateAvailability(listingId: string, userId: string, data: Record<string, unknown>): ParkingListing | null {
  const listing = listings.get(listingId);
  if (!listing || listing.hostId !== userId) return null;
  listing.availability = { ...listing.availability, ...data } as ParkingListing['availability'];
  listing.updatedAt = new Date().toISOString();
  return listing;
}

// Admin Operations
export function getAdminListings(status: string): ParkingListing[] {
  return Array.from(listings.values()).filter((l) => l.status === status);
}

export function approveListing(listingId: string): ParkingListing | null {
  const listing = listings.get(listingId);
  if (!listing) return null;
  listing.status = 'approved';
  listing.reviewedAt = new Date().toISOString();
  listing.updatedAt = new Date().toISOString();
  return listing;
}

export function rejectListing(listingId: string, reason: string): ParkingListing | null {
  const listing = listings.get(listingId);
  if (!listing) return null;
  listing.status = 'rejected';
  listing.rejectionReason = reason;
  listing.reviewedAt = new Date().toISOString();
  listing.updatedAt = new Date().toISOString();
  return listing;
}

// Booking Operations
export function getHostBookings(userId: string, filters?: { status?: string; listingId?: string }) {
  let results = Array.from(bookings.values()).filter(
    (b) => (b as Record<string, unknown>).hostId === userId
  );
  if (filters?.status && filters.status !== 'all') {
    results = results.filter((b) => (b as Record<string, unknown>).status === filters.status);
  }
  if (filters?.listingId) {
    results = results.filter((b) => (b as Record<string, unknown>).listingId === filters.listingId);
  }
  return results;
}

export function createBooking(data: Record<string, unknown>) {
  const bookingId = `booking_${Date.now()}_${bookingCounter++}`;
  const booking = {
    ...data,
    bookingId,
    status: 'confirmed',
    createdAt: new Date().toISOString(),
  };
  bookings.set(bookingId, booking);
  return booking;
}

export function cancelBooking(bookingId: string, _userId: string) {
  const booking = bookings.get(bookingId);
  if (!booking) return null;
  booking.status = 'cancelled';
  booking.cancelledAt = new Date().toISOString();
  booking.updatedAt = new Date().toISOString();
  return booking;
}

export function startSession(bookingId: string, _userId: string) {
  const booking = bookings.get(bookingId);
  if (!booking) return null;
  booking.session = {
    ...((booking.session as Record<string, unknown>) || {}),
    startedAt: new Date().toISOString(),
  };
  booking.updatedAt = new Date().toISOString();
  return booking;
}

export function completeBooking(bookingId: string, _userId: string) {
  const booking = bookings.get(bookingId);
  if (!booking) return null;
  booking.status = 'completed';
  booking.completedAt = new Date().toISOString();
  booking.session = {
    ...((booking.session as Record<string, unknown>) || {}),
    completedAt: new Date().toISOString(),
  };
  booking.updatedAt = new Date().toISOString();
  return booking;
}

