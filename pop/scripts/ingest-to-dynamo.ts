// =============================================================================
// ParkWise — Standalone DynamoDB Ingestion Script
// =============================================================================
// Ingests the OpenCity Bengaluru KML dataset directly into AWS DynamoDB.
//
// Usage:
//   npx tsx scripts/ingest-to-dynamo.ts
//
// Requirements:
//   - AWS credentials configured (AWS_ACCESS_KEY_ID / AWS_SECRET_ACCESS_KEY or IAM)
//   - DYNAMODB_TABLE_LOCATIONS (default: ParkWise-Locations)
//   - AWS_REGION (default: ap-south-1)
// =============================================================================

import { parseOpenCityKml, getDefaultKmlPath } from '../services/parking/kmlParser';
import { parkingRepository } from '../services/db/parkingRepository';
import { isDynamoConfigured, TABLES } from '../services/db/dynamoClient';

async function main() {
  console.log('===============================================================');
  console.log(' ParkWise — OpenCity KML to DynamoDB Ingestion Pipeline');
  console.log('===============================================================');

  const kmlPath = getDefaultKmlPath();
  console.log(`[Ingest] Reading dataset from: ${kmlPath}`);

  const startTime = Date.now();
  const parseResult = parseOpenCityKml(kmlPath);

  console.log(`[Ingest] Parsed ${parseResult.locations.length} locations (${parseResult.errors.length} errors/skipped).`);

  if (!isDynamoConfigured()) {
    console.log('[Ingest] WARNING: DynamoDB is not actively configured.');
    console.log('[Ingest] Set AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, or DYNAMODB_ENDPOINT.');
    console.log('[Ingest] Locations parsed successfully, but skipping DynamoDB remote write.');
    return;
  }

  console.log(`[Ingest] Writing ${parseResult.locations.length} items to table: ${TABLES.locations}...`);
  try {
    const savedCount = await parkingRepository.batchSaveLocations(parseResult.locations);
    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    console.log(`[Ingest] SUCCESS: Successfully saved ${savedCount} locations into DynamoDB in ${duration}s.`);
  } catch (error) {
    console.error('[Ingest] Batch write failed:', error);
    process.exit(1);
  }
}

main().catch((err) => {
  console.error('[Ingest] Fatal error:', err);
  process.exit(1);
});
