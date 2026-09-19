import React, { useState } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function HostLogin() {
  const navigate = useNavigate();
  const location = useLocation();
  const { signIn } = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState({});
  const [touched, setTouched] = useState({});
  const [authError, setAuthError] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Intended destination after login
  const fromDestination = location.state?.from?.pathname || '/host/dashboard';

  const validate = () => {
    const errs = {};
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (!email.trim()) {
      errs.email = 'Email address is required.';
    } else if (!emailRegex.test(email.trim())) {
      errs.email = 'Please enter a valid email address.';
    }

    if (!password) {
      errs.password = 'Password is required.';
    }

    return errs;
  };

  const handleBlur = (field) => {
    setTouched((prev) => ({ ...prev, [field]: true }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setAuthError(null);

    const errs = validate();
    setErrors(errs);
    setTouched({ email: true, password: true });

    if (Object.keys(errs).length > 0) return;

    setIsSubmitting(true);
    try {
      await signIn({ email, password });
      navigate(fromDestination, { replace: true });
    } catch (err) {
      setAuthError(err.message || 'Failed to sign in. Please verify your credentials.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <section className="auth-page-container" aria-labelledby="login-heading">
      <div className="back-navigation">
        <button
          type="button"
          className="btn-back"
          id="btn-back-login"
          onClick={() => navigate('/list')}
          aria-label="Back to List Parking"
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

      <div className="auth-card">
        <div className="auth-header">
          <span className="auth-brand-badge" aria-hidden="true">P</span>
          <h1 id="login-heading" className="auth-title">
            Welcome to ParkSync
          </h1>
          <p className="auth-subtitle">
            Sign in to manage your parking space.
          </p>
        </div>

        {authError && (
          <div className="auth-error-banner" role="alert">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
            <span>{authError}</span>
          </div>
        )}

        <form className="auth-form" onSubmit={handleSubmit} noValidate>
          {/* Email */}
          <div className="form-group">
            <label htmlFor="login-email" className="form-label">
              Email Address <span className="required-star" aria-hidden="true">*</span>
            </label>
            <input
              id="login-email"
              type="email"
              className={`form-input ${touched.email && errors.email ? 'input-error' : ''}`}
              placeholder="host@example.com"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                if (authError) setAuthError(null);
              }}
              onBlur={() => handleBlur('email')}
              autoComplete="email"
              aria-required="true"
              aria-invalid={!!(touched.email && errors.email)}
              disabled={isSubmitting}
            />
            {touched.email && errors.email && (
              <span className="error-message" role="alert">{errors.email}</span>
            )}
          </div>

          {/* Password */}
          <div className="form-group">
            <label htmlFor="login-password" className="form-label">
              Password <span className="required-star" aria-hidden="true">*</span>
            </label>
            <input
              id="login-password"
              type="password"
              className={`form-input ${touched.password && errors.password ? 'input-error' : ''}`}
              placeholder="Enter your password"
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                if (authError) setAuthError(null);
              }}
              onBlur={() => handleBlur('password')}
              autoComplete="current-password"
              aria-required="true"
              aria-invalid={!!(touched.password && errors.password)}
              disabled={isSubmitting}
            />
            {touched.password && errors.password && (
              <span className="error-message" role="alert">{errors.password}</span>
            )}
          </div>

          {/* Actions */}
          <div className="auth-actions">
            <button
              type="submit"
              id="btn-sign-in"
              className="btn btn-primary btn-large btn-full"
              disabled={isSubmitting}
            >
              {isSubmitting ? 'Signing In...' : 'Sign In'}
            </button>

            <div className="auth-divider">
              <span>New to hosting on ParkSync?</span>
            </div>

            <Link
              to="/host/signup"
              id="btn-link-signup"
              className="btn btn-secondary btn-large btn-full"
            >
              Create Host Account
            </Link>
          </div>
        </form>
      </div>
    </section>
  );
}
