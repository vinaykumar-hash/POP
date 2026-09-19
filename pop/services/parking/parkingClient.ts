// =============================================================================
// ParkWise — Client-Side Parking API Service
// =============================================================================
// Browser-safe data fetcher that queries Next.js API routes (/api/parking/*).
// Safe to import into any 'use client' component.
// =============================================================================

import type { ParkingSearchResult, ParkingLocation, ParkingSortBy, CurrentAvailability } from '@/types/parking';
import type { ParkingEventType } from '@/types/events';
import { getAnonymousUserId } from '@/services/user/anonymousUser';

export interface SearchNearbyParams {
  lat: number;
  lng: number;
  radius?: number;
  types?: string[];
  vehicleType?: string;
  covered?: boolean;
  evCharging?: boolean;
  sortBy?: ParkingSortBy;
}

export interface DatasetStats {
  totalLocations: number;
  bySource: Record<string, number>;
  byType: Record<string, number>;
  bounds: {
    minLat: number;
    maxLat: number;
    minLng: number;
    maxLng: number;
  } | null;
  kmlImport: {
    sourceFile: string;
    totalPlacemarks: number;
    importedCount: number;
    errorCount: number;
    errors: Array<{ placemarkIndex: number; objectId?: string; message: string }>;
  } | null;
}

/**
 * Fetch nearby parking locations via GET /api/parking/nearby.
 */
export async function fetchNearbyParking(
  params: SearchNearbyParams
): Promise<ParkingSearchResult[]> {
  const query = new URLSearchParams({
    lat: params.lat.toString(),
    lng: params.lng.toString(),
  });

  if (params.radius) {
    query.set('radius', params.radius.toString());
  }
  if (params.types && params.types.length > 0) {
    query.set('types', params.types.join(','));
  }
  if (params.vehicleType) {
    query.set('vehicleType', params.vehicleType);
  }
  if (params.covered !== undefined) {
    query.set('covered', params.covered ? 'true' : 'false');
  }
  if (params.evCharging !== undefined) {
    query.set('evCharging', params.evCharging ? 'true' : 'false');
  }
  if (params.sortBy) {
    query.set('sortBy', params.sortBy);
  }

  const response = await fetch(`/api/parking/nearby?${query.toString()}`);
  if (!response.ok) {
    throw new Error(`Failed to fetch nearby parking: ${response.statusText}`);
  }

  const data = await response.json();
  return data.results || [];
}

/**
 * Fetch a single parking location by ID via GET /api/parking/[id].
 */
export async function fetchParkingById(id: string): Promise<ParkingLocation | null> {
  const response = await fetch(`/api/parking/${encodeURIComponent(id)}`);
  if (!response.ok) {
    if (response.status === 404) return null;
    throw new Error(`Failed to fetch parking location: ${response.statusText}`);
  }

  const data = await response.json();
  return data.parking || null;
}

/**
 * Fetch dataset statistics via GET /api/parking/stats.
 */
export async function fetchParkingStats(): Promise<DatasetStats> {
  const response = await fetch('/api/parking/stats');
  if (!response.ok) {
    throw new Error(`Failed to fetch parking stats: ${response.statusText}`);
  }

  const data = await response.json();
  return data;
}

export interface RouteData {
  distance: number;
  duration: number;
  coordinates: Array<[number, number]>;
}

/**
 * Fetch driving route coordinates and metadata via GET /api/routing/route.
 */
export async function fetchDrivingRoute(
  fromLat: number,
  fromLng: number,
  toLat: number,
  toLng: number
): Promise<RouteData | null> {
  try {
    const query = new URLSearchParams({
      fromLat: fromLat.toString(),
      fromLng: fromLng.toString(),
      toLat: toLat.toString(),
      toLng: toLng.toString(),
    });

    const response = await fetch(`/api/routing/route?${query.toString()}`);
    if (!response.ok) {
      return null;
    }

    const data = await response.json();
    return {
      distance: data.distance,
      duration: data.duration,
      coordinates: data.coordinates,
    };
  } catch (error) {
    console.warn('[ParkingClient] Failed to fetch driving route:', error);
    return null;
  }
}

export interface ReportEventResult {
  success: boolean;
  message: string;
  updatedAvailability?: CurrentAvailability;
}

/**
 * Report a crowdsourced parking event ("Spot Available", "Lot Full", "I Parked", "Leaving").
 */
export async function reportParkingEvent(
  parkingId: string,
  eventType: ParkingEventType,
  metadata?: Record<string, unknown>
): Promise<ReportEventResult> {
  const anonymousUserId = getAnonymousUserId();

  const response = await fetch('/api/parking/events', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      parkingId,
      eventType,
      anonymousUserId,
      metadata,
    }),
  });

  if (!response.ok) {
    throw new Error('Failed to submit parking report');
  }

  const data = await response.json();
  return {
    success: data.success,
    message: data.message,
    updatedAvailability: data.updatedAvailability,
  };
}

