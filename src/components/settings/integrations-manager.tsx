'use client';

import React, { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch"; // For enabling/disabling
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { fetchUserIntegrations, updateUserIntegrations } from '@/lib/settings-api';
import { IIntegration } from "@/../server/src/models/user-state.model"; // Adjust path if needed

// TODO: Implement specific icons for platforms
// import { IconBrandNotion, IconBrandGoogleDrive } from '@tabler/icons-react';

export function IntegrationsManager() {
  const [integrations, setIntegrations] = useState<IIntegration[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isFetching, setIsFetching] = useState(true);

  useEffect(() => {
    const loadIntegrations = async () => {
      setIsFetching(true);
      try {
        const fetchedIntegrations = await fetchUserIntegrations();
        setIntegrations(Array.isArray(fetchedIntegrations) ? fetchedIntegrations : []);
      } catch (error) {
        console.error("Failed to fetch integrations:", error);
        toast.error("Failed to load integrations.");
        setIntegrations([]);
      } finally {
        setIsFetching(false);
      }
    };
    loadIntegrations();
  }, []);

  const handleToggleIntegration = (index: number, enabled: boolean) => {
    const updatedIntegrations = [...integrations];
    updatedIntegrations[index].enabled = enabled;
    // Maybe update lastSync or metadata here if needed
    setIntegrations(updatedIntegrations);
  };

  const handleSaveChanges = async () => {
    setIsLoading(true);
    try {
      await updateUserIntegrations(integrations);
      toast.success("Integrations updated successfully!");
    } catch (error) {
      console.error("Failed to save integrations:", error);
      toast.error("Failed to save changes. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  // Placeholder for adding new integrations - complex flow needed
  const handleAddNewIntegration = () => {
    toast.info("Adding new integrations requires platform-specific setup (e.g., OAuth). This feature is not yet implemented.");
    // Example: Add a placeholder or trigger an OAuth flow
  };

  const getPlatformName = (platform: string): string => {
    switch (platform) {
      case 'notion': return 'Notion';
      case 'google_drive': return 'Google Drive';
      default: return platform.charAt(0).toUpperCase() + platform.slice(1);
    }
  }

  return (
    <Card className="bg-white shadow-sm">
      <CardHeader>
        <CardTitle className="text-xl font-semibold text-gray-800">Integrations</CardTitle>
        <CardDescription className="text-gray-600">
          Connect Synapse to other services to enhance its capabilities.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {isFetching ? (
          <p className="text-gray-600">Loading integrations...</p>
        ) : (
          <div className="space-y-4">
            {integrations.length > 0 ? (
              <ul className="space-y-3">
                {integrations.map((integration, index) => (
                  <li key={index} className="flex items-center justify-between p-3 border rounded bg-gray-50 border-gray-200">
                    <div className="flex items-center space-x-3">
                      {/* Placeholder for Icon */}
                      <div className="w-8 h-8 bg-gray-200 rounded flex items-center justify-center text-gray-500 font-medium">
                        {getPlatformName(integration.platform)[0]}
                      </div>
                      <span className="text-sm font-medium text-gray-700">
                        {getPlatformName(integration.platform)}
                        {integration.metadata?.workspaceName && (
                          <span className="text-xs text-gray-500 ml-1">({integration.metadata.workspaceName})</span>
                        )}
                      </span>
                    </div>
                    <div className="flex items-center space-x-2">
                       <Switch
                        id={`integration-switch-${index}`}
                        checked={integration.enabled}
                        onCheckedChange={(checked) => handleToggleIntegration(index, checked)}
                        disabled={isLoading}
                        // Apply amber accent to switch
                        className="[&>span]:bg-amber-500 data-[state=checked]:bg-amber-600"
                       />
                      <Label htmlFor={`integration-switch-${index}`} className="text-sm text-gray-600">
                        {integration.enabled ? 'Enabled' : 'Disabled'}
                      </Label>
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-gray-500">No integrations configured yet.</p>
            )}
          </div>
        )}

        {/* Placeholder for adding new integrations */} 
        {/* <div className="pt-5 border-t border-gray-200">
          <Button 
            variant="outline"
            onClick={handleAddNewIntegration}
            disabled={isLoading || isFetching}
            className="border-amber-500 text-amber-700 hover:bg-amber-50"
          >
            Add New Integration
          </Button>
        </div> */} 
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