import { NextRequest, NextResponse } from 'next/server';
import { extractUserId } from '@/services/host/inMemoryStore';
import { listingRepository } from '@/services/db/listingRepository';

export const dynamic = 'force-dynamic';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const userId = extractUserId(request.headers.get('authorization'));
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const cancelled = await listingRepository.cancelUserBooking(id, userId);
    if (!cancelled) {
      return NextResponse.json({ error: 'Booking not found or already cancelled' }, { status: 404 });
    }

    return NextResponse.json({ success: true, booking: cancelled });
  } catch (error: any) {
    console.error('[API POST /api/bookings/[id]/cancel] Error:', error);
    return NextResponse.json({ error: error?.message || 'Failed to cancel booking' }, { status: 500 });
  }
}
