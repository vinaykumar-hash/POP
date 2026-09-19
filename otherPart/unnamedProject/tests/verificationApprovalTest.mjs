/**
 * ParkSync - Step 6 Host Listing Verification & Approval Test Suite
 * 
 * Verifies all requirements of Step 6:
 * TEST 1: Normal host cannot access admin pending-list endpoint (HTTP 403)
 * TEST 2: Normal host cannot approve a listing (HTTP 403)
 * TEST 3: Normal host cannot reject a listing (HTTP 403)
 * TEST 4: Admin can retrieve pending listings (HTTP 200)
 * TEST 5: Admin can approve a pending listing (HTTP 200)
 * TEST 6: Approved listing stores status=approved, reviewedBy=admin sub, reviewedAt populated
 * TEST 7: Admin can reject a pending listing with reason (HTTP 200)
 * TEST 8: Rejected listing stores status=rejected, rejectionReason, reviewedBy, reviewedAt
 * TEST 9: Host cannot approve their own listing by sending { status: 'approved' } in payload
 * TEST 10: Host cannot forge reviewedBy in update payload
 * TEST 11: Host cannot forge reviewedAt in update payload
 * TEST 12: Host B cannot review Host A's listing merely because Host B is authenticated (HTTP 403)
 * TEST 13: Rejected listing can be resubmitted by host (HTTP 200)
 * TEST 14: Resubmission clears previous rejection metadata (rejectionReason=null, reviewedAt=null, reviewedBy=null)
 * TEST 15: Invalid status transitions are rejected (e.g. approving already approved, invalid states)
 * TEST 16: Admin cannot reject listing without a non-empty rejectionReason (HTTP 400)
 * TEST 17: Material edit to approved listing automatically resets status to pending_review
 */

import { handleApiRequest } from '../src/backend/apiRouter.js';

function createJwt(sub, name, email, groups = ['hosts']) {
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
  const payload = Buffer.from(JSON.stringify({
    sub,
    name,
    email,
    'cognito:groups': groups,
    groups,
    exp: Math.floor(Date.now() / 1000) + 3600
  })).toString('base64url');
  return `${header}.${payload}.mock_sig`;
}

async function runVerificationTests() {
  console.log('====================================================');
  console.log('PARKSYNC STEP 6 - VERIFICATION & APPROVAL TEST SUITE');
  console.log('====================================================\n');

  const hostA_Sub = 'cognito-sub-host-alice-01';
  const hostB_Sub = 'cognito-sub-host-bob-02';
  const admin_Sub = 'cognito-sub-admin-eve-99';

  const hostAToken = createJwt(hostA_Sub, 'Alice Host', 'alice@example.com', ['hosts']);
  const hostBToken = createJwt(hostB_Sub, 'Bob Host', 'bob@example.com', ['hosts']);
  const adminToken = createJwt(admin_Sub, 'Eve Admin', 'admin@parksync.local', ['admin']);

  const headersHostA = { Authorization: `Bearer ${hostAToken}` };
  const headersHostB = { Authorization: `Bearer ${hostBToken}` };
  const headersAdmin = { Authorization: `Bearer ${adminToken}` };

  // Setup: Host A creates listing 1
  const create1 = await handleApiRequest('POST', '/api/listings', headersHostA, {
    location: { locality: 'Koramangala', city: 'Bengaluru', address: '45 Green Park' },
    pricing: { hourly: '60', daily: '450' },
    parkingDetails: { vehicleType: 'Car', parkingType: 'Covered', capacity: 1, features: ['CCTV'] }
  });
  if (create1.status !== 201) throw new Error(`Setup failed: could not create listing 1`);
  const listing1 = create1.body;

  // Setup: Host A creates listing 2
  const create2 = await handleApiRequest('POST', '/api/listings', headersHostA, {
    location: { locality: 'Indiranagar', city: 'Bengaluru', address: '12th Main Road' },
    pricing: { hourly: '50', daily: '400' },
    parkingDetails: { vehicleType: 'Car', parkingType: 'Open', capacity: 2, features: ['Well lit'] }
  });
  if (create2.status !== 201) throw new Error(`Setup failed: could not create listing 2`);
  const listing2 = create2.body;

  // ----------------------------------------------------
  // TEST 1: Normal host cannot access admin pending-list endpoint (HTTP 403)
  // ----------------------------------------------------
  console.log('TEST 1: Normal host cannot access admin pending-list endpoint...');
  const res1 = await handleApiRequest('GET', '/api/admin/listings?status=pending_review', headersHostA, {});
  if (res1.status !== 403) {
    throw new Error(`Test 1 Failed: Expected 403 Forbidden, got ${res1.status}`);
  }
  console.log('✓ Passed: Normal host rejected with HTTP 403 Forbidden from admin queue.\n');

  // ----------------------------------------------------
  // TEST 2: Normal host cannot approve a listing (HTTP 403)
  // ----------------------------------------------------
  console.log('TEST 2: Normal host cannot approve a listing...');
  const res2 = await handleApiRequest('POST', `/api/admin/listings/${listing1.listingId}/approve`, headersHostA, {});
  if (res2.status !== 403) {
    throw new Error(`Test 2 Failed: Expected 403 Forbidden, got ${res2.status}`);
  }
  console.log('✓ Passed: Normal host rejected with HTTP 403 Forbidden when attempting approve.\n');

  // ----------------------------------------------------
  // TEST 3: Normal host cannot reject a listing (HTTP 403)
  // ----------------------------------------------------
  console.log('TEST 3: Normal host cannot reject a listing...');
  const res3 = await handleApiRequest('POST', `/api/admin/listings/${listing1.listingId}/reject`, headersHostA, {
    rejectionReason: 'Host attempting to reject'
  });
  if (res3.status !== 403) {
    throw new Error(`Test 3 Failed: Expected 403 Forbidden, got ${res3.status}`);
  }
  console.log('✓ Passed: Normal host rejected with HTTP 403 Forbidden when attempting reject.\n');

  // ----------------------------------------------------
  // TEST 4: Admin can retrieve pending listings (HTTP 200)
  // ----------------------------------------------------
  console.log('TEST 4: Admin can retrieve pending listings...');
  const res4 = await handleApiRequest('GET', '/api/admin/listings?status=pending_review', headersAdmin, {});
  if (res4.status !== 200 || !Array.isArray(res4.body)) {
    throw new Error(`Test 4 Failed: Expected 200 OK with array, got ${res4.status}`);
  }
  const pendingCount = res4.body.filter(l => l.status === 'pending_review').length;
  if (pendingCount < 2) {
    throw new Error(`Test 4 Failed: Expected at least 2 pending listings, got ${pendingCount}`);
  }
  console.log(`✓ Passed: Admin retrieved pending listings queue (${res4.body.length} items returned, HTTP 200 OK).\n`);

  // ----------------------------------------------------
  // TEST 5 & 6: Admin can approve a pending listing & review metadata is stored
  // ----------------------------------------------------
  console.log('TEST 5 & 6: Admin approves listing 1 and review metadata is recorded...');
  const res5 = await handleApiRequest('POST', `/api/admin/listings/${listing1.listingId}/approve`, headersAdmin, {});
  if (res5.status !== 200) {
    throw new Error(`Test 5 Failed: Expected 200 OK, got ${res5.status}`);
  }
  const approvedListing = res5.body;
  if (approvedListing.status !== 'approved') {
    throw new Error(`Test 6 Failed: Expected status 'approved', got '${approvedListing.status}'`);
  }
  if (approvedListing.reviewedBy !== admin_Sub) {
    throw new Error(`Test 6 Failed: Expected reviewedBy to be '${admin_Sub}', got '${approvedListing.reviewedBy}'`);
  }
  if (!approvedListing.reviewedAt) {
    throw new Error(`Test 6 Failed: Expected reviewedAt timestamp to be populated`);
  }
  if (approvedListing.rejectionReason !== null) {
    throw new Error(`Test 6 Failed: Expected rejectionReason to be null`);
  }
  console.log(`✓ Passed: Listing ${listing1.listingId} approved by admin (${approvedListing.reviewedBy}) at ${approvedListing.reviewedAt}.\n`);

  // ----------------------------------------------------
  // TEST 7 & 8: Admin can reject listing 2 with reason & review metadata is stored
  // ----------------------------------------------------
  console.log('TEST 7 & 8: Admin rejects listing 2 with reason...');
  const reasonText = 'Photos of the garage entrance are blurry and house number is unclear.';
  const res7 = await handleApiRequest('POST', `/api/admin/listings/${listing2.listingId}/reject`, headersAdmin, {
    rejectionReason: reasonText
  });
  if (res7.status !== 200) {
    throw new Error(`Test 7 Failed: Expected 200 OK, got ${res7.status}`);
  }
  const rejectedListing = res7.body;
  if (rejectedListing.status !== 'rejected') {
    throw new Error(`Test 8 Failed: Expected status 'rejected', got '${rejectedListing.status}'`);
  }
  if (rejectedListing.rejectionReason !== reasonText) {
    throw new Error(`Test 8 Failed: Expected rejectionReason to match, got '${rejectedListing.rejectionReason}'`);
  }
  if (rejectedListing.reviewedBy !== admin_Sub) {
    throw new Error(`Test 8 Failed: Expected reviewedBy '${admin_Sub}', got '${rejectedListing.reviewedBy}'`);
  }
  if (!rejectedListing.reviewedAt) {
    throw new Error(`Test 8 Failed: Expected reviewedAt to be populated`);
  }
  console.log(`✓ Passed: Listing ${listing2.listingId} rejected with reason: "${rejectedListing.rejectionReason}".\n`);

  // ----------------------------------------------------
  // TEST 9: Host cannot approve their own listing by sending { status: 'approved' } in payload
  // ----------------------------------------------------
  console.log('TEST 9: Host cannot approve own listing by sending status: "approved" in update payload...');
  const res9 = await handleApiRequest('PUT', `/api/listings/${listing2.listingId}`, headersHostA, {
    status: 'approved',
    pricing: { hourly: '99' }
  });
  if (res9.status !== 200) {
    throw new Error(`Test 9 Failed: Update call failed with ${res9.status}`);
  }
  if (res9.body.status === 'approved') {
    throw new Error(`Test 9 Failed: Host was able to illegally forge status: 'approved'!`);
  }
  console.log(`✓ Passed: Host attempt to forge status: 'approved' was safely blocked. Status transitioned to '${res9.body.status}'.\n`);

  // ----------------------------------------------------
  // TEST 10 & 11: Host cannot forge reviewedBy or reviewedAt
  // ----------------------------------------------------
  console.log('TEST 10 & 11: Host cannot forge reviewedBy or reviewedAt in payload...');
  const res10 = await handleApiRequest('PUT', `/api/listings/${listing2.listingId}`, headersHostA, {
    reviewedBy: 'fake-admin-sub',
    reviewedAt: '2099-01-01T00:00:00.000Z'
  });
  if (res10.body.reviewedBy === 'fake-admin-sub' || res10.body.reviewedAt === '2099-01-01T00:00:00.000Z') {
    throw new Error(`Test 10/11 Failed: Host forged review metadata in listing!`);
  }
  console.log('✓ Passed: Host attempt to forge reviewedBy/reviewedAt was discarded by server.\n');

  // ----------------------------------------------------
  // TEST 12: Host B cannot review Host A's listing merely because Host B is authenticated
  // ----------------------------------------------------
  console.log("TEST 12: Host B cannot review Host A's listing merely because Host B is authenticated...");
  const res12 = await handleApiRequest('POST', `/api/admin/listings/${listing2.listingId}/approve`, headersHostB, {});
  if (res12.status !== 403) {
    throw new Error(`Test 12 Failed: Expected 403 Forbidden for Host B, got ${res12.status}`);
  }
  console.log('✓ Passed: Host B rejected with HTTP 403 Forbidden by Cedar policy.\n');

  // ----------------------------------------------------
  // TEST 13 & 14: Rejected listing can be resubmitted and clears previous rejection metadata
  // ----------------------------------------------------
  console.log('TEST 13 & 14: Resubmitting rejected listing clears rejection metadata and returns to pending_review...');
  // First reject listing 2 again to test explicit resubmit endpoint
  await handleApiRequest('POST', `/api/admin/listings/${listing2.listingId}/reject`, headersAdmin, {
    rejectionReason: 'Needs better lighting photo'
  });

  const res13 = await handleApiRequest('POST', `/api/listings/${listing2.listingId}/resubmit`, headersHostA, {});
  if (res13.status !== 200) {
    throw new Error(`Test 13 Failed: Expected 200 OK for resubmit, got ${res13.status}`);
  }
  const resubmitted = res13.body;
  if (resubmitted.status !== 'pending_review') {
    throw new Error(`Test 14 Failed: Expected status 'pending_review', got '${resubmitted.status}'`);
  }
  if (resubmitted.rejectionReason !== null) {
    throw new Error(`Test 14 Failed: Expected rejectionReason to be reset to null, got '${resubmitted.rejectionReason}'`);
  }
  if (resubmitted.reviewedAt !== null) {
    throw new Error(`Test 14 Failed: Expected reviewedAt to be reset to null`);
  }
  if (resubmitted.reviewedBy !== null) {
    throw new Error(`Test 14 Failed: Expected reviewedBy to be reset to null`);
  }
  console.log('✓ Passed: Listing resubmitted successfully; status is pending_review and rejection metadata cleared.\n');

  // ----------------------------------------------------
  // TEST 15: Invalid status transitions are rejected
  // ----------------------------------------------------
  console.log('TEST 15: Invalid status transitions are rejected...');
  // Attempting to resubmit listing 1 which is already 'approved'
  const invalidResubmit = await handleApiRequest('POST', `/api/listings/${listing1.listingId}/resubmit`, headersHostA, {});
  if (invalidResubmit.status !== 400) {
    throw new Error(`Test 15 Failed: Expected 400 Bad Request when resubmitting approved listing, got ${invalidResubmit.status}`);
  }

  // Attempting to approve listing 1 which is already 'approved'
  const invalidApprove = await handleApiRequest('POST', `/api/admin/listings/${listing1.listingId}/approve`, headersAdmin, {});
  if (invalidApprove.status !== 400) {
    throw new Error(`Test 15 Failed: Expected 400 Bad Request when approving an already approved listing, got ${invalidApprove.status}`);
  }
  console.log('✓ Passed: Invalid transitions (approving approved, resubmitting approved) rejected with HTTP 400.\n');

  // ----------------------------------------------------
  // TEST 16: Admin cannot reject listing without a non-empty rejectionReason (HTTP 400)
  // ----------------------------------------------------
  console.log('TEST 16: Admin cannot reject listing without a non-empty rejectionReason...');
  const emptyReject = await handleApiRequest('POST', `/api/admin/listings/${listing2.listingId}/reject`, headersAdmin, {
    rejectionReason: '   '
  });
  if (emptyReject.status !== 400) {
    throw new Error(`Test 16 Failed: Expected 400 Bad Request for empty rejectionReason, got ${emptyReject.status}`);
  }
  console.log('✓ Passed: Empty rejection reason rejected with HTTP 400 Bad Request.\n');

  // ----------------------------------------------------
  // TEST 17: Material edit to approved listing automatically resets status to pending_review
  // ----------------------------------------------------
  console.log('TEST 17: Material edit to approved listing resets status to pending_review...');
  // listing 1 is currently 'approved'
  // Minor update: hourly price change
  const minorEdit = await handleApiRequest('PUT', `/api/listings/${listing1.listingId}`, headersHostA, {
    pricing: { hourly: '65', daily: '450' }
  });
  if (minorEdit.body.status !== 'approved') {
    throw new Error(`Test 17 Failed: Minor price edit unexpectedly changed status to '${minorEdit.body.status}'`);
  }
  console.log('  -> Minor price edit preserved approved status.');

  // Material update: location address change
  const materialEdit = await handleApiRequest('PUT', `/api/listings/${listing1.listingId}`, headersHostA, {
    location: { locality: 'Koramangala 5th Block', city: 'Bengaluru', address: '99 New Address' }
  });
  if (materialEdit.body.status !== 'pending_review') {
    throw new Error(`Test 17 Failed: Material location edit did not revert status to pending_review, got '${materialEdit.body.status}'`);
  }
  if (materialEdit.body.reviewedBy !== null || materialEdit.body.reviewedAt !== null) {
    throw new Error(`Test 17 Failed: Material edit did not clear review metadata`);
  }
  console.log('✓ Passed: Material address update reverted status to pending_review and cleared review metadata.\n');

  console.log('====================================================');
  console.log('ALL 17 STEP 6 VERIFICATION SCENARIOS PASSED WITH 100% SUCCESS!');
  console.log('====================================================\n');
}

runVerificationTests().catch((err) => {
  console.error('\n❌ Verification Test Failed:', err);
  process.exit(1);
});
