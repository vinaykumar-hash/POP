'use client';

// =============================================================================
// POP — Smart Spot Alert Button ("Notify When Available")
// =============================================================================

import React, { useState, useEffect } from 'react';
import { getAnonymousUserId } from '@/services/user/anonymousUser';
import { IconBell, IconCheck, IconInfo } from '@/components/common/Icons';

interface SpotAlertButtonProps {
  parkingId: string;
  parkingName: string;
  status?: string;
  className?: string;
}

export const SpotAlertButton: React.FC<SpotAlertButtonProps> = ({
  parkingId,
  parkingName,
  status,
  className = '',
}) => {
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);

  // Check initial subscription state
  useEffect(() => {
    const userId = getAnonymousUserId();
    fetch(`/api/alerts/subscribe?userId=${encodeURIComponent(userId)}&parkingId=${encodeURIComponent(parkingId)}`)
      .then((res) => res.json())
      .then((data) => {
        if (data.isSubscribed) {
          setIsSubscribed(true);
        }
      })
      .catch(() => {});
  }, [parkingId]);

  const handleSubscribe = async (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsLoading(true);
    setFeedback(null);

    const userId = getAnonymousUserId();
    try {
      const res = await fetch('/api/alerts/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          parkingId,
          userId,
          parkingName,
        }),
      });

      const data = await res.json();
      if (res.ok) {
        setIsSubscribed(true);
        setFeedback('Alert active! We will notify you when a spot opens.');
        setTimeout(() => setFeedback(null), 4000);
      }
    } catch {
      setFeedback('Failed to set alert. Please retry.');
      setTimeout(() => setFeedback(null), 3000);
    } finally {
      setIsLoading(false);
    }
  };

  // Only show alert button when parking is FULL, LIMITED, or UNKNOWN
  const isCandidate = status === 'FULL' || status === 'LIMITED' || status === 'UNKNOWN';
  if (!isCandidate && !isSubscribed) {
    return null;
  }

  return (
    <div className={`mt-2 ${className}`}>
      {feedback && (
        <div
          style={{
            marginBottom: '8px',
            padding: '8px 12px',
            borderRadius: '8px',
            backgroundColor: '#eff6ff',
            border: '1px solid #bfdbfe',
            color: '#1e40af',
            fontSize: '12px',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
          }}
        >
          <IconInfo size={14} style={{ color: '#2563eb', flexShrink: 0 }} />
          <span>{feedback}</span>
        </div>
      )}

      <button
        type="button"
        onClick={handleSubscribe}
        disabled={isLoading || isSubscribed}
        style={{
          width: '100%',
          padding: '10px 14px',
          borderRadius: '8px',
          fontSize: '12px',
          fontWeight: 600,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '8px',
          cursor: isSubscribed ? 'default' : isLoading ? 'wait' : 'pointer',
          transition: 'all 0.15s ease',
          backgroundColor: isSubscribed ? '#ecfdf5' : '#fffbeb',
          border: isSubscribed ? '1px solid #a7f3d0' : '1px solid #fde68a',
          color: isSubscribed ? '#065f46' : '#b45309',
        }}
        id={`btn-spot-alert-${parkingId}`}
      >
        {isLoading ? (
          <span
            style={{
              width: '14px',
              height: '14px',
              border: '2px solid #b45309',
              borderTopColor: 'transparent',
              borderRadius: '50%',
              animation: 'spin 0.6s linear infinite',
            }}
          />
        ) : isSubscribed ? (
          <>
            <IconCheck size={14} style={{ color: '#10b981' }} />
            <span>Watching for Spots (Alert Active)</span>
          </>
        ) : (
          <>
            <IconBell size={14} style={{ color: '#d97706' }} />
            <span>Notify Me When Spot Opens</span>
          </>
        )}
      </button>
    </div>
  );
};
