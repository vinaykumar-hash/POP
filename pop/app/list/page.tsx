'use client';

import React, { useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import ActionCard from '@/components/common/ActionCard';

export default function ListParkingPage() {
  const router = useRouter();
  const { isAuthenticated, role } = useAuth();

  useEffect(() => {
    if (isAuthenticated && (role === 'HOST' || role === 'ADMIN')) {
      router.replace(role === 'ADMIN' ? '/admin/listings' : '/host/dashboard');
    }
  }, [isAuthenticated, role, router]);

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
            id="btn-back-list"
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
          <h1 id="list-parking-heading" className="page-title">
            Are you new to POP?
          </h1>
          <p className="text-subtitle page-subtitle">
            Turn your unused parking spot into income or manage existing listings.
          </p>
        </div>

        <div className="cards-grid" role="region" aria-label="Host listing options">
          <ActionCard
            id="card-host-new"
            title="I'm New"
            description="Create your first parking listing."
            buttonText="Create Listing"
            to="/host/new"
          />
          <ActionCard
            id="card-host-existing"
            title="I'm an Existing Host"
            description="Manage your parking listings and bookings."
            buttonText="Manage My Parking"
            to="/host/dashboard"
          />
        </div>
      </main>
    </div>
  );
}
