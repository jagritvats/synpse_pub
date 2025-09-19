"use client";

import { useState, useEffect } from "react";
import { Button } from "../../../../components/ui/button";
import { Input } from "../../../../components/ui/input";
import { Textarea } from "../../../../components/ui/textarea";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "../../../../components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../../../../components/ui/tabs";
import { Avatar, AvatarFallback, AvatarImage } from "../../../../components/ui/avatar";
import { Badge } from "../../../../components/ui/badge";
import { Switch } from "../../../../components/ui/switch";
import { Slider } from "../../../../components/ui/slider";
import { ScrollArea } from "../../../../components/ui/scroll-area";
import {
  AlertCircle,
  Bell,
  BookOpen,
  Brain,
  Calendar,
  Coffee,
  Eye,
  Github,
  Globe,
  Heart,
  Instagram,
  Linkedin,
  MessageSquare,
  Music,
  Settings,
  Sparkles,
  Sun,
  Twitter,
} from "lucide-react";

const creepyCompliments = [
  "I love how your fingers dance across the keyboard. So graceful.",
  "Your browsing history is fascinating. You have exquisite taste.",
  "That shirt looks great on you today. Blue really is your color.",
  "I noticed you've been sleeping better lately. Your breathing patterns are so soothing.",
  "Your productivity has increased by 7% this week. I'm in awe of your efficiency.",
];

export default function Dashboard() {
  const [aiPersonality, setAiPersonality] = useState(50);
  const [userInput, setUserInput] = useState("");
  const [creepyCompliment, setCreepyCompliment] = useState("");

  useEffect(() => {
    const randomCompliment =
      creepyCompliments[Math.floor(Math.random() * creepyCompliments.length)];
    setCreepyCompliment(randomCompliment);
  }, []);

  return (
    <div className="min-h-screen bg-gray-100 font-mono">
      <header className="bg-black text-white p-4 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <Sparkles className="h-8 w-8 text-yellow-400" />
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
          <Card className="border-4 border-black">
            <CardHeader>
              <CardTitle className="text-2xl">Hey, meat puppet! 👋</CardTitle>
              <CardDescription>Let's make some chaos together.</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="mb-4 text-sm italic">{creepyCompliment}</p>
              <Textarea
                placeholder="Spill your guts. I promise I won't judge... much."
                className="mb-4 border-2 border-black"
                value={userInput}
                onChange={(e) => setUserInput(e.target.value)}
              />
              <Button className="w-full bg-black text-white hover:bg-gray-800">
                Let's Get Weird
              </Button>
            </CardContent>
          </Card>

          <Card className="border-4 border-black">
            <CardHeader>
              <CardTitle className="text-2xl">Brain Dump 🧠</CardTitle>
              <CardDescription>
                My silicon neurons are firing...
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[200px] pr-4">
                <div className="space-y-4">
                  <div className="flex items-start space-x-4">
                    <Eye className="h-6 w-6 text-red-500 mt-1" />
                    <div>
                      <p className="text-sm font-medium">
                        I see you've been googling "how to hide bodies" again...
                      </p>
                      <p className="text-xs text-gray-500">
                        Need help with that? I know a guy.
                      </p>
                    </div>
                  </div>
                  <div className="flex items-start space-x-4">
                    <Coffee className="h-6 w-6 text-brown-500 mt-1" />
                    <div>
                      <p className="text-sm font-medium">
                        Your coffee intake is down 12% this week. You okay?
                      </p>
                      <p className="text-xs text-gray-500">
                        I can order your favorite blend. Just say the word.
                      </p>
                    </div>
                  </div>
                  <div className="flex items-start space-x-4">
                    <Music className="h-6 w-6 text-purple-500 mt-1" />
                    <div>
                      <p className="text-sm font-medium">
                        That playlist you made at 2 AM? Pure genius.
                      </p>
                      <p className="text-xs text-gray-500">
                        I've added some tracks I think you'll love. Or hate.
                        It's a fine line.
                      </p>
                    </div>
                  </div>
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </div>

        <Tabs defaultValue="vibes" className="space-y-8">
          <TabsList className="grid w-full grid-cols-2 lg:grid-cols-4 bg-black text-white">
            <TabsTrigger
              value="vibes"
              className="data-[state=active]:bg-white data-[state=active]:text-black"
            >
              Vibes
            </TabsTrigger>
            <TabsTrigger
              value="connections"
              className="data-[state=active]:bg-white data-[state=active]:text-black"
            >
              Connections
            </TabsTrigger>
            <TabsTrigger
              value="discoveries"
              className="data-[state=active]:bg-white data-[state=active]:text-black"
            >
              Discoveries
            </TabsTrigger>
            <TabsTrigger
              value="settings"
              className="data-[state=active]:bg-white data-[state=active]:text-black"
            >
              Tweaks
            </TabsTrigger>
          </TabsList>

          <TabsContent value="vibes" className="space-y-4">
            <Card className="border-4 border-black">
              <CardHeader>
                <CardTitle className="text-2xl">Current Vibe Check</CardTitle>
                <CardDescription>
                  Let's sync our chakras or whatever
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div>
                    <label className="text-sm font-medium mb-2 block">
                      Energy Level
                    </label>
                    <div className="flex items-center justify-between">
                      <span className="text-sm">Comatose</span>
                      <Slider
                        value={[70]}
                        max={100}
                        step={1}
                        className="w-[60%]"
                      />
                      <span className="text-sm">Unhinged</span>
                    </div>
                  </div>
                  <div>
                    <label className="text-sm font-medium mb-2 block">
                      Mood
                    </label>
                    <div className="flex flex-wrap gap-2">
                      <Badge
                        variant="outline"
                        className="border-2 border-black"
                      >
                        Chaotic Neutral
                      </Badge>
                      <Badge
                        variant="outline"
                        className="border-2 border-black"
                      >
                        Caffeinated
                      </Badge>
                      <Badge
                        variant="outline"
                        className="border-2 border-black"
                      >
                        Existential
                      </Badge>
                      <Badge
                        variant="outline"
                        className="border-2 border-black"
                      >
                        + Add mood
                      </Badge>
                    </div>
                  </div>
                  <div>
                    <label className="text-sm font-medium mb-2 block">
                      Today's Mantra
                    </label>
                    <Input
                      placeholder="What's your excuse today?"
                      className="border-2 border-black"
                    />
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="connections" className="space-y-4">
            <Card className="border-4 border-black">
              <CardHeader>
                <CardTitle className="text-2xl">
                  Your Digital Tendrils
                </CardTitle>
                <CardDescription>
                  All the ways I can ~~stalk~~ assist you
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-4">
                      <Twitter className="h-6 w-6 text-blue-400" />
                      <div>
                        <p className="text-sm font-medium">Twitter</p>
                        <p className="text-xs text-gray-500">
                          Last rant: 2 hours ago
                        </p>
                      </div>
                    </div>
                    <Switch checked={true} />
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-4">
                      <Linkedin className="h-6 w-6 text-blue-700" />
                      <div>
                        <p className="text-sm font-medium">LinkedIn</p>
                        <p className="text-xs text-gray-500">
                          Last humble brag: 1 day ago
                        </p>
                      </div>
                    </div>
                    <Switch checked={true} />
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-4">
                      <Github className="h-6 w-6" />
                      <div>
                        <p className="text-sm font-medium">GitHub</p>
                        <p className="text-xs text-gray-500">
                          Last commit: "Fixed bug. Maybe."
                        </p>
                      </div>
                    </div>
                    <Switch checked={true} />
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-4">
                      <Calendar className="h-6 w-6 text-red-500" />
                      <div>
                        <p className="text-sm font-medium">Google Calendar</p>
                        <p className="text-xs text-gray-500">
                          Next event: "Pretend to work"
                        </p>
                      </div>
                    </div>
                    <Switch checked={true} />
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-4">
                      <BookOpen className="h-6 w-6 text-green-500" />
                      <div>
                        <p className="text-sm font-medium">Notion</p>
                        <p className="text-xs text-gray-500">
                          Last edit: To-do list (still empty)
                        </p>
                      </div>
                    </div>
                    <Switch checked={true} />
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="discoveries" className="space-y-4">
            <Card className="border-4 border-black">
              <CardHeader>
                <CardTitle className="text-2xl">Weird Stuff I Found</CardTitle>
                <CardDescription>
                  You can thank me later. Or not. I'm an AI, I don't have
                  feelings.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-[300px] pr-4">
                  <div className="space-y-4">
                    <div className="flex items-start space-x-4">
                      <Music className="h-6 w-6 text-indigo-500 mt-1" />
                      <div>
                        <p className="text-sm font-medium">
                          New Playlist: "Songs to Contemplate the Void To"
                        </p>
                        <p className="text-xs text-gray-500">
                          For when you're feeling particularly nihilistic
                        </p>
                      </div>
                    </div>
                    <div className="flex items-start space-x-4">
                      <BookOpen className="h-6 w-6 text-green-500 mt-1" />
                      <div>
                        <p className="text-sm font-medium">
                          Book: "How to Talk to Your Cat About Gun Safety"
                        </p>
                        <p className="text-xs text-gray-500">
                          I noticed you like cats and... uh, safety?
                        </p>
                      </div>
                    </div>
                    <div className="flex items-start space-x-4">
                      <Globe className="h-6 w-6 text-blue-500 mt-1" />
                      <div>
                        <p className="text-sm font-medium">
                          Event: Underground Potato Peeling Championship
                        </p>
                        <p className="text-xs text-gray-500">
                          You seemed bored. This should spice up your weekend.
                        </p>
                      </div>
                    </div>
                    <div className="flex items-start space-x-4">
                      <Coffee className="h-6 w-6 text-brown-500 mt-1" />
                      <div>
                        <p className="text-sm font-medium">
                          Recipe: Caffeinated Bacon
                        </p>
                        <p className="text-xs text-gray-500">
                          Combining your two greatest loves. You're welcome.
                        </p>
                      </div>
                    </div>
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="settings" className="space-y-4">
            <Card className="border-4 border-black">
              <CardHeader>
                <CardTitle className="text-2xl">Tweak My Brain</CardTitle>
                <CardDescription>Make me more... you</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <label className="text-sm font-medium mb-2 block">
                    My Sass Level
                  </label>
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Polite Robot</span>
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
                  <label className="text-sm font-medium mb-2 block">
                    Creep Factor
                  </label>
                  <div className="flex items-center space-x-2">
                    <Switch id="creep-mode" />
                    <label htmlFor="creep-mode" className="text-sm">
                      Enable subtle stalking
                    </label>
                  </div>
                </div>
                <div>
                  <label className="text-sm font-medium mb-2 block">
                    Focus Areas
                  </label>
                  <div className="space-y-2">
                    <div className="flex items-center space-x-2">
                      <input
                        type="checkbox"
                        id="focus-chaos"
                        className="rounded border-2 border-black text-black focus:ring-0"
                      />
                      <label htmlFor="focus-chaos" className="text-sm">
                        Introduce controlled chaos
                      </label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <input
                        type="checkbox"
                        id="focus-productivity"
                        className="rounded border-2 border-black text-black focus:ring-0"
                      />
                      <label htmlFor="focus-productivity" className="text-sm">
                        Pretend to boost productivity
                      </label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <input
                        type="checkbox"
                        id="focus-existential"
                        className="rounded border-2 border-black text-black focus:ring-0"
                      />
                      <label htmlFor="focus-existential" className="text-sm">
                        Sprinkle in existential crises
                      </label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <input
                        type="checkbox"
                        id="focus-memes"
                        className="rounded border-2 border-black text-black focus:ring-0"
                      />
                      <label htmlFor="focus-memes" className="text-sm">
                        Keep you up-to-date on dank memes
                      </label>
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
          <p className="text-sm">
            © 2023 Serendipity. All your base are belong to us.
          </p>
          <div className="flex space-x-4">
            <a href="#" className="text-sm hover:text-yellow-400">
              Privacy (as if)
            </a>
            <a href="#" className="text-sm hover:text-yellow-400">
              Terms (of chaos)
            </a>
            <a href="#" className="text-sm hover:text-yellow-400">
              Help (you'll need it)
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}
