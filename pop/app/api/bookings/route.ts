import { NextRequest, NextResponse } from 'next/server';
import { extractUserId } from '@/services/host/inMemoryStore';
import { listingRepository } from '@/services/db/listingRepository';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const userId = extractUserId(request.headers.get('authorization'));
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized: Sign in required' }, { status: 401 });
    }

    const bookings = await listingRepository.getUserBookings(userId);
    return NextResponse.json(bookings);
  } catch (error: any) {
    console.error('[API GET /api/bookings] Error:', error);
    return NextResponse.json({ error: error?.message || 'Failed to fetch bookings' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    let userId = extractUserId(authHeader);
    
    const body = await request.json();
    const {
      listingId,
      startAt,
      endAt,
      durationHours,
      vehicle,
      pricing,
      renterName,
      renterPhone,
    } = body;

    if (!listingId) {
      return NextResponse.json({ error: 'Missing required field: listingId' }, { status: 400 });
    }

    // If no auth token, create a deterministic driver guest ID
    if (!userId) {
      userId = `driver_guest_${Date.now().toString(36)}`;
    }

    // Fetch listing for summary and host info
    const allListings = await listingRepository.getPublicRentListings();
    const listing = allListings.find((l) => l.listingId === listingId);

    const hourlyRate = pricing?.hourlyRate || (listing?.pricing?.hourly ? parseFloat(listing.pricing.hourly) : 50);
    const hours = durationHours || 2;
    const totalAmount = pricing?.totalAmount || Math.round(hourlyRate * hours);

    const bookingPayload = {
      listingId,
      hostId: listing?.hostId || 'usr_demo_host_01',
      renterId: userId,
      renterName: renterName || 'Driver',
      renterPhone: renterPhone || '+91 99000 11222',
      status: 'confirmed',
      startAt: startAt || new Date().toISOString(),
      endAt: endAt || new Date(Date.now() + hours * 3600000).toISOString(),
      durationHours: hours,
      durationMinutes: hours * 60,
      vehicle: {
        type: vehicle?.type || listing?.parkingDetails?.vehicleType || 'Car',
        registrationNumber: vehicle?.registrationNumber?.toUpperCase() || 'KA-01-AB-1234',
      },
      pricing: {
        hourlyRate,
        totalAmount,
        currency: 'INR',
      },
      listingSummary: {
        title: listing?.parkingDetails ? `${listing.parkingDetails.parkingType} Parking in ${listing.location?.locality || 'Bengaluru'}` : 'Private Parking Space',
        address: listing?.location?.address || 'Prime Spot, Bengaluru',
        locality: listing?.location?.locality || 'Bengaluru',
        parkingType: listing?.parkingDetails?.parkingType || 'Covered',
        vehicleType: listing?.parkingDetails?.vehicleType || 'Car',
        photoUrl: listing?.photos?.[0]?.previewUrl || 'https://images.unsplash.com/photo-1590674899484-d5640e854abe?w=800&auto=format&fit=crop&q=80',
      },
      access: {
        instructions: listing?.parkingDetails?.instructions || 'Display POP digital booking pass to security / host on entry.',
        entryNotes: 'Designated slot will be reserved for your vehicle registration number.',
        hostInstructions: `Host contact: ${listing?.host?.name || 'Priya Sharma'} (${listing?.host?.phone || '+91 98765 43210'})`,
        gatePassCode: `POP-${Math.floor(1000 + Math.random() * 9000)}`,
      },
    };

    const created = await listingRepository.createBooking(bookingPayload);
    return NextResponse.json(created, { status: 201 });
  } catch (error: any) {
    console.error('[API POST /api/bookings] Error:', error);
    return NextResponse.json({ error: error?.message || 'Failed to create booking' }, { status: 500 });
  }
}
