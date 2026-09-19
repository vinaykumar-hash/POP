/**
 * AWS Lambda Handler: Search Parking
 * Route: GET /parking/nearby
 * 
 * Searches for parking spaces near the requested latitude/longitude, applying
 * filters (radius, parking type, vehicle compatibility, covered, EV charging)
 * and sorting by road distance or score.
 */

import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, ScanCommand } from '@aws-sdk/lib-dynamodb';

interface APIGatewayEvent {
  queryStringParameters?: Record<string, string | undefined>;
  requestContext?: {
    authorizer?: {
      jwt?: {
        claims?: Record<string, unknown>;
      };
    };
  };
}

const client = new DynamoDBClient({
  region: process.env.AWS_REGION || 'ap-south-1',
});
const ddbDocClient = DynamoDBDocumentClient.from(client);

const TABLE_NAME = process.env.TABLE_LOCATIONS || 'ParkWise-Locations-dev';

// Haversine distance in meters
function computeHaversineMeters(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371000;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

export const handler = async (event: APIGatewayEvent) => {
  const query = event.queryStringParameters || {};
  const lat = parseFloat(query.lat || '');
  const lng = parseFloat(query.lng || '');
  const radius = parseFloat(query.radius || '3000'); // default 3km

  if (isNaN(lat) || isNaN(lng)) {
    return {
      statusCode: 400,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
      body: JSON.stringify({ error: 'Valid "lat" and "lng" query parameters are required.' }),
    };
  }

  try {
    // Scan table items (for production, geo-hashes or bounding-box GSI is recommended)
    const scanResult = await ddbDocClient.send(
      new ScanCommand({
        TableName: TABLE_NAME,
        Limit: 200,
      })
    );

    const items = scanResult.Items || [];

    // Filter by radius & optional parameters
    const vehicleType = query.vehicleType?.toUpperCase();
    const covered = query.covered === 'true';
    const evCharging = query.evCharging === 'true';
    const typeFilter = query.types ? query.types.split(',') : null;

    interface RawParkingLocation {
      id?: string;
      type?: string;
      facilities?: { covered?: boolean; evCharging?: boolean };
      vehicleTypes?: string[];
      location?: { latitude?: number; longitude?: number };
      latitude?: number;
      longitude?: number;
      [key: string]: unknown;
    }

    const matched = (items as RawParkingLocation[])
      .map((item) => {
        const itemLat = item.location?.latitude ?? item.latitude;
        const itemLng = item.location?.longitude ?? item.longitude;
        if (typeof itemLat !== 'number' || typeof itemLng !== 'number') return null;

        const distanceMeters = computeHaversineMeters(lat, lng, itemLat, itemLng);
        return {
          ...item,
          distanceMeters: Math.round(distanceMeters),
        };
      })
      .filter((item): item is NonNullable<typeof item> => {
        if (!item) return false;
        if (item.distanceMeters > radius) return false;
        if (typeFilter && item.type && !typeFilter.includes(item.type)) return false;
        if (covered && !item.facilities?.covered) return false;
        if (evCharging && !item.facilities?.evCharging) return false;
        if (vehicleType && !item.vehicleTypes?.includes(vehicleType)) return false;
        return true;
      });

    // Sort by proximity
    matched.sort((a, b) => a.distanceMeters - b.distanceMeters);

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
      body: JSON.stringify({
        center: { latitude: lat, longitude: lng },
        radiusMeters: radius,
        totalFound: matched.length,
        locations: matched,
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
