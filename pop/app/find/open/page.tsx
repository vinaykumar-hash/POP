'use client';

import { useState, useEffect, useCallback } from 'react';
import type { ParkingSearchResult, ParkingFilters as ParkingFiltersType, CurrentAvailability } from '@/types/parking';
import type { UserLocation, LocationPermissionState } from '@/types/user';
import type { GeocodingResult } from '@/services/geocoding/geocodingService';
import { getCurrentPosition, isGeolocationSupported } from '@/services/geo/geolocationService';
import { fetchNearbyParking, fetchDrivingRoute, type RouteData } from '@/services/parking/parkingClient';
import { calculateHaversineDistance } from '@/services/geo/haversine';
import { isPromptCooldownActive } from '@/services/user/anonymousUser';
import { BENGALURU_CENTER, DEFAULT_SEARCH_RADIUS } from '@/data/constants';
import Navbar from '@/components/layout/Navbar';
import MapWrapper from '@/components/map/MapWrapper';
import SearchBar from '@/components/search/SearchBar';
import ParkingList from '@/components/parking/ParkingList';
import ParkingDetails from '@/components/parking/ParkingDetails';
import ParkingFilters from '@/components/parking/ParkingFilters';
import type { FilterState } from '@/components/parking/ParkingFilters';
import LocationPermission from '@/components/location/LocationPermission';
import ProximityPrompt from '@/components/location/ProximityPrompt';
import { AiAssistantModal } from '@/components/ai/AiAssistantModal';
import { useProximityTracking } from '@/hooks/useProximityTracking';
import ParkingConfirmDialog from '@/components/parking/ParkingConfirmDialog';
import type { ParkingLocation } from '@/types/parking';
import { IconPin } from '@/components/common/Icons';

export default function OpenParkingPage() {
  // Location state
  const [userLocation, setUserLocation] = useState<UserLocation | null>(null);
  const [locationStatus, setLocationStatus] = useState<LocationPermissionState>('prompt');
  const [locationDismissed, setLocationDismissed] = useState(false);

  // Search state
  const [searchCenter, setSearchCenter] = useState<{ lat: number; lng: number } | null>(null);

  // Parking state
  const [parkingResults, setParkingResults] = useState<ParkingSearchResult[]>([]);
  const [selectedParkingId, setSelectedParkingId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [activeFilters, setActiveFilters] = useState<FilterState>({ types: [] });
  const [activeRoute, setActiveRoute] = useState<RouteData | null>(null);
  const [dismissedProximityId, setDismissedProximityId] = useState<string | null>(null);
  const [isAiModalOpen, setIsAiModalOpen] = useState(false);

  const handleAiSelectParking = useCallback((parking: ParkingLocation) => {
    setParkingResults((prev) => {
      if (prev.some((r) => r.parking.id === parking.id)) return prev;
      return [
        {
          parking,
          straightLineDistance: 0,
        },
        ...prev,
      ];
    });
    setSelectedParkingId(parking.id);
    setSearchCenter({ lat: parking.latitude, lng: parking.longitude });
  }, []);

  // Real-time availability updater callback
  const handleAvailabilityUpdated = useCallback(
    (parkingId: string, newAvailability: CurrentAvailability) => {
      setParkingResults((prev) =>
        prev.map((r) =>
          r.parking.id === parkingId
            ? {
                ...r,
                parking: {
                  ...r.parking,
                  currentAvailability: newAvailability,
                },
              }
            : r
        )
      );
    },
    []
  );

  // Proximity geofencing calculation (< 150m)
  const nearbyProximityParking =
    userLocation && !dismissedProximityId
      ? parkingResults
          .map((r) => ({
            parking: r.parking,
            distance: calculateHaversineDistance(
              userLocation.latitude,
              userLocation.longitude,
              r.parking.latitude,
              r.parking.longitude
            ),
          }))
          .filter((p) => p.distance <= 150 && !isPromptCooldownActive(p.parking.id))
          .sort((a, b) => a.distance - b.distance)[0] || null
      : null;

  // Search for parking around a center point
  const searchParking = useCallback(
    async (lat: number, lng: number, filters?: FilterState) => {
      setIsLoading(true);
      try {
        const f = filters || activeFilters;
        const results = await fetchNearbyParking({
          lat,
          lng,
          radius: DEFAULT_SEARCH_RADIUS,
          types: f.types.length > 0 ? f.types : undefined,
          vehicleType: f.vehicleType,
          covered: f.covered,
          evCharging: f.evCharging,
        });
        setParkingResults(results);
      } catch (error) {
        console.error('[ParkWise] Search failed:', error);
        setParkingResults([]);
      } finally {
        setIsLoading(false);
      }
    },
    [activeFilters]
  );

  // Callback when proximity tracking updates availability
  const handleProximityAvailabilityUpdated = useCallback(() => {
    if (searchCenter) {
      searchParking(searchCenter.lat, searchCenter.lng);
    }
  }, [searchCenter, searchParking]);

  // Real-time 30-second GPS proximity tracking & stay evaluation
  const {
    pendingPrompt,
    respondToPrompt,
    dismissPrompt,
  } = useProximityTracking({
    userLocation: userLocation ? { lat: userLocation.latitude, lng: userLocation.longitude } : null,
    enabled: !!userLocation,
    isNearSpot: !!nearbyProximityParking,
    onAvailabilityUpdated: handleProximityAvailabilityUpdated,
  });
  const requestLocation = useCallback(async () => {
    if (!isGeolocationSupported()) {
      setLocationStatus('unavailable');
      // Fall back to Bengaluru center
      searchParking(BENGALURU_CENTER.latitude, BENGALURU_CENTER.longitude);
      return;
    }

    setLocationStatus('requesting');
    try {
      const location = await getCurrentPosition();
      setUserLocation(location);
      setLocationStatus('granted');
      searchParking(location.latitude, location.longitude);
    } catch {
      setLocationStatus('denied');
      // Fall back to Bengaluru center
      searchParking(BENGALURU_CENTER.latitude, BENGALURU_CENTER.longitude);
    }
  }, [searchParking]);

  // Auto-request location on mount
  useEffect(() => {
    requestLocation();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Handle search destination
  const handleSearch = useCallback(
    (result: GeocodingResult) => {
      setSearchCenter({ lat: result.latitude, lng: result.longitude });
      searchParking(result.latitude, result.longitude);
      setSelectedParkingId(null);
    },
    [searchParking]
  );

  // Handle search clear
  const handleSearchClear = useCallback(() => {
    setSearchCenter(null);
    if (userLocation) {
      searchParking(userLocation.latitude, userLocation.longitude);
    }
  }, [userLocation, searchParking]);

  // Handle filter change
  const handleFiltersChange = useCallback(
    (filters: FilterState) => {
      setActiveFilters(filters);
      const center = searchCenter || (userLocation
        ? { lat: userLocation.latitude, lng: userLocation.longitude }
        : { lat: BENGALURU_CENTER.latitude, lng: BENGALURU_CENTER.longitude });
      searchParking(center.lat, center.lng, filters);
    },
    [searchCenter, userLocation, searchParking]
  );

  // Handle marker/card selection
  const handleSelectParking = useCallback((id: string) => {
    setSelectedParkingId((prev) => (prev === id ? null : id));
  }, []);

  const handleDismissLocation = useCallback(() => {
    setLocationDismissed(true);
    searchParking(BENGALURU_CENTER.latitude, BENGALURU_CENTER.longitude);
  }, [searchParking]);

  // Find selected parking result
  const selectedResult = parkingResults.find(
    (r) => r.parking.id === selectedParkingId
  );

  // Fetch driving route whenever a parking spot is selected
  useEffect(() => {
    if (!selectedParkingId) {
      setActiveRoute(null);
      return;
    }

    const selected = parkingResults.find(
      (r) => r.parking.id === selectedParkingId
    );
    if (!selected) {
      setActiveRoute(null);
      return;
    }

    const originLat =
      userLocation?.latitude ?? searchCenter?.lat ?? BENGALURU_CENTER.latitude;
    const originLng =
      userLocation?.longitude ?? searchCenter?.lng ?? BENGALURU_CENTER.longitude;

    let isMounted = true;
    fetchDrivingRoute(
      originLat,
      originLng,
      selected.parking.latitude,
      selected.parking.longitude
    ).then((route) => {
      if (isMounted) {
        setActiveRoute(route);
      }
    });

    return () => {
      isMounted = false;
    };
  }, [selectedParkingId, userLocation, searchCenter, parkingResults]);

  const showLocationPrompt =
    !locationDismissed &&
    locationStatus !== 'granted' &&
    locationStatus !== 'requesting';

  return (
    <div
      style={{
        position: 'relative',
        width: '100%',
        height: '100vh',
        overflow: 'hidden',
      }}
    >
      {/* Navbar */}
      <Navbar />

      {/* Map fills the viewport */}
      <div
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
        }}
      >
        <MapWrapper
          userLocation={userLocation}
          parkingResults={parkingResults}
          selectedParkingId={selectedParkingId}
          onMarkerSelect={handleSelectParking}
          searchCenter={searchCenter}
          routeCoordinates={activeRoute?.coordinates}
          routeInfo={
            activeRoute
              ? { distance: activeRoute.distance, duration: activeRoute.duration }
              : null
          }
        />
      </div>

      {/* Search overlay */}
      <div
        style={{
          position: 'absolute',
          top: 'calc(var(--navbar-height) + 12px)',
          left: '50%',
          transform: 'translateX(-50%)',
          width: '90%',
          maxWidth: '520px',
          zIndex: 'var(--z-search)',
        }}
      >
        <SearchBar
          onSearch={handleSearch}
          onClear={handleSearchClear}
          placeholder="Where are you going?"
        />

        {/* Compact assistant shortcut */}
        <div style={{ display: 'flex', justifyContent: 'center', marginTop: '8px' }}>
          <button
            type="button"
            onClick={() => setIsAiModalOpen(true)}
            style={{
              padding: '7px 14px',
              borderRadius: '9999px',
              background: 'var(--pw-surface)',
              border: '1px solid var(--pw-border)',
              color: 'var(--pw-text-secondary)',
              fontSize: '12px',
              fontWeight: 700,
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              cursor: 'pointer',
              boxShadow: 'var(--pw-shadow)',
              transition: 'all 0.2s ease',
            }}
            id="btn-open-ai-assistant"
          >
            <span>Ask parking assistant</span>
          </button>
        </div>
      </div>

      {/* Location permission dialog */}
      {showLocationPrompt && locationStatus === 'prompt' && (
        <LocationPermission
          status={locationStatus}
          onRequestPermission={requestLocation}
          onDismiss={handleDismissLocation}
        />
      )}

      {/* Selected parking detail (Responsive: bottom on phone, left on larger screens) */}
      {selectedResult && (
        <div className="details-section-container">
          <div className="details-section-card glass-panel">
            <ParkingDetails
              result={selectedResult}
              onClose={() => setSelectedParkingId(null)}
              onAvailabilityUpdated={(newAvail) =>
                handleAvailabilityUpdated(selectedResult.parking.id, newAvail)
              }
            />
          </div>
        </div>
      )}

      {/* Filters + List panel (when no spot selected) */}
      {!selectedResult && (
        <div
          style={{
            position: 'absolute',
            bottom: 0,
            left: 0,
            right: 0,
            zIndex: 'var(--z-panel)',
          }}
        >
          <div
            style={{
              background: 'rgba(255, 255, 255, 0.94)',
              backdropFilter: 'blur(20px) saturate(1.8)',
              WebkitBackdropFilter: 'blur(20px) saturate(1.8)',
              borderTop: '1px solid var(--pw-border)',
              borderTopLeftRadius: '24px',
              borderTopRightRadius: '24px',
              boxShadow: '0 -10px 40px -10px rgba(0, 0, 0, 0.08)',
              paddingBottom: '16px',
            }}
          >
            {/* Drag handle */}
            <div
              style={{
                display: 'flex',
                justifyContent: 'center',
                padding: '10px 0 6px',
              }}
            >
              <div
                style={{
                  width: '36px',
                  height: '4px',
                  borderRadius: '2px',
                  background: 'var(--pw-border)',
                }}
              />
            </div>

            {/* Header: Live Count + Location Scope */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '4px 18px 8px',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span
                  style={{
                    width: '8px',
                    height: '8px',
                    borderRadius: '50%',
                    backgroundColor: '#10b981',
                    boxShadow: '0 0 0 3px rgba(16, 185, 129, 0.2)',
                    display: 'inline-block',
                  }}
                />
                <span
                  style={{
                    fontSize: '14px',
                    fontWeight: 700,
                    color: 'var(--pw-text)',
                    letterSpacing: '-0.01em',
                  }}
                >
                  {isLoading
                    ? 'Searching nearby...'
                    : `${parkingResults.length} Parking Spot${parkingResults.length !== 1 ? 's' : ''} Nearby`}
                </span>
              </div>

              <div
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '5px',
                  fontSize: '11px',
                  fontWeight: 600,
                  color: 'var(--pw-text-tertiary)',
                  background: 'var(--pw-bg)',
                  padding: '3px 10px',
                  borderRadius: '9999px',
                  border: '1px solid var(--pw-border)',
                }}
              >
                <IconPin size={12} style={{ color: 'var(--pw-primary)' }} />
                <span>Bengaluru</span>
              </div>
            </div>

            {/* Filters */}
            <ParkingFilters onFiltersChange={handleFiltersChange} />

            {/* Parking list */}
            <div style={{ paddingTop: '8px' }}>
              <ParkingList
                results={parkingResults}
                selectedId={selectedParkingId}
                onSelect={handleSelectParking}
                isLoading={isLoading}
              />
            </div>
          </div>
        </div>
      )}

      {/* Google Maps-style location control. It remains available after a
          declined request so the user can try again after changing settings. */}
      <button
        type="button"
        className="locate-me-button"
        onClick={requestLocation}
        disabled={locationStatus === 'requesting'}
        style={{
          bottom: selectedResult ? 'calc(60vh + 24px)' : 'calc(var(--bottom-panel-height) + 60px)',
        }}
        title="Center on my location"
        aria-label="Center on my location"
        id="locate-me-button"
      >
        <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
          <path d="M12 2v3m0 14v3M2 12h3m14 0h3M12 7a5 5 0 1 0 0 10 5 5 0 0 0 0-10Zm0 3a2 2 0 1 1 0 4 2 2 0 0 1 0-4Z" />
        </svg>
      </button>

      {/* Proximity prompt for nearby parking geofence */}
      {nearbyProximityParking && (
        <ProximityPrompt
          nearbyParking={nearbyProximityParking.parking}
          distanceMeters={nearbyProximityParking.distance}
          onDismiss={() => setDismissedProximityId(nearbyProximityParking.parking.id)}
          onAvailabilityUpdated={(newAvail) =>
            handleAvailabilityUpdated(nearbyProximityParking.parking.id, newAvail)
          }
        />
      )}

      {/* AI Parking Assistant Modal (Phase 10) */}
      <AiAssistantModal
        isOpen={isAiModalOpen}
        onClose={() => setIsAiModalOpen(false)}
        onSelectParking={handleAiSelectParking}
        userLat={userLocation?.latitude}
        userLng={userLocation?.longitude}
      />

      {/* 30-Second GPS Dwell Parking Confirmation Dialog */}
      <ParkingConfirmDialog
        promptData={pendingPrompt}
        onConfirm={respondToPrompt}
        onDismiss={dismissPrompt}
      />
    </div>
  );
}
