import React from 'react';
import Link from 'next/link';
import type { Metadata } from 'next';
import ActionCard from '@/components/common/ActionCard';

export const metadata: Metadata = {
  title: 'POP — Parking on phone | Bengaluru',
  description:
    'Find nearby open parking, rent private parking spaces, or list your unused parking space on POP.',
};

export default function HomePage() {
  return (
    <div className="landing-page">
      {/* Header */}
      <header className="landing-header">
        <Link href="/" className="landing-brand">
          <span className="landing-brand-badge">P</span>
          <span className="landing-brand-text">
            <span>POP</span>
            <span className="landing-brand-sub">Parking on phone</span>
          </span>
        </Link>
      </header>

      {/* Main Content matching otherPart */}
      <main className="main-content">
        <div className="page-header-section">
          <h1 id="home-heading" className="page-title">
            Parking, made simple.
          </h1>
          <p className="text-subtitle page-subtitle">
            Find a parking spot or list your unused space in Bengaluru.
          </p>
        </div>

        <div className="cards-grid" role="region" aria-label="Main parking options">
          <ActionCard
            id="card-find-parking"
            title="Find Parking"
            description="Find an open parking spot or rent a private parking space."
            buttonText="Find Parking"
            to="/find"
          />
          <ActionCard
            id="card-list-parking"
            title="List Parking"
            description="List your unused parking space and let others rent it."
            buttonText="List Parking"
            to="/list"
          />
        </div>

        {/* Footer tagline */}
        <div className="landing-footer-tag" style={{ marginTop: '4rem', textAlign: 'center' }}>
          <span>POP</span>
          <span className="landing-footer-dot">&bull;</span>
          <span>Urban parking made seamless</span>
        </div>
      </main>
    </div>
  );
}
