import { NextRequest, NextResponse } from 'next/server';
import { extractUserId, getHostBookings } from '@/services/host/inMemoryStore';

export async function GET(request: NextRequest) {
  const userId = extractUserId(request.headers.get('authorization'));
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  
  const { searchParams } = new URL(request.url);
  const status = searchParams.get('status') || undefined;
  const listingId = searchParams.get('listingId') || undefined;
  
  const results = getHostBookings(userId, { status, listingId });
  return NextResponse.json(results);
}
