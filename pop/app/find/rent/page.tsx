'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import LandingHeader from '@/components/layout/LandingHeader';

export default function RentPrivateParkingPage() {
  const router = useRouter();

  return (
    <div className="landing-page">
      <LandingHeader />

      <main className="landing-main">
        <div className="back-nav">
          <button
            type="button"
            className="btn-back"
            id="btn-back-rent"
            onClick={() => router.push('/find')}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M19 12H5"/>
              <path d="m12 19-7-7 7-7"/>
            </svg>
            <span>Back to Find Parking</span>
          </button>
        </div>

        <div className="placeholder-content">
          <div className="placeholder-badge">Coming Soon</div>
          <h1 className="landing-title" style={{ fontSize: 'clamp(1.5rem, 3vw + 0.5rem, 2.25rem)' }}>
            Rent Private Parking
          </h1>
          <p className="landing-subtitle">
            Private parking spaces available for rent will appear here.
          </p>

          <div className="placeholder-card">
            <p style={{ fontWeight: 600, fontSize: '1rem', marginBottom: '0.5rem', color: 'var(--pw-text)' }}>
              Coming in future steps
            </p>
            <p style={{ color: 'var(--pw-text-secondary)', fontSize: '0.9rem', lineHeight: 1.6 }}>
              This route is set up as part of the navigation architecture. Full rental functionality will be enabled when the booking system is live.
            </p>
          </div>

          <Link href="/find/open" className="action-card-btn" style={{ textDecoration: 'none' }}>
            Find Open Parking Instead
          </Link>
        </div>
      </main>
    </div>
  );
}
