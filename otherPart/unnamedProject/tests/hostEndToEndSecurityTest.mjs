/**
 * ParkSync - Step 10 Host End-to-End Security & Authorization Audit
 * 
 * Verifies all 20 security invariants specified in Section 30:
 *  1. Host A creates listing
 *  2. Host A owns listing (server assigns hostId from Cognito claims.sub)
 *  3. Host B cannot modify listing (HTTP 403 Forbidden)
 *  4. Admin can review listing (Admin can view pending queue)
 *  5. Host A cannot approve listing (HTTP 403 Forbidden)
 *  6. Admin approves listing (HTTP 200 OK, status = approved)
 *  7. Host A updates availability (HTTP 200 OK)
 *  8. Host B cannot update availability (HTTP 403 Forbidden)
 *  9. Booking belongs to Host A (hostId derived from listing)
 * 10. Host B cannot view booking (HTTP 403 Forbidden)
 * 11. Host B cannot cancel booking (HTTP 403 Forbidden)
 * 12. Host B cannot start session (HTTP 403 Forbidden)
 * 13. Host B cannot complete session (HTTP 403 Forbidden)
 * 14. Host A can start session (HTTP 200 OK, session.startedAt set)
 * 15. Host A can complete session (HTTP 200 OK, status = completed, session.completedAt set)
 * 16. Host cannot forge hostId (client-injected hostId ignored)
 * 17. Host cannot forge reviewedBy or reviewedAt (client-injected review fields ignored)
 * 18. Host cannot forge booking status directly
 * 19. Unauthenticated requests return 401 Unauthorized
 * 20. Admin-only endpoints remain protected from normal hosts (HTTP 403 Forbidden)
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

async function runEndToEndSecurityAudit() {
  console.log('====================================================');
  console.log('PARKSYNC STEP 10 - HOST END-TO-END SECURITY AUDIT');
  console.log('====================================================\n');

  const hostA_token = createJwt('cognito-sub-host-A-100', 'Host Alice', 'alice@example.com', ['hosts']);
  const hostB_token = createJwt('cognito-sub-host-B-200', 'Host Bob', 'bob@example.com', ['hosts']);
  const admin_token = createJwt('cognito-sub-admin-900', 'Admin Eve', 'admin@parksync.in', ['admin']);

  const headersA = { Authorization: `Bearer ${hostA_token}` };
  const headersB = { Authorization: `Bearer ${hostB_token}` };
  const headersAdmin = { Authorization: `Bearer ${admin_token}` };

  let listingId = null;
  let bookingId = null;

  // 1. Host A creates listing
  console.log('TEST 1: Host A creates listing...');
  const createListingRes = await handleApiRequest('POST', '/api/listings', headersA, {
    location: {
      address: '100 Security Boulevard, Sector 5',
      locality: 'Cyber City',
      city: 'Gurugram',
      state: 'Haryana',
      pincode: '122002'
    },
    parkingDetails: {
      parkingType: 'covered',
      vehicleType: 'car',
      capacity: 1,
      features: ['cctv', 'ev_charging'],
      instructions: 'Park in bay #A-101 and scan QR at security desk.'
    },
    pricing: {
      hourly: '90',
      daily: '650',
      currency: 'INR'
    },
    hostId: 'FORGED_ATTEMPT_HOST_X' // Attempting to forge hostId
  });

  assert(createListingRes.status === 201, `Expected status 201, got ${createListingRes.status}`);
  const createdListing = createListingRes.body;
  listingId = createdListing.listingId;
  assert(listingId, 'Listing ID should exist');
  console.log(`✓ Test 1 Passed: Listing created with ID: ${listingId}`);

  // 2. Host A owns listing
  console.log('TEST 2: Verify Host A owns listing (Cognito sub)...');
  assert(createdListing.hostId === 'cognito-sub-host-A-100', `HostId must equal Host A sub, got ${createdListing.hostId}`);
  assert(createdListing.hostId !== 'FORGED_ATTEMPT_HOST_X', 'Injected hostId must be discarded');
  console.log('✓ Test 2 Passed: Listing ownership strictly bound to Host A Cognito claims.sub.');

  // 3. Host B cannot modify listing
  console.log('TEST 3: Host B cannot modify listing (HTTP 403)...');
  const hostBUpdateRes = await handleApiRequest('PUT', `/api/listings/${listingId}`, headersB, {
    pricing: { hourly: '10' }
  });
  assert(hostBUpdateRes.status === 403, `Expected status 403, got ${hostBUpdateRes.status}`);
  console.log('✓ Test 3 Passed: Host B modification denied by Cedar policy with HTTP 403 Forbidden.');

  // 4. Admin can review listing
  console.log('TEST 4: Admin can view pending listings queue...');
  const adminPendingRes = await handleApiRequest('GET', '/api/admin/listings', headersAdmin);
  assert(adminPendingRes.status === 200, `Expected status 200, got ${adminPendingRes.status}`);
  const pendingList = adminPendingRes.body;
  const foundInQueue = pendingList.some((l) => l.listingId === listingId);
  assert(foundInQueue, 'Newly created listing should appear in admin pending queue');
  console.log('✓ Test 4 Passed: Admin can view pending listing in review queue.');

  // 5. Host A cannot approve listing
  console.log('TEST 5: Host A cannot approve listing (HTTP 403)...');
  const hostAApproveRes = await handleApiRequest('POST', `/api/admin/listings/${listingId}/approve`, headersA, {});
  assert(hostAApproveRes.status === 403, `Expected status 403, got ${hostAApproveRes.status}`);
  console.log('✓ Test 5 Passed: Host A approval attempt blocked with HTTP 403 Forbidden.');

  // 6. Admin approves listing
  console.log('TEST 6: Admin approves listing (HTTP 200)...');
  const adminApproveRes = await handleApiRequest('POST', `/api/admin/listings/${listingId}/approve`, headersAdmin, {});
  assert(adminApproveRes.status === 200, `Expected status 200, got ${adminApproveRes.status}`);
  const approvedListing = adminApproveRes.body;
  assert(approvedListing.status === 'approved', `Expected status approved, got ${approvedListing.status}`);
  console.log('✓ Test 6 Passed: Admin approved listing; status is "approved".');

  // 7. Host A updates availability
  console.log('TEST 7: Host A updates availability...');
  const hostAAvailRes = await handleApiRequest('PUT', `/api/listings/${listingId}/availability`, headersA, {
    days: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
    startTime: '08:00',
    endTime: '19:00',
    timezone: 'Asia/Kolkata'
  });
  assert(hostAAvailRes.status === 200, `Expected status 200, got ${hostAAvailRes.status}`);
  console.log('✓ Test 7 Passed: Host A successfully updated availability.');

  // 8. Host B cannot update availability
  console.log('TEST 8: Host B cannot update availability (HTTP 403)...');
  const hostBAvailRes = await handleApiRequest('PUT', `/api/listings/${listingId}/availability`, headersB, {
    days: ['Monday'],
    startTime: '10:00',
    endTime: '12:00'
  });
  assert(hostBAvailRes.status === 403, `Expected status 403, got ${hostBAvailRes.status}`);
  console.log('✓ Test 8 Passed: Host B blocked from updating availability with HTTP 403 Forbidden.');

  // 9. Booking belongs to Host A
  console.log('TEST 9: Booking belongs to Host A (derived from listing)...');
  const renter_token = createJwt('cognito-sub-renter-99', 'Renter Rohit', 'rohit@example.com', ['renters']);
  const headersRenter = { Authorization: `Bearer ${renter_token}` };

  const createBookingRes = await handleApiRequest('POST', '/api/bookings', headersRenter, {
    listingId,
    startAt: '2026-10-05T09:00:00+05:30',
    endAt: '2026-10-05T12:00:00+05:30',
    vehicle: { type: 'car', registrationNumber: 'DL01AB1234' }
  });
  assert(createBookingRes.status === 201, `Expected status 201, got ${createBookingRes.status}: ${JSON.stringify(createBookingRes.body)}`);
  const createdBooking = createBookingRes.body;
  bookingId = createdBooking.bookingId;
  assert(createdBooking.hostId === 'cognito-sub-host-A-100', `Booking hostId must equal Host A sub, got ${createdBooking.hostId}`);
  assert(createdBooking.session?.startedAt === null, 'session.startedAt should be initialized to null');
  assert(createdBooking.session?.completedAt === null, 'session.completedAt should be initialized to null');
  assert(createdBooking.access?.instructions, 'access.instructions should be populated from listing');
  console.log(`✓ Test 9 Passed: Booking ${bookingId} belongs to Host A with session & access initialized.`);

  // 10. Host B cannot view booking
  console.log('TEST 10: Host B cannot view booking (HTTP 403)...');
  const hostBViewBookingRes = await handleApiRequest('GET', `/api/host/bookings/${bookingId}`, headersB);
  assert(hostBViewBookingRes.status === 403, `Expected status 403, got ${hostBViewBookingRes.status}`);
  console.log('✓ Test 10 Passed: Host B cannot view Host A\'s booking (HTTP 403 Forbidden).');

  // 11. Host B cannot cancel booking
  console.log('TEST 11: Host B cannot cancel booking (HTTP 403)...');
  const hostBCancelRes = await handleApiRequest('POST', `/api/host/bookings/${bookingId}/cancel`, headersB, {});
  assert(hostBCancelRes.status === 403, `Expected status 403, got ${hostBCancelRes.status}`);
  console.log('✓ Test 11 Passed: Host B cannot cancel Host A\'s booking (HTTP 403 Forbidden).');

  // 12. Host B cannot start session
  console.log('TEST 12: Host B cannot start session (HTTP 403)...');
  const hostBStartRes = await handleApiRequest('POST', `/api/host/bookings/${bookingId}/start`, headersB, {});
  assert(hostBStartRes.status === 403, `Expected status 403, got ${hostBStartRes.status}`);
  console.log('✓ Test 12 Passed: Host B cannot start session on Host A\'s booking (HTTP 403 Forbidden).');

  // 13. Host B cannot complete session
  console.log('TEST 13: Host B cannot complete session (HTTP 403)...');
  const hostBCompleteRes = await handleApiRequest('POST', `/api/host/bookings/${bookingId}/complete`, headersB, {});
  assert(hostBCompleteRes.status === 403, `Expected status 403, got ${hostBCompleteRes.status}`);
  console.log('✓ Test 13 Passed: Host B cannot complete session on Host A\'s booking (HTTP 403 Forbidden).');

  // 14. Host A can start session
  console.log('TEST 14: Host A can start session (HTTP 200)...');
  const hostAStartRes = await handleApiRequest('POST', `/api/host/bookings/${bookingId}/start`, headersA, {});
  assert(hostAStartRes.status === 200, `Expected status 200, got ${hostAStartRes.status}`);
  const startedBooking = hostAStartRes.body;
  assert(startedBooking.status === 'confirmed', `Expected status confirmed, got ${startedBooking.status}`);
  assert(startedBooking.session?.startedAt, 'session.startedAt must be set');
  console.log(`✓ Test 14 Passed: Host A started session at ${startedBooking.session.startedAt}.`);

  // 15. Host A can complete session
  console.log('TEST 15: Host A can complete session (HTTP 200)...');
  const hostACompleteRes = await handleApiRequest('POST', `/api/host/bookings/${bookingId}/complete`, headersA, {});
  assert(hostACompleteRes.status === 200, `Expected status 200, got ${hostACompleteRes.status}`);
  const completedBooking = hostACompleteRes.body;
  assert(completedBooking.status === 'completed', `Expected status completed, got ${completedBooking.status}`);
  assert(completedBooking.session?.completedAt, 'session.completedAt must be set');
  console.log(`✓ Test 15 Passed: Host A completed session at ${completedBooking.session.completedAt}.`);

  // 16. Host cannot forge hostId
  console.log('TEST 16: Host cannot forge hostId in updates...');
  const hostAForgeryRes = await handleApiRequest('PUT', `/api/listings/${listingId}`, headersA, {
    hostId: 'evil-sub-attacker-999',
    pricing: { hourly: '95' }
  });
  assert(hostAForgeryRes.status === 200, `Expected status 200, got ${hostAForgeryRes.status}`);
  const postUpdateListing = hostAForgeryRes.body;
  assert(postUpdateListing.hostId === 'cognito-sub-host-A-100', 'hostId must remain Host A sub');
  console.log('✓ Test 16 Passed: Server ignored injected hostId; ownership remains immutable.');

  // 17. Host cannot forge reviewedBy or reviewedAt
  console.log('TEST 17: Host cannot forge reviewedBy or reviewedAt...');
  const hostAReviewForgeryRes = await handleApiRequest('PUT', `/api/listings/${listingId}`, headersA, {
    reviewedBy: 'fake-admin',
    reviewedAt: '2099-01-01T00:00:00.000Z'
  });
  assert(hostAReviewForgeryRes.status === 200, `Expected status 200, got ${hostAReviewForgeryRes.status}`);
  const reviewCheckListing = await dynamoDbService.getListingById(listingId);
  assert(reviewCheckListing.reviewedBy !== 'fake-admin', 'reviewedBy forgery rejected');
  assert(reviewCheckListing.reviewedAt !== '2099-01-01T00:00:00.000Z', 'reviewedAt forgery rejected');
  console.log('✓ Test 17 Passed: Client attempt to forge review metadata discarded.');

  // 18. Host cannot forge booking status
  console.log('TEST 18: Host cannot directly mutate booking status via generic request...');
  const statusTamperRes = await handleApiRequest('PUT', `/api/host/bookings/${bookingId}`, headersA, {
    status: 'confirmed'
  });
  assert(statusTamperRes.status === 404 || statusTamperRes.status === 400, `Expected 404 or 400, got ${statusTamperRes.status}`);
  const bookingStillCompleted = await dynamoDbService.getBookingById(bookingId);
  assert(bookingStillCompleted.status === 'completed', 'Booking status must remain completed');
  console.log('✓ Test 18 Passed: Direct booking status mutation is strictly disallowed.');

  // 19. Unauthenticated requests return 401
  console.log('TEST 19: Unauthenticated requests return 401 Unauthorized...');
  const unauthRes1 = await handleApiRequest('GET', '/api/listings', {});
  assert(unauthRes1.status === 401, `Expected 401, got ${unauthRes1.status}`);

  const unauthRes2 = await handleApiRequest('POST', `/api/host/bookings/${bookingId}/start`, {}, {});
  assert(unauthRes2.status === 401, `Expected 401, got ${unauthRes2.status}`);
  console.log('✓ Test 19 Passed: Unauthenticated requests uniformly rejected with HTTP 401.');

  // 20. Admin-only endpoints remain protected
  console.log('TEST 20: Admin-only endpoints remain protected from normal hosts...');
  const hostAAdminQueueRes = await handleApiRequest('GET', '/api/admin/listings', headersA);
  assert(hostAAdminQueueRes.status === 403, `Expected 403, got ${hostAAdminQueueRes.status}`);

  const hostAAdminRejectRes = await handleApiRequest('POST', `/api/admin/listings/${listingId}/reject`, headersA, {
    rejectionReason: 'Host attacking admin endpoint'
  });
  assert(hostAAdminRejectRes.status === 403, `Expected 403, got ${hostAAdminRejectRes.status}`);
  console.log('✓ Test 20 Passed: Normal hosts strictly blocked from admin review endpoints with HTTP 403.');

  console.log('\n====================================================');
  console.log('ALL 20 END-TO-END HOST SECURITY TESTS PASSED WITH 100% SUCCESS!');
  console.log('====================================================');
}

runEndToEndSecurityAudit().catch((err) => {
  console.error('\n❌ AUDIT FAILED:', err);
  process.exit(1);
});
