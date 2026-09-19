// =============================================================================
// ParkWise — Parking Data Service
// =============================================================================
// Service layer connecting API routes and business logic to the database
// repository (AWS DynamoDB with local-first KML fallback).
// =============================================================================

import type { ParkingLocation } from '@/types/parking';
import type { ParkingEvent } from '@/types/events';
import { parkingRepository } from '@/services/db/parkingRepository';
import { isDynamoConfigured, TABLES } from '@/services/db/dynamoClient';

/**
 * Fetch all parking locations.
 */
export async function getAllParkingLocations(): Promise<ParkingLocation[]> {
  return parkingRepository.getAllLocations();
}

/**
 * Fetch a single parking location by ID.
 */
export async function getParkingLocationById(
  id: string
): Promise<ParkingLocation | null> {
  return parkingRepository.getLocationById(id);
}

/**
 * Import/batch-save parking locations into the repository.
 */
export async function importParkingLocations(
  locations: ParkingLocation[]
): Promise<number> {
  return parkingRepository.batchSaveLocations(locations);
}

/**
 * Record a crowdsourced parking event.
 */
export async function recordParkingEvent(event: ParkingEvent): Promise<void> {
  return parkingRepository.saveParkingEvent(event);
}

/**
 * Get recent crowdsourced events for a parking location.
 */
export async function getParkingEvents(
  parkingId: string,
  windowMinutes?: number
): Promise<ParkingEvent[]> {
  return parkingRepository.getRecentEvents(parkingId, windowMinutes);
}

/**
 * Get aggregate dataset statistics.
 */
export async function getParkingDatasetStats() {
  const locations = await getAllParkingLocations();

  const bySource: Record<string, number> = {};
  const byType: Record<string, number> = {};
  let minLat = 90,
    maxLat = -90,
    minLng = 180,
    maxLng = -180;

  for (const loc of locations) {
    bySource[loc.source] = (bySource[loc.source] || 0) + 1;
    byType[loc.type] = (byType[loc.type] || 0) + 1;

    if (loc.latitude < minLat) minLat = loc.latitude;
    if (loc.latitude > maxLat) maxLat = loc.latitude;
    if (loc.longitude < minLng) minLng = loc.longitude;
    if (loc.longitude > maxLng) maxLng = loc.longitude;
  }

  return {
    totalLocations: locations.length,
    bySource,
    byType,
    bounds:
      locations.length > 0
        ? { minLat, maxLat, minLng, maxLng }
        : null,
    backendStorage: {
      provider: isDynamoConfigured() ? 'AWS_DYNAMODB' : 'LOCAL_IN_MEMORY_KML',
      tables: TABLES,
    },
  };
}
