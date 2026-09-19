'use client';

import React, { useState } from 'react';
import type { ParkingListing } from '@/types/listingModel';

interface Step6ReviewProps {
  data: ParkingListing;
  onEditStep: (stepNumber: number) => void;
  onSubmit: () => void;
  onBack: () => void;
  isSubmitting?: boolean;
  apiError?: string | null;
}

export default function Step6Review({
  data,
  onEditStep,
  onSubmit,
  onBack,
  isSubmitting = false,
  apiError = null,
}: Step6ReviewProps) {
  const [confirmed, setConfirmed] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!confirmed) {
      setError('Please check the confirmation box to submit your listing.');
      return;
    }
    onSubmit();
  };

  return (
    <form className="step-form-container" onSubmit={handleSubmit} noValidate>
      <div className="step-header">
        <div className="step-badge">Step 6 of 6</div>
        <h1 className="step-title">Review your parking listing</h1>
        <p className="step-subtitle">
          Please review the details of your listing before submitting for host review.
        </p>
      </div>

      <div className="review-cards-list">
        {/* HOST INFO */}
        <div className="review-section-card">
          <div className="review-card-header">
            <h2 className="review-section-title">Host Verification</h2>
            <button
              type="button"
              className="btn-edit-section"
              onClick={() => onEditStep(1)}
              aria-label="Edit Host Verification"
            >
              Edit
            </button>
          </div>
          <div className="review-content-grid">
            <div className="review-item">
              <span className="review-item-label">Host Name</span>
              <span className="review-item-value">{data.host.name}</span>
            </div>
            <div className="review-item">
              <span className="review-item-label">Email</span>
              <span className="review-item-value">{data.host.email}</span>
            </div>
            <div className="review-item">
              <span className="review-item-label">Phone</span>
              <span className="review-item-value">+91 {data.host.phone}</span>
            </div>
            <div className="review-item">
              <span className="review-item-label">Verification Document</span>
              <span className="review-item-value">
                {data.verification.document?.name || 'Document attached'} &bull; <span className="status-pill status-pending">Pending Review</span>
              </span>
            </div>
            {data.hostId && (
              <div className="review-item full-width">
                <span className="review-item-label">Owner Identity (Cognito Sub)</span>
                <span className="review-item-value host-id-code">{data.hostId}</span>
              </div>
            )}
          </div>
        </div>

        {/* PHOTOS */}
        <div className="review-section-card">
          <div className="review-card-header">
            <h2 className="review-section-title">
              Parking Photos ({data.photos?.length || 0})
            </h2>
            <button
              type="button"
              className="btn-edit-section"
              onClick={() => onEditStep(2)}
              aria-label="Edit Parking Photos"
            >
              Edit
            </button>
          </div>
          <div className="review-photos-gallery">
            {data.photos?.map((photo, index) => (
              <div key={photo.id || index} className="review-photo-thumb">
                <img src={photo.previewUrl} alt={`Upload preview ${index + 1}`} />
                {index === 0 && <span className="review-cover-tag">Cover</span>}
              </div>
            ))}
          </div>
        </div>

        {/* LOCATION */}
        <div className="review-section-card">
          <div className="review-card-header">
            <h2 className="review-section-title">Location</h2>
            <button
              type="button"
              className="btn-edit-section"
              onClick={() => onEditStep(3)}
              aria-label="Edit Location"
            >
              Edit
            </button>
          </div>
          <div className="review-content-grid">
            <div className="review-item">
              <span className="review-item-label">Public Area / Locality</span>
              <span className="review-item-value">{data.location.locality}, {data.location.city}</span>
            </div>
            <div className="review-item">
              <span className="review-item-label">State & PIN Code</span>
              <span className="review-item-value">{data.location.state} &bull; {data.location.pincode}</span>
            </div>
            <div className="review-item full-width">
              <span className="review-item-label">Street Address (Privacy Protected)</span>
              <div className="privacy-masked-address">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" aria-hidden="true">
                  <rect width="18" height="11" x="3" y="11" rx="2" ry="2" />
                  <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                </svg>
                <span>Exact address is hidden from public view. Disclosed only to confirmed renters.</span>
              </div>
            </div>
          </div>
        </div>

        {/* PARKING DETAILS */}
        <div className="review-section-card">
          <div className="review-card-header">
            <h2 className="review-section-title">Parking Details</h2>
            <button
              type="button"
              className="btn-edit-section"
              onClick={() => onEditStep(4)}
              aria-label="Edit Parking Details"
            >
              Edit
            </button>
          </div>
          <div className="review-content-grid">
            <div className="review-item">
              <span className="review-item-label">Vehicle Type</span>
              <span className="review-item-value">{data.parkingDetails.vehicleType}</span>
            </div>
            <div className="review-item">
              <span className="review-item-label">Parking Type</span>
              <span className="review-item-value">{data.parkingDetails.parkingType} Parking</span>
            </div>
            <div className="review-item">
              <span className="review-item-label">Capacity</span>
              <span className="review-item-value">{data.parkingDetails.capacity} {data.parkingDetails.capacity === 1 ? 'vehicle' : 'vehicles'}</span>
            </div>
            <div className="review-item full-width">
              <span className="review-item-label">Features & Amenities</span>
              <div className="features-tags-list">
                {data.parkingDetails.features?.length > 0 ? (
                  data.parkingDetails.features.map((f) => (
                    <span key={f} className="feature-tag">{f}</span>
                  ))
                ) : (
                  <span className="text-muted">No specific amenities selected</span>
                )}
              </div>
            </div>
            {data.parkingDetails.instructions && (
              <div className="review-item full-width">
                <span className="review-item-label">Special Instructions</span>
                <p className="review-instructions-text">{data.parkingDetails.instructions}</p>
              </div>
            )}
          </div>
        </div>

        {/* PRICING & AVAILABILITY */}
        <div className="review-section-card">
          <div className="review-card-header">
            <h2 className="review-section-title">Pricing & Availability</h2>
            <button
              type="button"
              className="btn-edit-section"
              onClick={() => onEditStep(5)}
              aria-label="Edit Pricing & Availability"
            >
              Edit
            </button>
          </div>
          <div className="review-content-grid">
            <div className="review-item">
              <span className="review-item-label">Hourly Rate</span>
              <span className="review-item-value price-highlight">&#8377;{data.pricing.hourly} / hr</span>
            </div>
            {data.pricing.daily && (
              <div className="review-item">
                <span className="review-item-label">Daily Rate</span>
                <span className="review-item-value">&#8377;{data.pricing.daily} / day</span>
              </div>
            )}
            <div className="review-item full-width">
              <span className="review-item-label">Active Schedule</span>
              <span className="review-item-value">
                {data.availability.days?.join(', ')} &bull; {data.availability.startTime} to {data.availability.endTime}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* FINAL CONFIRMATION CHECKBOX */}
      <div className="form-card final-confirmation-card">
        <div className="form-group checkbox-group" style={{ marginBottom: 0 }}>
          <label className="checkbox-label" htmlFor="final-confirm-check">
            <input
              id="final-confirm-check"
              type="checkbox"
              className="checkbox-input"
              checked={confirmed}
              onChange={(e) => {
                setConfirmed(e.target.checked);
                if (e.target.checked) setError(null);
              }}
              aria-required="true"
            />
            <span className="checkbox-custom" aria-hidden="true"></span>
            <span className="checkbox-text" style={{ fontWeight: 500, color: 'var(--color-text-primary)' }}>
              I confirm that the information provided is accurate and that I am authorized to list this parking space.
            </span>
          </label>
        </div>
        {error && (
          <div className="error-message" role="alert" style={{ marginTop: '0.75rem' }}>
            {error}
          </div>
        )}
        {apiError && (
          <div className="auth-error-banner" role="alert" style={{ marginTop: '0.75rem' }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
            <span>{apiError}</span>
          </div>
        )}
      </div>

      <div className="form-actions space-between">
        <button type="button" className="btn btn-secondary" onClick={onBack} disabled={isSubmitting}>
          Back
        </button>
        <button
          type="submit"
          id="btn-submit-listing"
          className="btn btn-primary btn-large"
          disabled={isSubmitting}
        >
          {isSubmitting ? 'Submitting to Backend...' : 'Submit Listing'}
        </button>
      </div>
    </form>
  );
}
