/**
 * POP - API Client for Host Listings & Bookings
 * Uses the existing POP auth system to add authorization headers.
 */

const API_BASE = '';

async function getAuthToken(): Promise<string | null> {
  if (typeof window === 'undefined') return null;
  try {
    const stored = localStorage.getItem('parkwise_auth_user');
    if (stored) {
      const parsed = JSON.parse(stored);
      return parsed.accessToken || null;
    }
  } catch {
    // ignore
  }
  return null;
}

async function request<T = unknown>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const token = await getAuthToken();

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string> || {}),
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const response = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers,
  });

  let data: T | null = null;
  try {
    data = await response.json();
  } catch {
    data = null;
  }

  if (!response.ok) {
    const error = new Error((data as Record<string, string>)?.error || `Request failed with status ${response.status}`);
    (error as Error & { status: number; data: unknown }).status = response.status;
    (error as Error & { data: unknown }).data = data;
    throw error;
  }

  return data as T;
}

export const hostApiClient = {
  // Host Profile
  async getHostProfile() {
    return request('/api/hosts/me');
  },

  async updateHostProfile(profileData: Record<string, unknown>) {
    return request('/api/hosts', {
      method: 'POST',
      body: JSON.stringify(profileData),
    });
  },

  // Listings
  async createListing<T = any>(listingData: Record<string, unknown>): Promise<T> {
    return request<T>('/api/listings', {
      method: 'POST',
      body: JSON.stringify(listingData),
    });
  },

  async getHostListings() {
    return request('/api/listings', { method: 'GET' });
  },

  async getListing(listingId: string) {
    return request(`/api/listings/${listingId}`, { method: 'GET' });
  },

  async updateListing(listingId: string, updateData: Record<string, unknown>) {
    return request(`/api/listings/${listingId}`, {
      method: 'PUT',
      body: JSON.stringify(updateData),
    });
  },

  async deleteListing(listingId: string) {
    return request(`/api/listings/${listingId}`, { method: 'DELETE' });
  },

  // Availability
  async updateAvailability(listingId: string, availabilityData: Record<string, unknown>) {
    return request(`/api/listings/${listingId}/availability`, {
      method: 'PUT',
      body: JSON.stringify(availabilityData),
    });
  },

  async pauseAvailability(listingId: string) {
    return request(`/api/listings/${listingId}/availability/pause`, { method: 'POST' });
  },

  async resumeAvailability(listingId: string) {
    return request(`/api/listings/${listingId}/availability/resume`, { method: 'POST' });
  },

  // Resubmit
  async resubmitListing(listingId: string) {
    return request(`/api/listings/${listingId}/resubmit`, { method: 'POST' });
  },

  // Bookings
  async getHostBookings(filters: { status?: string; listingId?: string } = {}) {
    const params = new URLSearchParams();
    if (filters.status) params.append('status', filters.status);
    if (filters.listingId) params.append('listingId', filters.listingId);
    const qs = params.toString();
    return request(`/api/host/bookings${qs ? `?${qs}` : ''}`);
  },

  async cancelBooking(bookingId: string) {
    return request(`/api/host/bookings/${bookingId}/cancel`, { method: 'POST' });
  },

  async startSession(bookingId: string) {
    return request(`/api/host/bookings/${bookingId}/start`, { method: 'POST' });
  },

  async completeBooking(bookingId: string) {
    return request(`/api/host/bookings/${bookingId}/complete`, { method: 'POST' });
  },

  // Admin
  async getAdminPendingListings(status = 'pending_review') {
    return request(`/api/admin/listings?status=${encodeURIComponent(status)}`, { method: 'GET' });
  },

  async approveListing(listingId: string) {
    return request(`/api/admin/listings/${listingId}/approve`, { method: 'POST' });
  },

  async rejectListing(listingId: string, rejectionReason: string) {
    return request(`/api/admin/listings/${listingId}/reject`, {
      method: 'POST',
      body: JSON.stringify({ rejectionReason }),
    });
  },

  // Presigned Uploads
  async getPresignedUploadUrl(params: { fileName: string; fileType: string; listingId?: string; context?: string }) {
    return request('/api/uploads/presign', {
      method: 'POST',
      body: JSON.stringify(params),
    });
  },
};
