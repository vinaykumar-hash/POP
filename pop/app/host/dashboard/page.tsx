'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { hostApiClient } from '@/services/host/apiClient';
import { AVAILABLE_FEATURES } from '@/types/listingModel';
import type { ParkingListing, ListingAvailability } from '@/types/listingModel';
import LandingHeader from '@/components/layout/LandingHeader';

export interface BookingRecord {
  bookingId: string;
  listingId: string;
  status: 'pending' | 'confirmed' | 'active' | 'completed' | 'cancelled' | 'expired';
  session?: {
    startedAt?: string;
    completedAt?: string;
  };
  startAt: string;
  endAt: string;
  durationMinutes: number;
  vehicle?: {
    type?: string;
    registrationNumber?: string;
  };
  pricing?: {
    totalAmount: number;
    hourlyRate: number;
    currency?: string;
  };
  access?: {
    instructions?: string;
    entryNotes?: string;
    hostInstructions?: string;
  };
  createdAt: string;
  completedAt?: string;
  cancelledAt?: string;
  timezone?: string;
}

export default function HostDashboardPage() {
  const router = useRouter();
  const { user, isAuthenticated, isLoading: authLoading, openAuthModal } = useAuth();

  const [activeTab, setActiveTab] = useState<'listings' | 'bookings'>('listings');
  const [listings, setListings] = useState<ParkingListing[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [hostProfile, setHostProfile] = useState<Record<string, unknown> | null>(null);

  // Bookings state
  const [bookings, setBookings] = useState<BookingRecord[]>([]);
  const [isLoadingBookings, setIsLoadingBookings] = useState(false);
  const [bookingsError, setBookingsError] = useState<string | null>(null);
  const [bookingStatusFilter, setBookingStatusFilter] = useState('all');
  const [viewingBooking, setViewingBooking] = useState<BookingRecord | null>(null);
  const [isProcessingBookingId, setIsProcessingBookingId] = useState<string | null>(null);

  // Modal states
  const [viewingListing, setViewingListing] = useState<ParkingListing | null>(null);
  const [editingListing, setEditingListing] = useState<ParkingListing | null>(null);
  const [editFormData, setEditFormData] = useState({
    hourly: '',
    daily: '',
    instructions: '',
    features: [] as string[],
  });
  const [isSavingEdit, setIsSavingEdit] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isResubmittingId, setIsResubmittingId] = useState<string | null>(null);

  // Availability state
  const [editingAvailabilityListing, setEditingAvailabilityListing] = useState<ParkingListing | null>(null);
  const [availabilityFormData, setAvailabilityFormData] = useState({
    days: [] as string[],
    startTime: '08:00',
    endTime: '20:00',
    timezone: 'Asia/Kolkata',
    temporarilyUnavailable: false,
  });
  const [availabilityError, setAvailabilityError] = useState<string | null>(null);
  const [isSavingAvailability, setIsSavingAvailability] = useState(false);
  const [isTogglingAvailabilityId, setIsTogglingAvailabilityId] = useState<string | null>(null);

  // Read URL query tab on mount
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const tab = params.get('tab');
      if (tab === 'listings' || tab === 'bookings') {
        setActiveTab(tab);
      }
    }
  }, []);

  const fetchHostProfile = useCallback(async () => {
    try {
      const profile = (await hostApiClient.getHostProfile()) as Record<string, unknown>;
      setHostProfile(profile || null);
    } catch (err) {
      console.error('Failed to fetch host profile:', err);
    }
  }, []);

  const fetchListings = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = (await hostApiClient.getHostListings()) as ParkingListing[];
      setListings(data || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load your parking listings.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  const fetchBookings = useCallback(async () => {
    setIsLoadingBookings(true);
    setBookingsError(null);
    try {
      const filters: { status?: string } = {};
      if (bookingStatusFilter !== 'all') {
        filters.status = bookingStatusFilter;
      }
      const data = (await hostApiClient.getHostBookings(filters)) as BookingRecord[];
      setBookings(data || []);
    } catch (err) {
      setBookingsError(err instanceof Error ? err.message : 'Failed to load bookings.');
    } finally {
      setIsLoadingBookings(false);
    }
  }, [bookingStatusFilter]);

  // Load profile & listings when user changes
  useEffect(() => {
    if (user?.id) {
      fetchHostProfile();
      fetchListings();
    }
  }, [user?.id, fetchHostProfile, fetchListings]);

  // Load bookings when bookings tab is active
  useEffect(() => {
    if (activeTab === 'bookings' && user?.id) {
      fetchBookings();
    }
  }, [activeTab, bookingStatusFilter, user?.id, fetchBookings]);

  const formatAvailabilitySummary = (avail?: ListingAvailability | null) => {
    if (!avail || !avail.days || avail.days.length === 0) {
      return 'No schedule configured';
    }
    const weekdays = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
    const weekends = ['Saturday', 'Sunday'];

    let daysLabel = '';
    if (avail.days.length === 7) {
      daysLabel = 'Everyday';
    } else if (avail.days.length === 5 && weekdays.every((d) => avail.days.includes(d))) {
      daysLabel = 'Mon – Fri';
    } else if (avail.days.length === 2 && weekends.every((d) => avail.days.includes(d))) {
      daysLabel = 'Sat & Sun';
    } else {
      daysLabel = avail.days.map((d) => d.slice(0, 3)).join(', ');
    }

    return `${daysLabel} • ${avail.startTime || '08:00'} – ${avail.endTime || '20:00'}`;
  };

  const handleOpenAvailability = (listing: ParkingListing) => {
    setEditingAvailabilityListing(listing);
    setAvailabilityError(null);
    setAvailabilityFormData({
      days: [...(listing.availability?.days || ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'])],
      startTime: listing.availability?.startTime || '08:00',
      endTime: listing.availability?.endTime || '20:00',
      timezone: listing.availability?.timezone || 'Asia/Kolkata',
      temporarilyUnavailable: !!listing.availability?.temporarilyUnavailable,
    });
  };

  const handleSelectDaysPreset = (preset: 'all' | 'weekdays' | 'weekends') => {
    if (preset === 'all') {
      setAvailabilityFormData((prev) => ({
        ...prev,
        days: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'],
      }));
    } else if (preset === 'weekdays') {
      setAvailabilityFormData((prev) => ({
        ...prev,
        days: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
      }));
    } else if (preset === 'weekends') {
      setAvailabilityFormData((prev) => ({
        ...prev,
        days: ['Saturday', 'Sunday'],
      }));
    }
  };

  const handleToggleDay = (day: string) => {
    setAvailabilityFormData((prev) => {
      const exists = prev.days.includes(day);
      const nextDays = exists ? prev.days.filter((d) => d !== day) : [...prev.days, day];
      return { ...prev, days: nextDays };
    });
  };

  const handleSaveAvailability = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingAvailabilityListing?.listingId) return;

    if (availabilityFormData.days.length === 0) {
      setAvailabilityError('Please select at least one day.');
      return;
    }

    if (availabilityFormData.endTime <= availabilityFormData.startTime) {
      setAvailabilityError('End time must be later than start time.');
      return;
    }

    setIsSavingAvailability(true);
    setAvailabilityError(null);
    try {
      const updatedListing = (await hostApiClient.updateAvailability(
        editingAvailabilityListing.listingId,
        availabilityFormData
      )) as ParkingListing;

      const newAvail = updatedListing.availability || (availabilityFormData as ListingAvailability);

      setListings((prev) =>
        prev.map((l) =>
          l.listingId === editingAvailabilityListing.listingId
            ? { ...l, availability: newAvail }
            : l
        )
      );
      setEditingAvailabilityListing(null);
    } catch (err) {
      setAvailabilityError(err instanceof Error ? err.message : 'Failed to update availability.');
    } finally {
      setIsSavingAvailability(false);
    }
  };

  const handlePauseAvailability = async (listingId: string) => {
    setIsTogglingAvailabilityId(listingId);
    try {
      const res = (await hostApiClient.pauseAvailability(listingId)) as ParkingListing;
      const newAvail = res?.availability || {
        ...(listings.find((l) => l.listingId === listingId)?.availability || {}),
        temporarilyUnavailable: true,
      };
      setListings((prev) =>
        prev.map((l) =>
          l.listingId === listingId ? { ...l, availability: newAvail as ListingAvailability } : l
        )
      );
    } catch (err) {
      alert(`Failed to pause availability: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setIsTogglingAvailabilityId(null);
    }
  };

  const handleResumeAvailability = async (listingId: string) => {
    setIsTogglingAvailabilityId(listingId);
    try {
      const res = (await hostApiClient.resumeAvailability(listingId)) as ParkingListing;
      const newAvail = res?.availability || {
        ...(listings.find((l) => l.listingId === listingId)?.availability || {}),
        temporarilyUnavailable: false,
      };
      setListings((prev) =>
        prev.map((l) =>
          l.listingId === listingId ? { ...l, availability: newAvail as ListingAvailability } : l
        )
      );
    } catch (err) {
      alert(`Failed to resume availability: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setIsTogglingAvailabilityId(null);
    }
  };

  const handleResubmitListing = async (listingId: string) => {
    setIsResubmittingId(listingId);
    try {
      const updated = (await hostApiClient.resubmitListing(listingId)) as ParkingListing;
      setListings((prev) => prev.map((l) => (l.listingId === listingId ? updated : l)));
    } catch (err) {
      alert(`Resubmission failed: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setIsResubmittingId(null);
    }
  };

  const handleOpenEdit = (listing: ParkingListing) => {
    setEditingListing(listing);
    setEditFormData({
      hourly: listing.pricing?.hourly || '',
      daily: listing.pricing?.daily || '',
      instructions: listing.parkingDetails?.instructions || '',
      features: [...(listing.parkingDetails?.features || [])],
    });
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingListing?.listingId) return;

    setIsSavingEdit(true);
    try {
      const updates = {
        pricing: {
          ...editingListing.pricing,
          hourly: editFormData.hourly,
          daily: editFormData.daily || null,
        },
        parkingDetails: {
          ...editingListing.parkingDetails,
          instructions: editFormData.instructions,
          features: editFormData.features,
        },
      };

      const updated = (await hostApiClient.updateListing(editingListing.listingId, updates)) as ParkingListing;

      setListings((prev) =>
        prev.map((l) => (l.listingId === updated.listingId ? updated : l))
      );
      setEditingListing(null);
    } catch (err) {
      alert(`Update failed: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setIsSavingEdit(false);
    }
  };

  const handleDeleteListing = async (listingId: string) => {
    setIsDeleting(true);
    try {
      await hostApiClient.deleteListing(listingId);
      setListings((prev) => prev.filter((l) => l.listingId !== listingId));
      setDeletingId(null);
    } catch (err) {
      alert(`Delete failed: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setIsDeleting(false);
    }
  };

  const handleFeatureToggle = (feature: string) => {
    setEditFormData((prev) => {
      const exists = prev.features.includes(feature);
      return {
        ...prev,
        features: exists ? prev.features.filter((f) => f !== feature) : [...prev.features, feature],
      };
    });
  };

  const formatBookingDate = (isoString?: string) => {
    if (!isoString) return '';
    try {
      return new Intl.DateTimeFormat('en-US', {
        timeZone: 'Asia/Kolkata',
        weekday: 'short',
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      }).format(new Date(isoString));
    } catch {
      return isoString;
    }
  };

  const formatBookingTimeOnly = (isoString?: string) => {
    if (!isoString) return '';
    try {
      return new Intl.DateTimeFormat('en-US', {
        timeZone: 'Asia/Kolkata',
        hour: '2-digit',
        minute: '2-digit',
        hour12: true,
      }).format(new Date(isoString));
    } catch {
      return isoString;
    }
  };

  const formatBookingDateTime = (isoString?: string) => {
    if (!isoString) return '';
    try {
      return new Intl.DateTimeFormat('en-US', {
        timeZone: 'Asia/Kolkata',
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        hour12: true,
      }).format(new Date(isoString));
    } catch {
      return isoString;
    }
  };

  const handleCancelBooking = async (bookingId: string) => {
    if (!window.confirm('Are you sure you want to cancel this booking?')) return;
    setIsProcessingBookingId(bookingId);
    try {
      const updated = (await hostApiClient.cancelBooking(bookingId)) as BookingRecord;
      setBookings((prev) => prev.map((b) => (b.bookingId === bookingId ? updated : b)));
      if (viewingBooking?.bookingId === bookingId) {
        setViewingBooking(updated);
      }
    } catch (err) {
      alert(`Failed to cancel booking: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setIsProcessingBookingId(null);
    }
  };

  const handleCompleteBooking = async (bookingId: string) => {
    setIsProcessingBookingId(bookingId);
    try {
      const updated = (await hostApiClient.completeBooking(bookingId)) as BookingRecord;
      setBookings((prev) => prev.map((b) => (b.bookingId === bookingId ? updated : b)));
      if (viewingBooking?.bookingId === bookingId) {
        setViewingBooking(updated);
      }
    } catch (err) {
      alert(`Failed to complete booking: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setIsProcessingBookingId(null);
    }
  };

  const handleStartSession = async (bookingId: string) => {
    setIsProcessingBookingId(bookingId);
    try {
      const updated = (await hostApiClient.startSession(bookingId)) as BookingRecord;
      setBookings((prev) => prev.map((b) => (b.bookingId === bookingId ? updated : b)));
      if (viewingBooking?.bookingId === bookingId) {
        setViewingBooking(updated);
      }
    } catch (err) {
      alert(`Failed to start parking session: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setIsProcessingBookingId(null);
    }
  };

  if (authLoading) {
    return (
      <div className="landing-page">
        <LandingHeader />
        <main className="landing-main" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '60vh' }}>
          <div className="loading-spinner" />
        </main>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="landing-page">
        <LandingHeader />
        <main className="landing-main" style={{ padding: '3rem 1.5rem', maxWidth: '600px', margin: '0 auto', textAlign: 'center' }}>
          <div className="dashboard-empty-card" style={{ padding: '3rem 2rem' }}>
            <h1 className="empty-title" style={{ fontSize: '1.75rem', marginBottom: '0.75rem' }}>Sign In Required</h1>
            <p className="empty-subtitle" style={{ marginBottom: '1.5rem', color: '#666' }}>
              Please sign in to access your host dashboard, manage listings, and track reservations.
            </p>
            <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center', flexWrap: 'wrap' }}>
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => openAuthModal('HOST')}
              >
                Sign In as Host
              </button>
              <Link href="/host/login" className="btn btn-secondary">
                Host Login Page
              </Link>
            </div>
          </div>
        </main>
      </div>
    );
  }

  const isVerifiedHost =
    (hostProfile?.verification as Record<string, unknown>)?.status === 'verified' ||
    user?.verificationStatus === 'verified';

  const isPendingHost =
    (hostProfile?.verification as Record<string, unknown>)?.status === 'pending' ||
    user?.verificationStatus === 'pending';

  return (
    <div className="landing-page" style={{ minHeight: '100vh', backgroundColor: 'var(--pw-bg, #ffffff)' }}>
      <LandingHeader />

      <main className="main-content" role="main">
        <section className="dashboard-container" aria-labelledby="dashboard-title">
        {/* Dashboard Top Header */}
        <div className="dashboard-header-row">
          <div>
            <h1 id="dashboard-title" className="page-title">
              My Parking
            </h1>
            <p className="text-subtitle">
              Manage your listed parking spaces, view bookings, and update rates.
            </p>
            <div
              className="host-account-status-badge"
              style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginTop: '0.5rem', flexWrap: 'wrap' }}
            >
              {isVerifiedHost ? (
                <span
                  className="status-pill status-approved"
                  id="host-account-verified-badge"
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.25rem',
                    backgroundColor: '#00875A',
                    color: '#fff',
                    padding: '0.25rem 0.6rem',
                    borderRadius: '12px',
                    fontSize: '0.78rem',
                    fontWeight: 600,
                  }}
                >
                  ✓ Verified Host Account
                </span>
              ) : isPendingHost ? (
                <span
                  className="status-pill status-pending"
                  id="host-account-pending-badge"
                  style={{ padding: '0.25rem 0.6rem', borderRadius: '12px', fontSize: '0.78rem' }}
                >
                  VERIFICATION PENDING
                </span>
              ) : (
                <span
                  className="status-pill"
                  id="host-account-unverified-badge"
                  style={{
                    backgroundColor: '#DFE1E6',
                    color: '#42526E',
                    padding: '0.25rem 0.6rem',
                    borderRadius: '12px',
                    fontSize: '0.78rem',
                    fontWeight: 500,
                  }}
                >
                  VERIFICATION REQUIRED
                </span>
              )}
              <span style={{ fontSize: '0.82rem', color: '#6B778C' }}>{user?.email}</span>
            </div>
          </div>
          <Link href="/host/new" id="btn-add-space" className="btn btn-primary">
            + Add Parking Space
          </Link>
        </div>

        {/* Dashboard Tabs */}
        <div className="dashboard-tab-bar" role="tablist" aria-label="Dashboard sections">
          <button
            type="button"
            role="tab"
            id="tab-spaces"
            aria-selected={activeTab === 'listings'}
            className={`dashboard-tab-btn ${activeTab === 'listings' ? 'active' : ''}`}
            onClick={() => setActiveTab('listings')}
          >
            My Spaces ({listings.length})
          </button>
          <button
            type="button"
            role="tab"
            id="tab-bookings"
            aria-selected={activeTab === 'bookings'}
            className={`dashboard-tab-btn ${activeTab === 'bookings' ? 'active' : ''}`}
            onClick={() => setActiveTab('bookings')}
          >
            Bookings ({bookings.length})
          </button>
        </div>

        {/* =================================================================== */}
        {/* TAB 1: MY SPACES (LISTINGS) VIEW */}
        {/* =================================================================== */}
        {activeTab === 'listings' && (
          <>
            {/* Loading state */}
            {isLoading && (
              <div className="auth-loading-container" aria-live="polite" style={{ textAlign: 'center', padding: '3rem 0' }}>
                <div className="loading-spinner" aria-label="Loading listings..."></div>
                <p className="loading-text" style={{ marginTop: '0.75rem', color: '#666' }}>Loading your parking listings...</p>
              </div>
            )}

            {/* Error state */}
            {error && !isLoading && (
              <div className="auth-error-banner" role="alert">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                  <circle cx="12" cy="12" r="10" />
                  <line x1="12" y1="8" x2="12" y2="12" />
                  <line x1="12" y1="16" x2="12.01" y2="16" />
                </svg>
                <span>{error}</span>
                <button type="button" className="btn btn-secondary" onClick={fetchListings} style={{ marginLeft: 'auto' }}>
                  Retry
                </button>
              </div>
            )}

            {/* Empty State */}
            {!isLoading && !error && listings.length === 0 && (
              <div className="dashboard-empty-card">
                <div className="empty-icon-box" aria-hidden="true">
                  <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                    <rect width="18" height="18" x="3" y="3" rx="2" />
                    <path d="M9 17V7h4a3 3 0 0 1 0 6H9" />
                  </svg>
                </div>
                <h2 className="empty-title">You haven&apos;t listed any parking spaces yet</h2>
                <p className="empty-subtitle">
                  Turn your empty driveway, garage, or reserved slot into passive income today.
                </p>
                <Link href="/host/new" id="btn-empty-list" className="btn btn-primary btn-large">
                  List a Parking Space
                </Link>
              </div>
            )}

            {/* Listings Grid */}
            {!isLoading && !error && listings.length > 0 && (
              <div className="dashboard-listings-grid" role="region" aria-label="Host parking listings">
                {listings.map((item) => {
                  const coverPhoto = item.photos?.[0]?.previewUrl || (item.photos?.[0] as unknown as { url?: string })?.url;
                  const formattedDate = item.createdAt
                    ? new Date(item.createdAt).toLocaleDateString('en-US', {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric',
                      })
                    : 'Recently added';

                  return (
                    <article key={item.listingId} className="dashboard-listing-card" id={`card-${item.listingId}`}>
                      {/* Photo & Status */}
                      <div className="listing-card-media">
                        {coverPhoto ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={coverPhoto} alt={`${item.location?.locality} parking`} className="listing-cover-img" />
                        ) : (
                          <div className="listing-media-placeholder">
                            <span>No Photo Uploaded</span>
                          </div>
                        )}
                        <span className={`status-pill status-${item.status || 'pending_review'}`}>
                          {item.status === 'pending_review'
                            ? 'PENDING REVIEW'
                            : item.status === 'approved'
                            ? 'APPROVED'
                            : item.status === 'rejected'
                            ? 'REJECTED'
                            : item.status === 'suspended'
                            ? 'SUSPENDED'
                            : item.status?.toUpperCase() || 'PENDING'}
                        </span>
                      </div>

                      {/* Details */}
                      <div className="listing-card-body">
                        <div className="listing-card-header">
                          <h2 className="listing-locality">
                            {item.location?.locality}, {item.location?.city}
                          </h2>
                          <span className="listing-price">
                            &#8377;{item.pricing?.hourly}
                            <span className="price-unit">/hr</span>
                          </span>
                        </div>

                        <div className="listing-meta-row">
                          <span>{item.parkingDetails?.vehicleType}</span>
                          <span>&bull;</span>
                          <span>{item.parkingDetails?.parkingType} Parking</span>
                          <span>&bull;</span>
                          <span>{item.parkingDetails?.capacity} space(s)</span>
                        </div>

                        <div className="listing-date-row">
                          <span>Listed on {formattedDate}</span>
                        </div>

                        {/* Status Lifecycle Notice Banner */}
                        {item.status === 'pending_review' && (
                          <div className="listing-status-banner status-banner-pending" role="status">
                            <strong>Pending Review</strong>
                            <p style={{ margin: 0, fontSize: '0.775rem' }}>
                              Your space listing is under administrative review.
                            </p>
                          </div>
                        )}

                        {item.status === 'approved' && (
                          <div className="listing-status-banner status-banner-approved" role="status">
                            <strong>Approved</strong>
                            <p style={{ margin: 0, fontSize: '0.775rem' }}>Your parking space is approved.</p>
                          </div>
                        )}

                        {item.status === 'rejected' && (
                          <div className="listing-status-banner status-banner-rejected" role="alert">
                            <strong>Your listing needs changes.</strong>
                            {item.rejectionReason && (
                              <div className="rejection-reason-box">
                                Reason: {item.rejectionReason}
                              </div>
                            )}
                            <button
                              type="button"
                              id={`btn-resubmit-${item.listingId}`}
                              className="btn-resubmit-action"
                              onClick={() => item.listingId && handleResubmitListing(item.listingId)}
                              disabled={isResubmittingId === item.listingId}
                            >
                              {isResubmittingId === item.listingId ? 'Resubmitting...' : 'Resubmit for Review'}
                            </button>
                          </div>
                        )}

                        {item.status === 'suspended' && (
                          <div className="listing-status-banner status-banner-suspended" role="status">
                            <strong>Suspended</strong>
                            <p style={{ margin: 0, fontSize: '0.775rem' }}>This parking space is currently suspended.</p>
                          </div>
                        )}

                        {/* Availability Block on Card */}
                        <div className="listing-card-availability" id={`avail-${item.listingId}`}>
                          <div className="availability-card-header">
                            <span className="availability-title">AVAILABILITY</span>
                            {item.availability?.temporarilyUnavailable ? (
                              <span className="availability-paused-pill" id={`paused-badge-${item.listingId}`}>
                                Temporarily unavailable
                              </span>
                            ) : (
                              <span className="availability-active-pill">Active</span>
                            )}
                          </div>
                          <p className="availability-schedule-text">
                            {formatAvailabilitySummary(item.availability)}
                          </p>
                          <div className="availability-btn-row">
                            <button
                              type="button"
                              id={`btn-edit-avail-${item.listingId}`}
                              className="btn-availability-edit"
                              onClick={() => handleOpenAvailability(item)}
                            >
                              Edit Schedule
                            </button>
                            {item.availability?.temporarilyUnavailable ? (
                              <button
                                type="button"
                                id={`btn-resume-avail-${item.listingId}`}
                                className="btn-availability-toggle"
                                onClick={() => item.listingId && handleResumeAvailability(item.listingId)}
                                disabled={isTogglingAvailabilityId === item.listingId}
                              >
                                {isTogglingAvailabilityId === item.listingId ? 'Resuming...' : 'Resume'}
                              </button>
                            ) : (
                              <button
                                type="button"
                                id={`btn-pause-avail-${item.listingId}`}
                                className="btn-availability-toggle"
                                onClick={() => item.listingId && handlePauseAvailability(item.listingId)}
                                disabled={isTogglingAvailabilityId === item.listingId}
                              >
                                {isTogglingAvailabilityId === item.listingId ? 'Pausing...' : 'Pause'}
                              </button>
                            )}
                          </div>
                        </div>

                        {/* Actions */}
                        <div className="listing-card-actions">
                          <button
                            type="button"
                            id={`btn-view-${item.listingId}`}
                            className="btn-action-view"
                            onClick={() => setViewingListing(item)}
                            aria-label={`View listing details for ${item.location?.locality}`}
                          >
                            View
                          </button>
                          <button
                            type="button"
                            id={`btn-edit-${item.listingId}`}
                            className="btn-action-edit"
                            onClick={() => handleOpenEdit(item)}
                            aria-label={`Edit listing for ${item.location?.locality}`}
                          >
                            Edit
                          </button>
                          <button
                            type="button"
                            id={`btn-delete-${item.listingId}`}
                            className="btn-action-delete"
                            onClick={() => item.listingId && setDeletingId(item.listingId)}
                            aria-label={`Delete listing for ${item.location?.locality}`}
                          >
                            Delete
                          </button>
                        </div>
                      </div>
                    </article>
                  );
                })}
              </div>
            )}
          </>
        )}

        {/* =================================================================== */}
        {/* TAB 2: BOOKINGS VIEW */}
        {/* =================================================================== */}
        {activeTab === 'bookings' && (
          <div className="bookings-view-container">
            {/* Status filter pills */}
            <div className="booking-filters-row">
              <div className="filter-pill-group" role="group" aria-label="Filter bookings by status">
                {['all', 'confirmed', 'active', 'pending', 'completed', 'cancelled'].map((st) => (
                  <button
                    key={st}
                    type="button"
                    id={`filter-${st}`}
                    className={`filter-pill-btn ${bookingStatusFilter === st ? 'active' : ''}`}
                    onClick={() => setBookingStatusFilter(st)}
                  >
                    {st === 'active' ? 'Active Session' : st.charAt(0).toUpperCase() + st.slice(1)}
                  </button>
                ))}
              </div>
            </div>

            {/* Loading state */}
            {isLoadingBookings && (
              <div className="auth-loading-container" aria-live="polite" style={{ textAlign: 'center', padding: '3rem 0' }}>
                <div className="loading-spinner" aria-label="Loading bookings..."></div>
                <p className="loading-text" style={{ marginTop: '0.75rem', color: '#666' }}>Loading your bookings...</p>
              </div>
            )}

            {/* Error state */}
            {bookingsError && !isLoadingBookings && (
              <div className="auth-error-banner" role="alert">
                <span>{bookingsError}</span>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={fetchBookings}
                  style={{ marginLeft: 'auto' }}
                >
                  Retry
                </button>
              </div>
            )}

            {/* Empty State */}
            {!isLoadingBookings && !bookingsError && bookings.length === 0 && (
              <div className="dashboard-empty-card" id="empty-bookings-card">
                <div className="empty-icon-box" aria-hidden="true">
                  <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                    <rect width="18" height="18" x="3" y="4" rx="2" ry="2" />
                    <line x1="16" y1="2" x2="16" y2="6" />
                    <line x1="8" y1="2" x2="8" y2="6" />
                    <line x1="3" y1="10" x2="21" y2="10" />
                  </svg>
                </div>
                <h2 className="empty-title">No bookings yet</h2>
                <p className="empty-subtitle">
                  Bookings will appear here when renters reserve your parking space.
                </p>
              </div>
            )}

            {/* Bookings Grid */}
            {!isLoadingBookings && !bookingsError && bookings.length > 0 && (
              <div className="dashboard-bookings-grid" role="region" aria-label="Host parking reservations">
                {bookings.map((booking) => {
                  const listing = listings.find((l) => l.listingId === booking.listingId);
                  const listingTitle = listing?.location?.locality
                    ? `${listing.location.locality}, ${listing.location.city || ''}`
                    : `Parking Space (${booking.listingId?.slice(0, 15)}...)`;

                  const isSessionActive =
                    booking.status === 'confirmed' &&
                    !!booking.session?.startedAt &&
                    !booking.session?.completedAt;

                  return (
                    <article key={booking.bookingId} className="dashboard-booking-card" id={`booking-card-${booking.bookingId}`}>
                      <div className="booking-card-header">
                        <div>
                          <span className="booking-id-tag">ID: {booking.bookingId}</span>
                          <h2 className="booking-listing-title">{listingTitle}</h2>
                        </div>
                        {isSessionActive ? (
                          <span className="status-pill status-active">
                            <span className="active-session-dot" aria-hidden="true"></span> Active Session
                          </span>
                        ) : (
                          <span className={`status-pill status-${booking.status}`}>
                            {booking.status.charAt(0).toUpperCase() + booking.status.slice(1)}
                          </span>
                        )}
                      </div>

                      <div className="booking-card-body">
                        {isSessionActive && booking.session?.startedAt && (
                          <div className="booking-session-live-alert">
                            <span className="live-badge">&#9679; Session In Progress</span>
                            <span className="live-started-time">
                              Started {formatBookingTimeOnly(booking.session.startedAt)}
                            </span>
                          </div>
                        )}

                        <div className="booking-info-row">
                          <span className="booking-label">Date:</span>
                          <span className="booking-value">{formatBookingDate(booking.startAt)}</span>
                        </div>
                        <div className="booking-info-row">
                          <span className="booking-label">Time:</span>
                          <span className="booking-value">
                            {formatBookingTimeOnly(booking.startAt)} – {formatBookingTimeOnly(booking.endAt)} (IST)
                          </span>
                        </div>
                        <div className="booking-info-row">
                          <span className="booking-label">Duration:</span>
                          <span className="booking-value">
                            {booking.durationMinutes} mins ({Math.round((booking.durationMinutes / 60) * 10) / 10} hrs)
                          </span>
                        </div>
                        <div className="booking-info-row">
                          <span className="booking-label">Vehicle:</span>
                          <span className="booking-value">
                            {booking.vehicle?.type ? booking.vehicle.type.toUpperCase() : 'CAR'}
                            {booking.vehicle?.registrationNumber ? ` • ${booking.vehicle.registrationNumber}` : ''}
                          </span>
                        </div>
                        <div className="booking-info-row">
                          <span className="booking-label">Total Amount:</span>
                          <span className="booking-price-value">
                            &#8377;{booking.pricing?.totalAmount} (&#8377;{booking.pricing?.hourlyRate}/hr)
                          </span>
                        </div>
                        {booking.access?.instructions && (
                          <div className="booking-info-row">
                            <span className="booking-label">Access:</span>
                            <span className="booking-value access-text-truncate" title={booking.access.instructions}>
                              {booking.access.instructions}
                            </span>
                          </div>
                        )}
                        <div className="booking-date-sub">
                          <span>Booked on {formatBookingDateTime(booking.createdAt)}</span>
                        </div>
                      </div>

                      <div className="booking-card-footer">
                        <button
                          type="button"
                          id={`btn-view-booking-${booking.bookingId}`}
                          className="btn-action-view"
                          onClick={() => setViewingBooking(booking)}
                        >
                          View Details
                        </button>

                        {booking.status === 'confirmed' && !isSessionActive && (
                          <>
                            <button
                              type="button"
                              id={`btn-start-session-${booking.bookingId}`}
                              className="btn-action-start"
                              onClick={() => handleStartSession(booking.bookingId)}
                              disabled={isProcessingBookingId === booking.bookingId}
                            >
                              {isProcessingBookingId === booking.bookingId ? 'Starting...' : 'Start Session'}
                            </button>
                            <button
                              type="button"
                              id={`btn-cancel-booking-${booking.bookingId}`}
                              className="btn-action-cancel"
                              onClick={() => handleCancelBooking(booking.bookingId)}
                              disabled={isProcessingBookingId === booking.bookingId}
                            >
                              Cancel
                            </button>
                          </>
                        )}

                        {booking.status === 'confirmed' && isSessionActive && (
                          <button
                            type="button"
                            id={`btn-complete-booking-${booking.bookingId}`}
                            className="btn-action-complete"
                            onClick={() => handleCompleteBooking(booking.bookingId)}
                            disabled={isProcessingBookingId === booking.bookingId}
                          >
                            {isProcessingBookingId === booking.bookingId ? 'Completing...' : 'Complete Session'}
                          </button>
                        )}

                        {booking.status === 'pending' && (
                          <button
                            type="button"
                            id={`btn-cancel-booking-${booking.bookingId}`}
                            className="btn-action-cancel"
                            onClick={() => handleCancelBooking(booking.bookingId)}
                            disabled={isProcessingBookingId === booking.bookingId}
                          >
                            Cancel
                          </button>
                        )}
                      </div>
                    </article>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* =================================================================== */}
        {/* VIEW DETAILS MODAL */}
        {/* =================================================================== */}
        {viewingListing && (
          <div className="modal-backdrop" onClick={() => setViewingListing(null)} role="dialog" aria-modal="true">
            <div className="modal-card" onClick={(e) => e.stopPropagation()}>
              <div className="modal-header">
                <h2 className="modal-title">Parking Details</h2>
                <button
                  type="button"
                  className="btn-modal-close"
                  onClick={() => setViewingListing(null)}
                  aria-label="Close modal"
                >
                  &times;
                </button>
              </div>

              <div className="modal-body">
                {/* Privacy Notice for Owner */}
                <div className="privacy-banner" style={{ marginBottom: '1.25rem' }}>
                  <div className="privacy-icon" aria-hidden="true">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <rect width="18" height="11" x="3" y="11" rx="2" ry="2" />
                      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                    </svg>
                  </div>
                  <div className="privacy-content">
                    <strong>Host Owner View:</strong> As the verified owner, your full address is visible below. Renters only see your locality until a booking is confirmed.
                  </div>
                </div>

                <div className="review-content-grid">
                  <div className="review-item full-width">
                    <span className="review-item-label">Exact Residential Address</span>
                    <span className="review-item-value" style={{ fontWeight: 600 }}>
                      {viewingListing.location?.address}
                    </span>
                  </div>
                  <div className="review-item">
                    <span className="review-item-label">Area / Locality</span>
                    <span className="review-item-value">
                      {viewingListing.location?.locality}, {viewingListing.location?.city}
                    </span>
                  </div>
                  <div className="review-item">
                    <span className="review-item-label">State & PIN Code</span>
                    <span className="review-item-value">
                      {viewingListing.location?.state} - {viewingListing.location?.pincode}
                    </span>
                  </div>
                  <div className="review-item">
                    <span className="review-item-label">Rate</span>
                    <span className="review-item-value price-highlight">
                      &#8377;{viewingListing.pricing?.hourly} / hr
                    </span>
                  </div>
                  {viewingListing.pricing?.daily && (
                    <div className="review-item">
                      <span className="review-item-label">Daily Rate</span>
                      <span className="review-item-value">&#8377;{viewingListing.pricing?.daily} / day</span>
                    </div>
                  )}
                  <div className="review-item">
                    <span className="review-item-label">Vehicle & Type</span>
                    <span className="review-item-value">
                      {viewingListing.parkingDetails?.vehicleType} ({viewingListing.parkingDetails?.parkingType})
                    </span>
                  </div>
                  <div className="review-item">
                    <span className="review-item-label">Capacity</span>
                    <span className="review-item-value">{viewingListing.parkingDetails?.capacity} vehicles</span>
                  </div>
                  <div className="review-item full-width">
                    <span className="review-item-label">Features</span>
                    <div className="features-tags-list">
                      {viewingListing.parkingDetails?.features?.map((f) => (
                        <span key={f} className="feature-tag">
                          {f}
                        </span>
                      ))}
                    </div>
                  </div>
                  {viewingListing.parkingDetails?.instructions && (
                    <div className="review-item full-width">
                      <span className="review-item-label">Instructions</span>
                      <p className="review-instructions-text">{viewingListing.parkingDetails.instructions}</p>
                    </div>
                  )}
                  <div className="review-item full-width">
                    <span className="review-item-label">Listing ID</span>
                    <span className="host-id-code">{viewingListing.listingId}</span>
                  </div>
                  <div className="review-item">
                    <span className="review-item-label">Review Status</span>
                    <span className="review-item-value" style={{ textTransform: 'capitalize', fontWeight: 600 }}>
                      {viewingListing.status?.replace('_', ' ') || 'Pending Review'}
                    </span>
                  </div>
                  {viewingListing.reviewedAt && (
                    <div className="review-item">
                      <span className="review-item-label">Reviewed On</span>
                      <span className="review-item-value">
                        {new Date(viewingListing.reviewedAt).toLocaleString()}
                      </span>
                    </div>
                  )}
                  {viewingListing.status === 'rejected' && viewingListing.rejectionReason && (
                    <div className="review-item full-width">
                      <span className="review-item-label">Rejection Reason</span>
                      <div className="rejection-reason-box">{viewingListing.rejectionReason}</div>
                    </div>
                  )}
                  <div className="review-item full-width">
                    <span className="review-item-label">Host Availability</span>
                    <span className="review-item-value">
                      {formatAvailabilitySummary(viewingListing.availability)} ({viewingListing.availability?.timezone || 'Asia/Kolkata'})
                      {viewingListing.availability?.temporarilyUnavailable ? ' — [Temporarily Unavailable]' : ''}
                    </span>
                  </div>
                </div>
              </div>

              <div className="modal-footer">
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setViewingListing(null)}
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        )}

        {/* =================================================================== */}
        {/* EDIT LISTING MODAL */}
        {/* =================================================================== */}
        {editingListing && (
          <div className="modal-backdrop" onClick={() => setEditingListing(null)} role="dialog" aria-modal="true">
            <div className="modal-card" onClick={(e) => e.stopPropagation()}>
              <form onSubmit={handleSaveEdit}>
                <div className="modal-header">
                  <h2 className="modal-title">Edit Parking Listing</h2>
                  <button
                    type="button"
                    className="btn-modal-close"
                    onClick={() => setEditingListing(null)}
                    aria-label="Close modal"
                  >
                    &times;
                  </button>
                </div>

                <div className="modal-body">
                  <div className="form-row-2">
                    <div className="form-group">
                      <label htmlFor="edit-hourly" className="form-label">
                        Hourly Price (&#8377;) <span className="required-star">*</span>
                      </label>
                      <input
                        id="edit-hourly"
                        type="number"
                        min="1"
                        className="form-input"
                        value={editFormData.hourly}
                        onChange={(e) => setEditFormData({ ...editFormData, hourly: e.target.value })}
                        required
                      />
                    </div>
                    <div className="form-group">
                      <label htmlFor="edit-daily" className="form-label">
                        Daily Price (&#8377;)
                      </label>
                      <input
                        id="edit-daily"
                        type="number"
                        min="1"
                        className="form-input"
                        value={editFormData.daily}
                        onChange={(e) => setEditFormData({ ...editFormData, daily: e.target.value })}
                      />
                    </div>
                  </div>

                  <div className="form-group">
                    <label className="form-label">Features</label>
                    <div className="features-grid">
                      {AVAILABLE_FEATURES.map((feature) => (
                        <label key={feature} className="checkbox-pill-label">
                          <input
                            type="checkbox"
                            className="checkbox-input"
                            checked={editFormData.features.includes(feature)}
                            onChange={() => handleFeatureToggle(feature)}
                          />
                          <span className="checkbox-custom" aria-hidden="true"></span>
                          <span className="checkbox-text">{feature}</span>
                        </label>
                      ))}
                    </div>
                  </div>

                  <div className="form-group">
                    <label htmlFor="edit-instructions" className="form-label">
                      Additional Instructions
                    </label>
                    <textarea
                      id="edit-instructions"
                      className="form-textarea"
                      rows={3}
                      value={editFormData.instructions}
                      onChange={(e) => setEditFormData({ ...editFormData, instructions: e.target.value })}
                    />
                  </div>
                </div>

                <div className="modal-footer">
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={() => setEditingListing(null)}
                    disabled={isSavingEdit}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    id="btn-save-edit"
                    className="btn btn-primary"
                    disabled={isSavingEdit}
                  >
                    {isSavingEdit ? 'Saving...' : 'Save Changes'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* =================================================================== */}
        {/* AVAILABILITY MODAL */}
        {/* =================================================================== */}
        {editingAvailabilityListing && (
          <div className="modal-backdrop" onClick={() => setEditingAvailabilityListing(null)} role="dialog" aria-modal="true">
            <div className="modal-card" onClick={(e) => e.stopPropagation()}>
              <form onSubmit={handleSaveAvailability}>
                <div className="modal-header">
                  <h2 className="modal-title">Manage Space Availability</h2>
                  <button
                    type="button"
                    className="btn-modal-close"
                    onClick={() => setEditingAvailabilityListing(null)}
                    aria-label="Close modal"
                  >
                    &times;
                  </button>
                </div>

                <div className="modal-body">
                  {availabilityError && (
                    <div className="auth-error-banner" role="alert" style={{ marginBottom: '1rem' }}>
                      <span>{availabilityError}</span>
                    </div>
                  )}

                  <div className="form-group">
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '0.4rem' }}>
                      <label className="form-label" style={{ margin: 0 }}>
                        Operating Days <span className="required-star">*</span>
                      </label>
                      <span className="days-preset-links">
                        <button type="button" className="btn-preset-link" onClick={() => handleSelectDaysPreset('all')}>All Days</button>
                        &bull;
                        <button type="button" className="btn-preset-link" onClick={() => handleSelectDaysPreset('weekdays')}>Weekdays</button>
                        &bull;
                        <button type="button" className="btn-preset-link" onClick={() => handleSelectDaysPreset('weekends')}>Weekends</button>
                      </span>
                    </div>
                    <div className="days-selection-grid">
                      {['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'].map((day) => {
                        const isSelected = availabilityFormData.days.includes(day);
                        return (
                          <button
                            key={day}
                            type="button"
                            className={`day-pill-btn ${isSelected ? 'day-pill-active' : ''}`}
                            onClick={() => handleToggleDay(day)}
                          >
                            {day.slice(0, 3)}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div className="form-row-2">
                    <div className="form-group">
                      <label htmlFor="avail-start-time" className="form-label">
                        Daily Start Time <span className="required-star">*</span>
                      </label>
                      <input
                        id="avail-start-time"
                        type="time"
                        className="form-input"
                        value={availabilityFormData.startTime}
                        onChange={(e) => setAvailabilityFormData({ ...availabilityFormData, startTime: e.target.value })}
                        required
                      />
                    </div>
                    <div className="form-group">
                      <label htmlFor="avail-end-time" className="form-label">
                        Daily End Time <span className="required-star">*</span>
                      </label>
                      <input
                        id="avail-end-time"
                        type="time"
                        className="form-input"
                        value={availabilityFormData.endTime}
                        onChange={(e) => setAvailabilityFormData({ ...availabilityFormData, endTime: e.target.value })}
                        required
                      />
                    </div>
                  </div>

                  <div className="form-group">
                    <label className="form-label">Timezone</label>
                    <input
                      type="text"
                      className="form-input"
                      value={availabilityFormData.timezone}
                      disabled
                      style={{ backgroundColor: 'var(--color-surface-subtle)', color: 'var(--color-text-secondary)' }}
                    />
                    <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginTop: '0.25rem', display: 'block' }}>
                      Standard operating timezone for POP India network.
                    </span>
                  </div>

                  <div
                    className="form-group"
                    style={{ backgroundColor: 'var(--color-surface-subtle)', padding: '0.85rem', borderRadius: 'var(--radius-sm)', marginTop: '0.5rem' }}
                  >
                    <label className="checkbox-pill-label" style={{ margin: 0 }}>
                      <input
                        type="checkbox"
                        className="checkbox-input"
                        checked={availabilityFormData.temporarilyUnavailable}
                        onChange={(e) => setAvailabilityFormData({ ...availabilityFormData, temporarilyUnavailable: e.target.checked })}
                      />
                      <span className="checkbox-custom" aria-hidden="true"></span>
                      <span className="checkbox-text" style={{ fontWeight: 600 }}>
                        Temporarily pause this parking space
                      </span>
                    </label>
                    <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginLeft: '1.75rem', display: 'block', marginTop: '0.2rem' }}>
                      When paused, this listing will not accept new bookings while retaining its current approval status.
                    </span>
                  </div>
                </div>

                <div className="modal-footer">
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={() => setEditingAvailabilityListing(null)}
                    disabled={isSavingAvailability}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    id="btn-save-availability"
                    className="btn btn-primary"
                    disabled={isSavingAvailability}
                  >
                    {isSavingAvailability ? 'Saving...' : 'Save Availability'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* =================================================================== */}
        {/* DELETE CONFIRMATION DIALOG */}
        {/* =================================================================== */}
        {deletingId && (
          <div className="modal-backdrop" onClick={() => setDeletingId(null)} role="dialog" aria-modal="true">
            <div className="modal-card modal-small" onClick={(e) => e.stopPropagation()}>
              <div className="modal-header">
                <h2 className="modal-title">Delete Listing</h2>
                <button
                  type="button"
                  className="btn-modal-close"
                  onClick={() => setDeletingId(null)}
                  aria-label="Close dialog"
                >
                  &times;
                </button>
              </div>
              <div className="modal-body">
                <p style={{ color: 'var(--color-text-secondary)', lineHeight: 1.5 }}>
                  Are you sure you want to delete this parking listing? This action cannot be undone.
                </p>
              </div>
              <div className="modal-footer">
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setDeletingId(null)}
                  disabled={isDeleting}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  id="btn-confirm-delete"
                  className="btn btn-delete-danger"
                  onClick={() => handleDeleteListing(deletingId)}
                  disabled={isDeleting}
                >
                  {isDeleting ? 'Deleting...' : 'Delete Listing'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* =================================================================== */}
        {/* BOOKING DETAILS MODAL */}
        {/* =================================================================== */}
        {viewingBooking && (() => {
          const isSessionActiveModal =
            viewingBooking.status === 'confirmed' &&
            !!viewingBooking.session?.startedAt &&
            !viewingBooking.session?.completedAt;

          return (
            <div className="modal-backdrop" onClick={() => setViewingBooking(null)} role="dialog" aria-modal="true">
              <div className="modal-card" onClick={(e) => e.stopPropagation()}>
                <div className="modal-header">
                  <h2 className="modal-title">Booking Details</h2>
                  <button
                    type="button"
                    className="btn-modal-close"
                    onClick={() => setViewingBooking(null)}
                    aria-label="Close modal"
                  >
                    &times;
                  </button>
                </div>
                <div className="modal-body">
                  {/* Operational Booking Timeline */}
                  <div className="booking-timeline-container" aria-label="Booking lifecycle timeline">
                    <div className="timeline-step step-completed">
                      <span className="timeline-circle">&#10003;</span>
                      <span className="timeline-label">Created</span>
                    </div>
                    <div className={`timeline-step ${viewingBooking.status !== 'pending' ? 'step-completed' : 'step-active'}`}>
                      <span className="timeline-circle">
                        {viewingBooking.status !== 'pending' ? '✓' : '2'}
                      </span>
                      <span className="timeline-label">Confirmed</span>
                    </div>
                    <div
                      className={`timeline-step ${
                        viewingBooking.session?.startedAt
                          ? viewingBooking.status === 'completed'
                            ? 'step-completed'
                            : 'step-active'
                          : ''
                      }`}
                    >
                      <span className="timeline-circle">
                        {viewingBooking.session?.startedAt ? '✓' : '3'}
                      </span>
                      <span className="timeline-label">Session Active</span>
                    </div>
                    {viewingBooking.status === 'cancelled' ? (
                      <div className="timeline-step step-cancelled">
                        <span className="timeline-circle">&#10005;</span>
                        <span className="timeline-label">Cancelled</span>
                      </div>
                    ) : (
                      <div className={`timeline-step ${viewingBooking.status === 'completed' ? 'step-completed' : ''}`}>
                        <span className="timeline-circle">
                          {viewingBooking.status === 'completed' ? '✓' : '4'}
                        </span>
                        <span className="timeline-label">Completed</span>
                      </div>
                    )}
                  </div>

                  {/* Status Banner */}
                  <div className={`listing-status-banner status-banner-${viewingBooking.status}`} style={{ marginBottom: '1.25rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      {isSessionActiveModal ? (
                        <span className="status-pill status-active">
                          <span className="active-session-dot" aria-hidden="true"></span> Active Session
                        </span>
                      ) : (
                        <span className={`status-pill status-${viewingBooking.status}`}>
                          {viewingBooking.status.charAt(0).toUpperCase() + viewingBooking.status.slice(1)}
                        </span>
                      )}
                      <span style={{ fontSize: '0.875rem', fontWeight: 600 }}>
                        {isSessionActiveModal && 'Vehicle Parked & Active Session'}
                        {!isSessionActiveModal && viewingBooking.status === 'confirmed' && 'Confirmed Reservation'}
                        {viewingBooking.status === 'pending' && 'Pending Confirmation'}
                        {viewingBooking.status === 'cancelled' && 'Cancelled Booking'}
                        {viewingBooking.status === 'completed' && 'Completed Parking Session'}
                        {viewingBooking.status === 'expired' && 'Expired Request'}
                      </span>
                    </div>
                  </div>

                  {/* Access Instructions & Entry Notes */}
                  {(viewingBooking.access?.instructions ||
                    viewingBooking.access?.entryNotes ||
                    viewingBooking.access?.hostInstructions) && (
                    <div className="booking-access-box">
                      <span className="access-box-title">Access & Entry Guidelines</span>
                      {viewingBooking.access?.instructions && (
                        <p className="access-text">
                          <strong>Directions / Location:</strong> {viewingBooking.access.instructions}
                        </p>
                      )}
                      {viewingBooking.access?.entryNotes && (
                        <p className="access-text">
                          <strong>Entry Notes:</strong> {viewingBooking.access.entryNotes}
                        </p>
                      )}
                      {viewingBooking.access?.hostInstructions && (
                        <p className="access-text">
                          <strong>Host Instructions:</strong> {viewingBooking.access.hostInstructions}
                        </p>
                      )}
                    </div>
                  )}

                  <div className="modal-detail-grid">
                    <div className="modal-detail-item">
                      <span className="detail-label">Booking ID</span>
                      <span className="detail-value" style={{ wordBreak: 'break-all', fontFamily: 'monospace' }}>
                        {viewingBooking.bookingId}
                      </span>
                    </div>

                    <div className="modal-detail-item">
                      <span className="detail-label">Listing Reference</span>
                      <span className="detail-value" style={{ wordBreak: 'break-all', fontFamily: 'monospace' }}>
                        {viewingBooking.listingId}
                      </span>
                    </div>

                    <div className="modal-detail-item">
                      <span className="detail-label">Reservation Date</span>
                      <span className="detail-value">{formatBookingDate(viewingBooking.startAt)}</span>
                    </div>

                    <div className="modal-detail-item">
                      <span className="detail-label">Time & Timezone</span>
                      <span className="detail-value">
                        {formatBookingTimeOnly(viewingBooking.startAt)} – {formatBookingTimeOnly(viewingBooking.endAt)} ({viewingBooking.timezone || 'Asia/Kolkata'})
                      </span>
                    </div>

                    <div className="modal-detail-item">
                      <span className="detail-label">Duration</span>
                      <span className="detail-value">
                        {viewingBooking.durationMinutes} minutes ({Math.round((viewingBooking.durationMinutes / 60) * 10) / 10} hours)
                      </span>
                    </div>

                    <div className="modal-detail-item">
                      <span className="detail-label">Vehicle</span>
                      <span className="detail-value">
                        {viewingBooking.vehicle?.type?.toUpperCase() || 'CAR'}
                        {viewingBooking.vehicle?.registrationNumber ? ` • ${viewingBooking.vehicle.registrationNumber}` : ''}
                      </span>
                    </div>

                    <div className="modal-detail-item">
                      <span className="detail-label">Hourly Rate</span>
                      <span className="detail-value">&#8377;{viewingBooking.pricing?.hourlyRate}/hr</span>
                    </div>

                    <div className="modal-detail-item">
                      <span className="detail-label">Total Amount</span>
                      <span className="detail-value" style={{ fontWeight: 700, color: 'var(--color-primary, #000)' }}>
                        &#8377;{viewingBooking.pricing?.totalAmount} ({viewingBooking.pricing?.currency || 'INR'})
                      </span>
                    </div>

                    <div className="modal-detail-item">
                      <span className="detail-label">Created At</span>
                      <span className="detail-value">{formatBookingDateTime(viewingBooking.createdAt)}</span>
                    </div>

                    {viewingBooking.session?.startedAt && (
                      <div className="modal-detail-item">
                        <span className="detail-label">Session Started</span>
                        <span className="detail-value" style={{ color: '#059669', fontWeight: 600 }}>
                          {formatBookingDateTime(viewingBooking.session.startedAt)}
                        </span>
                      </div>
                    )}

                    {viewingBooking.session?.completedAt && (
                      <div className="modal-detail-item">
                        <span className="detail-label">Session Completed</span>
                        <span className="detail-value" style={{ color: '#1d4ed8', fontWeight: 600 }}>
                          {formatBookingDateTime(viewingBooking.session.completedAt)}
                        </span>
                      </div>
                    )}

                    {viewingBooking.completedAt && !viewingBooking.session?.completedAt && (
                      <div className="modal-detail-item">
                        <span className="detail-label">Completed At</span>
                        <span className="detail-value">{formatBookingDateTime(viewingBooking.completedAt)}</span>
                      </div>
                    )}

                    {viewingBooking.cancelledAt && (
                      <div className="modal-detail-item">
                        <span className="detail-label">Cancelled At</span>
                        <span className="detail-value">{formatBookingDateTime(viewingBooking.cancelledAt)}</span>
                      </div>
                    )}
                  </div>
                </div>

                <div className="modal-footer">
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={() => setViewingBooking(null)}
                  >
                    Close
                  </button>

                  {viewingBooking.status === 'confirmed' && !isSessionActiveModal && (
                    <>
                      <button
                        type="button"
                        id="btn-modal-cancel-booking"
                        className="btn btn-delete-danger"
                        onClick={() => handleCancelBooking(viewingBooking.bookingId)}
                        disabled={isProcessingBookingId === viewingBooking.bookingId}
                      >
                        {isProcessingBookingId === viewingBooking.bookingId ? 'Cancelling...' : 'Cancel Booking'}
                      </button>
                      <button
                        type="button"
                        id="btn-modal-start-session"
                        className="btn btn-action-start"
                        onClick={() => handleStartSession(viewingBooking.bookingId)}
                        disabled={isProcessingBookingId === viewingBooking.bookingId}
                      >
                        {isProcessingBookingId === viewingBooking.bookingId ? 'Starting...' : 'Start Session'}
                      </button>
                    </>
                  )}

                  {viewingBooking.status === 'confirmed' && isSessionActiveModal && (
                    <button
                      type="button"
                      id="btn-modal-complete-session"
                      className="btn btn-primary"
                      onClick={() => handleCompleteBooking(viewingBooking.bookingId)}
                      disabled={isProcessingBookingId === viewingBooking.bookingId}
                    >
                      {isProcessingBookingId === viewingBooking.bookingId ? 'Completing...' : 'Complete Session'}
                    </button>
                  )}

                  {viewingBooking.status === 'pending' && (
                    <button
                      type="button"
                      className="btn btn-delete-danger"
                      onClick={() => handleCancelBooking(viewingBooking.bookingId)}
                      disabled={isProcessingBookingId === viewingBooking.bookingId}
                    >
                      {isProcessingBookingId === viewingBooking.bookingId ? 'Cancelling...' : 'Cancel Booking'}
                    </button>
                  )}
                </div>
              </div>
            </div>
          );
        })()}
        </section>
      </main>
    </div>
  );
}
