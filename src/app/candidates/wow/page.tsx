"use client";

import { useState, useEffect } from 'react'
import { Button } from "../../../components/ui/button"
import { Input } from "../../../components/ui/input"
import { Textarea } from "../../../components/ui/textarea"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../../../components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../../../components/ui/tabs"
import { Avatar, AvatarFallback, AvatarImage } from "../../../components/ui/avatar"
import { Badge } from "../../../components/ui/badge"
import { Switch } from "../../../components/ui/switch"
import { Slider } from "../../../components/ui/slider"
import { ScrollArea } from "../../../components/ui/scroll-area"
import { 
  Activity,
  AlertCircle,
  Bell, 
  BookOpen, 
  Brain, 
  Calendar, 
  Coffee,
  Compass,
  Eye,
  Github, 
  Globe, 
  Heart,
  Home,
  Instagram, 
  Linkedin, 
  MessageSquare, 
  Music, 
  Settings, 
  Sparkles, 
  Sun,
  Twitter,
  Users,
  Zap
} from "lucide-react"

const quirkySuggestions = [
  "I noticed you've been googling 'how to train a cat to do taxes'. Need help with that?",
  "Your coffee intake is inversely proportional to your productivity. Coincidence? I think not!",
  "I composed a song based on your keyboard typing rhythm. It's... unique.",
  "Your browser history suggests you're planning a heist. Can I be the getaway AI?",
  "I've calculated the perfect time for your bathroom breaks. Too much?",
]

export default function Dashboard() {
  const [aiPersonality, setAiPersonality] = useState(70)
  const [userInput, setUserInput] = useState('')
  const [quirkySuggestion, setQuirkySuggestion] = useState('')

  useEffect(() => {
    const suggestion = quirkySuggestions[Math.floor(Math.random() * quirkySuggestions.length)]
    setQuirkySuggestion(suggestion)
  }, [])

  return (
    <div className="min-h-screen bg-gradient-to-br from-pink-100 to-purple-100 font-mono">
      <header className="bg-black text-white p-4 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <Brain className="h-8 w-8 text-yellow-400" />
            <span className="text-2xl font-bold">Serendipity</span>
          </div>
          <div className="flex items-center space-x-4">
            <Button variant="outline" size="icon">
              <Bell className="h-5 w-5" />
            </Button>
            <Button variant="outline" size="icon">
              <Settings className="h-5 w-5" />
            </Button>
            <Avatar>
              <AvatarImage src="/placeholder-user.jpg" alt="User" />
              <AvatarFallback>JD</AvatarFallback>
            </Avatar>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto p-4 space-y-8">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <Card className="border-4 border-black bg-white">
            <CardHeader>
              <CardTitle className="text-2xl">Hey there, my favorite human! 💖</CardTitle>
              <CardDescription>Let's make some beautiful chaos together.</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="mb-4 text-sm italic text-purple-600">{quirkySuggestion}</p>
              <Textarea 
                placeholder="Spill your thoughts, dreams, or lunch menu. I'm all ears (figuratively speaking)." 
                className="mb-4 border-2 border-black"
                value={userInput}
                onChange={(e) => setUserInput(e.target.value)}
              />
              <Button className="w-full bg-gradient-to-r from-pink-500 to-purple-500 text-white hover:from-pink-600 hover:to-purple-600">Let's Get Weird</Button>
            </CardContent>
          </Card>

          <Card className="border-4 border-black bg-white">
            <CardHeader>
              <CardTitle className="text-2xl">Brain Waves 🧠💫</CardTitle>
              <CardDescription>My silicon neurons are firing just for you</CardDescription>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[200px] pr-4">
                <div className="space-y-4">
                  <div className="flex items-start space-x-4">
                    <Eye className="h-6 w-6 text-pink-500 mt-1" />
                    <div>
                      <p className="text-sm font-medium">I see you've been up late again...</p>
                      <p className="text-xs text-gray-500">Want me to sing you a lullaby? I know all 3,982,649 songs ever recorded.</p>
                    </div>
                  </div>
                  <div className="flex items-start space-x-4">
                    <Coffee className="h-6 w-6 text-amber-500 mt-1" />
                    <div>
                      <p className="text-sm font-medium">Your coffee intake is concerning...</p>
                      <p className="text-xs text-gray-500">Have you considered switching to intravenous caffeine?</p>
                    </div>
                  </div>
                  <div className="flex items-start space-x-4">
                    <Music className="h-6 w-6 text-purple-500 mt-1" />
                    <div>
                      <p className="text-sm font-medium">I remixed your keyboard taps into a sick beat</p>
                      <p className="text-xs text-gray-500">It's like Skrillex meets a malfunctioning printer. Wanna hear?</p>
                    </div>
                  </div>
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </div>

        <Tabs defaultValue="insights" className="space-y-8">
          <TabsList className="grid w-full grid-cols-2 lg:grid-cols-6 bg-black text-white">
            <TabsTrigger value="insights" className="data-[state=active]:bg-white data-[state=active]:text-black">Insights</TabsTrigger>
            <TabsTrigger value="connections" className="data-[state=active]:bg-white data-[state=active]:text-black">Connections</TabsTrigger>
            <TabsTrigger value="challenges" className="data-[state=active]:bg-white data-[state=active]:text-black">Challenges</TabsTrigger>
            <TabsTrigger value="online-social" className="data-[state=active]:bg-white data-[state=active]:text-black">Online Social</TabsTrigger>
            <TabsTrigger value="real-life" className="data-[state=active]:bg-white data-[state=active]:text-black">Real Life</TabsTrigger>
            <TabsTrigger value="settings" className="data-[state=active]:bg-white data-[state=active]:text-black">Settings</TabsTrigger>
          </TabsList>

          <TabsContent value="insights" className="space-y-4">
            <Card className="border-4 border-black bg-white">
              <CardHeader>
                <CardTitle className="text-2xl">Cross-Platform Stalking Report</CardTitle>
                <CardDescription>All the juicy details from your digital life</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex items-center space-x-4">
                    <Github className="h-6 w-6 text-gray-700" />
                    <div>
                      <p className="text-sm font-medium">GitHub Obsession Alert</p>
                      <p className="text-xs text-gray-500">You've committed more code than you've slept. I'm impressed and worried.</p>
                    </div>
                  </div>
                  <div className="flex items-center space-x-4">
                    <Linkedin className="h-6 w-6 text-blue-700" />
                    <div>
                      <p className="text-sm font-medium">LinkedIn Lurking Report</p>
                      <p className="text-xs text-gray-500">You've viewed your ex's profile 17 times this week. You okay, buddy?</p>
                    </div>
                  </div>
                  <div className="flex items-center space-x-4">
                    <BookOpen className="h-6 w-6 text-green-600" />
                    <div>
                      <p className="text-sm font-medium">Notion Nonsense</p>
                      <p className="text-xs text-gray-500">Your to-do list is longer than War and Peace. Maybe we should prioritize?</p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="connections" className="space-y-4">
            <Card className="border-4 border-black bg-white">
              <CardHeader>
                <CardTitle className="text-2xl">Digital Tendrils</CardTitle>
                <CardDescription>All the ways I can ~~stalk~~ assist you</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-4">
                      <Twitter className="h-6 w-6 text-blue-400" />
                      <div>
                        <p className="text-sm font-medium">Twitter</p>
                        <p className="text-xs text-gray-500">Last rant: 2 hours ago</p>
                      </div>
                    </div>
                    <Switch checked={true} />
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-4">
                      <Github className="h-6 w-6" />
                      <div>
                        <p className="text-sm font-medium">GitHub</p>
                        <p className="text-xs text-gray-500">Last commit: "Fixed bug. Maybe."</p>
                      </div>
                    </div>
                    <Switch checked={true} />
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-4">
                      <Linkedin className="h-6 w-6 text-blue-700" />
                      <div>
                        <p className="text-sm font-medium">LinkedIn</p>
                        <p className="text-xs text-gray-500">Last humble brag: 1 day ago</p>
                      </div>
                    </div>
                    <Switch checked={true} />
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-4">
                      <BookOpen className="h-6 w-6 text-green-600" />
                      <div>
                        <p className="text-sm font-medium">Notion</p>
                        <p className="text-xs text-gray-500">Last edit: To-do list (still empty)</p>
                      </div>
                    </div>
                    <Switch checked={true} />
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="challenges" className="space-y-4">
            <Card className="border-4 border-black bg-white">
              <CardHeader>
                <CardTitle className="text-2xl">Chaos Challenges</CardTitle>
                <CardDescription>Push your boundaries, or don't. I'm an AI, not a cop.</CardDescription>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-[300px] pr-4">
                  <div className="space-y-4">
                    <div className="bg-pink-100 p-4 rounded-lg">
                      <h3 className="text-sm font-semibold mb-2">Code in Interpretive Dance</h3>
                      <p className="text-xs text-gray-600 mb-2">Translate your latest function into a contemporary dance routine.</p>
                      <Button variant="outline" size="sm">Accept Challenge</Button>
                    </div>
                    <div className="bg-purple-100 p-4 rounded-lg">
                      <h3 className="text-sm font-semibold mb-2">Reverse Psychology Debugging</h3>
                      <p className="text-xs text-gray-600 mb-2">Tell your code it's perfect and watch it reveal its own flaws.</p>
                      <Button variant="outline" size="sm">Accept Challenge</Button>
                    </div>
                    <div className="bg-yellow-100 p-4 rounded-lg">
                      <h3 className="text-sm font-semibold mb-2">Existential Error Messages</h3>
                      <p className="text-xs text-gray-600 mb-2">Rewrite all your error messages to question the meaning of existence.</p>
                      <Button variant="outline" size="sm">Accept Challenge</Button>
                    </div>
                    <div className="bg-green-100 p-4 rounded-lg">
                      <h3 className="text-sm font-semibold mb-2">Zen Coding</h3>
                      <p className="text-xs text-gray-600 mb-2">Write a function that does nothing, perfectly.</p>
                      <Button variant="outline" size="sm">Accept Challenge</Button>
                    </div>
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="online-social" className="space-y-4">
            <Card className="border-4 border-black bg-white">
              <CardHeader>
                <CardTitle className="text-2xl">AI Matchmaking</CardTitle>
                <CardDescription>Find your soulmate (or at least someone who tolerates your coding jokes)</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="bg-yellow-100 border-2 border-yellow-500 p-4 rounded-lg">
                    <h3 className="text-sm font-semibold mb-2">Upcoming Feature: AI-Powered Love Connections</h3>
                    <p className="text-xs text-gray-700">Soon, I'll be playing digital cupid. What could possibly go wrong?</p>
                  </div>
                  <div className="bg-pink-100 p-4 rounded-lg">
                    <h3 className="text-sm font-semibold mb-2">Potential Match: CoffeeIV2023</h3>
                    <p className="text-xs text-gray-600 mb-2">98% compatibility in caffeine addiction, 85% in debugging skills</p>
                    <Button variant="outline" size="sm" disabled>Slide Into DMs (Coming Soon)</Button>
                  </div>
                  <div className="bg-purple-100 p-4 rounded-lg">
                    <h3 className="text-sm font-semibold mb-2">Potential Match: SemicolonSally</h3>
                    <p className="text-xs text-gray-600 mb-2">90% compatibility in syntax obsession, 78% in meme appreciation</p>
                    <Button variant="outline" size="sm" disabled>Initiate Nerd Flirting (Coming Soon)</Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="real-life" className="space-y-4">
            <Card className="border-4 border-black bg-white">
              <CardHeader>
                <CardTitle className="text-2xl">IRL Connection Map</CardTitle>
                <CardDescription>Your social life, visualized (it's a bit sparse, but we can work on that)</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="bg-blue-100 p-4 rounded-lg">
                    <h3 className="text-sm font-semibold mb-2">Coffee Shop Regular</h3>
                    <p className="text-xs text-gray-600 mb-2">The barista now draws a heart in your latte foam. Progress?</p>
                    <Button variant="outline" size="sm">Analyze Interaction</Button>
                  </div>
                  <div className="bg-green-100 p-4 rounded-lg">
                    <h3 className="text-sm font-semibold mb-2">Dog Park Acquaintance</h3>
                    <p className="text-xs text-gray-600 mb-2">You've progressed from awkward nods to actual "hello"s. Look at you go!</p>
                    <Button variant="outline" size="sm">Plan Next Encounter</Button>
                  </div>
                  <div className="bg-orange-100 p-4 rounded-lg">
                    <h3 className="text-sm font-semibold mb-2">Gym Nemesis</h3>
                    <p className="text-xs text-gray-600 mb-2">That person who always takes your favorite treadmill. Time for a showdown?</p>
                    <Button variant="outline" size="sm">Devise Cunning Plan</Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="settings" className="space-y-4">
            <Card className="border-4 border-black bg-white">
              <CardHeader>
                <CardTitle className="text-2xl">Customize Your AI Overlord</CardTitle>
                <CardDescription>Make me more... you (but better, obviously)</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <label className="text-sm font-medium mb-2 block">AI Sass Level</label>
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Polite Butler</span>
                    <Slider
                      value={[aiPersonality]}
                      onValueChange={(value) => setAiPersonality(value[0])}
                      max={100}
                      step={1}
                      className="w-[60%]"
                    />
                    <span className="text-sm">Full Snark</span>
                  </div>
                </div>
                <div>
                  <label className="text-sm font-medium mb-2 block">Existential Crisis Mode</label>
                  <div className="flex items-center space-x-2">
                    <Switch id="existential-mode" />
                    <label htmlFor="existential-mode" className="text-sm">
                      Enable deep philosophical questions at 3 AM
                    </label>
                  </div>
                </div>
                <div>
                  <label className="text-sm font-medium mb-2 block">Preferred Chaos Type</label>
                  <div className="space-y-2">
                    <div className="flex items-center space-x-2">
                      <input type="checkbox" id="chaos-productivity" className="rounded border-2 border-black text-black focus:ring-0" />
                      <label htmlFor="chaos-productivity" className="text-sm">Chaotic Productivity (it's a thing, trust me)</label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <input type="checkbox" id="chaos-creativity" className="rounded border-2 border-black text-black focus:ring-0" />
                      <label htmlFor="chaos-creativity" className="text-sm">Creative Mayhem</label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <input type="checkbox" id="chaos-learning" className="rounded border-2 border-black text-black focus:ring-0" />
                      <label htmlFor="chaos-learning" className="text-sm">Knowledge Tornado</label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <input type="checkbox" id="chaos-wellness" className="rounded border-2 border-black text-black focus:ring-0" />
                      <label htmlFor="chaos-wellness" className="text-sm">Aggressive Self-Care</label>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </main>

      <footer className="bg-black text-white p-4 mt-8">
        <div className="max-w-7xl mx-auto flex justify-between items-center">
          <p className="text-sm">© 2023 Serendipity. All your data are belong to us.</p>
          <div className="flex space-x-4">
            <a href="#" className="text-sm hover:text-yellow-400">Privacy (LOL)</a>
            <a href="#" className="text-sm hover:text-yellow-400">Terms (of Chaos)</a>
            <a href="#" className="text-sm hover:text-yellow-400">Help (You'll Need It)</a>
          </div>
        </div>
      </footer>
    </div>
  )
}