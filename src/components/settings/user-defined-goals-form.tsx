'use client';

import React, { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { Trash2 } from 'lucide-react';
// Import actual API functions
import { fetchUserDefinedGoals, updateUserDefinedGoals } from '@/lib/settings-api'; 
import { IUserGoal } from "@/../server/src/models/user-state.model"; // Use the user-state model

// Simplified Goal type for the form state
interface FormGoal {
  goal: string;
  priority: number;
}

// No longer needs userId prop
export function UserDefinedGoalsForm() {
  const [goals, setGoals] = useState<FormGoal[]>([]);
  const [newGoal, setNewGoal] = useState('');
  const [newPriority, setNewPriority] = useState<number>(5); // Default priority
  const [isLoading, setIsLoading] = useState(false);
  const [isFetching, setIsFetching] = useState(true);

  useEffect(() => {
    const fetchGoals = async () => {
      setIsFetching(true);
      try {
        // Use actual API call
        const existingGoals: IUserGoal[] = await fetchUserDefinedGoals();
        // Map IUserGoal to FormGoal
        setGoals(existingGoals.map(g => ({ goal: g.goal, priority: g.priority })) || []); 
      } catch (error) {
        console.error("Failed to fetch user defined goals:", error);
        toast.error("Failed to load your defined goals.");
        setGoals([]); // Clear goals on error
      } finally {
        setIsFetching(false);
      }
    };
    fetchGoals(); // Fetch on mount
  }, []); // Empty dependency array to run only once

  const handleAddGoal = () => {
    if (!newGoal.trim() || newPriority < 1 || newPriority > 10) {
      toast.warning("Please enter a valid goal description and priority (1-10).");
      return;
    }
    // Add goal locally for immediate UI update
    setGoals([...goals, { goal: newGoal.trim(), priority: newPriority }]);
    setNewGoal('');
    setNewPriority(5); // Reset priority
  };

  const handleRemoveGoal = (index: number) => {
    setGoals(goals.filter((_, i) => i !== index));
  };

  const handleSaveChanges = async () => {
    setIsLoading(true);
    try {
      // Format goals to include createdAt property required by the backend
      const formattedGoals = goals.map(goal => ({
        goal: goal.goal,
        priority: goal.priority,
        createdAt: new Date(), // Required by the model
        progress: 0 // Default progress value
      }));
      
      await updateUserDefinedGoals(formattedGoals);
      toast.success("User-defined goals updated successfully!");
    } catch (error) {
      console.error("Failed to save user defined goals:", error);
      toast.error("Failed to save changes. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card className="bg-white shadow-sm">
      <CardHeader>
        <CardTitle className="text-xl font-semibold text-gray-800">User-Defined Goals</CardTitle>
        <CardDescription className="text-gray-600">
          Set specific goals for your AI companion to focus on.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {isFetching ? (
          <p className="text-gray-600">Loading goals...</p>
        ) : (
          <div className="space-y-4">
            {goals.length > 0 ? (
              <ul className="space-y-2">
                {goals.map((goal, index) => (
                  <li key={index} className="flex items-center justify-between p-3 border rounded bg-gray-50 border-gray-200">
                    <span className="text-sm flex-1 mr-2 text-gray-700">
                      <span className="font-medium text-amber-700">[{goal.priority}]</span> {goal.goal}
                    </span>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleRemoveGoal(index)}
                      className="text-red-500 hover:bg-red-100 hover:text-red-600"
                      disabled={isLoading}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-gray-500">No user-defined goals set yet.</p>
            )}
          </div>
        )}

        <div className="space-y-3 pt-5 border-t border-gray-200">
          <Label htmlFor="new-goal" className="text-sm font-medium text-gray-700">Add New Goal</Label>
          <div className="flex items-center space-x-2">
             <Input
              id="new-goal"
              value={newGoal}
              onChange={(e) => setNewGoal(e.target.value)}
              placeholder="e.g., Help me practice Spanish daily"
              className="flex-grow bg-white border-gray-300 focus:border-amber-500 focus:ring-amber-500"
              disabled={isLoading || isFetching}
            />
            <Input
              type="number"
              min="1"
              max="10"
              value={newPriority}
              onChange={(e) => setNewPriority(parseInt(e.target.value, 10))}
              className="w-20 bg-white border-gray-300 focus:border-amber-500 focus:ring-amber-500"
              disabled={isLoading || isFetching}
              title="Priority (1-10)"
            />
            <Button 
              onClick={handleAddGoal} 
              disabled={isLoading || isFetching || !newGoal.trim()}
              className="bg-amber-600 text-white hover:bg-amber-700 focus:ring-amber-500"
            >
              Add
            </Button>
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