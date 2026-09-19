'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';
import { hostApiClient } from '@/services/host/apiClient';
import type { ParkingListing } from '@/types/listingModel';

export default function AdminListingsPage() {
  const { user, isAuthenticated, isLoading: authLoading, role, openAuthModal } = useAuth();

  const [listings, setListings] = useState<ParkingListing[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);

  // Reject modal
  const [rejectingListing, setRejectingListing] = useState<ParkingListing | null>(null);
  const [rejectionReason, setRejectionReason] = useState('');

  const fetchPending = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await hostApiClient.getAdminPendingListings('pending_review') as ParkingListing[];
      setListings(data || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      openAuthModal('ADMIN');
    }
  }, [authLoading, isAuthenticated, openAuthModal]);

  useEffect(() => {
    if (isAuthenticated) {
      fetchPending();
    }
  }, [isAuthenticated, fetchPending]);

  const handleApprove = async (listingId: string) => {
    if (!window.confirm('Approve this listing?')) return;
    setIsProcessing(true);
    setActionSuccess(null);
    try {
      await hostApiClient.approveListing(listingId);
      setListings((prev) => prev.filter((l) => l.listingId !== listingId));
      setActionSuccess(`Listing approved.`);
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleReject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!rejectingListing?.listingId) return;
    const trimmed = rejectionReason.trim();
    if (!trimmed) { alert('Please provide a reason.'); return; }

    setIsProcessing(true);
    try {
      await hostApiClient.rejectListing(rejectingListing.listingId, trimmed);
      setListings((prev) => prev.filter((l) => l.listingId !== rejectingListing.listingId));
      setActionSuccess('Listing rejected.');
      setRejectingListing(null);
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed');
    } finally {
      setIsProcessing(false);
    }
  };

  if (authLoading) {
    return <div className="landing-page"><div className="landing-main" style={{ justifyContent: 'center', alignItems: 'center' }}><div className="loading-spinner" /></div></div>;
  }

  if (!isAuthenticated) {
    return (
      <div className="landing-page">
        <header className="landing-header">
          <Link href="/" className="landing-brand"><span className="landing-brand-badge">P</span><span className="landing-brand-text"><span>POP</span><span className="landing-brand-sub">Parking on phone</span></span></Link>
        </header>
        <main className="landing-main">
          <div className="placeholder-content">
            <h1 className="landing-title" style={{ fontSize: '1.5rem' }}>Admin Access Required</h1>
            <button className="action-card-btn" onClick={() => openAuthModal('ADMIN')} style={{ cursor: 'pointer', border: 'none' }}>Sign In as Admin</button>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="landing-page">
      <header className="landing-header">
        <Link href="/" className="landing-brand"><span className="landing-brand-badge">P</span><span className="landing-brand-text"><span>POP</span><span className="landing-brand-sub">Parking on phone</span></span></Link>
        <span style={{ fontSize: '11px', fontWeight: 700, padding: '3px 10px', borderRadius: '9999px', background: '#dbeafe', color: '#1e40af' }}>Admin</span>
      </header>

      <main className="dashboard-main">
        <div className="dashboard-header">
          <div>
            <h1 style={{ fontSize: '1.5rem', fontWeight: 700, margin: 0, color: 'var(--pw-text)' }}>Listing Review</h1>
            <p style={{ fontSize: '0.875rem', color: 'var(--pw-text-secondary)', margin: '4px 0 0' }}>
              {listings.length} listing{listings.length !== 1 ? 's' : ''} pending review
            </p>
          </div>
          <button onClick={fetchPending} className="btn-action" disabled={isLoading}>Refresh</button>
        </div>

        {actionSuccess && (
          <div style={{ padding: '10px 16px', background: '#d1fae5', borderRadius: '8px', fontSize: '0.85rem', color: '#065f46', marginBottom: '16px' }}>
            {actionSuccess}
          </div>
        )}

        {isLoading ? (
          <div style={{ textAlign: 'center', padding: '48px 0' }}><div className="loading-spinner" /></div>
        ) : error ? (
          <div className="dashboard-error"><p>{error}</p></div>
        ) : listings.length === 0 ? (
          <div className="dashboard-empty">
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="var(--pw-text-tertiary)" strokeWidth="1.5"><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11"/></svg>
            <h3 style={{ fontSize: '1.1rem', fontWeight: 600, margin: '16px 0 6px' }}>All caught up</h3>
            <p style={{ color: 'var(--pw-text-secondary)', fontSize: '0.875rem' }}>No listings pending review.</p>
          </div>
        ) : (
          <div className="listings-grid">
            {listings.map((listing) => (
              <div key={listing.listingId} className="listing-card">
                <div className="listing-card-header">
                  <h3 style={{ fontSize: '0.95rem', fontWeight: 600, margin: 0, color: 'var(--pw-text)' }}>
                    {listing.location?.locality || 'Untitled'}
                  </h3>
                  <span style={{ fontSize: '0.75rem', color: 'var(--pw-text-secondary)' }}>
                    Host: {listing.host?.name || listing.hostId}
                  </span>
                </div>
                <div className="listing-card-details">
                  <span>{listing.parkingDetails?.vehicleType}</span>
                  <span>&bull;</span>
                  <span>{listing.parkingDetails?.parkingType}</span>
                  <span>&bull;</span>
                  <span>{listing.location?.city || 'Bengaluru'}</span>
                </div>
                {listing.pricing?.hourly && (
                  <div style={{ fontSize: '0.85rem', color: 'var(--pw-text)' }}>
                    <strong>₹{listing.pricing.hourly}</strong>/hr
                  </div>
                )}
                <div className="listing-card-actions">
                  <button className="btn-action btn-action-primary" onClick={() => listing.listingId && handleApprove(listing.listingId)} disabled={isProcessing}>
                    Approve
                  </button>
                  <button className="btn-action btn-action-danger" onClick={() => setRejectingListing(listing)} disabled={isProcessing}>
                    Reject
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      {/* Reject Modal */}
      {rejectingListing && (
        <div className="modal-overlay" onClick={() => setRejectingListing(null)}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()}>
            <h2 style={{ fontSize: '1.1rem', fontWeight: 700, margin: '0 0 12px', color: 'var(--pw-text)' }}>Reject Listing</h2>
            <form onSubmit={handleReject}>
              <div className="form-group">
                <label className="form-label">Rejection Reason</label>
                <textarea
                  className="form-input"
                  rows={4}
                  value={rejectionReason}
                  onChange={(e) => setRejectionReason(e.target.value)}
                  placeholder="Provide a clear reason for rejecting this listing..."
                  required
                />
              </div>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button type="submit" className="btn-action btn-action-danger" disabled={isProcessing} style={{ flex: 1 }}>
                  {isProcessing ? 'Rejecting...' : 'Confirm Reject'}
                </button>
                <button type="button" className="btn-action" onClick={() => setRejectingListing(null)} style={{ flex: 1 }}>Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
