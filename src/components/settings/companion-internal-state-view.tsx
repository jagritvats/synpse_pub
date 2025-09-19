'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { RefreshCw } from 'lucide-react';
import { fetchAIInterests, fetchAIGoals } from '@/lib/settings-api';

// AI interest type from backend
interface AIInterest {
  topic: string;
  level: number;
}

// AI goal type from backend
interface AIGoal {
  goal: string;
  priority: number;
  progress?: number;
}

export function InterestsAndCompanionView() {
  // AI interests state
  const [interests, setInterests] = useState<AIInterest[]>([]);
  const [isInterestsFetching, setIsInterestsFetching] = useState(true);
  const [interestsError, setInterestsError] = useState<string | null>(null);
  
  // AI goals state
  const [goals, setGoals] = useState<AIGoal[]>([]);
  const [isGoalsFetching, setIsGoalsFetching] = useState(true);
  const [goalsError, setGoalsError] = useState<string | null>(null);
  
  // Default tab
  const [activeTab, setActiveTab] = useState("companion-interests");

  // Load AI interests
  const loadInterests = async () => {
    setIsInterestsFetching(true);
    setInterestsError(null);
    try {
      const fetchedInterests = await fetchAIInterests();
      setInterests(Array.isArray(fetchedInterests) ? fetchedInterests : []);
    } catch (error) {
      console.error("Failed to fetch AI interests:", error);
      setInterestsError("Failed to load AI interests. The companion state API may be unavailable.");
      toast.error("Failed to load AI interests.");
      setInterests([]);
    } finally {
      setIsInterestsFetching(false);
    }
  };

  // Load AI goals
  const loadGoals = async () => {
    setIsGoalsFetching(true);
    setGoalsError(null);
    try {
      const fetchedGoals = await fetchAIGoals();
      setGoals(Array.isArray(fetchedGoals) ? fetchedGoals : []);
    } catch (error) {
      console.error("Failed to fetch AI goals:", error);
      setGoalsError("Failed to load AI goals. The companion state API may be unavailable.");
      toast.error("Failed to load AI goals.");
      setGoals([]);
    } finally {
      setIsGoalsFetching(false);
    }
  };

  // Initial data loading
  useEffect(() => {
    loadInterests();
    loadGoals();
  }, []);

  return (
    <Card className="bg-white shadow-sm">
      <CardHeader>
        <CardTitle className="text-xl font-semibold text-gray-800">Companion Internal State</CardTitle>
        <CardDescription className="text-gray-600">
          View your AI companion's internal state to understand how it adapts to your needs.
        </CardDescription>
      </CardHeader>
      
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-2 mb-4 bg-amber-50">
          <TabsTrigger value="companion-interests" className="data-[state=active]:bg-amber-100 data-[state=active]:text-amber-800">
            Companion Interests
          </TabsTrigger>
          <TabsTrigger value="companion-goals" className="data-[state=active]:bg-amber-100 data-[state=active]:text-amber-800">
            Companion Goals
          </TabsTrigger>
        </TabsList>
        
        <TabsContent value="companion-interests">
          <CardContent>
            {isInterestsFetching ? (
              <p className="text-gray-600">Loading AI interests...</p>
            ) : (
              <div className="space-y-4">
                {interestsError && (
                  <div className="p-3 rounded border border-amber-200 bg-amber-50 text-amber-800 mb-4 flex justify-between items-center">
                    <p className="text-sm">{interestsError}</p>
                    <Button 
                      variant="outline" 
                      size="sm" 
                      className="flex items-center gap-2 ml-2" 
                      onClick={loadInterests}
                    >
                      <RefreshCw className="h-4 w-4" /> Retry
                    </Button>
                  </div>
                )}
                
                {interests.length > 0 ? (
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
                <p className="text-xs text-gray-500 mt-4">
                  These are topics your AI companion is interested in learning more about
                  to provide better assistance and more engaging conversations.
                </p>
              </div>
            )}
          </CardContent>
        </TabsContent>
        
        <TabsContent value="companion-goals">
          <CardContent>
            {isGoalsFetching ? (
              <p className="text-gray-600">Loading AI goals...</p>
            ) : (
              <div className="space-y-4">
                {goalsError && (
                  <div className="p-3 rounded border border-amber-200 bg-amber-50 text-amber-800 mb-4 flex justify-between items-center">
                    <p className="text-sm">{goalsError}</p>
                    <Button 
                      variant="outline" 
                      size="sm" 
                      className="flex items-center gap-2 ml-2" 
                      onClick={loadGoals}
                    >
                      <RefreshCw className="h-4 w-4" /> Retry
                    </Button>
                  </div>
                )}
                
                {goals.length > 0 ? (
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
                <p className="text-xs text-gray-500 mt-4">
                  These are internal goals your AI companion has formed to better assist you.
                  They evolve based on your interactions.
                </p>
              </div>
            )}
          </CardContent>
        </TabsContent>
      </Tabs>
    </Card>
  );
} 