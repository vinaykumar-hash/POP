'use client';

// =============================================================================
// POP — Auth Modal (AWS Cognito & Demo Emulation)
// Styled with POP / ParkSync Minimalist Monochrome Design System
// =============================================================================

import React, { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { UserRole } from '@/types/user';
import { IconClose, IconCar, IconHome, IconInfo } from '@/components/common/Icons';

export const AuthModal: React.FC = () => {
  const { isAuthModalOpen, closeAuthModal, signIn, signUp, switchDemoUser, isAwsCognito } = useAuth();

  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [role, setRole] = useState<UserRole>('USER');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isAuthModalOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);

    try {
      if (mode === 'signin') {
        await signIn(email.trim(), password);
      } else {
        await signUp(email.trim(), password, role, name.trim(), phone.trim());
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Authentication failed. Please verify credentials.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleQuickDemo = (targetRole: UserRole) => {
    switchDemoUser(targetRole);
    closeAuthModal();
  };

  return (
    <div className="auth-modal-overlay" onClick={closeAuthModal} role="dialog" aria-modal="true">
      <div className="auth-modal-card" onClick={(e) => e.stopPropagation()}>
        {/* Close Button */}
        <button
          onClick={closeAuthModal}
          className="auth-modal-close"
          aria-label="Close authentication modal"
          type="button"
        >
          <IconClose size={16} />
        </button>

        {/* Header */}
        <div className="auth-header">
          <span className="auth-brand-badge" aria-hidden="true">P</span>
          <div className="auth-cognito-badge">
            <span
              className="auth-cognito-dot"
              style={{ backgroundColor: isAwsCognito ? '#10b981' : '#737373' }}
              aria-hidden="true"
            />
            <span>{isAwsCognito ? 'AWS Cognito Active' : 'Local Demo Emulation'}</span>
          </div>
          <h2 className="auth-title">
            {mode === 'signin' ? 'Welcome to POP' : 'Create POP Account'}
          </h2>
          <p className="auth-subtitle">
            {mode === 'signin'
              ? 'Sign in to access your bookings, locations, and host management.'
              : 'Register to find spaces or list your unused parking space in Bengaluru.'}
          </p>
        </div>

        {/* 1-Click Quick Demo Evaluation */}
        <div className="auth-demo-section">
          <div className="auth-demo-title">Quick 1-Click Evaluation Accounts</div>
          <div className="auth-demo-grid">
            <button
              type="button"
              onClick={() => handleQuickDemo('USER')}
              className="auth-demo-btn"
              id="demo-btn-driver"
            >
              <IconCar size={14} />
              <span>Arjun (Driver)</span>
            </button>
            <button
              type="button"
              onClick={() => handleQuickDemo('HOST')}
              className="auth-demo-btn"
              id="demo-btn-host"
            >
              <IconHome size={14} />
              <span>Priya (Host)</span>
            </button>
          </div>
        </div>

        {/* Mode Switcher Tabs */}
        <div className="auth-tabs" role="tablist">
          <button
            type="button"
            role="tab"
            aria-selected={mode === 'signin'}
            onClick={() => { setMode('signin'); setError(null); }}
            className={`auth-tab ${mode === 'signin' ? 'active' : ''}`}
            id="tab-signin"
          >
            Sign In
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={mode === 'signup'}
            onClick={() => { setMode('signup'); setError(null); }}
            className={`auth-tab ${mode === 'signup' ? 'active' : ''}`}
            id="tab-signup"
          >
            Create Account
          </button>
        </div>

        {/* Error Alert */}
        {error && (
          <div className="auth-error-banner" role="alert">
            <IconInfo size={16} style={{ flexShrink: 0 }} />
            <span>{error}</span>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="auth-form" noValidate>
          {mode === 'signup' && (
            <>
              {/* Full Name */}
              <div className="form-group">
                <label className="form-label" htmlFor="modal-name">
                  Full Name <span className="required-star" aria-hidden="true">*</span>
                </label>
                <input
                  id="modal-name"
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Arjun Reddy"
                  className="form-input"
                  autoComplete="name"
                />
              </div>

              {/* Role Selection */}
              <div className="form-group">
                <label className="form-label">
                  Account Type <span className="required-star" aria-hidden="true">*</span>
                </label>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
                  <button
                    type="button"
                    onClick={() => setRole('USER')}
                    className={`btn ${role === 'USER' ? 'btn-primary' : 'btn-secondary'}`}
                    style={{ fontSize: '0.825rem', padding: '0.6rem 0.5rem' }}
                  >
                    <IconCar size={14} />
                    <span>Driver</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setRole('HOST')}
                    className={`btn ${role === 'HOST' ? 'btn-primary' : 'btn-secondary'}`}
                    style={{ fontSize: '0.825rem', padding: '0.6rem 0.5rem' }}
                  >
                    <IconHome size={14} />
                    <span>Host (List Spot)</span>
                  </button>
                </div>
              </div>

              {/* Phone Number */}
              <div className="form-group">
                <label className="form-label" htmlFor="modal-phone">
                  Phone Number
                </label>
                <div className="phone-input-wrapper">
                  <span className="phone-prefix">+91</span>
                  <input
                    id="modal-phone"
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="9876543210"
                    className="form-input phone-field"
                    autoComplete="tel"
                  />
                </div>
              </div>
            </>
          )}

          {/* Email */}
          <div className="form-group">
            <label className="form-label" htmlFor="modal-email">
              Email Address <span className="required-star" aria-hidden="true">*</span>
            </label>
            <input
              id="modal-email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              className="form-input"
              autoComplete="email"
            />
          </div>

          {/* Password */}
          <div className="form-group">
            <label className="form-label" htmlFor="modal-password">
              Password <span className="required-star" aria-hidden="true">*</span>
            </label>
            <input
              id="modal-password"
              type="password"
              required
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="form-input"
              autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
            />
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className="btn btn-primary btn-full btn-large"
            id="modal-submit-btn"
            style={{ marginTop: '0.75rem' }}
          >
            {isSubmitting ? (
              <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span className="loading-spinner" style={{ width: '18px', height: '18px', borderWidth: '2px' }} />
                Authenticating...
              </span>
            ) : mode === 'signin' ? (
              'Sign In'
            ) : (
              'Create Account'
            )}
          </button>
        </form>
      </div>
    </div>
  );
};
