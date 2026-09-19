'use client';

import React from 'react';
import Link from 'next/link';
import type { ParkingListing } from '@/types/listingModel';

interface SubmissionSuccessProps {
  listingData: ParkingListing;
}

export default function SubmissionSuccess({ listingData }: SubmissionSuccessProps) {
  return (
    <section className="submission-success-container" aria-labelledby="success-heading">
      <div className="success-card">
        <div className="success-icon-badge" aria-hidden="true">
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="20 6 9 17 4 12" />
          </svg>
        </div>

        <span className="status-pill status-pending-review">Status: Pending Review</span>

        <h1 id="success-heading" className="success-title">
          Listing submitted
        </h1>

        <p className="success-subtitle">
          Your parking listing is currently under review.
        </p>

        <div className="success-explanation-box">
          <p>
            Thank you, <strong>{listingData.host.name}</strong>. Our team is verifying your submitted ownership documentation and listing photos.
          </p>
          <p className="success-subtext" style={{ marginTop: '0.5rem', color: 'var(--color-text-secondary)' }}>
            You will be able to manage your listing from My Parking once it has been approved. Listings are not made publicly bookable until verified.
          </p>
        </div>

        <div className="success-summary-meta">
          {listingData.listingId && (
            <div className="meta-line">
              <span>Listing ID:</span>
              <strong className="code-text">{listingData.listingId}</strong>
            </div>
          )}
          {listingData.hostId && (
            <div className="meta-line">
              <span>Host ID (Cognito Sub):</span>
              <strong className="code-text">{listingData.hostId}</strong>
            </div>
          )}
          <div className="meta-line">
            <span>Location:</span>
            <strong>{listingData.location.locality}, {listingData.location.city}</strong>
          </div>
          <div className="meta-line">
            <span>Rate:</span>
            <strong>&#8377;{listingData.pricing.hourly}/hr</strong>
          </div>
          <div className="meta-line">
            <span>Type:</span>
            <strong>{listingData.parkingDetails.vehicleType} &bull; {listingData.parkingDetails.parkingType}</strong>
          </div>
        </div>

        <div className="success-actions" style={{ display: 'flex', gap: '1rem', marginTop: '1.5rem', width: '100%', justifyContent: 'center' }}>
          <Link
            href="/host/dashboard"
            id="btn-go-dashboard"
            className="btn btn-primary btn-large"
          >
            Manage My Parking
          </Link>
          <Link
            href="/"
            id="btn-go-home"
            className="btn btn-secondary btn-large"
          >
            Return to Home
          </Link>
        </div>
      </div>
    </section>
  );
}
