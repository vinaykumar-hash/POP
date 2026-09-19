/**
 * POP - Parking Listing & Host Data Models
 * Ported from ParkSync and unified with POP's auth system.
 */

export interface ListingHost {
  name: string;
  email: string;
  phone: string;
  verificationStatus: 'pending' | 'verified' | 'rejected' | 'not_submitted';
}

export interface ListingVerification {
  document: { name: string; size: number; type: string; dataUrl?: string } | null;
  documentKey?: string;
  ownershipConfirmed: boolean;
  status?: string;
  submittedAt?: string;
}

export interface ListingPhoto {
  id?: string;
  file?: File;
  previewUrl: string;
  name: string;
  size?: number;
  key?: string;
}

export interface ListingLocation {
  address: string;
  locality: string;
  city: string;
  state: string;
  pincode: string;
  latitude: number;
  longitude: number;
}

export interface ParkingDetails {
  vehicleType: 'Car' | 'Bike' | 'Both';
  parkingType: 'Open' | 'Covered';
  capacity: number;
  features: string[];
  instructions: string;
}

export interface ListingPricing {
  hourly: string;
  daily: string;
}

export interface ListingAvailability {
  days: string[];
  startTime: string;
  endTime: string;
  timezone: string;
  mode?: string;
  temporarilyUnavailable: boolean;
}

export type ListingStatus = 'draft' | 'pending_review' | 'approved' | 'rejected' | 'suspended';

export interface ParkingListing {
  listingId: string | null;
  hostId: string | null;
  host: ListingHost;
  verification: ListingVerification;
  photos: ListingPhoto[];
  location: ListingLocation;
  parkingDetails: ParkingDetails;
  pricing: ListingPricing;
  availability: ListingAvailability;
  status: ListingStatus;
  rejectionReason: string | null;
  reviewedAt: string | null;
  reviewedBy: string | null;
  createdAt: string | null;
  updatedAt: string | null;
}

export const INITIAL_LISTING_STATE: ParkingListing = {
  listingId: null,
  hostId: null,
  host: {
    name: '',
    email: '',
    phone: '',
    verificationStatus: 'pending',
  },
  verification: {
    document: null,
    ownershipConfirmed: false,
  },
  photos: [],
  location: {
    address: '',
    locality: '',
    city: '',
    state: '',
    pincode: '',
    latitude: 12.9716,
    longitude: 77.5946,
  },
  parkingDetails: {
    vehicleType: 'Car',
    parkingType: 'Covered',
    capacity: 1,
    features: [],
    instructions: '',
  },
  pricing: {
    hourly: '',
    daily: '',
  },
  availability: {
    days: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'],
    startTime: '08:00',
    endTime: '20:00',
    timezone: 'Asia/Kolkata',
    mode: 'recurring',
    temporarilyUnavailable: false,
  },
  status: 'pending_review',
  rejectionReason: null,
  reviewedAt: null,
  reviewedBy: null,
  createdAt: null,
  updatedAt: null,
};

export const AVAILABLE_FEATURES = [
  'EV charging',
  'CCTV/security camera',
  'Gated access',
  'Well lit',
  'Easy access',
];

export const DAYS_OF_WEEK = [
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
  'Sunday',
];
