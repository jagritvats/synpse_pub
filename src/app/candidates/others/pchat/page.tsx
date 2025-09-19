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
  AlertCircle,
  Brain,
  ChevronUp,
  ChevronDown,
  Clock,
  FileText,
  Lightbulb,
  Menu,
  MessageSquare, 
  PlusCircle,
  Sparkles, 
  Star,
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

type Reminder = {
  id: number;
  content: string;
  dueDate: Date;
}

type Task = {
  id: number;
  content: string;
  completed: boolean;
}

// Placeholder for API calls
const api = {
  sendMessage: async (message: string, isGlobal: boolean) => {
    await new Promise(resolve => setTimeout(resolve, 1000));
    return {
      id: Date.now(),
      content: "I've processed your request. How else can I assist you today?",
      sender: 'ai' as const,
      timestamp: new Date(),
      isGlobal,
    };
  },
  fetchThreads: async () => {
    await new Promise(resolve => setTimeout(resolve, 1000));
    return [
      { id: 1, title: "Project Brainstorming", messages: [] },
      { id: 2, title: "Task Planning", messages: [] },
      { id: 3, title: "Weekly Review", messages: [] },
    ];
  },
};

export default function ProductivityAssistant() {
  const [threads, setThreads] = useState<Thread[]>([]);
  const [activeThread, setActiveThread] = useState<number>(1);
  const [globalMessages, setGlobalMessages] = useState<Message[]>([]);
  const [inputMessage, setInputMessage] = useState('');
  const [notes, setNotes] = useState('');
  const [productivityScore, setProductivityScore] = useState(70);
  const [aiSuggestion, setAiSuggestion] = useState('');
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isBottomSectionOpen, setIsBottomSectionOpen] = useState(true);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  const productivityTips = [
    "Try the Pomodoro Technique: 25 minutes of focused work, then a 5-minute break.",
    "Set SMART goals: Specific, Measurable, Achievable, Relevant, and Time-bound.",
    "Prioritize your tasks using the Eisenhower Matrix.",
    "Take regular breaks to maintain focus and prevent burnout.",
    "Use the 2-minute rule: If a task takes less than 2 minutes, do it immediately.",
  ];

  useEffect(() => {
    const fetchInitialData = async () => {
      const fetchedThreads = await api.fetchThreads();
      setThreads(fetchedThreads);
    };
    fetchInitialData();
  }, []);

  useEffect(() => {
    const tipInterval = setInterval(() => {
      setAiSuggestion(productivityTips[Math.floor(Math.random() * productivityTips.length)]);
    }, 30000);

    const productivityInterval = setInterval(() => {
      setProductivityScore(prev => Math.max(Math.min(prev + Math.floor(Math.random() * 11) - 5, 100), 0));
    }, 60000);

    return () => {
      clearInterval(tipInterval);
      clearInterval(productivityInterval);
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
      const aiResponse = await api.sendMessage(inputMessage, isGlobal);
      
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

      setProductivityScore(prev => Math.min(prev + 5, 100));
    } catch (error) {
      console.error("Failed to send message:", error);
    }
  };

  const addReminder = (content: string, dueDate: Date) => {
    setReminders(prev => [...prev, { id: Date.now(), content, dueDate }]);
  };

  const addTask = (content: string) => {
    setTasks(prev => [...prev, { id: Date.now(), content, completed: false }]);
  };

  const toggleTaskCompletion = (id: number) => {
    setTasks(prev => prev.map(task => 
      task.id === id ? { ...task, completed: !task.completed } : task
    ));
  };

  return (
    <div className="flex flex-col h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      <header className="bg-white bg-opacity-90 p-4 shadow-sm flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-indigo-700">Serendipity Assistant</h1>
          <p className="text-sm text-gray-600">Your productivity companion</p>
        </div>
        <Sheet open={isSidebarOpen} onOpenChange={setIsSidebarOpen}>
          <SheetTrigger asChild>
            <Button variant="ghost" size="icon">
              <Menu className="h-6 w-6" />
            </Button>
          </SheetTrigger>
          <SheetContent side="left">
            <SheetHeader>
              <SheetTitle>Conversation Threads</SheetTitle>
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
                <Zap className="mr-2 h-4 w-4" />
                Quick Assist
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
                title: `New Thread ${threads.length + 1}`,
                messages: []
              };
              setThreads([...threads, newThread]);
              setActiveThread(newThread.id);
              setIsSidebarOpen(false);
            }}>
              <PlusCircle className="mr-2 h-4 w-4" />
              New Thread
            </Button>
          </SheetContent>
        </Sheet>
      </header>
      <div className="flex-1 flex flex-col p-4 overflow-hidden">
        <ScrollArea className="flex-1 pr-4">
          {(activeThread === -1 ? globalMessages : threads.find(t => t.id === activeThread)?.messages || []).map(message => (
            <div key={message.id} className={`mb-4 ${message.sender === 'user' ? 'text-right' : 'text-left'}`}>
              <div className={`inline-block p-3 rounded-lg ${message.sender === 'user' ? 'bg-indigo-500 text-white' : 'bg-white'}`}>
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
            <FileText className="h-4 w-4" />
          </Button>
        </div>
      </div>
      <Collapsible open={isBottomSectionOpen} onOpenChange={setIsBottomSectionOpen}>
        <CollapsibleTrigger asChild>
          <Button variant="ghost" className="w-full flex justify-center items-center">
            {isBottomSectionOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronUp className="h-4 w-4" />}
            {isBottomSectionOpen ? "Hide Productivity Tools" : "Show Productivity Tools"}
          </Button>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <Tabs defaultValue="productivity" className="p-4 bg-white bg-opacity-80">
            <TabsList className="w-full">
              <TabsTrigger value="productivity" className="w-1/3">Productivity</TabsTrigger>
              <TabsTrigger value="tasks" className="w-1/3">Tasks & Reminders</TabsTrigger>
              <TabsTrigger value="notes" className="w-1/3">Quick Notes</TabsTrigger>
            </TabsList>
            <TabsContent value="productivity">
              <Card>
                <CardHeader>
                  <CardTitle>Productivity Insights</CardTitle>
                  <CardDescription>Track your progress and get personalized tips</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div>
                      <h3 className="text-lg font-semibold mb-2">Productivity Score</h3>
                      <div className="w-full bg-gray-200 rounded-full h-2.5">
                        <div 
                          className="bg-green-500 h-2.5 rounded-full transition-all duration-500 ease-in-out" 
                          style={{width: `${productivityScore}%`}}
                        ></div>
                      </div>
                      <p className="text-sm text-gray-600 mt-1">
                        {productivityScore < 30 ? "Looks like you could use a productivity boost. Let's work on that!" :
                         productivityScore < 60 ? "You're making progress. Keep it up!" :
                         productivityScore < 90 ? "Great job! You're on a roll." :
                         "Wow, you're a productivity machine!"}
                      </p>
                    </div>
                    <div>
                      <h3 className="text-lg font-semibold mb-2">AI Suggestion</h3>
                      <p className="text-sm italic text-gray-600">{aiSuggestion}</p>
                    </div>
                    <Button 
                      variant="outline" 
                      className="w-full"
                      onClick={() => alert("Here's a fun fact: Taking regular breaks can actually improve your overall productivity!")}
                    >
                      <Lightbulb className="mr-2 h-4 w-4" />
                      Get a Productivity Tip
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
            <TabsContent value="tasks">
              <Card>
                <CardHeader>
                  <CardTitle>Tasks & Reminders</CardTitle>
                  <CardDescription>Stay on top of your to-dos</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div>
                      <h3 className="text-lg font-semibold mb-2">Tasks</h3>
                      <ul className="space-y-2">
                        {tasks.map(task => (
                          <li key={task.id} className="flex items-center">
                            <input
                              type="checkbox"
                              checked={task.completed}
                              onChange={() => toggleTaskCompletion(task.id)}
                              className="mr-2"
                            />
                            <span className={task.completed ? 'line-through text-gray-500' : ''}>{task.content}</span>
                          </li>
                        ))}
                      </ul>
                      <Input
                        placeholder="Add a new task"
                        onKeyPress={(e) => {
                          if (e.key === 'Enter') {
                            addTask(e.currentTarget.value);
                            e.currentTarget.value = '';
                          }
                        }}
                        className="mt-2"
                      />
                    </div>
                    <div>
                      <h3 className="text-lg font-semibold mb-2">Reminders</h3>
                      <ul className="space-y-2">
                        {reminders.map(reminder => (
                          <li key={reminder.id} className="flex items-center">
                            <Clock className="mr-2 h-4 w-4" />
                            <span>{reminder.content} - {reminder.dueDate.toLocaleString()}</span>
                          </li>
                        ))}
                      </ul>
                      <Button
                        variant="outline"
                        className="w-full mt-2"
                        onClick={() => {
                          const content = prompt('Enter reminder content:');
                          const dueDate = new Date(prompt('Enter due date (YYYY-MM-DD HH:MM):') || '');
                          if (content && !isNaN(dueDate.getTime())) {
                            addReminder(content, dueDate);
                          }
                        }}
                      >
                        Add Reminder
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
            <TabsContent value="notes">
              <Card>
                <CardHeader>
                  <CardTitle>Quick Notes</CardTitle>
                  <CardDescription>Jot down your ideas and thoughts</CardDescription>
                </CardHeader>
                <CardContent>
                  <Textarea
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Type your notes here. Don't worry, I won't judge your spelling... much."
                    className="min-h-[150px]"
                  />
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </CollapsibleContent>
      </Collapsible>
    </div>
  )
}