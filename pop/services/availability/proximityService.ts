// =============================================================================
// ParkWise — Proximity Availability Service
// =============================================================================
// Handles real-time proximity detection and dwell analysis:
// 1. Detects when an active user arrives within 50m of a known parking spot.
// 2. Tracks GPS pings every 30 seconds to evaluate if the user stayed or departed.
// 3. If the user stayed (dwell >= 60s), computes parking probability:
//      - 30s dwell -> 35% probability (slowing/searching)
//      - 60s dwell -> 70% probability (stationary/likely parked)
//      - 90s+ dwell -> 85% probability (high confidence parked)
// 4. Updates parking availability in database with crowd probability.
// 5. Triggers a prompt flag ("Did you park here?") for client notification.
// 6. Processes user confirmation ("Yes" / "No") to calibrate confidence to 100%.
// =============================================================================

import { parkingRepository } from '@/services/db/parkingRepository';
import { calculateHaversineDistance } from '@/services/geo/haversine';
import type { ParkingLocation, CurrentAvailability, AvailabilityStatus } from '@/types/parking';
import type { ParkingEvent } from '@/types/events';

export const PROXIMITY_THRESHOLD_METERS = 50;
export const DWELL_CONFIRMATION_SECONDS = 60;

export interface TrackingPing {
  lat: number;
  lng: number;
  timestamp: number;
}

export interface ProximitySession {
  userId: string;
  parkingId: string;
  parkingName: string;
  firstDetectedAt: number;
  lastPingAt: number;
  pingCount: number;
  dwellDurationSeconds: number;
  stayed: boolean;
  parkingProbability: number;
  prompted: boolean;
  confirmed: boolean | null;
  coordinates: TrackingPing[];
}

// In-memory store of active proximity tracking sessions (keyed by `userId:parkingId`)
const activeSessions = new Map<string, ProximitySession>();

/**
 * Find the closest parking spot within PROXIMITY_THRESHOLD_METERS.
 */
export async function findNearbySpot(
  lat: number,
  lng: number,
  maxDistanceMeters: number = PROXIMITY_THRESHOLD_METERS
): Promise<{ parking: ParkingLocation; distanceMeters: number } | null> {
  const allLocations = await parkingRepository.getAllLocations();
  let closest: { parking: ParkingLocation; distanceMeters: number } | null = null;

  for (const loc of allLocations) {
    const dist = calculateHaversineDistance(lat, lng, loc.latitude, loc.longitude);
    if (dist <= maxDistanceMeters) {
      if (!closest || dist < closest.distanceMeters) {
        closest = { parking: loc, distanceMeters: dist };
      }
    }
  }

  return closest;
}

/**
 * Process a GPS ping from a user.
 * Called every 30 seconds by the client when active or near parking.
 */
export async function processProximityPing(params: {
  userId: string;
  lat: number;
  lng: number;
  timestamp?: number;
}): Promise<{
  isNearParking: boolean;
  parkingId?: string;
  parkingName?: string;
  distanceMeters?: number;
  dwellSeconds: number;
  probability: number;
  shouldPrompt: boolean;
  session?: ProximitySession;
}> {
  const { userId, lat, lng } = params;
  const now = params.timestamp || Date.now();

  const nearby = await findNearbySpot(lat, lng);

  if (!nearby) {
    // User is not near any spot. Check if they had an active session that just moved away
    for (const [key, session] of activeSessions.entries()) {
      if (session.userId === userId && !session.stayed && !session.confirmed) {
        // User departed before staying -> clean up
        activeSessions.delete(key);
      }
    }

    return {
      isNearParking: false,
      dwellSeconds: 0,
      probability: 0,
      shouldPrompt: false,
    };
  }

  const { parking, distanceMeters } = nearby;
  const sessionKey = `${userId}:${parking.id}`;
  let session = activeSessions.get(sessionKey);

  if (!session) {
    // First ping near this spot
    session = {
      userId,
      parkingId: parking.id,
      parkingName: parking.name,
      firstDetectedAt: now,
      lastPingAt: now,
      pingCount: 1,
      dwellDurationSeconds: 0,
      stayed: false,
      parkingProbability: 15,
      prompted: false,
      confirmed: null,
      coordinates: [{ lat, lng, timestamp: now }],
    };
    activeSessions.set(sessionKey, session);
  } else {
    // Follow-up ping (e.g. 30s interval)
    session.lastPingAt = now;
    session.pingCount += 1;
    session.dwellDurationSeconds = Math.max(
      0,
      Math.round((now - session.firstDetectedAt) / 1000)
    );
    session.coordinates.push({ lat, lng, timestamp: now });

    // Calculate probability based on dwell time
    if (session.dwellDurationSeconds >= 90) {
      session.parkingProbability = 85;
      session.stayed = true;
    } else if (session.dwellDurationSeconds >= DWELL_CONFIRMATION_SECONDS) {
      session.parkingProbability = 70;
      session.stayed = true;
    } else if (session.dwellDurationSeconds >= 30) {
      session.parkingProbability = 40;
    } else {
      session.parkingProbability = 20;
    }
  }

  let shouldPrompt = false;

  // If user stayed (>= 60s) and hasn't been prompted yet, trigger prompt and update DB
  if (session.stayed && !session.prompted && session.confirmed === null) {
    shouldPrompt = true;
    session.prompted = true;

    // Determine updated availability status
    // If probability is high (>=70%), mark as LIMITED or LIKELY_FULL to warn other users
    const updatedStatus: AvailabilityStatus =
      session.parkingProbability >= 80 ? 'LIMITED' : 'LIKELY_AVAILABLE';

    const newAvailability: CurrentAvailability = {
      status: updatedStatus,
      confidence: session.parkingProbability,
      source: 'CROWDSOURCED',
      lastUpdated: new Date().toISOString(),
    };

    // Update in database / repository
    await parkingRepository.updateLocationAvailability(parking.id, newAvailability);
    console.log(
      `[ProximityService] User ${userId} stayed at ${parking.name} (${session.dwellDurationSeconds}s). Updated availability with ${session.parkingProbability}% probability.`
    );
  }

  return {
    isNearParking: true,
    parkingId: parking.id,
    parkingName: parking.name,
    distanceMeters: Math.round(distanceMeters),
    dwellSeconds: session.dwellDurationSeconds,
    probability: session.parkingProbability,
    shouldPrompt,
    session,
  };
}

/**
 * Handle user response to "Did you park here?" notification.
 */
export async function confirmParkingStatus(params: {
  userId: string;
  parkingId: string;
  didPark: boolean;
}): Promise<{ success: boolean; message: string; availability?: CurrentAvailability }> {
  const { userId, parkingId, didPark } = params;
  const sessionKey = `${userId}:${parkingId}`;
  const session = activeSessions.get(sessionKey);

  if (session) {
    session.confirmed = didPark;
  }

  const parking = await parkingRepository.getLocationById(parkingId);
  if (!parking) {
    return { success: false, message: 'Parking spot not found.' };
  }

  if (didPark) {
    // User explicitly confirmed they parked
    const confirmedAvailability: CurrentAvailability = {
      status: 'LIMITED',
      confidence: 100,
      source: 'CONFIRMED',
      lastUpdated: new Date().toISOString(),
    };

    await parkingRepository.updateLocationAvailability(parkingId, confirmedAvailability);

    // Also record crowd event
    const event: ParkingEvent = {
      id: `evt_park_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
      parkingId,
      anonymousUserId: userId,
      eventType: 'PARKING_CONFIRMED',
      timestamp: new Date().toISOString(),
      metadata: {
        status: 'LIMITED',
        createdVia: 'APP_NOTIFICATION',
      },
    };
    await parkingRepository.saveParkingEvent(event);

    return {
      success: true,
      message: `Confirmed parking at ${parking.name}. Thank you for contributing to live availability!`,
      availability: confirmedAvailability,
    };
  } else {
    // User did not park (just passing through or stopped briefly)
    // Downgrade or clear the probability
    const clearedAvailability: CurrentAvailability = {
      status: parking.currentAvailability?.status === 'LIMITED' ? 'UNKNOWN' : parking.currentAvailability?.status || 'UNKNOWN',
      confidence: 0,
      source: 'NONE',
      lastUpdated: new Date().toISOString(),
    };

    await parkingRepository.updateLocationAvailability(parkingId, clearedAvailability);

    const event: ParkingEvent = {
      id: `evt_reject_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
      parkingId,
      anonymousUserId: userId,
      eventType: 'PARKING_REJECTED',
      timestamp: new Date().toISOString(),
      metadata: {
        createdVia: 'APP_NOTIFICATION',
      },
    };
    await parkingRepository.saveParkingEvent(event);

    return {
      success: true,
      message: `Thanks for letting us know! Live status updated.`,
      availability: clearedAvailability,
    };
  }
}

/**
 * Get active session for a user (if any).
 */
export function getUserProximitySession(userId: string): ProximitySession | null {
  for (const session of activeSessions.values()) {
    if (session.userId === userId) {
      return session;
    }
  }
  return null;
}

/**
 * Clear session (for testing/simulation).
 */
export function clearUserProximitySessions(userId: string): void {
  for (const [key, session] of activeSessions.entries()) {
    if (session.userId === userId) {
      activeSessions.delete(key);
    }
  }
}
