'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";
import { fetchAIGoals } from '@/lib/settings-api'; // Import API function

// Matches the structure returned by the backend
interface AIGoal {
  goal: string;
  priority: number;
  progress?: number; // Optional progress
}

export function AIGoalsView() {
  const [goals, setGoals] = useState<AIGoal[]>([]);
  const [isFetching, setIsFetching] = useState(true);

  useEffect(() => {
    const loadGoals = async () => {
      setIsFetching(true);
      try {
        const fetchedGoals = await fetchAIGoals();
        // Ensure fetched data is an array
        setGoals(Array.isArray(fetchedGoals) ? fetchedGoals : []);
      } catch (error) {
        console.error("Failed to fetch AI goals:", error);
        toast.error("Failed to load AI goals.");
        setGoals([]); // Clear on error
      } finally {
        setIsFetching(false);
      }
    };
    loadGoals();
  }, []);

  return (
    <Card className="bg-white shadow-sm">
      <CardHeader>
        <CardTitle className="text-xl font-semibold text-gray-800">Companion's Internal Goals</CardTitle>
        <CardDescription className="text-gray-600">
          Internal goals the AI companion is currently working towards.
          This internal state is read-only.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {isFetching ? (
          <p className="text-gray-600">Loading AI goals...</p>
        ) : goals.length > 0 ? (
          <ul className="space-y-4">
            {goals.map((goal, index) => (
              <li key={index} className="p-3 border rounded bg-gray-50 border-gray-200">
                <div className="flex justify-between items-start mb-2">
                  <span className="text-sm font-medium flex-1 mr-2 text-gray-700">
                    {goal.goal}
                  </span>
                  <span className="text-xs text-amber-700 font-semibold bg-amber-100 px-2 py-1 rounded">
                    Priority: {goal.priority}
                  </span>
                </div>
                {goal.progress !== undefined && (
                  <div className="flex items-center space-x-2">
                    <Progress value={goal.progress} className="w-full h-2 bg-gray-200 [&>div]:bg-amber-500" />
                    <span className="text-xs text-gray-500">{goal.progress}%</span>
                  </div>
                )}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-gray-500">No AI goals found or unable to load.</p>
        )}
      </CardContent>
    </Card>
  );
} 