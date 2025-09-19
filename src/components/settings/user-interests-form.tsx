'use client';

import React, { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider"; // For interest level
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { Trash2 } from 'lucide-react';
import { fetchUserInterests, updateUserInterests } from '@/lib/settings-api';
import { IUserInterest } from "@/../server/src/models/user-state.model"; // Adjust path if needed

// Interface for form state
interface FormInterest {
  topic: string;
  level: number;
  // addedAt is handled by API/DB
}

export function UserInterestsForm() {
  const [interests, setInterests] = useState<FormInterest[]>([]);
  const [newInterestTopic, setNewInterestTopic] = useState('');
  const [newInterestLevel, setNewInterestLevel] = useState<number>(3); // Default level
  const [isLoading, setIsLoading] = useState(false);
  const [isFetching, setIsFetching] = useState(true);

  useEffect(() => {
    const loadInterests = async () => {
      setIsFetching(true);
      try {
        const fetchedInterests: IUserInterest[] = await fetchUserInterests();
        setInterests(fetchedInterests.map(i => ({ topic: i.topic, level: i.level })) || []);
      } catch (error) {
        console.error("Failed to fetch user interests:", error);
        toast.error("Failed to load your interests.");
        setInterests([]);
      } finally {
        setIsFetching(false);
      }
    };
    loadInterests();
  }, []);

  const handleAddInterest = () => {
    if (!newInterestTopic.trim()) {
      toast.warning("Please enter an interest topic.");
      return;
    }
    setInterests([...interests, { topic: newInterestTopic.trim(), level: newInterestLevel }]);
    setNewInterestTopic('');
    setNewInterestLevel(3); // Reset level
  };

  const handleRemoveInterest = (index: number) => {
    setInterests(interests.filter((_, i) => i !== index));
  };

  const handleSaveChanges = async () => {
    setIsLoading(true);
    try {
      console.log("Original interests:", interests);
      
      // Format interests to include addedAt property required by the backend
      const formattedInterests = interests.map(interest => ({
        topic: interest.topic,
        level: interest.level,
        addedAt: new Date() // Provide the required addedAt field
      }));
      
      console.log("Formatted interests to be sent:", formattedInterests);
      
      const response = await updateUserInterests(formattedInterests);
      console.log("Update response:", response);
      
      // Update the local state with the returned interests
      if (Array.isArray(response)) {
        setInterests(response.map(i => ({ topic: i.topic, level: i.level })));
      }
      
      toast.success("Interests updated successfully!");
    } catch (error) {
      console.error("Failed to save interests:", error);
      // Show more detailed error message if available
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      toast.error(`Failed to save changes: ${errorMessage}`);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card className="bg-white shadow-sm">
      <CardHeader>
        <CardTitle className="text-xl font-semibold text-gray-800">Your Interests</CardTitle>
        <CardDescription className="text-gray-600">
          Help the AI understand what topics you care about.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {isFetching ? (
          <p className="text-gray-600">Loading interests...</p>
        ) : (
          <div className="space-y-4">
            {interests.length > 0 ? (
              <ul className="space-y-2">
                {interests.map((interest, index) => (
                  <li key={index} className="flex items-center justify-between p-3 border rounded bg-gray-50 border-gray-200">
                    <span className="text-sm flex-1 mr-2 text-gray-700">
                      {interest.topic}
                      <span className="ml-2 text-xs text-gray-500">(Level: {interest.level})</span>
                    </span>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleRemoveInterest(index)}
                      className="text-red-500 hover:bg-red-100 hover:text-red-600"
                      disabled={isLoading}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-gray-500">No interests added yet.</p>
            )}
          </div>
        )}

        <div className="space-y-4 pt-5 border-t border-gray-200">
          <Label htmlFor="new-interest-topic" className="text-sm font-medium text-gray-700">Add New Interest</Label>
          <div className="flex flex-col sm:flex-row sm:items-center sm:space-x-2 space-y-2 sm:space-y-0">
            <Input
              id="new-interest-topic"
              value={newInterestTopic}
              onChange={(e) => setNewInterestTopic(e.target.value)}
              placeholder="e.g., Artificial Intelligence, Cooking, History"
              className="flex-grow bg-white border-gray-300 focus:border-amber-500 focus:ring-amber-500"
              disabled={isLoading || isFetching}
            />
            <div className="flex items-center space-x-2 w-full sm:w-auto">
               <Slider
                value={[newInterestLevel]}
                onValueChange={(value) => setNewInterestLevel(value[0])}
                min={1}
                max={5}
                step={1}
                className="w-full sm:w-32 [&>span:first-child]:h-2 [&>span:first-child>span]:bg-amber-500 [&>span:last-child]:bg-amber-500 [&>span:last-child]:border-amber-600 [&>span:last-child]:ring-amber-500" // Amber accent slider
                disabled={isLoading || isFetching}
              />
              <span className="text-sm text-gray-600 w-12 text-right">Lvl {newInterestLevel}</span>
               <Button
                onClick={handleAddInterest}
                disabled={isLoading || isFetching || !newInterestTopic.trim()}
                className="bg-amber-600 text-white hover:bg-amber-700 focus:ring-amber-500 px-3 py-2 text-sm"
                >
                  Add
                </Button>
            </div>
          </div>
        </div>
      </CardContent>
      <CardFooter className="border-t border-gray-200 px-6 py-4 bg-gray-50 rounded-b-lg">
        <Button
          onClick={handleSaveChanges}
          disabled={isLoading || isFetching}
          className="bg-blue-600 text-white hover:bg-blue-700 focus:ring-blue-500"
        >
          {isLoading ? "Saving..." : "Save Changes"}
        </Button>
      </CardFooter>
    </Card>
  );
} 