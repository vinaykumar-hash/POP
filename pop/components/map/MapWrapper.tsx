'use client';

import dynamic from 'next/dynamic';
import type { ParkingSearchResult } from '@/types/parking';
import type { UserLocation } from '@/types/user';

/**
 * Dynamic import wrapper for ParkingMap.
 * Leaflet requires browser APIs (window, document) and cannot be rendered on the server.
 * This wrapper uses Next.js dynamic import with ssr: false.
 */
const ParkingMapDynamic = dynamic(
  () => import('@/components/map/ParkingMap'),
  {
    ssr: false,
    loading: () => (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'var(--pw-bg)',
          color: 'var(--pw-text-tertiary)',
          fontSize: '14px',
        }}
      >
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '12px',
          }}
        >
          <div
            style={{
              width: '40px',
              height: '40px',
              border: '3px solid var(--pw-border)',
              borderTopColor: 'var(--pw-primary)',
              borderRadius: '50%',
              animation: 'spin 0.8s linear infinite',
            }}
          />
          <span>Loading map...</span>
          <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        </div>
      </div>
    ),
  }
);

interface MapWrapperProps {
  userLocation?: UserLocation | null;
  parkingResults: ParkingSearchResult[];
  selectedParkingId?: string | null;
  onMarkerSelect: (parkingId: string) => void;
  searchCenter?: { lat: number; lng: number } | null;
  routeCoordinates?: Array<[number, number]> | null;
  routeInfo?: { distance: number; duration: number } | null;
}

export default function MapWrapper(props: MapWrapperProps) {
  return <ParkingMapDynamic {...props} />;
}

