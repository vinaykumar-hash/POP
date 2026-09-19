import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

/**
 * ProtectedRoute Component
 * 
 * ============================================================================
 * SECURITY NOTICE
 * ============================================================================
 * 
 * This component provides client-side route redirection to optimize user experience
 * by guiding unauthenticated users directly to `/host/login`.
 * 
 * CRITICAL ARCHITECTURAL PRINCIPLE:
 * Frontend route protection alone DOES NOT constitute security or authorization.
 * 
 * In the eventual AWS cloud architecture:
 * 1. An unauthenticated attacker could theoretically bypass React routing.
 * 2. Therefore, the REAL security perimeter resides in the AWS API Gateway
 *    Cognito Authorizer and Lambda function handlers.
 * 3. Every backend route (GET, PUT, DELETE /listings/:id) will cryptographically
 *    verify the JWT signature and enforce:
 *        claims.sub === listing.hostId
 * 4. Requests with missing, invalid, or mismatched tokens will be rejected (401/403)
 *    regardless of any frontend configuration.
 */
export default function ProtectedRoute({ children }) {
  const { isAuthenticated, isLoading } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return (
      <div className="auth-loading-container" aria-live="polite">
        <div className="loading-spinner" aria-label="Checking authentication status..."></div>
        <p className="loading-text">Verifying host session...</p>
      </div>
    );
  }

  if (!isAuthenticated) {
    // Redirect unauthenticated visitor to login, preserving intended destination
    return <Navigate to="/host/login" state={{ from: location }} replace />;
  }

  return children;
}
