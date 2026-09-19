'use client';

import { IconNavigation } from '@/components/common/Icons';

interface DirectionsButtonProps {
  lat: number;
  lng: number;
  name?: string;
  size?: 'sm' | 'md';
}

export default function DirectionsButton({
  lat,
  lng,
  name,
  size = 'md',
}: DirectionsButtonProps) {
  const handleClick = () => {
    // Dynamically import to avoid SSR issues with window
    import('@/services/navigation/googleMapsService').then(
      ({ openGoogleMapsNavigation }) => {
        openGoogleMapsNavigation(lat, lng, name);
      }
    );
  };

  return (
    <button
      type="button"
      className={`pw-btn pw-btn-accent ${size === 'sm' ? 'pw-btn-sm' : ''}`}
      onClick={handleClick}
      id="directions-button"
      style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
    >
      <IconNavigation size={size === 'sm' ? 13 : 15} />
      <span>Directions</span>
    </button>
  );
}
