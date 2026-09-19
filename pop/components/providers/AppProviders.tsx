'use client';

import React from 'react';
import { AuthProvider } from '@/contexts/AuthContext';
import { AuthModal } from '@/components/auth/AuthModal';
import { SpotAlertToast } from '@/components/notifications/SpotAlertToast';

export function AppProviders({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      {children}
      <AuthModal />
      <SpotAlertToast />
    </AuthProvider>
  );
}
