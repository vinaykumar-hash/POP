/**
 * ParkSync - Authentication Service Abstraction
 * 
 * ============================================================================
 * ARCHITECTURAL SPECIFICATION & SECURITY REQUIREMENTS
 * ============================================================================
 * 
 * Future Production Architecture:
 * 1. User signs up/in -> Amazon Cognito User Pool generates JWT ID & Access Tokens.
 * 2. The unique user identifier is the Cognito `sub` (Subject Claim UUID).
 * 3. Client transmits JWT in Authorization header: `Bearer <token>`
 * 4. Amazon API Gateway / AWS Lambda Authorizer verifies token signature.
 * 5. Lambda extracts `authenticatedUser.id = claims.sub`.
 * 6. DynamoDB enforces that `listing.hostId === authenticatedUser.id`.
 * 
 * Security Rules:
 * - Never trust a `hostId` provided in the request body from the frontend.
 * - Do NOT store passwords in localStorage, sessionStorage, or client cookies.
 * - This service provides an abstract interface isolating Cognito implementation details
 *   from React UI components.
 * 
 * Development-Only Stub:
 * - Until the AWS Cognito SDK is connected, this module manages an in-memory session.
 * - User identities are generated with a UUID format mimicking Cognito `sub`.
 */

const SESSION_STORAGE_KEY = 'parksync_host_session';

function loadStoredSession() {
  try {
    if (typeof window !== 'undefined' && window.sessionStorage) {
      const stored = window.sessionStorage.getItem(SESSION_STORAGE_KEY);
      if (stored) {
        return JSON.parse(stored);
      }
    }
  } catch (err) {
    console.error('Failed to load stored session:', err);
  }
  return null;
}

function persistSession(user) {
  try {
    if (typeof window !== 'undefined' && window.sessionStorage) {
      if (user) {
        window.sessionStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(user));
      } else {
        window.sessionStorage.removeItem(SESSION_STORAGE_KEY);
      }
    }
  } catch (err) {
    console.error('Failed to persist session:', err);
  }
}

// Initialize session from sessionStorage if available
let currentSessionUser = loadStoredSession();

const registeredUsers = new Map([
  ['admin@parksync.local', {
    user: {
      id: 'cognito-sub-admin-001',
      name: 'System Administrator',
      email: 'admin@parksync.local',
      phone: '9999999999',
      groups: ['admin'],
      verificationStatus: 'verified',
      createdAt: '2026-01-01T00:00:00.000Z'
    },
    passwordHash: 'Admin123!'
  }],
  ['testa@example.com', {
    user: {
      id: 'cognito-sub-test-host-a',
      name: 'Test Host A',
      email: 'testa@example.com',
      phone: '9876543210',
      groups: ['hosts'],
      verificationStatus: 'pending',
      createdAt: '2026-01-01T00:00:00.000Z'
    },
    passwordHash: 'HostA123!'
  }],
  ['testb@example.com', {
    user: {
      id: 'cognito-sub-test-host-b',
      name: 'Test Host B',
      email: 'testb@example.com',
      phone: '9876543211',
      groups: ['hosts'],
      verificationStatus: 'verified',
      createdAt: '2026-01-01T00:00:00.000Z'
    },
    passwordHash: 'HostB123!'
  }]
]);

/**
 * Generate a pseudo-UUID mimicking Amazon Cognito `sub`
 */
function generateCognitoSub() {
  return 'cognito-sub-' + 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/**
 * Browser-safe and Node-safe Base64URL encoder
 */
function toBase64Url(obj) {
  const str = JSON.stringify(obj);
  let base64;
  if (typeof btoa === 'function') {
    base64 = btoa(unescape(encodeURIComponent(str)));
  } else {
    base64 = Buffer.from(str, 'utf-8').toString('base64');
  }
  return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export const authService = {
  /**
   * Register a new host account
   * @param {Object} params { name, email, phone, password }
   * @returns {Promise<{ success: boolean, user: Object }>}
   */
  async signUp({ name, email, phone, password }) {
    // Simulated network latency (150ms)
    await new Promise((resolve) => setTimeout(resolve, 150));

    const normalizedEmail = email.trim().toLowerCase();

    if (registeredUsers.has(normalizedEmail)) {
      const error = new Error('An account with this email already exists.');
      error.code = 'UsernameExistsException';
      throw error;
    }

    // Create user identity with immutable UUID (Cognito sub equivalent)
    const hostUser = {
      id: generateCognitoSub(), // In production, this will be cognitoUser.sub
      name: name.trim(),
      email: normalizedEmail,
      phone: phone.trim(),
      groups: ['hosts'],
      verificationStatus: 'not_submitted',
      createdAt: new Date().toISOString()
    };

    // Store in-memory credentials map (Dev only: in production, Cognito handles passwords)
    registeredUsers.set(normalizedEmail, {
      user: hostUser,
      passwordHash: password // Mock representation; real passwords never touch app storage
    });

    // Automatically set current authenticated session and persist
    currentSessionUser = { ...hostUser };
    persistSession(currentSessionUser);

    return {
      success: true,
      user: { ...hostUser },
      token: this.getAuthToken()
    };
  },

  /**
   * Update verification status of current authenticated user session
   */
  updateVerificationStatus(status) {
    if (currentSessionUser) {
      currentSessionUser = {
        ...currentSessionUser,
        verificationStatus: status
      };
      persistSession(currentSessionUser);
      const normalizedEmail = currentSessionUser.email?.toLowerCase();
      if (normalizedEmail && registeredUsers.has(normalizedEmail)) {
        const account = registeredUsers.get(normalizedEmail);
        account.user.verificationStatus = status;
      }
    }
  },

  /**
   * Sign in an existing host
   * @param {Object} params { email, password }
   * @returns {Promise<{ success: boolean, user: Object }>}
   */
  async signIn({ email, password }) {
    // Simulated network latency (150ms)
    await new Promise((resolve) => setTimeout(resolve, 150));

    const normalizedEmail = email.trim().toLowerCase();
    const account = registeredUsers.get(normalizedEmail);

    if (!account || account.passwordHash !== password) {
      const error = new Error('Invalid email or password.');
      error.code = 'NotAuthorizedException';
      throw error;
    }

    currentSessionUser = { ...account.user };
    persistSession(currentSessionUser);

    return {
      success: true,
      user: { ...account.user },
      token: this.getAuthToken()
    };
  },

  /**
   * Terminate active authenticated session
   * @returns {Promise<void>}
   */
  async signOut() {
    currentSessionUser = null;
    persistSession(null);
    return Promise.resolve();
  },

  /**
   * Retrieve the currently authenticated host identity
   * @returns {Object|null}
   */
  getCurrentUser() {
    if (!currentSessionUser) {
      currentSessionUser = loadStoredSession();
    }
    return currentSessionUser ? { ...currentSessionUser } : null;
  },

  /**
   * Check if a host is currently authenticated
   * @returns {boolean}
   */
  isAuthenticated() {
    return currentSessionUser !== null;
  },

  /**
   * Check if the current authenticated user has admin role
   * @returns {boolean}
   */
  isAdmin() {
    return !!(currentSessionUser?.groups && currentSessionUser.groups.includes('admin'));
  },

  /**
   * Generate standard format Cognito JWT Bearer token for API requests
   * @returns {string|null}
   */
  getAuthToken() {
    if (!currentSessionUser) return null;

    const awsRegion = (typeof import.meta !== 'undefined' && import.meta.env?.VITE_AWS_REGION) ||
      (typeof process !== 'undefined' && process.env?.VITE_AWS_REGION) ||
      'ap-south-1';
    const userPoolId = (typeof import.meta !== 'undefined' && import.meta.env?.VITE_COGNITO_USER_POOL_ID) ||
      (typeof process !== 'undefined' && process.env?.VITE_COGNITO_USER_POOL_ID) ||
      'mock-pool';

    const header = toBase64Url({ alg: 'HS256', typ: 'JWT' });
    const payload = toBase64Url({
      sub: currentSessionUser.id,
      email: currentSessionUser.email,
      name: currentSessionUser.name,
      verificationStatus: currentSessionUser.verificationStatus || 'not_submitted',
      'cognito:groups': currentSessionUser.groups || [],
      groups: currentSessionUser.groups || [],
      iss: `https://cognito-idp.${awsRegion}.amazonaws.com/${userPoolId}`,
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + 3600
    });
    const signature = 'cognito_verified_signature';

    return `${header}.${payload}.${signature}`;
  }
};
