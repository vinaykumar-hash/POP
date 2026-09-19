/**
 * ParkSync - Backend Authentication Middleware (Cognito JWT Verification)
 * 
 * ============================================================================
 * LAMBDA AUTHORIZATION ARCHITECTURE
 * ============================================================================
 * 
 * In production API Gateway + Lambda:
 * 1. API Gateway validates the signature against the Cognito User Pool JWKS:
 *    `https://cognito-idp.{region}.amazonaws.com/{userPoolId}/.well-known/jwks.json`
 * 2. The authorizer passes the claims context to the Lambda event:
 *    `event.requestContext.authorizer.claims.sub`
 * 3. Lambda NEVER trusts any `hostId` passed in the body or query params.
 */

export function verifyAuthToken(authHeader) {
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    const error = new Error('Unauthorized: Missing or invalid Authorization header.');
    error.statusCode = 401;
    throw error;
  }

  const token = authHeader.substring(7).trim();

  try {
    // Decode JWT parts (header.payload.signature)
    const parts = token.split('.');
    if (parts.length === 3) {
      // Base64Url decode payload
      const base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
      const jsonPayload = Buffer.from(base64, 'base64').toString('utf8');
      const claims = JSON.parse(jsonPayload);

      if (!claims.sub) {
        const error = new Error('Unauthorized: JWT token does not contain a valid sub claim.');
        error.statusCode = 401;
        throw error;
      }

      // Check expiration if present
      if (claims.exp && claims.exp * 1000 < Date.now()) {
        const error = new Error('Unauthorized: Token has expired.');
        error.statusCode = 401;
        throw error;
      }

      const rawGroups = claims['cognito:groups'] || claims.groups || [];
      const groups = Array.isArray(rawGroups) ? rawGroups : [rawGroups];

      return {
        sub: claims.sub,
        email: claims.email || '',
        name: claims.name || '',
        verificationStatus: claims.verificationStatus || 'not_submitted',
        groups
      };
    } else {
      // Fallback simple token format for test/local runner
      const parsed = JSON.parse(Buffer.from(token, 'base64').toString('utf8'));
      if (!parsed.sub) {
        throw new Error('Missing sub');
      }
      const rawGroups = parsed['cognito:groups'] || parsed.groups || [];
      const groups = Array.isArray(rawGroups) ? rawGroups : [rawGroups];
      return {
        ...parsed,
        verificationStatus: parsed.verificationStatus || 'not_submitted',
        groups
      };
    }
  } catch (err) {
    const error = new Error('Unauthorized: Invalid authentication token.');
    error.statusCode = 401;
    throw error;
  }
}
