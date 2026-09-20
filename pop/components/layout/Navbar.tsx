'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { IconCar, IconHome, IconEvCharging, IconLeaving } from '@/components/common/Icons';

export default function Navbar() {
  const pathname = usePathname();

  // Don't show navbar on landing pages (they have their own header)
  const landingRoutes = ['/', '/find', '/find/rent', '/list', '/host/new', '/host/dashboard', '/admin/listings'];
  if (landingRoutes.includes(pathname)) {
    return null;
  }

  return (
    <nav
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        height: 'var(--navbar-height)',
        zIndex: 'var(--z-navbar)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 16px',
        background: 'color-mix(in srgb, var(--pw-surface) 90%, transparent)',
        backdropFilter: 'blur(12px) saturate(1.4)',
        WebkitBackdropFilter: 'blur(12px) saturate(1.4)',
        borderBottom: '1px solid var(--pw-border)',
      }}
      id="main-navbar"
    >
      {/* Logo */}
      <Link
        href="/"
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          textDecoration: 'none',
          flexShrink: 0,
        }}
      >
        <span
          style={{
            width: '32px',
            height: '32px',
            borderRadius: 'var(--pw-radius-sm)',
            background: 'var(--pw-primary)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '16px',
            fontWeight: 800,
            color: 'white',
          }}
        >
          P
        </span>
        <span
          style={{
            fontSize: '18px',
            fontWeight: 800,
            color: 'var(--pw-text)',
            letterSpacing: '-0.03em',
            display: 'flex',
            alignItems: 'baseline',
            gap: '6px',
          }}
        >
          <span>POP</span>
          <span
            style={{
              fontSize: '11px',
              fontWeight: 500,
              color: 'var(--pw-text-secondary)',
              letterSpacing: '0',
            }}
          >
            Parking on phone
          </span>
        </span>
      </Link>

      {/* Mode Tabs */}
      <div
        style={{
          display: 'flex',
          gap: '4px',
          padding: '4px',
          background: 'var(--pw-surface-elevated)',
          borderRadius: 'var(--pw-radius-full)',
          border: '1px solid var(--pw-border)',
        }}
      >
        <Link
          href="/find/open"
          className={pathname === '/find/open' ? 'pw-btn pw-btn-primary pw-btn-sm' : 'pw-btn pw-btn-sm'}
          style={{
            fontSize: '12px',
            padding: '6px 14px',
            borderRadius: 'var(--pw-radius-full)',
            textDecoration: 'none',
            ...(pathname !== '/find/open'
              ? { background: 'transparent', color: 'var(--pw-text-secondary)', border: 'none' }
              : {}),
          }}
          id="nav-open-parking"
        >
          Open parking
        </Link>
        <Link
          href="/find/rent"
          className={pathname === '/find/rent' ? 'pw-btn pw-btn-primary pw-btn-sm' : 'pw-btn pw-btn-sm'}
          style={{
            fontSize: '12px',
            padding: '6px 14px',
            borderRadius: 'var(--pw-radius-full)',
            textDecoration: 'none',
            ...(pathname !== '/find/rent'
              ? { background: 'transparent', color: 'var(--pw-text-secondary)', border: 'none' }
              : {}),
          }}
          id="nav-rent-parking"
        >
          Rent parking
        </Link>
      </div>

      {/* User Account / Auth Section */}
      <AuthNavSection />
    </nav>
  );
}

function AuthNavSection() {
  const { user, isAuthenticated, openAuthModal, signOut, switchDemoUser, role } = useAuth();
  const [showDropdown, setShowDropdown] = React.useState(false);

  if (!isAuthenticated || !user) {
    return (
      <button
        onClick={() => openAuthModal()}
        className="pw-btn pw-btn-primary pw-btn-sm"
        style={{
          fontSize: '12px',
          padding: '6px 14px',
          borderRadius: 'var(--pw-radius-full)',
          fontWeight: 600,
          cursor: 'pointer',
        }}
        id="navbar-sign-in-btn"
      >
        Sign In
      </button>
    );
  }

  const roleIcon = role === 'HOST' ? <IconHome size={14} /> : role === 'ADMIN' ? <IconEvCharging size={14} /> : <IconCar size={14} />;
  const roleLabel = role === 'HOST' ? 'Host' : role === 'ADMIN' ? 'Admin' : 'Driver';

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
      <div style={{ position: 'relative' }}>
        <button
          onClick={() => setShowDropdown((prev) => !prev)}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
          padding: '4px 10px',
          background: 'var(--pw-surface-elevated)',
          border: '1px solid var(--pw-border)',
          borderRadius: 'var(--pw-radius-full)',
          cursor: 'pointer',
          color: 'var(--pw-text)',
          fontSize: '12px',
          fontWeight: 500,
        }}
        id="navbar-user-profile-btn"
      >
        <span style={{ display: 'flex', alignItems: 'center' }}>{roleIcon}</span>
        <span style={{ maxWidth: '90px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {user.displayName || user.email?.split('@')[0]}
        </span>
        <span
          style={{
            fontSize: '10px',
            padding: '1px 6px',
            borderRadius: 'var(--pw-radius-full)',
            background: role === 'HOST' ? 'rgba(16, 185, 129, 0.2)' : 'rgba(6, 182, 212, 0.2)',
            color: role === 'HOST' ? '#34d399' : '#22d3ee',
            fontWeight: 700,
          }}
        >
          {roleLabel}
        </span>
      </button>

      {showDropdown && (
        <div
          style={{
            position: 'absolute',
            top: 'calc(100% + 8px)',
            right: 0,
            width: '210px',
            background: 'var(--pw-surface-elevated)',
            border: '1px solid var(--pw-border)',
            borderRadius: 'var(--pw-radius-md)',
            boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.5)',
            padding: '8px',
            zIndex: 100,
            backdropFilter: 'blur(16px)',
          }}
        >
          <div style={{ padding: '6px 8px', borderBottom: '1px solid var(--pw-border)', marginBottom: '6px' }}>
            <div style={{ fontSize: '11px', color: 'var(--pw-text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Logged In As
            </div>
            <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--pw-text)', marginTop: '2px' }}>
              {user.displayName}
            </div>
            <div style={{ fontSize: '11px', color: 'var(--pw-text-secondary)' }}>
              {user.email}
            </div>
          </div>

          <div style={{ padding: '4px 8px', fontSize: '11px', color: 'var(--pw-text-secondary)', fontWeight: 600 }}>
            SWITCH DEMO ROLE
          </div>
          <button
            onClick={() => {
              switchDemoUser('USER');
              setShowDropdown(false);
            }}
            style={{
              width: '100%',
              textAlign: 'left',
              padding: '6px 8px',
              fontSize: '12px',
              background: role === 'USER' ? 'rgba(6, 182, 212, 0.15)' : 'transparent',
              color: role === 'USER' ? '#22d3ee' : 'var(--pw-text)',
              border: 'none',
              borderRadius: '6px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
            }}
          >
            <IconCar size={14} />
            <span>Bengaluru Driver</span>
          </button>
          <button
            onClick={() => {
              switchDemoUser('HOST');
              setShowDropdown(false);
            }}
            style={{
              width: '100%',
              textAlign: 'left',
              padding: '6px 8px',
              fontSize: '12px',
              background: role === 'HOST' ? 'rgba(16, 185, 129, 0.15)' : 'transparent',
              color: role === 'HOST' ? '#059669' : 'var(--pw-text)',
              border: 'none',
              borderRadius: '6px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
            }}
          >
            <IconHome size={14} />
            <span>Parking Space Host</span>
          </button>

          <div style={{ borderTop: '1px solid var(--pw-border)', marginTop: '6px', paddingTop: '6px' }}>
            <button
              onClick={() => {
                signOut();
                setShowDropdown(false);
              }}
              style={{
                width: '100%',
                textAlign: 'left',
                padding: '6px 8px',
                fontSize: '12px',
                background: 'transparent',
                color: '#f87171',
                border: 'none',
                borderRadius: '6px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
              }}
            >
              <IconLeaving size={14} />
              <span>Sign Out</span>
            </button>
          </div>
        </div>
      )}
      </div>

      <button
        type="button"
        id="navbar-direct-signout-btn"
        className="btn-nav-signout"
        onClick={() => signOut()}
        style={{ fontSize: '11px', padding: '4px 10px' }}
        aria-label="Sign out"
      >
        Sign Out
      </button>
    </div>
  );
}
