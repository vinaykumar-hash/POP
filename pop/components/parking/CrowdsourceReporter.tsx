'use client';

import { useState } from 'react';
import type { CurrentAvailability } from '@/types/parking';
import type { ParkingEventType } from '@/types/events';
import { reportParkingEvent } from '@/services/parking/parkingClient';
import { IconCar, IconLeaving, IconCheck, IconUsers } from '@/components/common/Icons';

interface CrowdsourceReporterProps {
  parkingId: string;
  parkingName: string;
  onAvailabilityUpdated?: (newAvailability: CurrentAvailability) => void;
  compact?: boolean;
}

export default function CrowdsourceReporter({
  parkingId,
  parkingName,
  onAvailabilityUpdated,
  compact = false,
}: CrowdsourceReporterProps) {
  const [submittingType, setSubmittingType] = useState<ParkingEventType | null>(null);
  const [feedbackMessage, setFeedbackMessage] = useState<string | null>(null);
  const [lastReportedType, setLastReportedType] = useState<ParkingEventType | null>(null);

  const handleReport = async (eventType: ParkingEventType) => {
    if (submittingType) return;
    setSubmittingType(eventType);
    setFeedbackMessage(null);

    try {
      const res = await reportParkingEvent(parkingId, eventType);
      setLastReportedType(eventType);
      setFeedbackMessage(res.message);

      if (res.updatedAvailability && onAvailabilityUpdated) {
        onAvailabilityUpdated(res.updatedAvailability);
      }
    } catch {
      setFeedbackMessage('Failed to send report. Please try again.');
    } finally {
      setSubmittingType(null);
    }
  };

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '12px',
        padding: compact ? '14px' : '18px',
        background: 'var(--pw-surface)',
        border: '1px solid var(--pw-border)',
        borderRadius: 'var(--pw-radius)',
        boxShadow: '0 1px 3px rgba(0,0,0,0.03)',
      }}
      id={`crowdsource-reporter-${parkingId}`}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--pw-text)', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <IconUsers size={15} style={{ color: 'var(--pw-primary)' }} />
            <span>Driver Community Signal</span>
          </div>
          <div style={{ fontSize: '11px', color: 'var(--pw-text-tertiary)', marginTop: '2px' }}>
            Tap to share real-time parking status for {parkingName}
          </div>
        </div>
        <span
          style={{
            fontSize: '10px',
            fontWeight: 700,
            padding: '2px 8px',
            borderRadius: '9999px',
            background: 'var(--pw-bg)',
            color: 'var(--pw-text-secondary)',
            border: '1px solid var(--pw-border)',
            letterSpacing: '0.04em',
            textTransform: 'uppercase',
          }}
        >
          Live Feed
        </span>
      </div>

      {/* 4 Action Buttons Grid */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: '8px',
        }}
      >
        <button
          type="button"
          onClick={() => handleReport('PARKING_AVAILABLE_REPORTED')}
          disabled={submittingType !== null}
          style={{
            padding: '9px 12px',
            borderRadius: '8px',
            border: lastReportedType === 'PARKING_AVAILABLE_REPORTED' ? '1.5px solid #10b981' : '1px solid var(--pw-border)',
            background: lastReportedType === 'PARKING_AVAILABLE_REPORTED' ? '#ecfdf5' : 'var(--pw-surface-elevated)',
            color: '#065f46',
            fontSize: '12px',
            fontWeight: 600,
            cursor: submittingType ? 'wait' : 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '6px',
            transition: 'all 0.15s ease',
          }}
          id="btn-report-available"
        >
          <span
            style={{
              width: '8px',
              height: '8px',
              borderRadius: '50%',
              backgroundColor: '#10b981',
              display: 'inline-block',
            }}
          />
          <span>Spot Available</span>
        </button>

        <button
          type="button"
          onClick={() => handleReport('PARKING_FULL_REPORTED')}
          disabled={submittingType !== null}
          style={{
            padding: '9px 12px',
            borderRadius: '8px',
            border: lastReportedType === 'PARKING_FULL_REPORTED' ? '1.5px solid #ef4444' : '1px solid var(--pw-border)',
            background: lastReportedType === 'PARKING_FULL_REPORTED' ? '#fef2f2' : 'var(--pw-surface-elevated)',
            color: '#991b1b',
            fontSize: '12px',
            fontWeight: 600,
            cursor: submittingType ? 'wait' : 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '6px',
            transition: 'all 0.15s ease',
          }}
          id="btn-report-full"
        >
          <span
            style={{
              width: '8px',
              height: '8px',
              borderRadius: '50%',
              backgroundColor: '#ef4444',
              display: 'inline-block',
            }}
          />
          <span>Lot Full</span>
        </button>

        <button
          type="button"
          onClick={() => handleReport('PARKING_CONFIRMED')}
          disabled={submittingType !== null}
          style={{
            padding: '9px 12px',
            borderRadius: '8px',
            border: lastReportedType === 'PARKING_CONFIRMED' ? '1.5px solid #0284c7' : '1px solid var(--pw-border)',
            background: lastReportedType === 'PARKING_CONFIRMED' ? '#f0f9ff' : 'var(--pw-surface-elevated)',
            color: '#075985',
            fontSize: '12px',
            fontWeight: 600,
            cursor: submittingType ? 'wait' : 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '6px',
            transition: 'all 0.15s ease',
          }}
          id="btn-report-parked"
        >
          <IconCar size={14} style={{ color: '#0284c7' }} />
          <span>I Parked Here</span>
        </button>

        <button
          type="button"
          onClick={() => handleReport('USER_LEFT')}
          disabled={submittingType !== null}
          style={{
            padding: '9px 12px',
            borderRadius: '8px',
            border: lastReportedType === 'USER_LEFT' ? '1.5px solid #8b5cf6' : '1px solid var(--pw-border)',
            background: lastReportedType === 'USER_LEFT' ? '#f5f3ff' : 'var(--pw-surface-elevated)',
            color: '#5b21b6',
            fontSize: '12px',
            fontWeight: 600,
            cursor: submittingType ? 'wait' : 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '6px',
            transition: 'all 0.15s ease',
          }}
          id="btn-report-left"
        >
          <IconLeaving size={14} style={{ color: '#8b5cf6' }} />
          <span>Leaving Now</span>
        </button>
      </div>

      {/* Feedback message banner */}
      {feedbackMessage && (
        <div
          style={{
            fontSize: '12px',
            padding: '8px 12px',
            borderRadius: '6px',
            background: '#ecfdf5',
            color: '#065f46',
            border: '1px solid #a7f3d0',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            animation: 'fadeIn 0.2s ease',
          }}
          id="report-feedback-toast"
        >
          <IconCheck size={14} style={{ color: '#10b981' }} />
          <span>{feedbackMessage}</span>
        </div>
      )}
    </div>
  );
}
