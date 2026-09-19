// =============================================================================
// ParkWise — API Route: POST /api/proximity/track
// =============================================================================
// Receives GPS coordinates from the active web app / mobile client every 30s.
// Evaluates proximity to parking locations, tracks dwell duration, updates
// crowd parking probability, and instructs the client whether to prompt the user.
// =============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { processProximityPing } from '@/services/availability/proximityService';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { userId, lat, lng, timestamp } = body;

    if (!userId || typeof lat !== 'number' || typeof lng !== 'number') {
      return NextResponse.json(
        { error: 'Missing required parameters: userId, lat, lng' },
        { status: 400 }
      );
    }

    const result = await processProximityPing({
      userId,
      lat,
      lng,
      timestamp: timestamp || Date.now(),
    });

    return NextResponse.json({
      success: true,
      ...result,
    });
  } catch (error) {
    console.error('[ProximityTrackAPI] Error processing ping:', error);
    return NextResponse.json(
      { error: 'Failed to process proximity tracking ping.' },
      { status: 500 }
    );
  }
}
