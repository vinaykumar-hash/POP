'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import type { ParkingSearchResult } from '@/types/parking';
import type { UserLocation } from '@/types/user';
import { getStatusColor } from '@/services/availability/availabilityEstimator';
import { BENGALURU_CENTER } from '@/data/constants';

interface ParkingMapProps {
  userLocation?: UserLocation | null;
  parkingResults: ParkingSearchResult[];
  selectedParkingId?: string | null;
  onMarkerSelect: (parkingId: string) => void;
  searchCenter?: { lat: number; lng: number } | null;
  routeCoordinates?: Array<[number, number]> | null;
  routeInfo?: { distance: number; duration: number } | null;
}

const TYPE_ICONS: Record<string, string> = {
  FREE: 'P',
  PAID: '₹',
  PUBLIC: 'P',
  GARAGE: 'G',
  OPEN: 'P',
};

export default function ParkingMap({
  userLocation,
  parkingResults,
  selectedParkingId,
  onMarkerSelect,
  searchCenter,
  routeCoordinates,
  routeInfo,
}: ParkingMapProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const userMarkerRef = useRef<L.Marker | null>(null);
  const userCircleRef = useRef<L.Circle | null>(null);
  const parkingMarkersRef = useRef<Map<string, L.Marker>>(new Map());
  const searchMarkerRef = useRef<L.Marker | null>(null);
  const routePolylineRef = useRef<L.Polyline | null>(null);
  const routeShadowRef = useRef<L.Polyline | null>(null);
  const [isMapReady, setIsMapReady] = useState(false);

  // Initialize map
  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return;

    const center = userLocation
      ? [userLocation.latitude, userLocation.longitude]
      : [BENGALURU_CENTER.latitude, BENGALURU_CENTER.longitude];

    const map = L.map(mapContainerRef.current, {
      center: center as L.LatLngExpression,
      zoom: 14,
      zoomControl: false,
      attributionControl: true,
    });

    // Add zoom control to bottom-right
    L.control.zoom({ position: 'bottomright' }).addTo(map);

    // OpenStreetMap does not need a client API key. Its visual weight is
    // softened in globals.css so the parking markers remain the focus.
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      maxZoom: 19,
    }).addTo(map);

    mapRef.current = map;
    setIsMapReady(true);

    return () => {
      map.remove();
      mapRef.current = null;
      setIsMapReady(false);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Update user location marker
  useEffect(() => {
    if (!mapRef.current || !isMapReady) return;

    if (userLocation) {
      const latlng: L.LatLngExpression = [
        userLocation.latitude,
        userLocation.longitude,
      ];

      if (userMarkerRef.current) {
        userMarkerRef.current.setLatLng(latlng);
      } else {
        const icon = L.divIcon({
          className: '',
          html: '<div class="user-marker" aria-label="Your current location"><span></span></div>',
          iconSize: [32, 32],
          iconAnchor: [16, 16],
        });
        userMarkerRef.current = L.marker(latlng, { icon, zIndexOffset: 1000 })
          .addTo(mapRef.current)
          .bindPopup('You are here');
      }

      // Accuracy circle
      if (userLocation.accuracy) {
        if (userCircleRef.current) {
          userCircleRef.current.setLatLng(latlng);
          userCircleRef.current.setRadius(userLocation.accuracy);
        } else {
          userCircleRef.current = L.circle(latlng, {
            radius: userLocation.accuracy,
            color: 'rgba(37, 99, 235, 0.32)',
            fillColor: 'rgba(37, 99, 235, 0.12)',
            fillOpacity: 0.8,
            weight: 1.5,
          }).addTo(mapRef.current);
        }
      }
    }
  }, [userLocation, isMapReady]);

  // Update parking markers
  const updateParkingMarkers = useCallback(() => {
    if (!mapRef.current || !isMapReady) return;

    const currentIds = new Set(parkingResults.map((r) => r.parking.id));

    // Remove markers no longer in results
    parkingMarkersRef.current.forEach((marker, id) => {
      if (!currentIds.has(id)) {
        marker.remove();
        parkingMarkersRef.current.delete(id);
      }
    });

    // Add/update markers
    parkingResults.forEach((result) => {
      const { parking } = result;
      const latlng: L.LatLngExpression = [parking.latitude, parking.longitude];
      const statusClass = getStatusColor(
        parking.currentAvailability?.status || 'UNKNOWN'
      );
      const isSelected = parking.id === selectedParkingId;
      const typeIcon = TYPE_ICONS[parking.type] || 'P';

      const html = `<div class="parking-marker type-${parking.type.toLowerCase()} status-${statusClass} ${
        isSelected ? 'selected' : ''
      }">${typeIcon}</div>`;

      const existingMarker = parkingMarkersRef.current.get(parking.id);

      if (existingMarker) {
        existingMarker.setLatLng(latlng);
        const el = existingMarker.getElement();
        if (el) {
          el.innerHTML = '';
          const wrapper = document.createElement('div');
          wrapper.innerHTML = html;
          el.appendChild(wrapper.firstChild!);
        }
      } else {
        const icon = L.divIcon({
          className: '',
          html,
          iconSize: [36, 36],
          iconAnchor: [18, 18],
        });

        const marker = L.marker(latlng, { icon })
          .addTo(mapRef.current!)
          .on('click', () => onMarkerSelect(parking.id));

        parkingMarkersRef.current.set(parking.id, marker);
      }
    });
  }, [parkingResults, selectedParkingId, onMarkerSelect, isMapReady]);

  useEffect(() => {
    updateParkingMarkers();
  }, [updateParkingMarkers]);

  // Handle route polyline rendering
  useEffect(() => {
    if (!mapRef.current || !isMapReady) return;

    // Clean up existing route
    if (routePolylineRef.current) {
      routePolylineRef.current.remove();
      routePolylineRef.current = null;
    }
    if (routeShadowRef.current) {
      routeShadowRef.current.remove();
      routeShadowRef.current = null;
    }

    if (routeCoordinates && routeCoordinates.length >= 2) {
      const latlngs: L.LatLngExpression[] = routeCoordinates.map(([lat, lng]) => [lat, lng]);

      // Route shadow (ambient glow)
      const shadow = L.polyline(latlngs, {
        color: '#171717',
        weight: 8,
        opacity: 0.35,
        lineCap: 'round',
        lineJoin: 'round',
      }).addTo(mapRef.current);
      routeShadowRef.current = shadow;

      // Active vibrant polyline
      const polyline = L.polyline(latlngs, {
        color: '#2f6b57',
        weight: 5,
        opacity: 0.95,
        lineCap: 'round',
        lineJoin: 'round',
      }).addTo(mapRef.current);
      routePolylineRef.current = polyline;

      // Fit map bounds to encompass the entire driving path
      mapRef.current.fitBounds(polyline.getBounds(), {
        padding: [60, 60],
        maxZoom: 16,
        animate: true,
        duration: 0.8,
      });
    }
  }, [routeCoordinates, isMapReady]);

  // Fly to selected parking if no route is being drawn
  useEffect(() => {
    if (!mapRef.current || !isMapReady || !selectedParkingId || (routeCoordinates && routeCoordinates.length > 0)) return;

    const result = parkingResults.find(
      (r) => r.parking.id === selectedParkingId
    );
    if (result) {
      mapRef.current.flyTo(
        [result.parking.latitude, result.parking.longitude],
        16,
        { duration: 0.8 }
      );
    }
  }, [selectedParkingId, parkingResults, routeCoordinates, isMapReady]);

  // Fly to search center
  useEffect(() => {
    if (!mapRef.current || !isMapReady || !searchCenter) return;

    mapRef.current.flyTo([searchCenter.lat, searchCenter.lng], 15, {
      duration: 1,
    });

    // Add/update search destination marker
    if (searchMarkerRef.current) {
      searchMarkerRef.current.setLatLng([searchCenter.lat, searchCenter.lng]);
    } else {
      const icon = L.divIcon({
        className: '',
        html: `<div style="
          width: 24px;
          height: 24px;
          background: var(--pw-text, #171717);
          border: 3px solid white;
          border-radius: 50% 50% 50% 0;
          transform: rotate(-45deg);
          box-shadow: 0 2px 8px rgba(0,0,0,0.3);
        "></div>`,
        iconSize: [24, 24],
        iconAnchor: [12, 24],
      });
      searchMarkerRef.current = L.marker(
        [searchCenter.lat, searchCenter.lng],
        { icon, zIndexOffset: 900 }
      )
        .addTo(mapRef.current)
        .bindPopup('Search destination');
    }
  }, [searchCenter, isMapReady]);

  // Center on the user whenever a fresh position is received. This also makes
  // the "my location" button re-center the map after it requests an update.
  useEffect(() => {
    if (!mapRef.current || !isMapReady || !userLocation) return;

    mapRef.current.flyTo(
      [userLocation.latitude, userLocation.longitude],
      15,
      { duration: 1 }
    );
  }, [isMapReady, userLocation]);

  return (
    <div style={{ width: '100%', height: '100%', position: 'relative' }}>
      <div
        ref={mapContainerRef}
        style={{
          width: '100%',
          height: '100%',
          position: 'absolute',
          top: 0,
          left: 0,
        }}
        id="parking-map"
      />

      {/* Floating Route Info Chip (Responsive: below assistant on phone, top-right HUD on desktop) */}
      {routeInfo && (
        <div
          className="map-route-badge"
          id="active-route-badge"
        >
          <span style={{ fontSize: '15px' }}>→</span>
          <span style={{ color: 'var(--pw-text)' }}>
            {(routeInfo.distance / 1000).toFixed(1)} km
          </span>
          <span style={{ opacity: 0.5 }}>•</span>
          <span style={{ color: 'var(--pw-accent)' }}>
            {Math.max(1, Math.round(routeInfo.duration / 60))} min drive
          </span>
        </div>
      )}
    </div>
  );
}
