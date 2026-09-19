// =============================================================================
// ParkWise — API Route: GET /api/parking/[id]
// =============================================================================
// Returns details for a single parking location by ID.
//
// Example:
//   GET /api/parking/MOCK-001
// =============================================================================

import type { NextRequest } from 'next/server';
import { getParkingLocationById } from '@/services/parking/parkingDataService';

export async function GET(
  _request: NextRequest,
  ctx: RouteContext<'/api/parking/[id]'>
) {
  const { id } = await ctx.params;

  try {
    const parking = await getParkingLocationById(id);

    if (!parking) {
      return Response.json(
        { error: `Parking location not found: ${id}` },
        { status: 404 }
      );
    }

    return Response.json({
      success: true,
      parking,
    });
  } catch (error) {
    console.error(`[API] /api/parking/${id} error:`, error);
    return Response.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
