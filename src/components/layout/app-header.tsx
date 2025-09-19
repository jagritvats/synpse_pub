'use client';

import React from 'react';
import Link from 'next/link';
import { useAuth } from '@/context/auth-context';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { LogIn, LogOut, User as UserIcon } from 'lucide-react';

export function AppHeader() {
  const { user, isAuthenticated, isLoading, logout } = useAuth();

  const getInitials = (name?: string) => {
    if (!name) return '?';
    const names = name.split(' ');
    if (names.length === 1) return names[0].charAt(0).toUpperCase();
    return (names[0].charAt(0) + names[names.length - 1].charAt(0)).toUpperCase();
  };

  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container flex h-14 items-center">
        <div className="mr-4 hidden md:flex">
          <Link href="/" className="mr-6 flex items-center space-x-2">
            {/* Add your logo here if you have one */}
            {/* <YourLogo className="h-6 w-6" /> */}
            <span className="hidden font-bold sm:inline-block">
              Synapse
            </span>
          </Link>
          {/* Add main navigation links here if needed */}
          {/* <nav className="flex items-center space-x-6 text-sm font-medium"> */}
          {/*   <Link href="/features">Features</Link> */}
          {/*   <Link href="/pricing">Pricing</Link> */}
          {/* </nav> */}
        </div>

        {/* Mobile Nav Trigger (Example - Needs implementation if required) */}
        {/* <button className="inline-flex items-center justify-center rounded-md font-medium md:hidden"> */}
        {/*   <Menu className="h-6 w-6" /> */}
        {/*   <span className="sr-only">Toggle Menu</span> */}
        {/* </button> */}

        <div className="flex flex-1 items-center justify-end space-x-4">
          <nav className="flex items-center space-x-1">
            {isLoading ? (
              <div className="h-8 w-8 animate-pulse rounded-full bg-muted"></div>
            ) : isAuthenticated ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" className="relative h-8 w-8 rounded-full">
                    <Avatar className="h-8 w-8">
                       {/* TODO: Add user.avatarUrl if available */}
                       <AvatarImage src={undefined} alt={user?.name || user?.email} />
                       <AvatarFallback>{getInitials(user?.name || user?.email)}</AvatarFallback>
                    </Avatar>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent className="w-56" align="end" forceMount>
                  <DropdownMenuLabel className="font-normal">
                    <div className="flex flex-col space-y-1">
                      <p className="text-sm font-medium leading-none">{user?.name || 'User'}</p>
                      <p className="text-xs leading-none text-muted-foreground">
                        {user?.email}
                      </p>
                    </div>
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  {/* Add links to Profile, Settings etc. if needed */}
                   <DropdownMenuItem asChild>
                     <Link href="/settings/prompt"><UserIcon className="mr-2 h-4 w-4" /> Settings</Link>
                   </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={logout}>
                    <LogOut className="mr-2 h-4 w-4" />
                    <span>Log out</span>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            ) : (
              <Button asChild variant="ghost">
                <Link href="/login">
                  <LogIn className="mr-2 h-4 w-4" /> Login
                </Link>
              </Button>
            )}
          </nav>
        </div>
      </div>
    </header>
  );
} 