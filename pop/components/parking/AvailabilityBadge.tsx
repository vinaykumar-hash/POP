'use client';

import type { AvailabilityStatus } from '@/types/parking';
import { getStatusLabel, getStatusColor } from '@/services/availability/availabilityEstimator';

interface AvailabilityBadgeProps {
  status: AvailabilityStatus;
  confidence?: number;
  showConfidence?: boolean;
  size?: 'sm' | 'md';
}

export default function AvailabilityBadge({
  status,
  confidence,
  showConfidence = false,
  size = 'md',
}: AvailabilityBadgeProps) {
  const rawLabel = getStatusLabel(status);
  const label = status === 'UNKNOWN' ? 'Active Spot' : rawLabel;
  const colorClass = getStatusColor(status);

  return (
    <span
      className={`availability-badge status-${colorClass}`}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '6px',
        fontSize: size === 'sm' ? '11px' : '12px',
        padding: size === 'sm' ? '3px 8px' : '4px 10px',
        fontWeight: 600,
        borderRadius: '9999px',
        lineHeight: 1,
      }}
      title={
        showConfidence && confidence !== undefined
          ? `${rawLabel} — ${confidence}% probability that next driver finds parking`
          : rawLabel
      }
    >
      <span
        style={{
          width: size === 'sm' ? '6px' : '7px',
          height: size === 'sm' ? '6px' : '7px',
          borderRadius: '50%',
          backgroundColor: 'currentColor',
          display: 'inline-block',
          flexShrink: 0,
        }}
        aria-hidden="true"
      />
      <span>{label}</span>
      {showConfidence && confidence !== undefined && confidence > 0 && (
        <span style={{ opacity: 0.9, fontSize: '0.88em', fontWeight: 700 }}>
          {confidence}% chance
        </span>
      )}
    </span>
  );
}
