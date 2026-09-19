import { NextRequest, NextResponse } from 'next/server';
import { extractUserId } from '@/services/host/inMemoryStore';
import { listingRepository } from '@/services/db/listingRepository';

export async function GET(request: NextRequest) {
  const userId = extractUserId(request.headers.get('authorization'));
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const profile = await listingRepository.getHostProfile(userId);
  return NextResponse.json(profile);
}

