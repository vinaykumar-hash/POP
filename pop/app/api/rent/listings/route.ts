import { NextRequest, NextResponse } from 'next/server';
import { listingRepository } from '@/services/db/listingRepository';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const query = searchParams.get('query') || undefined;
    const vehicleType = searchParams.get('vehicleType') || undefined;
    const parkingType = searchParams.get('parkingType') || undefined;
    const maxHourlyStr = searchParams.get('maxHourly');
    const maxHourly = maxHourlyStr ? parseFloat(maxHourlyStr) : undefined;

    const listings = await listingRepository.getPublicRentListings({
      query,
      vehicleType,
      parkingType,
      maxHourly,
    });

    return NextResponse.json(listings);
  } catch (error: any) {
    console.error('[API /api/rent/listings] Error fetching rent listings:', error);
    return NextResponse.json(
      { error: error?.message || 'Failed to fetch parking listings' },
      { status: 500 }
    );
  }
}
