'use client';

import React, { useState } from 'react';
import type { ParkingListing } from '@/types/listingModel';

interface Step3LocationProps {
  data: ParkingListing;
  onChange: (updated: ParkingListing) => void;
  onContinue: () => void;
  onBack: () => void;
}

export default function Step3Location({ data, onChange, onContinue, onBack }: Step3LocationProps) {
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [touched, setTouched] = useState<Record<string, boolean>>({});

  const location = data.location;

  const validate = () => {
    const errs: Record<string, string> = {};
    if (!location.address.trim()) {
      errs.address = 'Street address / building name is required.';
    }
    if (!location.locality.trim()) {
      errs.locality = 'Area or locality is required.';
    }
    if (!location.city.trim()) {
      errs.city = 'City is required.';
    }
    if (!location.state.trim()) {
      errs.state = 'State is required.';
    }
    const pinRegex = /^[1-9][0-9]{5}$/;
    if (!location.pincode.trim()) {
      errs.pincode = 'PIN code is required.';
    } else if (!pinRegex.test(location.pincode.trim())) {
      errs.pincode = 'Please enter a valid 6-digit Indian PIN code.';
    }

    return errs;
  };

  const handleBlur = (field: string) => {
    setTouched((prev) => ({ ...prev, [field]: true }));
  };

  const handleFieldChange = (field: string, value: string | number) => {
    onChange({
      ...data,
      location: {
        ...location,
        [field]: value,
      },
    });
  };

  const handleMapPinClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const baseLat = 12.9716;
    const baseLng = 77.5946;
    const latOffset = ((y / rect.height) - 0.5) * -0.05;
    const lngOffset = ((x / rect.width) - 0.5) * 0.05;

    const newLat = parseFloat((baseLat + latOffset).toFixed(6));
    const newLng = parseFloat((baseLng + lngOffset).toFixed(6));

    onChange({
      ...data,
      location: {
        ...location,
        latitude: newLat,
        longitude: newLng,
      },
    });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const errs = validate();
    setErrors(errs);
    setTouched({
      address: true,
      locality: true,
      city: true,
      state: true,
      pincode: true,
    });

    if (Object.keys(errs).length === 0) {
      onContinue();
    }
  };

  return (
    <form className="step-form-container" onSubmit={handleSubmit} noValidate>
      <div className="step-header">
        <div className="step-badge">Step 3 of 6</div>
        <h1 className="step-title">Where is your parking space?</h1>
        <p className="step-subtitle">
          Provide your parking address and approximate map placement.
        </p>
      </div>

      {/* PRIVACY NOTICE BANNER */}
      <div className="privacy-banner" role="status">
        <div className="privacy-icon" aria-hidden="true">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <rect width="18" height="11" x="3" y="11" rx="2" ry="2" />
            <path d="M7 11V7a5 5 0 0 1 10 0v4" />
          </svg>
        </div>
        <div className="privacy-content">
          <strong>Privacy Guaranteed:</strong> Your exact residential address will only be shared with a renter after a confirmed booking. Only the general locality and city will appear publicly.
        </div>
      </div>

      <div className="form-card">
        {/* Exact Address */}
        <div className="form-group">
          <div className="label-with-badge">
            <label htmlFor="loc-address" className="form-label">
              Exact Address (Building, Flat/Wing, Street) <span className="required-star" aria-hidden="true">*</span>
            </label>
            <span className="confidential-badge">Private</span>
          </div>
          <input
            id="loc-address"
            type="text"
            className={`form-input ${touched.address && errors.address ? 'input-error' : ''}`}
            placeholder="e.g. Flat 402, Green Acres, 100ft Road"
            value={location.address}
            onChange={(e) => handleFieldChange('address', e.target.value)}
            onBlur={() => handleBlur('address')}
            aria-required="true"
          />
          {touched.address && errors.address && (
            <span className="error-message" role="alert">{errors.address}</span>
          )}
        </div>

        <div className="form-row-2">
          {/* Locality */}
          <div className="form-group">
            <label htmlFor="loc-locality" className="form-label">
              Area / Locality <span className="required-star" aria-hidden="true">*</span>
            </label>
            <input
              id="loc-locality"
              type="text"
              className={`form-input ${touched.locality && errors.locality ? 'input-error' : ''}`}
              placeholder="e.g. Indiranagar"
              value={location.locality}
              onChange={(e) => handleFieldChange('locality', e.target.value)}
              onBlur={() => handleBlur('locality')}
              aria-required="true"
            />
            {touched.locality && errors.locality && (
              <span className="error-message" role="alert">{errors.locality}</span>
            )}
          </div>

          {/* City */}
          <div className="form-group">
            <label htmlFor="loc-city" className="form-label">
              City <span className="required-star" aria-hidden="true">*</span>
            </label>
            <input
              id="loc-city"
              type="text"
              className={`form-input ${touched.city && errors.city ? 'input-error' : ''}`}
              placeholder="e.g. Bengaluru"
              value={location.city}
              onChange={(e) => handleFieldChange('city', e.target.value)}
              onBlur={() => handleBlur('city')}
              aria-required="true"
            />
            {touched.city && errors.city && (
              <span className="error-message" role="alert">{errors.city}</span>
            )}
          </div>
        </div>

        <div className="form-row-2">
          {/* State */}
          <div className="form-group">
            <label htmlFor="loc-state" className="form-label">
              State <span className="required-star" aria-hidden="true">*</span>
            </label>
            <input
              id="loc-state"
              type="text"
              className={`form-input ${touched.state && errors.state ? 'input-error' : ''}`}
              placeholder="e.g. Karnataka"
              value={location.state}
              onChange={(e) => handleFieldChange('state', e.target.value)}
              onBlur={() => handleBlur('state')}
              aria-required="true"
            />
            {touched.state && errors.state && (
              <span className="error-message" role="alert">{errors.state}</span>
            )}
          </div>

          {/* PIN Code */}
          <div className="form-group">
            <label htmlFor="loc-pincode" className="form-label">
              PIN Code <span className="required-star" aria-hidden="true">*</span>
            </label>
            <input
              id="loc-pincode"
              type="text"
              maxLength={6}
              className={`form-input ${touched.pincode && errors.pincode ? 'input-error' : ''}`}
              placeholder="e.g. 560038"
              value={location.pincode}
              onChange={(e) => handleFieldChange('pincode', e.target.value.replace(/\D/g, ''))}
              onBlur={() => handleBlur('pincode')}
              aria-required="true"
            />
            {touched.pincode && errors.pincode && (
              <span className="error-message" role="alert">{errors.pincode}</span>
            )}
          </div>
        </div>

        {/* Map / Location Selector Placeholder */}
        <div className="form-group" style={{ marginTop: '0.5rem' }}>
          <div className="label-with-badge">
            <label className="form-label" style={{ marginBottom: 0 }}>
              Pinpoint Entrance Location
            </label>
            <span className="coord-badge">
              {location.latitude ? `${location.latitude}, ${location.longitude}` : 'Click map to pin'}
            </span>
          </div>
          <span className="form-hint">
            Click anywhere on the map grid below to position your parking spot pin.
          </span>

          <div
            className="map-selector-placeholder"
            onClick={handleMapPinClick}
            role="button"
            tabIndex={0}
            aria-label="Interactive map placeholder: click to set parking entrance pin coordinates"
          >
            <div className="map-grid-pattern" aria-hidden="true"></div>
            <div className="map-pin-marker" aria-label="Pinned location">
              <svg width="30" height="30" viewBox="0 0 24 24" fill="#000000" stroke="#ffffff" strokeWidth="2">
                <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z" />
                <circle cx="12" cy="9" r="2.5" fill="#ffffff" />
              </svg>
            </div>
            <div className="map-overlay-tag">
              Bengaluru Metro &bull; Coordinates: {location.latitude}, {location.longitude}
            </div>
          </div>
        </div>
      </div>

      <div className="form-actions space-between">
        <button type="button" className="btn btn-secondary" onClick={onBack}>
          Back
        </button>
        <button type="submit" id="btn-step3-continue" className="btn btn-primary btn-large">
          Continue to Details
        </button>
      </div>
    </form>
  );
}
