"use client"

import React, { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { toast } from "sonner"
import { fetchUserProfile, updateUserProfile, UserProfile } from '@/lib/settings-api';

export function ProfileForm() {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [nameInput, setNameInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isFetching, setIsFetching] = useState(true);

  useEffect(() => {
    const loadProfile = async () => {
      setIsFetching(true);
      try {
        const fetchedProfile = await fetchUserProfile();
        setProfile(fetchedProfile);
        setNameInput(fetchedProfile.name || '');
      } catch (error) {
        console.error("Failed to fetch profile:", error);
        toast.error("Failed to load profile data.");
        setProfile(null);
      } finally {
        setIsFetching(false);
      }
    };
    loadProfile();
  }, []);

  const handleSaveChanges = async () => {
    if (!profile) return;
    setIsLoading(true);
    try {
      const updatedProfile = await updateUserProfile({ name: nameInput });
      setProfile(updatedProfile);
      setNameInput(updatedProfile.name || '');
      toast.success("Profile updated successfully!");
    } catch (error) {
      console.error("Failed to save profile:", error);
      toast.error("Failed to save changes. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card className="bg-white shadow-sm">
      <CardHeader>
        <CardTitle className="text-xl font-semibold text-gray-800">Profile</CardTitle>
        <CardDescription className="text-gray-600">
          Manage your account details.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {isFetching ? (
          <p className="text-gray-600">Loading profile...</p>
        ) : profile ? (
          <>
            <div className="space-y-1">
              <Label htmlFor="email" className="text-sm font-medium text-gray-700">Email</Label>
              <Input
                id="email"
                type="email"
                value={profile.email || ''}
                disabled // Email usually not editable
                className="bg-gray-100 border-gray-300 text-gray-500"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="name" className="text-sm font-medium text-gray-700">Name</Label>
              <Input
                id="name"
                value={nameInput}
                onChange={(e) => setNameInput(e.target.value)}
                placeholder="Your name"
                className="bg-white border-gray-300 focus:border-amber-500 focus:ring-amber-500"
                disabled={isLoading}
              />
            </div>
            {/* Add other profile fields here later (e.g., preferences) */}
          </>
        ) : (
          <p className="text-sm text-gray-500">Could not load profile information.</p>
        )}
      </CardContent>
      <CardFooter className="border-t border-gray-200 px-6 py-4 bg-gray-50 rounded-b-lg">
        <Button
          onClick={handleSaveChanges}
          disabled={isLoading || isFetching || !profile || profile.name === nameInput}
          className="bg-blue-600 text-white hover:bg-blue-700 focus:ring-blue-500"
        >
          {isLoading ? "Saving..." : "Save Profile Changes"}
        </Button>
      </CardFooter>
    </Card>
  )
}
