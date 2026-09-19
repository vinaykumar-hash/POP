'use client';

// =============================================================================
// ParkWise — Parking Confirmation Dialog (Proximity Stay Prompt)
// =============================================================================
// Automatically triggers when proximity tracking detects that a user has
// stayed near a parking spot for >= 60 seconds.
// Prompts the user to verify if they parked, calibrating the live availability.
// =============================================================================

import React, { useState, useEffect } from 'react';
import type { ParkingPromptData } from '@/hooks/useProximityTracking';
import { IconCar, IconPin, IconCheck, IconClose } from '@/components/common/Icons';

interface ParkingConfirmDialogProps {
  promptData: ParkingPromptData | null;
  onConfirm: (didPark: boolean) => void;
  onDismiss: () => void;
}

export default function ParkingConfirmDialog({
  promptData,
  onConfirm,
  onDismiss,
}: ParkingConfirmDialogProps) {
  const [secondsRemaining, setSecondsRemaining] = useState(60);

  useEffect(() => {
    if (!promptData) {
      setSecondsRemaining(60);
      return;
    }

    const timer = setInterval(() => {
      setSecondsRemaining((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          onDismiss();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [promptData, onDismiss]);

  if (!promptData) return null;

  return (
    <div
      style={{
        position: 'fixed',
        bottom: '24px',
        right: '24px',
        zIndex: 9999,
        width: 'calc(100vw - 32px)',
        maxWidth: '380px',
        backgroundColor: 'rgba(255, 255, 255, 0.98)',
        backdropFilter: 'blur(16px)',
        WebkitBackdropFilter: 'blur(16px)',
        border: '1px solid #e2e8f0',
        borderRadius: '16px',
        boxShadow: '0 20px 45px rgba(0, 0, 0, 0.12), 0 4px 12px rgba(0, 0, 0, 0.06)',
        padding: '20px',
        color: '#0f172a',
        animation: 'slideUpFade 0.3s ease-out forwards',
      }}
      role="dialog"
      aria-labelledby="confirm-dialog-title"
    >
      {/* Top Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div
            style={{
              width: '28px',
              height: '28px',
              borderRadius: '8px',
              backgroundColor: '#ecfdf5',
              border: '1px solid #a7f3d0',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#059669',
            }}
          >
            <IconCar size={16} />
          </div>
          <div>
            <span
              id="confirm-dialog-title"
              style={{ fontSize: '14px', fontWeight: 700, letterSpacing: '-0.01em', color: '#0f172a' }}
            >
              Did you park here?
            </span>
          </div>
        </div>

        <button
          onClick={onDismiss}
          style={{
            background: 'none',
            border: 'none',
            color: '#64748b',
            cursor: 'pointer',
            padding: '4px',
            borderRadius: '6px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
          title="Dismiss"
          aria-label="Dismiss"
        >
          <IconClose size={16} />
        </button>
      </div>

      {/* Spot Information */}
      <div
        style={{
          backgroundColor: '#f8fafc',
          border: '1px solid #e2e8f0',
          padding: '12px 14px',
          borderRadius: '10px',
          marginBottom: '14px',
        }}
      >
        <div style={{ fontSize: '15px', fontWeight: 600, color: '#059669', marginBottom: '4px' }}>
          {promptData.parkingName}
        </div>
        <div style={{ fontSize: '12px', color: '#64748b', display: 'flex', alignItems: 'center', gap: '6px' }}>
          <IconPin size={13} style={{ color: '#059669' }} />
          <span>GPS dwell detected near this spot</span>
          <span>•</span>
          <span style={{ color: '#047857', fontWeight: 600 }}>
            {promptData.probability}% confidence
          </span>
        </div>
      </div>

      <p style={{ fontSize: '13px', color: '#475569', margin: '0 0 16px 0', lineHeight: 1.4 }}>
        You stopped nearby for over a minute. Confirming your spot helps other drivers find parking in real time.
      </p>

      {/* Action Buttons */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
        <button
          onClick={() => onConfirm(true)}
          style={{
            backgroundColor: '#10b981',
            color: '#ffffff',
            border: 'none',
            padding: '10px 14px',
            borderRadius: '10px',
            fontSize: '13px',
            fontWeight: 600,
            cursor: 'pointer',
            boxShadow: '0 4px 12px rgba(16, 185, 129, 0.25)',
            transition: 'transform 0.15s ease, background-color 0.15s ease',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '6px',
          }}
          onMouseOver={(e) => ((e.currentTarget as HTMLElement).style.backgroundColor = '#059669')}
          onMouseOut={(e) => ((e.currentTarget as HTMLElement).style.backgroundColor = '#10b981')}
        >
          <IconCheck size={14} />
          <span>Yes, I Parked</span>
        </button>

        <button
          onClick={() => onConfirm(false)}
          style={{
            backgroundColor: '#f1f5f9',
            color: '#334155',
            border: '1px solid #cbd5e1',
            padding: '10px 14px',
            borderRadius: '10px',
            fontSize: '13px',
            fontWeight: 500,
            cursor: 'pointer',
            transition: 'background-color 0.15s ease',
          }}
          onMouseOver={(e) => ((e.currentTarget as HTMLElement).style.backgroundColor = '#e2e8f0')}
          onMouseOut={(e) => ((e.currentTarget as HTMLElement).style.backgroundColor = '#f1f5f9')}
        >
          No, Just Passing
        </button>
      </div>

      {/* Countdown Timer */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginTop: '12px',
          fontSize: '11px',
          color: '#64748b',
        }}
      >
        <span>Auto-dismissing in {secondsRemaining}s</span>
        <div
          style={{
            width: '60px',
            height: '3px',
            backgroundColor: 'rgba(0, 0, 0, 0.08)',
            borderRadius: '2px',
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              height: '100%',
              backgroundColor: '#10b981',
              width: `${(secondsRemaining / 60) * 100}%`,
              transition: 'width 1s linear',
            }}
          />
        </div>
      </div>
    </div>
  );
}
