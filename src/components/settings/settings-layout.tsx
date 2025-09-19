'use client';

import type React from "react"
import Link from "next/link"
// import { ChatSidebar } from "@/components/chat/chat-sidebar"
import { usePathname } from 'next/navigation'
import type { User } from "@/lib/types"; // Assuming User type is defined here
import AppHeader from '@/components/layout/AppHeader'
import { useAuth } from '@/context/auth-context';

interface SettingsLayoutProps {
  children: React.ReactNode;
  user: any; // Accept any user type (either from auth context or server)
}

export function SettingsLayout({ children, user }: SettingsLayoutProps) {
  const { isAuthenticated } = useAuth();

  // If not authenticated or no user, show an appropriate message
  if (!isAuthenticated || !user) {
    console.error("SettingsLayout rendered without proper authentication.");
    return <p>Loading or unauthorized...</p>;
  }

  return (
    <div className="flex flex-col h-screen overflow-hidden light">
      <AppHeader onMenuClick={() => { /* TODO: Implement sidebar toggle if needed */ }} />
      {/* <ChatSidebar user={user} /> */}
      
      <div className="flex-1 overflow-y-auto bg-gray-50">
        <div className="container max-w-5xl py-10 px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col space-y-8">
            <div className="space-y-2">
              <h2 className="text-3xl font-bold tracking-tight text-gray-900">Settings</h2>
              <p className="text-gray-600">Manage your account settings and preferences.</p>
            </div>
            <div className="flex flex-col space-y-8 lg:flex-row lg:space-x-12 lg:space-y-0">
              <aside className="lg:w-1/5 lg:sticky lg:top-10 self-start">
                <nav className="flex flex-col space-y-1">
                  <SettingsLink href="/settings" label="Profile" />
                  <SettingsLink href="/settings/interests" label="Interests" />
                  <SettingsLink href="/settings/integrations" label="Integrations" />
                  <SettingsLink href="/settings/prompt" label="Companion Config" />
                  <SettingsLink href="/settings/timeline" label="AI Timeline" />
                  <SettingsLink href="/settings/companion-state" label="Companion State" />
                </nav>
              </aside>
              <div className="flex-1 lg:max-w-3xl">{children}</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

interface SettingsLinkProps {
  href: string;
  label: string;
}

function SettingsLink({ href, label }: SettingsLinkProps) {
  const pathname = usePathname();
  const isActive = pathname === href;

  return (
    <Link
      href={href}
      className={`px-3 py-2 text-sm font-medium rounded-md transition-colors duration-150 ease-in-out 
        ${isActive
          ? 'bg-amber-100 text-amber-800 hover:bg-amber-200'
          : 'text-gray-700 hover:bg-gray-200 hover:text-gray-900'
        }`}
    >
      {label}
    </Link>
  );
}
