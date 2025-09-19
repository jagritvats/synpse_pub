"use client"

import React, { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { fetchGlobalPrompt, updateGlobalPrompt } from '@/lib/settings-api';

export function GlobalPromptForm() {
  const [prompt, setPrompt] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isFetching, setIsFetching] = useState(true);

  useEffect(() => {
    const loadPrompt = async () => {
      setIsFetching(true);
      try {
        const data = await fetchGlobalPrompt();
        setPrompt(data?.prompt || '');
      } catch (error) {
        console.error("Failed to fetch global prompt:", error);
        toast.error("Failed to load global prompt.");
        setPrompt('');
      } finally {
        setIsFetching(false);
      }
    };
    loadPrompt();
  }, []);

  const handleSaveChanges = async () => {
    setIsLoading(true);
    try {
      await updateGlobalPrompt(prompt);
      toast.success("Global prompt updated successfully!");
    } catch (error) {
      console.error("Failed to save global prompt:", error);
      toast.error("Failed to save changes. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card className="bg-white shadow-sm">
      <CardHeader>
        <CardTitle className="text-xl font-semibold text-gray-800">Global Prompt</CardTitle>
        <CardDescription className="text-gray-600">
          Set a custom instruction or persona for the AI to use in all interactions.
          Leave blank to use the default behavior.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {isFetching ? (
          <p className="text-gray-600">Loading prompt...</p>
        ) : (
          <div className="space-y-2">
            <Label htmlFor="global-prompt" className="text-sm font-medium text-gray-700">Your Global Prompt</Label>
            <Textarea
              id="global-prompt"
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="e.g., Respond in the style of a helpful pirate."
              rows={6}
              className="w-full bg-white border-gray-300 focus:border-amber-500 focus:ring-amber-500"
              disabled={isLoading}
            />
            <p className="text-xs text-gray-500">This prompt is added to the AI's instructions before every response.</p>
          </div>
        )}
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
