// ============================================================================
// ParkSync - Amazon Cedar Authorization Policies
// ============================================================================

// Policy 1: Permit an authenticated host to view only their own listing
permit (
    principal,
    action == ParkSync::Action::"viewListing",
    resource
)
when {
    resource.owner == principal
};

// Policy 2: Permit an authenticated host to update only their own listing
permit (
    principal,
    action == ParkSync::Action::"updateListing",
    resource
)
when {
    resource.owner == principal
};

// Policy 3: Permit an authenticated host to delete only their own listing
permit (
    principal,
    action == ParkSync::Action::"deleteListing",
    resource
)
when {
    resource.owner == principal
};

// Policy 4: Permit an authenticated user to initiate listing creation
permit (
    principal is ParkSync::User,
    action == ParkSync::Action::"createListing",
    resource
);

// Policy 5: Permit administrators to view listings requiring review
permit (
    principal in ParkSync::Group::"admin",
    action == ParkSync::Action::"viewPendingListings",
    resource
);

// Policy 6: Permit administrators to review, approve, or reject listings
permit (
    principal in ParkSync::Group::"admin",
    action in [
        ParkSync::Action::"reviewListing",
        ParkSync::Action::"approveListing",
        ParkSync::Action::"rejectListing"
    ],
    resource
);

// Policy 7: Permit a host to view, cancel, complete, or start sessions for bookings where they are the host
permit (
    principal,
    action in [
        ParkSync::Action::"viewBooking",
        ParkSync::Action::"cancelBooking",
        ParkSync::Action::"completeBooking",
        ParkSync::Action::"startBookingSession"
    ],
    resource
)
when {
    resource.host == principal
};

// Policy 8: Permit a host to view only their own host profile, and admins to view any host profile
permit (
    principal,
    action == ParkSync::Action::"viewHost",
    resource
)
when {
    resource.owner == principal || principal in ParkSync::Group::"admin"
};

// Policy 9: Permit administrators to verify host accounts
permit (
    principal in ParkSync::Group::"admin",
    action == ParkSync::Action::"verifyHost",
    resource
);


