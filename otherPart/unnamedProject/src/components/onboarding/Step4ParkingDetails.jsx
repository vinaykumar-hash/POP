import React, { useState } from 'react';
import { AVAILABLE_FEATURES } from '../../types/listingModel';

export default function Step4ParkingDetails({ data, onChange, onContinue, onBack }) {
  const [capacityError, setCapacityError] = useState(null);

  const details = data.parkingDetails;

  const handleVehicleType = (type) => {
    onChange({
      ...data,
      parkingDetails: {
        ...details,
        vehicleType: type
      }
    });
  };

  const handleParkingType = (type) => {
    onChange({
      ...data,
      parkingDetails: {
        ...details,
        parkingType: type
      }
    });
  };

  const handleCapacityChange = (val) => {
    const num = parseInt(val, 10);
    if (isNaN(num) || num < 1) {
      setCapacityError('Capacity must be at least 1 vehicle.');
      onChange({
        ...data,
        parkingDetails: {
          ...details,
          capacity: ''
        }
      });
    } else {
      setCapacityError(null);
      onChange({
        ...data,
        parkingDetails: {
          ...details,
          capacity: num
        }
      });
    }
  };

  const handleFeatureToggle = (feature) => {
    const current = details.features || [];
    const exists = current.includes(feature);
    const updated = exists
      ? current.filter((f) => f !== feature)
      : [...current, feature];

    onChange({
      ...data,
      parkingDetails: {
        ...details,
        features: updated
      }
    });
  };

  const handleInstructionsChange = (e) => {
    onChange({
      ...data,
      parkingDetails: {
        ...details,
        instructions: e.target.value
      }
    });
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!details.capacity || details.capacity < 1) {
      setCapacityError('Capacity must be at least 1 vehicle.');
      return;
    }
    onContinue();
  };

  return (
    <form className="step-form-container" onSubmit={handleSubmit} noValidate>
      <div className="step-header">
        <div className="step-badge">Step 4 of 6</div>
        <h1 className="step-title">Tell us about your parking space</h1>
        <p className="step-subtitle">
          Specify vehicle compatibility, capacity, and available amenities.
        </p>
      </div>

      <div className="form-card">
        {/* Vehicle Type Selection */}
        <div className="form-group">
          <label className="form-label">
            Vehicle Type <span className="required-star" aria-hidden="true">*</span>
          </label>
          <div className="tiles-grid" role="radiogroup" aria-label="Vehicle Type">
            {['Car', 'Bike', 'Both'].map((vType) => {
              const isSelected = details.vehicleType === vType;
              return (
                <button
                  key={vType}
                  type="button"
                  role="radio"
                  aria-checked={isSelected}
                  className={`tile-btn ${isSelected ? 'tile-selected' : ''}`}
                  onClick={() => handleVehicleType(vType)}
                >
                  <span className="tile-title">{vType}</span>
                  <span className="tile-subtitle">
                    {vType === 'Car' && 'Sedans, SUVs, Hatchbacks'}
                    {vType === 'Bike' && 'Motorcycles & Scooters'}
                    {vType === 'Both' && 'Flexible for 2-wheelers or 4-wheelers'}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Parking Type Selection */}
        <div className="form-group">
          <label className="form-label">
            Parking Type <span className="required-star" aria-hidden="true">*</span>
          </label>
          <div className="tiles-grid tiles-2" role="radiogroup" aria-label="Parking Type">
            {['Open', 'Covered'].map((pType) => {
              const isSelected = details.parkingType === pType;
              return (
                <button
                  key={pType}
                  type="button"
                  role="radio"
                  aria-checked={isSelected}
                  className={`tile-btn ${isSelected ? 'tile-selected' : ''}`}
                  onClick={() => handleParkingType(pType)}
                >
                  <span className="tile-title">{pType} Parking</span>
                  <span className="tile-subtitle">
                    {pType === 'Open' ? 'Outdoor or open surface space' : 'Basement, garage, or shed shelter'}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Capacity */}
        <div className="form-group">
          <label htmlFor="capacity-input" className="form-label">
            Vehicle Capacity <span className="required-star" aria-hidden="true">*</span>
          </label>
          <div className="capacity-stepper">
            <button
              type="button"
              className="btn-step-counter"
              onClick={() => handleCapacityChange(Math.max(1, (details.capacity || 1) - 1))}
              aria-label="Decrease capacity"
            >
              &minus;
            </button>
            <input
              id="capacity-input"
              type="number"
              min="1"
              max="50"
              className="stepper-value-input"
              value={details.capacity}
              onChange={(e) => handleCapacityChange(e.target.value)}
              aria-label="Vehicle capacity count"
            />
            <button
              type="button"
              className="btn-step-counter"
              onClick={() => handleCapacityChange((details.capacity || 1) + 1)}
              aria-label="Increase capacity"
            >
              &#43;
            </button>
            <span className="capacity-unit-text">
              {details.capacity === 1 ? 'vehicle' : 'vehicles'}
            </span>
          </div>
          {capacityError && (
            <span className="error-message" role="alert">{capacityError}</span>
          )}
        </div>

        {/* Parking Space Features Checkboxes */}
        <div className="form-group">
          <label className="form-label">
            Parking Space Features
          </label>
          <span className="form-hint">Select all amenities available at this parking location:</span>
          
          <div className="features-grid">
            {AVAILABLE_FEATURES.map((feature) => {
              const isChecked = (details.features || []).includes(feature);
              return (
                <label key={feature} className="checkbox-pill-label">
                  <input
                    type="checkbox"
                    className="checkbox-input"
                    checked={isChecked}
                    onChange={() => handleFeatureToggle(feature)}
                  />
                  <span className="checkbox-custom" aria-hidden="true"></span>
                  <span className="checkbox-text">{feature}</span>
                </label>
              );
            })}
          </div>
        </div>

        {/* Additional Instructions */}
        <div className="form-group">
          <label htmlFor="instructions-area" className="form-label">
            Additional Instructions <span className="optional-tag">(Optional)</span>
          </label>
          <textarea
            id="instructions-area"
            className="form-textarea"
            rows="4"
            placeholder="Enter any useful information about entering or using the parking space."
            value={details.instructions}
            onChange={handleInstructionsChange}
          ></textarea>
          <span className="form-hint">e.g. Pillar number, entry gate instructions, security check requirements.</span>
        </div>
      </div>

      <div className="form-actions space-between">
        <button type="button" className="btn btn-secondary" onClick={onBack}>
          Back
        </button>
        <button type="submit" id="btn-step4-continue" className="btn btn-primary btn-large">
          Continue to Pricing
        </button>
      </div>
    </form>
  );
}
