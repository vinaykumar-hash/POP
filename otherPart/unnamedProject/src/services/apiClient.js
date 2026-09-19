/**
 * ParkSync - API Client Service
 * 
 * Manages communication with AWS API Gateway / Lambda backend.
 * Automatically handles authorization headers and error parsing.
 */

import { authService } from './authService';

const API_BASE = import.meta.env?.VITE_API_BASE_URL || '';

async function request(endpoint, options = {}) {
  const token = authService.getAuthToken();

  const headers = {
    'Content-Type': 'application/json',
    ...(options.headers || {})
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const response = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers
  });

  let data;
  try {
    data = await response.json();
  } catch {
    data = null;
  }

  if (!response.ok) {
    const error = new Error(data?.error || `Request failed with status ${response.status}`);
    error.status = response.status;
    error.data = data;
    throw error;
  }

  return data;
}

export const apiClient = {
  /**
   * Retrieve the authenticated host profile from ParkSyncHosts table
   */
  async getHostProfile() {
    return request('/api/hosts/me');
  },

  /**
   * Update host profile information or verification metadata
   */
  async updateHostProfile(profileData) {
    return request('/api/hosts', {
      method: 'POST',
      body: JSON.stringify(profileData)
    });
  },

  /**
   * Create a new parking listing
   * Backend will enforce listing.hostId = authenticatedUser.sub
   */
  async createListing(listingData) {
    return request('/api/listings', {
      method: 'POST',
      body: JSON.stringify(listingData)
    });
  },

  /**
   * Get all listings belonging to the authenticated host
   */
  async getHostListings() {
    return request('/api/listings', {
      method: 'GET'
    });
  },

  /**
   * Get a specific listing (will 403 if belonging to another host)
   */
  async getListing(listingId) {
    return request(`/api/listings/${listingId}`, {
      method: 'GET'
    });
  },

  /**
   * Update a listing (will 403 if belonging to another host)
   */
  async updateListing(listingId, updateData) {
    return request(`/api/listings/${listingId}`, {
      method: 'PUT',
      body: JSON.stringify(updateData)
    });
  },

  /**
   * Delete a listing (will 403 if belonging to another host)
   */
  async deleteListing(listingId) {
    return request(`/api/listings/${listingId}`, {
      method: 'DELETE'
    });
  },

  /**
   * Request private S3 presigned upload URL
   */
  async getPresignedUploadUrl({ fileName, fileType, listingId, context }) {
    return request('/api/uploads/presign', {
      method: 'POST',
      body: JSON.stringify({ fileName, fileType, listingId, context })
    });
  },

  /**
   * Resubmit a rejected listing for review
   */
  async resubmitListing(listingId) {
    return request(`/api/listings/${listingId}/resubmit`, {
      method: 'POST'
    });
  },

  /**
   * Admin: Get listings pending review
   */
  async getAdminPendingListings(status = 'pending_review') {
    return request(`/api/admin/listings?status=${encodeURIComponent(status)}`, {
      method: 'GET'
    });
  },

  /**
   * Admin: Approve a listing
   */
  async approveListing(listingId) {
    return request(`/api/admin/listings/${listingId}/approve`, {
      method: 'POST'
    });
  },

  /**
   * Admin: Reject a listing with reason
   */
  async rejectListing(listingId, rejectionReason) {
    return request(`/api/admin/listings/${listingId}/reject`, {
      method: 'POST',
      body: JSON.stringify({ rejectionReason })
    });
  },

  /**
   * Update listing availability (days, startTime, endTime, timezone)
   */
  async updateAvailability(listingId, availabilityData) {
    return request(`/api/listings/${listingId}/availability`, {
      method: 'PUT',
      body: JSON.stringify(availabilityData)
    });
  },

  /**
   * Temporarily pause availability (temporarilyUnavailable = true)
   */
  async pauseAvailability(listingId) {
    return request(`/api/listings/${listingId}/availability/pause`, {
      method: 'POST'
    });
  },

  /**
   * Resume availability (temporarilyUnavailable = false)
   */
  async resumeAvailability(listingId) {
    return request(`/api/listings/${listingId}/availability/resume`, {
      method: 'POST'
    });
  },

  // ==========================================================================
  // HOST BOOKING CLIENT METHODS
  // ==========================================================================

  /**
   * Retrieve all bookings for the authenticated host
   * @param {Object} [filters] { status, listingId }
   */
  async getHostBookings(filters = {}) {
    const params = new URLSearchParams();
    if (filters.status) params.append('status', filters.status);
    if (filters.listingId) params.append('listingId', filters.listingId);
    const qs = params.toString();
    return request(`/api/host/bookings${qs ? `?${qs}` : ''}`);
  },

  /**
   * Retrieve a single booking by ID
   * @param {string} bookingId
   */
  async getBookingById(bookingId) {
    return request(`/api/host/bookings/${bookingId}`);
  },

  /**
   * Host cancels a booking
   * @param {string} bookingId
   */
  async cancelBooking(bookingId) {
    return request(`/api/host/bookings/${bookingId}/cancel`, {
      method: 'POST'
    });
  },

  /**
   * Host starts a parking session for a confirmed booking
   * @param {string} bookingId
   */
  async startSession(bookingId) {
    return request(`/api/host/bookings/${bookingId}/start`, {
      method: 'POST'
    });
  },

  /**
   * Host marks a confirmed booking as completed
   * @param {string} bookingId
   */
  async completeBooking(bookingId) {
    return request(`/api/host/bookings/${bookingId}/complete`, {
      method: 'POST'
    });
  },

  /**
   * Create a booking (used for integration testing / future renter flow)
   * @param {Object} bookingData
   */
  async createBooking(bookingData) {
    return request('/api/bookings', {
      method: 'POST',
      body: JSON.stringify(bookingData)
    });
  }
};
