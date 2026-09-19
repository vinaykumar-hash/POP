'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { hostApiClient } from '@/services/host/apiClient';
import { AVAILABLE_FEATURES } from '@/types/listingModel';
import type { ParkingListing } from '@/types/listingModel';

export default function HostDashboardPage() {
  const router = useRouter();
  const { user, isAuthenticated, isLoading: authLoading, openAuthModal, role } = useAuth();

  const [activeTab, setActiveTab] = useState<'listings' | 'bookings'>('listings');
  const [listings, setListings] = useState<ParkingListing[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Bookings state
  const [bookings, setBookings] = useState<Record<string, unknown>[]>([]);
  const [isLoadingBookings, setIsLoadingBookings] = useState(false);

  // Edit modal
  const [editingListing, setEditingListing] = useState<ParkingListing | null>(null);
  const [editFormData, setEditFormData] = useState({ hourly: '', daily: '', instructions: '', features: [] as string[] });
  const [isSavingEdit, setIsSavingEdit] = useState(false);

  // Delete confirm
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      openAuthModal('HOST');
    }
  }, [authLoading, isAuthenticated, openAuthModal]);

  const fetchListings = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await hostApiClient.getHostListings() as ParkingListing[];
      setListings(data || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load listings');
    } finally {
      setIsLoading(false);
    }
  }, []);

  const fetchBookings = useCallback(async () => {
    setIsLoadingBookings(true);
    try {
      const data = await hostApiClient.getHostBookings() as Record<string, unknown>[];
      setBookings(data || []);
    } catch {
      // silent
    } finally {
      setIsLoadingBookings(false);
    }
  }, []);

  useEffect(() => {
    if (isAuthenticated) {
      fetchListings();
    }
  }, [isAuthenticated, fetchListings]);

  useEffect(() => {
    if (isAuthenticated && activeTab === 'bookings') {
      fetchBookings();
    }
  }, [isAuthenticated, activeTab, fetchBookings]);

  const handleDeleteListing = async () => {
    if (!deletingId) return;
    setIsDeleting(true);
    try {
      await hostApiClient.deleteListing(deletingId);
      setListings((prev) => prev.filter((l) => l.listingId !== deletingId));
      setDeletingId(null);
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Delete failed');
    } finally {
      setIsDeleting(false);
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

  const handleSaveEdit = async () => {
    if (!editingListing?.listingId) return;
    setIsSavingEdit(true);
    try {
      const updated = await hostApiClient.updateListing(editingListing.listingId, {
        pricing: { hourly: editFormData.hourly, daily: editFormData.daily },
        parkingDetails: {
          ...editingListing.parkingDetails,
          instructions: editFormData.instructions,
          features: editFormData.features,
        },
      }) as ParkingListing;
      setListings((prev) => prev.map((l) => (l.listingId === editingListing.listingId ? updated : l)));
      setEditingListing(null);
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Save failed');
    } finally {
      setIsSavingEdit(false);
    }
  };

  const handleResubmit = async (listingId: string) => {
    try {
      const updated = await hostApiClient.resubmitListing(listingId) as ParkingListing;
      setListings((prev) => prev.map((l) => (l.listingId === listingId ? updated : l)));
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Resubmit failed');
    }
  };

  const getStatusBadge = (status: string) => {
    const styles: Record<string, { bg: string; color: string; label: string }> = {
      pending_review: { bg: '#fef3c7', color: '#92400e', label: 'Pending Review' },
      approved: { bg: '#d1fae5', color: '#065f46', label: 'Approved' },
      rejected: { bg: '#fee2e2', color: '#991b1b', label: 'Rejected' },
      draft: { bg: '#f3f4f6', color: '#374151', label: 'Draft' },
      suspended: { bg: '#fecaca', color: '#7f1d1d', label: 'Suspended' },
    };
    const s = styles[status] || styles.draft;
    return (
      <span style={{ padding: '3px 10px', borderRadius: '9999px', fontSize: '11px', fontWeight: 700, background: s.bg, color: s.color }}>
        {s.label}
      </span>
    );
  };

  if (authLoading) {
    return (
      <div className="landing-page">
        <div className="landing-main" style={{ justifyContent: 'center', alignItems: 'center' }}>
          <div className="loading-spinner" />
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="landing-page">
        <header className="landing-header">
          <Link href="/" className="landing-brand">
            <span className="landing-brand-badge">P</span>
            <span className="landing-brand-text"><span>POP</span><span className="landing-brand-sub">Parking on phone</span></span>
          </Link>
        </header>
        <main className="landing-main">
          <div className="placeholder-content">
            <h1 className="landing-title" style={{ fontSize: '1.5rem' }}>Sign in required</h1>
            <p className="landing-subtitle">Please sign in to manage your listings.</p>
            <button className="action-card-btn" onClick={() => openAuthModal('HOST')} style={{ cursor: 'pointer', border: 'none' }}>
              Sign In as Host
            </button>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="landing-page">
      <header className="landing-header">
        <Link href="/" className="landing-brand">
          <span className="landing-brand-badge">P</span>
          <span className="landing-brand-text"><span>POP</span><span className="landing-brand-sub">Parking on phone</span></span>
        </Link>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--pw-text-secondary)' }}>
            {user?.displayName}
          </span>
          <span style={{ padding: '2px 10px', borderRadius: '9999px', fontSize: '10px', fontWeight: 700, background: '#d1fae5', color: '#065f46' }}>
            Host
          </span>
        </div>
      </header>

      <main className="dashboard-main">
        {/* Dashboard Header */}
        <div className="dashboard-header">
          <div>
            <h1 style={{ fontSize: '1.5rem', fontWeight: 700, margin: 0, color: 'var(--pw-text)' }}>
              Host Dashboard
            </h1>
            <p style={{ fontSize: '0.875rem', color: 'var(--pw-text-secondary)', margin: '4px 0 0' }}>
              Manage your parking listings and bookings
            </p>
          </div>
          <Link href="/host/new" className="action-card-btn" style={{ textDecoration: 'none', fontSize: '13px' }}>
            + New Listing
          </Link>
        </div>

        {/* Tabs */}
        <div className="dashboard-tabs">
          <button
            className={`dashboard-tab ${activeTab === 'listings' ? 'active' : ''}`}
            onClick={() => setActiveTab('listings')}
          >
            Listings ({listings.length})
          </button>
          <button
            className={`dashboard-tab ${activeTab === 'bookings' ? 'active' : ''}`}
            onClick={() => setActiveTab('bookings')}
          >
            Bookings ({bookings.length})
          </button>
        </div>

        {/* Listings Tab */}
        {activeTab === 'listings' && (
          <div className="dashboard-content">
            {isLoading ? (
              <div style={{ textAlign: 'center', padding: '48px 0' }}>
                <div className="loading-spinner" />
                <p style={{ color: 'var(--pw-text-secondary)', marginTop: '12px' }}>Loading listings...</p>
              </div>
            ) : error ? (
              <div className="dashboard-error">
                <p>{error}</p>
                <button onClick={fetchListings} className="action-card-btn" style={{ cursor: 'pointer', border: 'none' }}>Retry</button>
              </div>
            ) : listings.length === 0 ? (
              <div className="dashboard-empty">
                <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="var(--pw-text-tertiary)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="3" width="18" height="18" rx="2"/>
                  <path d="M12 8v8"/>
                  <path d="M8 12h8"/>
                </svg>
                <h3 style={{ fontSize: '1.1rem', fontWeight: 600, margin: '16px 0 6px', color: 'var(--pw-text)' }}>
                  No listings yet
                </h3>
                <p style={{ color: 'var(--pw-text-secondary)', fontSize: '0.875rem', marginBottom: '16px' }}>
                  Create your first parking listing to start earning.
                </p>
                <Link href="/host/new" className="action-card-btn" style={{ textDecoration: 'none' }}>Create Listing</Link>
              </div>
            ) : (
              <div className="listings-grid">
                {listings.map((listing) => (
                  <div key={listing.listingId} className="listing-card">
                    <div className="listing-card-header">
                      <div>
                        <h3 style={{ fontSize: '0.95rem', fontWeight: 600, margin: 0, color: 'var(--pw-text)' }}>
                          {listing.location?.locality || listing.location?.address || 'Untitled Listing'}
                        </h3>
                        <p style={{ fontSize: '0.8rem', color: 'var(--pw-text-secondary)', margin: '2px 0 0' }}>
                          {listing.location?.city || 'Bengaluru'}
                        </p>
                      </div>
                      {getStatusBadge(listing.status)}
                    </div>

                    <div className="listing-card-details">
                      <span>{listing.parkingDetails?.vehicleType || 'Car'}</span>
                      <span>&bull;</span>
                      <span>{listing.parkingDetails?.parkingType || 'Covered'}</span>
                      <span>&bull;</span>
                      <span>{listing.parkingDetails?.capacity || 1} spot{(listing.parkingDetails?.capacity || 1) > 1 ? 's' : ''}</span>
                    </div>

                    {listing.pricing?.hourly && (
                      <div style={{ fontSize: '0.85rem', color: 'var(--pw-text)' }}>
                        <strong>₹{listing.pricing.hourly}</strong>/hr
                        {listing.pricing.daily && <span> &bull; <strong>₹{listing.pricing.daily}</strong>/day</span>}
                      </div>
                    )}

                    {listing.status === 'rejected' && listing.rejectionReason && (
                      <div style={{ padding: '8px 12px', background: '#fee2e2', borderRadius: '8px', fontSize: '0.8rem', color: '#991b1b', marginTop: '8px' }}>
                        Reason: {listing.rejectionReason}
                      </div>
                    )}

                    <div className="listing-card-actions">
                      <button className="btn-action" onClick={() => handleOpenEdit(listing)}>Edit</button>
                      {listing.status === 'rejected' && (
                        <button className="btn-action btn-action-primary" onClick={() => listing.listingId && handleResubmit(listing.listingId)}>
                          Resubmit
                        </button>
                      )}
                      <button className="btn-action btn-action-danger" onClick={() => setDeletingId(listing.listingId)}>Delete</button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Bookings Tab */}
        {activeTab === 'bookings' && (
          <div className="dashboard-content">
            {isLoadingBookings ? (
              <div style={{ textAlign: 'center', padding: '48px 0' }}>
                <div className="loading-spinner" />
              </div>
            ) : bookings.length === 0 ? (
              <div className="dashboard-empty">
                <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="var(--pw-text-tertiary)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
                  <line x1="16" y1="2" x2="16" y2="6"/>
                  <line x1="8" y1="2" x2="8" y2="6"/>
                  <line x1="3" y1="10" x2="21" y2="10"/>
                </svg>
                <h3 style={{ fontSize: '1.1rem', fontWeight: 600, margin: '16px 0 6px', color: 'var(--pw-text)' }}>
                  No bookings yet
                </h3>
                <p style={{ color: 'var(--pw-text-secondary)', fontSize: '0.875rem' }}>
                  When drivers book your parking space, bookings will appear here.
                </p>
              </div>
            ) : (
              <div className="listings-grid">
                {bookings.map((booking, i) => (
                  <div key={i} className="listing-card">
                    <p style={{ color: 'var(--pw-text-secondary)', fontSize: '0.85rem' }}>
                      Booking #{(booking.bookingId as string) || i + 1}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </main>

      {/* Edit Modal */}
      {editingListing && (
        <div className="modal-overlay" onClick={() => setEditingListing(null)}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()}>
            <h2 style={{ fontSize: '1.1rem', fontWeight: 700, margin: '0 0 16px', color: 'var(--pw-text)' }}>Edit Listing</h2>

            <div className="form-group">
              <label className="form-label">Hourly Rate (₹)</label>
              <input
                className="form-input"
                type="number"
                value={editFormData.hourly}
                onChange={(e) => setEditFormData((p) => ({ ...p, hourly: e.target.value }))}
              />
            </div>

            <div className="form-group">
              <label className="form-label">Daily Rate (₹)</label>
              <input
                className="form-input"
                type="number"
                value={editFormData.daily}
                onChange={(e) => setEditFormData((p) => ({ ...p, daily: e.target.value }))}
              />
            </div>

            <div className="form-group">
              <label className="form-label">Special Instructions</label>
              <textarea
                className="form-input"
                rows={3}
                value={editFormData.instructions}
                onChange={(e) => setEditFormData((p) => ({ ...p, instructions: e.target.value }))}
              />
            </div>

            <div className="form-group">
              <label className="form-label">Features</label>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                {AVAILABLE_FEATURES.map((f) => (
                  <button
                    key={f}
                    type="button"
                    className={`feature-chip ${editFormData.features.includes(f) ? 'active' : ''}`}
                    onClick={() => {
                      setEditFormData((p) => ({
                        ...p,
                        features: p.features.includes(f)
                          ? p.features.filter((x) => x !== f)
                          : [...p.features, f],
                      }));
                    }}
                  >
                    {f}
                  </button>
                ))}
              </div>
            </div>

            <div style={{ display: 'flex', gap: '8px', marginTop: '16px' }}>
              <button className="action-card-btn" onClick={handleSaveEdit} disabled={isSavingEdit} style={{ cursor: 'pointer', border: 'none', flex: 1 }}>
                {isSavingEdit ? 'Saving...' : 'Save Changes'}
              </button>
              <button className="btn-action" onClick={() => setEditingListing(null)} style={{ flex: 1 }}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirm */}
      {deletingId && (
        <div className="modal-overlay" onClick={() => setDeletingId(null)}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()}>
            <h2 style={{ fontSize: '1.1rem', fontWeight: 700, margin: '0 0 12px', color: 'var(--pw-text)' }}>Confirm Deletion</h2>
            <p style={{ color: 'var(--pw-text-secondary)', fontSize: '0.9rem', marginBottom: '16px' }}>
              Are you sure you want to delete this listing? This action cannot be undone.
            </p>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button className="btn-action btn-action-danger" onClick={handleDeleteListing} disabled={isDeleting} style={{ flex: 1 }}>
                {isDeleting ? 'Deleting...' : 'Delete'}
              </button>
              <button className="btn-action" onClick={() => setDeletingId(null)} style={{ flex: 1 }}>Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
