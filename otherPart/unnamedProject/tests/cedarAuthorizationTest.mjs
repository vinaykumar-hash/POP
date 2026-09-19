/**
 * ParkSync - Step 5 Amazon Cedar Authorization Test Suite
 * 
 * Verifies all 10 authorization scenarios required for Step 5:
 * TEST 1: Host A creates a listing while attempting to inject Host B's hostId.
 * TEST 2: Host A views own listing (Cedar ALLOW / HTTP 200).
 * TEST 3: Host A updates own listing (Cedar ALLOW / HTTP 200).
 * TEST 4: Host A deletes own listing (Cedar ALLOW / HTTP 200).
 * TEST 5: Host B attempts to view Host A's listing (Cedar DENY / HTTP 403).
 * TEST 6: Host B attempts to update Host A's listing (Cedar DENY / HTTP 403).
 * TEST 7: Host B attempts to delete Host A's listing (Cedar DENY / HTTP 403).
 * TEST 8: Host B attempts to inject/forge owner or hostId in an update request (Host A remains owner).
 * TEST 9: Unauthenticated request attempts protected host operation (HTTP 401).
 * TEST 10: Attempt to access another host's private listing/photo resource (Cedar DENY).
 */

import { handleApiRequest } from '../src/backend/apiRouter.js';
import { cedarAuthorizer } from '../src/backend/authorization/cedar/cedarAuthorizer.js';

function createJwt(sub, name, email) {
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
  const payload = Buffer.from(JSON.stringify({
    sub,
    name,
    email,
    exp: Math.floor(Date.now() / 1000) + 3600
  })).toString('base64url');
  return `${header}.${payload}.mock_sig`;
}

async function runCedarTests() {
  console.log('====================================================');
  console.log('PARKSYNC STEP 5 - CEDAR AUTHORIZATION TEST SUITE');
  console.log('====================================================\n');

  const hostA_Sub = 'cognito-sub-alice-111';
  const hostB_Sub = 'cognito-sub-bob-222';

  const tokenA = createJwt(hostA_Sub, 'Alice Host', 'alice@example.com');
  const tokenB = createJwt(hostB_Sub, 'Bob Host', 'bob@example.com');

  const headersA = { Authorization: `Bearer ${tokenA}` };
  const headersB = { Authorization: `Bearer ${tokenB}` };

  // ----------------------------------------------------
  // TEST 1: Host A creates listing while attempting to inject Host B's hostId
  // ----------------------------------------------------
  console.log('TEST 1: Host A creates listing while attempting to inject Host B hostId...');
  const createRes = await handleApiRequest(
    'POST',
    '/api/listings',
    headersA,
    {
      hostId: hostB_Sub, // Attempt to forge ownership
      owner: hostB_Sub,  // Attempt to forge owner attribute
      location: { locality: 'Indiranagar', city: 'Bengaluru', address: '12th Main Road' },
      pricing: { hourly: '50', daily: '400' },
      parkingDetails: { vehicleType: 'Car', parkingType: 'Covered', capacity: 1 }
    }
  );

  if (createRes.status !== 201) {
    throw new Error(`Test 1 Failed: Expected status 201, got ${createRes.status}`);
  }

  const listingA = createRes.body;
  if (listingA.hostId !== hostA_Sub) {
    throw new Error(`Test 1 Failed: Expected hostId to be '${hostA_Sub}', got '${listingA.hostId}'`);
  }
  console.log(`✓ Passed: Listing ${listingA.listingId} belongs strictly to Host A (${listingA.hostId}). Injected hostId was discarded.\n`);

  // ----------------------------------------------------
  // TEST 2: Host A views own listing -> Cedar ALLOW / HTTP 200
  // ----------------------------------------------------
  console.log('TEST 2: Host A views own listing (Cedar ALLOW / HTTP 200)...');
  const viewOwnRes = await handleApiRequest('GET', `/api/listings/${listingA.listingId}`, headersA, {});
  if (viewOwnRes.status !== 200) {
    throw new Error(`Test 2 Failed: Expected 200, got ${viewOwnRes.status}`);
  }
  console.log(`✓ Passed: Host A permitted by Cedar Policy 1 to view own listing (HTTP 200 OK).\n`);

  // ----------------------------------------------------
  // TEST 3: Host A updates own listing -> Cedar ALLOW / HTTP 200
  // ----------------------------------------------------
  console.log('TEST 3: Host A updates own listing (Cedar ALLOW / HTTP 200)...');
  const updateOwnRes = await handleApiRequest(
    'PUT',
    `/api/listings/${listingA.listingId}`,
    headersA,
    { pricing: { hourly: '80' } }
  );
  if (updateOwnRes.status !== 200 || updateOwnRes.body.pricing?.hourly !== '80') {
    throw new Error(`Test 3 Failed: Expected 200 with hourly 80, got ${updateOwnRes.status}`);
  }
  console.log(`✓ Passed: Host A permitted by Cedar Policy 2 to update own listing (HTTP 200 OK).\n`);

  // ----------------------------------------------------
  // TEST 5: Host B attempts to view Host A's listing -> Cedar DENY / HTTP 403
  // ----------------------------------------------------
  console.log("TEST 5: Host B attempts to view Host A's listing (Cedar DENY / HTTP 403)...");
  const viewOtherRes = await handleApiRequest('GET', `/api/listings/${listingA.listingId}`, headersB, {});
  if (viewOtherRes.status !== 403) {
    throw new Error(`Test 5 Failed: Expected 403 Forbidden, got ${viewOtherRes.status}`);
  }
  console.log(`✓ Passed: Cedar denied viewListing request: resource.owner != principal (HTTP 403 Forbidden).\n`);

  // ----------------------------------------------------
  // TEST 6: Host B attempts to update Host A's listing -> Cedar DENY / HTTP 403
  // ----------------------------------------------------
  console.log("TEST 6: Host B attempts to update Host A's listing (Cedar DENY / HTTP 403)...");
  const updateOtherRes = await handleApiRequest(
    'PUT',
    `/api/listings/${listingA.listingId}`,
    headersB,
    { pricing: { hourly: '10' } }
  );
  if (updateOtherRes.status !== 403) {
    throw new Error(`Test 6 Failed: Expected 403 Forbidden, got ${updateOtherRes.status}`);
  }
  console.log(`✓ Passed: Cedar denied updateListing request: resource.owner != principal (HTTP 403 Forbidden).\n`);

  // ----------------------------------------------------
  // TEST 7: Host B attempts to delete Host A's listing -> Cedar DENY / HTTP 403
  // ----------------------------------------------------
  console.log("TEST 7: Host B attempts to delete Host A's listing (Cedar DENY / HTTP 403)...");
  const deleteOtherRes = await handleApiRequest('DELETE', `/api/listings/${listingA.listingId}`, headersB, {});
  if (deleteOtherRes.status !== 403) {
    throw new Error(`Test 7 Failed: Expected 403 Forbidden, got ${deleteOtherRes.status}`);
  }
  console.log(`✓ Passed: Cedar denied deleteListing request: resource.owner != principal (HTTP 403 Forbidden).\n`);

  // ----------------------------------------------------
  // TEST 8: Host B attempts to inject/forge owner or hostId in an update request
  // ----------------------------------------------------
  console.log("TEST 8: Host B attempts to forge owner or hostId in update request...");
  const forgeUpdateRes = await handleApiRequest(
    'PUT',
    `/api/listings/${listingA.listingId}`,
    headersB,
    {
      hostId: hostB_Sub,
      owner: hostB_Sub,
      pricing: { hourly: '999' }
    }
  );
  if (forgeUpdateRes.status !== 403) {
    throw new Error(`Test 8 Failed: Expected 403 Forbidden on forged update, got ${forgeUpdateRes.status}`);
  }

  // Verify Host A remains the sole owner and price was not modified
  const verifyListingA = await handleApiRequest('GET', `/api/listings/${listingA.listingId}`, headersA, {});
  if (verifyListingA.body.hostId !== hostA_Sub || verifyListingA.body.pricing?.hourly !== '80') {
    throw new Error(`Test 8 Failed: Listing ownership or data was compromised!`);
  }
  console.log(`✓ Passed: Ownership immutable. Host A remains sole owner (${verifyListingA.body.hostId}) and price remains ₹80.\n`);

  // ----------------------------------------------------
  // TEST 9: Unauthenticated request attempts protected host operation -> HTTP 401
  // ----------------------------------------------------
  console.log('TEST 9: Unauthenticated request attempts protected host operation...');
  const unauthRes = await handleApiRequest('GET', `/api/listings/${listingA.listingId}`, {}, {});
  if (unauthRes.status !== 401) {
    throw new Error(`Test 9 Failed: Expected 401 Unauthorized, got ${unauthRes.status}`);
  }
  console.log(`✓ Passed: Unauthenticated request rejected at API Gateway / Auth layer (HTTP 401 Unauthorized).\n`);

  // ----------------------------------------------------
  // TEST 10: Attempt to access another host's private listing/photo resource -> Cedar DENY
  // ----------------------------------------------------
  console.log("TEST 10: Direct Cedar policy test on private listing resource...");
  const directCedarCheck = await cedarAuthorizer.isAuthorized({
    principal: hostB_Sub,
    action: 'viewListing',
    resource: {
      id: listingA.listingId,
      owner: hostA_Sub
    }
  });

  if (directCedarCheck.decision !== 'DENY') {
    throw new Error(`Test 10 Failed: Direct Cedar evaluation expected DENY, got ${directCedarCheck.decision}`);
  }
  console.log(`✓ Passed: Direct Cedar evaluation returned decision: DENY (${directCedarCheck.diagnostics.reasons[0]}).\n`);

  // ----------------------------------------------------
  // TEST 4: Host A deletes own listing -> Cedar ALLOW / HTTP 200
  // ----------------------------------------------------
  console.log('TEST 4: Host A deletes own listing (Cedar ALLOW / HTTP 200)...');
  const deleteOwnRes = await handleApiRequest('DELETE', `/api/listings/${listingA.listingId}`, headersA, {});
  if (deleteOwnRes.status !== 200) {
    throw new Error(`Test 4 Failed: Expected 200, got ${deleteOwnRes.status}`);
  }
  console.log(`✓ Passed: Host A permitted by Cedar Policy 3 to delete own listing (HTTP 200 OK).\n`);

  console.log('====================================================');
  console.log('ALL 10 CEDAR AUTHORIZATION SCENARIOS PASSED WITH 100% SUCCESS!');
  console.log('====================================================\n');
}

runCedarTests().catch((err) => {
  console.error('\n❌ Cedar Test Failed:', err);
  process.exit(1);
});
