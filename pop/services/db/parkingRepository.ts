// =============================================================================
// ParkWise — Parking Repository (AWS DynamoDB + Local Fallback)
// =============================================================================
// Clean repository pattern abstracting all database operations for parking
// locations and crowdsourced events.
//
// Loads parking data from ALL KML files in the data/mock/ directory:
//   - OpenCity Bengaluru KML (polygon boundaries from municipal survey)
//   - OSM KML files (point and polygon data from OpenStreetMap)
//
// Automatically falls back to in-memory/KML parser when DynamoDB is unconfigured.
// =============================================================================

import {
  GetCommand,
  PutCommand,
  ScanCommand,
  QueryCommand,
  BatchWriteCommand,
  UpdateCommand,
} from '@aws-sdk/lib-dynamodb';
import type { ParkingLocation, CurrentAvailability } from '@/types/parking';
import type { ParkingEvent } from '@/types/events';
import { getDynamoDocClient, TABLES, isDynamoConfigured } from './dynamoClient';
import { parseOpenCityKml } from '@/services/parking/kmlParser';
import { parseOsmKml } from '@/services/parking/osmKmlParser';
import * as fs from 'fs';
import * as path from 'path';

export interface IParkingRepository {
  getAllLocations(): Promise<ParkingLocation[]>;
  getLocationById(id: string): Promise<ParkingLocation | null>;
  queryLocationsBySource(source: string): Promise<ParkingLocation[]>;
  batchSaveLocations(locations: ParkingLocation[]): Promise<number>;
  saveParkingEvent(event: ParkingEvent): Promise<void>;
  getRecentEvents(parkingId: string, windowMinutes?: number): Promise<ParkingEvent[]>;
  updateLocationAvailability(parkingId: string, availability: CurrentAvailability): Promise<boolean>;
}


// In-memory fallback storage
let localLocationsCache: ParkingLocation[] | null = null;
const localEventsStore: ParkingEvent[] = [];

// The OpenCity KML file (original data source)
const OPENCITY_KML_FILENAME = '4681133c-2c40-4803-93bb-78a4d3fb2249.kml';

/**
 * Load all KML files from the data directory.
 * Auto-detects OpenCity vs OSM format based on schema content.
 */
function getLocalLocations(): ParkingLocation[] {
  if (localLocationsCache) return localLocationsCache;

  const allLocations: ParkingLocation[] = [];
  const kmlDir = path.join(process.cwd(), 'data', 'mock');

  if (!fs.existsSync(kmlDir)) {
    console.warn('[ParkingRepository] KML data directory not found:', kmlDir);
    localLocationsCache = [];
    return localLocationsCache;
  }

  // Find all .kml files in the directory
  const kmlFiles = fs.readdirSync(kmlDir).filter((f) => f.endsWith('.kml'));
  console.log(`[ParkingRepository] Found ${kmlFiles.length} KML file(s) in ${kmlDir}`);

  for (const filename of kmlFiles) {
    const filePath = path.join(kmlDir, filename);

    try {
      if (filename === OPENCITY_KML_FILENAME) {
        // Use the OpenCity parser for the original municipal data
        const result = parseOpenCityKml(filePath);
        allLocations.push(...result.locations);
        console.log(
          `[ParkingRepository] OpenCity KML: ${result.locations.length} locations parsed ` +
          `(${result.errors.length} errors) from ${filename}`
        );
      } else {
        // Use the OSM parser for all other KML files
        const result = parseOsmKml(filePath);
        allLocations.push(...result.locations);
        console.log(
          `[ParkingRepository] OSM KML: ${result.locations.length} locations parsed ` +
          `(${result.pointPlacemarks} points, ${result.polygonPlacemarks} polygons, ` +
          `${result.errors.length} errors) from ${filename}`
        );
      }
    } catch (err) {
      console.error(`[ParkingRepository] Error loading KML file ${filename}:`, err);
    }
  }

  console.log(`[ParkingRepository] Total parking locations loaded: ${allLocations.length}`);
  localLocationsCache = allLocations;
  return localLocationsCache;
}

class ParkingRepository implements IParkingRepository {
  /**
   * Fetch all parking locations.
   */
  async getAllLocations(): Promise<ParkingLocation[]> {
    const docClient = getDynamoDocClient();
    if (!docClient) {
      return getLocalLocations();
    }

    try {
      const items: ParkingLocation[] = [];
      let lastEvaluatedKey: Record<string, any> | undefined = undefined;

      do {
        const scanCmd: ScanCommand = new ScanCommand({
          TableName: TABLES.locations,
          ExclusiveStartKey: lastEvaluatedKey,
        });
        const scanRes: any = await docClient.send(scanCmd);

        if (scanRes.Items) {
          items.push(...(scanRes.Items as ParkingLocation[]));
        }
        lastEvaluatedKey = scanRes.LastEvaluatedKey;
      } while (lastEvaluatedKey);

      // If DynamoDB table is empty, seed with local data
      if (items.length === 0) {
        console.log('[ParkingRepository] DynamoDB table is empty, returning local data.');
        return getLocalLocations();
      }

      return items;
    } catch (error) {
      console.warn('[ParkingRepository] DynamoDB scan failed, using local fallback:', error);
      return getLocalLocations();
    }
  }

  /**
   * Fetch a single parking location by ID.
   */
  async getLocationById(id: string): Promise<ParkingLocation | null> {
    const docClient = getDynamoDocClient();
    if (!docClient) {
      const locs = getLocalLocations();
      return locs.find((l) => l.id === id) || null;
    }

    try {
      const response = await docClient.send(
        new GetCommand({
          TableName: TABLES.locations,
          Key: { id },
        })
      );

      if (response.Item) {
        return response.Item as ParkingLocation;
      }

      // Fallback search
      const locs = getLocalLocations();
      return locs.find((l) => l.id === id) || null;
    } catch (error) {
      console.warn(`[ParkingRepository] DynamoDB get(${id}) failed, using local fallback:`, error);
      const locs = getLocalLocations();
      return locs.find((l) => l.id === id) || null;
    }
  }

  /**
   * Query parking locations by source (OPENCITY, OSM, etc.)
   */
  async queryLocationsBySource(source: string): Promise<ParkingLocation[]> {
    const docClient = getDynamoDocClient();
    if (!docClient) {
      return getLocalLocations().filter((l) => l.source === source);
    }

    try {
      const response = await docClient.send(
        new QueryCommand({
          TableName: TABLES.locations,
          IndexName: 'BySourceIndex',
          KeyConditionExpression: '#src = :source',
          ExpressionAttributeNames: { '#src': 'source' },
          ExpressionAttributeValues: { ':source': source },
        })
      );

      return (response.Items as ParkingLocation[]) || [];
    } catch (error) {
      console.warn(`[ParkingRepository] DynamoDB query by source failed:`, error);
      return getLocalLocations().filter((l) => l.source === source);
    }
  }

  /**
   * Batch save locations (chunks of 25 for DynamoDB limit)
   */
  async batchSaveLocations(locations: ParkingLocation[]): Promise<number> {
    const docClient = getDynamoDocClient();
    if (!docClient) {
      if (!localLocationsCache) localLocationsCache = getLocalLocations();
      localLocationsCache.push(...locations);
      return locations.length;
    }

    const CHUNK_SIZE = 25;
    let savedCount = 0;

    for (let i = 0; i < locations.length; i += CHUNK_SIZE) {
      const chunk = locations.slice(i, i + CHUNK_SIZE);
      const putRequests = chunk.map((loc) => ({
        PutRequest: {
          Item: {
            ...loc,
            createdAt: (loc as any).createdAt || new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          },
        },
      }));

      try {
        let requestItems: Record<string, any> = {
          [TABLES.locations]: putRequests,
        };

        // Retry loop for unprocessed items
        let retries = 0;
        while (requestItems && Object.keys(requestItems).length > 0 && retries < 4) {
          const result = await docClient.send(
            new BatchWriteCommand({
              RequestItems: requestItems,
            })
          );

          savedCount += chunk.length - (result.UnprocessedItems?.[TABLES.locations]?.length || 0);

          if (result.UnprocessedItems && Object.keys(result.UnprocessedItems).length > 0) {
            retries++;
            await new Promise((res) => setTimeout(res, 100 * Math.pow(2, retries)));
            requestItems = result.UnprocessedItems;
          } else {
            break;
          }
        }
      } catch (error) {
        console.error(`[ParkingRepository] Batch write error at chunk ${i}:`, error);
        throw error;
      }
    }

    return savedCount;
  }

  /**
   * Record a crowdsourced parking event.
   */
  async saveParkingEvent(event: ParkingEvent): Promise<void> {
    const docClient = getDynamoDocClient();
    if (!docClient) {
      localEventsStore.push(event);
      return;
    }

    // Auto-expire after 48 hours via DynamoDB TTL
    const expiresAt = Math.floor(Date.now() / 1000) + 48 * 3600;

    try {
      await docClient.send(
        new PutCommand({
          TableName: TABLES.events,
          Item: {
            ...event,
            expiresAt,
          },
        })
      );
    } catch (error) {
      console.error('[ParkingRepository] Failed to save event to DynamoDB:', error);
      localEventsStore.push(event);
    }
  }

  /**
   * Retrieve recent events for a parking location within a given time window.
   */
  async getRecentEvents(
    parkingId: string,
    windowMinutes: number = 60
  ): Promise<ParkingEvent[]> {
    const minTimestamp = new Date(
      Date.now() - windowMinutes * 60 * 1000
    ).toISOString();

    const docClient = getDynamoDocClient();
    if (!docClient) {
      return localEventsStore.filter(
        (e) => e.parkingId === parkingId && e.timestamp >= minTimestamp
      );
    }

    try {
      const response = await docClient.send(
        new QueryCommand({
          TableName: TABLES.events,
          KeyConditionExpression: 'parkingId = :pId AND #ts >= :minTs',
          ExpressionAttributeNames: { '#ts': 'timestamp' },
          ExpressionAttributeValues: {
            ':pId': parkingId,
            ':minTs': minTimestamp,
          },
        })
      );

      return (response.Items as ParkingEvent[]) || [];
    } catch (error) {
      console.warn('[ParkingRepository] Query events failed, using local events:', error);
      return localEventsStore.filter(
        (e) => e.parkingId === parkingId && e.timestamp >= minTimestamp
      );
    }
  }

  /**
   * Update the current availability of a parking location in real time.
   */
  async updateLocationAvailability(
    parkingId: string,
    availability: CurrentAvailability
  ): Promise<boolean> {
    // Always update local memory cache first
    const locs = getLocalLocations();
    const target = locs.find((l) => l.id === parkingId);
    if (target) {
      target.currentAvailability = availability;
    }

    const docClient = getDynamoDocClient();
    if (!docClient) {
      return true;
    }

    try {
      await docClient.send(
        new UpdateCommand({
          TableName: TABLES.locations,
          Key: { id: parkingId },
          UpdateExpression: 'SET currentAvailability = :avail, updatedAt = :now',
          ExpressionAttributeValues: {
            ':avail': availability,
            ':now': new Date().toISOString(),
          },
        })
      );
      return true;
    } catch (error) {
      console.warn(`[ParkingRepository] Failed to update availability in DynamoDB for ${parkingId}:`, error);
      return true; // local cache was updated successfully
    }
  }
}

export const parkingRepository = new ParkingRepository();
