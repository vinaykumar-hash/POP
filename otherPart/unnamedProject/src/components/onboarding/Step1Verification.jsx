import React, { useState } from 'react';

export default function Step1Verification({
  data,
  onChange,
  onContinue,
  verificationStatus = 'not_submitted',
  hasSubmittedVerification = false,
  isHostVerified = false
}) {
  const [errors, setErrors] = useState({});
  const [touched, setTouched] = useState({});

  const isVerified = verificationStatus === 'verified' || isHostVerified;
  const isPending = verificationStatus === 'pending';
  const isSubmitted = isVerified || isPending || hasSubmittedVerification;

  const validate = () => {
    const errs = {};
    if (!data.host.name.trim()) {
      errs.name = 'Full name is required.';
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!data.host.email.trim()) {
      errs.email = 'Email address is required.';
    } else if (!emailRegex.test(data.host.email.trim())) {
      errs.email = 'Please enter a valid email address.';
    }

    // Indian phone number validation: 10 digits, optionally prefixed with +91, starts with 6, 7, 8, or 9
    const cleanPhone = data.host.phone.replace(/[\s\-]/g, '');
    const phoneRegex = /^(\+91)?[6-9]\d{9}$/;
    if (!data.host.phone.trim()) {
      errs.phone = 'Phone number is required.';
    } else if (!phoneRegex.test(cleanPhone)) {
      errs.phone = 'Please enter a valid 10-digit Indian phone number (starts with 6-9).';
    }

    // Only require document upload if host account has not already submitted verification
    if (!isSubmitted && !data.verification?.document) {
      errs.document = 'Please upload a verification document (ID proof or ownership proof).';
    }

    if (!data.verification.ownershipConfirmed) {
      errs.ownership = 'You must confirm that you own or are authorized to list this space.';
    }

    return errs;
  };

  const handleBlur = (field) => {
    setTouched((prev) => ({ ...prev, [field]: true }));
  };

  const handleInputChange = (field, value) => {
    onChange({
      ...data,
      host: {
        ...data.host,
        [field]: value
      }
    });
  };

  const handleDocumentChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate type (image or pdf)
    const validTypes = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];
    if (!validTypes.includes(file.type)) {
      setErrors((prev) => ({ ...prev, document: 'Supported formats: JPG, PNG, WebP, or PDF.' }));
      return;
    }

    // Validate size (max 10MB)
    if (file.size > 10 * 1024 * 1024) {
      setErrors((prev) => ({ ...prev, document: 'File size exceeds 10MB limit.' }));
      return;
    }

    const docData = {
      name: file.name,
      size: (file.size / (1024 * 1024)).toFixed(2) + ' MB',
      type: file.type,
      file: file,
      previewUrl: file.type.startsWith('image/') ? URL.createObjectURL(file) : null
    };

    onChange({
      ...data,
      verification: {
        ...data.verification,
        document: docData
      }
    });

    setErrors((prev) => ({ ...prev, document: null }));
  };

  const handleRemoveDocument = () => {
    onChange({
      ...data,
      verification: {
        ...data.verification,
        document: null
      }
    });
  };

  const handleCheckboxChange = (e) => {
    onChange({
      ...data,
      verification: {
        ...data.verification,
        ownershipConfirmed: e.target.checked
      }
    });
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const errs = validate();
    setErrors(errs);
    setTouched({
      name: true,
      email: true,
      phone: true,
      document: true,
      ownership: true
    });

    if (Object.keys(errs).length === 0) {
      onContinue();
    }
  };

  return (
    <form className="step-form-container" onSubmit={handleSubmit} noValidate>
      <div className="step-header">
        <div className="step-badge">Step 1 of 6</div>
        <h1 className="step-title">
          {isVerified
            ? 'Host Identity (Verified)'
            : isPending
            ? 'Host Identity (Verification Pending)'
            : "Let's verify you"}
        </h1>
        <p className="step-subtitle">
          {isVerified
            ? 'Your host account identity is verified on file with ParkSync Administration.'
            : isPending
            ? 'Your host identity verification has been submitted and is under administrative review.'
            : 'We need a few details before you can list a parking space.'}
        </p>
      </div>

      {isVerified ? (
        <div className="status-banner" style={{ borderColor: '#00875A', backgroundColor: '#E3FCEF' }}>
          <span className="status-pill status-approved" id="host-verification-status-pill" style={{ backgroundColor: '#00875A', color: '#fff' }}>
            ✓ Host Identity Verified
          </span>
          <p className="status-note" style={{ color: '#006644', marginTop: '0.25rem' }}>
            Your host account is verified. You do not need to re-upload verification documents to list this space.
          </p>
        </div>
      ) : isPending ? (
        <div className="status-banner" style={{ borderColor: '#FFAB00', backgroundColor: '#FFFAE6' }}>
          <span className="status-pill status-pending" id="host-verification-status-pill" style={{ backgroundColor: '#FFAB00', color: '#172B4D', fontWeight: 600 }}>
            Verification Status: Pending
          </span>
          <p className="status-note" style={{ color: '#172B4D', marginTop: '0.25rem' }}>
            Your host verification has already been submitted and is under administrative review. You do not need to re-upload documents to list this space.
          </p>
        </div>
      ) : (
        <div className="status-banner">
          <span className="status-pill" id="host-verification-status-pill" style={{ background: '#DFE1E6', color: '#42526E' }}>Verification Required</span>
          <p className="status-note">
            Host accounts undergo review after submission. Please complete your identity details to start listing spaces.
          </p>
        </div>
      )}

      <div className="form-card">
        {/* Full Name */}
        <div className="form-group">
          <label htmlFor="host-name" className="form-label">
            Full Name <span className="required-star" aria-hidden="true">*</span>
          </label>
          <input
            id="host-name"
            type="text"
            className={`form-input ${touched.name && errors.name ? 'input-error' : ''}`}
            placeholder="e.g. Rahul Sharma"
            value={data.host.name}
            onChange={(e) => handleInputChange('name', e.target.value)}
            onBlur={() => handleBlur('name')}
            aria-required="true"
            aria-invalid={!!(touched.name && errors.name)}
            aria-describedby={touched.name && errors.name ? 'name-error' : undefined}
          />
          {touched.name && errors.name && (
            <span id="name-error" className="error-message" role="alert">{errors.name}</span>
          )}
        </div>

        {/* Email */}
        <div className="form-group">
          <label htmlFor="host-email" className="form-label">
            Email Address <span className="required-star" aria-hidden="true">*</span>
          </label>
          <input
            id="host-email"
            type="email"
            className={`form-input ${touched.email && errors.email ? 'input-error' : ''}`}
            placeholder="rahul.sharma@example.com"
            value={data.host.email}
            onChange={(e) => handleInputChange('email', e.target.value)}
            onBlur={() => handleBlur('email')}
            aria-required="true"
            aria-invalid={!!(touched.email && errors.email)}
            aria-describedby={touched.email && errors.email ? 'email-error' : undefined}
          />
          {touched.email && errors.email && (
            <span id="email-error" className="error-message" role="alert">{errors.email}</span>
          )}
        </div>

        {/* Phone Number */}
        <div className="form-group">
          <label htmlFor="host-phone" className="form-label">
            Phone Number (India) <span className="required-star" aria-hidden="true">*</span>
          </label>
          <div className="phone-input-wrapper">
            <span className="phone-prefix">+91</span>
            <input
              id="host-phone"
              type="tel"
              className={`form-input phone-field ${touched.phone && errors.phone ? 'input-error' : ''}`}
              placeholder="9876543210"
              value={data.host.phone}
              onChange={(e) => handleInputChange('phone', e.target.value)}
              onBlur={() => handleBlur('phone')}
              aria-required="true"
              aria-invalid={!!(touched.phone && errors.phone)}
              aria-describedby={touched.phone && errors.phone ? 'phone-error' : undefined}
            />
          </div>
          <span className="form-hint">Enter your 10-digit mobile number.</span>
          {touched.phone && errors.phone && (
            <span id="phone-error" className="error-message" role="alert">{errors.phone}</span>
          )}
        </div>

        {/* Document Upload */}
        <div className="form-group">
          <label className="form-label">
            Verification Document {!isSubmitted && <span className="required-star" aria-hidden="true">*</span>}
          </label>
          {isSubmitted ? (
            <div className="verified-account-notice" style={{ padding: '0.875rem 1rem', background: '#F4F5F7', borderRadius: '8px', border: '1px solid #DFE1E6', marginTop: '0.25rem' }}>
              <p style={{ margin: 0, fontWeight: 600, color: '#172B4D', fontSize: '0.9rem' }}>
                {isVerified ? '✓ Verified Identity On File' : '📄 Verification Documents On File (Under Review)'}
              </p>
              <p style={{ margin: '0.25rem 0 0 0', fontSize: '0.8rem', color: '#5E6C84' }}>
                {isVerified
                  ? 'Your host account identity has already been verified. Re-uploading documents is not required.'
                  : 'Your verification documents have already been submitted. Re-uploading documents is not required.'}
              </p>
            </div>
          ) : (
            <>
              <span className="form-hint">
                Upload Government ID (Aadhaar/PAN/Driving License) or Society/Ownership NOC (Image or PDF, max 10MB).
              </span>

              {!data.verification.document ? (
                <div className="upload-dropzone">
                  <input
                    id="doc-upload-input"
                    type="file"
                    accept="image/jpeg,image/png,image/webp,application/pdf"
                    className="file-hidden-input"
                    onChange={handleDocumentChange}
                  />
                  <label htmlFor="doc-upload-input" className="upload-zone-label">
                    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                      <polyline points="17 8 12 3 7 8" />
                      <line x1="12" y1="3" x2="12" y2="15" />
                    </svg>
                    <span className="upload-cta-text">Click to choose a file or drag here</span>
                    <span className="upload-format-text">Supported: JPG, PNG, WebP, PDF</span>
                  </label>
                </div>
              ) : (
                <div className="uploaded-file-card">
                  <div className="file-info-left">
                    <div className="file-icon-badge">
                      {data.verification.document.type === 'application/pdf' ? 'PDF' : 'IMG'}
                    </div>
                    <div>
                      <p className="file-name">{data.verification.document.name}</p>
                      <p className="file-meta">{data.verification.document.size} &bull; Ready for submission</p>
                    </div>
                  </div>
                  <button
                    type="button"
                    className="btn-remove-file"
                    onClick={handleRemoveDocument}
                    aria-label="Remove uploaded document"
                  >
                    Remove
                  </button>
                </div>
              )}

              {touched.document && errors.document && (
                <span className="error-message" role="alert">{errors.document}</span>
              )}
            </>
          )}
        </div>

        {/* Ownership Confirmation Checkbox */}
        <div className="form-group checkbox-group">
          <label className="checkbox-label" htmlFor="ownership-check">
            <input
              id="ownership-check"
              type="checkbox"
              className="checkbox-input"
              checked={data.verification.ownershipConfirmed}
              onChange={handleCheckboxChange}
              aria-required="true"
            />
            <span className="checkbox-custom" aria-hidden="true"></span>
            <span className="checkbox-text">
              I confirm that I own or am authorized to offer this parking space for rent.
            </span>
          </label>
          {touched.ownership && errors.ownership && (
            <span className="error-message" role="alert">{errors.ownership}</span>
          )}
        </div>
      </div>

      <div className="form-actions">
        <button type="submit" id="btn-step1-continue" className="btn btn-primary btn-large">
          Continue to Photos
        </button>
      </div>
    </form>
  );
}
