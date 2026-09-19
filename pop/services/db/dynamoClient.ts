// =============================================================================
// ParkWise — DynamoDB Client Singleton
// =============================================================================
// Provides an initialized AWS SDK v3 DynamoDB DocumentClient with automatic
// environment-based configuration and local fallback detection.
//
// Supports:
//   1. Real AWS DynamoDB (via IAM roles on AWS or explicit environment variables)
//   2. DynamoDB Local / LocalStack (via DYNAMODB_ENDPOINT)
//   3. Seamless local fallback (in-memory/KML parser) when AWS is unconfigured
// =============================================================================

import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';

export const TABLES = {
  locations: process.env.DYNAMODB_TABLE_LOCATIONS || 'POP-Locations',
  events: process.env.DYNAMODB_TABLE_EVENTS || 'POP-Events',
  listings: process.env.DYNAMODB_TABLE_LISTINGS || 'POP-Listings',
  hosts: process.env.DYNAMODB_TABLE_HOSTS || 'POP-Hosts',
  bookings: process.env.DYNAMODB_TABLE_BOOKINGS || 'POP-Bookings',
};

const region = process.env.AWS_REGION || process.env.AWS_DEFAULT_REGION || 'ap-south-1';
const endpoint = process.env.DYNAMODB_ENDPOINT;

// Determine if DynamoDB is actively configured to be used
export function isDynamoConfigured(): boolean {
  if (process.env.USE_DYNAMODB === 'true') return true;
  if (endpoint) return true;
  if (process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY) return true;
  // If running inside AWS Lambda / ECS
  if (process.env.AWS_EXECUTION_ENV || process.env.AWS_LAMBDA_FUNCTION_NAME) return true;
  return false;
}

let ddbDocClient: DynamoDBDocumentClient | null = null;

export function getDynamoDocClient(): DynamoDBDocumentClient | null {
  if (!isDynamoConfigured()) {
    return null;
  }

  if (!ddbDocClient) {
    const rawClient = new DynamoDBClient({
      region,
      ...(endpoint ? { endpoint } : {}),
    });

    ddbDocClient = DynamoDBDocumentClient.from(rawClient, {
      marshallOptions: {
        removeUndefinedValues: true,
        convertClassInstanceToMap: true,
      },
      unmarshallOptions: {
        wrapNumbers: false,
      },
    });

    console.log(`[DynamoDB] Initialized DocumentClient (region: ${region}${endpoint ? `, endpoint: ${endpoint}` : ''})`);
  }

  return ddbDocClient;
}
