// =============================================================================
// ParkWise — API Route: GET /api/parking/stats
// =============================================================================
// Returns aggregate statistics about the ingested parking datasets:
//   - Total count of parking spots
//   - Breakdown by source (OPENCITY, OSM, MOCK/OTHER)
//   - Breakdown by parking type (OPEN, PAID, PUBLIC, etc.)
//   - Bounding box coordinates covering all locations
//   - Details of OpenCity KML ingestion (parsed count, errors, source file)
// =============================================================================

import { NextResponse } from 'next/server';
import { getParkingDatasetStats } from '@/services/parking/parkingDataService';

export async function GET() {
  try {
    const stats = await getParkingDatasetStats();
    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      ...stats,
    });
  } catch (error) {
    console.error('[API] /api/parking/stats error:', error);
    return NextResponse.json(
      { error: 'Failed to retrieve parking statistics' },
      { status: 500 }
     );
  }
}
