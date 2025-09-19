"use client"

import React, { useState, useEffect, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Switch } from "@/components/ui/switch"
import { AlertCircle, Loader2, CheckCircle2 } from "lucide-react"
import { toast } from "sonner"
import { fetchUserIntegrations, updateUserIntegrations } from "@/lib/integrations-api"
import { testNotionConnection, updateNotionSettings, getNotionSettings, getUserNotionPages } from "@/lib/integrations-api"
import { IIntegration } from "@/../server/src/models/user-state.model" // Adjust path if needed

// Define known integration types for UI rendering
// In a real app, this might come from a configuration or discovery mechanism
const KNOWN_INTEGRATIONS = [
  { 
    platform: "notion", 
    name: "Notion", 
    description: "Connect Synapse to your Notion workspace to access and update your notes.",
    fields: [
      { key: "token", label: "Notion API Token", type: "password" },
      { key: "pageId", label: "Root Page ID (Optional)", type: "text", required: false }
    ]
  },
  { 
    platform: "twitter", 
    name: "Twitter / X", 
    description: "Connect Synapse to your Twitter account to monitor and analyze your social media presence.",
    fields: [
      { key: "token", label: "Twitter API Token", type: "password" },
      // Add other relevant fields like consumer key/secret if needed
    ]
  },
  // Add more known integrations here
]

export function IntegrationsForm() {
  // Store integrations as an array, matching the backend model
  const [integrations, setIntegrations] = useState<IIntegration[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [notionTestStatus, setNotionTestStatus] = useState<{
    status: 'idle' | 'testing' | 'success' | 'error';
    message?: string;
    workspaceName?: string;
  }>({ status: 'idle' })
  const [notionPages, setNotionPages] = useState<Array<{id: string, title: string}>>([])

  const fetchIntegrations = useCallback(async () => {
    setIsLoading(true)
    try {
      let existingIntegrations = await fetchUserIntegrations()
      
      // For Notion, attempt to get better information from specific endpoint
      let notionIntegration = existingIntegrations.find(i => i.platform === "notion")
      
      try {
        const notionSettings = await getNotionSettings()
        if (notionSettings.configured && notionSettings.integration) {
          // Update with more complete Notion info
          if (notionIntegration) {
            // Update existing integration with more accurate data
            notionIntegration = {
              ...notionIntegration,
              enabled: notionSettings.integration.enabled,
              metadata: notionSettings.integration.metadata,
              lastSync: notionSettings.integration.lastSync ? new Date(notionSettings.integration.lastSync) : new Date()
            }

            // Update in the array
            existingIntegrations = existingIntegrations.map(integration => 
              integration.platform === "notion" ? notionIntegration! : integration
            )
          } else {
            // Create new Notion integration
            notionIntegration = {
              platform: "notion",
              enabled: notionSettings.integration.enabled,
              metadata: notionSettings.integration.metadata,
              lastSync: notionSettings.integration.lastSync ? new Date(notionSettings.integration.lastSync) : new Date(),
              credentials: {} // We don't get credentials back for security
            }
            existingIntegrations.push(notionIntegration)
          }
          
          // Try to fetch Notion pages if integration is enabled
          if (notionIntegration?.enabled) {
            getUserNotionPages().then(result => {
              if (result.success && result.pages) {
                setNotionPages(result.pages)
              }
            }).catch(err => {
              console.error("Failed to fetch Notion pages:", err)
            })
          }
        }
      } catch (error) {
        console.error("Failed to fetch Notion settings:", error)
        // Continue with regular integrations
      }
      
      // Ensure all KNOWN_INTEGRATIONS are represented in the state, even if not configured yet
      const initializedIntegrations = KNOWN_INTEGRATIONS.map(known => {
        const existing = existingIntegrations.find(i => i.platform === known.platform)
        return existing || { 
          platform: known.platform, 
          enabled: false, 
          credentials: {}, 
          lastSync: undefined  // Use undefined instead of null
        }
      })
      setIntegrations(initializedIntegrations as IIntegration[])
    } catch (error: any) {
      console.error("Failed to fetch integrations:", error)
      toast.error("Failed to load integrations.", { description: error.message })
      // Initialize with defaults on error?
      setIntegrations(KNOWN_INTEGRATIONS.map(known => ({ 
        platform: known.platform, 
        enabled: false, 
        credentials: {}, 
        lastSync: undefined  // Use undefined instead of null
      })) as IIntegration[])
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchIntegrations()
  }, [fetchIntegrations])

  const handleInputChange = (platform: string, field: string, value: string) => {
    setIntegrations((prev) =>
      prev.map((integration) =>
        integration.platform === platform
          ? { ...integration, credentials: { ...(integration.credentials || {}), [field]: value } }
          : integration
      )
    )
  }
  
  const handleToggleEnabled = (platform: string, checked: boolean) => {
    setIntegrations((prev) =>
      prev.map((integration) =>
        integration.platform === platform
          ? { ...integration, enabled: checked }
          : integration
      )
    )
  }
  
  const handleTestNotion = async () => {
    const notionIntegration = integrations.find(i => i.platform === "notion")
    if (!notionIntegration?.credentials?.token) {
      toast.error("Please enter a Notion API token first.")
      return
    }
    
    setNotionTestStatus({ status: 'testing' })
    
    try {
      const result = await testNotionConnection({
        token: notionIntegration.credentials.token,
        pageId: notionIntegration.credentials.pageId
      })
      
      if (result.success) {
        setNotionTestStatus({ 
          status: 'success', 
          message: result.message,
          workspaceName: result.workspaceName
        })
      } else {
        setNotionTestStatus({ 
          status: 'error', 
          message: result.message 
        })
      }
    } catch (error: any) {
      setNotionTestStatus({ 
        status: 'error', 
        message: error.message || "Failed to test Notion connection" 
      })
    }
  }

  const handleSave = async () => {
    setIsSaving(true)
    try {
      // For Notion, use the dedicated endpoint
      const notionIntegration = integrations.find(i => i.platform === "notion")
      if (notionIntegration && notionIntegration.credentials?.token) {
        try {
          await updateNotionSettings({
            token: notionIntegration.credentials.token,
            pageId: notionIntegration.credentials.pageId,
            enabled: notionIntegration.enabled
          })
          toast.success("Notion integration saved successfully!")
        } catch (error: any) {
          console.error("Failed to save Notion settings:", error)
          toast.error("Failed to save Notion integration.", { description: error.message })
        }
      }
      
      // Save all integrations via the general endpoint
      await updateUserIntegrations(integrations)
      toast.success("All integrations saved successfully!")
      
      // Refresh integrations to get updated metadata
      fetchIntegrations()
    } catch (error: any) {
      console.error("Failed to save integrations:", error)
      toast.error("Failed to save some integrations.", { description: error.message })
    } finally {
      setIsSaving(false)
    }
  }

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Integrations</CardTitle>
          <CardDescription>Connect Synapse to other services.</CardDescription>
        </CardHeader>
        <CardContent className="flex justify-center py-8">
          <Loader2 className="h-8 w-8 animate-spin text-amber-500" />
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      {integrations.map((integration) => {
        const config = KNOWN_INTEGRATIONS.find(k => k.platform === integration.platform)
        if (!config) return null // Don't render unknown integrations
        
        const isNotion = integration.platform === "notion"
        
        return (
          <Card key={integration.platform} className="dark:bg-gray-800 dark:border-gray-700">
            <CardHeader>
              <div className="flex justify-between items-center">
                <div>
                  <CardTitle className="dark:text-gray-100">{config.name}</CardTitle>
                  <CardDescription className="dark:text-gray-400">{config.description}</CardDescription>
                </div>
                <Switch 
                  checked={integration.enabled}
                  onCheckedChange={(checked) => handleToggleEnabled(integration.platform, checked)}
                  disabled={isSaving}
                  aria-label={`Enable ${config.name} integration`}
                />
              </div>
            </CardHeader>
            <CardContent className={`space-y-4 ${!integration.enabled ? 'opacity-50 pointer-events-none' : ''}`}>
              {/* Integration-specific status */}
              {isNotion && integration.metadata?.workspaceName && (
                <div className="bg-blue-50 dark:bg-blue-900/20 p-3 rounded-md">
                  <p className="text-sm text-blue-800 dark:text-blue-300">
                    Connected to workspace: <strong>{integration.metadata.workspaceName}</strong>
                  </p>
                  {notionPages.length > 0 && (
                    <div className="mt-1">
                      <p className="text-xs text-blue-700 dark:text-blue-400">Available pages:</p>
                      <ul className="text-xs text-blue-600 dark:text-blue-500 mt-1 ml-3">
                        {notionPages.slice(0, 3).map(page => (
                          <li key={page.id}>{page.title}</li>
                        ))}
                        {notionPages.length > 3 && <li>+ {notionPages.length - 3} more</li>}
                      </ul>
                    </div>
                  )}
                </div>
              )}
              
              {config.fields.map(field => (
                <div key={field.key} className="space-y-2">
                  <Label htmlFor={`${integration.platform}-${field.key}`} className="dark:text-gray-300">
                    {field.label}
                    {field.required !== false && <span className="text-red-500">*</span>}
                  </Label>
                  <Input
                    id={`${integration.platform}-${field.key}`}
                    type={field.type}
                    value={(integration.credentials as Record<string, any>)?.[field.key] || ""}
                    onChange={(e) => handleInputChange(integration.platform, field.key, e.target.value)}
                    placeholder={`Enter ${field.label}`}
                    disabled={isSaving || !integration.enabled}
                    className="dark:bg-gray-700 dark:border-gray-600 dark:text-gray-200"
                  />
                </div>
              ))}
              
              {/* Notion-specific test button */}
              {isNotion && (
                <div className="mt-4">
                  <Button 
                    type="button" 
                    variant="outline" 
                    onClick={handleTestNotion}
                    disabled={!integration.credentials?.token || notionTestStatus.status === 'testing'}
                    className="w-full bg-gray-100 dark:bg-gray-700 dark:text-white"
                  >
                    {notionTestStatus.status === 'testing' ? (
                      <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Testing Connection...</>
                    ) : (
                      'Test Connection'
                    )}
                  </Button>
                  
                  {notionTestStatus.status === 'success' && (
                    <div className="mt-2 flex items-start text-sm text-green-600 dark:text-green-400">
                      <CheckCircle2 className="h-4 w-4 mr-1 mt-0.5" />
                      <div>
                        <p>{notionTestStatus.message}</p>
                        {notionTestStatus.workspaceName && (
                          <p className="mt-1">Workspace: {notionTestStatus.workspaceName}</p>
                        )}
                      </div>
                    </div>
                  )}
                  
                  {notionTestStatus.status === 'error' && (
                    <div className="mt-2 flex items-start text-sm text-red-600 dark:text-red-400">
                      <AlertCircle className="h-4 w-4 mr-1 mt-0.5" />
                      <p>{notionTestStatus.message}</p>
                    </div>
                  )}
                </div>
              )}
              
              {integration.lastSync && (
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  Last sync: {new Date(integration.lastSync).toLocaleString()}
                </p>
              )}
            </CardContent>
          </Card>
        )
      })}
     
      <div className="pt-4 border-t dark:border-gray-700">
        <Button onClick={handleSave} disabled={isSaving || isLoading} className="dark:bg-blue-600 dark:text-white dark:hover:bg-blue-700">
          {isSaving ? (
            <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Saving...</>
          ) : (
            "Save Integrations"
          )}
        </Button>
      </div>
    </div>
  )
}
