'use client';

import React from 'react';
import Link from 'next/link';
import { useRouter, usePathname } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';

interface LandingHeaderProps {
  rightElement?: React.ReactNode;
}

export default function LandingHeader({ rightElement }: LandingHeaderProps) {
  const router = useRouter();
  const pathname = usePathname();
  const { user, isAuthenticated, signOut, openAuthModal, role } = useAuth();

  const handleSignOut = async () => {
    await signOut();
    // If on a protected route, redirect to home
    const protectedRoutes = ['/host/dashboard', '/host/new', '/admin/listings'];
    if (protectedRoutes.some((route) => pathname.startsWith(route))) {
      router.push('/');
    }
  };

  const getDashboardLink = () => {
    if (role === 'ADMIN') return '/admin/listings';
    if (role === 'HOST') return '/host/dashboard';
    return '/find/open';
  };

  return (
    <header className="landing-header" role="banner">
      {/* Brand Logo */}
      <Link href="/" className="landing-brand" id="nav-brand-logo" aria-label="POP Home">
        <span className="landing-brand-badge" aria-hidden="true">P</span>
        <span className="landing-brand-text">
          <span>POP</span>
          <span className="landing-brand-sub">Parking on phone</span>
        </span>
      </Link>

      {/* Right Navigation & Auth Section */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
        {rightElement}

        {!isAuthenticated || !user ? (
          <button
            type="button"
            id="nav-btn-signin"
            className="btn-nav-signin"
            onClick={() => openAuthModal()}
            aria-label="Sign in"
          >
            Sign In
          </button>
        ) : (
          <div className="nav-auth-section">
            <Link
              href={getDashboardLink()}
              className="nav-host-pill"
              title={`Logged in as ${user.displayName || user.email}`}
              id="nav-host-pill"
            >
              <span className="host-indicator-dot" aria-hidden="true" />
              <span className="nav-host-name">
                {user.displayName || user.email?.split('@')[0]}
              </span>
              <span className="nav-role-tag">
                {role === 'HOST' ? 'Host' : role === 'ADMIN' ? 'Admin' : 'Driver'}
              </span>
            </Link>

            <button
              type="button"
              id="btn-nav-signout"
              className="btn-nav-signout"
              onClick={handleSignOut}
              aria-label="Sign out of account"
            >
              Sign Out
            </button>
          </div>
        )}
      </div>
    </header>
  );
}
