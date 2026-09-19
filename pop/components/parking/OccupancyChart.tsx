'use client';

// =============================================================================
// POP — Occupancy Insights (Crowd-Powered)
// =============================================================================

import type { ParkingLocation } from '@/types/parking';
import { IconTrending, IconRadar, IconTarget } from '@/components/common/Icons';

interface OccupancyChartProps {
  parking: ParkingLocation;
  compact?: boolean;
}

export default function OccupancyChart({ parking, compact = false }: OccupancyChartProps) {
  const availability = parking.currentAvailability;
  const hasData = availability && availability.source !== 'NONE' && availability.status !== 'UNKNOWN';

  if (!hasData) {
    return (
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '12px',
          background: 'var(--pw-surface)',
          padding: compact ? '12px' : '16px',
          borderRadius: 'var(--pw-radius)',
          border: '1px solid var(--pw-border)',
          boxShadow: '0 1px 3px rgba(0,0,0,0.02)',
        }}
      >
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div
            style={{
              padding: '6px',
              borderRadius: '6px',
              background: 'var(--pw-bg)',
              border: '1px solid var(--pw-border)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--pw-primary)',
            }}
          >
            <IconTrending size={16} />
          </div>
          <div>
            <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--pw-text)' }}>
              Availability Insights
            </div>
            <div style={{ fontSize: '11px', color: 'var(--pw-text-tertiary)' }}>
              Crowd-powered by active driver dwell patterns
            </div>
          </div>
        </div>

        {/* Placeholder Bars */}
        <div
          style={{
            display: 'flex',
            alignItems: 'flex-end',
            gap: '3px',
            height: compact ? '40px' : '56px',
            opacity: 0.4,
            padding: '4px 0',
          }}
        >
          {Array.from({ length: 24 }).map((_, i) => {
            const h = Math.sin((i / 24) * Math.PI * 2 + 1) * 0.3 + 0.3;
            return (
              <div
                key={i}
                style={{
                  flex: 1,
                  height: `${Math.max(10, h * (compact ? 36 : 50))}px`,
                  background: 'var(--pw-border)',
                  borderRadius: '2px 2px 0 0',
                }}
              />
            );
          })}
        </div>

        {/* Info Message */}
        <div
          style={{
            textAlign: 'center',
            padding: '10px',
            background: 'var(--pw-bg)',
            borderRadius: '8px',
            border: '1px dashed var(--pw-border)',
          }}
        >
          <div style={{ fontSize: '12px', color: 'var(--pw-text-secondary)', lineHeight: 1.5 }}>
            <strong style={{ color: 'var(--pw-primary)' }}>Awaiting live dwell signals.</strong>
            <br />
            As POP drivers visit this location, continuous occupancy patterns are computed here.
          </div>
        </div>

        {/* How It Works */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: '8px',
          }}
        >
          <div
            style={{
              padding: '8px 10px',
              borderRadius: '8px',
              background: 'var(--pw-bg)',
              border: '1px solid var(--pw-border)',
            }}
          >
            <div style={{ fontSize: '11px', color: 'var(--pw-text-tertiary)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '5px' }}>
              <IconRadar size={13} style={{ color: 'var(--pw-primary)' }} />
              <span>How it works</span>
            </div>
            <div style={{ fontSize: '11px', color: 'var(--pw-text-secondary)', marginTop: '3px', lineHeight: 1.35 }}>
              Nearby user GPS dwell triggers anonymous confirmation
            </div>
          </div>

          <div
            style={{
              padding: '8px 10px',
              borderRadius: '8px',
              background: 'var(--pw-bg)',
              border: '1px solid var(--pw-border)',
            }}
          >
            <div style={{ fontSize: '11px', color: 'var(--pw-text-tertiary)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '5px' }}>
              <IconTarget size={13} style={{ color: 'var(--pw-accent)' }} />
              <span>Accuracy</span>
            </div>
            <div style={{ fontSize: '11px', color: 'var(--pw-text-secondary)', marginTop: '3px', lineHeight: 1.35 }}>
              Probability scores increase as more drivers confirm
            </div>
          </div>
        </div>
      </div>
    );
  }

  // When we have real crowd data, show it
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '12px',
        background: 'var(--pw-surface)',
        padding: compact ? '12px' : '16px',
        borderRadius: 'var(--pw-radius)',
        border: '1px solid var(--pw-border)',
        boxShadow: '0 1px 3px rgba(0,0,0,0.02)',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--pw-text)' }}>
            Live Availability
          </div>
          <div style={{ fontSize: '11px', color: 'var(--pw-text-tertiary)' }}>
            Based on {availability.source === 'CROWDSOURCED' ? 'nearby user GPS dwell' : 'confirmed driver reports'}
          </div>
        </div>
        <div
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            padding: '4px 10px',
            borderRadius: '9999px',
            fontSize: '11px',
            fontWeight: 600,
            background:
              availability.status === 'FULL' || availability.status === 'LIKELY_FULL'
                ? '#fef2f2'
                : availability.status === 'LIMITED'
                ? '#fffbeb'
                : '#ecfdf5',
            color:
              availability.status === 'FULL' || availability.status === 'LIKELY_FULL'
                ? '#dc2626'
                : availability.status === 'LIMITED'
                ? '#b45309'
                : '#059669',
            border: `1px solid ${
              availability.status === 'FULL' || availability.status === 'LIKELY_FULL'
                ? '#fecaca'
                : availability.status === 'LIMITED'
                ? '#fde68a'
                : '#a7f3d0'
            }`,
          }}
        >
          <span
            style={{
              width: '6px',
              height: '6px',
              borderRadius: '50%',
              backgroundColor: 'currentColor',
            }}
          />
          <span>
            {availability.status === 'AVAILABLE'
              ? 'Available'
              : availability.status === 'LIKELY_AVAILABLE'
              ? 'Likely Available'
              : availability.status === 'LIMITED'
              ? 'Limited'
              : availability.status === 'LIKELY_FULL'
              ? 'Likely Full'
              : 'Full'}
          </span>
        </div>
      </div>

      {/* Probability for Next Driver */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          fontSize: '12px',
          padding: '8px 12px',
          background: 'var(--pw-bg)',
          borderRadius: '8px',
          border: '1px solid var(--pw-border)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span style={{ color: 'var(--pw-text-tertiary)', fontSize: '11px', fontWeight: 500 }}>
            Next Driver Chance:
          </span>
          <span
            style={{
              fontWeight: 700,
              color:
                (availability.confidence ?? 0) >= 65
                  ? '#059669'
                  : (availability.confidence ?? 0) >= 35
                  ? '#d97706'
                  : '#dc2626',
            }}
          >
            {availability.confidence ?? 0}%
          </span>
          <span style={{ fontSize: '11px', color: 'var(--pw-text-tertiary)' }}>
            ({(availability.confidence ?? 0) >= 65 ? 'High probability' : (availability.confidence ?? 0) >= 35 ? 'Moderate' : 'Low'})
          </span>
        </div>
        {availability.lastUpdated && (
          <span style={{ fontSize: '11px', color: 'var(--pw-text-tertiary)' }}>
            Updated {formatTimeSince(availability.lastUpdated)}
          </span>
        )}
      </div>

      {/* Spaces Info */}
      {availability.availableSpaces !== undefined && (
        <div
          style={{
            textAlign: 'center',
            padding: '10px',
            background: '#ecfdf5',
            borderRadius: '8px',
            border: '1px solid #a7f3d0',
          }}
        >
          <div style={{ fontSize: '20px', fontWeight: 800, color: '#059669' }}>
            ~{availability.availableSpaces}
          </div>
          <div style={{ fontSize: '11px', color: '#065f46', fontWeight: 500 }}>
            estimated open parking spaces
          </div>
        </div>
      )}
    </div>
  );
}

function formatTimeSince(isoString: string): string {
  const diffMs = Date.now() - new Date(isoString).getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}
