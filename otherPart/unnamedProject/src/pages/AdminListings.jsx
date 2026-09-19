import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { apiClient } from '../services/apiClient';

export default function AdminListings() {
  const { user } = useAuth();
  const [listings, setListings] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [actionSuccess, setActionSuccess] = useState(null);

  // Reject Modal state
  const [rejectingListing, setRejectingListing] = useState(null);
  const [rejectionReason, setRejectionReason] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);

  const fetchPendingListings = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await apiClient.getAdminPendingListings('pending_review');
      setListings(data || []);
    } catch (err) {
      setError(err.message || 'Failed to load pending listings.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchPendingListings();
  }, []);

  const handleApprove = async (listingId) => {
    if (!window.confirm('Are you sure you want to approve this parking listing?')) return;

    setIsProcessing(true);
    setActionSuccess(null);
    try {
      await apiClient.approveListing(listingId);
      setListings((prev) => prev.filter((l) => l.listingId !== listingId));
      setActionSuccess(`Listing ${listingId} approved successfully.`);
    } catch (err) {
      alert(`Approval failed: ${err.message}`);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleOpenReject = (listing) => {
    setRejectingListing(listing);
    setRejectionReason('');
  };

  const handleConfirmReject = async (e) => {
    e.preventDefault();
    if (!rejectingListing) return;

    const trimmed = rejectionReason.trim();
    if (!trimmed) {
      alert('Please provide a reason for rejecting this listing.');
      return;
    }

    setIsProcessing(true);
    setActionSuccess(null);
    try {
      await apiClient.rejectListing(rejectingListing.listingId, trimmed);
      setListings((prev) => prev.filter((l) => l.listingId !== rejectingListing.listingId));
      setActionSuccess(`Listing ${rejectingListing.listingId} rejected.`);
      setRejectingListing(null);
    } catch (err) {
      alert(`Rejection failed: ${err.message}`);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <section className="admin-container" aria-labelledby="admin-title">
      {/* Admin Header */}
      <div className="admin-header-row">
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.5rem' }}>
            <span className="admin-badge">Admin Review</span>
            <span style={{ fontSize: '0.85rem', color: 'var(--color-text-secondary)' }}>
              Amazon Cedar Authorized
            </span>
          </div>
          <h1 id="admin-title" className="page-title" style={{ fontSize: '1.75rem', margin: 0 }}>
            Listing Verification Queue
          </h1>
          <p className="text-subtitle" style={{ margin: '0.25rem 0 0 0' }}>
            Review host submitted parking spaces. Approve or reject with feedback.
          </p>
        </div>
        <button
          type="button"
          className="btn btn-secondary"
          onClick={fetchPendingListings}
          disabled={isLoading}
        >
          Refresh Queue
        </button>
      </div>

      {/* Success Notification */}
      {actionSuccess && (
        <div className="auth-error-banner" style={{ backgroundColor: '#ecfdf5', borderColor: '#a7f3d0', color: '#065f46' }} role="status">
          <span>✓ {actionSuccess}</span>
        </div>
      )}

      {/* Error / Forbidden State */}
      {error && (
        <div className="auth-error-banner" role="alert">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
          <div>
            <strong>Access Error:</strong> {error}
          </div>
        </div>
      )}

      {/* Loading State */}
      {isLoading && (
        <div className="auth-loading-container">
          <div className="loading-spinner"></div>
          <p className="loading-text">Loading review queue...</p>
        </div>
      )}

      {/* Empty State */}
      {!isLoading && !error && listings.length === 0 && (
        <div className="dashboard-empty-card" style={{ padding: '3rem 2rem' }}>
          <div className="empty-icon-box" aria-hidden="true">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
              <polyline points="22 4 12 14.01 9 11.01" />
            </svg>
          </div>
          <h2 className="empty-title" style={{ fontSize: '1.25rem' }}>No Listings Pending Review</h2>
          <p className="empty-subtitle">
            All submitted host parking spaces have been verified.
          </p>
        </div>
      )}

      {/* Review Cards */}
      {!isLoading && !error && listings.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          {listings.map((item) => {
            const coverPhoto = item.photos?.[0]?.url || item.photos?.[0]?.previewUrl;
            return (
              <article key={item.listingId} className="admin-review-card" id={`review-card-${item.listingId}`}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem' }}>
                  <div>
                    <h2 style={{ fontSize: '1.25rem', fontWeight: 700, margin: 0 }}>
                      {item.location?.locality}, {item.location?.city}
                    </h2>
                    <p style={{ margin: '0.25rem 0', color: 'var(--color-text-secondary)', fontSize: '0.85rem' }}>
                      Exact Address: <strong>{item.location?.address}</strong> ({item.location?.pincode})
                    </p>
                    <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>
                      Host ID: <code>{item.hostId}</code> &bull; Listing ID: <code>{item.listingId}</code>
                    </p>
                  </div>
                  <span className="status-pill status-pending_review" style={{ position: 'static' }}>
                    Pending Review
                  </span>
                </div>

                <div className="admin-review-grid">
                  <div>
                    <span style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary)', textTransform: 'uppercase', fontWeight: 600 }}>Rate</span>
                    <p style={{ margin: '0.2rem 0 0 0', fontWeight: 700, fontSize: '1.1rem' }}>
                      &#8377;{item.pricing?.hourly} <span style={{ fontSize: '0.8rem', fontWeight: 400 }}>/ hour</span>
                    </p>
                    {item.pricing?.daily && (
                      <p style={{ margin: '0.1rem 0 0 0', fontSize: '0.85rem', color: 'var(--color-text-secondary)' }}>
                        &#8377;{item.pricing.daily} / day
                      </p>
                    )}
                  </div>

                  <div>
                    <span style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary)', textTransform: 'uppercase', fontWeight: 600 }}>Parking Spec</span>
                    <p style={{ margin: '0.2rem 0 0 0', fontWeight: 600 }}>
                      {item.parkingDetails?.vehicleType} ({item.parkingDetails?.parkingType})
                    </p>
                    <p style={{ margin: '0.1rem 0 0 0', fontSize: '0.85rem', color: 'var(--color-text-secondary)' }}>
                      Capacity: {item.parkingDetails?.capacity} slot(s)
                    </p>
                  </div>

                  <div>
                    <span style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary)', textTransform: 'uppercase', fontWeight: 600 }}>Features</span>
                    <p style={{ margin: '0.2rem 0 0 0', fontSize: '0.85rem' }}>
                      {item.parkingDetails?.features?.join(', ') || 'None specified'}
                    </p>
                  </div>
                </div>

                {item.parkingDetails?.instructions && (
                  <div style={{ backgroundColor: 'var(--color-surface-subtle)', padding: '0.75rem', borderRadius: 'var(--radius-sm)', fontSize: '0.85rem' }}>
                    <strong>Host Access Instructions:</strong> {item.parkingDetails.instructions}
                  </div>
                )}

                {/* Admin Action Buttons */}
                <div className="admin-actions-row">
                  <button
                    type="button"
                    id={`btn-reject-${item.listingId}`}
                    className="btn btn-reject"
                    onClick={() => handleOpenReject(item)}
                    disabled={isProcessing}
                  >
                    Reject Listing
                  </button>
                  <button
                    type="button"
                    id={`btn-approve-${item.listingId}`}
                    className="btn btn-approve"
                    onClick={() => handleApprove(item.listingId)}
                    disabled={isProcessing}
                  >
                    Approve Listing
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      )}

      {/* REJECT MODAL */}
      {rejectingListing && (
        <div className="modal-backdrop" onClick={() => setRejectingListing(null)} role="dialog" aria-modal="true">
          <div className="modal-card modal-small" onClick={(e) => e.stopPropagation()}>
            <form onSubmit={handleConfirmReject}>
              <div className="modal-header">
                <h2 className="modal-title">Reject Listing</h2>
                <button
                  type="button"
                  className="btn-modal-close"
                  onClick={() => setRejectingListing(null)}
                  aria-label="Close modal"
                >
                  &times;
                </button>
              </div>

              <div className="modal-body">
                <p style={{ fontSize: '0.875rem', color: 'var(--color-text-secondary)', marginBottom: '1rem' }}>
                  Please provide a clear reason for the host explaining why this listing cannot be approved in its current state.
                </p>

                <div className="form-group">
                  <label htmlFor="rejection-reason-input" className="form-label">
                    Rejection Reason <span className="required-star">*</span>
                  </label>
                  <textarea
                    id="rejection-reason-input"
                    className="form-textarea"
                    rows="3"
                    value={rejectionReason}
                    onChange={(e) => setRejectionReason(e.target.value)}
                    placeholder="e.g. Parking entrance photos are unclear, or exact house number is missing."
                    required
                  />
                </div>
              </div>

              <div className="modal-footer">
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setRejectingListing(null)}
                  disabled={isProcessing}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  id="btn-confirm-reject"
                  className="btn btn-delete-danger"
                  disabled={isProcessing || !rejectionReason.trim()}
                >
                  {isProcessing ? 'Rejecting...' : 'Confirm Rejection'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </section>
  );
}
