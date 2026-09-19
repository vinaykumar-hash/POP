import { NextRequest, NextResponse } from 'next/server';
import { extractUserId, resubmitListing } from '@/services/host/inMemoryStore';

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const userId = extractUserId(request.headers.get('authorization'));
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { id } = await params;
  const result = resubmitListing(id, userId);
  if (!result) return NextResponse.json({ error: 'Not found or forbidden' }, { status: 404 });
  return NextResponse.json(result);
}
