/**
 * ParkSync - Step 7 Host Availability Management Test Suite
 * 
 * Verifies all 19 requirements of Step 7:
 * TEST 1: Valid availability update succeeds (HTTP 200)
 * TEST 2: Availability persists in DynamoDB
 * TEST 3: Empty days array rejected (HTTP 400)
 * TEST 4: Invalid weekday rejected (HTTP 400)
 * TEST 5: Duplicate day rejected (HTTP 400)
 * TEST 6: Invalid start time format rejected (HTTP 400)
 * TEST 7: Invalid end time format rejected (HTTP 400)
 * TEST 8: End time earlier than or equal to start time rejected (HTTP 400)
 * TEST 9: Host A can update own listing availability (HTTP 200)
 * TEST 10: Host B cannot update Host A listing availability (HTTP 403)
 * TEST 11: Host A can pause own listing availability (HTTP 200)
 * TEST 12: Host B cannot pause Host A listing availability (HTTP 403)
 * TEST 13: Host A can resume own listing availability (HTTP 200)
 * TEST 14: Host B cannot resume Host A listing availability (HTTP 403)
 * TEST 15: Unauthenticated request receives HTTP 401
 * TEST 16: Pause does not alter listing.status (remains approved, not suspended)
 * TEST 17: Resume does not alter listing.status
 * TEST 18: Availability changes on approved listing do not trigger reversion to pending_review
 * TEST 19: Timezone persists as 'Asia/Kolkata'
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

async function runAvailabilityTests() {
  console.log('====================================================');
  console.log('PARKSYNC STEP 7 - HOST AVAILABILITY TEST SUITE');
  console.log('====================================================\n');

  const hostA_Sub = 'cognito-sub-host-alice-77';
  const hostB_Sub = 'cognito-sub-host-bob-88';
  const admin_Sub = 'cognito-sub-admin-eve-99';

  const tokenA = createJwt(hostA_Sub, 'Alice Host', 'alice77@example.com', ['hosts']);
  const tokenB = createJwt(hostB_Sub, 'Bob Host', 'bob88@example.com', ['hosts']);
  const tokenAdmin = createJwt(admin_Sub, 'Admin Eve', 'admin@parksync.local', ['admin']);

  const headersA = { Authorization: `Bearer ${tokenA}` };
  const headersB = { Authorization: `Bearer ${tokenB}` };
  const headersAdmin = { Authorization: `Bearer ${tokenAdmin}` };

  // Setup: Host A creates listing
  const createRes = await handleApiRequest('POST', '/api/listings', headersA, {
    location: { locality: 'Whitefield', city: 'Bengaluru', address: '100 ITPL Road' },
    pricing: { hourly: '50', daily: '350' },
    parkingDetails: { vehicleType: 'Car', parkingType: 'Covered', capacity: 1 }
  });
  if (createRes.status !== 201) throw new Error('Setup failed: could not create listing for Host A');
  const listingA = createRes.body;

  // Approve listingA via admin so we can test that availability edits preserve approved status
  const approveRes = await handleApiRequest('POST', `/api/admin/listings/${listingA.listingId}/approve`, headersAdmin, {});
  if (approveRes.status !== 200) throw new Error('Setup failed: could not approve listing for Host A');

  // ----------------------------------------------------
  // TEST 1 & 2: Valid availability update succeeds & persists
  // ----------------------------------------------------
  console.log('TEST 1 & 2: Valid availability update succeeds and persists...');
  const validPayload = {
    days: ['Monday', 'Wednesday', 'Friday'],
    startTime: '07:30',
    endTime: '19:45',
    timezone: 'Asia/Kolkata'
  };

  const res1 = await handleApiRequest('PUT', `/api/listings/${listingA.listingId}/availability`, headersA, validPayload);
  if (res1.status !== 200) {
    throw new Error(`Test 1 Failed: Expected 200 OK, got ${res1.status}`);
  }
  const updatedAvail = res1.body;
  if (updatedAvail.startTime !== '07:30' || updatedAvail.endTime !== '19:45') {
    throw new Error(`Test 1 Failed: Times were not updated correctly.`);
  }

  // Verify persistence via GET /api/listings/:id
  const getRes = await handleApiRequest('GET', `/api/listings/${listingA.listingId}`, headersA, {});
  if (getRes.status !== 200) throw new Error(`Test 2 Failed: Could not fetch listing.`);
  const fetchedAvail = getRes.body.availability;
  if (!fetchedAvail || fetchedAvail.days.length !== 3 || fetchedAvail.startTime !== '07:30') {
    throw new Error(`Test 2 Failed: Availability did not persist in DynamoDB store.`);
  }
  console.log('✓ Passed: Valid availability update succeeded and persisted in database.\n');

  // ----------------------------------------------------
  // TEST 3: Empty days array rejected (HTTP 400)
  // ----------------------------------------------------
  console.log('TEST 3: Empty days array rejected...');
  const res3 = await handleApiRequest('PUT', `/api/listings/${listingA.listingId}/availability`, headersA, {
    days: [],
    startTime: '08:00',
    endTime: '20:00'
  });
  if (res3.status !== 400) {
    throw new Error(`Test 3 Failed: Expected 400 Bad Request, got ${res3.status}`);
  }
  console.log('✓ Passed: Empty days array rejected with HTTP 400 Bad Request.\n');

  // ----------------------------------------------------
  // TEST 4: Invalid weekday rejected (HTTP 400)
  // ----------------------------------------------------
  console.log('TEST 4: Invalid weekday rejected...');
  const res4 = await handleApiRequest('PUT', `/api/listings/${listingA.listingId}/availability`, headersA, {
    days: ['Funday'],
    startTime: '08:00',
    endTime: '20:00'
  });
  if (res4.status !== 400) {
    throw new Error(`Test 4 Failed: Expected 400 Bad Request for 'Funday', got ${res4.status}`);
  }
  console.log('✓ Passed: Invalid weekday rejected with HTTP 400 Bad Request.\n');

  // ----------------------------------------------------
  // TEST 5: Duplicate day rejected (HTTP 400)
  // ----------------------------------------------------
  console.log('TEST 5: Duplicate day rejected...');
  const res5 = await handleApiRequest('PUT', `/api/listings/${listingA.listingId}/availability`, headersA, {
    days: ['Monday', 'Monday'],
    startTime: '08:00',
    endTime: '20:00'
  });
  if (res5.status !== 400) {
    throw new Error(`Test 5 Failed: Expected 400 Bad Request for duplicate days, got ${res5.status}`);
  }
  console.log('✓ Passed: Duplicate days rejected with HTTP 400 Bad Request.\n');

  // ----------------------------------------------------
  // TEST 6: Invalid start time format rejected (HTTP 400)
  // ----------------------------------------------------
  console.log('TEST 6: Invalid start time format rejected...');
  const res6a = await handleApiRequest('PUT', `/api/listings/${listingA.listingId}/availability`, headersA, {
    days: ['Monday'],
    startTime: '25:00',
    endTime: '20:00'
  });
  const res6b = await handleApiRequest('PUT', `/api/listings/${listingA.listingId}/availability`, headersA, {
    days: ['Monday'],
    startTime: '8:00',
    endTime: '20:00'
  });
  if (res6a.status !== 400 || res6b.status !== 400) {
    throw new Error(`Test 6 Failed: Malformed start times should return 400, got ${res6a.status}, ${res6b.status}`);
  }
  console.log('✓ Passed: Invalid startTime formats (25:00, 8:00) rejected with HTTP 400.\n');

  // ----------------------------------------------------
  // TEST 7: Invalid end time format rejected (HTTP 400)
  // ----------------------------------------------------
  console.log('TEST 7: Invalid end time format rejected...');
  const res7 = await handleApiRequest('PUT', `/api/listings/${listingA.listingId}/availability`, headersA, {
    days: ['Monday'],
    startTime: '08:00',
    endTime: '10:75'
  });
  if (res7.status !== 400) {
    throw new Error(`Test 7 Failed: Expected 400 Bad Request for 10:75, got ${res7.status}`);
  }
  console.log('✓ Passed: Invalid endTime format (10:75) rejected with HTTP 400.\n');

  // ----------------------------------------------------
  // TEST 8: End time earlier than or equal to start time rejected (HTTP 400)
  // ----------------------------------------------------
  console.log('TEST 8: End time before or equal to start time rejected...');
  const res8a = await handleApiRequest('PUT', `/api/listings/${listingA.listingId}/availability`, headersA, {
    days: ['Monday'],
    startTime: '20:00',
    endTime: '08:00'
  });
  const res8b = await handleApiRequest('PUT', `/api/listings/${listingA.listingId}/availability`, headersA, {
    days: ['Monday'],
    startTime: '08:00',
    endTime: '08:00'
  });
  if (res8a.status !== 400 || res8b.status !== 400) {
    throw new Error(`Test 8 Failed: Expected 400 when endTime <= startTime, got ${res8a.status}, ${res8b.status}`);
  }
  console.log('✓ Passed: Overnight/reversed times (20:00 -> 08:00) and zero-duration rejected with HTTP 400.\n');

  // ----------------------------------------------------
  // TEST 9 & 10: Host A can update own listing, Host B cannot update Host A listing (HTTP 403)
  // ----------------------------------------------------
  console.log('TEST 9 & 10: Host ownership boundary on availability updates...');
  const res9 = await handleApiRequest('PUT', `/api/listings/${listingA.listingId}/availability`, headersA, {
    days: ['Tuesday', 'Thursday'],
    startTime: '09:00',
    endTime: '18:00'
  });
  if (res9.status !== 200) {
    throw new Error(`Test 9 Failed: Host A could not update own availability, got ${res9.status}`);
  }

  const res10 = await handleApiRequest('PUT', `/api/listings/${listingA.listingId}/availability`, headersB, {
    days: ['Tuesday', 'Thursday'],
    startTime: '09:00',
    endTime: '18:00'
  });
  if (res10.status !== 403) {
    throw new Error(`Test 10 Failed: Expected 403 Forbidden for Host B, got ${res10.status}`);
  }
  console.log('✓ Passed: Host A permitted (HTTP 200); Host B rejected with HTTP 403 Forbidden by Cedar.\n');

  // ----------------------------------------------------
  // TEST 11, 12 & 16: Host A can pause, Host B cannot pause, status remains unchanged
  // ----------------------------------------------------
  console.log('TEST 11, 12 & 16: Pausing availability and verifying status preservation...');
  // Host B attempts pause
  const res12 = await handleApiRequest('POST', `/api/listings/${listingA.listingId}/availability/pause`, headersB, {});
  if (res12.status !== 403) {
    throw new Error(`Test 12 Failed: Host B was able to pause Host A listing!`);
  }

  // Host A pauses
  const res11 = await handleApiRequest('POST', `/api/listings/${listingA.listingId}/availability/pause`, headersA, {});
  if (res11.status !== 200) {
    throw new Error(`Test 11 Failed: Host A pause failed with ${res11.status}`);
  }

  // Verify temporarilyUnavailable === true AND status remains 'approved'
  const verifyPause = await handleApiRequest('GET', `/api/listings/${listingA.listingId}`, headersA, {});
  if (verifyPause.body.availability?.temporarilyUnavailable !== true) {
    throw new Error(`Test 16 Failed: temporarilyUnavailable was not set to true.`);
  }
  if (verifyPause.body.status !== 'approved') {
    throw new Error(`Test 16 Failed: Pause unexpectedly changed listing status to '${verifyPause.body.status}' (must remain 'approved')!`);
  }
  console.log(`✓ Passed: Host A paused availability; temporarilyUnavailable = true, listing.status remained '${verifyPause.body.status}'.\n`);

  // ----------------------------------------------------
  // TEST 13, 14 & 17: Host A can resume, Host B cannot resume, status remains unchanged
  // ----------------------------------------------------
  console.log('TEST 13, 14 & 17: Resuming availability and verifying status preservation...');
  // Host B attempts resume
  const res14 = await handleApiRequest('POST', `/api/listings/${listingA.listingId}/availability/resume`, headersB, {});
  if (res14.status !== 403) {
    throw new Error(`Test 14 Failed: Host B was able to resume Host A listing!`);
  }

  // Host A resumes
  const res13 = await handleApiRequest('POST', `/api/listings/${listingA.listingId}/availability/resume`, headersA, {});
  if (res13.status !== 200) {
    throw new Error(`Test 13 Failed: Host A resume failed with ${res13.status}`);
  }

  // Verify temporarilyUnavailable === false AND status remains 'approved'
  const verifyResume = await handleApiRequest('GET', `/api/listings/${listingA.listingId}`, headersA, {});
  if (verifyResume.body.availability?.temporarilyUnavailable !== false) {
    throw new Error(`Test 17 Failed: temporarilyUnavailable was not set to false.`);
  }
  if (verifyResume.body.status !== 'approved') {
    throw new Error(`Test 17 Failed: Resume unexpectedly changed listing status to '${verifyResume.body.status}'!`);
  }
  console.log(`✓ Passed: Host A resumed availability; temporarilyUnavailable = false, listing.status remained '${verifyResume.body.status}'.\n`);

  // ----------------------------------------------------
  // TEST 15: Unauthenticated requests receive HTTP 401
  // ----------------------------------------------------
  console.log('TEST 15: Unauthenticated requests receive HTTP 401...');
  const res15a = await handleApiRequest('PUT', `/api/listings/${listingA.listingId}/availability`, {}, validPayload);
  const res15b = await handleApiRequest('POST', `/api/listings/${listingA.listingId}/availability/pause`, {}, {});
  const res15c = await handleApiRequest('POST', `/api/listings/${listingA.listingId}/availability/resume`, {}, {});
  if (res15a.status !== 401 || res15b.status !== 401 || res15c.status !== 401) {
    throw new Error(`Test 15 Failed: Expected 401 Unauthorized for unauthenticated calls, got ${res15a.status}`);
  }
  console.log('✓ Passed: Unauthenticated availability requests rejected with HTTP 401 Unauthorized.\n');

  // ----------------------------------------------------
  // TEST 18: Availability updates on approved listing do not trigger reversion to pending_review
  // ----------------------------------------------------
  console.log('TEST 18: Availability updates on approved listing preserve approved status...');
  const res18 = await handleApiRequest('PUT', `/api/listings/${listingA.listingId}/availability`, headersA, {
    days: ['Saturday', 'Sunday'],
    startTime: '10:00',
    endTime: '18:00'
  });
  if (res18.status !== 200) throw new Error(`Test 18 Failed: Update failed with ${res18.status}`);

  const verifyStatus = await handleApiRequest('GET', `/api/listings/${listingA.listingId}`, headersA, {});
  if (verifyStatus.body.status !== 'approved') {
    throw new Error(`Test 18 Failed: Operational availability update unexpectedly reverted status to '${verifyStatus.body.status}'!`);
  }
  console.log(`✓ Passed: Schedule modified; listing status strictly preserved as '${verifyStatus.body.status}'.\n`);

  // ----------------------------------------------------
  // TEST 19: Timezone persists as 'Asia/Kolkata'
  // ----------------------------------------------------
  console.log('TEST 19: Timezone persists as Asia/Kolkata...');
  if (verifyStatus.body.availability?.timezone !== 'Asia/Kolkata') {
    throw new Error(`Test 19 Failed: Expected timezone 'Asia/Kolkata', got '${verifyStatus.body.availability?.timezone}'`);
  }
  console.log(`✓ Passed: Timezone confirmed persisted as '${verifyStatus.body.availability.timezone}'.\n`);

  console.log('====================================================');
  console.log('ALL 19 STEP 7 AVAILABILITY SCENARIOS PASSED WITH 100% SUCCESS!');
  console.log('====================================================\n');
}

runAvailabilityTests().catch((err) => {
  console.error('\n❌ Availability Test Failed:', err);
  process.exit(1);
});
