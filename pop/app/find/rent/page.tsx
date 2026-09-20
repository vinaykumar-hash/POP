'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import LandingHeader from '@/components/layout/LandingHeader';
import type { ParkingListing } from '@/types/listingModel';
import type { BookingRecord } from '@/types/bookingModel';

export default function RentPrivateParkingPage() {
  const router = useRouter();
  const { user, isAuthenticated, openAuthModal } = useAuth();

  // Listings State
  const [listings, setListings] = useState<ParkingListing[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Search & Filters State
  const [searchQuery, setSearchQuery] = useState('');
  const [vehicleFilter, setVehicleFilter] = useState<'all' | 'Car' | 'Bike'>('all');
  const [typeFilter, setTypeFilter] = useState<'all' | 'Covered' | 'Open'>('all');
  const [sortBy, setSortBy] = useState<'featured' | 'price_low' | 'price_high'>('featured');

  // Booking Modal State
  const [selectedListing, setSelectedListing] = useState<ParkingListing | null>(null);
  const [isBookingModalOpen, setIsBookingModalOpen] = useState(false);
  const [durationHours, setDurationHours] = useState(2);
  const [bookingDate, setBookingDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [bookingStartTime, setBookingStartTime] = useState('10:00');
  const [vehicleRegNumber, setVehicleRegNumber] = useState('');
  const [vehicleTypeChoice, setVehicleTypeChoice] = useState<'Car' | 'Bike'>('Car');
  const [renterName, setRenterName] = useState('');
  const [renterPhone, setRenterPhone] = useState('');
  const [activePhotoIndex, setActivePhotoIndex] = useState(0);

  // Booking Execution State
  const [isSubmittingBooking, setIsSubmittingBooking] = useState(false);
  const [bookingError, setBookingError] = useState<string | null>(null);
  const [confirmedBooking, setConfirmedBooking] = useState<BookingRecord | null>(null);

  // My Bookings Drawer State
  const [isMyBookingsOpen, setIsMyBookingsOpen] = useState(false);
  const [myBookings, setMyBookings] = useState<BookingRecord[]>([]);
  const [isLoadingMyBookings, setIsLoadingMyBookings] = useState(false);
  const [cancellingBookingId, setCancellingBookingId] = useState<string | null>(null);

  // Sync user info to booking form
  useEffect(() => {
    if (user) {
      setRenterName(user.displayName || user.email?.split('@')[0] || '');
    }
  }, [user]);

  // Fetch Public Listings
  const fetchListings = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/rent/listings');
      if (!res.ok) throw new Error('Failed to load listings');
      const data = await res.json();
      setListings(Array.isArray(data) ? data : []);
    } catch (err: any) {
      setError(err?.message || 'Error loading listings');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchListings();
  }, [fetchListings]);

  // Fetch My Bookings
  const fetchMyBookings = useCallback(async () => {
    setIsLoadingMyBookings(true);
    try {
      const token = typeof window !== 'undefined' ? localStorage.getItem('parkwise_auth_user') : null;
      const accessToken = token ? JSON.parse(token)?.accessToken : null;
      
      const res = await fetch('/api/bookings', {
        headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : {},
      });
      if (res.ok) {
        const data = await res.json();
        setMyBookings(Array.isArray(data) ? data : []);
      }
    } catch {
      // ignore
    } finally {
      setIsLoadingMyBookings(false);
    }
  }, []);

  useEffect(() => {
    if (isAuthenticated) {
      fetchMyBookings();
    }
  }, [isAuthenticated, fetchMyBookings]);

  // Filter and sort listings
  const filteredListings = useMemo(() => {
    return listings
      .filter((l) => {
        // Query search
        if (searchQuery.trim()) {
          const q = searchQuery.toLowerCase().trim();
          const matchesLocality = l.location?.locality?.toLowerCase().includes(q);
          const matchesAddress = l.location?.address?.toLowerCase().includes(q);
          const matchesCity = l.location?.city?.toLowerCase().includes(q);
          const matchesFeature = l.parkingDetails?.features?.some((f) => f.toLowerCase().includes(q));
          if (!matchesLocality && !matchesAddress && !matchesCity && !matchesFeature) {
            return false;
          }
        }
        // Vehicle type filter
        if (vehicleFilter !== 'all') {
          const vt = l.parkingDetails?.vehicleType?.toLowerCase();
          if (vt !== 'both' && vt !== vehicleFilter.toLowerCase()) {
            return false;
          }
        }
        // Parking type filter
        if (typeFilter !== 'all') {
          if (l.parkingDetails?.parkingType?.toLowerCase() !== typeFilter.toLowerCase()) {
            return false;
          }
        }
        return true;
      })
      .sort((a, b) => {
        const rateA = parseFloat(a.pricing?.hourly || '0');
        const rateB = parseFloat(b.pricing?.hourly || '0');
        if (sortBy === 'price_low') return rateA - rateB;
        if (sortBy === 'price_high') return rateB - rateA;
        return 0;
      });
  }, [listings, searchQuery, vehicleFilter, typeFilter, sortBy]);

  // Open booking modal for a specific listing
  const handleOpenBookingModal = (listing: ParkingListing) => {
    setSelectedListing(listing);
    setActivePhotoIndex(0);
    setBookingError(null);
    setConfirmedBooking(null);
    setVehicleTypeChoice(
      listing.parkingDetails?.vehicleType === 'Bike' ? 'Bike' : 'Car'
    );
    setIsBookingModalOpen(true);
  };

  // Close booking modal
  const handleCloseBookingModal = () => {
    setIsBookingModalOpen(false);
    setSelectedListing(null);
    setConfirmedBooking(null);
    setBookingError(null);
  };

  // Submit Booking
  const handleConfirmBooking = async () => {
    if (!selectedListing) return;

    if (!isAuthenticated) {
      openAuthModal();
      return;
    }

    if (!vehicleRegNumber.trim()) {
      setBookingError('Please enter your vehicle registration number (e.g. KA-01-AB-1234)');
      return;
    }

    setIsSubmittingBooking(true);
    setBookingError(null);

    const hourlyRate = parseFloat(selectedListing.pricing?.hourly || '50');
    const totalAmount = Math.round(hourlyRate * durationHours);

    // Calculate dates
    const startDateTime = new Date(`${bookingDate}T${bookingStartTime}:00`);
    const endDateTime = new Date(startDateTime.getTime() + durationHours * 3600000);

    const payload = {
      listingId: selectedListing.listingId,
      startAt: startDateTime.toISOString(),
      endAt: endDateTime.toISOString(),
      durationHours,
      vehicle: {
        type: vehicleTypeChoice,
        registrationNumber: vehicleRegNumber.trim().toUpperCase(),
      },
      pricing: {
        hourlyRate,
        totalAmount,
      },
      renterName: renterName.trim() || user?.displayName || 'Driver',
      renterPhone: renterPhone.trim() || '+91 99000 11222',
    };

    try {
      const token = typeof window !== 'undefined' ? localStorage.getItem('parkwise_auth_user') : null;
      const accessToken = token ? JSON.parse(token)?.accessToken : null;

      const res = await fetch('/api/bookings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
        },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error || 'Failed to confirm booking');
      }

      const created: BookingRecord = await res.json();
      setConfirmedBooking(created);
      fetchMyBookings();
    } catch (err: any) {
      setBookingError(err?.message || 'Error processing reservation');
    } finally {
      setIsSubmittingBooking(false);
    }
  };

  // Cancel Booking
  const handleCancelBooking = async (bookingId: string) => {
    if (!confirm('Are you sure you want to cancel this booking?')) return;

    setCancellingBookingId(bookingId);
    try {
      const token = typeof window !== 'undefined' ? localStorage.getItem('parkwise_auth_user') : null;
      const accessToken = token ? JSON.parse(token)?.accessToken : null;

      const res = await fetch(`/api/bookings/${bookingId}/cancel`, {
        method: 'POST',
        headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : {},
      });

      if (res.ok) {
        fetchMyBookings();
      }
    } catch {
      // ignore
    } finally {
      setCancellingBookingId(null);
    }
  };

  return (
    <div className="landing-page">
      <LandingHeader />

      <main className="rent-page-container">
        {/* Top Navigation Row */}
        <div className="rent-top-nav-bar">
          <button
            type="button"
            className="btn-back"
            id="btn-back-rent"
            onClick={() => router.push('/find')}
            aria-label="Back to Find Parking"
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M19 12H5" />
              <path d="m12 19-7-7 7-7" />
            </svg>
            <span>Back</span>
          </button>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <button
              type="button"
              className="btn-back"
              onClick={() => {
                if (!isAuthenticated) {
                  openAuthModal();
                } else {
                  setIsMyBookingsOpen(true);
                  fetchMyBookings();
                }
              }}
              style={{ background: isMyBookingsOpen ? '#000' : 'transparent', color: isMyBookingsOpen ? '#fff' : 'inherit' }}
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                <line x1="16" y1="2" x2="16" y2="6" />
                <line x1="8" y1="2" x2="8" y2="6" />
                <line x1="3" y1="10" x2="21" y2="10" />
              </svg>
              <span>My Bookings {myBookings.length > 0 ? `(${myBookings.length})` : ''}</span>
            </button>

            <Link href="/list" className="btn-back" style={{ textDecoration: 'none' }}>
              List Your Space
            </Link>
          </div>
        </div>

        {/* Hero Header */}
        <div className="rent-hero-section">
          <span className="step-badge" style={{ alignSelf: 'flex-start' }}>
            POP Verified Spaces
          </span>
          <h1 className="rent-hero-title">Rent Private Parking in Bengaluru</h1>
          <p className="rent-hero-subtitle">
            Reserve gated driveways, residential covered slots, and private commercial bays across Bengaluru with verified host security.
          </p>
        </div>

        {/* Search & Filter Controls */}
        <div className="rent-controls-bar">
          {/* Search Input */}
          <div className="rent-search-wrapper">
            <svg
              className="rent-search-icon"
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
            <input
              type="text"
              className="rent-search-input"
              placeholder="Search by neighborhood, street, or landmark (e.g. Indiranagar, Koramangala, Whitefield)..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>

          {/* Filter Chips */}
          <div className="rent-filter-chips">
            <span className="rent-filter-label">Vehicle:</span>
            <button
              type="button"
              className={`rent-chip ${vehicleFilter === 'all' ? 'active' : ''}`}
              onClick={() => setVehicleFilter('all')}
            >
              All
            </button>
            <button
              type="button"
              className={`rent-chip ${vehicleFilter === 'Car' ? 'active' : ''}`}
              onClick={() => setVehicleFilter('Car')}
            >
              Cars Only
            </button>
            <button
              type="button"
              className={`rent-chip ${vehicleFilter === 'Bike' ? 'active' : ''}`}
              onClick={() => setVehicleFilter('Bike')}
            >
              Two-Wheelers
            </button>

            <span className="rent-filter-label" style={{ marginLeft: '0.75rem' }}>Type:</span>
            <button
              type="button"
              className={`rent-chip ${typeFilter === 'all' ? 'active' : ''}`}
              onClick={() => setTypeFilter('all')}
            >
              All Types
            </button>
            <button
              type="button"
              className={`rent-chip ${typeFilter === 'Covered' ? 'active' : ''}`}
              onClick={() => setTypeFilter('Covered')}
            >
              Covered
            </button>
            <button
              type="button"
              className={`rent-chip ${typeFilter === 'Open' ? 'active' : ''}`}
              onClick={() => setTypeFilter('Open')}
            >
              Open Air
            </button>

            <span className="rent-filter-label" style={{ marginLeft: '0.75rem' }}>Sort:</span>
            <button
              type="button"
              className={`rent-chip ${sortBy === 'featured' ? 'active' : ''}`}
              onClick={() => setSortBy('featured')}
            >
              Featured
            </button>
            <button
              type="button"
              className={`rent-chip ${sortBy === 'price_low' ? 'active' : ''}`}
              onClick={() => setSortBy('price_low')}
            >
              Price: Low to High
            </button>
          </div>
        </div>

        {/* Listings Grid or Loading / Empty States */}
        {isLoading ? (
          <div style={{ textAlign: 'center', padding: '4rem 0' }}>
            <div className="loading-spinner" style={{ margin: '0 auto 1rem' }} />
            <p style={{ color: 'var(--color-text-secondary)', fontWeight: 500 }}>
              Finding available private spaces in Bengaluru...
            </p>
          </div>
        ) : error ? (
          <div className="status-banner" style={{ textAlign: 'center', padding: '2rem' }}>
            <p style={{ color: '#b91c1c', fontWeight: 600 }}>{error}</p>
            <button
              type="button"
              className="btn btn-primary"
              style={{ marginTop: '1rem', alignSelf: 'center' }}
              onClick={fetchListings}
            >
              Retry
            </button>
          </div>
        ) : filteredListings.length === 0 ? (
          <div
            style={{
              textAlign: 'center',
              padding: '4rem 1.5rem',
              background: 'var(--color-surface)',
              border: '1px solid var(--color-border)',
              borderRadius: 'var(--radius-md)',
            }}
          >
            <p style={{ fontSize: '1.2rem', fontWeight: 700, color: 'var(--color-text-primary)' }}>
              No parking spaces found matching your search
            </p>
            <p style={{ color: 'var(--color-text-secondary)', marginTop: '0.5rem', fontSize: '0.95rem' }}>
              Try clearing filters or search for another neighborhood like Indiranagar, Koramangala, or Whitefield.
            </p>
            <button
              type="button"
              className="btn btn-secondary"
              style={{ marginTop: '1.25rem' }}
              onClick={() => {
                setSearchQuery('');
                setVehicleFilter('all');
                setTypeFilter('all');
              }}
            >
              Reset Filters
            </button>
          </div>
        ) : (
          <div className="rent-grid" role="region" aria-label="Available private parking spaces">
            {filteredListings.map((listing) => {
              const hourly = listing.pricing?.hourly || '50';
              const daily = listing.pricing?.daily;
              const photo =
                listing.photos?.[0]?.previewUrl ||
                'https://images.unsplash.com/photo-1590674899484-d5640e854abe?w=800&auto=format&fit=crop&q=80';
              const locality = listing.location?.locality || listing.location?.city || 'Bengaluru';
              const title =
                listing.parkingDetails?.instructions
                  ? `${listing.parkingDetails.parkingType} Parking Slot in ${locality}`
                  : `Secure Parking Spot in ${locality}`;

              return (
                <article key={listing.listingId || Math.random()} className="rent-card">
                  {/* Photo Preview */}
                  <div className="rent-card-image-wrap">
                    <img
                      src={photo}
                      alt={`Parking at ${locality}`}
                      className="rent-card-img"
                      loading="lazy"
                    />
                    <div className="rent-card-badges">
                      <span className="rent-verified-pill">
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                          <polyline points="20 6 9 17 4 12" />
                        </svg>
                        Verified
                      </span>
                      {listing.photos && listing.photos.length > 1 && (
                        <span className="rent-photo-badge">
                          1/{listing.photos.length}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Card Body */}
                  <div className="rent-card-body">
                    <span className="rent-card-locality">{locality}</span>
                    <h2 className="rent-card-title">{title}</h2>
                    <p className="rent-card-address">{listing.location?.address}</p>

                    {/* Tags */}
                    <div className="rent-card-tags">
                      <span className="rent-tag">{listing.parkingDetails?.parkingType}</span>
                      <span className="rent-tag">For {listing.parkingDetails?.vehicleType}s</span>
                      {listing.parkingDetails?.features?.slice(0, 2).map((feat, idx) => (
                        <span key={idx} className="rent-tag">
                          {feat}
                        </span>
                      ))}
                    </div>
                  </div>

                  {/* Card Footer */}
                  <div className="rent-card-footer">
                    <div className="rent-price-wrap">
                      <span className="rent-price-amt">₹{hourly}</span>
                      <span className="rent-price-unit">per hour {daily ? `• ₹${daily}/day` : ''}</span>
                    </div>

                    <div className="rent-card-actions">
                      <button
                        type="button"
                        className="btn-rent-details"
                        onClick={() => handleOpenBookingModal(listing)}
                      >
                        Details
                      </button>
                      <button
                        type="button"
                        className="btn-rent-book"
                        onClick={() => handleOpenBookingModal(listing)}
                      >
                        Rent Now
                      </button>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </main>

      {/* =========================================================================
          Interactive Booking & Detail Modal
          ========================================================================= */}
      {isBookingModalOpen && selectedListing && (
        <div className="booking-modal-overlay" role="dialog" aria-modal="true">
          <div className="booking-modal-card">
            {/* Modal Header */}
            <div className="booking-modal-header">
              <div>
                <h3 style={{ fontSize: '1.2rem', fontWeight: 700, margin: 0 }}>
                  {confirmedBooking ? 'Reservation Confirmed' : 'Reserve Parking Slot'}
                </h3>
                <p style={{ fontSize: '0.85rem', color: 'var(--color-text-secondary)', margin: '2px 0 0' }}>
                  {selectedListing.location?.locality}, Bengaluru
                </p>
              </div>
              <button
                type="button"
                className="booking-modal-close"
                onClick={handleCloseBookingModal}
                aria-label="Close modal"
              >
                &times;
              </button>
            </div>

            {/* Modal Body */}
            <div className="booking-modal-body">
              {confirmedBooking ? (
                /* Confirmed Booking Pass Screen */
                <div className="booking-pass-card">
                  <div className="pass-success-badge">
                    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                  </div>

                  <h4 style={{ fontSize: '1.4rem', fontWeight: 800, margin: 0 }}>
                    Parking Confirmed!
                  </h4>
                  <p style={{ color: 'var(--color-text-secondary)', fontSize: '0.9rem', margin: 0 }}>
                    Your spot is reserved. Show this pass to security or gate guard upon arrival.
                  </p>

                  <div className="pass-ref-code">
                    REF: {confirmedBooking.bookingId}
                  </div>

                  <div className="pass-info-grid">
                    <div className="pass-info-item">
                      <span className="pass-label">Location</span>
                      <span className="pass-value">{selectedListing.location?.address}</span>
                    </div>
                    <div className="pass-info-item">
                      <span className="pass-label">Gate Pass Code</span>
                      <span className="pass-value" style={{ fontFamily: 'monospace', fontSize: '1.05rem', color: '#047857' }}>
                        {confirmedBooking.access?.gatePassCode || 'POP-4821'}
                      </span>
                    </div>
                    <div className="pass-info-item">
                      <span className="pass-label">Reserved For</span>
                      <span className="pass-value">{confirmedBooking.vehicle?.registrationNumber}</span>
                    </div>
                    <div className="pass-info-item">
                      <span className="pass-label">Total Paid</span>
                      <span className="pass-value">₹{confirmedBooking.pricing?.totalAmount}</span>
                    </div>
                  </div>

                  <div className="pass-access-note">
                    <strong>Access Note:</strong> {confirmedBooking.access?.instructions || selectedListing.parkingDetails?.instructions}
                  </div>

                  <div className="pass-actions-row">
                    <a
                      href={`https://www.google.com/maps/dir/?api=1&destination=${selectedListing.location?.latitude || 12.9716},${selectedListing.location?.longitude || 77.5946}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="btn btn-primary"
                      style={{ flex: 1, textDecoration: 'none', textAlign: 'center' }}
                    >
                      Get Directions
                    </a>
                    <button
                      type="button"
                      className="btn btn-secondary"
                      style={{ flex: 1 }}
                      onClick={() => {
                        handleCloseBookingModal();
                        setIsMyBookingsOpen(true);
                      }}
                    >
                      View in My Bookings
                    </button>
                  </div>
                </div>
              ) : (
                /* Reservation Form & Listing Details */
                <>
                  {/* Photo Gallery Carousel */}
                  <div className="booking-gallery">
                    <img
                      src={
                        selectedListing.photos?.[activePhotoIndex]?.previewUrl ||
                        selectedListing.photos?.[0]?.previewUrl ||
                        'https://images.unsplash.com/photo-1590674899484-d5640e854abe?w=800&auto=format&fit=crop&q=80'
                      }
                      alt="Parking photo"
                    />
                    {selectedListing.photos && selectedListing.photos.length > 1 && (
                      <div
                        style={{
                          position: 'absolute',
                          bottom: 10,
                          right: 10,
                          display: 'flex',
                          gap: '6px',
                          background: 'rgba(0,0,0,0.6)',
                          padding: '4px 8px',
                          borderRadius: '20px',
                        }}
                      >
                        {selectedListing.photos.map((_, idx) => (
                          <button
                            key={idx}
                            type="button"
                            onClick={() => setActivePhotoIndex(idx)}
                            style={{
                              width: '8px',
                              height: '8px',
                              borderRadius: '50%',
                              background: activePhotoIndex === idx ? '#fff' : '#888',
                              border: 'none',
                              padding: 0,
                              cursor: 'pointer',
                            }}
                          />
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Amenities / Features */}
                  <div>
                    <h4 style={{ fontSize: '0.95rem', fontWeight: 700, marginBottom: '0.4rem' }}>
                      Spot Details & Amenities
                    </h4>
                    <div className="rent-card-tags">
                      <span className="rent-tag">{selectedListing.parkingDetails?.parkingType} Structure</span>
                      <span className="rent-tag">Capacity: {selectedListing.parkingDetails?.capacity} Vehicles</span>
                      {selectedListing.parkingDetails?.features?.map((f, i) => (
                        <span key={i} className="rent-tag">
                          ✓ {f}
                        </span>
                      ))}
                    </div>
                  </div>

                  {/* Reservation Controls */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    <h4 style={{ fontSize: '0.95rem', fontWeight: 700, margin: 0 }}>
                      Choose Reservation Time
                    </h4>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.85rem' }}>
                      <div>
                        <label className="form-label" style={{ fontSize: '0.8rem' }}>Date</label>
                        <input
                          type="date"
                          className="form-input"
                          value={bookingDate}
                          min={new Date().toISOString().split('T')[0]}
                          onChange={(e) => setBookingDate(e.target.value)}
                        />
                      </div>
                      <div>
                        <label className="form-label" style={{ fontSize: '0.8rem' }}>Start Time</label>
                        <input
                          type="time"
                          className="form-input"
                          value={bookingStartTime}
                          onChange={(e) => setBookingStartTime(e.target.value)}
                        />
                      </div>
                    </div>

                    {/* Duration Stepper */}
                    <div>
                      <label className="form-label" style={{ fontSize: '0.8rem' }}>Duration</label>
                      <div className="duration-selector">
                        {[1, 2, 4, 8].map((h) => (
                          <button
                            key={h}
                            type="button"
                            className={`duration-btn ${durationHours === h ? 'active' : ''}`}
                            onClick={() => setDurationHours(h)}
                          >
                            {h} {h === 1 ? 'Hour' : 'Hours'}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Vehicle Details */}
                    <div>
                      <label className="form-label" style={{ fontSize: '0.8rem' }}>
                        Vehicle Registration Number <span style={{ color: '#b91c1c' }}>*</span>
                      </label>
                      <input
                        type="text"
                        className="form-input"
                        placeholder="e.g. KA-01-MJ-5820"
                        value={vehicleRegNumber}
                        onChange={(e) => setVehicleRegNumber(e.target.value)}
                        style={{ textTransform: 'uppercase', fontFamily: 'monospace', fontWeight: 600 }}
                      />
                    </div>

                    {/* Price Breakdown */}
                    <div className="price-breakdown-box">
                      <div className="price-row">
                        <span>Rate (₹{selectedListing.pricing?.hourly || '50'} × {durationHours} hrs)</span>
                        <span>₹{parseFloat(selectedListing.pricing?.hourly || '50') * durationHours}</span>
                      </div>
                      <div className="price-row">
                        <span>POP Service Fee</span>
                        <span style={{ color: '#047857', fontWeight: 600 }}>FREE (Launch Promo)</span>
                      </div>
                      <div className="price-row total">
                        <span>Total Due</span>
                        <span>₹{parseFloat(selectedListing.pricing?.hourly || '50') * durationHours}</span>
                      </div>
                    </div>

                    {/* Error message */}
                    {bookingError && (
                      <p style={{ color: '#b91c1c', fontSize: '0.85rem', fontWeight: 500, margin: 0 }}>
                        {bookingError}
                      </p>
                    )}

                    {/* Booking Action */}
                    <button
                      type="button"
                      className="btn btn-primary btn-large"
                      style={{ width: '100%', marginTop: '0.5rem' }}
                      disabled={isSubmittingBooking}
                      onClick={handleConfirmBooking}
                    >
                      {isSubmittingBooking ? (
                        'Confirming Reservation...'
                      ) : !isAuthenticated ? (
                        'Sign In to Confirm Booking'
                      ) : (
                        `Confirm & Reserve (₹${parseFloat(selectedListing.pricing?.hourly || '50') * durationHours})`
                      )}
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          My Bookings Drawer / Modal
          ========================================================================= */}
      {isMyBookingsOpen && (
        <div className="booking-modal-overlay" role="dialog" aria-modal="true">
          <div className="booking-modal-card" style={{ maxWidth: '580px' }}>
            <div className="booking-modal-header">
              <div>
                <h3 style={{ fontSize: '1.2rem', fontWeight: 700, margin: 0 }}>
                  My Parking Reservations
                </h3>
                <p style={{ fontSize: '0.85rem', color: 'var(--color-text-secondary)', margin: '2px 0 0' }}>
                  Active and past parking bookings
                </p>
              </div>
              <button
                type="button"
                className="booking-modal-close"
                onClick={() => setIsMyBookingsOpen(false)}
                aria-label="Close"
              >
                &times;
              </button>
            </div>

            <div className="booking-modal-body">
              {isLoadingMyBookings ? (
                <div style={{ textAlign: 'center', padding: '2rem 0' }}>
                  <div className="loading-spinner" style={{ margin: '0 auto 0.75rem' }} />
                  <p style={{ color: 'var(--color-text-secondary)', fontSize: '0.9rem' }}>
                    Loading your bookings...
                  </p>
                </div>
              ) : myBookings.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '2.5rem 1rem' }}>
                  <p style={{ fontWeight: 700, fontSize: '1.05rem', color: 'var(--color-text-primary)' }}>
                    No bookings yet
                  </p>
                  <p style={{ color: 'var(--color-text-secondary)', fontSize: '0.85rem', marginTop: '0.35rem' }}>
                    Browse available private slots above and reserve your first parking space.
                  </p>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  {myBookings.map((b) => (
                    <div
                      key={b.bookingId}
                      style={{
                        background: 'var(--color-surface-subtle)',
                        border: '1px solid var(--color-border)',
                        borderRadius: 'var(--radius-sm)',
                        padding: '1.1rem',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '0.6rem',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
                        <div>
                          <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#2563eb' }}>
                            {b.bookingId}
                          </span>
                          <h4 style={{ fontSize: '1rem', fontWeight: 700, margin: '2px 0 0' }}>
                            {b.listingSummary?.locality || 'Bengaluru Parking'}
                          </h4>
                        </div>
                        <span
                          className={`status-pill ${
                            b.status === 'confirmed'
                              ? 'status-pending-review'
                              : b.status === 'completed'
                              ? 'status-pending'
                              : ''
                          }`}
                          style={{
                            background: b.status === 'confirmed' ? '#047857' : undefined,
                            color: b.status === 'confirmed' ? '#fff' : undefined,
                          }}
                        >
                          {b.status}
                        </span>
                      </div>

                      <p style={{ fontSize: '0.85rem', color: 'var(--color-text-secondary)', margin: 0 }}>
                        {b.listingSummary?.address}
                      </p>

                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          fontSize: '0.8rem',
                          color: 'var(--color-text-secondary)',
                          borderTop: '1px solid var(--color-border)',
                          paddingTop: '0.5rem',
                          marginTop: '0.2rem',
                        }}
                      >
                        <span>Vehicle: <strong>{b.vehicle?.registrationNumber || 'N/A'}</strong></span>
                        <span>Amount: <strong>₹{b.pricing?.totalAmount}</strong></span>
                      </div>

                      {b.status === 'confirmed' && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.35rem' }}>
                          <button
                            type="button"
                            className="btn-back"
                            style={{ fontSize: '0.75rem', padding: '0.35rem 0.75rem', color: '#b91c1c', borderColor: '#fca5a5' }}
                            disabled={cancellingBookingId === b.bookingId}
                            onClick={() => handleCancelBooking(b.bookingId)}
                          >
                            {cancellingBookingId === b.bookingId ? 'Cancelling...' : 'Cancel Reservation'}
                          </button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
