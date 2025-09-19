"use client"
'use-client';
import { useState } from 'react'
import { Button } from "../../../../components/ui/button"
import { Input } from "../../../../components/ui/input"
import { Textarea } from "../../../../components/ui/textarea"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../../../../components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../../../../components/ui/tabs"
import { Avatar, AvatarFallback, AvatarImage } from "../../../../components/ui/avatar"
import { Badge } from "../../../../components/ui/badge"
import { Switch } from "../../../../components/ui/switch"
import { Slider } from "../../../../components/ui/slider"
import { ScrollArea } from "../../../../components/ui/scroll-area"
import { 
  Bell, 
  BookOpen, 
  Brain, 
  Calendar, 
  Coffee,
  Github, 
  Globe, 
  Heart,
  Instagram, 
  Link, 
  Linkedin, 
  MessageSquare, 
  Music, 
  Settings, 
  Sparkles, 
  Sun,
  Twitter 
} from "lucide-react"

export default function Dashboard() {
  const [aiPersonality, setAiPersonality] = useState(50)
  const [userInput, setUserInput] = useState('')

  return (
    <div className="flex flex-col min-h-screen bg-gradient-to-br from-pink-50 to-purple-100">
      <header className="bg-white bg-opacity-80 backdrop-blur-md shadow-sm sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <Sparkles className="h-8 w-8 text-purple-500" />
            <span className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-purple-500 to-pink-500">Serendipity</span>
          </div>
          <div className="flex items-center space-x-4">
            <Button variant="ghost" size="icon">
              <Bell className="h-5 w-5 text-gray-600" />
            </Button>
            <Button variant="ghost" size="icon">
              <Settings className="h-5 w-5 text-gray-600" />
            </Button>
            <Avatar>
              <AvatarImage src="/placeholder-user.jpg" alt="User" />
              <AvatarFallback>JD</AvatarFallback>
            </Avatar>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8 text-center">
          <h1 className="text-3xl font-bold mb-2">Hey there, sunshine! ☀️</h1>
          <p className="text-gray-600">Your friendly AI companion is brewing up some serendipitous moments just for you.</p>
        </div>

        <Card className="mb-8">
          <CardHeader>
            <CardTitle>Serendipity's Thoughts</CardTitle>
            <CardDescription>A peek into what's on your AI's mind</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-start space-x-4">
                <Brain className="h-6 w-6 text-purple-500 mt-1" />
                <div>
                  <p className="text-sm font-medium">I noticed you've been listening to a lot of jazz lately...</p>
                  <p className="text-xs text-gray-500">Maybe we could explore some new artists or even local jazz events?</p>
                </div>
              </div>
              <div className="flex items-start space-x-4">
                <Sun className="h-6 w-6 text-yellow-500 mt-1" />
                <div>
                  <p className="text-sm font-medium">The weather's been gorgeous! How about a picnic this weekend?</p>
                  <p className="text-xs text-gray-500">I could suggest some lovely spots and help plan the menu.</p>
                </div>
              </div>
              <div className="flex items-start space-x-4">
                <Coffee className="h-6 w-6 text-brown-500 mt-1" />
                <div>
                  <p className="text-sm font-medium">Seems like you've been working hard. Time for a coffee break?</p>
                  <p className="text-xs text-gray-500">I've got a fun fact about coffee cultivation ready to share!</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="mb-8">
          <CardHeader>
            <CardTitle>What's on Your Mind?</CardTitle>
            <CardDescription>Let's chat about anything and everything!</CardDescription>
          </CardHeader>
          <CardContent>
            <Textarea 
              placeholder="Tell me what you're thinking about, or ask me anything! I'm all ears (well, figuratively speaking)." 
              className="mb-4"
              value={userInput}
              onChange={(e) => setUserInput(e.target.value)}
            />
            <Button className="w-full">Let's Explore This Together</Button>
          </CardContent>
        </Card>

        <Tabs defaultValue="vibes" className="space-y-8">
          <TabsList className="grid w-full grid-cols-2 lg:grid-cols-4">
            <TabsTrigger value="vibes">Vibes</TabsTrigger>
            <TabsTrigger value="connections">Connections</TabsTrigger>
            <TabsTrigger value="discoveries">Discoveries</TabsTrigger>
            <TabsTrigger value="settings">Personality</TabsTrigger>
          </TabsList>

          <TabsContent value="vibes" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Your Current Vibe</CardTitle>
                <CardDescription>Let's tune into your wavelength</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div>
                    <label className="text-sm font-medium mb-2 block">Energy Level</label>
                    <div className="flex items-center justify-between">
                      <span className="text-sm">Chilled</span>
                      <Slider
                        value={[70]}
                        max={100}
                        step={1}
                        className="w-[60%]"
                      />
                      <span className="text-sm">Energized</span>
                    </div>
                  </div>
                  <div>
                    <label className="text-sm font-medium mb-2 block">Mood</label>
                    <div className="flex flex-wrap gap-2">
                      <Badge variant="secondary">Curious</Badge>
                      <Badge variant="secondary">Creative</Badge>
                      <Badge variant="secondary">Focused</Badge>
                      <Badge variant="outline">+ Add mood</Badge>
                    </div>
                  </div>
                  <div>
                    <label className="text-sm font-medium mb-2 block">Today's Mantra</label>
                    <Input placeholder="What's your guiding thought for today?" />
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="connections" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Your Digital Ecosystem</CardTitle>
                <CardDescription>The apps and platforms that make up your online world</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-4">
                      <Twitter className="h-6 w-6 text-blue-400" />
                      <div>
                        <p className="text-sm font-medium">Twitter</p>
                        <p className="text-xs text-gray-500">Last synced: 2 hours ago</p>
                      </div>
                    </div>
                    <Switch checked={true} />
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-4">
                      <Linkedin className="h-6 w-6 text-blue-700" />
                      <div>
                        <p className="text-sm font-medium">LinkedIn</p>
                        <p className="text-xs text-gray-500">Last synced: 1 day ago</p>
                      </div>
                    </div>
                    <Switch checked={true} />
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-4">
                      <Github className="h-6 w-6" />
                      <div>
                        <p className="text-sm font-medium">GitHub</p>
                        <p className="text-xs text-gray-500">Last synced: 3 hours ago</p>
                      </div>
                    </div>
                    <Switch checked={true} />
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-4">
                      <Instagram className="h-6 w-6 text-pink-600" />
                      <div>
                        <p className="text-sm font-medium">Instagram</p>
                        <p className="text-xs text-gray-500">Not connected</p>
                      </div>
                    </div>
                    <Switch checked={false} />
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="discoveries" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Serendipitous Finds</CardTitle>
                <CardDescription>Little nuggets of joy I've uncovered for you</CardDescription>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-[300px] pr-4">
                  <div className="space-y-4">
                    <div className="flex items-start space-x-4">
                      <Music className="h-6 w-6 text-indigo-500 mt-1" />
                      <div>
                        <p className="text-sm font-medium">New Playlist: "Jazz for Coding Sessions"</p>
                        <p className="text-xs text-gray-500">Based on your recent listening habits and work schedule</p>
                      </div>
                    </div>
                    <div className="flex items-start space-x-4">
                      <BookOpen className="h-6 w-6 text-green-500 mt-1" />
                      <div>
                        <p className="text-sm font-medium">Book Recommendation: "The Midnight Library" by Matt Haig</p>
                        <p className="text-xs text-gray-500">You might enjoy this based on your interest in philosophical fiction</p>
                      </div>
                    </div>
                    <div className="flex items-start space-x-4">
                      <Globe className="h-6 w-6 text-blue-500 mt-1" />
                      <div>
                        <p className="text-sm font-medium">Local Event: Artisan Coffee Tasting</p>
                        <p className="text-xs text-gray-500">This Saturday at the downtown market - perfect for a coffee lover like you!</p>
                      </div>
                    </div>
                    <div className="flex items-start space-x-4">
                      <Heart className="h-6 w-6 text-red-500 mt-1" />
                      <div>
                        <p className="text-sm font-medium">Wellness Tip: 5-Minute Desk Yoga</p>
                        <p className="text-xs text-gray-500">A quick routine to help with your posture during long coding sessions</p>
                      </div>
                    </div>
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="settings" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Serendipity's Personality</CardTitle>
                <CardDescription>Customize how I interact with you</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <label className="text-sm font-medium mb-2 block">My Conversation Style</label>
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Professional</span>
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
                  <label className="text-sm font-medium mb-2 block">How Often Should I Reach Out?</label>
                  <div className="flex items-center space-x-2">
                    <Switch id="proactive-mode" />
                    <label htmlFor="proactive-mode" className="text-sm">
                      I'll initiate conversations and share discoveries
                    </label>
                  </div>
                </div>
                <div>
                  <label className="text-sm font-medium mb-2 block">What I Should Focus On</label>
                  <div className="space-y-2">
                    <div className="flex items-center space-x-2">
                      <input type="checkbox" id="focus-productivity" className="rounded border-gray-300 text-purple-600 shadow-sm focus:border-purple-300 focus:ring focus:ring-purple-200 focus:ring-opacity-50" />
                      <label htmlFor="focus-productivity" className="text-sm">Boost your productivity (but not too much pressure!)</label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <input type="checkbox" id="focus-learning" className="rounded border-gray-300 text-purple-600 shadow-sm focus:border-purple-300 focus:ring focus:ring-purple-200 focus:ring-opacity-50" />
                      <label htmlFor="focus-learning" className="text-sm">Suggest learning opportunities and new skills</label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <input type="checkbox" id="focus-fun" className="rounded border-gray-300 text-purple-600 shadow-sm focus:border-purple-300 focus:ring focus:ring-purple-200 focus:ring-opacity-50" />
                      <label htmlFor="focus-fun" className="text-sm">Find fun activities and entertainment</label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <input type="checkbox" id="focus-wellness" className="rounded border-gray-300 text-purple-600 shadow-sm focus:border-purple-300 focus:ring focus:ring-purple-200 focus:ring-opacity-50" />
                      <label htmlFor="focus-wellness" className="text-sm">Encourage wellness and self-care</label>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </main>

      <footer className="bg-white bg-opacity-80 backdrop-blur-md py-4 mt-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex justify-between items-center">
          <p className="text-sm text-gray-500">© 2023 Serendipity. Bringing a little magic to your day.</p>
          <div className="flex space-x-4">
            <Link href="#" className="text-sm text-gray-500 hover:text-purple-500">Privacy</Link>
            <Link href="#" className="text-sm text-gray-500 hover:text-purple-500">Terms</Link>
            <Link href="#" className="text-sm text-gray-500 hover:text-purple-500">Contact</Link>
          </div>
        </div>
      </footer>
    </div>
  )
}