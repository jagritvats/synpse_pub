'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { fetchAIInterests } from '@/lib/settings-api'; // Import API function

interface AIInterest {
  topic: string;
  level: number;
}

export function AIInterestsView() {
  const [interests, setInterests] = useState<AIInterest[]>([]);
  const [isFetching, setIsFetching] = useState(true);

  useEffect(() => {
    const loadInterests = async () => {
      setIsFetching(true);
      try {
        const fetchedInterests = await fetchAIInterests();
        // Ensure fetched data is an array
        setInterests(Array.isArray(fetchedInterests) ? fetchedInterests : []);
      } catch (error) {
        console.error("Failed to fetch AI interests:", error);
        toast.error("Failed to load AI interests.");
        setInterests([]); // Clear on error
      } finally {
        setIsFetching(false);
      }
    };
    loadInterests();
  }, []);

  return (
    <Card className="bg-white shadow-sm">
      <CardHeader>
        <CardTitle className="text-xl font-semibold text-gray-800">Companion's Internal Interests</CardTitle>
        <CardDescription className="text-gray-600">
          Topics the AI companion is currently interested in exploring.
          This internal state is read-only.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {isFetching ? (
          <p className="text-gray-600">Loading AI interests...</p>
        ) : interests.length > 0 ? (
          <ul className="space-y-2">
            {interests.map((interest, index) => (
              <li key={index} className="flex items-center justify-between p-3 border rounded bg-gray-50 border-gray-200">
                <span className="text-sm flex-1 mr-2 text-gray-700">
                  {interest.topic}
                </span>
                <span className="text-xs text-gray-600 font-medium bg-gray-200 px-2 py-1 rounded">
                  Level: {interest.level}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-gray-500">No AI interests found or unable to load.</p>
        )}
      </CardContent>
    </Card>
  );
} 