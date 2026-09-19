import { NextRequest, NextResponse } from 'next/server';
import { listingRepository } from '@/services/db/listingRepository';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const status = searchParams.get('status') || 'pending_review';
  const results = await listingRepository.getPendingListings(status);
  return NextResponse.json(results);
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { listingId, action, rejectionReason } = body;
  
  if (action === 'approve') {
    const result = await listingRepository.approveListing(listingId);
    if (!result) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    return NextResponse.json(result);
  }
  
  if (action === 'reject') {
    const result = await listingRepository.rejectListing(listingId, rejectionReason || 'No reason provided');
    if (!result) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    return NextResponse.json(result);
  }
  
  return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
}
