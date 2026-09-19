'use client';

import type { LocationPermissionState } from '@/types/user';
import { IconPin } from '@/components/common/Icons';

interface LocationPermissionProps {
  status: LocationPermissionState;
  onRequestPermission: () => void;
  onDismiss?: () => void;
}

export default function LocationPermission({
  status,
  onRequestPermission,
  onDismiss,
}: LocationPermissionProps) {
  if (status === 'granted') return null;

  return (
    <div
      className="glass-panel animate-fade-in"
      style={{
        position: 'absolute',
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
        zIndex: 'var(--z-modal)',
        padding: '32px',
        maxWidth: '380px',
        width: '90%',
        textAlign: 'center',
        display: 'flex',
        flexDirection: 'column',
        gap: '16px',
        alignItems: 'center',
      }}
      id="location-permission-dialog"
    >
      <div
        style={{
          width: '64px',
          height: '64px',
          borderRadius: '50%',
          background: 'var(--pw-primary-50)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'var(--pw-primary)',
        }}
      >
        <IconPin size={30} />
      </div>

      {status === 'prompt' && (
        <>
          <h3
            style={{
              margin: 0,
              fontSize: '18px',
              fontWeight: 700,
              color: 'var(--pw-text)',
            }}
          >
            Enable Location
          </h3>
          <p
            style={{
              margin: 0,
              fontSize: '14px',
              color: 'var(--pw-text-secondary)',
              lineHeight: 1.6,
            }}
          >
            POP needs your location to find nearby parking spots.
            Your location is used only for search and is never stored or shared.
          </p>
          <button
            type="button"
            className="pw-btn pw-btn-accent"
            onClick={onRequestPermission}
            style={{ width: '100%' }}
          >
            Allow Location Access
          </button>
          {onDismiss && (
            <button
              type="button"
              className="pw-btn pw-btn-secondary pw-btn-sm"
              onClick={onDismiss}
              style={{ width: '100%' }}
            >
              Search manually instead
            </button>
          )}
        </>
      )}

      {status === 'requesting' && (
        <>
          <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 700 }}>
            Requesting Location...
          </h3>
          <p
            style={{
              margin: 0,
              fontSize: '14px',
              color: 'var(--pw-text-secondary)',
            }}
          >
            Please allow location access in your browser prompt.
          </p>
          <div
            style={{
              width: '32px',
              height: '32px',
              border: '3px solid var(--pw-border)',
              borderTopColor: 'var(--pw-primary)',
              borderRadius: '50%',
              animation: 'spin 0.8s linear infinite',
            }}
          />
        </>
      )}

      {status === 'denied' && (
        <>
          <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 700 }}>
            Location Access Denied
          </h3>
          <p
            style={{
              margin: 0,
              fontSize: '14px',
              color: 'var(--pw-text-secondary)',
              lineHeight: 1.6,
            }}
          >
            Location access was denied. You can still search for a destination
            manually, or enable location in your browser settings.
          </p>
          {onDismiss && (
            <button
              type="button"
              className="pw-btn pw-btn-primary"
              onClick={onDismiss}
              style={{ width: '100%' }}
            >
              Search Manually
            </button>
          )}
        </>
      )}

      {status === 'unavailable' && (
        <>
          <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 700 }}>
            Location Unavailable
          </h3>
          <p
            style={{
              margin: 0,
              fontSize: '14px',
              color: 'var(--pw-text-secondary)',
              lineHeight: 1.6,
            }}
          >
            Your browser doesn&apos;t support geolocation.
            You can search for a destination manually.
          </p>
          {onDismiss && (
            <button
              type="button"
              className="pw-btn pw-btn-primary"
              onClick={onDismiss}
              style={{ width: '100%' }}
            >
              Search Manually
            </button>
          )}
        </>
      )}

      {status === 'error' && (
        <>
          <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 700 }}>
            Location Error
          </h3>
          <p
            style={{
              margin: 0,
              fontSize: '14px',
              color: 'var(--pw-text-secondary)',
              lineHeight: 1.6,
            }}
          >
            Could not determine your location. Please try again
            or search for a destination manually.
          </p>
          <button
            type="button"
            className="pw-btn pw-btn-primary"
            onClick={onRequestPermission}
            style={{ width: '100%' }}
          >
            Try Again
          </button>
          {onDismiss && (
            <button
              type="button"
              className="pw-btn pw-btn-secondary pw-btn-sm"
              onClick={onDismiss}
              style={{ width: '100%' }}
            >
              Search Manually
            </button>
          )}
        </>
      )}

      <style jsx>{`
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}
