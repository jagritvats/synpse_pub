"use client"
import { useState, useEffect, useRef } from 'react'
import { Button } from "../../../../components/ui/button"
import { Input } from "../../../../components/ui/input"
import { Textarea } from "../../../../components/ui/textarea"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../../../../components/ui/card"
import { Avatar, AvatarFallback, AvatarImage } from "../../../../components/ui/avatar"
import { ScrollArea } from "../../../../components/ui/scroll-area"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../../../../components/ui/tabs"
import { Progress } from "../../../../components/ui/progress"
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "../../../../components/ui/sheet"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "../../../../components/ui/collapsible"
import { 
  ChevronUp,
  ChevronDown,
  Coffee,
  FileText,
  Heart,
  Image,
  Menu,
  MessageSquare, 
  Moon,
  PlusCircle,
  Smile,
  Sun,
  Zap
} from "lucide-react"

type Message = {
  id: number;
  content: string;
  sender: 'user' | 'companion';
  timestamp: Date;
  isGlobal?: boolean;
}

type Thread = {
  id: number;
  title: string;
  messages: Message[];
}

type Mood = {
  emoji: string;
  description: string;
}

// Placeholder for API calls
const api = {
  sendMessage: async (message: string, isGlobal: boolean) => {
    await new Promise(resolve => setTimeout(resolve, 1000));
    return {
      id: Date.now(),
      content: "I hear you. How does that make you feel?",
      sender: 'companion' as const,
      timestamp: new Date(),
      isGlobal,
    };
  },
  fetchThreads: async () => {
    await new Promise(resolve => setTimeout(resolve, 1000));
    return [
      { id: 1, title: "Late Night Thoughts", messages: [] },
      { id: 2, title: "Weekend Plans", messages: [] },
      { id: 3, title: "Personal Growth", messages: [] },
    ];
  },
};

export default function SerendipityCompanion() {
  const [threads, setThreads] = useState<Thread[]>([]);
  const [activeThread, setActiveThread] = useState<number>(1);
  const [globalMessages, setGlobalMessages] = useState<Message[]>([]);
  const [inputMessage, setInputMessage] = useState('');
  const [journal, setJournal] = useState('');
  const [connectionLevel, setConnectionLevel] = useState(50);
  const [companionThought, setCompanionThought] = useState('');
  const [userMood, setUserMood] = useState<Mood>({ emoji: '😊', description: 'Content' });
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isBottomSectionOpen, setIsBottomSectionOpen] = useState(true);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  const empathicResponses = [
    "I'm here for you. Want to talk about it?",
    "That sounds challenging. How are you coping?",
    "I'm glad you shared that with me. How can I support you?",
    "It's okay to feel that way. What do you need right now?",
    "I appreciate your openness. Let's explore this together.",
  ];

  const companionThoughts = [
    "I wonder what makes them smile...",
    "Their resilience is truly inspiring.",
    "I hope they know how much they've grown.",
    "It's amazing how unique each person's journey is.",
    "I'm grateful for the trust they place in me.",
  ];

  useEffect(() => {
    const fetchInitialData = async () => {
      const fetchedThreads = await api.fetchThreads();
      setThreads(fetchedThreads);
    };
    fetchInitialData();
  }, []);

  useEffect(() => {
    const thoughtInterval = setInterval(() => {
      setCompanionThought(companionThoughts[Math.floor(Math.random() * companionThoughts.length)]);
    }, 30000);

    const connectionInterval = setInterval(() => {
      setConnectionLevel(prev => Math.max(Math.min(prev + Math.floor(Math.random() * 11) - 5, 100), 0));
    }, 60000);

    return () => {
      clearInterval(thoughtInterval);
      clearInterval(connectionInterval);
    };
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [threads, globalMessages]);

  const sendMessage = async (isGlobal: boolean = false) => {
    if (inputMessage.trim() === '') return;

    const newMessage: Message = {
      id: Date.now(),
      content: inputMessage,
      sender: 'user',
      timestamp: new Date(),
      isGlobal,
    };

    if (isGlobal) {
      setGlobalMessages(prev => [...prev, newMessage]);
    } else {
      setThreads(prevThreads => 
        prevThreads.map(thread => 
          thread.id === activeThread 
            ? { ...thread, messages: [...thread.messages, newMessage] }
            : thread
        )
      );
    }

    setInputMessage('');

    try {
      const companionResponse = await api.sendMessage(inputMessage, isGlobal);
      
      if (isGlobal) {
        setGlobalMessages(prev => [...prev, companionResponse]);
      } else {
        setThreads(prevThreads => 
          prevThreads.map(thread => 
            thread.id === activeThread 
              ? { ...thread, messages: [...thread.messages, companionResponse] }
              : thread
          )
        );
      }

      setConnectionLevel(prev => Math.min(prev + 5, 100));
    } catch (error) {
      console.error("Failed to send message:", error);
    }
  };

  return (
    <div className="flex flex-col h-screen bg-gradient-to-br from-yellow-50 to-amber-100">
      <header className="bg-white bg-opacity-90 p-4 shadow-sm flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-amber-700">Serendipity</h1>
          <p className="text-sm text-gray-600">Your empathetic companion</p>
        </div>
        <Sheet open={isSidebarOpen} onOpenChange={setIsSidebarOpen}>
          <SheetTrigger asChild>
            <Button variant="ghost" size="icon">
              <Menu className="h-6 w-6" />
            </Button>
          </SheetTrigger>
          <SheetContent side="left">
            <SheetHeader>
              <SheetTitle>Our Conversations</SheetTitle>
              <SheetDescription>Select a thread or start a new one</SheetDescription>
            </SheetHeader>
            <ScrollArea className="h-[calc(100vh-10rem)] mt-4">
              <Button
                variant="secondary"
                className="w-full justify-start mb-2"
                onClick={() => {
                  setActiveThread(-1);
                  setIsSidebarOpen(false);
                }}
              >
                <Heart className="mr-2 h-4 w-4" />
                Global
              </Button>
              {threads.map(thread => (
                <Button
                  key={thread.id}
                  variant={activeThread === thread.id ? "secondary" : "ghost"}
                  className="w-full justify-start mb-2"
                  onClick={() => {
                    setActiveThread(thread.id);
                    setIsSidebarOpen(false);
                  }}
                >
                  <MessageSquare className="mr-2 h-4 w-4" />
                  {thread.title}
                </Button>
              ))}
            </ScrollArea>
            <Button className="w-full mt-4" onClick={() => {
              const newThread: Thread = {
                id: Date.now(),
                title: `New Conversation ${threads.length + 1}`,
                messages: []
              };
              setThreads([...threads, newThread]);
              setActiveThread(newThread.id);
              setIsSidebarOpen(false);
            }}>
              <PlusCircle className="mr-2 h-4 w-4" />
              New Conversation
            </Button>
          </SheetContent>
        </Sheet>
      </header>
      <div className="flex-1 flex flex-col p-4 overflow-hidden">
        <ScrollArea className="flex-1 pr-4">
          {(activeThread === -1 ? globalMessages : threads.find(t => t.id === activeThread)?.messages || []).map(message => (
            <div key={message.id} className={`mb-4 ${message.sender === 'user' ? 'text-right' : 'text-left'}`}>
              <div className={`inline-block p-3 rounded-lg ${message.sender === 'user' ? 'bg-amber-500 text-white' : 'bg-white'}`}>
                {message.content}
              </div>
              <div className="text-xs text-gray-500 mt-1">
                {message.timestamp.toLocaleTimeString()}
              </div>
            </div>
          ))}
          <div ref={messagesEndRef} />
        </ScrollArea>
        <div className="mt-4 flex">
          <Input
            value={inputMessage}
            onChange={(e) => setInputMessage(e.target.value)}
            placeholder="Share your thoughts..."
            className="flex-1 mr-2"
          />
          <Button onClick={() => sendMessage(activeThread === -1)} className="mr-2">Send</Button>
          <Button variant="outline">
            <Image className="h-4 w-4" />
          </Button>
        </div>
      </div>
      <Collapsible open={isBottomSectionOpen} onOpenChange={setIsBottomSectionOpen}>
        <CollapsibleTrigger asChild>
          <Button variant="ghost" className="w-full flex justify-center items-center">
            {isBottomSectionOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronUp className="h-4 w-4" />}
            {isBottomSectionOpen ? "Hide Companion Space" : "Show Companion Space"}
          </Button>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <Tabs defaultValue="mood" className="p-4 bg-white bg-opacity-80">
            <TabsList className="w-full">
              <TabsTrigger value="mood" className="w-1/3">Mood & Connection</TabsTrigger>
              <TabsTrigger value="journal" className="w-1/3">Reflection Journal</TabsTrigger>
              <TabsTrigger value="companion" className="w-1/3">Companion Insights</TabsTrigger>
            </TabsList>
            <TabsContent value="mood">
              <Card>
                <CardHeader>
                  <CardTitle>Mood & Connection</CardTitle>
                  <CardDescription>How are you feeling today?</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div>
                      <h3 className="text-lg font-semibold mb-2">Your Mood</h3>
                      <div className="flex items-center space-x-2">
                        <span className="text-2xl">{userMood.emoji}</span>
                        <span>{userMood.description}</span>
                      </div>
                      <Button 
                        variant="outline" 
                        className="w-full mt-2"
                        onClick={() => {
                          const moods: Mood[] = [
                            { emoji: '😊', description: 'Content' },
                            { emoji: '😄', description: 'Happy' },
                            { emoji: '😔', description: 'Sad' },
                            { emoji: '😠', description: 'Angry' },
                            { emoji: '😴', description: 'Tired' },
                          ];
                          const newMood = moods[Math.floor(Math.random() * moods.length)];
                          setUserMood(newMood);
                        }}
                      >
                        Update Mood
                      </Button>
                    </div>
                    <div>
                      <h3 className="text-lg font-semibold mb-2">Connection Level</h3>
                      <div className="w-full bg-gray-200 rounded-full h-2.5">
                        <div 
                          className="bg-amber-500 h-2.5 rounded-full transition-all duration-500 ease-in-out" 
                          style={{width: `${connectionLevel}%`}}
                        ></div>
                      </div>
                      <p className="text-sm text-gray-600 mt-1">
                        {connectionLevel < 30 ? "I'm here whenever you need me." :
                         connectionLevel < 60 ? "We're building a great connection!" :
                         connectionLevel < 90 ? "I feel like we really understand each other." :
                         "Our connection is truly special."}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
            <TabsContent value="journal">
              <Card>
                <CardHeader>
                  <CardTitle>Reflection Journal</CardTitle>
                  <CardDescription>A safe space for your thoughts</CardDescription>
                </CardHeader>
                <CardContent>
                  <Textarea
                    value={journal}
                    onChange={(e) => setJournal(e.target.value)}
                    placeholder="Write your reflections here. This is a judgment-free zone."
                    className="min-h-[150px]"
                  />
                </CardContent>
              </Card>
            </TabsContent>
            <TabsContent value="companion">
              <Card>
                <CardHeader>
                  <CardTitle>Companion Insights</CardTitle>
                  <CardDescription>Thoughts and observations to support you</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div>
                      <h3 className="text-lg font-semibold mb-2">Companion Thought</h3>
                      <p className="text-sm italic text-gray-600">{companionThought}</p>
                    </div>
                    <div>
                      <h3 className="text-lg font-semibold mb-2">Daily Inspiration</h3>
                      <Button 
                        variant="outline" 
                        className="w-full"
                        onClick={() => alert(empathicResponses[Math.floor(Math.random() * empathicResponses.length)])}
                      >
                        <Smile className="mr-2 h-4 w-4" />
                        Get an Empathetic Message
                      </Button>
                    </div>
                    <div>
                      <h3 className="text-lg font-semibold mb-2">Mood Tracker</h3>
                      <div className="flex justify-between">
                        <Moon className="h-6 w-6 text-indigo-600" />
                        <Sun className="h-6 w-6 text-yellow-500" />
                        <Coffee className="h-6 w-6 text-brown-500" />
                        <Zap className="h-6 w-6 text-purple-500" />
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </CollapsibleContent>
      </Collapsible>
    </div>
  )
}