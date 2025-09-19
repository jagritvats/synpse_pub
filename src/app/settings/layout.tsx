'use client';

import React, { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { SettingsLayout } from '@/components/settings/settings-layout';
import { useAuth } from '@/context/auth-context';

interface SettingsAppLayoutProps {
  children: React.ReactNode;
}

export default function SettingsAppLayout({ children }: SettingsAppLayoutProps) {
  const { user, isAuthenticated, isLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    // Redirect if not logged in and not loading
    if (!isLoading && !isAuthenticated) {
      router.push('/login');
    }
  }, [isAuthenticated, isLoading, router]);

  if (isLoading) {
    return <div className="flex h-screen items-center justify-center">Loading...</div>;
  }

  if (!isAuthenticated) {
    // Return null as we're redirecting in the useEffect
    return null;
  }

  return (
    <SettingsLayout user={user}>
      {children}
    </SettingsLayout>
  );
} 