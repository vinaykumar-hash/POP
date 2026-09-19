'use client';

import { useState } from 'react';
import type { ParkingLocation, CurrentAvailability } from '@/types/parking';
import { reportParkingEvent } from '@/services/parking/parkingClient';
import { setPromptDismissed } from '@/services/user/anonymousUser';
import { IconCar, IconPin, IconCheck, IconClose } from '@/components/common/Icons';

interface ProximityPromptProps {
  nearbyParking: ParkingLocation;
  distanceMeters: number;
  onDismiss: () => void;
  onAvailabilityUpdated?: (newAvailability: CurrentAvailability) => void;
}

export default function ProximityPrompt({
  nearbyParking,
  distanceMeters,
  onDismiss,
  onAvailabilityUpdated,
}: ProximityPromptProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [confirmed, setConfirmed] = useState(false);

  const handleConfirmParked = async () => {
    setIsSubmitting(true);
    try {
      const res = await reportParkingEvent(nearbyParking.id, 'PARKING_CONFIRMED', {
        distanceMeters,
        trigger: 'PROXIMITY_GEOFENCE',
      });
      setConfirmed(true);
      if (res.updatedAvailability && onAvailabilityUpdated) {
        onAvailabilityUpdated(res.updatedAvailability);
      }
      setTimeout(() => {
        setPromptDismissed(nearbyParking.id);
        onDismiss();
      }, 1500);
    } catch {
      setPromptDismissed(nearbyParking.id);
      onDismiss();
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleReject = () => {
    reportParkingEvent(nearbyParking.id, 'PARKING_REJECTED', {
      distanceMeters,
      trigger: 'PROXIMITY_GEOFENCE',
    }).catch(() => {});
    setPromptDismissed(nearbyParking.id);
    onDismiss();
  };

  return (
    <div
      style={{
        position: 'fixed',
        bottom: '24px',
        left: '50%',
        transform: 'translateX(-50%)',
        width: '90%',
        maxWidth: '440px',
        zIndex: 1100,
        background: 'rgba(15, 23, 42, 0.95)',
        backdropFilter: 'blur(16px)',
        border: '1px solid rgba(56, 189, 248, 0.4)',
        borderRadius: '16px',
        padding: '16px 20px',
        boxShadow: '0 10px 30px rgba(0,0,0,0.5), 0 0 20px rgba(56, 189, 248, 0.2)',
        display: 'flex',
        flexDirection: 'column',
        gap: '12px',
        animation: 'slideUp 0.3s ease',
      }}
      id="proximity-geofence-prompt"
    >
      {confirmed ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', color: '#059669', fontSize: '13px', fontWeight: 600 }}>
          <IconCheck size={16} />
          <span>Thanks! Your parking confirmation was shared with Bengaluru drivers.</span>
        </div>
      ) : (
        <>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '12px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div
                style={{
                  width: '32px',
                  height: '32px',
                  borderRadius: '8px',
                  backgroundColor: 'var(--pw-primary-50)',
                  border: '1px solid var(--pw-primary)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'var(--pw-primary)',
                  flexShrink: 0,
                }}
              >
                <IconPin size={16} />
              </div>
              <div>
                <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--pw-text)' }}>
                  You&apos;re near {nearbyParking.name}
                </div>
                <div style={{ fontSize: '11px', color: 'var(--pw-text-tertiary)' }}>
                  ~{Math.round(distanceMeters)} meters away • Are you parking here?
                </div>
              </div>
            </div>
            <button
              type="button"
              onClick={handleReject}
              style={{
                background: 'transparent',
                border: 'none',
                color: 'var(--pw-text-tertiary)',
                cursor: 'pointer',
                padding: '4px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
              aria-label="Dismiss"
            >
              <IconClose size={15} />
            </button>
          </div>

          <div style={{ display: 'flex', gap: '10px' }}>
            <button
              type="button"
              onClick={handleConfirmParked}
              disabled={isSubmitting}
              className="pw-btn pw-btn-primary"
              style={{ flex: 1, padding: '10px 14px', fontSize: '13px', fontWeight: 600, justifyContent: 'center', display: 'flex', alignItems: 'center', gap: '8px' }}
              id="btn-proximity-confirm"
            >
              <IconCar size={15} />
              <span>{isSubmitting ? 'Saving...' : 'Yes, I Parked Here'}</span>
            </button>
            <button
              type="button"
              onClick={handleReject}
              disabled={isSubmitting}
              className="pw-btn pw-btn-secondary"
              style={{ padding: '10px 14px', fontSize: '13px', fontWeight: 600 }}
              id="btn-proximity-dismiss"
            >
              Just Passing
            </button>
          </div>
        </>
      )}
    </div>
  );
}
