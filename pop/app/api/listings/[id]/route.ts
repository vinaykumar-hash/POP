import { NextRequest, NextResponse } from 'next/server';
import { extractUserId } from '@/services/host/inMemoryStore';
import { listingRepository } from '@/services/db/listingRepository';

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const userId = extractUserId(request.headers.get('authorization'));
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { id } = await params;
  const listing = await listingRepository.getListing(id, userId);
  if (!listing) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json(listing);
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const userId = extractUserId(request.headers.get('authorization'));
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { id } = await params;
  const body = await request.json();
  const updated = await listingRepository.updateListing(id, userId, body);
  if (!updated) return NextResponse.json({ error: 'Not found or forbidden' }, { status: 404 });
  return NextResponse.json(updated);
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const userId = extractUserId(request.headers.get('authorization'));
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { id } = await params;
  const success = await listingRepository.deleteListing(id, userId);
  if (!success) return NextResponse.json({ error: 'Not found or forbidden' }, { status: 404 });
  return NextResponse.json({ success: true });
}

