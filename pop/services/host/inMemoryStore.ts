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

// Seed initial verified listings for Bengaluru private parking discovery
function seedInitialListings() {
  const initialData: ParkingListing[] = [
    {
      listingId: 'listing_indiranagar_01',
      hostId: 'usr_demo_host_01',
      host: {
        name: 'Priya Sharma',
        email: 'priya.sharma@example.com',
        phone: '+91 98765 43210',
        verificationStatus: 'verified',
      },
      verification: {
        document: { name: 'property_tax_indiranagar.pdf', size: 104200, type: 'application/pdf' },
        ownershipConfirmed: true,
        status: 'approved',
      },
      photos: [
        { previewUrl: 'https://images.unsplash.com/photo-1590674899484-d5640e854abe?w=800&auto=format&fit=crop&q=80', name: 'covered_driveway.jpg' },
        { previewUrl: 'https://images.unsplash.com/photo-1506521781263-d8422e82f27a?w=800&auto=format&fit=crop&q=80', name: 'gate_entrance.jpg' },
        { previewUrl: 'https://images.unsplash.com/photo-1573348722427-f1d6819fdf98?w=800&auto=format&fit=crop&q=80', name: 'cctv_area.jpg' },
      ],
      location: {
        address: '428, 12th Main Road, HAL 2nd Stage, Indiranagar',
        locality: 'Indiranagar',
        city: 'Bengaluru',
        state: 'Karnataka',
        pincode: '560038',
        latitude: 12.9719,
        longitude: 77.6412,
      },
      parkingDetails: {
        vehicleType: 'Car',
        parkingType: 'Covered',
        capacity: 2,
        features: ['Covered Roof', 'CCTV Surveillance', '24/7 Security Guard', 'Gated Access', 'EV Charging Available'],
        instructions: 'Call guard at gate buzzer #428. Slot A1 on left side of compound.',
      },
      pricing: {
        hourly: '50',
        daily: '400',
      },
      availability: {
        days: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'],
        startTime: '00:00',
        endTime: '23:59',
        timezone: 'Asia/Kolkata',
        temporarilyUnavailable: false,
      },
      status: 'approved',
      rejectionReason: null,
      reviewedAt: new Date().toISOString(),
      reviewedBy: 'admin',
      createdAt: new Date(Date.now() - 86400000 * 5).toISOString(),
      updatedAt: new Date().toISOString(),
    },
    {
      listingId: 'listing_koramangala_02',
      hostId: 'usr_demo_host_01',
      host: {
        name: 'Vikram Joshi',
        email: 'vikram.j@example.com',
        phone: '+91 91234 56789',
        verificationStatus: 'verified',
      },
      verification: {
        document: { name: 'utility_bill_koramangala.pdf', size: 98400, type: 'application/pdf' },
        ownershipConfirmed: true,
        status: 'approved',
      },
      photos: [
        { previewUrl: 'https://images.unsplash.com/photo-1506521781263-d8422e82f27a?w=800&auto=format&fit=crop&q=80', name: 'gated_compound.jpg' },
        { previewUrl: 'https://images.unsplash.com/photo-1590674899484-d5640e854abe?w=800&auto=format&fit=crop&q=80', name: 'driveway_view.jpg' },
      ],
      location: {
        address: '89, 4th Cross, 4th Block, Koramangala',
        locality: 'Koramangala',
        city: 'Bengaluru',
        state: 'Karnataka',
        pincode: '560034',
        latitude: 12.9352,
        longitude: 77.6245,
      },
      parkingDetails: {
        vehicleType: 'Both',
        parkingType: 'Covered',
        capacity: 3,
        features: ['Covered Roof', 'CCTV Surveillance', 'Gated Access', 'Well Lit at Night'],
        instructions: 'Direct street access with wide sliding automated gate.',
      },
      pricing: {
        hourly: '40',
        daily: '300',
      },
      availability: {
        days: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'],
        startTime: '07:00',
        endTime: '23:00',
        timezone: 'Asia/Kolkata',
        temporarilyUnavailable: false,
      },
      status: 'approved',
      rejectionReason: null,
      reviewedAt: new Date().toISOString(),
      reviewedBy: 'admin',
      createdAt: new Date(Date.now() - 86400000 * 3).toISOString(),
      updatedAt: new Date().toISOString(),
    },
    {
      listingId: 'listing_whitefield_03',
      hostId: 'usr_demo_host_02',
      host: {
        name: 'Rohan Mehta',
        email: 'rohan.m@example.com',
        phone: '+91 97788 11223',
        verificationStatus: 'verified',
      },
      verification: {
        document: { name: 'society_noc.pdf', size: 123000, type: 'application/pdf' },
        ownershipConfirmed: true,
        status: 'approved',
      },
      photos: [
        { previewUrl: 'https://images.unsplash.com/photo-1573348722427-f1d6819fdf98?w=800&auto=format&fit=crop&q=80', name: 'basement_slot.jpg' },
        { previewUrl: 'https://images.unsplash.com/photo-1590674899484-d5640e854abe?w=800&auto=format&fit=crop&q=80', name: 'charger_box.jpg' },
      ],
      location: {
        address: 'Tower B Basement, ITPL Main Road, Whitefield',
        locality: 'Whitefield',
        city: 'Bengaluru',
        state: 'Karnataka',
        pincode: '560066',
        latitude: 12.9863,
        longitude: 77.7335,
      },
      parkingDetails: {
        vehicleType: 'Car',
        parkingType: 'Covered',
        capacity: 1,
        features: ['Covered Roof', 'EV Charging Available', 'CCTV Surveillance', '24/7 Security Guard'],
        instructions: 'Show POP Booking pass to security at Visitor Gate #2.',
      },
      pricing: {
        hourly: '60',
        daily: '450',
      },
      availability: {
        days: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
        startTime: '08:00',
        endTime: '22:00',
        timezone: 'Asia/Kolkata',
        temporarilyUnavailable: false,
      },
      status: 'approved',
      rejectionReason: null,
      reviewedAt: new Date().toISOString(),
      reviewedBy: 'admin',
      createdAt: new Date(Date.now() - 86400000 * 2).toISOString(),
      updatedAt: new Date().toISOString(),
    },
    {
      listingId: 'listing_hsr_04',
      hostId: 'usr_demo_host_02',
      host: {
        name: 'Ananya Rao',
        email: 'ananya.rao@example.com',
        phone: '+91 94455 66778',
        verificationStatus: 'verified',
      },
      verification: {
        document: { name: 'ownership_deed.pdf', size: 87000, type: 'application/pdf' },
        ownershipConfirmed: true,
        status: 'approved',
      },
      photos: [
        { previewUrl: 'https://images.unsplash.com/photo-1506521781263-d8422e82f27a?w=800&auto=format&fit=crop&q=80', name: 'hsr_driveway.jpg' },
      ],
      location: {
        address: '142, 27th Main Rd, Sector 1, HSR Layout',
        locality: 'HSR Layout',
        city: 'Bengaluru',
        state: 'Karnataka',
        pincode: '560102',
        latitude: 12.9116,
        longitude: 77.6474,
      },
      parkingDetails: {
        vehicleType: 'Both',
        parkingType: 'Open',
        capacity: 2,
        features: ['Gated Access', 'Well Lit at Night', 'CCTV Surveillance'],
        instructions: 'Independent villa parking slot with wide entrance.',
      },
      pricing: {
        hourly: '35',
        daily: '250',
      },
      availability: {
        days: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'],
        startTime: '06:00',
        endTime: '23:30',
        timezone: 'Asia/Kolkata',
        temporarilyUnavailable: false,
      },
      status: 'approved',
      rejectionReason: null,
      reviewedAt: new Date().toISOString(),
      reviewedBy: 'admin',
      createdAt: new Date(Date.now() - 86400000).toISOString(),
      updatedAt: new Date().toISOString(),
    },
    {
      listingId: 'listing_mgroad_05',
      hostId: 'usr_demo_host_01',
      host: {
        name: 'Arjun Nambiar',
        email: 'arjun.n@example.com',
        phone: '+91 98800 12345',
        verificationStatus: 'verified',
      },
      verification: {
        document: { name: 'commercial_tax.pdf', size: 140000, type: 'application/pdf' },
        ownershipConfirmed: true,
        status: 'approved',
      },
      photos: [
        { previewUrl: 'https://images.unsplash.com/photo-1590674899484-d5640e854abe?w=800&auto=format&fit=crop&q=80', name: 'cbd_parking.jpg' },
        { previewUrl: 'https://images.unsplash.com/photo-1573348722427-f1d6819fdf98?w=800&auto=format&fit=crop&q=80', name: 'underground_lot.jpg' },
      ],
      location: {
        address: '54, Brigade Road, Ashok Nagar, near MG Road Metro',
        locality: 'MG Road / Brigade Road',
        city: 'Bengaluru',
        state: 'Karnataka',
        pincode: '560001',
        latitude: 12.9734,
        longitude: 77.6074,
      },
      parkingDetails: {
        vehicleType: 'Car',
        parkingType: 'Covered',
        capacity: 2,
        features: ['Covered Roof', 'CCTV Surveillance', '24/7 Security Guard', 'EV Charging Available'],
        instructions: 'CBD underground dedicated spot right next to Brigade Road intersection.',
      },
      pricing: {
        hourly: '70',
        daily: '550',
      },
      availability: {
        days: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'],
        startTime: '08:00',
        endTime: '23:59',
        timezone: 'Asia/Kolkata',
        temporarilyUnavailable: false,
      },
      status: 'approved',
      rejectionReason: null,
      reviewedAt: new Date().toISOString(),
      reviewedBy: 'admin',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
  ];

  for (const item of initialData) {
    if (item.listingId) {
      listings.set(item.listingId, item);
    }
  }
}

// Run initial seed
seedInitialListings();

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

/**
 * Public discovery of rent listings for drivers
 */
export function getPublicRentListings(filters?: {
  query?: string;
  vehicleType?: string;
  parkingType?: string;
  maxHourly?: number;
}): ParkingListing[] {
  let results = Array.from(listings.values()).filter(
    (l) => l.status === 'approved' && !l.availability?.temporarilyUnavailable
  );

  if (filters?.query) {
    const q = filters.query.toLowerCase().trim();
    results = results.filter(
      (l) =>
        l.location?.locality?.toLowerCase().includes(q) ||
        l.location?.address?.toLowerCase().includes(q) ||
        l.location?.city?.toLowerCase().includes(q) ||
        l.parkingDetails?.features?.some((f) => f.toLowerCase().includes(q))
    );
  }

  if (filters?.vehicleType && filters.vehicleType !== 'all') {
    results = results.filter(
      (l) =>
        l.parkingDetails?.vehicleType?.toLowerCase() === filters.vehicleType?.toLowerCase() ||
        l.parkingDetails?.vehicleType?.toLowerCase() === 'both'
    );
  }

  if (filters?.parkingType && filters.parkingType !== 'all') {
    results = results.filter(
      (l) => l.parkingDetails?.parkingType?.toLowerCase() === filters.parkingType?.toLowerCase()
    );
  }

  if (filters?.maxHourly && !isNaN(filters.maxHourly)) {
    results = results.filter((l) => {
      const rate = parseFloat(l.pricing?.hourly || '0');
      return rate <= filters.maxHourly!;
    });
  }

  return results;
}

/**
 * Retrieve bookings created by a specific renter
 */
export function getUserBookings(userId: string) {
  return Array.from(bookings.values())
    .filter((b) => (b as Record<string, unknown>).renterId === userId)
    .sort((a, b) => {
      const timeA = new Date((a as Record<string, unknown>).createdAt as string).getTime();
      const timeB = new Date((b as Record<string, unknown>).createdAt as string).getTime();
      return timeB - timeA;
    });
}


