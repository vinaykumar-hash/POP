/**
 * AWS Lambda Handler: Report Parking Event
 * Route: POST /parking/events
 * 
 * Ingests crowdsourced parking availability events, stores the event with a 48h TTL
 * in DynamoDB ParkWise-Events, and recalculates the real-time availability in ParkWise-Locations.
 */

import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, PutCommand, UpdateCommand, GetCommand } from '@aws-sdk/lib-dynamodb';

interface APIGatewayEvent {
  body?: string | null;
  requestContext?: {
    authorizer?: {
      jwt?: {
        claims?: {
          sub?: string;
          email?: string;
        };
      };
    };
  };
}

const client = new DynamoDBClient({
  region: process.env.AWS_REGION || 'ap-south-1',
});
const ddbDocClient = DynamoDBDocumentClient.from(client);

const TABLE_LOCATIONS = process.env.TABLE_LOCATIONS || 'ParkWise-Locations-dev';
const TABLE_EVENTS = process.env.TABLE_EVENTS || 'ParkWise-Events-dev';

export const handler = async (event: APIGatewayEvent) => {
  if (!event.body) {
    return {
      statusCode: 400,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({ error: 'Missing request body' }),
    };
  }

  let body: {
    parkingId: string;
    eventType: string;
    anonymousUserId?: string;
    userLat?: number;
    userLng?: number;
  };

  try {
    body = JSON.parse(event.body);
  } catch {
    return {
      statusCode: 400,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({ error: 'Invalid JSON payload' }),
    };
  }

  const { parkingId, eventType, anonymousUserId, userLat, userLng } = body;
  if (!parkingId || !eventType) {
    return {
      statusCode: 400,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({ error: '"parkingId" and "eventType" are required.' }),
    };
  }

  const now = new Date();
  const timestamp = now.toISOString();
  const eventId = `evt_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  // 48 hours TTL
  const expiresAt = Math.floor(now.getTime() / 1000) + 48 * 3600;

  try {
    // 1. Save Event
    await ddbDocClient.send(
      new PutCommand({
        TableName: TABLE_EVENTS,
        Item: {
          parkingId,
          eventId,
          eventType,
          timestamp,
          expiresAt,
          userId: event.requestContext?.authorizer?.jwt?.claims?.sub || anonymousUserId || 'anonymous',
          userLocation: userLat && userLng ? { latitude: userLat, longitude: userLng } : undefined,
        },
      })
    );

    // 2. Fetch current location to recalculate availability
    const locationRes = await ddbDocClient.send(
      new GetCommand({
        TableName: TABLE_LOCATIONS,
        Key: { id: parkingId },
      })
    );

    let newStatus = 'UNKNOWN';
    let newConfidence = 0.5;
    let availableSpaces = locationRes.Item?.currentAvailability?.availableSpaces;
    const totalCapacity = locationRes.Item?.capacity?.totalSpaces || 20;

    switch (eventType) {
      case 'PARKING_FULL_REPORTED':
        newStatus = 'FULL';
        newConfidence = 0.9;
        availableSpaces = 0;
        break;
      case 'PARKING_AVAILABLE_REPORTED':
        newStatus = 'AVAILABLE';
        newConfidence = 0.85;
        availableSpaces = Math.max(1, Math.round(totalCapacity * 0.4));
        break;
      case 'PARKING_CONFIRMED':
        availableSpaces = Math.max(0, (availableSpaces ?? 5) - 1);
        newStatus = availableSpaces === 0 ? 'FULL' : availableSpaces <= 3 ? 'LIMITED' : 'AVAILABLE';
        newConfidence = 0.85;
        break;
      case 'USER_LEFT':
        availableSpaces = Math.min(totalCapacity, (availableSpaces ?? 0) + 1);
        newStatus = availableSpaces > 3 ? 'AVAILABLE' : 'LIMITED';
        newConfidence = 0.8;
        break;
      default:
        newStatus = locationRes.Item?.currentAvailability?.status || 'UNKNOWN';
        newConfidence = 0.6;
    }

    const updatedAvailability = {
      status: newStatus,
      confidence: newConfidence,
      lastUpdated: timestamp,
      source: 'CROWDSOURCED',
      availableSpaces,
      totalCapacity,
    };

    // 3. Update Location Availability
    await ddbDocClient.send(
      new UpdateCommand({
        TableName: TABLE_LOCATIONS,
        Key: { id: parkingId },
        UpdateExpression: 'SET currentAvailability = :avail, updatedAt = :updatedAt',
        ExpressionAttributeValues: {
          ':avail': updatedAvailability,
          ':updatedAt': timestamp,
        },
      })
    );

    return {
      statusCode: 201,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({
        success: true,
        eventId,
        parkingId,
        updatedAvailability,
      }),
    };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Internal Server Error';
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({ error: message }),
    };
  }
};
