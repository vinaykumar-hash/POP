// =============================================================================
// ParkWise — API Route: POST /api/proximity/confirm
// =============================================================================
// Handles user response to "Did you park here?" prompt/notification.
// Calibrates parking availability in database (100% confidence if yes, reset if no).
// =============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { confirmParkingStatus } from '@/services/availability/proximityService';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { userId, parkingId, didPark } = body;

    if (!userId || !parkingId || typeof didPark !== 'boolean') {
      return NextResponse.json(
        { error: 'Missing required parameters: userId, parkingId, didPark' },
        { status: 400 }
      );
    }

    const result = await confirmParkingStatus({
      userId,
      parkingId,
      didPark,
    });

    return NextResponse.json(result);
  } catch (error) {
    console.error('[ProximityConfirmAPI] Error processing confirmation:', error);
    return NextResponse.json(
      { error: 'Failed to process confirmation.' },
      { status: 500 }
    );
  }
}
