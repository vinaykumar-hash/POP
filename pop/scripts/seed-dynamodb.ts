// =============================================================================
// POP — Complete DynamoDB Database Seeding Pipeline
// =============================================================================
// Ingests Bengaluru OpenCity & OSM parking spots into DynamoDB (POP-Locations),
// and creates initial seed host listings in POP-Listings.
//
// Usage:
//   npx tsx scripts/seed-dynamodb.ts
// =============================================================================

import { parkingRepository } from '../services/db/parkingRepository';
import { listingRepository } from '../services/db/listingRepository';
import { isDynamoConfigured, TABLES } from '../services/db/dynamoClient';

async function main() {
  console.log('===============================================================');
  console.log(' POP (Parking on phone) — DynamoDB Database Seeding Pipeline');
  console.log('===============================================================');
  console.log(`Region: ${process.env.AWS_REGION || 'ap-south-1'}`);
  console.log(`Target Tables:`);
  console.log(`  - Locations: ${TABLES.locations}`);
  console.log(`  - Events:    ${TABLES.events}`);
  console.log(`  - Listings:  ${TABLES.listings}`);
  console.log(`  - Hosts:     ${TABLES.hosts}`);
  console.log(`  - Bookings:  ${TABLES.bookings}`);
  console.log('---------------------------------------------------------------');

  const locations = await parkingRepository.getAllLocations();
  console.log(`[Seed] Loaded ${locations.length} parking locations from local KML datasets.`);

  if (!isDynamoConfigured()) {
    console.log('[Seed] Notice: AWS DynamoDB is not actively configured with credentials.');
    console.log('[Seed] Set AWS_ACCESS_KEY_ID & AWS_SECRET_ACCESS_KEY (or DYNAMODB_ENDPOINT for local DynamoDB).');
    console.log('[Seed] Local in-memory repository is fully functional for all routes.');
    return;
  }

  console.log(`[Seed] Ingesting ${locations.length} locations to ${TABLES.locations}...`);
  try {
    const count = await parkingRepository.batchSaveLocations(locations);
    console.log(`[Seed] Successfully wrote ${count} parking facilities into ${TABLES.locations}!`);
  } catch (err) {
    console.error('[Seed] Failed to write locations to DynamoDB:', err);
  }

  // Seed sample verified listings
  console.log(`[Seed] Seeding initial verified listings into ${TABLES.listings}...`);
  try {
    const sampleListings = [
      {
        title: 'Safe Covered Parking in Indiranagar 100ft Rd',
        description: 'Gated 24/7 security covered parking slot, 2 minutes walking distance from 100ft Road and metro.',
        propertyType: 'independent_house',
        location: {
          address: '428, 12th Main Road, HAL 2nd Stage, Indiranagar',
          area: 'Indiranagar',
          city: 'Bengaluru',
          pincode: '560038',
          lat: 12.9719,
          lng: 77.6412,
        },
        parkingDetails: {
          vehicleType: 'Car',
          parkingType: 'Covered',
          capacity: 2,
          features: ['CCTV Surveillance', '24/7 Security Guard', 'Covered Roof', 'Gated Access', 'EV Charging Available'],
        },
        pricing: {
          hourlyRate: 50,
          dailyRate: 400,
        },
        availability: {
          days: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
          hours: '24/7',
        },
      },
      {
        title: 'Koramangala 4th Block Wide Parking Slot',
        description: 'Prime parking spot right behind Sony Signal, easy in-and-out access with wide gate.',
        propertyType: 'apartment',
        location: {
          address: '89, 4th Cross, 4th Block, Koramangala',
          area: 'Koramangala',
          city: 'Bengaluru',
          pincode: '560034',
          lat: 12.9352,
          lng: 77.6245,
        },
        parkingDetails: {
          vehicleType: 'Both',
          parkingType: 'Open',
          capacity: 3,
          features: ['CCTV Surveillance', 'Gated Access', 'Well Lit at Night'],
        },
        pricing: {
          hourlyRate: 40,
          dailyRate: 300,
        },
        availability: {
          days: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'],
          hours: '08:00 - 22:00',
        },
      },
    ];

    for (const listing of sampleListings) {
      await listingRepository.createListing('host_seed_demo_1', listing);
    }
    console.log(`[Seed] Successfully seeded sample listings into ${TABLES.listings}!`);
  } catch (err) {
    console.error('[Seed] Failed to seed sample listings:', err);
  }

  console.log('===============================================================');
  console.log(' Seeding Complete!');
  console.log('===============================================================');
}

main().catch((err) => {
  console.error('[Seed] Fatal error:', err);
  process.exit(1);
});
