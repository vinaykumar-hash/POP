// =============================================================================
// ParkWise — API Route: GET /api/routing/route
// =============================================================================
// Returns road distance, estimated travel time, and full GeoJSON coordinates
// between two points using OSRM for interactive map route rendering.
//
// Query parameters:
//   fromLat — Origin latitude (required)
//   fromLng — Origin longitude (required)
//   toLat   — Destination latitude (required)
//   toLng   — Destination longitude (required)
// =============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { getDetailedRoute } from '@/services/routing/osrmService';

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const fromLat = parseFloat(searchParams.get('fromLat') || '');
  const fromLng = parseFloat(searchParams.get('fromLng') || '');
  const toLat = parseFloat(searchParams.get('toLat') || '');
  const toLng = parseFloat(searchParams.get('toLng') || '');

  if (isNaN(fromLat) || isNaN(fromLng) || isNaN(toLat) || isNaN(toLng)) {
    return NextResponse.json(
      { error: 'Missing or invalid coordinates: fromLat, fromLng, toLat, toLng' },
      { status: 400 }
    );
  }

  try {
    const route = await getDetailedRoute(fromLat, fromLng, toLat, toLng);

    if (!route) {
      return NextResponse.json(
        { error: 'Route could not be calculated by routing engine' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      distance: route.distance,
      duration: route.duration,
      coordinates: route.coordinates,
    });
  } catch (error) {
    console.error('[API] /api/routing/route error:', error);
    return NextResponse.json(
      { error: 'Internal server error while calculating route' },
      { status: 500 }
    );
  }
}
