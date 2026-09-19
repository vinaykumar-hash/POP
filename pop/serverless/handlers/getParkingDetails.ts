/**
 * AWS Lambda Handler: Get Parking Details
 * Route: GET /parking/{id}
 * 
 * Fetches parking location details and recent historical event records.
 */

import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, GetCommand, QueryCommand } from '@aws-sdk/lib-dynamodb';

interface APIGatewayEvent {
  pathParameters?: {
    id?: string;
  };
}

const client = new DynamoDBClient({
  region: process.env.AWS_REGION || 'ap-south-1',
});
const ddbDocClient = DynamoDBDocumentClient.from(client);

const TABLE_LOCATIONS = process.env.TABLE_LOCATIONS || 'ParkWise-Locations-dev';
const TABLE_EVENTS = process.env.TABLE_EVENTS || 'ParkWise-Events-dev';

export const handler = async (event: APIGatewayEvent) => {
  const id = event.pathParameters?.id;

  if (!id) {
    return {
      statusCode: 400,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
      body: JSON.stringify({ error: 'Missing parking "id" in path parameters.' }),
    };
  }

  try {
    // 1. Fetch location record
    const locationResult = await ddbDocClient.send(
      new GetCommand({
        TableName: TABLE_LOCATIONS,
        Key: { id },
      })
    );

    if (!locationResult.Item) {
      return {
        statusCode: 404,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
        body: JSON.stringify({ error: `Parking location with id "${id}" not found.` }),
      };
    }

    // 2. Fetch recent events (up to 10)
    let recentEvents: Record<string, unknown>[] = [];
    try {
      const eventsResult = await ddbDocClient.send(
        new QueryCommand({
          TableName: TABLE_EVENTS,
          KeyConditionExpression: 'parkingId = :pid',
          ExpressionAttributeValues: {
            ':pid': id,
          },
          ScanIndexForward: false,
          Limit: 10,
        })
      );
      recentEvents = eventsResult.Items || [];
    } catch {
      // Non-fatal if events table is not yet populated
    }

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
      body: JSON.stringify({
        location: locationResult.Item,
        recentEvents,
      }),
    };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Internal Server Error';
    return {
      statusCode: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
      body: JSON.stringify({ error: message }),
    };
  }
};
