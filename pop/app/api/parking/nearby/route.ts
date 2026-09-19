// =============================================================================
// ParkWise — API Route: GET /api/parking/nearby
// =============================================================================
// Returns nearby parking locations based on latitude, longitude, and radius.
//
// Query parameters:
//   lat    — Latitude (required)
//   lng    — Longitude (required)
//   radius — Search radius in meters (optional, default: 2000)
//
// Example:
//   GET /api/parking/nearby?lat=12.9716&lng=77.5946&radius=3000
// =============================================================================

import { NextRequest } from 'next/server';
import { searchNearbyParking } from '@/services/parking/parkingService';
import { DEFAULT_SEARCH_RADIUS, MAX_SEARCH_RADIUS } from '@/data/constants';
import type { ParkingSortBy } from '@/types/parking';

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const lat = parseFloat(searchParams.get('lat') || '');
  const lng = parseFloat(searchParams.get('lng') || '');
  const radius = Math.min(
    parseFloat(searchParams.get('radius') || '') || DEFAULT_SEARCH_RADIUS,
    MAX_SEARCH_RADIUS
  );

  // Validate required parameters
  if (isNaN(lat) || isNaN(lng)) {
    return Response.json(
      {
        error: 'Missing or invalid required parameters: lat, lng',
        example: '/api/parking/nearby?lat=12.9716&lng=77.5946',
      },
      { status: 400 }
    );
  }

  // Validate coordinate ranges
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) {
    return Response.json(
      { error: 'Coordinates out of range. lat: -90 to 90, lng: -180 to 180' },
      { status: 400 }
    );
  }

  // Parse optional filters
  const typesParam = searchParams.get('types');
  const vehicleTypeParam = searchParams.get('vehicleType');
  const coveredParam = searchParams.get('covered');
  const evChargingParam = searchParams.get('evCharging');
  const sortByParam = searchParams.get('sortBy') as ParkingSortBy | null;

  const filters: Record<string, unknown> = {};
  if (typesParam) {
    filters.types = typesParam.split(',').map((t) => t.trim().toUpperCase());
  }
  if (vehicleTypeParam) {
    filters.vehicleType = vehicleTypeParam.toUpperCase();
  }
  if (coveredParam !== null) {
    filters.covered = coveredParam === 'true';
  }
  if (evChargingParam !== null) {
    filters.evCharging = evChargingParam === 'true';
  }

  try {
    const results = await searchNearbyParking(
      lat,
      lng,
      radius,
      Object.keys(filters).length > 0 ? (filters as any) : undefined,
      sortByParam || 'distance'
    );

    return Response.json({
      success: true,
      count: results.length,
      center: { lat, lng },
      radius,
      results,
    });
  } catch (error) {
    console.error('[API] /api/parking/nearby error:', error);
    return Response.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

