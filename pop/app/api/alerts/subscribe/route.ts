// =============================================================================
// ParkWise — POST /api/alerts/subscribe & GET /api/alerts/subscribe
// =============================================================================

import { NextRequest, NextResponse } from 'next/server';
import {
  subscribeToSpot,
  isUserSubscribed,
  getPendingAlertsForUser,
} from '@/services/alerts/alertService';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { parkingId, userId, parkingName } = body;

    if (!parkingId || !userId) {
      return NextResponse.json(
        { error: 'Both "parkingId" and "userId" are required.' },
        { status: 400 }
      );
    }

    const sub = subscribeToSpot(parkingId, userId, parkingName || 'Bengaluru Parking');

    return NextResponse.json({
      success: true,
      subscription: sub,
      message: `Watching "${parkingName || 'spot'}". You will be notified when a space opens up!`,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Internal Server Error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const userId = searchParams.get('userId');
  const parkingId = searchParams.get('parkingId');

  if (!userId) {
    return NextResponse.json({ error: '"userId" query param required.' }, { status: 400 });
  }

  const isSubscribed = parkingId ? isUserSubscribed(parkingId, userId) : false;
  const pendingAlerts = getPendingAlertsForUser(userId);

  return NextResponse.json({
    userId,
    isSubscribed,
    pendingAlerts,
  });
}
