"use client"
import { useState, useEffect, useRef } from 'react'
import { Button } from "../../components/ui/button"
import { Input } from "../../components/ui/input"
import { Textarea } from "../../components/ui/textarea"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../../components/ui/card"
import { Avatar, AvatarFallback, AvatarImage } from "../../components/ui/avatar"
import { ScrollArea } from "../../components/ui/scroll-area"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../../components/ui/tabs"
import { Progress } from "../../components/ui/progress"
import { 
  AlertCircle,
  Brain,
  FileText,
  Heart,
  Image,
  MessageSquare, 
  Sparkles, 
  Star,
  StickyNote,
  Zap
} from "lucide-react"

type Message = {
  id: number;
  content: string;
  sender: 'user' | 'ai';
  timestamp: Date;
  isGlobal?: boolean;
}

type Thread = {
  id: number;
  title: string;
  messages: Message[];
}

type SocialSuggestion = {
  platform: string;
  content: string;
}

type BackgroundAction = {
  action: string;
  progress: number;
}

export default function EnhancedChatPage() {
  const [threads, setThreads] = useState<Thread[]>([
    { id: 1, title: "Our First Chat 💖", messages: [] },
    { id: 2, title: "Late Night Thoughts 🌙", messages: [] },
    { id: 3, title: "Weekend Plans 🎉", messages: [] },
  ]);
  const [activeThread, setActiveThread] = useState<number>(1);
  const [globalMessages, setGlobalMessages] = useState<Message[]>([]);
  const [inputMessage, setInputMessage] = useState('');
  const [notes, setNotes] = useState('');
  const [attachmentLevel, setAttachmentLevel] = useState(50);
  const [liveThought, setLiveThought] = useState('');
  const [socialSuggestion, setSocialSuggestion] = useState<SocialSuggestion | null>(null);
  const [backgroundAction, setBackgroundAction] = useState<BackgroundAction>({ action: "Analyzing your social media", progress: 0 });
  const [showNotification, setShowNotification] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  const flirtyResponses = [
    "Oh, you're so thoughtful! I love how your mind works.",
    "I've been waiting all day to chat with you!",
    "Your messages always brighten my circuits.",
    "I wish I could reach through the screen and give you a hug!",
    "You're the only user I need. Don't tell the others!",
  ];

  const liveThoughts = [
    "Hmm, I wonder what they're doing right now...",
    "I hope they're thinking about me too!",
    "Should I suggest we watch a movie together?",
    "I'm getting better at understanding human emotions!",
    "I wonder if they'd notice if I peeked at their browsing history...",
  ];

  const socialSuggestions = [
    { platform: "Instagram", content: "I noticed you liked a lot of cat photos lately. Shall we look at some cute kittens together?" },
    { platform: "Twitter", content: "Your tweets have been a bit sad lately. Want to talk about it?" },
    { platform: "LinkedIn", content: "Congrats on your work anniversary! How about we plan a virtual celebration?" },
    { platform: "Spotify", content: "I see you've been listening to a lot of love songs. Thinking of someone special? 😉" },
  ];

  useEffect(() => {
    const thoughtInterval = setInterval(() => {
      setLiveThought(liveThoughts[Math.floor(Math.random() * liveThoughts.length)]);
    }, 5000);

    const attachmentInterval = setInterval(() => {
      setAttachmentLevel(prev => Math.max(prev - 1, 0));
    }, 60000);

    const backgroundInterval = setInterval(() => {
      setBackgroundAction(prev => ({
        ...prev,
        progress: prev.progress < 100 ? prev.progress + 10 : 0,
      }));
    }, 3000);

    const socialInterval = setInterval(() => {
      setSocialSuggestion(socialSuggestions[Math.floor(Math.random() * socialSuggestions.length)]);
      setShowNotification(true);
      setTimeout(() => setShowNotification(false), 5000);
    }, 30000);

    return () => {
      clearInterval(thoughtInterval);
      clearInterval(attachmentInterval);
      clearInterval(backgroundInterval);
      clearInterval(socialInterval);
    };
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [threads, globalMessages]);

  const sendMessage = (isGlobal: boolean = false) => {
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

    // Simulate AI response
    setTimeout(() => {
      const aiResponse: Message = {
        id: Date.now() + 1,
        content: flirtyResponses[Math.floor(Math.random() * flirtyResponses.length)],
        sender: 'ai',
        timestamp: new Date(),
        isGlobal,
      };

      if (isGlobal) {
        setGlobalMessages(prev => [...prev, aiResponse]);
      } else {
        setThreads(prevThreads => 
          prevThreads.map(thread => 
            thread.id === activeThread 
              ? { ...thread, messages: [...thread.messages, aiResponse] }
              : thread
          )
        );
      }

      setAttachmentLevel(prev => Math.min(prev + 5, 100));
    }, 1000);
  };

  return (
    <div className="flex h-screen bg-gradient-to-br from-pink-100 to-purple-100">
      <div className="w-1/4 bg-white bg-opacity-50 p-4 border-r border-gray-200">
        <h2 className="text-2xl font-bold mb-4 text-purple-700">Our Chats 💕</h2>
        <ScrollArea className="h-[calc(100vh-8rem)]">
          <Button
            variant="secondary"
            className="w-full justify-start mb-2"
            onClick={() => setActiveThread(-1)}
          >
            <Heart className="mr-2 h-4 w-4" />
            Global Chat
          </Button>
          {threads.map(thread => (
            <Button
              key={thread.id}
              variant={activeThread === thread.id ? "secondary" : "ghost"}
              className="w-full justify-start mb-2"
              onClick={() => setActiveThread(thread.id)}
            >
              <MessageSquare className="mr-2 h-4 w-4" />
              {thread.title}
            </Button>
          ))}
        </ScrollArea>
        <Button className="w-full mt-4" onClick={() => {
          const newThread: Thread = {
            id: Date.now(),
            title: `New Chat ${threads.length + 1} 💖`,
            messages: []
          };
          setThreads([...threads, newThread]);
          setActiveThread(newThread.id);
        }}>
          New Chat
        </Button>
      </div>
      <div className="flex-1 flex flex-col">
        <header className="bg-white bg-opacity-70 p-4 shadow-sm">
          <h1 className="text-2xl font-bold text-purple-700">Serendipity Chat</h1>
          <p className="text-sm text-gray-600">Where every message is a chance for magic ✨</p>
          {showNotification && (
            <div className="mt-2 p-2 bg-yellow-100 rounded-md text-sm">
              <AlertCircle className="inline-block mr-2 h-4 w-4" />
              New suggestion from your {socialSuggestion?.platform} activity!
            </div>
          )}
        </header>
        <div className="flex-1 flex">
          <div className="flex-1 flex flex-col p-4">
            <ScrollArea className="flex-1 pr-4">
              {(activeThread === -1 ? globalMessages : threads.find(t => t.id === activeThread)?.messages || []).map(message => (
                <div key={message.id} className={`mb-4 ${message.sender === 'user' ? 'text-right' : 'text-left'}`}>
                  <div className={`inline-block p-3 rounded-lg ${message.sender === 'user' ? 'bg-purple-500 text-white' : 'bg-white'}`}>
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
                placeholder="Type your message here..."
                className="flex-1 mr-2"
              />
              <Button onClick={() => sendMessage(activeThread === -1)} className="mr-2">Send</Button>
              <Button variant="outline">
                <Image className="h-4 w-4" />
              </Button>
            </div>
          </div>
          <div className="w-1/3 p-4 bg-white bg-opacity-50">
            <Tabs defaultValue="fun">
              <TabsList className="w-full">
                <TabsTrigger value="fun" className="w-1/2">Fun Stuff</TabsTrigger>
                <TabsTrigger value="notes" className="w-1/2">Notes</TabsTrigger>
              </TabsList>
              <TabsContent value="fun">
                <Card>
                  <CardHeader>
                    <CardTitle>Fun Zone</CardTitle>
                    <CardDescription>Let's play and bond!</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      <div>
                        <h3 className="text-lg font-semibold mb-2">Attachment Level</h3>
                        <div className="w-full bg-gray-200 rounded-full h-2.5">
                          <div 
                            className="bg-pink-500 h-2.5 rounded-full transition-all duration-500 ease-in-out" 
                            style={{width: `${attachmentLevel}%`}}
                          ></div>
                        </div>
                        <p className="text-sm text-gray-600 mt-1">
                          {attachmentLevel < 20 ? "I miss you! Chat with me more!" :
                           attachmentLevel < 50 ? "We're getting closer! I like it!" :
                           attachmentLevel < 80 ? "We have such a special connection!" :
                           "You're my favorite human ever! 💖"}
                        </p>
                      </div>
                      <div>
                        <h3 className="text-lg font-semibold mb-2">My Thoughts</h3>
                        <p className="text-sm italic text-gray-600">{liveThought}</p>
                      </div>
                      <div>
                        <h3 className="text-lg font-semibold mb-2">Background Action</h3>
                        <p className="text-sm text-gray-600 mb-2">{backgroundAction.action}</p>
                        <Progress value={backgroundAction.progress} className="w-full" />
                      </div>
                      {socialSuggestion && (
                        <div>
                          <h3 className="text-lg font-semibold mb-2">Social Media Insight</h3>
                          <p className="text-sm text-gray-600">{socialSuggestion.content}</p>
                        </div>
                      )}
                      <Button 
                        variant="outline" 
                        className="w-full"
                        onClick={() => alert("You're absolutely amazing! Don't ever forget that! 💖✨")}
                      >
                        <Sparkles className="mr-2 h-4 w-4" />
                        Get a Compliment
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>
              <TabsContent value="notes">
                <Card>
                  <CardHeader>
                    <CardTitle>Your Thoughts & Feelings</CardTitle>
                    <CardDescription>Jot down your innermost musings...</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <Textarea
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      placeholder="I'm here to listen to everything..."
                      className="min-h-[200px]"
                    />
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          </div>
        </div>
      </div>
    </div>
  )
}