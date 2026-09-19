// =============================================================================
// ParkWise — API Route: POST /api/parking/events
// =============================================================================
// Receives crowdsourced driver signals ("I Parked", "Spot Available", "Lot Full"),
// records them to the database (ParkWise-Events with TTL), and recalculates
// live availability for the parking spot in real time.
// =============================================================================

import { NextRequest, NextResponse } from 'next/server';
import type { ParkingEvent, ParkingEventType } from '@/types/events';
import type { CurrentAvailability } from '@/types/parking';
import { parkingRepository } from '@/services/db/parkingRepository';
import { publishParkingEvent } from '@/services/events/eventBridgeClient';
import { checkAndTriggerAlerts } from '@/services/alerts/alertService';

const VALID_EVENT_TYPES: ParkingEventType[] = [
  'PARKING_CONFIRMED',
  'PARKING_REJECTED',
  'PARKING_AVAILABLE_REPORTED',
  'PARKING_FULL_REPORTED',
  'USER_LEFT',
  'GEOFENCE_ENTERED',
  'GEOFENCE_EXITED',
  'USER_APPROACHING',
  'AVAILABILITY_REPORTED',
];

// Helper to compute the probability (0-100%) that the NEXT incoming driver will find parking
function computeNextUserParkingProbability(availableSpaces: number, capacity: number): number {
  if (availableSpaces <= 0) return 5;   // Lot full - virtually zero chance
  if (availableSpaces === 1) return 20;  // 1 spot left - very high risk
  if (availableSpaces === 2) return 35;  // 2 spots left
  if (availableSpaces === 3) return 48;  // 3 spots left
  
  // Scale with ratio of remaining open spaces to total capacity
  const ratio = availableSpaces / Math.max(availableSpaces, capacity);
  return Math.min(95, Math.max(55, Math.round(45 + ratio * 70)));
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { parkingId, eventType, anonymousUserId, metadata } = body;

    if (!parkingId || typeof parkingId !== 'string') {
      return NextResponse.json(
        { error: 'Missing or invalid parkingId' },
        { status: 400 }
      );
    }

    if (!eventType || !VALID_EVENT_TYPES.includes(eventType as ParkingEventType)) {
      return NextResponse.json(
        { error: `Invalid eventType. Allowed: ${VALID_EVENT_TYPES.join(', ')}` },
        { status: 400 }
      );
    }

    const userId = (anonymousUserId && typeof anonymousUserId === 'string')
      ? anonymousUserId
      : `anon_${Math.random().toString(36).substring(2, 9)}`;

    // 1. Create and persist event
    const event: ParkingEvent = {
      id: `evt_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      parkingId,
      eventType: eventType as ParkingEventType,
      timestamp: new Date().toISOString(),
      anonymousUserId: userId,
      metadata: metadata || {},
    };

    await parkingRepository.saveParkingEvent(event);

    // 2. Fetch current parking record
    const location = await parkingRepository.getLocationById(parkingId);
    let updatedAvailability: CurrentAvailability | null = null;

    if (location) {
      const prev = location.currentAvailability;
      const nowIso = new Date().toISOString();
      const totalCap = location.capacity || (location.areaSquareMeters ? Math.max(5, Math.floor(location.areaSquareMeters / 28)) : 20);

      switch (eventType) {
        case 'PARKING_FULL_REPORTED':
          updatedAvailability = {
            status: 'FULL',
            confidence: 5, // 5% chance for next driver
            source: 'CROWDSOURCED',
            availableSpaces: 0,
            lastUpdated: nowIso,
          };
          break;

        case 'PARKING_AVAILABLE_REPORTED': {
          const newSpaces = Math.max(4, Math.round(totalCap * 0.45));
          const prob = Math.max(80, computeNextUserParkingProbability(newSpaces, totalCap));
          updatedAvailability = {
            status: 'AVAILABLE',
            confidence: prob,
            source: 'CROWDSOURCED',
            availableSpaces: newSpaces,
            lastUpdated: nowIso,
          };
          break;
        }

        case 'PARKING_CONFIRMED': {
          // Driver parked -> 1 space consumed
          const currentSpaces = prev?.availableSpaces !== undefined ? prev.availableSpaces : Math.max(2, Math.round(totalCap * 0.35));
          const newSpaces = Math.max(0, currentSpaces - 1);
          const prob = computeNextUserParkingProbability(newSpaces, totalCap);
          const status = newSpaces === 0 ? 'FULL' : newSpaces <= 3 ? 'LIMITED' : (prob >= 80 ? 'AVAILABLE' : 'LIKELY_AVAILABLE');

          updatedAvailability = {
            status,
            confidence: prob,
            source: 'CROWDSOURCED',
            availableSpaces: newSpaces,
            occupiedSpaces: (prev?.occupiedSpaces || 0) + 1,
            lastUpdated: nowIso,
          };
          break;
        }

        case 'USER_LEFT': {
          // Driver departed -> 1 space freed up
          const currentSpaces = prev?.availableSpaces !== undefined ? prev.availableSpaces : Math.max(1, Math.round(totalCap * 0.2));
          const newSpaces = Math.min(totalCap, currentSpaces + 1);
          const prob = computeNextUserParkingProbability(newSpaces, totalCap);
          const status = newSpaces <= 3 ? 'LIMITED' : (prob >= 80 ? 'AVAILABLE' : 'LIKELY_AVAILABLE');

          updatedAvailability = {
            status,
            confidence: prob,
            source: 'CROWDSOURCED',
            availableSpaces: newSpaces,
            occupiedSpaces: Math.max(0, (prev?.occupiedSpaces || 1) - 1),
            lastUpdated: nowIso,
          };
          break;
        }

        default:
          // Informational events don't directly flip availability state
          break;
      }

      if (updatedAvailability) {
        await parkingRepository.updateLocationAvailability(parkingId, updatedAvailability);

        // Check if any drivers subscribed to alerts for this parking spot
        if (updatedAvailability.status === 'AVAILABLE') {
          await checkAndTriggerAlerts(parkingId, 'AVAILABLE', location.name);
        }
      }

      // Publish to AWS EventBridge / Local Event Bus asynchronously
      const ebDetailType =
        eventType === 'PARKING_CONFIRMED'
          ? 'DriverParked'
          : eventType === 'USER_LEFT'
          ? 'DriverDeparted'
          : 'ParkingAvailabilityReported';

      await publishParkingEvent(ebDetailType, {
        parkingId,
        eventType,
        timestamp: event.timestamp,
        source: 'CROWDSOURCED',
        anonymousUserId: userId,
        status: updatedAvailability?.status || location.currentAvailability?.status,
        confidence: updatedAvailability?.confidence || location.currentAvailability?.confidence,
        availableSpaces: updatedAvailability?.availableSpaces,
      });
    }

    const feedbackMsg =
      eventType === 'PARKING_CONFIRMED'
        ? `Spot recorded! Next driver has a ~${updatedAvailability?.confidence ?? 65}% chance of finding parking.`
        : eventType === 'USER_LEFT'
        ? `Spot freed up! Next driver chance increased to ${updatedAvailability?.confidence ?? 75}%.`
        : eventType === 'PARKING_FULL_REPORTED'
        ? `Lot marked full. Next driver chance updated to ${updatedAvailability?.confidence ?? 5}%.`
        : `Open spots reported! Next driver chance updated to ${updatedAvailability?.confidence ?? 85}%.`;

    return NextResponse.json({
      success: true,
      event,
      updatedAvailability: updatedAvailability || location?.currentAvailability,
      eventBridgeDispatched: true,
      message: feedbackMsg,
    });
  } catch (error) {
    console.error('[API] /api/parking/events error:', error);
    return NextResponse.json(
      { error: 'Internal server error processing parking event' },
      { status: 500 }
    );
  }
}
