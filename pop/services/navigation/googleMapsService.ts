// =============================================================================
// ParkWise — Google Maps Navigation Service
// =============================================================================
// Opens Google Maps for turn-by-turn navigation to a parking location.
// ParkWise handles parking DISCOVERY; Google Maps handles NAVIGATION.
// =============================================================================

/**
 * Generate a Google Maps directions URL for a given destination.
 *
 * @param destLat - Destination latitude
 * @param destLng - Destination longitude
 * @param destName - Optional destination name for the label
 * @param travelMode - Travel mode (default: 'driving')
 * @returns Google Maps URL string
 */
export function getGoogleMapsDirectionsUrl(
  destLat: number,
  destLng: number,
  destName?: string,
  travelMode: 'driving' | 'walking' | 'transit' = 'driving'
): string {
  const destination = `${destLat},${destLng}`;
  const params = new URLSearchParams({
    api: '1',
    destination,
    travelmode: travelMode,
  });

  if (destName) {
    params.set('destination_place_id', '');
    // Use query parameter for a labeled pin
    params.set('query', destName);
  }

  return `https://www.google.com/maps/dir/?${params.toString()}`;
}

/**
 * Open Google Maps navigation in a new tab/window.
 *
 * @param destLat - Destination latitude
 * @param destLng - Destination longitude
 * @param destName - Optional destination name
 * @param travelMode - Travel mode
 */
export function openGoogleMapsNavigation(
  destLat: number,
  destLng: number,
  destName?: string,
  travelMode: 'driving' | 'walking' | 'transit' = 'driving'
): void {
  const url = getGoogleMapsDirectionsUrl(
    destLat,
    destLng,
    destName,
    travelMode
  );
  window.open(url, '_blank', 'noopener,noreferrer');
}

/**
 * Generate a Google Maps search URL for a location.
 * Useful for showing a parking spot on Google Maps without navigation.
 */
export function getGoogleMapsSearchUrl(
  lat: number,
  lng: number,
  query?: string
): string {
  const params = new URLSearchParams({
    api: '1',
    query: query || `${lat},${lng}`,
  });

  return `https://www.google.com/maps/search/?${params.toString()}`;
}
