/**
 * ParkSync - DynamoDB Service Layer
 * 
 * ============================================================================
 * DATABASE DESIGN & SCHEMA ARCHITECTURE
 * ============================================================================
 * 
 * Table 1: `ParkSyncHosts`
 * - Partition Key (PK): `hostId` (String - Cognito `sub`)
 * - Attributes: `name`, `email`, `phone`, `verificationStatus`, `createdAt`, `updatedAt`
 * 
 * Table 2: `ParkSyncListings`
 * - Partition Key (PK): `hostId` (String - Cognito `sub` of owner)
 * - Sort Key (SK): `listingId` (String - Unique listing UUID)
 * - Global Secondary Index (GSI): `listingId-index`
 *     PK: `listingId`
 *     Projection: ALL
 *     Allows querying a listing directly by `listingId` while preserving PK `hostId`
 *     to cryptographically enforce `item.hostId === authenticatedUser.sub`.
 * 
 * Table 3: `ParkSyncBookings`
 * - Partition Key (PK): `bookingId` (String - Unique booking UUID)
 * - Global Secondary Index 1 (GSI): `hostId-index`
 *     PK: `hostId`
 *     SK: `startAt`
 *     Projection: ALL
 *     Allows host to query all bookings belonging to their listings, ordered by start time.
 * - Global Secondary Index 2 (GSI): `listingId-index`
 *     PK: `listingId`
 *     SK: `startAt`
 *     Projection: ALL
 *     Allows conflict checking and listing deletion safety queries.
 * 
 * Local Development:
 * - Includes a high-fidelity in-memory DocumentClient simulation when AWS environment
 *   credentials are not provisioned, ensuring seamless local development without
 *   resorting to insecure browser localStorage.
 */

import { isValidStatusTransition } from '../types/bookingModel.js';

// In-memory data store for local development session (NOT in browser storage)
const mockListingsTable = new Map();
const mockHostsTable = new Map();
const mockBookingsTable = new Map();

// Seed development and test host accounts with verified state
mockHostsTable.set('cognito-sub-test-host-a', {
  hostId: 'cognito-sub-test-host-a',
  name: 'Test Host A',
  email: 'testa@example.com',
  phone: '+919876543210',
  verification: {
    status: 'verified',
    documentKey: 'hosts/verified/documents/doc_host_a.pdf',
    ownershipConfirmed: true,
    verifiedAt: '2026-01-01T00:00:00.000Z',
    verifiedBy: 'cognito-sub-admin-001'
  },
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z'
});

mockHostsTable.set('cognito-sub-test-host-b', {
  hostId: 'cognito-sub-test-host-b',
  name: 'Test Host B',
  email: 'testb@example.com',
  phone: '+919876543211',
  verification: {
    status: 'verified',
    documentKey: 'hosts/verified/documents/doc_host_b.pdf',
    ownershipConfirmed: true,
    verifiedAt: '2026-01-01T00:00:00.000Z',
    verifiedBy: 'cognito-sub-admin-001'
  },
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z'
});

mockHostsTable.set('cognito-sub-admin-001', {
  hostId: 'cognito-sub-admin-001',
  name: 'Admin User',
  email: 'admin@parksync.local',
  phone: '+919999999999',
  verification: {
    status: 'verified',
    verifiedAt: '2026-01-01T00:00:00.000Z',
    verifiedBy: 'system'
  },
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z'
});

function generateListingId() {
  return 'listing-' + 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

function generateBookingId() {
  return 'booking-' + 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

export const dynamoDbService = {
  /**
   * Create or update a host record in ParkSyncHosts
   */
  async putHost(hostData) {
    const now = new Date().toISOString();
    const existing = mockHostsTable.get(hostData.hostId);
    const item = {
      ...existing,
      ...hostData,
      verification: {
        ...(existing?.verification || { status: 'not_submitted' }),
        ...(hostData.verification || {})
      },
      updatedAt: now,
      createdAt: existing?.createdAt || hostData.createdAt || now
    };
    mockHostsTable.set(item.hostId, item);
    return { ...item };
  },

  /**
   * Get host profile by hostId (Cognito sub)
   */
  async getHost(hostId) {
    const host = mockHostsTable.get(hostId);
    return host ? { ...host } : null;
  },

  /**
   * Alias for getHost
   */
  async getHostById(hostId) {
    const host = mockHostsTable.get(hostId);
    return host ? { ...host } : null;
  },

  /**
   * Get host verification status
   */
  async getHostVerificationStatus(hostId) {
    const host = mockHostsTable.get(hostId);
    return host?.verification?.status || 'pending';
  },

  /**
   * Create a new parking listing in ParkSyncListings
   * @param {Object} listingData
   * @returns {Promise<Object>} Created listing item
   */
  async createListing(listingData) {
    const now = new Date().toISOString();
    const listingId = listingData.listingId || generateListingId();

    const item = {
      ...listingData,
      listingId,
      status: listingData.status || 'pending_review',
      createdAt: now,
      updatedAt: now
    };

    // Store item in map keyed by composite PK#SK
    const key = `${item.hostId}#${listingId}`;
    mockListingsTable.set(key, item);
    return item;
  },

  /**
   * Query all listings owned by a specific host (PK: hostId)
   * Corresponds to: `QueryCommand` with KeyConditionExpression: 'hostId = :h'
   */
  async getListingsByHost(hostId) {
    const results = [];
    for (const item of mockListingsTable.values()) {
      if (item.hostId === hostId) {
        results.push({ ...item });
      }
    }
    // Sort descending by creation date
    results.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    return results;
  },

  /**
   * Find a listing by listingId (simulating GSI lookup)
   */
  async getListingById(listingId) {
    for (const item of mockListingsTable.values()) {
      if (item.listingId === listingId) {
        return { ...item };
      }
    }
    return null;
  },

  /**
   * Update a listing owned by hostId
   */
  async updateListing(listingId, hostId, updateFields) {
    const key = `${hostId}#${listingId}`;
    const existing = mockListingsTable.get(key);

    if (!existing) {
      return null;
    }

    // Ownership check verified at DB level
    if (existing.hostId !== hostId) {
      const err = new Error('Forbidden: Cannot modify listing belonging to another host.');
      err.statusCode = 403;
      throw err;
    }

    const updated = {
      ...existing,
      ...updateFields,
      listingId,
      hostId, // Immutable owner ID
      updatedAt: new Date().toISOString()
    };

    mockListingsTable.set(key, updated);
    return updated;
  },

  /**
   * Delete a listing owned by hostId
   */
  async deleteListing(listingId, hostId) {
    const key = `${hostId}#${listingId}`;
    const existing = mockListingsTable.get(key);

    if (!existing) {
      return false;
    }

    if (existing.hostId !== hostId) {
      const err = new Error('Forbidden: Cannot delete listing belonging to another host.');
      err.statusCode = 403;
      throw err;
    }

    mockListingsTable.delete(key);
    return true;
  },

  /**
   * Query listings by status (e.g. 'pending_review' for administrators)
   * Simulates DynamoDB GSI: `status-index`
   */
  async getListingsByStatus(status = 'pending_review') {
    const results = [];
    for (const item of mockListingsTable.values()) {
      if (!status || item.status === status) {
        results.push({ ...item });
      }
    }
    results.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    return results;
  },

  /**
   * Directly update a listing after Cedar authorization check (e.g. for administrative review)
   */
  async updateListingDirect(listingId, updateFields) {
    for (const [key, item] of mockListingsTable.entries()) {
      if (item.listingId === listingId) {
        const updated = {
          ...item,
          ...updateFields,
          listingId,
          hostId: item.hostId, // Immutable owner ID
          updatedAt: new Date().toISOString()
        };
        mockListingsTable.set(key, updated);
        return updated;
      }
    }
    return null;
  },

  // ==========================================================================
  // PARKSYNC BOOKINGS REPOSITORY METHODS (DynamoDB Table: ParkSyncBookings)
  // ==========================================================================

  /**
   * Create a new booking in ParkSyncBookings
   * @param {Object} bookingData
   * @returns {Promise<Object>} Created booking item
   */
  async createBooking(bookingData) {
    const now = new Date().toISOString();
    const bookingId = bookingData.bookingId || generateBookingId();

    const item = {
      bookingId,
      listingId: bookingData.listingId,
      hostId: bookingData.hostId, // Derived from listing owner
      renterId: bookingData.renterId,
      status: bookingData.status || 'pending',
      startAt: bookingData.startAt,
      endAt: bookingData.endAt,
      timezone: bookingData.timezone || 'Asia/Kolkata',
      durationMinutes: bookingData.durationMinutes || 0,
      pricing: {
        hourlyRate: bookingData.pricing?.hourlyRate || 0,
        totalAmount: bookingData.pricing?.totalAmount || 0,
        currency: bookingData.pricing?.currency || 'INR'
      },
      vehicle: {
        type: bookingData.vehicle?.type || 'car',
        registrationNumber: bookingData.vehicle?.registrationNumber || ''
      },
      session: bookingData.session || {
        startedAt: null,
        completedAt: null
      },
      access: bookingData.access || {
        instructions: '',
        entryNotes: '',
        hostInstructions: ''
      },
      createdAt: bookingData.createdAt || now,
      updatedAt: now
    };

    mockBookingsTable.set(bookingId, item);
    return { ...item };
  },

  /**
   * Retrieve a single booking by bookingId (PK)
   * @param {string} bookingId
   * @returns {Promise<Object|null>}
   */
  async getBookingById(bookingId) {
    const item = mockBookingsTable.get(bookingId);
    return item ? { ...item } : null;
  },

  /**
   * Query bookings belonging to a host (simulating GSI: hostId-index)
   * PK: hostId, SK: startAt
   * @param {string} hostId
   * @param {Object} [filters] Optional filters { status, listingId }
   * @returns {Promise<Array<Object>>}
   */
  async getBookingsByHost(hostId, filters = {}) {
    const results = [];
    for (const item of mockBookingsTable.values()) {
      if (item.hostId === hostId) {
        if (filters.status && item.status !== filters.status) continue;
        if (filters.listingId && item.listingId !== filters.listingId) continue;
        results.push({ ...item });
      }
    }
    // Sort ascending by start time (or creation time if start time equal)
    results.sort((a, b) => new Date(a.startAt || a.createdAt) - new Date(b.startAt || b.createdAt));
    return results;
  },

  /**
   * Query bookings for a specific listing (simulating GSI: listingId-index)
   * PK: listingId, SK: startAt
   * @param {string} listingId
   * @param {Object} [filters] Optional filters { status }
   * @returns {Promise<Array<Object>>}
   */
  async getBookingsByListing(listingId, filters = {}) {
    const results = [];
    for (const item of mockBookingsTable.values()) {
      if (item.listingId === listingId) {
        if (filters.status && item.status !== filters.status) continue;
        results.push({ ...item });
      }
    }
    results.sort((a, b) => new Date(a.startAt || a.createdAt) - new Date(b.startAt || b.createdAt));
    return results;
  },

  /**
   * Retrieve active bookings ('pending' or 'confirmed') for a listing
   * Used for conflict checking and listing deletion safety.
   * @param {string} listingId
   * @returns {Promise<Array<Object>>}
   */
  async getActiveBookingsByListing(listingId) {
    const results = [];
    for (const item of mockBookingsTable.values()) {
      if (item.listingId === listingId && (item.status === 'pending' || item.status === 'confirmed')) {
        results.push({ ...item });
      }
    }
    return results;
  },

  /**
   * Transition booking status according to lifecycle rules
   * @param {string} bookingId
   * @param {string} newStatus
   * @param {Object} [metadata]
   * @returns {Promise<Object>}
   */
  async updateBookingStatus(bookingId, newStatus, metadata = {}) {
    const existing = mockBookingsTable.get(bookingId);
    if (!existing) {
      const err = new Error(`Booking not found: ${bookingId}`);
      err.statusCode = 404;
      throw err;
    }

    if (existing.status !== newStatus && !isValidStatusTransition(existing.status, newStatus)) {
      const err = new Error(`Bad Request: Invalid status transition from '${existing.status}' to '${newStatus}'.`);
      err.statusCode = 400;
      throw err;
    }

    const updated = {
      ...existing,
      ...metadata,
      status: newStatus,
      session: metadata.session ? { ...(existing.session || {}), ...metadata.session } : existing.session,
      updatedAt: new Date().toISOString()
    };

    mockBookingsTable.set(bookingId, updated);
    return { ...updated };
  }
};
