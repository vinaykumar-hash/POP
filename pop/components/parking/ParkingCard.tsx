'use client';

import type { ParkingSearchResult } from '@/types/parking';
import { formatDistance, formatDuration } from '@/services/geo/haversine';
import AvailabilityBadge from './AvailabilityBadge';
import {
  IconPin,
  IconCar,
  IconParking,
  IconArea,
  IconSparkles,
} from '@/components/common/Icons';

interface ParkingCardProps {
  result: ParkingSearchResult;
  isSelected?: boolean;
  onClick?: () => void;
}

const TYPE_CONFIG: Record<string, { label: string; bg: string; color: string; border: string }> = {
  FREE: { label: 'Free Plot', bg: '#ecfdf5', color: '#059669', border: '#a7f3d0' },
  PAID: { label: 'Paid Parking', bg: '#eff6ff', color: '#2563eb', border: '#bfdbfe' },
  PUBLIC: { label: 'Public Plot', bg: '#f8fafc', color: '#475569', border: '#e2e8f0' },
  GARAGE: { label: 'Multi-Level', bg: '#f5f3ff', color: '#7c3aed', border: '#ddd6fe' },
  OPEN: { label: 'Open Space', bg: '#f8fafc', color: '#334155', border: '#cbd5e1' },
};

export default function ParkingCard({
  result,
  isSelected = false,
  onClick,
}: ParkingCardProps) {
  const { parking, straightLineDistance, roadDistance, estimatedDriveTime } = result;
  const availability = parking.currentAvailability;

  const rawMeta = (parking.sourceMetadata || {}) as Record<string, any>;
  const rawArea =
    parking.areaSquareMeters ??
    rawMeta.areaSquareMeters ??
    rawMeta.estimatedAreaM2;

  const typeConfig = TYPE_CONFIG[parking.type] || {
    label: parking.type,
    bg: '#f8fafc',
    color: '#475569',
    border: '#e2e8f0',
  };

  // Price formatting
  const priceDisplay =
    parking.pricePerHour !== undefined && parking.pricePerHour > 0
      ? `₹${parking.pricePerHour}/hr`
      : parking.type === 'FREE'
      ? 'Free'
      : 'Check on site';

  const isFree = parking.type === 'FREE' || priceDisplay === 'Free';

  return (
    <button
      type="button"
      className={`modern-parking-card ${isSelected ? 'selected' : ''}`}
      onClick={onClick}
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '12px',
        padding: '16px',
        minWidth: '270px',
        maxWidth: '300px',
        textAlign: 'left',
        cursor: 'pointer',
        flexShrink: 0,
        background: 'var(--pw-surface)',
        borderRadius: '16px',
        border: isSelected
          ? '2px solid var(--pw-primary)'
          : '1px solid var(--pw-border)',
        boxShadow: isSelected
          ? '0 12px 28px -4px rgba(16, 185, 129, 0.25)'
          : '0 2px 8px rgba(0, 0, 0, 0.04)',
        transform: isSelected ? 'translateY(-2px)' : 'none',
        transition: 'all 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
        position: 'relative',
        outline: 'none',
      }}
      id={`parking-card-${parking.id}`}
    >
      {/* Top Row: Icon, Type Badge & Price */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', gap: '8px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div
            style={{
              width: '32px',
              height: '32px',
              borderRadius: '10px',
              backgroundColor: typeConfig.bg,
              border: `1px solid ${typeConfig.border}`,
              color: typeConfig.color,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            <IconParking size={16} />
          </div>
          <span
            style={{
              fontSize: '11px',
              fontWeight: 700,
              textTransform: 'uppercase',
              letterSpacing: '0.04em',
              padding: '3px 8px',
              borderRadius: '6px',
              backgroundColor: typeConfig.bg,
              color: typeConfig.color,
              border: `1px solid ${typeConfig.border}`,
            }}
          >
            {typeConfig.label}
          </span>
        </div>

        {/* Pricing Pill */}
        <span
          style={{
            fontSize: '11px',
            fontWeight: 700,
            padding: '3px 9px',
            borderRadius: '9999px',
            backgroundColor: isFree ? '#ecfdf5' : '#f8fafc',
            color: isFree ? '#059669' : 'var(--pw-text-secondary)',
            border: isFree ? '1px solid #a7f3d0' : '1px solid var(--pw-border)',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '4px',
          }}
        >
          {isFree && <IconSparkles size={11} />}
          <span>{priceDisplay}</span>
        </span>
      </div>

      {/* Middle: Parking Title & Address */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', width: '100%' }}>
        <h3
          style={{
            margin: 0,
            fontSize: '14px',
            fontWeight: 700,
            lineHeight: 1.3,
            color: 'var(--pw-text)',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            letterSpacing: '-0.01em',
          }}
          title={parking.name}
        >
          {parking.name}
        </h3>

        {parking.address ? (
          <div
            style={{
              fontSize: '11px',
              color: 'var(--pw-text-tertiary)',
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            <IconPin size={11} style={{ flexShrink: 0 }} />
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {parking.address}
            </span>
          </div>
        ) : (
          <div style={{ fontSize: '11px', color: 'var(--pw-text-tertiary)' }}>
            Bengaluru Metro Region
          </div>
        )}
      </div>

      {/* Metrics Strip: Commute ETA + Area */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          padding: '6px 10px',
          borderRadius: '8px',
          backgroundColor: 'var(--pw-bg)',
          border: '1px solid var(--pw-border)',
          fontSize: '11px',
          color: 'var(--pw-text-secondary)',
          width: '100%',
          boxSizing: 'border-box',
          justifyContent: 'space-between',
        }}
      >
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
          {roadDistance !== undefined && estimatedDriveTime !== undefined ? (
            <>
              <IconCar size={13} style={{ color: 'var(--pw-accent)' }} />
              <span style={{ fontWeight: 600 }}>
                {formatDistance(roadDistance)} · {formatDuration(estimatedDriveTime)}
              </span>
            </>
          ) : (
            <>
              <IconPin size={13} style={{ color: 'var(--pw-primary)' }} />
              <span style={{ fontWeight: 600 }}>
                {formatDistance(straightLineDistance)}
              </span>
            </>
          )}
        </div>

        {rawArea && rawArea > 0 && (
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', color: 'var(--pw-text-tertiary)' }}>
            <IconArea size={12} />
            <span>{Math.round(rawArea).toLocaleString()} m²</span>
          </div>
        )}
      </div>

      {/* Bottom Row: Availability Status Pill */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
        <AvailabilityBadge
          status={availability?.status || 'UNKNOWN'}
          confidence={availability?.confidence}
          showConfidence={true}
          size="sm"
        />

        <span style={{ fontSize: '11px', color: 'var(--pw-primary)', fontWeight: 600 }}>
          View Details →
        </span>
      </div>
    </button>
  );
}
