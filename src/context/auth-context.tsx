'use client';

import React, { createContext, useState, useContext, useEffect, ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { IUser } from '@/../server/src/models/user.model'; // Adjust path if needed
import { toast } from 'sonner';
import { apiClient } from '@/lib/api-client'; // Import apiClient
import { Session } from '@/../server/src/models/session.model'; // Assuming Session model export


// Define the user type for the context (excluding sensitive fields like password)
type ContextUser = Partial<Omit<IUser, 'password' | 'comparePassword' | 'isModified'>> & {
   id: string; // id is required, could be 'anonymous'
   username?: string; // username is optional
   name?: string; // name is optional
   email?: string; // email optional for anonymous
};

interface AuthContextType {
  user: ContextUser | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (username: string, password: string) => Promise<void>;
  register: (username: string, name: string, email: string, password: string) => Promise<void>;
  logout: () => void;
  checkForExistingSession: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<ContextUser | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true); // Start loading until session checked
  const router = useRouter();

  const saveSession = (userData: ContextUser, authToken: string) => {
    // Ensure sensitive data isn't stored if present (though backend should omit it)
    const userToStore = { ...userData };
    delete (userToStore as any).password;

    console.log('[AuthContext] Attempting to save session:', { user: userToStore, token: authToken });

    localStorage.setItem('authToken', authToken);
    localStorage.setItem('userData', JSON.stringify(userToStore));
    
    // Also set token as cookie for SSR compatibility
    document.cookie = `authToken=${authToken}; path=/; max-age=${7 * 24 * 60 * 60}; SameSite=Lax`;
    
    setUser(userToStore);
    setToken(authToken);
    console.log('[AuthContext] Session state updated and saved to localStorage and cookie.');
  };

  const clearSession = () => {
    localStorage.removeItem('authToken');
    localStorage.removeItem('userData');
    
    // Clear token cookie
    document.cookie = "authToken=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT";
    
    setUser(null);
    setToken(null);
  };

  const checkForExistingSession = async () => {
    setIsLoading(true);
    let existingToken: string | null = null;
    try {
      existingToken = localStorage.getItem('authToken');
      const storedUser = localStorage.getItem('userData');

      if (existingToken && storedUser) {
        console.log('Validating existing session...');
        const parsedUser: ContextUser = JSON.parse(storedUser);

        // *** Optional but recommended: Validate token with backend ***
        // try {
        //   await apiClient('/auth/verify', { method: 'POST' }); // Example verify endpoint
        //   setUser(parsedUser);
        //   setToken(existingToken);
        //   console.log('Existing session loaded and verified.');
        // } catch (verifyError) {
        //   console.warn('Existing token failed verification:', verifyError);
        //   clearSession();
        //   existingToken = null; // Force fetching a new anonymous session
        // }
        // *** For now, trust localStorage if present ***
        setUser(parsedUser);
        setToken(existingToken);
        console.log('Existing session loaded from localStorage (not backend-verified).');

      } else {
        console.log('No existing session found in localStorage.');
        existingToken = null; // Ensure it's null if localStorage check failed
      }
    } catch (error) {
      console.error('Error processing stored session data:', error);
      clearSession();
      existingToken = null; // Ensure it's null if parsing failed
    }

    // If no valid token exists after checks, do nothing. User needs to login.
    setIsLoading(false);
  };

  // Check for existing session on initial load
  useEffect(() => {
    checkForExistingSession();
  }, []);

  const login = async (username: string, password: string) => {
    setIsLoading(true);
    try {
        // Use apiClient, login endpoint doesn't require auth token initially
        const data = await apiClient<{ user: ContextUser, token: string }>('/auth/login', {
            method: 'POST',
            body: { username, password },
            includeAuth: false,
        });

        if (!data || !data.user || !data.token) {
            throw new Error('Invalid response from server');
        }

        saveSession(data.user, data.token);
        toast.success('Login successful!');
        setIsLoading(false);
        router.push('/'); // Or to dashboard
    } catch (error: any) {
        console.error("Login API call failed:", error);
        clearSession();
        toast.error(`Login failed: ${error.message || 'Please check credentials'}`);
        setIsLoading(false);
        throw error; // Re-throw for the form to handle
    }
  };

  const register = async (username: string, name: string, email: string, password: string) => {
     setIsLoading(true);
     try {
         // Use apiClient, register endpoint doesn't require auth token initially
         const data = await apiClient<{ user: ContextUser, token: string }>('/auth/register', {
             method: 'POST',
             body: { username, name, email, password },
             includeAuth: false,
         });

         if (!data || !data.user || !data.token) {
            throw new Error('Invalid response from server');
         }

         saveSession(data.user, data.token);
         toast.success('Registration successful!');
         router.push('/'); // Or to dashboard
     } catch (error: any) {
         console.error("Register API call failed:", error);
         clearSession();
         toast.error(`Registration failed: ${error.message || 'Please try again'}`);
         setIsLoading(false);
         throw error; // Re-throw for the form to handle
     }
     // Don't set loading false here due to redirect
   };

  const logout = () => {
    clearSession();
    toast.info('You have been logged out.');
    router.push('/login'); // Redirect to login page
  };

  return (
    <AuthContext.Provider value={{
       user,
       token,
       // A user is authenticated if the user object exists (and is not null)
       isAuthenticated: !!user,
       isLoading,
       login,
       register,
       logout,
       checkForExistingSession
       }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}; 