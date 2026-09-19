/**
 * ParkSync - Central API Router & Lambda Gateway
 */

import { verifyAuthToken } from './middleware/authMiddleware.js';
import { listingsHandler } from './handlers/listingsHandler.js';
import { bookingsHandler } from './handlers/bookingsHandler.js';
import { dynamoDbService } from './dynamoDbService.js';
import { s3StorageService } from './s3StorageService.js';
import { cedarAuthorizer } from './authorization/cedar/cedarAuthorizer.js';

export async function handleApiRequest(method, rawPath, headers, body) {
  try {
    // 1. Parse pathname and query parameters
    let path = rawPath;
    const query = {};
    if (rawPath && rawPath.includes('?')) {
      const [p, q] = rawPath.split('?');
      path = p;
      const searchParams = new URLSearchParams(q);
      for (const [key, value] of searchParams.entries()) {
        query[key] = value;
      }
    }

    // 2. Authenticate incoming request via Cognito JWT verification
    const authHeader = headers['authorization'] || headers['Authorization'];
    const authenticatedUser = verifyAuthToken(authHeader);

    // 3. Route endpoints
    // --- GET /api/hosts/me (Retrieve authenticated host profile) ---
    if (method === 'GET' && path === '/api/hosts/me') {
      let host = await dynamoDbService.getHostById(authenticatedUser.sub);
      if (!host) {
        host = await dynamoDbService.putHost({
          hostId: authenticatedUser.sub,
          name: authenticatedUser.name || '',
          email: authenticatedUser.email || '',
          phone: authenticatedUser.phone || '',
          verification: { status: authenticatedUser.verificationStatus || 'not_submitted' }
        });
      }
      return { status: 200, body: host };
    }

    // --- GET /api/hosts/:id (Retrieve host profile with Cedar authorization) ---
    const matchGetHost = path.match(/^\/api\/hosts\/([^/]+)$/);
    if (matchGetHost && method === 'GET' && matchGetHost[1] !== 'me') {
      const targetHostId = matchGetHost[1];
      const authz = await cedarAuthorizer.isAuthorized({
        principal: authenticatedUser,
        action: 'viewHost',
        resource: { owner: targetHostId, type: 'host' }
      });
      if (authz.decision !== 'ALLOW') {
        const err = new Error('Forbidden: Cannot view profile belonging to another host.');
        err.statusCode = 403;
        err.diagnostics = authz.diagnostics;
        throw err;
      }
      const host = await dynamoDbService.getHostById(targetHostId);
      if (!host) {
        return { status: 404, body: { error: 'Host not found' } };
      }
      return { status: 200, body: host };
    }

    // --- POST /api/admin/hosts/:id/verify (Admin verifies host account) ---
    const matchVerifyHost = path.match(/^\/api\/admin\/hosts\/([^/]+)\/verify$/);
    if (matchVerifyHost && method === 'POST') {
      const targetHostId = matchVerifyHost[1];
      const authz = await cedarAuthorizer.isAuthorized({
        principal: authenticatedUser,
        action: 'verifyHost',
        resource: { owner: targetHostId, type: 'host' }
      });
      if (authz.decision !== 'ALLOW') {
        const err = new Error('Forbidden: Only administrators can verify host accounts.');
        err.statusCode = 403;
        err.diagnostics = authz.diagnostics;
        throw err;
      }
      const now = new Date().toISOString();
      const updatedHost = await dynamoDbService.putHost({
        hostId: targetHostId,
        verification: {
          status: 'verified',
          verifiedAt: now,
          verifiedBy: authenticatedUser.sub
        }
      });
      return { status: 200, body: updatedHost };
    }

    // --- POST /api/hosts (Create/update host profile) ---
    if (method === 'POST' && path === '/api/hosts') {
      const hostData = {
        ...body,
        hostId: authenticatedUser.sub // Enforce authenticated identity
      };
      const host = await dynamoDbService.putHost(hostData);
      return { status: 200, body: host };
    }

    // --- POST /api/uploads/presign (Generate secure presigned S3 upload URL) ---
    if (method === 'POST' && path === '/api/uploads/presign') {
      const presigned = await s3StorageService.createPresignedUploadUrl({
        hostId: authenticatedUser.sub,
        listingId: body.listingId,
        fileName: body.fileName || 'upload.bin',
        fileType: body.fileType || 'application/octet-stream',
        context: body.context || 'photo'
      });
      return { status: 200, body: presigned };
    }

    // ========================================================================
    // ADMINISTRATIVE VERIFICATION ENDPOINTS (Cedar Protected)
    // ========================================================================

    // --- GET /api/admin/listings (List listings pending review) ---
    if (method === 'GET' && path === '/api/admin/listings') {
      const result = await listingsHandler.getPendingListings(query, authenticatedUser);
      return { status: result.statusCode, body: result.body };
    }

    // --- POST /api/admin/listings/:id/approve (Approve listing) ---
    const matchApprove = path.match(/^\/api\/admin\/listings\/([^/]+)\/approve$/);
    if (matchApprove && method === 'POST') {
      const listingId = matchApprove[1];
      const result = await listingsHandler.approveListing(listingId, authenticatedUser);
      return { status: result.statusCode, body: result.body };
    }

    // --- POST /api/admin/listings/:id/reject (Reject listing) ---
    const matchReject = path.match(/^\/api\/admin\/listings\/([^/]+)\/reject$/);
    if (matchReject && method === 'POST') {
      const listingId = matchReject[1];
      const result = await listingsHandler.rejectListing(listingId, body, authenticatedUser);
      return { status: result.statusCode, body: result.body };
    }

    // ========================================================================
    // HOST LISTING CRUD & RESUBMIT ENDPOINTS
    // ========================================================================

    // --- POST /api/listings (Create listing) ---
    if (method === 'POST' && path === '/api/listings') {
      const result = await listingsHandler.createListing(body, authenticatedUser);
      return { status: result.statusCode, body: result.body };
    }

    // --- GET /api/listings (Get host's own listings) ---
    if (method === 'GET' && path === '/api/listings') {
      const result = await listingsHandler.getHostListings(authenticatedUser);
      return { status: result.statusCode, body: result.body };
    }

    // --- POST /api/listings/:id/resubmit (Host resubmit rejected listing) ---
    const matchResubmit = path.match(/^\/api\/listings\/([^/]+)\/resubmit$/);
    if (matchResubmit && method === 'POST') {
      const listingId = matchResubmit[1];
      const result = await listingsHandler.resubmitListing(listingId, authenticatedUser);
      return { status: result.statusCode, body: result.body };
    }

    // --- Availability endpoints ---
    // PUT /api/listings/:id/availability
    const matchAvail = path.match(/^\/api\/listings\/([^/]+)\/availability$/);
    if (matchAvail && method === 'PUT') {
      const listingId = matchAvail[1];
      const result = await listingsHandler.updateAvailability(listingId, body, authenticatedUser);
      return { status: result.statusCode, body: result.body };
    }

    // POST /api/listings/:id/availability/pause
    const matchPause = path.match(/^\/api\/listings\/([^/]+)\/availability\/pause$/);
    if (matchPause && method === 'POST') {
      const listingId = matchPause[1];
      const result = await listingsHandler.pauseAvailability(listingId, authenticatedUser);
      return { status: result.statusCode, body: result.body };
    }

    // POST /api/listings/:id/availability/resume
    const matchResume = path.match(/^\/api\/listings\/([^/]+)\/availability\/resume$/);
    if (matchResume && method === 'POST') {
      const listingId = matchResume[1];
      const result = await listingsHandler.resumeAvailability(listingId, authenticatedUser);
      return { status: result.statusCode, body: result.body };
    }

    // ========================================================================
    // HOST BOOKING MANAGEMENT ENDPOINTS (Cedar Protected)
    // ========================================================================

    // --- GET /api/host/bookings (Retrieve host's own bookings) ---
    if (method === 'GET' && path === '/api/host/bookings') {
      const result = await bookingsHandler.getHostBookings(query, authenticatedUser);
      return { status: result.statusCode, body: result.body };
    }

    // --- POST /api/host/bookings/:id/cancel (Host cancels a booking) ---
    const matchCancelBooking = path.match(/^\/api\/host\/bookings\/([^/]+)\/cancel$/);
    if (matchCancelBooking && method === 'POST') {
      const bookingId = matchCancelBooking[1];
      const result = await bookingsHandler.cancelBooking(bookingId, authenticatedUser);
      return { status: result.statusCode, body: result.body };
    }

    // --- POST /api/host/bookings/:id/complete (Host marks booking completed) ---
    const matchCompleteBooking = path.match(/^\/api\/host\/bookings\/([^/]+)\/complete$/);
    if (matchCompleteBooking && method === 'POST') {
      const bookingId = matchCompleteBooking[1];
      const result = await bookingsHandler.completeBooking(bookingId, authenticatedUser);
      return { status: result.statusCode, body: result.body };
    }

    // --- POST /api/host/bookings/:id/start (Host starts parking session) ---
    const matchStartBooking = path.match(/^\/api\/host\/bookings\/([^/]+)\/start$/);
    if (matchStartBooking && method === 'POST') {
      const bookingId = matchStartBooking[1];
      const result = await bookingsHandler.startSession(bookingId, authenticatedUser);
      return { status: result.statusCode, body: result.body };
    }

    // --- GET /api/host/bookings/:id (Retrieve a single booking) ---
    const matchHostBooking = path.match(/^\/api\/host\/bookings\/([^/]+)$/);
    if (matchHostBooking && method === 'GET') {
      const bookingId = matchHostBooking[1];
      const result = await bookingsHandler.getBookingById(bookingId, authenticatedUser);
      return { status: result.statusCode, body: result.body };
    }

    // --- POST /api/bookings (Create booking / future renter flow) ---
    if (method === 'POST' && path === '/api/bookings') {
      const result = await bookingsHandler.createBooking(body, authenticatedUser);
      return { status: result.statusCode, body: result.body };
    }

    // --- /api/listings/:id patterns ---
    const match = path.match(/^\/api\/listings\/([^/]+)$/);
    if (match) {
      const listingId = match[1];

      if (method === 'GET') {
        const result = await listingsHandler.getListingById(listingId, authenticatedUser);
        return { status: result.statusCode, body: result.body };
      }

      if (method === 'PUT') {
        const result = await listingsHandler.updateListing(listingId, body, authenticatedUser);
        return { status: result.statusCode, body: result.body };
      }

      if (method === 'DELETE') {
        const result = await listingsHandler.deleteListing(listingId, authenticatedUser);
        return { status: result.statusCode, body: result.body };
      }
    }

    // Endpoint not matched
    return {
      status: 404,
      body: { error: `Endpoint not found: ${method} ${rawPath}` }
    };
  } catch (err) {
    const status = err.statusCode || 500;
    return {
      status,
      body: {
        error: err.message || 'Internal server error',
        statusCode: status,
        diagnostics: err.diagnostics || undefined
      }
    };
  }
}
