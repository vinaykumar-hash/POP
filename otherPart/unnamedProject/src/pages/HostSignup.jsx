import React, { useState } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function HostSignup() {
  const navigate = useNavigate();
  const location = useLocation();
  const { signUp } = useAuth();

  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    password: '',
    confirmPassword: ''
  });

  const [errors, setErrors] = useState({});
  const [touched, setTouched] = useState({});
  const [authError, setAuthError] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Destination after signup defaults to /host/new
  const fromDestination = location.state?.from?.pathname || '/host/new';

  const validate = () => {
    const errs = {};
    if (!formData.name.trim()) {
      errs.name = 'Full name is required.';
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!formData.email.trim()) {
      errs.email = 'Email address is required.';
    } else if (!emailRegex.test(formData.email.trim())) {
      errs.email = 'Please enter a valid email address.';
    }

    const cleanPhone = formData.phone.replace(/[\s\-]/g, '');
    const phoneRegex = /^(\+91)?[6-9]\d{9}$/;
    if (!formData.phone.trim()) {
      errs.phone = 'Phone number is required.';
    } else if (!phoneRegex.test(cleanPhone)) {
      errs.phone = 'Please enter a valid 10-digit Indian phone number (starts with 6-9).';
    }

    if (!formData.password) {
      errs.password = 'Password is required.';
    } else if (formData.password.length < 8) {
      errs.password = 'Password must be at least 8 characters long.';
    }

    if (!formData.confirmPassword) {
      errs.confirmPassword = 'Please confirm your password.';
    } else if (formData.password !== formData.confirmPassword) {
      errs.confirmPassword = 'Passwords do not match.';
    }

    return errs;
  };

  const handleBlur = (field) => {
    setTouched((prev) => ({ ...prev, [field]: true }));
  };

  const handleInputChange = (field, value) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    if (authError) setAuthError(null);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setAuthError(null);

    const errs = validate();
    setErrors(errs);
    setTouched({
      name: true,
      email: true,
      phone: true,
      password: true,
      confirmPassword: true
    });

    if (Object.keys(errs).length > 0) return;

    setIsSubmitting(true);
    try {
      await signUp({
        name: formData.name,
        email: formData.email,
        phone: formData.phone,
        password: formData.password
      });
      navigate(fromDestination, { replace: true });
    } catch (err) {
      setAuthError(err.message || 'Failed to create account. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <section className="auth-page-container" aria-labelledby="signup-heading">
      <div className="back-navigation">
        <button
          type="button"
          className="btn-back"
          id="btn-back-signup"
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
          <h1 id="signup-heading" className="auth-title">
            Create your ParkSync account
          </h1>
          <p className="auth-subtitle">
            Sign up to list and manage your parking spaces with verified ownership.
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
          {/* Full Name */}
          <div className="form-group">
            <label htmlFor="signup-name" className="form-label">
              Full Name <span className="required-star" aria-hidden="true">*</span>
            </label>
            <input
              id="signup-name"
              type="text"
              className={`form-input ${touched.name && errors.name ? 'input-error' : ''}`}
              placeholder="e.g. Rahul Sharma"
              value={formData.name}
              onChange={(e) => handleInputChange('name', e.target.value)}
              onBlur={() => handleBlur('name')}
              autoComplete="name"
              aria-required="true"
              aria-invalid={!!(touched.name && errors.name)}
              disabled={isSubmitting}
            />
            {touched.name && errors.name && (
              <span className="error-message" role="alert">{errors.name}</span>
            )}
          </div>

          {/* Email */}
          <div className="form-group">
            <label htmlFor="signup-email" className="form-label">
              Email Address <span className="required-star" aria-hidden="true">*</span>
            </label>
            <input
              id="signup-email"
              type="email"
              className={`form-input ${touched.email && errors.email ? 'input-error' : ''}`}
              placeholder="rahul.sharma@example.com"
              value={formData.email}
              onChange={(e) => handleInputChange('email', e.target.value)}
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

          {/* Phone Number */}
          <div className="form-group">
            <label htmlFor="signup-phone" className="form-label">
              Phone Number (India) <span className="required-star" aria-hidden="true">*</span>
            </label>
            <div className="phone-input-wrapper">
              <span className="phone-prefix">+91</span>
              <input
                id="signup-phone"
                type="tel"
                className={`form-input phone-field ${touched.phone && errors.phone ? 'input-error' : ''}`}
                placeholder="9876543210"
                value={formData.phone}
                onChange={(e) => handleInputChange('phone', e.target.value)}
                onBlur={() => handleBlur('phone')}
                autoComplete="tel"
                aria-required="true"
                aria-invalid={!!(touched.phone && errors.phone)}
                disabled={isSubmitting}
              />
            </div>
            {touched.phone && errors.phone && (
              <span className="error-message" role="alert">{errors.phone}</span>
            )}
          </div>

          {/* Password */}
          <div className="form-group">
            <label htmlFor="signup-password" className="form-label">
              Password (Min 8 characters) <span className="required-star" aria-hidden="true">*</span>
            </label>
            <input
              id="signup-password"
              type="password"
              className={`form-input ${touched.password && errors.password ? 'input-error' : ''}`}
              placeholder="Create a secure password"
              value={formData.password}
              onChange={(e) => handleInputChange('password', e.target.value)}
              onBlur={() => handleBlur('password')}
              autoComplete="new-password"
              aria-required="true"
              aria-invalid={!!(touched.password && errors.password)}
              disabled={isSubmitting}
            />
            {touched.password && errors.password && (
              <span className="error-message" role="alert">{errors.password}</span>
            )}
          </div>

          {/* Confirm Password */}
          <div className="form-group">
            <label htmlFor="signup-confirm-password" className="form-label">
              Confirm Password <span className="required-star" aria-hidden="true">*</span>
            </label>
            <input
              id="signup-confirm-password"
              type="password"
              className={`form-input ${touched.confirmPassword && errors.confirmPassword ? 'input-error' : ''}`}
              placeholder="Re-enter password"
              value={formData.confirmPassword}
              onChange={(e) => handleInputChange('confirmPassword', e.target.value)}
              onBlur={() => handleBlur('confirmPassword')}
              autoComplete="new-password"
              aria-required="true"
              aria-invalid={!!(touched.confirmPassword && errors.confirmPassword)}
              disabled={isSubmitting}
            />
            {touched.confirmPassword && errors.confirmPassword && (
              <span className="error-message" role="alert">{errors.confirmPassword}</span>
            )}
          </div>

          {/* Actions */}
          <div className="auth-actions">
            <button
              type="submit"
              id="btn-create-account"
              className="btn btn-primary btn-large btn-full"
              disabled={isSubmitting}
            >
              {isSubmitting ? 'Creating Account...' : 'Create Account'}
            </button>

            <div className="auth-divider">
              <span>Already a registered ParkSync host?</span>
            </div>

            <Link
              to="/host/login"
              id="btn-link-login"
              className="btn btn-secondary btn-large btn-full"
            >
              Sign In
            </Link>
          </div>
        </form>
      </div>
    </section>
  );
}
