/**
 * ParkSync - Step 11 Host Identity, One-Time Verification & Multi-Host Isolation Test Suite
 * 
 * Verifies all 29 requirements specified in Step 16:
 *  1. Host A can load own host record (GET /api/hosts/me)
 *  2. Host B can load own host record (GET /api/hosts/me)
 *  3. Host A and B have different hostIds
 *  4. Host A verification persists
 *  5. Creating second listing does not reset verification
 *  6. Host A can create multiple listings
 *  7. All A listings use A's authenticated hostId
 *  8. Host B can create multiple listings
 *  9. B listings use B's authenticated hostId
 * 10. A cannot view B listing (GET /api/listings/:bId returns 403)
 * 11. B cannot view A listing (GET /api/listings/:aId returns 403)
 * 12. A cannot modify B listing (PUT /api/listings/:bId returns 403)
 * 13. B cannot modify A listing (PUT /api/listings/:aId returns 403)
 * 14. A cannot access B booking (GET /api/host/bookings/:bBookId returns 403)
 * 15. B cannot access A booking (GET /api/host/bookings/:aBookId returns 403)
 * 16. A cannot cancel B booking (POST /api/host/bookings/:bBookId/cancel returns 403)
 * 17. B cannot cancel A booking (POST /api/host/bookings/:aBookId/cancel returns 403)
 * 18. A cannot complete B booking (POST /api/host/bookings/:bBookId/complete returns 403)
 * 19. B cannot complete A booking (POST /api/host/bookings/:aBookId/complete returns 403)
 * 20. A cannot start B booking (POST /api/host/bookings/:bBookId/start returns 403)
 * 21. B cannot start A booking (POST /api/host/bookings/:aBookId/start returns 403)
 * 22. Forged hostId in listing creation is ignored/rejected
 * 23. Forged hostId in booking-related request is ignored/rejected
 * 24. Logout/login switches data correctly (isolated host queries)
 * 25. Host verification is account-level (stored in ParkSyncHosts)
 * 26. New listing remains pending_review independently of host verification
 * 27. Host verification does not change when listing is rejected
 * 28. Host verification does not change when listing is approved
 * 29. Host verification does not change when another listing is created
 */

import { handleApiRequest } from '../src/backend/apiRouter.js';
import { dynamoDbService } from '../src/backend/dynamoDbService.js';

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

function assert(condition, message) {
  if (!condition) {
    throw new Error(`ASSERTION FAILED: ${message}`);
  }
}

async function runIsolationAndVerificationTests() {
  console.log('================================================================');
  console.log('PARKSYNC STEP 11 - HOST IDENTITY, ONE-TIME VERIFICATION & ISOLATION AUDIT');
  console.log('================================================================\n');

  let passedCount = 0;
  const totalCount = 29;

  // Setup distinct test host identities
  const hostA_sub = 'cognito-sub-test-host-a';
  const hostB_sub = 'cognito-sub-test-host-b';
  const admin_sub = 'cognito-sub-admin-001';

  const tokenA = createJwt(hostA_sub, 'Test Host A', 'testa@example.com', ['hosts']);
  const tokenB = createJwt(hostB_sub, 'Test Host B', 'testb@example.com', ['hosts']);
  const tokenAdmin = createJwt(admin_sub, 'Admin User', 'admin@parksync.local', ['admin']);

  const headersA = { Authorization: `Bearer ${tokenA}` };
  const headersB = { Authorization: `Bearer ${tokenB}` };
  const headersAdmin = { Authorization: `Bearer ${tokenAdmin}` };

  let listingA1_id, listingA2_id, listingA3_id;
  let listingB1_id, listingB2_id;
  let bookingA_id, bookingB_id;

  // TEST 1: Host A can load own host record
  console.log('Test 1: Host A can load own host record (GET /api/hosts/me)');
  const res1 = await handleApiRequest('GET', '/api/hosts/me', headersA);
  assert(res1.status === 200, `Expected 200, got ${res1.status}`);
  const hostARecord = res1.body;
  assert(hostARecord.hostId === hostA_sub, `Expected hostId ${hostA_sub}, got ${hostARecord.hostId}`);
  assert(hostARecord.verification?.status === 'verified', `Expected verified status for Host A, got ${hostARecord.verification?.status}`);
  console.log('✓ PASS: Host A retrieved own verified host record\n');
  passedCount++;

  // TEST 2: Host B can load own host record
  console.log('Test 2: Host B can load own host record (GET /api/hosts/me)');
  const res2 = await handleApiRequest('GET', '/api/hosts/me', headersB);
  assert(res2.status === 200, `Expected 200, got ${res2.status}`);
  const hostBRecord = res2.body;
  assert(hostBRecord.hostId === hostB_sub, `Expected hostId ${hostB_sub}, got ${hostBRecord.hostId}`);
  assert(hostBRecord.verification?.status === 'verified', `Expected verified status for Host B, got ${hostBRecord.verification?.status}`);
  console.log('✓ PASS: Host B retrieved own verified host record\n');
  passedCount++;

  // TEST 3: Host A and Host B have different hostIds
  console.log('Test 3: Host A and B have different hostIds');
  assert(hostARecord.hostId !== hostBRecord.hostId, 'Host A and Host B must have distinct host identities');
  console.log(`✓ PASS: Host A (${hostARecord.hostId}) !== Host B (${hostBRecord.hostId})\n`);
  passedCount++;

  // TEST 4: Host A verification persists
  console.log('Test 4: Host A verification persists across queries');
  const res4 = await handleApiRequest('GET', `/api/hosts/${hostA_sub}`, headersA);
  assert(res4.status === 200, `Expected 200, got ${res4.status}`);
  const hostAProfile = res4.body;
  assert(hostAProfile.verification?.status === 'verified', 'Host A verification must remain verified');
  console.log('✓ PASS: Host A profile verification persists as verified\n');
  passedCount++;

  // TEST 5 & 6 & 7: Host A creates Listing A1 and A2 without resetting verification
  console.log('Test 5, 6, 7: Host A can create multiple listings (A1, A2) and all use Host A hostId');
  const resListingA1 = await handleApiRequest('POST', '/api/listings', headersA, {
    location: { locality: 'Koramangala 4th Block', city: 'Bengaluru' },
    parkingDetails: { parkingType: 'Covered', vehicleType: 'Car', capacity: 1 },
    pricing: { hourly: 60, daily: 400 },
    availability: { days: ['Monday', 'Tuesday'], startTime: '09:00', endTime: '18:00' }
  });
  assert(resListingA1.status === 201, `Failed to create listing A1: ${resListingA1.status}`);
  const listingA1 = resListingA1.body;
  listingA1_id = listingA1.listingId;
  assert(listingA1.hostId === hostA_sub, `Listing A1 hostId mismatch: expected ${hostA_sub}, got ${listingA1.hostId}`);

  const resListingA2 = await handleApiRequest('POST', '/api/listings', headersA, {
    location: { locality: 'Indiranagar 100ft Rd', city: 'Bengaluru' },
    parkingDetails: { parkingType: 'Open', vehicleType: 'Car', capacity: 2 },
    pricing: { hourly: 80, daily: 500 },
    availability: { days: ['Monday', 'Wednesday', 'Friday'], startTime: '08:00', endTime: '20:00' }
  });
  assert(resListingA2.status === 201, `Failed to create listing A2: ${resListingA2.status}`);
  const listingA2 = resListingA2.body;
  listingA2_id = listingA2.listingId;
  assert(listingA2.hostId === hostA_sub, `Listing A2 hostId mismatch: expected ${hostA_sub}, got ${listingA2.hostId}`);

  // Verify host verification is still verified
  const checkHostA = await dynamoDbService.getHostById(hostA_sub);
  assert(checkHostA.verification?.status === 'verified', 'Host A verification must not reset when creating listings');
  console.log('✓ PASS: Created Listing A1 and A2 under Host A identity; Host A verification remained verified\n');
  passedCount += 3;

  // TEST 8 & 9: Host B creates listings B1 and B2
  console.log('Test 8, 9: Host B can create multiple listings (B1, B2) using Host B hostId');
  const resListingB1 = await handleApiRequest('POST', '/api/listings', headersB, {
    location: { locality: 'HSR Layout Sector 2', city: 'Bengaluru' },
    parkingDetails: { parkingType: 'Basement', vehicleType: 'SUV', capacity: 1 },
    pricing: { hourly: 70, daily: 450 },
    availability: { days: ['Monday', 'Tuesday', 'Wednesday'], startTime: '07:00', endTime: '22:00' }
  });
  assert(resListingB1.status === 201, `Failed to create listing B1: ${resListingB1.status}`);
  const listingB1 = resListingB1.body;
  listingB1_id = listingB1.listingId;
  assert(listingB1.hostId === hostB_sub, `Listing B1 hostId mismatch: expected ${hostB_sub}, got ${listingB1.hostId}`);

  const resListingB2 = await handleApiRequest('POST', '/api/listings', headersB, {
    location: { locality: 'Whitefield Main Rd', city: 'Bengaluru' },
    parkingDetails: { parkingType: 'Covered', vehicleType: 'Car', capacity: 1 },
    pricing: { hourly: 50, daily: 300 },
    availability: { days: ['Saturday', 'Sunday'], startTime: '10:00', endTime: '20:00' }
  });
  assert(resListingB2.status === 201, `Failed to create listing B2: ${resListingB2.status}`);
  const listingB2 = resListingB2.body;
  listingB2_id = listingB2.listingId;
  assert(listingB2.hostId === hostB_sub, `Listing B2 hostId mismatch: expected ${hostB_sub}, got ${listingB2.hostId}`);
  console.log('✓ PASS: Created Listing B1 and B2 under Host B identity\n');
  passedCount += 2;

  // TEST 10: Host A cannot view Host B's listing details directly (Cedar / Ownership)
  console.log('Test 10: Host A cannot view Host B listing (GET /api/listings/:b1)');
  const res10 = await handleApiRequest('GET', `/api/listings/${listingB1_id}`, headersA);
  assert(res10.status === 403, `Expected 403 Forbidden, got ${res10.status}`);
  console.log('✓ PASS: Host A blocked from viewing Host B listing\n');
  passedCount++;

  // TEST 11: Host B cannot view Host A's listing details
  console.log('Test 11: Host B cannot view Host A listing (GET /api/listings/:a1)');
  const res11 = await handleApiRequest('GET', `/api/listings/${listingA1_id}`, headersB);
  assert(res11.status === 403, `Expected 403 Forbidden, got ${res11.status}`);
  console.log('✓ PASS: Host B blocked from viewing Host A listing\n');
  passedCount++;

  // TEST 12: Host A cannot modify Host B listing
  console.log('Test 12: Host A cannot modify Host B listing (PUT /api/listings/:b1)');
  const res12 = await handleApiRequest('PUT', `/api/listings/${listingB1_id}`, headersA, { pricing: { hourly: 999 } });
  assert(res12.status === 403, `Expected 403 Forbidden, got ${res12.status}`);
  console.log('✓ PASS: Host A blocked from modifying Host B listing\n');
  passedCount++;

  // TEST 13: Host B cannot modify Host A listing
  console.log('Test 13: Host B cannot modify Host A listing (PUT /api/listings/:a1)');
  const res13 = await handleApiRequest('PUT', `/api/listings/${listingA1_id}`, headersB, { pricing: { hourly: 999 } });
  assert(res13.status === 403, `Expected 403 Forbidden, got ${res13.status}`);
  console.log('✓ PASS: Host B blocked from modifying Host A listing\n');
  passedCount++;

  // Seed sample bookings for Host A and Host B
  const sampleBookingA = await dynamoDbService.createBooking({
    bookingId: `test-book-A-${Date.now()}`,
    listingId: listingA1_id,
    hostId: hostA_sub,
    renterId: 'renter-101',
    renterName: 'Renter One',
    status: 'confirmed',
    pricing: { totalAmount: 120 }
  });
  bookingA_id = sampleBookingA.bookingId;

  const sampleBookingB = await dynamoDbService.createBooking({
    bookingId: `test-book-B-${Date.now()}`,
    listingId: listingB1_id,
    hostId: hostB_sub,
    renterId: 'renter-202',
    renterName: 'Renter Two',
    status: 'confirmed',
    pricing: { totalAmount: 150 }
  });
  bookingB_id = sampleBookingB.bookingId;

  // TEST 14: Host A cannot access Host B booking
  console.log('Test 14: Host A cannot access Host B booking (GET /api/host/bookings/:bBook)');
  const res14 = await handleApiRequest('GET', `/api/host/bookings/${bookingB_id}`, headersA);
  assert(res14.status === 403, `Expected 403 Forbidden, got ${res14.status}`);
  console.log('✓ PASS: Host A blocked from viewing Host B booking\n');
  passedCount++;

  // TEST 15: Host B cannot access Host A booking
  console.log('Test 15: Host B cannot access Host A booking (GET /api/host/bookings/:aBook)');
  const res15 = await handleApiRequest('GET', `/api/host/bookings/${bookingA_id}`, headersB);
  assert(res15.status === 403, `Expected 403 Forbidden, got ${res15.status}`);
  console.log('✓ PASS: Host B blocked from viewing Host A booking\n');
  passedCount++;

  // TEST 16: Host A cannot cancel Host B booking
  console.log('Test 16: Host A cannot cancel Host B booking (POST /api/host/bookings/:bBook/cancel)');
  const res16 = await handleApiRequest('POST', `/api/host/bookings/${bookingB_id}/cancel`, headersA);
  assert(res16.status === 403, `Expected 403 Forbidden, got ${res16.status}`);
  console.log('✓ PASS: Host A blocked from canceling Host B booking\n');
  passedCount++;

  // TEST 17: Host B cannot cancel Host A booking
  console.log('Test 17: Host B cannot cancel Host A booking (POST /api/host/bookings/:aBook/cancel)');
  const res17 = await handleApiRequest('POST', `/api/host/bookings/${bookingA_id}/cancel`, headersB);
  assert(res17.status === 403, `Expected 403 Forbidden, got ${res17.status}`);
  console.log('✓ PASS: Host B blocked from canceling Host A booking\n');
  passedCount++;

  // TEST 18: Host A cannot complete Host B booking
  console.log('Test 18: Host A cannot complete Host B booking (POST /api/host/bookings/:bBook/complete)');
  const res18 = await handleApiRequest('POST', `/api/host/bookings/${bookingB_id}/complete`, headersA);
  assert(res18.status === 403, `Expected 403 Forbidden, got ${res18.status}`);
  console.log('✓ PASS: Host A blocked from completing Host B booking\n');
  passedCount++;

  // TEST 19: Host B cannot complete Host A booking
  console.log('Test 19: Host B cannot complete Host A booking (POST /api/host/bookings/:aBook/complete)');
  const res19 = await handleApiRequest('POST', `/api/host/bookings/${bookingA_id}/complete`, headersB);
  assert(res19.status === 403, `Expected 403 Forbidden, got ${res19.status}`);
  console.log('✓ PASS: Host B blocked from completing Host A booking\n');
  passedCount++;

  // TEST 20: Host A cannot start Host B booking
  console.log('Test 20: Host A cannot start Host B booking (POST /api/host/bookings/:bBook/start)');
  const res20 = await handleApiRequest('POST', `/api/host/bookings/${bookingB_id}/start`, headersA);
  assert(res20.status === 403, `Expected 403 Forbidden, got ${res20.status}`);
  console.log('✓ PASS: Host A blocked from starting Host B booking\n');
  passedCount++;

  // TEST 21: Host B cannot start Host A booking
  console.log('Test 21: Host B cannot start Host A booking (POST /api/host/bookings/:aBook/start)');
  const res21 = await handleApiRequest('POST', `/api/host/bookings/${bookingA_id}/start`, headersB);
  assert(res21.status === 403, `Expected 403 Forbidden, got ${res21.status}`);
  console.log('✓ PASS: Host B blocked from starting Host A booking\n');
  passedCount++;

  // TEST 22: Forged hostId in listing creation is ignored/rejected
  console.log('Test 22: Forged hostId in listing creation is overridden by authenticated sub');
  const res22 = await handleApiRequest('POST', '/api/listings', headersA, {
    hostId: 'cognito-sub-test-host-b', // Attempt to forge Host B identity
    owner: 'cognito-sub-test-host-b',
    location: { locality: 'Impersonation St', city: 'Bengaluru' },
    parkingDetails: { parkingType: 'Open', vehicleType: 'Car', capacity: 1 },
    pricing: { hourly: 100 }
  });
  assert(res22.status === 201, `Expected 201, got ${res22.status}`);
  const forgedResult = res22.body;
  assert(forgedResult.hostId === hostA_sub, `Security breach: server trusted client hostId! expected ${hostA_sub}, got ${forgedResult.hostId}`);
  console.log('✓ PASS: Server derived hostId strictly from Cognito claims.sub, ignoring client forgery\n');
  passedCount++;

  // TEST 23: Forged hostId in booking query is ignored
  console.log('Test 23: Forged hostId in booking query parameters is ignored');
  const res23 = await handleApiRequest('GET', `/api/host/bookings?hostId=${hostB_sub}`, headersA);
  assert(res23.status === 200, `Expected 200, got ${res23.status}`);
  const hostABookings = res23.body;
  assert(hostABookings.every(b => b.hostId === hostA_sub), 'Host A query returned non-Host A bookings!');
  console.log('✓ PASS: Server ignored forged query parameter and returned only Host A bookings\n');
  passedCount++;

  // TEST 24: Logout/Login switching isolates datasets completely
  console.log('Test 24: Logout/login data loading strictly returns authorized dataset');
  const resA_listings = await handleApiRequest('GET', '/api/listings', headersA);
  const listingsForA = resA_listings.body;
  assert(listingsForA.every(l => l.hostId === hostA_sub), 'Host A received listings belonging to another host');

  const resB_listings = await handleApiRequest('GET', '/api/listings', headersB);
  const listingsForB = resB_listings.body;
  assert(listingsForB.every(l => l.hostId === hostB_sub), 'Host B received listings belonging to another host');
  assert(!listingsForB.some(lb => listingsForA.some(la => la.listingId === lb.listingId)), 'Cross-host listing leak detected');
  console.log('✓ PASS: Host A listings and Host B listings are 100% mutually disjoint\n');
  passedCount++;

  // TEST 25: Host verification is account-level in ParkSyncHosts
  console.log('Test 25: Host verification is stored at account level in ParkSyncHosts');
  const hostRecord = await dynamoDbService.getHostById(hostA_sub);
  assert(hostRecord.hostId === hostA_sub, 'Host record must exist with hostId PK');
  assert(hostRecord.verification?.status === 'verified', 'Host record verification must be verified');
  console.log('✓ PASS: Host verification exists independently on ParkSyncHosts\n');
  passedCount++;

  // TEST 26: New listing remains pending_review independently of host verification
  console.log('Test 26: New listing remains pending_review independently of host verification');
  assert(listingA1.status === 'pending_review', `Expected listing A1 to be pending_review, got ${listingA1.status}`);
  assert(hostRecord.verification?.status === 'verified', 'Host A must remain verified');
  console.log('✓ PASS: Listing status (pending_review) is decoupled from Host account status (verified)\n');
  passedCount++;

  // TEST 27: Host verification does not change when listing is rejected
  console.log('Test 27: Host verification does not change when listing is rejected');
  const resReject = await handleApiRequest('POST', `/api/admin/listings/${listingA2_id}/reject`, headersAdmin, {
    reason: 'Need clearer photos of the gate entrance'
  });
  assert(resReject.status === 200, `Expected 200 on admin reject, got ${resReject.status}`);
  const rejectedListing = resReject.body;
  assert(rejectedListing.status === 'rejected', `Expected listing status rejected, got ${rejectedListing.status}`);
  
  const hostAfterReject = await dynamoDbService.getHostById(hostA_sub);
  assert(hostAfterReject.verification?.status === 'verified', 'Host A must remain verified even after a listing is rejected');
  console.log('✓ PASS: Admin rejected listing A2; Host A account verification remains verified\n');
  passedCount++;

  // TEST 28: Host verification does not change when listing is approved
  console.log('Test 28: Host verification does not change when listing is approved');
  const resApprove = await handleApiRequest('POST', `/api/admin/listings/${listingA1_id}/approve`, headersAdmin);
  assert(resApprove.status === 200, `Expected 200 on admin approve, got ${resApprove.status}`);
  const approvedListing = resApprove.body;
  assert(approvedListing.status === 'approved', `Expected listing status approved, got ${approvedListing.status}`);

  const hostAfterApprove = await dynamoDbService.getHostById(hostA_sub);
  assert(hostAfterApprove.verification?.status === 'verified', 'Host A must remain verified after listing approval');
  console.log('✓ PASS: Admin approved listing A1; Host A account verification remains verified\n');
  passedCount++;

  // TEST 29: Host verification does not change when another listing is created (Listing A3)
  console.log('Test 29: Host verification does not change when 3rd listing is created');
  const resListingA3 = await handleApiRequest('POST', '/api/listings', headersA, {
    location: { locality: 'MG Road Metro Station', city: 'Bengaluru' },
    parkingDetails: { parkingType: 'Valet', vehicleType: 'Car', capacity: 5 },
    pricing: { hourly: 120, daily: 800 }
  });
  assert(resListingA3.status === 201, `Failed to create listing A3: ${resListingA3.status}`);
  const listingA3 = resListingA3.body;
  listingA3_id = listingA3.listingId;
  assert(listingA3.hostId === hostA_sub, `Listing A3 hostId mismatch`);
  assert(listingA3.status === 'pending_review', `Listing A3 must be pending_review`);

  const hostAfter3rdListing = await dynamoDbService.getHostById(hostA_sub);
  assert(hostAfter3rdListing.verification?.status === 'verified', 'Host A must remain verified after 3rd listing creation');
  console.log('✓ PASS: Listing A3 created; Host A verification remains verified without re-submitting docs\n');
  passedCount++;

  // TEST 30: Host A cannot delete Host B listing
  console.log('Test 30: Host A cannot delete Host B listing (DELETE /api/listings/:b1)');
  const res30 = await handleApiRequest('DELETE', `/api/listings/${listingB1_id}`, headersA);
  assert(res30.status === 403, `Expected 403 Forbidden, got ${res30.status}`);
  console.log('✓ PASS: Host A blocked from deleting Host B listing\n');
  passedCount++;

  // TEST 31: Host B cannot delete Host A listing
  console.log('Test 31: Host B cannot delete Host A listing (DELETE /api/listings/:a1)');
  const res31 = await handleApiRequest('DELETE', `/api/listings/${listingA1_id}`, headersB);
  assert(res31.status === 403, `Expected 403 Forbidden, got ${res31.status}`);
  console.log('✓ PASS: Host B blocked from deleting Host A listing\n');
  passedCount++;

  // TEST 32: Host B cannot create listing for Host A by injecting Host A hostId
  console.log('Test 32: Host B cannot create listing for Host A by injecting hostId');
  const res32 = await handleApiRequest('POST', '/api/listings', headersB, {
    hostId: hostA_sub,
    owner: hostA_sub,
    location: { locality: 'Attempted Host A Spoof', city: 'Bengaluru' },
    parkingDetails: { parkingType: 'Open', vehicleType: 'Car', capacity: 1 },
    pricing: { hourly: 90 }
  });
  assert(res32.status === 201, `Expected 201, got ${res32.status}`);
  const forgedB = res32.body;
  assert(forgedB.hostId === hostB_sub, `Security breach: server assigned hostId ${forgedB.hostId}, expected ${hostB_sub}`);
  console.log('✓ PASS: Server derived hostId strictly as Host B Cognito sub, ignoring spoofed Host A ID\n');
  passedCount++;

  // TEST 33: Full Multi-Host Switch Lifecycle (A -> B -> A)
  console.log('Test 33: Full Multi-Host Switch Lifecycle (A -> B -> A isolation verification)');
  // Host A fetches listings
  const finalA = await handleApiRequest('GET', '/api/listings', headersA);
  const aListings = finalA.body;
  assert(aListings.length >= 3, `Expected at least 3 listings for Host A, got ${aListings.length}`);
  assert(aListings.every(l => l.hostId === hostA_sub), 'Host A query leaked other listings');

  // Host B fetches listings
  const finalB = await handleApiRequest('GET', '/api/listings', headersB);
  const bListings = finalB.body;
  assert(bListings.length >= 2, `Expected at least 2 listings for Host B, got ${bListings.length}`);
  assert(bListings.every(l => l.hostId === hostB_sub), 'Host B query leaked other listings');
  assert(!bListings.some(bl => aListings.some(al => al.listingId === bl.listingId)), 'Cross-host listing leak detected in multi-host cycle');
  console.log('✓ PASS: Verified complete multi-host session switching and isolation (0 data leakage)\n');
  passedCount++;

  // ==========================================================================
  // ONE-TIME VERIFICATION & 3-STATE LIFECYCLE TESTS (Cases A, B, C, D, E)
  // ==========================================================================

  const hostC_sub = 'cognito-sub-test-host-c';
  const tokenC = createJwt(hostC_sub, 'Test Host C', 'testc@example.com', ['hosts']);
  const headersC = { Authorization: `Bearer ${tokenC}` };

  // TEST 34: CASE A - Brand new host defaults to NOT_SUBMITTED
  console.log('Test 34: CASE A - Brand new host (Test Host C) defaults to NOT_SUBMITTED verification status');
  const res34 = await handleApiRequest('GET', '/api/hosts/me', headersC);
  assert(res34.status === 200, `Expected 200, got ${res34.status}`);
  const hostCInitial = res34.body;
  assert(hostCInitial.hostId === hostC_sub, `Expected hostId ${hostC_sub}, got ${hostCInitial.hostId}`);
  assert(hostCInitial.verification?.status === 'not_submitted', `Expected not_submitted, got ${hostCInitial.verification?.status}`);
  console.log('✓ PASS: New host correctly initialized with NOT_SUBMITTED status\n');
  passedCount++;

  // TEST 35: CASE A -> B - Host submits verification documents -> becomes PENDING
  console.log('Test 35: Host C submits verification documents -> transitions to PENDING');
  const res35 = await handleApiRequest('POST', '/api/hosts', headersC, {
    name: 'Test Host C',
    email: 'testc@example.com',
    phone: '9876543212',
    verification: {
      status: 'pending',
      documentKey: 'hosts/pending/verification/doc_host_c.pdf',
      submittedAt: new Date().toISOString()
    }
  });
  assert(res35.status === 200, `Expected 200, got ${res35.status}`);
  const hostCAfterSubmit = res35.body;
  assert(hostCAfterSubmit.verification?.status === 'pending', `Expected pending status, got ${hostCAfterSubmit.verification?.status}`);
  console.log('✓ PASS: Host C verification status transitioned to PENDING upon document submission\n');
  passedCount++;

  // TEST 36: CASE B - Pending host creates 1st listing without losing pending status
  console.log('Test 36: CASE B - Pending host creates 1st listing; status remains PENDING');
  const resListingC1 = await handleApiRequest('POST', '/api/listings', headersC, {
    location: { locality: 'Koramangala 5th Block', city: 'Bengaluru' },
    parkingDetails: { parkingType: 'Covered', vehicleType: 'Car', capacity: 1 },
    pricing: { hourly: 55, daily: 350 }
  });
  assert(resListingC1.status === 201, `Failed to create listing C1: ${resListingC1.status}`);
  const listingC1 = resListingC1.body;
  assert(listingC1.hostId === hostC_sub, `Listing C1 hostId mismatch`);
  
  const checkHostC1 = await dynamoDbService.getHostById(hostC_sub);
  assert(checkHostC1.verification?.status === 'pending', 'Host C status must remain PENDING');
  console.log('✓ PASS: Created 1st listing under PENDING host; verification remains PENDING\n');
  passedCount++;

  // TEST 37: CASE E - Pending host creates 2nd listing without re-submitting verification
  console.log('Test 37: CASE E - Pending host creates 2nd listing without re-verification; status remains PENDING');
  const resListingC2 = await handleApiRequest('POST', '/api/listings', headersC, {
    location: { locality: 'Bellandur EcoSpace', city: 'Bengaluru' },
    parkingDetails: { parkingType: 'Basement', vehicleType: 'Car', capacity: 2 },
    pricing: { hourly: 65, daily: 420 }
  });
  assert(resListingC2.status === 201, `Failed to create listing C2: ${resListingC2.status}`);
  const listingC2 = resListingC2.body;
  assert(listingC2.hostId === hostC_sub, `Listing C2 hostId mismatch`);

  const checkHostC2 = await dynamoDbService.getHostById(hostC_sub);
  assert(checkHostC2.verification?.status === 'pending', 'Host C status must remain PENDING after 2nd listing');
  console.log('✓ PASS: Created 2nd listing under PENDING host without re-verification\n');
  passedCount++;

  // TEST 38: CASE C - Admin verifies Host C -> status becomes VERIFIED
  console.log('Test 38: CASE C - Admin approves Host C -> status becomes VERIFIED and persists');
  const resVerifyC = await handleApiRequest('POST', `/api/admin/hosts/${hostC_sub}/verify`, headersAdmin);
  assert(resVerifyC.status === 200, `Expected 200 on admin verify, got ${resVerifyC.status}`);
  const verifiedHostC = resVerifyC.body;
  assert(verifiedHostC.verification?.status === 'verified', `Expected verified status, got ${verifiedHostC.verification?.status}`);

  // Verified host creates 3rd listing seamlessly
  const resListingC3 = await handleApiRequest('POST', '/api/listings', headersC, {
    location: { locality: 'Sarjapur Rd', city: 'Bengaluru' },
    parkingDetails: { parkingType: 'Covered', vehicleType: 'SUV', capacity: 1 },
    pricing: { hourly: 75, daily: 500 }
  });
  assert(resListingC3.status === 201, `Failed to create listing C3: ${resListingC3.status}`);
  const listingC3 = resListingC3.body;
  assert(listingC3.hostId === hostC_sub, `Listing C3 hostId mismatch`);

  const checkHostC3 = await dynamoDbService.getHostById(hostC_sub);
  assert(checkHostC3.verification?.status === 'verified', 'Host C status must remain VERIFIED');
  console.log('✓ PASS: Admin verified Host C; 3rd listing created seamlessly under VERIFIED status\n');
  passedCount++;

  console.log('================================================================');
  console.log(`STEP 11 AUDIT COMPLETE: ${passedCount}/${totalCount + 9} TESTS PASSED`);
  console.log('================================================================');
}

runIsolationAndVerificationTests().catch((err) => {
  console.error('\n❌ STEP 11 TEST SUITE FAILED:', err);
  process.exit(1);
});
