"use client"
'use-client';
import { useState } from 'react'
import { Button } from "../../../components/ui/button"
import { Input } from "../../../components/ui/input"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../../../components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../../../components/ui/tabs"
import { Avatar, AvatarFallback, AvatarImage } from "../../../components/ui/avatar"
import { Badge } from "../../../components/ui/badge"
import { Switch } from "../../../components/ui/switch"
import { Slider } from "../../../components/ui/slider"
import { ScrollArea } from "../../../components/ui/scroll-area"
import { 
  Bell, 
  BookOpen, 
  Brain, 
  Calendar, 
  Github, 
  Globe, 
  Instagram, 
  Linkedin, 
  MessageSquare, 
  Music, 
  Settings, 
  Sparkles, 
  Twitter 
} from "lucide-react"

export default function Dashboard() {
  const [aiPersonality, setAiPersonality] = useState(50)

  return (
    <div className="flex flex-col min-h-screen bg-gray-100">
      <header className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between">
          <div className="flex items-center">
            <Sparkles className="h-8 w-8 text-amber-500 mr-2" />
            <span className="text-xl font-bold">Serendipity</span>
          </div>
          <div className="flex items-center space-x-4">
            <Button variant="ghost" size="icon">
              <Bell className="h-5 w-5" />
            </Button>
            <Button variant="ghost" size="icon">
              <Settings className="h-5 w-5" />
            </Button>
            <Avatar>
              <AvatarImage src="/placeholder-user.jpg" alt="User" />
              <AvatarFallback>JD</AvatarFallback>
            </Avatar>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <h1 className="text-3xl font-bold mb-8">Welcome back, Jane!</h1>

        <Tabs defaultValue="overview" className="space-y-8">
          <TabsList className="grid w-full grid-cols-4 lg:grid-cols-5">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="integrations">Integrations</TabsTrigger>
            <TabsTrigger value="interests">Interests</TabsTrigger>
            <TabsTrigger value="ai-customization">AI Customization</TabsTrigger>
            <TabsTrigger value="insights" className="hidden lg:inline-flex">Insights</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-8">
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Total Interactions</CardTitle>
                  <MessageSquare className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">1,234</div>
                  <p className="text-xs text-muted-foreground">+20.1% from last month</p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Active Integrations</CardTitle>
                  <Globe className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">7</div>
                  <p className="text-xs text-muted-foreground">2 new this week</p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Interests Tracked</CardTitle>
                  <BookOpen className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">12</div>
                  <p className="text-xs text-muted-foreground">Across 5 categories</p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Serendipitous Moments</CardTitle>
                  <Sparkles className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">42</div>
                  <p className="text-xs text-muted-foreground">Unexpected discoveries this month</p>
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader>
                <CardTitle>Recent Activity</CardTitle>
                <CardDescription>Your latest interactions and discoveries</CardDescription>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-[300px]">
                  <div className="space-y-4">
                    <div className="flex items-center">
                      <Calendar className="h-4 w-4 mr-2 text-muted-foreground" />
                      <div className="ml-2 space-y-1">
                        <p className="text-sm font-medium leading-none">New event suggestion: Local Art Exhibition</p>
                        <p className="text-sm text-muted-foreground">Based on your interest in modern art</p>
                      </div>
                    </div>
                    <div className="flex items-center">
                      <Music className="h-4 w-4 mr-2 text-muted-foreground" />
                      <div className="ml-2 space-y-1">
                        <p className="text-sm font-medium leading-none">Discovered new playlist: "Coding Focus"</p>
                        <p className="text-sm text-muted-foreground">Matches your work routine and music preferences</p>
                      </div>
                    </div>
                    <div className="flex items-center">
                      <MessageSquare className="h-4 w-4 mr-2 text-muted-foreground" />
                      <div className="ml-2 space-y-1">
                        <p className="text-sm font-medium leading-none">Conversation about climate change solutions</p>
                        <p className="text-sm text-muted-foreground">Sparked by recent news article</p>
                      </div>
                    </div>
                    {/* Add more activity items here */}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="integrations" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Active Integrations</CardTitle>
                <CardDescription>Manage your connected services and data sources</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-4">
                      <Twitter className="h-6 w-6 text-blue-400" />
                      <div>
                        <p className="text-sm font-medium">Twitter</p>
                        <p className="text-xs text-muted-foreground">Connected on May 15, 2023</p>
                      </div>
                    </div>
                    <Switch checked={true} />
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-4">
                      <Linkedin className="h-6 w-6 text-blue-700" />
                      <div>
                        <p className="text-sm font-medium">LinkedIn</p>
                        <p className="text-xs text-muted-foreground">Connected on June 2, 2023</p>
                      </div>
                    </div>
                    <Switch checked={true} />
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-4">
                      <Github className="h-6 w-6" />
                      <div>
                        <p className="text-sm font-medium">GitHub</p>
                        <p className="text-xs text-muted-foreground">Connected on April 10, 2023</p>
                      </div>
                    </div>
                    <Switch checked={true} />
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-4">
                      <Instagram className="h-6 w-6 text-pink-600" />
                      <div>
                        <p className="text-sm font-medium">Instagram</p>
                        <p className="text-xs text-muted-foreground">Not connected</p>
                      </div>
                    </div>
                    <Switch checked={false} />
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>Available Plugins</CardTitle>
                <CardDescription>Extend Serendipity's capabilities with these plugins</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium">Weather Insights</p>
                      <p className="text-xs text-muted-foreground">Get personalized weather-based recommendations</p>
                    </div>
                    <Button variant="outline">Install</Button>
                  </div>
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium">Language Learning</p>
                      <p className="text-xs text-muted-foreground">Integrate language lessons into your daily routine</p>
                    </div>
                    <Button variant="outline">Install</Button>
                  </div>
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium">Fitness Tracker</p>
                      <p className="text-xs text-muted-foreground">Connect your fitness data for holistic insights</p>
                    </div>
                    <Button variant="outline">Install</Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="interests" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Your Interests</CardTitle>
                <CardDescription>Manage the topics Serendipity uses to personalize your experience</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div>
                    <h3 className="text-sm font-medium mb-2">Technology</h3>
                    <div className="flex flex-wrap gap-2">
                      <Badge>Artificial Intelligence</Badge>
                      <Badge>Web Development</Badge>
                      <Badge>Cybersecurity</Badge>
                      <Badge variant="outline">Add new...</Badge>
                    </div>
                  </div>
                  <div>
                    <h3 className="text-sm font-medium mb-2">Arts & Culture</h3>
                    <div className="flex flex-wrap gap-2">
                      <Badge>Modern Art</Badge>
                      <Badge>Classical Music</Badge>
                      <Badge>Photography</Badge>
                      <Badge variant="outline">Add new...</Badge>
                    </div>
                  </div>
                  <div>
                    <h3 className="text-sm font-medium mb-2">Science</h3>
                    <div className="flex flex-wrap gap-2">
                      <Badge>Astronomy</Badge>
                      <Badge>Climate Change</Badge>
                      <Badge>Genetics</Badge>
                      <Badge variant="outline">Add new...</Badge>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>Discover New Interests</CardTitle>
                <CardDescription>Explore topics that might intrigue you based on your current interests</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium">Quantum Computing</p>
                      <p className="text-xs text-muted-foreground">Related to your interest in Technology</p>
                    </div>
                    <Button variant="outline" size="sm">Add</Button>
                  </div>
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium">Sustainable Architecture</p>
                      <p className="text-xs text-muted-foreground">Related to your interests in Technology and Climate Change</p>
                    </div>
                    <Button variant="outline" size="sm">Add</Button>
                  </div>
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium">Biohacking</p>
                      <p className="text-xs text-muted-foreground">Related to your interests in Technology and Genetics</p>
                    </div>
                    <Button variant="outline" size="sm">Add</Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="ai-customization" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>AI Personality Settings</CardTitle>
                <CardDescription>Customize how Serendipity interacts with you</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <label className="text-sm font-medium mb-2 block">Conversation Style</label>
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Formal</span>
                    <Slider
                      value={[aiPersonality]}
                      onValueChange={(value) => setAiPersonality(value[0])}
                      max={100}
                      step={1}
                      className="w-[60%]"
                    />
                    <span className="text-sm">Casual</span>
                  </div>
                </div>
                <div>
                  <label className="text-sm font-medium mb-2 block">Proactivity Level</label>
                  <div className="flex items-center space-x-2">
                    <Switch id="proactive-mode" />
                    <label htmlFor="proactive-mode" className="text-sm font-medium">
                      Enable proactive suggestions
                    </label>
                  </div>
                </div>
                <div>
                  <label className="text-sm font-medium mb-2 block">Learning Focus</label>
                  <div className="space-y-2">
                    <div className="flex items-center space-x-2">
                      <input type="checkbox" id="focus-technology" className="rounded border-gray-300 text-amber-600 shadow-sm focus:border-amber-300 focus:ring focus:ring-amber-200 focus:ring-opacity-50" />
                      <label htmlFor="focus-technology" className="text-sm">Emphasize technology-related content</label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <input type="checkbox" id="focus-creativity" className="rounded border-gray-300 text-amber-600 shadow-sm focus:border-amber-300 focus:ring focus:ring-amber-200 focus:ring-opacity-50" />
                      <label htmlFor="focus-creativity" className="text-sm">Prioritize creative and artistic topics</label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <input type="checkbox" id="focus-wellness" className="rounded border-gray-300 text-amber-600 shadow-sm focus:border-amber-300 focus:ring focus:ring-amber-200 focus:ring-opacity-50" />
                      <label htmlFor="focus-wellness" className="text-sm">Include more health and wellness insights</label>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>AI Goals</CardTitle>
                <CardDescription>Set objectives for your AI companion</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div>
                    <Input placeholder="Enter a new goal for Serendipity..." />
                  </div>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <p className="text-sm">Help me stay updated on industry trends</p>
                      <Button variant="outline" size="sm">Remove</Button>
                    </div>
                    <div className="flex items-center justify-between">
                      <p className="text-sm">Suggest new books based on my reading history</p>
                      <Button variant="outline" size="sm">Remove</Button>
                    </div>
                    <div className="flex items-center justify-between">
                      <p className="text-sm">Remind me to take breaks during long work sessions</p>
                      <Button variant="outline" size="sm">Remove</Button>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="insights" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>AI Companion Insights</CardTitle>
                <CardDescription>Understanding how Serendipity thinks and acts</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div>
                    <h3 className="text-sm font-medium mb-2">Current Focus</h3>
                    <p className="text-sm">Serendipity is currently analyzing your recent interactions to identify potential areas for personal growth and learning opportunities.</p>
                  </div>
                  <div>
                    <h3 className="text-sm font-medium mb-2">Recent Observations</h3>
                    <ul className="list-disc list-inside text-sm space-y-1">
                      <li>You've shown increased interest in sustainable technologies</li>
                      <li>Your work patterns suggest you might benefit from more frequent breaks</li>
                      <li>There's an opportunity to expand your professional network in the AI ethics field</li>
                    </ul>
                  </div>
                  <div>
                    <h3 className="text-sm font-medium mb-2">Upcoming Actions</h3>
                    <p className="text-sm">Based on your goals and recent activities, Serendipity is planning to:</p>
                    <ul className="list-disc list-inside text-sm space-y-1 mt-2">
                      <li>Suggest a curated list of articles on sustainable tech innovations</li>
                      <li>Introduce a gentle reminder system for taking regular work breaks</li>
                      <li>Highlight relevant networking events in the AI ethics community</li>
                    </ul>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>Serendipity's Thought Process</CardTitle>
                <CardDescription>A glimpse into how your AI companion makes decisions</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div>
                    <h3 className="text-sm font-medium mb-2">Decision Making</h3>
                    <p className="text-sm">Serendipity combines your stated preferences, observed behaviors, and contextual information to make suggestions and take actions. It's constantly learning and adjusting its approach based on your feedback and changing interests.</p>
                  </div>
                  <div>
                    <h3 className="text-sm font-medium mb-2">Ethical Considerations</h3>
                    <p className="text-sm">Your AI companion is programmed to prioritize your privacy and well-being. It will always seek your permission before sharing any personal information or making significant changes to your digital environment.</p>
                  </div>
                  <div>
                    <h3 className="text-sm font-medium mb-2">Continuous Improvement</h3>
                    <p className="text-sm">Serendipity is designed to evolve alongside you. It regularly analyzes its own performance and your feedback to enhance its capabilities and better serve your needs.</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  )
}