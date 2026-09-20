// =============================================================================
// ParkWise — AWS Cognito Authentication Client
// =============================================================================

import {
  CognitoIdentityProviderClient,
  SignUpCommand,
  ConfirmSignUpCommand,
  InitiateAuthCommand,
  GlobalSignOutCommand,
  GetUserCommand,
} from '@aws-sdk/client-cognito-identity-provider';
import { UserProfile, UserRole } from '@/types/user';

const AWS_REGION = process.env.NEXT_PUBLIC_AWS_REGION || process.env.AWS_REGION || 'ap-south-1';
const USER_POOL_ID = process.env.NEXT_PUBLIC_COGNITO_USER_POOL_ID || process.env.COGNITO_USER_POOL_ID || '';
const CLIENT_ID = process.env.NEXT_PUBLIC_COGNITO_CLIENT_ID || process.env.COGNITO_CLIENT_ID || '';

const isCognitoConfigured = Boolean(USER_POOL_ID && CLIENT_ID);

let cognitoClient: CognitoIdentityProviderClient | null = null;
if (isCognitoConfigured) {
  try {
    cognitoClient = new CognitoIdentityProviderClient({ region: AWS_REGION });
  } catch (err) {
    console.warn('[ParkWise Cognito] Failed to initialize client, using local mock fallback:', err);
  }
}

export interface AuthSession {
  user: UserProfile;
  accessToken: string;
  idToken: string;
  isAwsCognito: boolean;
}

// Built-in demo accounts for effortless local verification
export const DEMO_ACCOUNTS: Record<UserRole, UserProfile> = {
  USER: {
    id: 'usr_demo_driver_01',
    role: 'USER',
    displayName: 'Arjun Reddy',
    email: 'arjun.driver@parkwise.in',
    phone: '9876543210',
    verificationStatus: 'not_submitted',
    createdAt: new Date().toISOString(),
  },
  HOST: {
    id: 'usr_demo_host_01',
    role: 'HOST',
    displayName: 'Priya Sharma (Indiranagar Host)',
    email: 'priya.host@parkwise.in',
    phone: '9876543211',
    verificationStatus: 'verified',
    createdAt: new Date().toISOString(),
  },
  ADMIN: {
    id: 'usr_demo_admin_01',
    role: 'ADMIN',
    displayName: 'ParkWise Ops Admin',
    email: 'ops@parkwise.in',
    phone: '9876543212',
    verificationStatus: 'verified',
    createdAt: new Date().toISOString(),
  },
};

/**
 * Sign in with AWS Cognito or fall back to local mock authentication
 */
export async function cognitoSignIn(email: string, password: string): Promise<AuthSession> {
  if (isCognitoConfigured && cognitoClient) {
    const command = new InitiateAuthCommand({
      AuthFlow: 'USER_PASSWORD_AUTH',
      ClientId: CLIENT_ID,
      AuthParameters: {
        USERNAME: email,
        PASSWORD: password,
      },
    });

    const response = await cognitoClient.send(command);
    const authResult = response.AuthenticationResult;

    if (!authResult || !authResult.AccessToken) {
      throw new Error('Authentication succeeded but tokens were not returned.');
    }

    // Fetch user profile attributes
    const getUserCmd = new GetUserCommand({
      AccessToken: authResult.AccessToken,
    });
    const userRes = await cognitoClient.send(getUserCmd);
    const preferredRole = userRes.UserAttributes?.find(
      (attr) => attr.Name === 'custom:preferred_role' || attr.Name === 'preferred_role'
    )?.Value as UserRole | undefined;

    const user: UserProfile = {
      id: userRes.Username || email,
      email,
      displayName: userRes.UserAttributes?.find((a) => a.Name === 'name')?.Value || email.split('@')[0],
      role: preferredRole || 'USER',
      createdAt: new Date().toISOString(),
    };

    return {
      user,
      accessToken: authResult.AccessToken,
      idToken: authResult.IdToken || '',
      isAwsCognito: true,
    };
  }

  // Local Mock Fallback
  // Check if matches known demo or create a mock session
  let matchedRole: UserRole = 'USER';
  if (email.toLowerCase().includes('host')) {
    matchedRole = 'HOST';
  } else if (email.toLowerCase().includes('admin')) {
    matchedRole = 'ADMIN';
  }

  const user: UserProfile = {
    id: `usr_mock_${Math.random().toString(36).substring(2, 9)}`,
    email,
    displayName: email.split('@')[0].replace('.', ' ').replace(/\b\w/g, (l) => l.toUpperCase()),
    role: matchedRole,
    verificationStatus: matchedRole === 'HOST' || matchedRole === 'ADMIN' ? 'verified' : 'not_submitted',
    createdAt: new Date().toISOString(),
  };

  return {
    user,
    accessToken: `mock_jwt_access_${Date.now()}`,
    idToken: `mock_jwt_id_${Date.now()}`,
    isAwsCognito: false,
  };
}

/**
 * Sign up with AWS Cognito or local mock
 */
export async function cognitoSignUp(
  email: string,
  password: string,
  role: UserRole = 'USER',
  displayName?: string
): Promise<{ userConfirmed: boolean; userSub: string }> {
  if (isCognitoConfigured && cognitoClient) {
    const command = new SignUpCommand({
      ClientId: CLIENT_ID,
      Username: email,
      Password: password,
      UserAttributes: [
        { Name: 'email', Value: email },
        { Name: 'name', Value: displayName || email.split('@')[0] },
        { Name: 'preferred_role', Value: role },
      ],
    });

    const res = await cognitoClient.send(command);
    return {
      userConfirmed: res.UserConfirmed || false,
      userSub: res.UserSub || '',
    };
  }

  // Local Mock response
  return {
    userConfirmed: true,
    userSub: `mock_sub_${Date.now()}`,
  };
}

/**
 * Confirm verification code for Cognito sign up
 */
export async function cognitoConfirmSignUp(email: string, code: string): Promise<boolean> {
  if (isCognitoConfigured && cognitoClient) {
    const command = new ConfirmSignUpCommand({
      ClientId: CLIENT_ID,
      Username: email,
      ConfirmationCode: code,
    });
    await cognitoClient.send(command);
    return true;
  }
  return true;
}

/**
 * Global Sign Out
 */
export async function cognitoSignOut(accessToken?: string): Promise<void> {
  if (isCognitoConfigured && cognitoClient && accessToken) {
    try {
      const command = new GlobalSignOutCommand({
        AccessToken: accessToken,
      });
      await cognitoClient.send(command);
    } catch (err) {
      console.warn('[ParkWise Cognito] Global sign-out failed:', err);
    }
  }
}

export function isCognitoActive(): boolean {
  return isCognitoConfigured && cognitoClient !== null;
}
