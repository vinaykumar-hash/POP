import { NextRequest, NextResponse } from 'next/server';
import { extractUserId, cancelBooking } from '@/services/host/inMemoryStore';

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const userId = extractUserId(request.headers.get('authorization'));
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { id } = await params;
  const result = cancelBooking(id, userId);
  if (!result) return NextResponse.json({ error: 'Booking not found' }, { status: 404 });
  return NextResponse.json(result);
}
