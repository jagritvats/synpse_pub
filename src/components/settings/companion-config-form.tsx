'use client';

import React, { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { Trash2, Plus, Info, RefreshCw } from 'lucide-react';
import { 
  fetchGlobalPrompt, 
  updateGlobalPrompt,
  fetchUserDefinedGoals, 
  updateUserDefinedGoals,
  fetchUserInterests,
  updateUserInterests
} from '@/lib/settings-api';
import { IGoal } from "@/../server/src/models/companion-state.model";
import { IUserInterest } from "@/../server/src/models/user-state.model";

// Simplified Goal type for the form state
interface FormGoal {
  goal: string;
  priority: number;
}

// Simplified Interest type for the form state
interface FormInterest {
  topic: string;
  level: number;
  addedAt?: Date;
}

export function CompanionConfigForm() {
  // Global prompt state
  const [prompt, setPrompt] = useState('');
  const [isPromptLoading, setIsPromptLoading] = useState(false);
  const [isPromptFetching, setIsPromptFetching] = useState(true);
  const [promptError, setPromptError] = useState<string | null>(null);

  // User goals state
  const [goals, setGoals] = useState<FormGoal[]>([]);
  const [newGoal, setNewGoal] = useState('');
  const [newPriority, setNewPriority] = useState<number>(5); // Default priority
  const [isGoalsLoading, setIsGoalsLoading] = useState(false);
  const [isGoalsFetching, setIsGoalsFetching] = useState(true);
  const [goalsError, setGoalsError] = useState<string | null>(null);
  
  // User interests state
  const [interests, setInterests] = useState<FormInterest[]>([]);
  const [newInterest, setNewInterest] = useState('');
  const [newLevel, setNewLevel] = useState<number>(3); // Default level
  const [isInterestsLoading, setIsInterestsLoading] = useState(false);
  const [isInterestsFetching, setIsInterestsFetching] = useState(true);
  const [interestsError, setInterestsError] = useState<string | null>(null);

  // Load global prompt
  const loadPrompt = async () => {
    setIsPromptFetching(true);
    setPromptError(null);
    try {
      const data = await fetchGlobalPrompt();
      setPrompt(data?.prompt || '');
    } catch (error) {
      console.error("Failed to fetch global prompt:", error);
      setPromptError("Failed to load global prompt. The server may be unavailable.");
      toast.error("Failed to load global prompt.");
      setPrompt('');
    } finally {
      setIsPromptFetching(false);
    }
  };

  // Load user goals
  const fetchGoals = async () => {
    setIsGoalsFetching(true);
    setGoalsError(null);
    try {
      const existingGoals: IGoal[] = await fetchUserDefinedGoals();
      setGoals(existingGoals.map(g => ({ goal: g.goal, priority: g.priority })) || []); 
    } catch (error) {
      console.error("Failed to fetch user defined goals:", error);
      setGoalsError("Failed to load goals. The companion state API may be unavailable.");
      toast.error("Failed to load your defined goals.");
      setGoals([]);
    } finally {
      setIsGoalsFetching(false);
    }
  };
  
  // Load user interests
  const fetchInterests = async () => {
    setIsInterestsFetching(true);
    setInterestsError(null);
    try {
      const existingInterests: IUserInterest[] = await fetchUserInterests();
      setInterests(existingInterests.map(i => ({ 
        topic: i.topic, 
        level: i.level,
        addedAt: i.addedAt 
      })) || []);
    } catch (error) {
      console.error("Failed to fetch user interests:", error);
      setInterestsError("Failed to load interests. The user state API may be unavailable.");
      toast.error("Failed to load your interests.");
      setInterests([]);
    } finally {
      setIsInterestsFetching(false);
    }
  };

  // Initial data loading
  useEffect(() => {
    loadPrompt();
    fetchGoals();
    fetchInterests();
  }, []);

  // Handle global prompt save
  const handleSavePrompt = async () => {
    setIsPromptLoading(true);
    try {
      await updateGlobalPrompt(prompt);
      toast.success("Global prompt updated successfully!");
    } catch (error) {
      console.error("Failed to save global prompt:", error);
      toast.error("Failed to save changes. Please try again.");
    } finally {
      setIsPromptLoading(false);
    }
  };

  // Handle goals functions
  const handleAddGoal = () => {
    if (!newGoal.trim() || newPriority < 1 || newPriority > 10) {
      toast.warning("Please enter a valid goal description and priority (1-10).");
      return;
    }
    setGoals([...goals, { goal: newGoal.trim(), priority: newPriority }]);
    setNewGoal('');
    setNewPriority(5); // Reset priority
  };

  const handleRemoveGoal = (index: number) => {
    setGoals(goals.filter((_, i) => i !== index));
  };

  const handleSaveGoals = async () => {
    setIsGoalsLoading(true);
    try {
      await updateUserDefinedGoals(goals as IGoal[]);
      toast.success("User-defined goals updated successfully!");
    } catch (error) {
      console.error("Failed to save user defined goals:", error);
      toast.error("Failed to save changes. Please try again.");
    } finally {
      setIsGoalsLoading(false);
    }
  };
  
  // Handle interests functions
  const handleAddInterest = () => {
    if (!newInterest.trim() || newLevel < 1 || newLevel > 5) {
      toast.warning("Please enter a valid interest topic and level (1-5).");
      return;
    }
    setInterests([...interests, { 
      topic: newInterest.trim(), 
      level: newLevel,
      addedAt: new Date()
    }]);
    setNewInterest('');
    setNewLevel(3); // Reset level
  };

  const handleRemoveInterest = (index: number) => {
    setInterests(interests.filter((_, i) => i !== index));
  };

  const handleSaveInterests = async () => {
    setIsInterestsLoading(true);
    try {
      // Convert to IUserInterest format
      const interestsToSave = interests.map(i => ({
        ...i,
        addedAt: i.addedAt || new Date()
      }));
      await updateUserInterests(interestsToSave as IUserInterest[]);
      toast.success("User interests updated successfully!");
    } catch (error) {
      console.error("Failed to save user interests:", error);
      toast.error("Failed to save changes. Please try again.");
    } finally {
      setIsInterestsLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Global Prompt Section */}
      <Card className="bg-white shadow-sm">
        <CardHeader>
          <CardTitle className="text-xl font-semibold text-gray-800">Global Prompt</CardTitle>
          <CardDescription className="text-gray-600">
            Set a custom instruction or persona for the AI to use in all interactions
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isPromptFetching ? (
            <p className="text-gray-600">Loading prompt...</p>
          ) : (
            <div className="space-y-4">
              {promptError && (
                <div className="p-3 rounded border border-amber-200 bg-amber-50 text-amber-800 mb-4 flex justify-between items-center">
                  <p className="text-sm">{promptError}</p>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    className="flex items-center gap-2 ml-2" 
                    onClick={loadPrompt}
                  >
                    <RefreshCw className="h-4 w-4" /> Retry
                  </Button>
                </div>
              )}
              
              <div className="space-y-2">
                <Label htmlFor="global-prompt" className="text-sm font-medium text-gray-700">Your Global Prompt</Label>
                <Textarea
                  id="global-prompt"
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  placeholder="e.g., Respond in the style of a helpful pirate."
                  rows={6}
                  className="w-full bg-white border-gray-300 focus:border-amber-500 focus:ring-amber-500"
                  disabled={isPromptLoading}
                />
                <p className="text-xs text-gray-500">This prompt is added to the AI's instructions before every response.</p>
              </div>
            </div>
          )}
        </CardContent>
        <CardFooter className="border-t border-gray-200 px-6 py-4 bg-gray-50">
          <Button
            onClick={handleSavePrompt}
            disabled={isPromptLoading || isPromptFetching}
            className="bg-blue-600 text-white hover:bg-blue-700 focus:ring-blue-500"
          >
            {isPromptLoading ? "Saving..." : "Save Global Prompt"}
          </Button>
        </CardFooter>
      </Card>

      {/* User-Defined Goals Section */}
      <Card className="bg-white shadow-sm">
        <CardHeader>
          <CardTitle className="text-xl font-semibold text-gray-800">User-Defined Goals</CardTitle>
          <CardDescription className="text-gray-600">
            Set specific goals for your AI companion to focus on
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {isGoalsFetching ? (
            <p className="text-gray-600">Loading goals...</p>
          ) : (
            <div className="space-y-4">
              {goalsError && (
                <div className="p-3 rounded border border-amber-200 bg-amber-50 text-amber-800 mb-4 flex justify-between items-center">
                  <p className="text-sm">{goalsError}</p>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    className="flex items-center gap-2 ml-2" 
                    onClick={fetchGoals}
                  >
                    <RefreshCw className="h-4 w-4" /> Retry
                  </Button>
                </div>
              )}
              
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
                        disabled={isGoalsLoading}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-gray-500">No user-defined goals set yet.</p>
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
                    disabled={isGoalsLoading}
                  />
                  <Input
                    type="number"
                    min="1"
                    max="10"
                    value={newPriority}
                    onChange={(e) => setNewPriority(parseInt(e.target.value, 10))}
                    className="w-20 bg-white border-gray-300 focus:border-amber-500 focus:ring-amber-500"
                    disabled={isGoalsLoading}
                    title="Priority (1-10)"
                  />
                  <Button 
                    onClick={handleAddGoal} 
                    disabled={isGoalsLoading || !newGoal.trim()}
                    className="bg-amber-600 text-white hover:bg-amber-700 focus:ring-amber-500"
                  >
                    <Plus className="h-4 w-4 mr-1" /> Add
                  </Button>
                </div>
                <p className="text-xs text-gray-500 flex items-center">
                  <Info className="h-3 w-3 mr-1 text-amber-500" /> Priority scale: 1 (lowest) to 10 (highest)
                </p>
              </div>
            </div>
          )}
        </CardContent>
        <CardFooter className="border-t border-gray-200 px-6 py-4 bg-gray-50">
          <Button 
            onClick={handleSaveGoals} 
            disabled={isGoalsLoading || isGoalsFetching}
            className="bg-blue-600 text-white hover:bg-blue-700 focus:ring-blue-500"
          >
            {isGoalsLoading ? "Saving..." : "Save Goals"}
          </Button>
        </CardFooter>
      </Card>
      
      {/* User Interests Section */}
      <Card className="bg-white shadow-sm">
        <CardHeader>
          <CardTitle className="text-xl font-semibold text-gray-800">User Interests</CardTitle>
          <CardDescription className="text-gray-600">
            Define your interests to help the AI understand you better
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {isInterestsFetching ? (
            <p className="text-gray-600">Loading interests...</p>
          ) : (
            <div className="space-y-4">
              {interestsError && (
                <div className="p-3 rounded border border-amber-200 bg-amber-50 text-amber-800 mb-4 flex justify-between items-center">
                  <p className="text-sm">{interestsError}</p>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    className="flex items-center gap-2 ml-2" 
                    onClick={fetchInterests}
                  >
                    <RefreshCw className="h-4 w-4" /> Retry
                  </Button>
                </div>
              )}
              
              {interests.length > 0 ? (
                <ul className="space-y-2">
                  {interests.map((interest, index) => (
                    <li key={index} className="flex items-center justify-between p-3 border rounded bg-gray-50 border-gray-200">
                      <div className="flex items-center">
                        <div className="flex-1 mr-2">
                          <div className="text-sm font-medium text-gray-700">{interest.topic}</div>
                          <div className="mt-1 h-1.5 w-24 bg-gray-200 rounded-full overflow-hidden">
                            <div 
                              className="h-full bg-amber-500" 
                              style={{ width: `${(interest.level / 5) * 100}%` }}
                            ></div>
                          </div>
                        </div>
                        <span className="text-xs text-gray-500">Level: {interest.level}/5</span>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleRemoveInterest(index)}
                        className="text-red-500 hover:bg-red-100 hover:text-red-600"
                        disabled={isInterestsLoading}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-gray-500">No interests defined yet.</p>
              )}
              
              <div className="space-y-3 pt-5 border-t border-gray-200">
                <Label htmlFor="new-interest" className="text-sm font-medium text-gray-700">Add New Interest</Label>
                <div className="flex items-center space-x-2">
                  <Input
                    id="new-interest"
                    value={newInterest}
                    onChange={(e) => setNewInterest(e.target.value)}
                    placeholder="e.g., Machine Learning"
                    className="flex-grow bg-white border-gray-300 focus:border-amber-500 focus:ring-amber-500"
                    disabled={isInterestsLoading}
                  />
                  <Input
                    type="number"
                    min="1"
                    max="5"
                    value={newLevel}
                    onChange={(e) => setNewLevel(parseInt(e.target.value, 10))}
                    className="w-20 bg-white border-gray-300 focus:border-amber-500 focus:ring-amber-500"
                    disabled={isInterestsLoading}
                    title="Interest Level (1-5)"
                  />
                  <Button 
                    onClick={handleAddInterest} 
                    disabled={isInterestsLoading || !newInterest.trim()}
                    className="bg-amber-600 text-white hover:bg-amber-700 focus:ring-amber-500"
                  >
                    <Plus className="h-4 w-4 mr-1" /> Add
                  </Button>
                </div>
                <p className="text-xs text-gray-500 flex items-center">
                  <Info className="h-3 w-3 mr-1 text-amber-500" /> Interest level: 1 (casual) to 5 (expert/passionate)
                </p>
              </div>
            </div>
          )}
        </CardContent>
        <CardFooter className="border-t border-gray-200 px-6 py-4 bg-gray-50">
          <Button 
            onClick={handleSaveInterests} 
            disabled={isInterestsLoading || isInterestsFetching}
            className="bg-blue-600 text-white hover:bg-blue-700 focus:ring-blue-500"
          >
            {isInterestsLoading ? "Saving..." : "Save Interests"}
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
} 