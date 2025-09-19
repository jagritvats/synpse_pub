'use client'

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Settings, LogIn, LogOut, Menu, ListCollapse } from 'lucide-react'
import { useAuth } from '@/context/auth-context'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

interface AppHeaderProps {
  onMenuClick?: () => void; // Optional callback for menu button
}

// Helper for avatar initials
const getInitials = (name?: string) => {
  if (!name) return '?';
  const names = name.split(' ');
  if (names.length === 1) return names[0].charAt(0).toUpperCase();
  return (names[0].charAt(0) + names[names.length - 1].charAt(0)).toUpperCase();
};

export default function AppHeader({ onMenuClick }: AppHeaderProps) {
  const { user, isAuthenticated, isLoading: isAuthLoading, logout } = useAuth()
  const router = useRouter()

  return (
    <header className="bg-white p-4 shadow-sm flex justify-between items-center border-b border-amber-100 sticky top-0 z-10">
      {/* Left Group - Only Menu (if needed) and Logo/Title */}
      <div className="flex items-center space-x-2">
        {onMenuClick && (
          <Button variant="ghost" size="icon" className="text-amber-800" onClick={onMenuClick}>
            <Menu className="h-5 w-5" />
          </Button>
        )}
        <Link href="/chat" passHref>
          <div className="flex items-center cursor-pointer">
            <Avatar className="h-10 w-10 mr-3">
              <AvatarFallback className="bg-amber-200 text-amber-800">S</AvatarFallback>
            </Avatar>
            <div>
              <h1 className="text-xl font-medium text-amber-800">Serendipity</h1>
              <p className="text-xs text-gray-500">Your thoughtful companion</p>
            </div>
          </div>
        </Link>
        {/* REMOVED Sessions Link/Button from here */}
      </div>

      {/* Right Group */}
      <div className="flex items-center space-x-2">
        {/* Add Sessions Link/Button here first - visible when authenticated */}
        {isAuthenticated && (
           <Button variant="ghost" size="icon" className="text-amber-800" onClick={() => router.push('/sessions')}>
             <ListCollapse className="h-5 w-5" />
           </Button>
         )}
        {/* Then Auth Status / Profile Dropdown */}
        {isAuthLoading ? (
           <div className="h-8 w-8 animate-pulse rounded-full bg-muted"></div>
         ) : isAuthenticated ? (
           <DropdownMenu>
             <DropdownMenuTrigger asChild>
               <Button variant="ghost" className="relative h-8 w-8 rounded-full">
                 <Avatar className="h-8 w-8">
                    <AvatarImage src={undefined /* user?.avatarUrl */} alt={user?.name || user?.email} />
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
               <DropdownMenuItem onClick={() => router.push('/settings/prompt')}>
                   <Settings className="mr-2 h-4 w-4" /> Settings
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
      </div>
    </header>
  )
} 