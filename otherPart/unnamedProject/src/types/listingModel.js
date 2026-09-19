/**
 * ParkSync - Parking Listing & Host Data Models
 * 
 * ============================================================================
 * SECURITY & CONCEPTUAL OWNERSHIP ARCHITECTURE NOTE
 * ============================================================================
 * 
 * In ParkSync's architecture:
 * 1. Each parking listing belongs to exactly ONE host (`listing.hostId`).
 * 2. A host must NEVER be able to view private details of, update, or delete
 *    another host's parking listing.
 * 3. Frontend validation and UI hiding are for UX only and DO NOT provide security.
 * 4. In the future AWS backend (Cognito + API Gateway + Lambda + DynamoDB):
 *    - The client will NOT send a trusted `hostId` in the payload for authorization.
 *    - The backend derives `authenticatedUser.id` directly from the validated JWT token:
 *        GET /listings/:id    -> verify authenticatedUser.id === listing.hostId
 *        PUT /listings/:id    -> verify authenticatedUser.id === listing.hostId
 *        DELETE /listings/:id -> verify authenticatedUser.id === listing.hostId
 * 5. Frontend state is ephemeral and NEVER stored in localStorage as a database substitute.
 */

export const INITIAL_LISTING_STATE = {
  listingId: null,
  hostId: null,

  host: {
    name: '',
    email: '',
    phone: '',
    verificationStatus: 'pending' // 'pending' | 'verified' | 'rejected'
  },

  verification: {
    document: null, // { name, size, type, dataUrl } (Frontend state only)
    ownershipConfirmed: false
  },

  photos: [], // Array of { id, file, previewUrl, name, size } (Min 2, Max 6)

  location: {
    address: '', // Exact residential address (kept private until confirmed booking)
    locality: '',
    city: '',
    state: '',
    pincode: '',
    latitude: 19.0760, // Default reference coordinate (can be pinned in selector)
    longitude: 72.8777
  },

  parkingDetails: {
    vehicleType: 'Car', // 'Car' | 'Bike' | 'Both'
    parkingType: 'Covered', // 'Open' | 'Covered'
    capacity: 1,
    features: [], // 'EV charging', 'CCTV/security camera', 'Gated access', 'Well lit', 'Easy access'
    instructions: ''
  },

  pricing: {
    hourly: '',
    daily: ''
  },

  availability: {
    days: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'],
    startTime: '08:00',
    endTime: '20:00',
    timezone: 'Asia/Kolkata',
    mode: 'recurring',
    temporarilyUnavailable: false
  },

  status: 'pending_review', // 'draft' | 'pending_review' | 'approved' | 'rejected' | 'suspended'
  rejectionReason: null,
  reviewedAt: null,
  reviewedBy: null,
  createdAt: null,
  updatedAt: null
};

export const AVAILABLE_FEATURES = [
  'EV charging',
  'CCTV/security camera',
  'Gated access',
  'Well lit',
  'Easy access'
];

export const DAYS_OF_WEEK = [
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
  'Sunday'
];
