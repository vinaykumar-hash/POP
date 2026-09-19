/**
 * ParkSync - Amazon Cedar Authorization Engine Service
 * 
 * ============================================================================
 * CEDAR EVALUATION ARCHITECTURE
 * ============================================================================
 * 
 * This service implements the Amazon Cedar authorization model:
 * 1. Default-Deny: Every request is DENIED unless explicitly permitted by policy.
 * 2. Principal: `ParkSync::User::"{claims.sub}"` in `[ParkSync::Group::"{group}"]`
 * 3. Resource: `ParkSync::Listing::"{listingId}"` with attribute `owner = ParkSync::User::"{hostId}"`
 * 4. Actions:
 *    - Host: `viewListing`, `updateListing`, `deleteListing`, `createListing`
 *    - Admin: `viewPendingListings`, `reviewListing`, `approveListing`, `rejectListing`
 * 
 * In Production AWS:
 * - Maps to Amazon Verified Permissions (AVP) `IsAuthorizedCommand`:
 *     client.send(new IsAuthorizedCommand({ policyStoreId, principal, action, resource, entities }))
 * - Cognito User Pool identity sources map Cognito groups to Cedar `principal in Group::"admin"`.
 * 
 * In Local / Dev Environment:
 * - Executes the exact Cedar policy semantics defined in `policies.cedar`.
 */

export const cedarAuthorizer = {
  /**
   * Format entity identifiers to Cedar syntax
   */
  formatEntityId(type, id) {
    if (!id) return null;
    return id.startsWith('ParkSync::') ? id : `${type}::"${id}"`;
  },

  /**
   * Format action identifier to Cedar syntax
   */
  formatAction(action) {
    const rawAction = action.replace(/^ParkSync::Action::/, '').replace(/"/g, '');
    return `ParkSync::Action::"${rawAction}"`;
  },

  /**
   * Evaluate authorization request against Cedar policies
   * 
   * @param {Object} params
   * @param {string|Object} params.principal User identity (Cognito sub or claims object)
   * @param {string} params.action Cedar action identifier
   * @param {Object} params.resource Resource descriptor or listing object
   * @param {Object} [params.context] Additional request context (e.g. groups)
   * @returns {Promise<{ decision: 'ALLOW' | 'DENY', diagnostics: Object }>}
   */
  async isAuthorized({ principal, action, resource, context = {} }) {
    // 1. Normalize Principal
    const principalId = typeof principal === 'string'
      ? principal
      : principal?.id || principal?.sub || null;

    if (!principalId) {
      return {
        decision: 'DENY',
        diagnostics: {
          reasons: ['No authenticated principal provided (default deny)'],
          policy: null
        }
      };
    }

    const cedarPrincipal = this.formatEntityId('ParkSync::User', principalId);

    // Extract groups (from principal object or context)
    const rawGroups = (typeof principal === 'object' && principal?.groups)
      ? principal.groups
      : context?.groups || [];
    const principalGroups = Array.isArray(rawGroups) ? rawGroups : [rawGroups];
    const isAdmin = principalGroups.includes('admin');

    // 2. Normalize Action
    const cedarAction = this.formatAction(action);

    // 3. Normalize Resource
    const resourceOwnerId = resource?.owner || resource?.hostId || resource?.host || null;
    const resourceId = resource?.id || resource?.listingId || resource?.bookingId || 'draft';
    const isBookingResource = !!(resource?.bookingId || resource?.type === 'booking' || resource?.host);
    const cedarResource = this.formatEntityId(isBookingResource ? 'ParkSync::Booking' : 'ParkSync::Listing', resourceId);
    const cedarOwner = resourceOwnerId ? this.formatEntityId('ParkSync::User', resourceOwnerId) : null;
    const cedarHost = resource?.host ? this.formatEntityId('ParkSync::User', resource.host) : cedarOwner;

    // ========================================================================
    // CEDAR POLICY EVALUATION (Matching policies.cedar)
    // ========================================================================

    // Policy 4: createListing
    // permit(principal is ParkSync::User, action == Action::"createListing", resource);
    if (cedarAction === 'ParkSync::Action::"createListing"') {
      return {
        decision: 'ALLOW',
        diagnostics: {
          reasons: ['Permitted by Cedar Policy 4 (createListing)'],
          policy: 'policy-create-listing'
        }
      };
    }

    // Policy 1: viewListing
    // permit(principal, action == Action::"viewListing", resource) when { resource.owner == principal };
    if (cedarAction === 'ParkSync::Action::"viewListing"') {
      if (cedarOwner && cedarOwner === cedarPrincipal) {
        return {
          decision: 'ALLOW',
          diagnostics: {
            reasons: ['Permitted by Cedar Policy 1: resource.owner == principal'],
            policy: 'policy-view-listing'
          }
        };
      }
      return {
        decision: 'DENY',
        diagnostics: {
          reasons: [
            `Denied by Cedar Policy 1: resource.owner (${cedarOwner || 'undefined'}) does not match principal (${cedarPrincipal})`
          ],
          policy: null
        }
      };
    }

    // Policy 2: updateListing
    // permit(principal, action == Action::"updateListing", resource) when { resource.owner == principal };
    if (cedarAction === 'ParkSync::Action::"updateListing"') {
      if (cedarOwner && cedarOwner === cedarPrincipal) {
        return {
          decision: 'ALLOW',
          diagnostics: {
            reasons: ['Permitted by Cedar Policy 2: resource.owner == principal'],
            policy: 'policy-update-listing'
          }
        };
      }
      return {
        decision: 'DENY',
        diagnostics: {
          reasons: [
            `Denied by Cedar Policy 2: resource.owner (${cedarOwner || 'undefined'}) does not match principal (${cedarPrincipal})`
          ],
          policy: null
        }
      };
    }

    // Policy 3: deleteListing
    // permit(principal, action == Action::"deleteListing", resource) when { resource.owner == principal };
    if (cedarAction === 'ParkSync::Action::"deleteListing"') {
      if (cedarOwner && cedarOwner === cedarPrincipal) {
        return {
          decision: 'ALLOW',
          diagnostics: {
            reasons: ['Permitted by Cedar Policy 3: resource.owner == principal'],
            policy: 'policy-delete-listing'
          }
        };
      }
      return {
        decision: 'DENY',
        diagnostics: {
          reasons: [
            `Denied by Cedar Policy 3: resource.owner (${cedarOwner || 'undefined'}) does not match principal (${cedarPrincipal})`
          ],
          policy: null
        }
      };
    }

    // Policy 5: viewPendingListings
    // permit(principal in ParkSync::Group::"admin", action == Action::"viewPendingListings", resource);
    if (cedarAction === 'ParkSync::Action::"viewPendingListings"') {
      if (isAdmin) {
        return {
          decision: 'ALLOW',
          diagnostics: {
            reasons: ['Permitted by Cedar Policy 5: principal in ParkSync::Group::"admin"'],
            policy: 'policy-view-pending-listings'
          }
        };
      }
      return {
        decision: 'DENY',
        diagnostics: {
          reasons: ['Denied by Cedar Policy 5: principal is not a member of ParkSync::Group::"admin"'],
          policy: null
        }
      };
    }

    // Policy 6: reviewListing, approveListing, rejectListing
    // permit(principal in ParkSync::Group::"admin", action in [...], resource);
    if (
      cedarAction === 'ParkSync::Action::"reviewListing"' ||
      cedarAction === 'ParkSync::Action::"approveListing"' ||
      cedarAction === 'ParkSync::Action::"rejectListing"'
    ) {
      if (isAdmin) {
        return {
          decision: 'ALLOW',
          diagnostics: {
            reasons: [`Permitted by Cedar Policy 6: principal in ParkSync::Group::"admin"`],
            policy: 'policy-admin-review-listing'
          }
        };
      }
      return {
        decision: 'DENY',
        diagnostics: {
          reasons: [`Denied by Cedar Policy 6: principal is not a member of ParkSync::Group::"admin"`],
          policy: null
        }
      };
    }

    // Policy 7: viewBooking, cancelBooking, completeBooking, startBookingSession
    // permit(principal, action in [viewBooking, cancelBooking, completeBooking, startBookingSession], resource) when { resource.host == principal };
    if (
      cedarAction === 'ParkSync::Action::"viewBooking"' ||
      cedarAction === 'ParkSync::Action::"cancelBooking"' ||
      cedarAction === 'ParkSync::Action::"completeBooking"' ||
      cedarAction === 'ParkSync::Action::"startBookingSession"'
    ) {
      const hostEntity = cedarHost || cedarOwner;
      if (hostEntity && hostEntity === cedarPrincipal) {
        return {
          decision: 'ALLOW',
          diagnostics: {
            reasons: ['Permitted by Cedar Policy 7: resource.host == principal'],
            policy: 'policy-host-manage-booking'
          }
        };
      }
      return {
        decision: 'DENY',
        diagnostics: {
          reasons: [
            `Denied by Cedar Policy 7: resource.host (${hostEntity || 'undefined'}) does not match principal (${cedarPrincipal})`
          ],
          policy: null
        }
      };
    }

    // Policy 8: viewHost
    // permit(principal, action == Action::"viewHost", resource) when { resource.owner == principal || principal in Group::"admin" };
    if (cedarAction === 'ParkSync::Action::"viewHost"') {
      if (isAdmin || (cedarOwner && cedarOwner === cedarPrincipal)) {
        return {
          decision: 'ALLOW',
          diagnostics: {
            reasons: ['Permitted by Cedar Policy 8: resource.owner == principal or principal in Group::"admin"'],
            policy: 'policy-view-host'
          }
        };
      }
      return {
        decision: 'DENY',
        diagnostics: {
          reasons: [`Denied by Cedar Policy 8: resource.owner (${cedarOwner || 'undefined'}) does not match principal (${cedarPrincipal})`],
          policy: null
        }
      };
    }

    // Policy 9: verifyHost
    // permit(principal in ParkSync::Group::"admin", action == Action::"verifyHost", resource);
    if (cedarAction === 'ParkSync::Action::"verifyHost"') {
      if (isAdmin) {
        return {
          decision: 'ALLOW',
          diagnostics: {
            reasons: ['Permitted by Cedar Policy 9: principal in ParkSync::Group::"admin"'],
            policy: 'policy-admin-verify-host'
          }
        };
      }
      return {
        decision: 'DENY',
        diagnostics: {
          reasons: ['Denied by Cedar Policy 9: principal is not a member of ParkSync::Group::"admin"'],
          policy: null
        }
      };
    }

    // Default Deny for unknown actions
    return {
      decision: 'DENY',
      diagnostics: {
        reasons: [`Denied: No Cedar policy allows action ${cedarAction}`],
        policy: null
      }
    };
  }
};
