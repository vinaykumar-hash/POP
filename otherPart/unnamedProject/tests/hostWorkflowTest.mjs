/**
 * ParkSync - Step 10 Host Complete Lifecycle Workflow Audit
 * 
 * Verifies all 20 lifecycle steps specified in Section 31:
 *  1. Host signup
 *  2. Host authentication
 *  3. Listing creation
 *  4. Listing starts pending_review
 *  5. Admin sees pending listing
 *  6. Admin approves
 *  7. Listing becomes approved
 *  8. Host configures availability
 *  9. Availability persists
 * 10. Host pauses availability
 * 11. Host resumes availability
 * 12. Booking associated with listing
 * 13. Booking confirmed
 * 14. Host sees booking
 * 15. Host starts session
 * 16. Session timestamp persists
 * 17. Host completes session
 * 18. Booking becomes completed
 * 19. Historical pricing remains unchanged
 * 20. Historical booking remains stored
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

async function runHostWorkflowAudit() {
  console.log('====================================================');
  console.log('PARKSYNC STEP 10 - HOST COMPLETE LIFECYCLE WORKFLOW AUDIT');
  console.log('====================================================\n');

  const hostSub = 'cognito-sub-workflow-host-777';
  const hostToken = createJwt(hostSub, 'Vikram Malhotra', 'vikram.host@parksync.in', ['hosts']);
  const adminToken = createJwt('cognito-sub-admin-555', 'Admin Verification', 'admin@parksync.in', ['admin']);
  const renterToken = createJwt('cognito-sub-renter-444', 'Ananya Sharma', 'ananya.renter@example.com', ['renters']);

  const headersHost = { Authorization: `Bearer ${hostToken}` };
  const headersAdmin = { Authorization: `Bearer ${adminToken}` };
  const headersRenter = { Authorization: `Bearer ${renterToken}` };

  let listingId = null;
  let bookingId = null;

  // 1. Host signup
  console.log('STEP 1: Host signup (create host profile)...');
  const signupRes = await handleApiRequest('POST', '/api/hosts', headersHost, {
    fullName: 'Vikram Malhotra',
    phoneNumber: '+919876543210',
    idDocumentType: 'aadhar',
    address: 'Flat 402, Lotus Towers, Indiranagar, Bengaluru'
  });
  assert(signupRes.status === 200, `Expected 200, got ${signupRes.status}`);
  const hostProfile = signupRes.body;
  assert(hostProfile.hostId === hostSub, 'Host ID must be assigned from authenticated token sub');
  console.log(`✓ Step 1 Passed: Host signed up with hostId ${hostProfile.hostId}.`);

  // 2. Host authentication
  console.log('STEP 2: Host authentication...');
  const authCheckRes = await handleApiRequest('GET', '/api/listings', headersHost);
  assert(authCheckRes.status === 200, `Expected 200, got ${authCheckRes.status}`);
  console.log('✓ Step 2 Passed: Authenticated JWT claims successfully validated by API Gateway.');

  // 3. Listing creation
  console.log('STEP 3: Listing creation...');
  const createListingRes = await handleApiRequest('POST', '/api/listings', headersHost, {
    location: {
      address: 'Plot 45, 100 Feet Road',
      locality: 'Indiranagar',
      city: 'Bengaluru',
      state: 'Karnataka',
      pincode: '560038'
    },
    parkingDetails: {
      parkingType: 'covered',
      vehicleType: 'car',
      capacity: 1,
      features: ['cctv', 'gated', 'security_guard'],
      instructions: 'Enter gate 2, drive down ramp B, park in bay 14.'
    },
    pricing: {
      hourly: '70',
      daily: '500',
      currency: 'INR'
    }
  });
  assert(createListingRes.status === 201, `Expected 201, got ${createListingRes.status}`);
  const listing = createListingRes.body;
  listingId = listing.listingId;
  assert(listingId, 'listingId must exist');
  console.log(`✓ Step 3 Passed: Listing created with ID ${listingId}.`);

  // 4. Listing starts pending_review
  console.log('STEP 4: Listing starts pending_review...');
  assert(listing.status === 'pending_review', `Expected status pending_review, got ${listing.status}`);
  console.log('✓ Step 4 Passed: Listing initial lifecycle state is "pending_review".');

  // 5. Admin sees pending listing
  console.log('STEP 5: Admin sees pending listing in queue...');
  const pendingQueueRes = await handleApiRequest('GET', '/api/admin/listings', headersAdmin);
  assert(pendingQueueRes.status === 200, `Expected 200, got ${pendingQueueRes.status}`);
  const pendingQueue = pendingQueueRes.body;
  const isFound = pendingQueue.some((l) => l.listingId === listingId);
  assert(isFound, 'Listing must appear in admin pending queue');
  console.log('✓ Step 5 Passed: Listing visible in administrative review queue.');

  // 6. Admin approves
  console.log('STEP 6: Admin approves listing...');
  const approveRes = await handleApiRequest('POST', `/api/admin/listings/${listingId}/approve`, headersAdmin, {});
  assert(approveRes.status === 200, `Expected 200, got ${approveRes.status}`);
  console.log('✓ Step 6 Passed: Admin approval action executed.');

  // 7. Listing becomes approved
  console.log('STEP 7: Listing becomes approved with verification metadata...');
  const approvedListing = approveRes.body;
  assert(approvedListing.status === 'approved', `Expected status approved, got ${approvedListing.status}`);
  assert(approvedListing.reviewedBy === 'cognito-sub-admin-555', 'reviewedBy should record admin sub');
  assert(approvedListing.reviewedAt, 'reviewedAt timestamp must be recorded');
  console.log(`✓ Step 7 Passed: Listing status is "approved" (Reviewed by: ${approvedListing.reviewedBy}).`);

  // 8. Host configures availability
  console.log('STEP 8: Host configures availability...');
  const configAvailRes = await handleApiRequest('PUT', `/api/listings/${listingId}/availability`, headersHost, {
    days: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
    startTime: '08:00',
    endTime: '20:00',
    timezone: 'Asia/Kolkata',
    temporarilyUnavailable: false
  });
  assert(configAvailRes.status === 200, `Expected 200, got ${configAvailRes.status}`);
  console.log('✓ Step 8 Passed: Host configured 5-day operating schedule.');

  // 9. Availability persists
  console.log('STEP 9: Availability schedule persists in database...');
  const reloadedListingRes = await handleApiRequest('GET', `/api/listings/${listingId}`, headersHost);
  assert(reloadedListingRes.status === 200, `Expected 200, got ${reloadedListingRes.status}`);
  const avail = reloadedListingRes.body.availability;
  assert(avail.days.length === 5, '5 operating days expected');
  assert(avail.startTime === '08:00', 'startTime should be 08:00');
  assert(avail.endTime === '20:00', 'endTime should be 20:00');
  assert(avail.timezone === 'Asia/Kolkata', 'timezone should be Asia/Kolkata');
  console.log('✓ Step 9 Passed: Schedule persisted accurately with Asia/Kolkata timezone.');

  // 10. Host pauses availability
  console.log('STEP 10: Host pauses availability (temporarilyUnavailable = true)...');
  const pauseRes = await handleApiRequest('POST', `/api/listings/${listingId}/availability/pause`, headersHost, {});
  assert(pauseRes.status === 200, `Expected 200, got ${pauseRes.status}`);
  assert(pauseRes.body.availability?.temporarilyUnavailable === true, 'temporarilyUnavailable should be true');
  assert(pauseRes.body.status === 'approved', 'Listing status must stay approved when paused');
  console.log('✓ Step 10 Passed: Space paused; status preserved as "approved".');

  // 11. Host resumes availability
  console.log('STEP 11: Host resumes availability (temporarilyUnavailable = false)...');
  const resumeRes = await handleApiRequest('POST', `/api/listings/${listingId}/availability/resume`, headersHost, {});
  assert(resumeRes.status === 200, `Expected 200, got ${resumeRes.status}`);
  assert(resumeRes.body.availability?.temporarilyUnavailable === false, 'temporarilyUnavailable should be false');
  assert(resumeRes.body.status === 'approved', 'Listing status preserved as approved');
  console.log('✓ Step 11 Passed: Space resumed for active bookings.');

  // 12. Booking associated with listing
  console.log('STEP 12: Booking associated with listing & host...');
  // A test Monday: 2026-10-12
  const bookingCreateRes = await handleApiRequest('POST', '/api/bookings', headersRenter, {
    listingId,
    startAt: '2026-10-12T10:00:00+05:30',
    endAt: '2026-10-12T14:00:00+05:30',
    vehicle: { type: 'car', registrationNumber: 'KA03HA5555' }
  });
  assert(bookingCreateRes.status === 201, `Expected 201, got ${bookingCreateRes.status}`);
  const createdBooking = bookingCreateRes.body;
  bookingId = createdBooking.bookingId;
  assert(createdBooking.listingId === listingId, 'listingId must match');
  assert(createdBooking.hostId === hostSub, 'hostId must match listing owner');
  console.log(`✓ Step 12 Passed: Booking ${bookingId} bound to listing and host.`);

  // 13. Booking confirmed
  console.log('STEP 13: Booking confirmed...');
  assert(createdBooking.status === 'confirmed', `Expected status confirmed, got ${createdBooking.status}`);
  console.log('✓ Step 13 Passed: Booking confirmed.');

  // 14. Host sees booking
  console.log('STEP 14: Host sees booking in host dashboard list...');
  const hostBookingsRes = await handleApiRequest('GET', '/api/host/bookings', headersHost);
  assert(hostBookingsRes.status === 200, `Expected 200, got ${hostBookingsRes.status}`);
  const hostBookings = hostBookingsRes.body;
  const foundBooking = hostBookings.find((b) => b.bookingId === bookingId);
  assert(foundBooking, 'Booking must be in host list');
  console.log('✓ Step 14 Passed: Host successfully retrieved booking from dashboard API.');

  // 15. Host starts session
  console.log('STEP 15: Host starts parking session...');
  const startSessionRes = await handleApiRequest('POST', `/api/host/bookings/${bookingId}/start`, headersHost, {});
  assert(startSessionRes.status === 200, `Expected 200, got ${startSessionRes.status}`);
  console.log('✓ Step 15 Passed: Session started.');

  // 16. Session timestamp persists
  console.log('STEP 16: Session start timestamp persists...');
  const sessionStartedBooking = startSessionRes.body;
  assert(sessionStartedBooking.session?.startedAt, 'startedAt timestamp must be populated');
  assert(!sessionStartedBooking.session?.completedAt, 'completedAt must be null during active session');
  console.log(`✓ Step 16 Passed: Session startedAt recorded at ${sessionStartedBooking.session.startedAt}.`);

  // 17. Host completes session
  console.log('STEP 17: Host completes parking session...');
  const completeSessionRes = await handleApiRequest('POST', `/api/host/bookings/${bookingId}/complete`, headersHost, {});
  assert(completeSessionRes.status === 200, `Expected 200, got ${completeSessionRes.status}`);
  console.log('✓ Step 17 Passed: Session complete action succeeded.');

  // 18. Booking becomes completed
  console.log('STEP 18: Booking becomes completed...');
  const completedBooking = completeSessionRes.body;
  assert(completedBooking.status === 'completed', `Expected status completed, got ${completedBooking.status}`);
  assert(completedBooking.session?.completedAt, 'session.completedAt must be recorded');
  assert(completedBooking.completedAt, 'completedAt lifecycle timestamp must be recorded');
  console.log(`✓ Step 18 Passed: Booking lifecycle transitioned to "completed".`);

  // 19. Historical pricing remains unchanged
  console.log('STEP 19: Historical pricing remains unchanged when listing price is updated...');
  const originalBookingRate = completedBooking.pricing.hourlyRate;
  const originalBookingTotal = completedBooking.pricing.totalAmount;

  // Host updates listing hourly price from 70 to 120
  await handleApiRequest('PUT', `/api/listings/${listingId}`, headersHost, {
    pricing: { hourly: '120', daily: '900' }
  });

  const refreshedBooking = await dynamoDbService.getBookingById(bookingId);
  assert(refreshedBooking.pricing.hourlyRate === originalBookingRate, `Rate changed: ${refreshedBooking.pricing.hourlyRate} vs ${originalBookingRate}`);
  assert(refreshedBooking.pricing.totalAmount === originalBookingTotal, `Total changed: ${refreshedBooking.pricing.totalAmount} vs ${originalBookingTotal}`);
  console.log(`✓ Step 19 Passed: Booking preserved historical snapshot (₹${originalBookingRate}/hr, Total: ₹${originalBookingTotal}) despite listing rate increased to ₹120/hr.`);

  // 20. Historical booking remains stored
  console.log('STEP 20: Historical booking remains stored in database...');
  const hostHistoryRes = await handleApiRequest('GET', '/api/host/bookings?status=completed', headersHost);
  assert(hostHistoryRes.status === 200, `Expected 200, got ${hostHistoryRes.status}`);
  const completedHistory = hostHistoryRes.body;
  const historyFound = completedHistory.some((b) => b.bookingId === bookingId);
  assert(historyFound, 'Historical completed booking must persist in host records');
  console.log('✓ Step 20 Passed: Completed historical booking permanently preserved in host audit trail.');

  console.log('\n====================================================');
  console.log('ALL 20 HOST LIFECYCLE WORKFLOW STEPS PASSED WITH 100% SUCCESS!');
  console.log('====================================================');
}

runHostWorkflowAudit().catch((err) => {
  console.error('\n❌ WORKFLOW AUDIT FAILED:', err);
  process.exit(1);
});
