import React, { useState } from 'react';
import { DAYS_OF_WEEK } from '../../types/listingModel';

export default function Step5PricingAvailability({ data, onChange, onContinue, onBack }) {
  const [errors, setErrors] = useState({});
  const [touched, setTouched] = useState({});

  const pricing = data.pricing;
  const availability = data.availability;

  const validate = () => {
    const errs = {};

    const hourlyNum = parseFloat(pricing.hourly);
    if (!pricing.hourly || isNaN(hourlyNum) || hourlyNum <= 0) {
      errs.hourly = 'Please enter a valid positive price per hour.';
    }

    if (pricing.daily) {
      const dailyNum = parseFloat(pricing.daily);
      if (isNaN(dailyNum) || dailyNum <= 0) {
        errs.daily = 'Daily price must be a positive number if provided.';
      }
    }

    if (!availability.days || availability.days.length === 0) {
      errs.days = 'Please select at least one available day.';
    }

    if (!availability.startTime) {
      errs.startTime = 'Start time is required.';
    }

    if (!availability.endTime) {
      errs.endTime = 'End time is required.';
    }

    if (availability.startTime && availability.endTime && availability.startTime >= availability.endTime) {
      errs.endTime = 'End time must be later than start time.';
    }

    return errs;
  };

  const handlePricingChange = (field, val) => {
    onChange({
      ...data,
      pricing: {
        ...pricing,
        [field]: val
      }
    });
  };

  const handleDayToggle = (day) => {
    const current = availability.days || [];
    const exists = current.includes(day);
    const updated = exists ? current.filter((d) => d !== day) : [...current, day];

    onChange({
      ...data,
      availability: {
        ...availability,
        days: updated
      }
    });
  };

  const selectAllDays = () => {
    onChange({
      ...data,
      availability: {
        ...availability,
        days: [...DAYS_OF_WEEK]
      }
    });
  };

  const selectWeekdays = () => {
    onChange({
      ...data,
      availability: {
        ...availability,
        days: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday']
      }
    });
  };

  const selectWeekends = () => {
    onChange({
      ...data,
      availability: {
        ...availability,
        days: ['Saturday', 'Sunday']
      }
    });
  };

  const handleTimeChange = (field, val) => {
    onChange({
      ...data,
      availability: {
        ...availability,
        [field]: val
      }
    });
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const errs = validate();
    setErrors(errs);
    setTouched({ hourly: true, days: true, startTime: true, endTime: true });

    if (Object.keys(errs).length === 0) {
      onContinue();
    }
  };

  return (
    <form className="step-form-container" onSubmit={handleSubmit} noValidate>
      <div className="step-header">
        <div className="step-badge">Step 5 of 6</div>
        <h1 className="step-title">Set your price and availability</h1>
        <p className="step-subtitle">
          Define transparent pricing and weekly operating schedules for renters.
        </p>
      </div>

      <div className="form-card">
        {/* Pricing Section */}
        <h2 className="section-title">Pricing (INR &#8377;)</h2>
        <div className="form-row-2">
          {/* Hourly */}
          <div className="form-group">
            <label htmlFor="hourly-price" className="form-label">
              Price per hour <span className="required-star" aria-hidden="true">*</span>
            </label>
            <div className="currency-input-wrapper">
              <span className="currency-symbol">&#8377;</span>
              <input
                id="hourly-price"
                type="number"
                min="1"
                step="1"
                className={`form-input currency-input ${touched.hourly && errors.hourly ? 'input-error' : ''}`}
                placeholder="50"
                value={pricing.hourly}
                onChange={(e) => handlePricingChange('hourly', e.target.value)}
                onBlur={() => setTouched((p) => ({ ...p, hourly: true }))}
                aria-required="true"
              />
              <span className="unit-label">/ hour</span>
            </div>
            {touched.hourly && errors.hourly && (
              <span className="error-message" role="alert">{errors.hourly}</span>
            )}
          </div>

          {/* Daily (Optional) */}
          <div className="form-group">
            <label htmlFor="daily-price" className="form-label">
              Price per day <span className="optional-tag">(Optional)</span>
            </label>
            <div className="currency-input-wrapper">
              <span className="currency-symbol">&#8377;</span>
              <input
                id="daily-price"
                type="number"
                min="1"
                step="1"
                className={`form-input currency-input ${errors.daily ? 'input-error' : ''}`}
                placeholder="400"
                value={pricing.daily}
                onChange={(e) => handlePricingChange('daily', e.target.value)}
              />
              <span className="unit-label">/ day</span>
            </div>
            {errors.daily && (
              <span className="error-message" role="alert">{errors.daily}</span>
            )}
          </div>
        </div>

        <div className="divider-line" aria-hidden="true"></div>

        {/* Availability Section */}
        <h2 className="section-title">Available Days & Hours</h2>
        
        {/* Day presets */}
        <div className="form-group">
          <div className="label-with-badge">
            <label className="form-label" style={{ marginBottom: 0 }}>
              Operating Days <span className="required-star" aria-hidden="true">*</span>
            </label>
            <div className="quick-presets">
              <button type="button" className="btn-preset" onClick={selectAllDays}>All Days</button>
              <button type="button" className="btn-preset" onClick={selectWeekdays}>Weekdays</button>
              <button type="button" className="btn-preset" onClick={selectWeekends}>Weekends</button>
            </div>
          </div>

          <div className="days-chips-grid">
            {DAYS_OF_WEEK.map((day) => {
              const isSelected = (availability.days || []).includes(day);
              return (
                <button
                  key={day}
                  type="button"
                  className={`day-chip ${isSelected ? 'day-chip-selected' : ''}`}
                  onClick={() => handleDayToggle(day)}
                  aria-pressed={isSelected}
                >
                  {day.slice(0, 3)}
                </button>
              );
            })}
          </div>
          {touched.days && errors.days && (
            <span className="error-message" role="alert">{errors.days}</span>
          )}
        </div>

        {/* Operating Hours */}
        <div className="form-row-2">
          <div className="form-group">
            <label htmlFor="start-time" className="form-label">
              Start Time <span className="required-star" aria-hidden="true">*</span>
            </label>
            <input
              id="start-time"
              type="time"
              className={`form-input ${touched.startTime && errors.startTime ? 'input-error' : ''}`}
              value={availability.startTime}
              onChange={(e) => handleTimeChange('startTime', e.target.value)}
              onBlur={() => setTouched((p) => ({ ...p, startTime: true }))}
              aria-required="true"
            />
            {touched.startTime && errors.startTime && (
              <span className="error-message" role="alert">{errors.startTime}</span>
            )}
          </div>

          <div className="form-group">
            <label htmlFor="end-time" className="form-label">
              End Time <span className="required-star" aria-hidden="true">*</span>
            </label>
            <input
              id="end-time"
              type="time"
              className={`form-input ${touched.endTime && errors.endTime ? 'input-error' : ''}`}
              value={availability.endTime}
              onChange={(e) => handleTimeChange('endTime', e.target.value)}
              onBlur={() => setTouched((p) => ({ ...p, endTime: true }))}
              aria-required="true"
            />
            {touched.endTime && errors.endTime && (
              <span className="error-message" role="alert">{errors.endTime}</span>
            )}
          </div>
        </div>

        <div className="schedule-summary-box">
          <strong>Selected Schedule:</strong>{' '}
          {availability.days?.length > 0 ? (
            <span>
              {availability.days.length === 7 ? 'All week (Mon–Sun)' : availability.days.join(', ')} &bull; {availability.startTime || '--'} to {availability.endTime || '--'}
            </span>
          ) : (
            <span className="text-muted">No days selected yet</span>
          )}
        </div>
      </div>

      <div className="form-actions space-between">
        <button type="button" className="btn btn-secondary" onClick={onBack}>
          Back
        </button>
        <button type="submit" id="btn-step5-continue" className="btn btn-primary btn-large">
          Continue to Review
        </button>
      </div>
    </form>
  );
}
