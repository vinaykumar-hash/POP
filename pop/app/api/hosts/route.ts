import { NextRequest, NextResponse } from 'next/server';
import { extractUserId } from '@/services/host/inMemoryStore';
import { listingRepository } from '@/services/db/listingRepository';

export async function POST(request: NextRequest) {
  const userId = extractUserId(request.headers.get('authorization'));
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const body = await request.json();
  const updated = await listingRepository.updateHostProfile(userId, body);
  return NextResponse.json(updated);
}

