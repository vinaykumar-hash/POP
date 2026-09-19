'use client';

import type { ParkingSearchResult } from '@/types/parking';
import ParkingCard from './ParkingCard';
import { IconParking } from '@/components/common/Icons';

interface ParkingListProps {
  results: ParkingSearchResult[];
  selectedId?: string | null;
  onSelect: (parkingId: string) => void;
  isLoading?: boolean;
}

export default function ParkingList({
  results,
  selectedId,
  onSelect,
  isLoading = false,
}: ParkingListProps) {
  if (isLoading) {
    return (
      <div
        className="hide-scrollbar"
        style={{
          display: 'flex',
          gap: '12px',
          overflowX: 'auto',
          padding: '4px 16px',
        }}
      >
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            className="skeleton"
            style={{
              minWidth: '220px',
              height: '120px',
              borderRadius: 'var(--pw-radius)',
              flexShrink: 0,
            }}
          />
        ))}
      </div>
    );
  }

  if (results.length === 0) {
    return (
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '32px 16px',
          gap: '8px',
          color: 'var(--pw-text-tertiary)',
        }}
      >
        <div
          style={{
            width: '48px',
            height: '48px',
            borderRadius: '50%',
            background: 'var(--pw-surface)',
            border: '1px solid var(--pw-border)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'var(--pw-text-tertiary)',
          }}
        >
          <IconParking size={24} />
        </div>
        <p style={{ margin: 0, fontSize: '14px', fontWeight: 500 }}>
          No parking found nearby
        </p>
        <p style={{ margin: 0, fontSize: '13px' }}>
          Try increasing the search radius or changing filters
        </p>
      </div>
    );
  }

  return (
    <div
      className="hide-scrollbar"
      style={{
        display: 'flex',
        gap: '12px',
        overflowX: 'auto',
        padding: '4px 16px',
      }}
    >
      {results.map((result) => (
        <ParkingCard
          key={result.parking.id}
          result={result}
          isSelected={selectedId === result.parking.id}
          onClick={() => onSelect(result.parking.id)}
        />
      ))}
    </div>
  );
}
