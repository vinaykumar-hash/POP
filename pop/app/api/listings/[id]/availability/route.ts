import { NextRequest, NextResponse } from 'next/server';
import { extractUserId, updateAvailability } from '@/services/host/inMemoryStore';

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const userId = extractUserId(request.headers.get('authorization'));
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { id } = await params;
  const body = await request.json();
  const result = updateAvailability(id, userId, body);
  if (!result) return NextResponse.json({ error: 'Not found or forbidden' }, { status: 404 });
  return NextResponse.json(result);
}
