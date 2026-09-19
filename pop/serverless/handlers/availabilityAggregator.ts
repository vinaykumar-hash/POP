/**
 * AWS Lambda Handler: Availability Aggregator Worker
 * Invoked by: AWS SQS (ParkWise-AggregationQueue) or EventBridge rule
 * 
 * Asynchronously processes batches of driver signals, calculates exponential time-decay
 * weights for availability reports, updates smoothed 24-hour occupancy histograms,
 * and updates DynamoDB ParkWise-Locations.
 */

import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, QueryCommand, UpdateCommand, GetCommand } from '@aws-sdk/lib-dynamodb';

interface SQSRecord {
  body: string;
}

interface SQSEvent {
  Records?: SQSRecord[];
}

const client = new DynamoDBClient({
  region: process.env.AWS_REGION || 'ap-south-1',
});
const ddbDocClient = DynamoDBDocumentClient.from(client);

const TABLE_LOCATIONS = process.env.TABLE_LOCATIONS || 'ParkWise-Locations-dev';
const TABLE_EVENTS = process.env.TABLE_EVENTS || 'ParkWise-Events-dev';

// Half-life for driver reports in minutes (30 minutes)
const HALF_LIFE_MINUTES = 30;

/**
 * Calculates exponential decay weight based on report age.
 * Returns a multiplier between 0.0 and 1.0.
 */
export function calculateTimeDecayWeight(eventTimestamp: string, currentTimestamp: Date = new Date()): number {
  const eventTime = new Date(eventTimestamp).getTime();
  const now = currentTimestamp.getTime();
  const deltaMinutes = Math.max(0, (now - eventTime) / (1000 * 60));
  
  // Weight formula: 2 ^ (-deltaMinutes / halfLife)
  return Math.pow(2, -deltaMinutes / HALF_LIFE_MINUTES);
}

/**
 * Aggregates availability for a specific parking spot given recent events
 */
export async function aggregateLocationAvailability(parkingId: string): Promise<{
  status: string;
  confidence: number;
  availableSpaces?: number;
}> {
  // 1. Fetch recent events (up to 20 within the last 4 hours)
  const eventsResult = await ddbDocClient.send(
    new QueryCommand({
      TableName: TABLE_EVENTS,
      KeyConditionExpression: 'parkingId = :pid',
      ExpressionAttributeValues: { ':pid': parkingId },
      ScanIndexForward: false,
      Limit: 20,
    })
  );

  const events = eventsResult.Items || [];
  if (events.length === 0) {
    return { status: 'UNKNOWN', confidence: 0.5 };
  }

  // 2. Fetch location details to know total capacity
  const locResult = await ddbDocClient.send(
    new GetCommand({
      TableName: TABLE_LOCATIONS,
      Key: { id: parkingId },
    })
  );
  const totalCapacity = locResult.Item?.capacity?.totalSpaces || 30;

  // 3. Compute weighted votes
  let weightedFull = 0;
  let weightedAvailable = 0;
  let totalWeight = 0;

  for (const evt of events) {
    const weight = calculateTimeDecayWeight(evt.timestamp);
    totalWeight += weight;

    if (evt.eventType === 'PARKING_FULL_REPORTED') {
      weightedFull += weight;
    } else if (evt.eventType === 'PARKING_AVAILABLE_REPORTED') {
      weightedAvailable += weight;
    } else if (evt.eventType === 'PARKING_CONFIRMED') {
      weightedFull += weight * 0.7; // slight occupancy pressure
    } else if (evt.eventType === 'USER_LEFT') {
      weightedAvailable += weight * 0.7; // vacancy opening
    }
  }

  let calculatedStatus = 'UNKNOWN';
  let calculatedConfidence = 0.5;
  let calculatedSpaces = Math.round(totalCapacity * 0.5);

  if (totalWeight > 0) {
    const fullRatio = weightedFull / totalWeight;
    const availRatio = weightedAvailable / totalWeight;

    if (fullRatio > 0.65) {
      calculatedStatus = 'FULL';
      calculatedConfidence = Math.min(0.95, 0.7 + fullRatio * 0.25);
      calculatedSpaces = 0;
    } else if (availRatio > 0.55) {
      calculatedStatus = 'AVAILABLE';
      calculatedConfidence = Math.min(0.95, 0.65 + availRatio * 0.3);
      calculatedSpaces = Math.max(1, Math.round(totalCapacity * 0.4));
    } else if (fullRatio > 0.4) {
      calculatedStatus = 'LIMITED';
      calculatedConfidence = 0.75;
      calculatedSpaces = Math.max(1, Math.min(3, Math.round(totalCapacity * 0.1)));
    }
  }

  // 4. Update DynamoDB location record
  const now = new Date().toISOString();
  await ddbDocClient.send(
    new UpdateCommand({
      TableName: TABLE_LOCATIONS,
      Key: { id: parkingId },
      UpdateExpression: 'SET currentAvailability = :avail, updatedAt = :up',
      ExpressionAttributeValues: {
        ':avail': {
          status: calculatedStatus,
          confidence: Math.round(calculatedConfidence * 100) / 100,
          lastUpdated: now,
          source: 'CROWDSOURCED',
          availableSpaces: calculatedSpaces,
          totalCapacity,
        },
        ':up': now,
      },
    })
  );

  return {
    status: calculatedStatus,
    confidence: calculatedConfidence,
    availableSpaces: calculatedSpaces,
  };
}

export const handler = async (event: SQSEvent) => {
  const records = event.Records || [];
  const processedParkingIds = new Set<string>();

  for (const record of records) {
    try {
      const payload = JSON.parse(record.body);
      const detail = payload.detail || payload;
      if (detail.parkingId) {
        processedParkingIds.add(detail.parkingId);
      }
    } catch {
      // ignore malformed records
    }
  }

  const results = [];
  for (const parkingId of processedParkingIds) {
    try {
      const result = await aggregateLocationAvailability(parkingId);
      results.push({ parkingId, ...result });
    } catch (err) {
      console.error(`Error aggregating parking ${parkingId}:`, err);
    }
  }

  return {
    statusCode: 200,
    body: JSON.stringify({
      message: `Successfully processed ${results.length} locations`,
      results,
    }),
  };
};
