"use client"

import React, { useState, useEffect, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Switch } from "@/components/ui/switch"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { AlertCircle, CheckCircle, Loader2, RefreshCw, Check, X, Plus, Trash2 } from "lucide-react"
import { toast } from "sonner"
import { Badge } from "@/components/ui/badge"
import { fetchUserIntegrations, updateUserIntegrations, fetchIntegration, updateIntegration, testNotionConnection, getNotionPages } from "@/lib/integrations-api"
import { IIntegration } from "@/../server/src/models/user-state.model" // Adjust path if needed

// Define known integration types for UI rendering
const KNOWN_INTEGRATIONS = [
  { 
    platform: "notion", 
    name: "Notion", 
    description: "Connect Synapse to your Notion workspace to access and update your notes.",
    fields: [
      { key: "token", label: "API Token", type: "password", required: true },
      { key: "pageId", label: "Root Page ID", type: "text", required: false }
    ],
    testable: true,
    documentationUrl: "https://developers.notion.com"
  },
  { 
    platform: "google_drive", 
    name: "Google Drive", 
    description: "Connect to your Google Drive to access your documents.",
    fields: [
      { key: "clientId", label: "Client ID", type: "text", required: true },
      { key: "clientSecret", label: "Client Secret", type: "password", required: true }
    ],
    testable: false
  },
  { 
    platform: "twitter", 
    name: "Twitter / X", 
    description: "Connect to your Twitter account to monitor and analyze your social media presence.",
    fields: [
      { key: "token", label: "API Token", type: "password", required: true },
      { key: "apiKey", label: "API Key", type: "password", required: true }
    ],
    testable: false,
    documentationUrl: "https://developer.twitter.com/en/docs"
  }
]

// Field type definition with optional required property
interface IntegrationField {
  key: string;
  label: string;
  type: string;
  required?: boolean;
}

interface KnownIntegration {
  platform: string;
  name: string;
  description: string;
  fields: IntegrationField[];
  testable: boolean;
  documentationUrl?: string;
}

export function IntegrationsCombined() {
  // Store integrations as an array, matching the backend model
  const [integrations, setIntegrations] = useState<IIntegration[]>([])
  const [availableIntegrations, setAvailableIntegrations] = useState<string[]>([])
  const [activeTab, setActiveTab] = useState("overview")
  const [selectedPlatform, setSelectedPlatform] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [testingPlatform, setTestingPlatform] = useState<string | null>(null)
  const [testResults, setTestResults] = useState<{
    platform: string;
    success: boolean;
    message: string;
    workspaceName?: string;
  } | null>(null)

  const fetchIntegrations = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    setTestResults(null) // Clear previous test results when loading integrations
    try {
      const existingIntegrations = await fetchUserIntegrations()
      
      // Create a list of all integrations
      const initializedIntegrations = KNOWN_INTEGRATIONS.map(known => {
        const existing = existingIntegrations.find(i => i.platform === known.platform)
        return existing || { 
          platform: known.platform, 
          enabled: false, 
          credentials: {}, 
          lastSync: undefined
        }
      })
      
      setIntegrations(initializedIntegrations as IIntegration[])
      
      // Determine which platforms are available to add
      const configured = initializedIntegrations.filter(
        i => i.credentials && Object.keys(i.credentials).length > 0
      ).map(i => i.platform)
      
      setAvailableIntegrations(
        KNOWN_INTEGRATIONS
          .map(k => k.platform)
          .filter(p => !configured.includes(p))
      )
    } catch (error: any) {
      console.error("Failed to fetch integrations:", error)
      toast.error("Failed to load integrations.", { description: error.message })
      setIntegrations([])
      setAvailableIntegrations(KNOWN_INTEGRATIONS.map(k => k.platform))
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
    
    // Clear test results when credentials change
    if (testResults?.platform === platform) {
      setTestResults(null)
    }
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

  const handleSave = async () => {
    setIsSaving(true)
    try {
      await updateUserIntegrations(integrations)
      toast.success("Integrations saved successfully!")
      // Refresh integrations to get updated state
      await fetchIntegrations()
    } catch (error: any) {
      console.error("Failed to save integrations:", error)
      toast.error("Failed to save integrations.", { description: error.message })
    } finally {
      setIsSaving(false)
    }
  }
  
  const getIntegrationDetails = (platform: string) => {
    const integration = integrations.find(i => i.platform === platform);
    // If no integration found, create a default one for the platform
    if (!integration && platform) {
      const defaultIntegration: IIntegration = {
        platform,
        enabled: false,
        credentials: {},
        lastSync: undefined
      };
      return defaultIntegration;
    }
    return integration || null;
  }
  
  // Test specific integration connections
  const testIntegrationConnection = async (platform: string) => {
    const integration = getIntegrationDetails(platform)
    if (!integration) return
    
    setTestingPlatform(platform)
    setTestResults(null)
    
    try {
      if (platform === "notion") {
        const credentials = integration.credentials
        if (!credentials.token) {
          toast.error("Missing API token for Notion integration")
          return
        }
        
        const result = await testNotionConnection({
          token: credentials.token,
          pageId: credentials.pageId
        })
        
        setTestResults({
          platform,
          ...result
        })
        
        // If successful, update the integration metadata with workspace name
        if (result.success && result.workspaceName) {
          setIntegrations(prev => 
            prev.map(i => 
              i.platform === platform 
                ? { 
                    ...i, 
                    metadata: { 
                      ...(i.metadata || {}), 
                      workspaceName: result.workspaceName 
                    } 
                  } 
                : i
            )
          )
        }
      } else {
        // Handle other platforms as they are implemented
        toast.info(`Testing for ${platform} is not yet implemented`)
      }
    } catch (error: any) {
      console.error(`Test for ${platform} failed:`, error)
      setTestResults({
        platform,
        success: false,
        message: error.message || `Failed to test ${platform} connection`
      })
    } finally {
      setTestingPlatform(null)
    }
  }
  
  const handleAddIntegration = (platform: string) => {
    // Make sure the platform exists in integrations or create it if not found
    if (!integrations.some(i => i.platform === platform)) {
      const newIntegration: IIntegration = {
        platform,
        enabled: false,
        credentials: {},
        lastSync: undefined
      };
      setIntegrations(prev => [...prev, newIntegration]);
    }
    
    setSelectedPlatform(platform);
    setActiveTab("configure");
  }
  
  const handleRemoveIntegration = async (platform: string) => {
    // Show confirmation first
    if (!window.confirm(`Are you sure you want to remove the ${platform} integration? This will delete all stored credentials.`)) {
      return
    }
    
    try {
      // Update the integration with empty credentials and disabled
      const updated = integrations.map(i => 
        i.platform === platform 
          ? { ...i, credentials: {}, enabled: false, metadata: {} } 
          : i
      )
      
      setIntegrations(updated)
      await updateUserIntegrations(updated)
      toast.success(`${platform} integration removed successfully`)
      
      // Refresh the available integrations
      await fetchIntegrations()
      
      // If we were viewing this integration in configure tab, go back to overview
      if (selectedPlatform === platform) {
        setSelectedPlatform(null)
        setActiveTab("overview")
      }
    } catch (error: any) {
      console.error(`Failed to remove ${platform} integration:`, error)
      toast.error(`Failed to remove integration: ${error.message}`)
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

  if (error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Integrations</CardTitle>
          <CardDescription>Connect Synapse to other services.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-red-500 text-sm">{error}</p>
          <Button 
            variant="outline" 
            size="sm" 
            className="flex items-center gap-2" 
            onClick={fetchIntegrations}
          >
            <RefreshCw className="h-4 w-4" /> Retry
          </Button>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="bg-white shadow-sm">
      <CardHeader>
        <CardTitle className="text-xl font-semibold text-gray-800">Integrations</CardTitle>
        <CardDescription className="text-gray-600">
          Connect Synapse to other services to enhance its capabilities.
        </CardDescription>
      </CardHeader>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-2 mb-4 bg-gray-100 p-1 rounded-none border-b">
          <TabsTrigger 
            value="overview" 
            className="data-[state=active]:bg-white rounded-none h-10 border-b-2 border-transparent data-[state=active]:border-amber-500"
          >
            Overview
          </TabsTrigger>
          <TabsTrigger 
            value="configure" 
            className="data-[state=active]:bg-white rounded-none h-10 border-b-2 border-transparent data-[state=active]:border-amber-500"
            disabled={!selectedPlatform}
          >
            Configure {selectedPlatform && ` ${KNOWN_INTEGRATIONS.find(i => i.platform === selectedPlatform)?.name}`}
          </TabsTrigger>
        </TabsList>
        
        <TabsContent value="overview" className="p-6 pt-0">
          <div className="space-y-6">
            {/* Add Notion Integration Shortcut */}
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
              <div>
                <h3 className="text-base font-medium text-amber-800">Quick Add: Notion Integration</h3>
                <p className="text-sm text-amber-700">Connect your Notion workspace to access and update your notes.</p>
              </div>
              <Button 
                onClick={() => handleAddIntegration("notion")}
                className="bg-amber-600 text-white hover:bg-amber-700 whitespace-nowrap"
              >
                <Plus className="h-4 w-4 mr-1" /> Add Notion
              </Button>
            </div>
            
            <h3 className="text-lg font-semibold text-gray-700 mt-6">Active Integrations</h3>
            {integrations.filter(i => Object.keys(i.credentials || {}).length > 0).length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {integrations
                  .filter(i => Object.keys(i.credentials || {}).length > 0)
                  .map((integration) => {
                    const config = KNOWN_INTEGRATIONS.find(k => k.platform === integration.platform)
                    if (!config) return null
                    
                    return (
                      <Card key={integration.platform} className="border shadow-sm hover:shadow-md transition-shadow">
                        <CardHeader className="pb-2">
                          <div className="flex justify-between items-start">
                            <div>
                              <CardTitle className="text-base">{config.name}</CardTitle>
                              {integration.metadata?.workspaceName && (
                                <div className="text-xs text-gray-500 mt-1">
                                  Connected to: {integration.metadata.workspaceName}
                                </div>
                              )}
                            </div>
                            <Badge variant={integration.enabled ? "default" : "outline"} className="ml-2">
                              {integration.enabled ? "Enabled" : "Disabled"}
                            </Badge>
                          </div>
                        </CardHeader>
                        <CardContent className="text-sm text-gray-600">
                          <p className="line-clamp-2">{config.description}</p>
                        </CardContent>
                        <CardFooter className="border-t pt-3 flex justify-between">
                          <Button 
                            variant="outline" 
                            size="sm"
                            onClick={() => {
                              setSelectedPlatform(integration.platform)
                              setActiveTab("configure")
                            }}
                          >
                            Configure
                          </Button>
                          <Button 
                            variant="destructive" 
                            size="sm"
                            onClick={() => handleRemoveIntegration(integration.platform)}
                          >
                            <Trash2 className="h-4 w-4 mr-1" /> Remove
                          </Button>
                        </CardFooter>
                      </Card>
                    )
                  })}
              </div>
            ) : (
              <p className="text-sm text-gray-500">No active integrations. Add one below to get started.</p>
            )}
            
            <h3 className="text-lg font-semibold text-gray-700 mt-8">Available Integrations</h3>
            {KNOWN_INTEGRATIONS.filter(k => 
              !integrations.some(i => 
                i.platform === k.platform && Object.keys(i.credentials || {}).length > 0
              )
            ).length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {KNOWN_INTEGRATIONS
                  .filter(k => 
                    !integrations.some(i => 
                      i.platform === k.platform && Object.keys(i.credentials || {}).length > 0
                    )
                  )
                  .map((integration) => (
                    <Card key={integration.platform} className="border shadow-sm hover:shadow-md transition-shadow">
                      <CardHeader className="pb-2">
                        <CardTitle className="text-base">{integration.name}</CardTitle>
                      </CardHeader>
                      <CardContent className="text-sm text-gray-600">
                        <p className="line-clamp-2">{integration.description}</p>
                      </CardContent>
                      <CardFooter className="border-t pt-3">
                        <Button 
                          variant="default" 
                          size="sm"
                          className="bg-amber-600 hover:bg-amber-700"
                          onClick={() => handleAddIntegration(integration.platform)}
                        >
                          <Plus className="h-4 w-4 mr-1" /> Add Integration
                        </Button>
                      </CardFooter>
                    </Card>
                  ))}
              </div>
            ) : (
              <p className="text-sm text-gray-500">All available integrations have been configured.</p>
            )}
          </div>
        </TabsContent>
        
        <TabsContent value="configure" className="p-6 pt-0">
          {selectedPlatform && (
            <div className="space-y-6">
              {(() => {
                const platform = selectedPlatform;
                const config = KNOWN_INTEGRATIONS.find(k => k.platform === platform);
                const integration = getIntegrationDetails(platform);
                
                if (!config) {
                  return (
                    <div className="p-4 border rounded border-red-300 bg-red-50 text-red-800">
                      <p>Integration type not supported. Please choose another integration type.</p>
                      <Button 
                        variant="outline" 
                        className="mt-3" 
                        onClick={() => {
                          setSelectedPlatform(null);
                          setActiveTab("overview");
                        }}
                      >
                        Back to Overview
                      </Button>
                    </div>
                  );
                }
                
                if (!integration) {
                  return (
                    <div className="p-4 border rounded border-red-300 bg-red-50 text-red-800">
                      <p>Failed to load integration details.</p>
                      <Button 
                        variant="outline" 
                        className="mt-3" 
                        onClick={fetchIntegrations}
                      >
                        <RefreshCw className="h-4 w-4 mr-2" /> Retry
                      </Button>
                    </div>
                  );
                }
                
                return (
                  <>
                    <div className="flex items-center justify-between mb-6">
                      <h3 className="text-lg font-semibold text-gray-700">{config.name} Configuration</h3>
                      <div className="flex items-center space-x-2">
                        <Switch 
                          checked={integration.enabled}
                          onCheckedChange={(checked) => handleToggleEnabled(platform, checked)}
                          disabled={isSaving || (Object.keys(integration.credentials || {}).length === 0 && !testResults?.success)}
                          aria-label={`Enable ${config.name} integration`}
                        />
                        <Label className="text-sm text-gray-600">
                          {integration.enabled ? 'Enabled' : 'Disabled'}
                        </Label>
                      </div>
                    </div>
                    
                    {error && (
                      <div className="p-3 mb-4 rounded border border-amber-200 bg-amber-50 text-amber-800 flex justify-between items-center">
                        <p className="text-sm">{error}</p>
                        <Button 
                          variant="outline" 
                          size="sm" 
                          className="flex items-center gap-2 ml-2" 
                          onClick={fetchIntegrations}
                        >
                          <RefreshCw className="h-4 w-4" /> Retry
                        </Button>
                      </div>
                    )}
                    
                    <div>
                      <h4 className="text-sm font-medium text-gray-700 mb-4">Credentials</h4>
                      <div className="space-y-4">
                        {config.fields.map(field => (
                          <div key={field.key} className="space-y-2">
                            <Label htmlFor={`${platform}-${field.key}`} className="text-sm">
                              {field.label} {field.required && <span className="text-red-500">*</span>}
                            </Label>
                            <Input
                              id={`${platform}-${field.key}`}
                              type={field.type}
                              value={(integration.credentials as Record<string, any>)?.[field.key] || ""}
                              onChange={(e) => handleInputChange(platform, field.key, e.target.value)}
                              placeholder={`Enter ${field.label}`}
                              disabled={isSaving}
                              required={field.required}
                            />
                          </div>
                        ))}
                      </div>
                    </div>
                    
                    {config.testable && (
                      <div className="mt-6 pt-6 border-t border-gray-200">
                        <div className="flex justify-between items-center mb-4">
                          <h4 className="text-sm font-medium text-gray-700">Test Connection</h4>
                          <Button 
                            variant="outline" 
                            size="sm"
                            onClick={() => testIntegrationConnection(platform)}
                            disabled={testingPlatform === platform || !integration.credentials?.token}
                          >
                            {testingPlatform === platform ? (
                              <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Testing...</>
                            ) : (
                              "Test Connection"
                            )}
                          </Button>
                        </div>
                        
                        {testResults && testResults.platform === platform && (
                          <div className={`p-3 rounded border ${testResults.success ? 'border-green-200 bg-green-50' : 'border-red-200 bg-red-50'}`}>
                            <div className="flex items-start">
                              <div className={`p-1 rounded-full ${testResults.success ? 'bg-green-100 text-green-600' : 'bg-red-100 text-red-600'} mr-2`}>
                                {testResults.success ? <Check className="h-4 w-4" /> : <X className="h-4 w-4" />}
                              </div>
                              <div>
                                <p className={`text-sm font-medium ${testResults.success ? 'text-green-800' : 'text-red-800'}`}>
                                  {testResults.success ? 'Connection verified' : 'Connection failed'}
                                </p>
                                <p className="text-xs mt-1 text-gray-600">{testResults.message}</p>
                                {testResults.workspaceName && (
                                  <p className="text-xs mt-1 text-gray-600">
                                    Workspace: <span className="font-medium">{testResults.workspaceName}</span>
                                  </p>
                                )}
                              </div>
                            </div>
                          </div>
                        )}
                        
                        {config.documentationUrl && (
                          <p className="text-xs text-gray-500 mt-4">
                            Need help? Check the <a 
                              href={config.documentationUrl} 
                              target="_blank" 
                              rel="noopener noreferrer"
                              className="text-blue-500 hover:underline"
                            >
                              {config.name} documentation
                            </a>.
                          </p>
                        )}
                      </div>
                    )}
                  </>
                )
              })()}
            </div>
          )}
        </TabsContent>
      </Tabs>
      
      <CardFooter className="border-t px-6 py-4 bg-gray-50 flex space-x-4 justify-between items-center">
        {activeTab === 'configure' && (
          <Button 
            variant="outline" 
            onClick={() => {
              setSelectedPlatform(null)
              setActiveTab("overview")
            }}
          >
            Back to Overview
          </Button>
        )}
        <Button
          onClick={handleSave}
          disabled={isSaving}
          className="bg-blue-600 text-white hover:bg-blue-700 focus:ring-blue-500 ml-auto"
        >
          {isSaving ? (
            <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Saving...</>
          ) : (
            "Save Changes"
          )}
        </Button>
      </CardFooter>
    </Card>
  )
} 