/**
 * ParkSync - Listings Lambda Handler with Cedar Authorization & Verification Lifecycle
 * 
 * ============================================================================
 * CEDAR AUTHORIZATION & SERVER-SIDE OWNERSHIP ENFORCEMENT
 * ============================================================================
 * 
 * Separation of Concerns:
 * 1. AUTHENTICATION: Verified Cognito claims.sub is the trusted principal identity.
 * 2. AUTHORIZATION: Amazon Cedar evaluates fine-grained policies:
 *      - Host ownership: permit(principal, action, resource) when { resource.owner == principal }
 *      - Admin review: permit(principal in Group::"admin", action in [...], resource)
 *    Returns ALLOW or DENY. DENY returns HTTP 403 Forbidden immediately.
 * 3. BUSINESS LOGIC: Lambda performs DynamoDB operations only after Cedar ALLOW.
 * 
 * Defense-In-Depth:
 * - Direct invariant `existingListing.hostId === authenticatedUser.sub` is maintained
 *   alongside Cedar authorization decisions.
 * - Client-supplied `hostId`, `owner`, `reviewedBy`, `reviewedAt`, or arbitrary `status`
 *   in request payloads is strictly sanitized or rejected.
 */

import { dynamoDbService } from '../dynamoDbService.js';
import { cedarAuthorizer } from '../authorization/cedar/cedarAuthorizer.js';
import { validateAvailability } from '../utils/availabilityValidator.js';

export const listingsHandler = {
  /**
   * POST /api/listings - Create listing for authenticated host
   */
  async createListing(body, authenticatedUser) {
    if (!authenticatedUser?.sub) {
      const err = new Error('Unauthorized: Missing authenticated identity.');
      err.statusCode = 401;
      throw err;
    }

    // 1. Evaluate Cedar Authorization: createListing
    const authDecision = await cedarAuthorizer.isAuthorized({
      principal: authenticatedUser.sub,
      action: 'createListing',
      resource: { owner: authenticatedUser.sub }
    });

    if (authDecision.decision === 'DENY') {
      const err = new Error(`Forbidden: Denied by Cedar authorization policy.`);
      err.statusCode = 403;
      err.diagnostics = authDecision.diagnostics;
      throw err;
    }

    // Validate availability if provided, or initialize default
    const availability = body.availability
      ? validateAvailability(body.availability)
      : {
        days: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'],
        startTime: '08:00',
        endTime: '20:00',
        timezone: 'Asia/Kolkata',
        mode: 'recurring',
        temporarilyUnavailable: false
      };

    // 2. DISCARD any client-supplied hostId, owner, or review metadata
    const sanitizedData = {
      ...body,
      hostId: authenticatedUser.sub, // Enforce server-side ownership
      host: {
        name: body.host?.name || authenticatedUser.name || '',
        email: authenticatedUser.email || body.host?.email || '',
        phone: body.host?.phone || ''
      },
      availability,
      status: 'pending_review', // Listings always enter pending_review upon creation
      rejectionReason: null,
      reviewedAt: null,
      reviewedBy: null
    };

    // Remove any attempted client-side overrides
    delete sanitizedData.owner;

    const created = await dynamoDbService.createListing(sanitizedData);
    return {
      statusCode: 201,
      body: created
    };
  },

  /**
   * GET /api/listings - Retrieve only listings belonging to authenticated host
   */
  async getHostListings(authenticatedUser) {
    if (!authenticatedUser?.sub) {
      const err = new Error('Unauthorized: Missing authenticated identity.');
      err.statusCode = 401;
      throw err;
    }

    const listings = await dynamoDbService.getListingsByHost(authenticatedUser.sub);
    return {
      statusCode: 200,
      body: listings
    };
  },

  /**
   * GET /api/listings/{id} - Retrieve specific listing with Cedar authorization
   */
  async getListingById(listingId, authenticatedUser) {
    if (!authenticatedUser?.sub) {
      const err = new Error('Unauthorized: Missing authenticated identity.');
      err.statusCode = 401;
      throw err;
    }

    const listing = await dynamoDbService.getListingById(listingId);

    if (!listing) {
      const err = new Error(`Listing not found: ${listingId}`);
      err.statusCode = 404;
      throw err;
    }

    // 1. Evaluate Cedar Authorization: viewListing
    const authDecision = await cedarAuthorizer.isAuthorized({
      principal: authenticatedUser.sub,
      action: 'viewListing',
      resource: {
        id: listing.listingId,
        owner: listing.hostId
      }
    });

    if (authDecision.decision === 'DENY') {
      const err = new Error('Forbidden: Denied by Cedar authorization policy.');
      err.statusCode = 403;
      err.diagnostics = authDecision.diagnostics;
      throw err;
    }

    // 2. Defense-in-depth ownership verification
    if (listing.hostId !== authenticatedUser.sub) {
      const err = new Error('Forbidden: You do not have permission to access another host\'s private listing.');
      err.statusCode = 403;
      throw err;
    }

    return {
      statusCode: 200,
      body: listing
    };
  },

  /**
   * PUT /api/listings/{id} - Update listing with Cedar authorization
   */
  async updateListing(listingId, updateData, authenticatedUser) {
    if (!authenticatedUser?.sub) {
      const err = new Error('Unauthorized: Missing authenticated identity.');
      err.statusCode = 401;
      throw err;
    }

    const existing = await dynamoDbService.getListingById(listingId);

    if (!existing) {
      const err = new Error(`Listing not found: ${listingId}`);
      err.statusCode = 404;
      throw err;
    }

    // 1. Evaluate Cedar Authorization: updateListing
    const authDecision = await cedarAuthorizer.isAuthorized({
      principal: authenticatedUser.sub,
      action: 'updateListing',
      resource: {
        id: existing.listingId,
        owner: existing.hostId
      }
    });

    if (authDecision.decision === 'DENY') {
      const err = new Error('Forbidden: Denied by Cedar authorization policy.');
      err.statusCode = 403;
      err.diagnostics = authDecision.diagnostics;
      throw err;
    }

    // 2. Defense-in-depth ownership verification
    if (existing.hostId !== authenticatedUser.sub) {
      const err = new Error('Forbidden: You do not have permission to modify another host\'s listing.');
      err.statusCode = 403;
      throw err;
    }

    // 3. Prevent modifying the immutable owner identity and review fields
    const sanitizedUpdates = {
      ...updateData,
      listingId,
      hostId: existing.hostId // Immutable owner ID
    };
    delete sanitizedUpdates.owner;
    delete sanitizedUpdates.reviewedBy;
    delete sanitizedUpdates.reviewedAt;

    // Validate availability if provided
    if (updateData.availability) {
      sanitizedUpdates.availability = validateAvailability({
        ...(existing.availability || {}),
        ...updateData.availability
      });
    }

    // 4. State lifecycle handling:
    if (existing.status === 'rejected') {
      // When a host updates a rejected listing, transition it back to pending_review
      sanitizedUpdates.status = 'pending_review';
      sanitizedUpdates.rejectionReason = null;
      sanitizedUpdates.reviewedAt = null;
      sanitizedUpdates.reviewedBy = null;
    } else if (existing.status === 'approved') {
      // Check for material changes that affect location/trust/physical parking
      const isMaterialChange =
        (updateData.location && JSON.stringify(updateData.location) !== JSON.stringify(existing.location)) ||
        (updateData.photos && JSON.stringify(updateData.photos) !== JSON.stringify(existing.photos)) ||
        (updateData.verification && JSON.stringify(updateData.verification) !== JSON.stringify(existing.verification)) ||
        (updateData.parkingDetails?.parkingType && updateData.parkingDetails.parkingType !== existing.parkingDetails?.parkingType) ||
        (updateData.parkingDetails?.vehicleType && updateData.parkingDetails.vehicleType !== existing.parkingDetails?.vehicleType) ||
        (updateData.parkingDetails?.capacity && updateData.parkingDetails.capacity !== existing.parkingDetails?.capacity);

      if (isMaterialChange) {
        sanitizedUpdates.status = 'pending_review';
        sanitizedUpdates.rejectionReason = null;
        sanitizedUpdates.reviewedAt = null;
        sanitizedUpdates.reviewedBy = null;
      } else {
        // Minor operational updates (rates, instructions, availability) keep approved status
        sanitizedUpdates.status = 'approved';
      }
    } else {
      // Never allow host to forge 'approved' or other unauthorized status
      sanitizedUpdates.status = existing.status || 'pending_review';
    }

    const updated = await dynamoDbService.updateListing(listingId, authenticatedUser.sub, sanitizedUpdates);

    return {
      statusCode: 200,
      body: updated
    };
  },

  /**
   * POST /api/listings/{id}/resubmit - Resubmit rejected listing for review
   */
  async resubmitListing(listingId, authenticatedUser) {
    if (!authenticatedUser?.sub) {
      const err = new Error('Unauthorized: Missing authenticated identity.');
      err.statusCode = 401;
      throw err;
    }

    const existing = await dynamoDbService.getListingById(listingId);
    if (!existing) {
      const err = new Error(`Listing not found: ${listingId}`);
      err.statusCode = 404;
      throw err;
    }

    // Cedar check
    const authDecision = await cedarAuthorizer.isAuthorized({
      principal: authenticatedUser.sub,
      action: 'updateListing',
      resource: {
        id: existing.listingId,
        owner: existing.hostId
      }
    });

    if (authDecision.decision === 'DENY' || existing.hostId !== authenticatedUser.sub) {
      const err = new Error('Forbidden: You do not have permission to resubmit this listing.');
      err.statusCode = 403;
      throw err;
    }

    // Only rejected listings can be resubmitted
    if (existing.status !== 'rejected') {
      const err = new Error(`Invalid state transition: Cannot resubmit listing with status '${existing.status}'. Only 'rejected' listings can be resubmitted.`);
      err.statusCode = 400;
      throw err;
    }

    const updates = {
      status: 'pending_review',
      rejectionReason: null,
      reviewedAt: null,
      reviewedBy: null
    };

    const updated = await dynamoDbService.updateListing(listingId, authenticatedUser.sub, updates);
    return {
      statusCode: 200,
      body: updated
    };
  },

  /**
   * DELETE /api/listings/{id} - Delete listing with Cedar authorization
   */
  async deleteListing(listingId, authenticatedUser) {
    if (!authenticatedUser?.sub) {
      const err = new Error('Unauthorized: Missing authenticated identity.');
      err.statusCode = 401;
      throw err;
    }

    const existing = await dynamoDbService.getListingById(listingId);

    if (!existing) {
      const err = new Error(`Listing not found: ${listingId}`);
      err.statusCode = 404;
      throw err;
    }

    // 1. Evaluate Cedar Authorization: deleteListing
    const authDecision = await cedarAuthorizer.isAuthorized({
      principal: authenticatedUser.sub,
      action: 'deleteListing',
      resource: {
        id: existing.listingId,
        owner: existing.hostId
      }
    });

    if (authDecision.decision === 'DENY') {
      const err = new Error('Forbidden: Denied by Cedar authorization policy.');
      err.statusCode = 403;
      err.diagnostics = authDecision.diagnostics;
      throw err;
    }

    // 2. Defense-in-depth ownership verification
    if (existing.hostId !== authenticatedUser.sub) {
      const err = new Error('Forbidden: You do not have permission to delete another host\'s listing.');
      err.statusCode = 403;
      throw err;
    }

    // 3. Listing deletion safety check: verify no active bookings exist
    const activeBookings = await dynamoDbService.getActiveBookingsByListing(listingId);
    if (activeBookings && activeBookings.length > 0) {
      const err = new Error('Conflict: Cannot delete listing while active bookings (pending or confirmed) exist.');
      err.statusCode = 409;
      err.activeBookingsCount = activeBookings.length;
      throw err;
    }

    await dynamoDbService.deleteListing(listingId, authenticatedUser.sub);

    return {
      statusCode: 200,
      body: {
        success: true,
        message: 'Listing successfully deleted.',
        listingId
      }
    };
  },

  // ==========================================================================
  // HOST AVAILABILITY OPERATIONS (Cedar Protected)
  // ==========================================================================

  /**
   * PUT /api/listings/{id}/availability - Update host availability
   */
  async updateAvailability(listingId, availabilityData, authenticatedUser) {
    if (!authenticatedUser?.sub) {
      const err = new Error('Unauthorized: Missing authenticated identity.');
      err.statusCode = 401;
      throw err;
    }

    const existing = await dynamoDbService.getListingById(listingId);
    if (!existing) {
      const err = new Error(`Listing not found: ${listingId}`);
      err.statusCode = 404;
      throw err;
    }

    // 1. Evaluate Cedar Authorization: updateListing
    const authDecision = await cedarAuthorizer.isAuthorized({
      principal: authenticatedUser.sub,
      action: 'updateListing',
      resource: {
        id: existing.listingId,
        owner: existing.hostId
      }
    });

    if (authDecision.decision === 'DENY') {
      const err = new Error('Forbidden: Denied by Cedar authorization policy.');
      err.statusCode = 403;
      err.diagnostics = authDecision.diagnostics;
      throw err;
    }

    // 2. Defense-in-depth ownership verification
    if (existing.hostId !== authenticatedUser.sub) {
      const err = new Error('Forbidden: You do not have permission to modify another host\'s listing availability.');
      err.statusCode = 403;
      throw err;
    }

    // 3. Strict server-side validation
    const validated = validateAvailability(availabilityData);

    // 4. Preserve existing pause state unless explicitly overridden
    if (typeof availabilityData.temporarilyUnavailable !== 'boolean' && existing.availability) {
      validated.temporarilyUnavailable = existing.availability.temporarilyUnavailable || false;
    }

    // 5. Availability is an operational update; it does NOT alter listing.status
    const updated = await dynamoDbService.updateListing(listingId, authenticatedUser.sub, {
      availability: validated
    });

    return {
      statusCode: 200,
      body: updated.availability
    };
  },

  /**
   * POST /api/listings/{id}/availability/pause - Temporarily pause listing availability
   */
  async pauseAvailability(listingId, authenticatedUser) {
    if (!authenticatedUser?.sub) {
      const err = new Error('Unauthorized: Missing authenticated identity.');
      err.statusCode = 401;
      throw err;
    }

    const existing = await dynamoDbService.getListingById(listingId);
    if (!existing) {
      const err = new Error(`Listing not found: ${listingId}`);
      err.statusCode = 404;
      throw err;
    }

    // Cedar check
    const authDecision = await cedarAuthorizer.isAuthorized({
      principal: authenticatedUser.sub,
      action: 'updateListing',
      resource: {
        id: existing.listingId,
        owner: existing.hostId
      }
    });

    if (authDecision.decision === 'DENY') {
      const err = new Error('Forbidden: Denied by Cedar authorization policy.');
      err.statusCode = 403;
      err.diagnostics = authDecision.diagnostics;
      throw err;
    }

    // Defense-in-depth
    if (existing.hostId !== authenticatedUser.sub) {
      const err = new Error('Forbidden: You do not have permission to pause another host\'s listing.');
      err.statusCode = 403;
      throw err;
    }

    const currentAvailability = existing.availability || {
      days: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'],
      startTime: '08:00',
      endTime: '20:00',
      timezone: 'Asia/Kolkata',
      mode: 'recurring'
    };

    const newAvailability = {
      ...currentAvailability,
      temporarilyUnavailable: true
    };

    // Note: listing.status remains UNCHANGED (does NOT become suspended)
    const updated = await dynamoDbService.updateListing(listingId, authenticatedUser.sub, {
      availability: newAvailability
    });

    return {
      statusCode: 200,
      body: updated
    };
  },

  /**
   * POST /api/listings/{id}/availability/resume - Resume listing availability
   */
  async resumeAvailability(listingId, authenticatedUser) {
    if (!authenticatedUser?.sub) {
      const err = new Error('Unauthorized: Missing authenticated identity.');
      err.statusCode = 401;
      throw err;
    }

    const existing = await dynamoDbService.getListingById(listingId);
    if (!existing) {
      const err = new Error(`Listing not found: ${listingId}`);
      err.statusCode = 404;
      throw err;
    }

    // Cedar check
    const authDecision = await cedarAuthorizer.isAuthorized({
      principal: authenticatedUser.sub,
      action: 'updateListing',
      resource: {
        id: existing.listingId,
        owner: existing.hostId
      }
    });

    if (authDecision.decision === 'DENY') {
      const err = new Error('Forbidden: Denied by Cedar authorization policy.');
      err.statusCode = 403;
      err.diagnostics = authDecision.diagnostics;
      throw err;
    }

    // Defense-in-depth
    if (existing.hostId !== authenticatedUser.sub) {
      const err = new Error('Forbidden: You do not have permission to resume another host\'s listing.');
      err.statusCode = 403;
      throw err;
    }

    const currentAvailability = existing.availability || {
      days: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'],
      startTime: '08:00',
      endTime: '20:00',
      timezone: 'Asia/Kolkata',
      mode: 'recurring'
    };

    const newAvailability = {
      ...currentAvailability,
      temporarilyUnavailable: false
    };

    // Note: listing.status remains UNCHANGED
    const updated = await dynamoDbService.updateListing(listingId, authenticatedUser.sub, {
      availability: newAvailability
    });

    return {
      statusCode: 200,
      body: updated
    };
  },

  // ==========================================================================
  // ADMINISTRATIVE VERIFICATION OPERATIONS
  // ==========================================================================

  /**
   * GET /api/admin/listings - Retrieve listings pending review (Admin only)
   */
  async getPendingListings(query, authenticatedUser) {
    if (!authenticatedUser?.sub) {
      const err = new Error('Unauthorized: Missing authenticated identity.');
      err.statusCode = 401;
      throw err;
    }

    // Evaluate Cedar Authorization: viewPendingListings
    const authDecision = await cedarAuthorizer.isAuthorized({
      principal: authenticatedUser,
      action: 'viewPendingListings',
      resource: { id: 'all' }
    });

    if (authDecision.decision === 'DENY') {
      const err = new Error('Forbidden: Denied by Cedar authorization policy. Administrative access required.');
      err.statusCode = 403;
      err.diagnostics = authDecision.diagnostics;
      throw err;
    }

    const status = query?.status || 'pending_review';
    const listings = await dynamoDbService.getListingsByStatus(status);
    return {
      statusCode: 200,
      body: listings
    };
  },

  /**
   * POST /api/admin/listings/{id}/approve - Approve listing (Admin only)
   */
  async approveListing(listingId, authenticatedUser) {
    if (!authenticatedUser?.sub) {
      const err = new Error('Unauthorized: Missing authenticated identity.');
      err.statusCode = 401;
      throw err;
    }

    const listing = await dynamoDbService.getListingById(listingId);
    if (!listing) {
      const err = new Error(`Listing not found: ${listingId}`);
      err.statusCode = 404;
      throw err;
    }

    // Evaluate Cedar Authorization: approveListing
    const authDecision = await cedarAuthorizer.isAuthorized({
      principal: authenticatedUser,
      action: 'approveListing',
      resource: { id: listingId, owner: listing.hostId }
    });

    if (authDecision.decision === 'DENY') {
      const err = new Error('Forbidden: Denied by Cedar authorization policy. Administrative access required.');
      err.statusCode = 403;
      err.diagnostics = authDecision.diagnostics;
      throw err;
    }

    // State transition validation: Only pending_review can be approved
    if (listing.status !== 'pending_review') {
      const err = new Error(`Invalid state transition: Cannot approve listing with status '${listing.status}'. Only 'pending_review' listings can be approved.`);
      err.statusCode = 400;
      throw err;
    }

    const updates = {
      status: 'approved',
      rejectionReason: null,
      reviewedAt: new Date().toISOString(),
      reviewedBy: authenticatedUser.sub
    };

    const updated = await dynamoDbService.updateListingDirect(listingId, updates);
    return {
      statusCode: 200,
      body: updated
    };
  },

  /**
   * POST /api/admin/listings/{id}/reject - Reject listing (Admin only)
   */
  async rejectListing(listingId, body, authenticatedUser) {
    if (!authenticatedUser?.sub) {
      const err = new Error('Unauthorized: Missing authenticated identity.');
      err.statusCode = 401;
      throw err;
    }

    const rawReason = body?.rejectionReason || body?.reason;
    const reason = typeof rawReason === 'string' ? rawReason.trim() : '';
    if (!reason) {
      const err = new Error('Bad Request: A non-empty rejectionReason is required.');
      err.statusCode = 400;
      throw err;
    }

    const listing = await dynamoDbService.getListingById(listingId);
    if (!listing) {
      const err = new Error(`Listing not found: ${listingId}`);
      err.statusCode = 404;
      throw err;
    }

    // Evaluate Cedar Authorization: rejectListing
    const authDecision = await cedarAuthorizer.isAuthorized({
      principal: authenticatedUser,
      action: 'rejectListing',
      resource: { id: listingId, owner: listing.hostId }
    });

    if (authDecision.decision === 'DENY') {
      const err = new Error('Forbidden: Denied by Cedar authorization policy. Administrative access required.');
      err.statusCode = 403;
      err.diagnostics = authDecision.diagnostics;
      throw err;
    }

    // State transition validation: Only pending_review can be rejected
    if (listing.status !== 'pending_review') {
      const err = new Error(`Invalid state transition: Cannot reject listing with status '${listing.status}'. Only 'pending_review' listings can be rejected.`);
      err.statusCode = 400;
      throw err;
    }

    const updates = {
      status: 'rejected',
      rejectionReason: reason,
      reviewedAt: new Date().toISOString(),
      reviewedBy: authenticatedUser.sub
    };

    const updated = await dynamoDbService.updateListingDirect(listingId, updates);
    return {
      statusCode: 200,
      body: updated
    };
  }
};
