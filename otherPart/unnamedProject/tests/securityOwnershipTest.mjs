/**
 * ParkSync - Automated Security & Server-Side Ownership Test Suite
 * 
 * Verifies that:
 * 1. The backend Lambda assigns ownership strictly from authenticatedUser.sub.
 * 2. Host A can access, update, and delete their own listing.
 * 3. Host B attempting GET, PUT, or DELETE on Host A's listing receives HTTP 403 Forbidden.
 */

import { handleApiRequest } from '../src/backend/apiRouter.js';

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

async function runSecurityTest() {
  console.log('====================================================');
  console.log('PARKSYNC STEP 4 SECURITY & OWNERSHIP TEST SUITE');
  console.log('====================================================\n');

  const hostAToken = createJwt('cognito-sub-host-AAA', 'Host Alice', 'alice@example.com');
  const hostBToken = createJwt('cognito-sub-host-BBB', 'Host Bob', 'bob@example.com');

  const headersHostA = { Authorization: `Bearer ${hostAToken}` };
  const headersHostB = { Authorization: `Bearer ${hostBToken}` };

  // ----------------------------------------------------
  // TEST 1: Host A creates a listing.
  // Frontend sends a malicious "hostId: someone-else" payload to test tamper rejection.
  // ----------------------------------------------------
  console.log('TEST 1: Creating listing as Host A (attempting hostId tamper in payload)...');
  const createRes = await handleApiRequest(
    'POST',
    '/api/listings',
    headersHostA,
    {
      hostId: 'malicious-injected-hostId-123', // Should be discarded by Lambda
      location: { locality: 'Bandra West', city: 'Mumbai', address: 'Private St 101' },
      pricing: { hourly: '60' },
      parkingDetails: { vehicleType: 'Car', parkingType: 'Covered' }
    }
  );

  if (createRes.status !== 201) {
    throw new Error(`Test 1 Failed: Expected status 201, got ${createRes.status}`);
  }

  const listingA = createRes.body;
  console.log(`✓ Listing created with ID: ${listingA.listingId}`);
  console.log(`✓ Verified listing.hostId is '${listingA.hostId}' (Cognito sub), NOT the client-injected value!`);

  if (listingA.hostId !== 'cognito-sub-host-AAA') {
    throw new Error(`Tamper Vulnerability: Expected hostId to be 'cognito-sub-host-AAA', got '${listingA.hostId}'`);
  }

  // ----------------------------------------------------
  // TEST 2: Host A retrieves their own listing
  // ----------------------------------------------------
  console.log('\nTEST 2: Host A fetches own listing (GET /api/listings/:id)...');
  const getOwnRes = await handleApiRequest('GET', `/api/listings/${listingA.listingId}`, headersHostA, {});
  if (getOwnRes.status !== 200) {
    throw new Error(`Test 2 Failed: Host A should be able to get own listing, got ${getOwnRes.status}`);
  }
  console.log(`✓ Host A successfully retrieved own listing (HTTP 200 OK)`);

  // ----------------------------------------------------
  // TEST 3: Host A updates own listing
  // ----------------------------------------------------
  console.log('\nTEST 3: Host A updates own listing (PUT /api/listings/:id)...');
  const updateOwnRes = await handleApiRequest(
    'PUT',
    `/api/listings/${listingA.listingId}`,
    headersHostA,
    { pricing: { hourly: '75' } }
  );
  if (updateOwnRes.status !== 200 || updateOwnRes.body.pricing?.hourly !== '75') {
    throw new Error(`Test 3 Failed: Host A should be able to update own listing, got ${updateOwnRes.status}`);
  }
  console.log(`✓ Host A successfully updated price to ₹75/hr (HTTP 200 OK)`);

  // ----------------------------------------------------
  // TEST 4: Host B attempts to GET Host A's private listing -> Must 403 Forbidden!
  // ----------------------------------------------------
  console.log('\nTEST 4: Host B attempts GET /api/listings/{listingA}...');
  const getOtherRes = await handleApiRequest('GET', `/api/listings/${listingA.listingId}`, headersHostB, {});
  console.log(`  Response: Status ${getOtherRes.status} - ${getOtherRes.body.error}`);
  if (getOtherRes.status !== 403) {
    throw new Error(`SECURITY VULNERABILITY: Host B got status ${getOtherRes.status} instead of 403 Forbidden!`);
  }
  console.log(`✓ Security verified: Host B received HTTP 403 Forbidden!`);

  // ----------------------------------------------------
  // TEST 5: Host B attempts to PUT Host A's private listing -> Must 403 Forbidden!
  // ----------------------------------------------------
  console.log('\nTEST 5: Host B attempts PUT /api/listings/{listingA}...');
  const putOtherRes = await handleApiRequest(
    'PUT',
    `/api/listings/${listingA.listingId}`,
    headersHostB,
    { pricing: { hourly: '1' } }
  );
  console.log(`  Response: Status ${putOtherRes.status} - ${putOtherRes.body.error}`);
  if (putOtherRes.status !== 403) {
    throw new Error(`SECURITY VULNERABILITY: Host B got status ${putOtherRes.status} instead of 403 Forbidden!`);
  }
  console.log(`✓ Security verified: Host B cannot modify Host A's listing (HTTP 403 Forbidden)!`);

  // ----------------------------------------------------
  // TEST 6: Host B attempts to DELETE Host A's private listing -> Must 403 Forbidden!
  // ----------------------------------------------------
  console.log('\nTEST 6: Host B attempts DELETE /api/listings/{listingA}...');
  const deleteOtherRes = await handleApiRequest('DELETE', `/api/listings/${listingA.listingId}`, headersHostB, {});
  console.log(`  Response: Status ${deleteOtherRes.status} - ${deleteOtherRes.body.error}`);
  if (deleteOtherRes.status !== 403) {
    throw new Error(`SECURITY VULNERABILITY: Host B got status ${deleteOtherRes.status} instead of 403 Forbidden!`);
  }
  console.log(`✓ Security verified: Host B cannot delete Host A's listing (HTTP 403 Forbidden)!`);

  // ----------------------------------------------------
  // TEST 7: Host A deletes own listing
  // ----------------------------------------------------
  console.log('\nTEST 7: Host A deletes own listing (DELETE /api/listings/:id)...');
  const deleteOwnRes = await handleApiRequest('DELETE', `/api/listings/${listingA.listingId}`, headersHostA, {});
  if (deleteOwnRes.status !== 200) {
    throw new Error(`Test 7 Failed: Host A should be able to delete own listing, got ${deleteOwnRes.status}`);
  }
  console.log(`✓ Host A successfully deleted own listing (HTTP 200 OK)`);

  // ----------------------------------------------------
  // TEST 8: Verify listing is deleted (404 Not Found)
  // ----------------------------------------------------
  console.log('\nTEST 8: Verify listing is removed...');
  const verifyGoneRes = await handleApiRequest('GET', `/api/listings/${listingA.listingId}`, headersHostA, {});
  if (verifyGoneRes.status !== 404) {
    throw new Error(`Test 8 Failed: Expected 404 Not Found, got ${verifyGoneRes.status}`);
  }
  console.log(`✓ Listing cleanly removed from database (HTTP 404 Not Found)`);

  console.log('\n====================================================');
  console.log('ALL 8 SERVER-SIDE OWNERSHIP TESTS PASSED WITH 100% SUCCESS!');
  console.log('====================================================\n');
}

runSecurityTest().catch((err) => {
  console.error('\n❌ Security Test Failed:', err);
  process.exit(1);
});
