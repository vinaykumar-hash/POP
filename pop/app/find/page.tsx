'use client';

import React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import ActionCard from '@/components/common/ActionCard';

export default function FindParkingPage() {
  const router = useRouter();

  return (
    <div className="landing-page">
      <header className="landing-header">
        <Link href="/" className="landing-brand">
          <span className="landing-brand-badge">P</span>
          <span className="landing-brand-text">
            <span>POP</span>
            <span className="landing-brand-sub">Parking on phone</span>
          </span>
        </Link>
      </header>

      <main className="main-content">
        <div className="back-navigation">
          <button
            type="button"
            className="btn-back"
            id="btn-back-find"
            onClick={() => router.push('/')}
            aria-label="Back to home"
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
              aria-hidden="true"
            >
              <path d="M19 12H5" />
              <path d="m12 19-7-7 7-7" />
            </svg>
            <span>Back</span>
          </button>
        </div>

        <div className="page-header-section">
          <h1 id="find-parking-heading" className="page-title">
            What type of parking are you looking for?
          </h1>
          <p className="text-subtitle page-subtitle">
            Choose between available public spaces or reserved private parking.
          </p>
        </div>

        <div className="cards-grid" role="region" aria-label="Find parking options">
          <ActionCard
            id="card-open-parking"
            title="Open Parking"
            description="Find nearby public and open parking spaces."
            buttonText="Find Open Parking"
            to="/find/open"
          />
          <ActionCard
            id="card-rent-private"
            title="Rent Private Parking"
            description="Book a privately listed parking space by the hour."
            buttonText="Rent Private Parking"
            to="/find/rent"
          />
        </div>
      </main>
    </div>
  );
}
