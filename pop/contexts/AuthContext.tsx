'use client';

// =============================================================================
// ParkWise — Authentication Context & Provider
// =============================================================================

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { UserProfile, UserRole } from '@/types/user';
import {
  cognitoSignIn,
  cognitoSignUp,
  cognitoSignOut,
  DEMO_ACCOUNTS,
  isCognitoActive,
} from '@/services/auth/cognitoClient';

interface AuthContextType {
  user: UserProfile | null;
  role: UserRole;
  isAuthenticated: boolean;
  isLoading: boolean;
  isAwsCognito: boolean;
  isAuthModalOpen: boolean;
  openAuthModal: (initialRole?: UserRole) => void;
  closeAuthModal: () => void;
  signIn: (email: string, pass: string) => Promise<void>;
  signUp: (email: string, pass: string, role: UserRole, name?: string) => Promise<void>;
  signOut: () => Promise<void>;
  switchDemoUser: (role: UserRole) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const STORAGE_KEY = 'parkwise_auth_user';

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [isAwsCognito, setIsAwsCognito] = useState(false);

  // Initialize from localStorage or default to Arjun Reddy demo user for quick start
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        setUser(parsed.user);
        setAccessToken(parsed.accessToken);
        setIsAwsCognito(parsed.isAwsCognito ?? false);
      }
    } catch {
      // Fallback
    } finally {
      setIsLoading(false);
    }
  }, []);

  const openAuthModal = useCallback((initialRole?: UserRole) => {
    if (initialRole && !user) {
      // Pass role preference to modal
    }
    setIsAuthModalOpen(true);
  }, [user]);

  const closeAuthModal = useCallback(() => {
    setIsAuthModalOpen(false);
  }, []);

  const signIn = async (email: string, pass: string) => {
    setIsLoading(true);
    try {
      const session = await cognitoSignIn(email, pass);
      setUser(session.user);
      setAccessToken(session.accessToken);
      setIsAwsCognito(session.isAwsCognito);
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({
          user: session.user,
          accessToken: session.accessToken,
          isAwsCognito: session.isAwsCognito,
        })
      );
      setIsAuthModalOpen(false);
    } finally {
      setIsLoading(false);
    }
  };

  const signUp = async (email: string, pass: string, role: UserRole, name?: string) => {
    setIsLoading(true);
    try {
      await cognitoSignUp(email, pass, role, name);
      // Auto sign in for demo convenience
      await signIn(email, pass);
    } finally {
      setIsLoading(false);
    }
  };

  const signOut = async () => {
    setIsLoading(true);
    try {
      if (accessToken) {
        await cognitoSignOut(accessToken);
      }
      setUser(null);
      setAccessToken(null);
      localStorage.removeItem(STORAGE_KEY);
    } finally {
      setIsLoading(false);
    }
  };

  const switchDemoUser = (targetRole: UserRole) => {
    const demoProfile = DEMO_ACCOUNTS[targetRole];
    setUser(demoProfile);
    setAccessToken(`mock_token_${targetRole.toLowerCase()}`);
    setIsAwsCognito(isCognitoActive());
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        user: demoProfile,
        accessToken: `mock_token_${targetRole.toLowerCase()}`,
        isAwsCognito: isCognitoActive(),
      })
    );
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        role: user?.role || 'USER',
        isAuthenticated: !!user,
        isLoading,
        isAwsCognito,
        isAuthModalOpen,
        openAuthModal,
        closeAuthModal,
        signIn,
        signUp,
        signOut,
        switchDemoUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
