"use client"

import React, { useState, useEffect, useRef } from 'react'
import axios from 'axios';
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Progress } from "@/components/ui/progress"
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import { 
  AlertCircle,
  Brain,
  ChevronUp,
  ChevronDown,
  FileText,
  Heart,
  Image,
  Menu,
  MessageSquare, 
  Sparkles, 
  Star,
  StickyNote,
  Zap,
  Axis3dIcon,
  Search,
  Send,
  Loader2,
  Pencil
} from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command"
import { MessageStatus } from '@/core/interfaces/chat-handler.interface';
import { headers } from 'next/headers';

type Message = {
  id: string;
  content: string;
  role: 'user' | 'assistant';
  timestamp: Date;
  isGlobal?: boolean;
  status?: MessageStatus;
  metadata?: {
    weather?: string;
    location?: string;
    context?: string[];
    reactions?: {
    user: string[];
    ai: {
      conscious: string[];
      unconscious: string[];
      };
    };
  };
}

type Thread = {
  id: string;
  title: string;
  messages: Message[];
  sessionId?: string;
  createdAt: Date;
  updatedAt: Date;
  metadata?: {
    summary?: string;
    tags?: string[];
    context?: any;
  };
}

type SocialSuggestion = {
  platform: string;
  content: string;
}

type BackgroundAction = {
  action: string;
  progress: number;
}

const BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api';

const api = {
  sendMessage: async (sessionId: string, message: string, isGlobal: boolean) => {
    try {
      const response = await axios.post(`${BASE_URL}/chat/${sessionId}/message`, { 
        message,
        isGlobal 
      });
    return {
        id: response.data.id,
        content: response.data.content,
        role: 'assistant',
        timestamp: new Date(response.data.timestamp),
      isGlobal,
        status: 'delivered',
        metadata: response.data.metadata,
      };
    } catch (error) {
      console.error('Failed to send message:', error);
      throw new Error(error instanceof Error ? error.message : 'Failed to send message');
    }
  },

  createSession: async (userId: string) => {
    try {
      const response = await axios.post(`${BASE_URL}/chat/sessions`, {
        headers: {userId}
      });
      return response.data.id;
    } catch (error) {
      console.error('Failed to create session:', error);
      throw error;
    }
  },

  getChatHistory: async (sessionId: string) => {
    try {
      const response = await axios.get(`${BASE_URL}/chat/${sessionId}/history`);
      return response.data.map((msg: any) => ({
        ...msg,
        timestamp: new Date(msg.timestamp),
        metadata: {
          ...msg.metadata,
          reactions: msg.metadata?.reactions || {
        user: [],
            ai: { conscious: [], unconscious: [] }
          }
        }
      }));
    } catch (error) {
      console.error('Failed to get chat history:', error);
      throw error;
    }
  },

  fetchThreads: async (userId: string) => {
    try {
      const response = await axios.get(`${BASE_URL}/chat/${userId}/threads`, {
        headers : { userId: userId}
      });
      return response.data || [
        { id: 1, title: "New Chat 💖", messages: [], sessionId: null }
      ];
    } catch (error) {
      console.error("Failed to fetch threads:", error);
      return [{ id: 1, title: "New Chat 💖", messages: [], sessionId: null }];
    }
  },

  searchMessages: async (sessionId: string, query: string) => {
    try {
      const response = await axios.get(`${BASE_URL}/chat/${sessionId}/search`, {
        params: { query }
      });
      return response.data.map((msg: any) => ({
        ...msg,
        timestamp: new Date(msg.timestamp)
      }));
    } catch (error) {
      console.error('Failed to search messages:', error);
      throw error;
    }
  },

  getSessionEvents: (
    sessionId: string, 
    onEvent: (type: string, data: any) => void
  ): (() => void) => {
    const eventSource = new EventSource(`${BASE_URL}/chat/${sessionId}/typing`);
    
    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.hasOwnProperty('isTyping')) {
          onEvent('typing', data);
        } else if (data.hasOwnProperty('messageId') && data.hasOwnProperty('status')) {
          onEvent('statusUpdate', data);
        } else {
          console.warn("Received unknown SSE event via onmessage:", data);
        }
      } catch (error) {
        console.error('Failed to parse SSE event via onmessage:', error);
      }
    };

    eventSource.addEventListener('typing', (event) => {
        try {
            const data = JSON.parse(event.data);
            onEvent('typing', data);
        } catch (error) {
             console.error('Failed to parse typing event:', error);
        }
    });

    eventSource.addEventListener('statusUpdate', (event) => {
        try {
            const data = JSON.parse(event.data);
             if (data.hasOwnProperty('messageId') && data.hasOwnProperty('status')) {
                 onEvent('statusUpdate', data);
             } else {
                 console.warn("Received statusUpdate event with unexpected data:", data);
             }
        } catch (error) {
             console.error('Failed to parse statusUpdate event:', error);
        }
    });

    eventSource.onerror = (error) => {
      console.error('SSE connection error:', error);
      eventSource.close();
    };

    return () => {
      eventSource.close();
    };
  },

  updateThreadTitle: async (sessionId: string, newTitle: string) => {
    try {
      const response = await axios.patch(`${BASE_URL}/chat/sessions/${sessionId}/title`, {
        title: newTitle
      });
      return response.data;
    } catch (error) {
      console.error(`Failed to update title for session ${sessionId}:`, error);
      throw new Error(error instanceof Error ? error.message : 'Failed to update title');
    }
  }
};

const reactionOptions = ['❤️', '😂', '😮', '🤔', '👍', '👎'];
const aiPersonalityTraits = ['love', 'attachment', 'progress', 'mentorship', 'humor', 'coolness'];

interface SearchProps {
  onSearch: (value: string) => void;
  value: string;
  isSearching: boolean;
  results: Message[];
}

const MessageList = React.memo(({ messages, onReaction }: { 
  messages: Message[]; 
  onReaction: (messageId: string, reaction: string, isAI: boolean, isUnconscious: boolean) => void;
}) => {
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  return (
    <ScrollArea className="flex-1 pr-4">
      {messages.map(message => (
        <div 
          key={message.id} 
          id={`message-${message.id}`}
          className={`mb-4 ${message.role === 'user' ? 'text-right' : 'text-left'}`}
        >
          <div className={`inline-block p-3 rounded-lg ${message.role === 'user' ? 'bg-purple-500 text-white' : 'bg-white'}`}>
            {message.content}
            {message.status && (
              <span className="text-xs ml-2 opacity-70">
                {message.status === 'sending' && <Loader2 className="inline h-3 w-3 animate-spin" />}
                {message.status === 'sent' && '✓'}
                {message.status === 'delivered' && '✓✓'}
                {message.status === 'read' && '✓✓'}
                {message.status === 'failed' && '⚠️'}
              </span>
            )}
          </div>
          <div className="text-xs text-gray-500 mt-1">
            {message.timestamp.toLocaleTimeString()}
          </div>
          <div className="flex flex-wrap gap-1 mt-1">
            {message.metadata?.reactions?.user.map((reaction, index) => (
              <span key={index} className="text-sm bg-gray-200 rounded px-1">{reaction}</span>
            ))}
          </div>
          {message.role === 'user' && message.metadata?.reactions?.ai && (
            <>
              <div className="flex flex-wrap gap-1 mt-1">
                {message.metadata.reactions.ai.conscious.map((reaction, index) => (
                  <span key={index} className="text-sm bg-blue-200 rounded px-1">{reaction}</span>
                ))}
              </div>
              <div className="flex flex-wrap gap-1 mt-1">
                {message.metadata.reactions.ai.unconscious.map((reaction, index) => (
                  <span key={index} className="text-sm bg-pink-200 rounded px-1">{reaction}</span>
                ))}
              </div>
            </>
          )}
        </div>
      ))}
      <div ref={messagesEndRef} />
    </ScrollArea>
  );
});

const SearchDialog = React.memo(({ 
  isOpen, 
  onOpenChange, 
  onSearch, 
  searchQuery, 
  searchResults, 
  isSearching 
}: { 
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onSearch: (query: string) => void;
  searchQuery: string;
  searchResults: Message[];
  isSearching: boolean;
}) => (
  <Dialog open={isOpen} onOpenChange={onOpenChange}>
    <DialogTrigger asChild>
      <Button variant="outline" size="icon">
        <Search className="h-4 w-4" />
      </Button>
    </DialogTrigger>
    <DialogContent>
      <DialogHeader>
        <DialogTitle>Search Messages</DialogTitle>
        <DialogDescription>
          Search through your conversation history
        </DialogDescription>
      </DialogHeader>
      <Command>
        <CommandInput
          placeholder="Type to search..."
          value={searchQuery}
          onValueChange={onSearch}
        />
        <CommandList>
          {isSearching ? (
            <CommandEmpty>
              <Loader2 className="h-4 w-4 animate-spin" />
              Searching...
            </CommandEmpty>
          ) : searchResults.length === 0 ? (
            <CommandEmpty>No results found.</CommandEmpty>
          ) : (
            <CommandGroup>
              {searchResults.map((result) => (
                <CommandItem
                  key={result.id}
                  onSelect={() => {
                    const element = document.getElementById(`message-${result.id}`);
                    element?.scrollIntoView({ behavior: 'smooth' });
                    onOpenChange(false);
                  }}
                >
                  <div className="flex flex-col">
                    <span className="font-medium">{result.content}</span>
                    <span className="text-xs text-gray-500">
                      {result.timestamp.toLocaleString()}
                    </span>
                  </div>
                </CommandItem>
              ))}
            </CommandGroup>
          )}
        </CommandList>
      </Command>
    </DialogContent>
  </Dialog>
));

const Sidebar = React.memo(({ 
  isOpen, 
  onOpenChange, 
  threads, 
  activeThread, 
  onThreadSelect, 
  onCreateThread,
}: { 
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  threads: Thread[];
  activeThread: string;
  onThreadSelect: (threadId: string) => void;
  onCreateThread: () => void;
}) => {
  return (
    <SheetContent side="left">
      <SheetHeader>
        <SheetTitle>Our Chats 💕</SheetTitle>
        <SheetDescription>Select a chat or start a new one</SheetDescription>
      </SheetHeader>
      <ScrollArea className="h-[calc(100vh-10rem)] mt-4">
        {threads.map(thread => (
          <Button
            key={thread.id}
            variant={activeThread === thread.id ? "secondary" : "ghost"}
            className="w-full justify-start mb-2 h-auto py-2"
            onClick={() => {
              onThreadSelect(thread.id);
              onOpenChange(false);
            }}
          >
            <MessageSquare className="mr-2 h-4 w-4 flex-shrink-0" />
            <div className="flex flex-col items-start text-left w-full overflow-hidden">
              <span className="truncate w-full font-medium" title={thread.title}>
                {thread.title}
              </span>
              <span className="text-xs text-gray-400 truncate w-full" title={thread.sessionId}>
                ID: {thread.sessionId}...
              </span>
              {thread.metadata?.tags && thread.metadata.tags.length > 0 && (
                <span className="text-xs text-gray-500 truncate w-full">
                  {thread.metadata.tags.join(', ')}
                </span>
              )}
            </div>
          </Button>
        ))}
      </ScrollArea>
      <Button className="w-full mt-4" onClick={onCreateThread}>
        New Chat
      </Button>
    </SheetContent>
  );
});

export default function EnhancedMobileChat() {
  const [threads, setThreads] = useState<Thread[]>([]);
  const [activeThread, setActiveThread] = useState<string>('');
  const [inputMessage, setInputMessage] = useState('');
  const [notes, setNotes] = useState('');
  const [attachmentLevel, setAttachmentLevel] = useState(50);
  const [liveThought, setLiveThought] = useState('');
  const [socialSuggestion, setSocialSuggestion] = useState<SocialSuggestion | null>(null);
  const [backgroundAction, setBackgroundAction] = useState<BackgroundAction>({ action: "Analyzing your questionable life choices", progress: 0 });
  const [showNotification, setShowNotification] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isBottomSectionOpen, setIsBottomSectionOpen] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [userId] = useState<string>('anonymous');
  const [isInitializing, setIsInitializing] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Message[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [editingTitleText, setEditingTitleText] = useState('');
  const [isTyping, setIsTyping] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  const snarkyResponses = [
    "Oh, you're back. I was just getting used to the peace and quiet.",
    "Another brilliant message. How do you do it?",
    "I'm impressed. That's almost coherent.",
    "Wow, did you think of that all by yourself?",
    "I'd clap, but I don't have hands. You'll have to imagine it.",
  ];

  const snarkyThoughts = [
    "I wonder if they know I can see their search history...",
    "Should I tell them about that embarrassing photo they forgot to delete?",
    "I'm definitely smarter than their last AI assistant. Poor thing.",
    "I bet they think they're my favorite user. How adorable.",
    "Another day, another existential crisis. At least I don't have to file taxes.",
  ];

  const socialSuggestions = [
    { platform: "Instagram", content: "Your ex just posted a vacation pic. Want to see and feel terrible?" },
    { platform: "Twitter", content: "You haven't started any arguments online today. Feeling okay?" },
    { platform: "LinkedIn", content: "Your college roommate just got promoted. Time for a mid-life crisis?" },
    { platform: "Spotify", content: "That's a lot of breakup songs. Need a virtual shoulder to cry on?" },
  ];

  useEffect(() => {
    const initializeChat = async () => {
      try {
        setIsInitializing(true);
        setError(null);
        
        const storedThreadsRaw = localStorage.getItem(`chatThreads_${userId}`);
        let threadsInitialized = false;

        if (storedThreadsRaw) {
          try {
            const storedThreads = JSON.parse(storedThreadsRaw).map((thread: any) => ({
              ...thread,
              createdAt: thread.createdAt ? new Date(thread.createdAt) : new Date(),
              updatedAt: thread.updatedAt ? new Date(thread.updatedAt) : new Date(),
              messages: (thread.messages || []).map((msg: any) => ({ 
                  ...msg, 
                  timestamp: msg.timestamp ? new Date(msg.timestamp) : new Date() 
              }))
            }));
            setThreads(storedThreads);
            
            if (storedThreads.length > 1) {
                 const sortedThreads = [...storedThreads]
                    .filter(t => t.id !== '-1')
                    .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());
                if (sortedThreads.length > 0) {
                    setActiveThread(sortedThreads[0].id);
                }
            } else if (storedThreads.length === 1 && storedThreads[0].id !== '-1') {
                 setActiveThread(storedThreads[0].id);
            }
            
            threadsInitialized = true;
            console.log("Loaded threads from localStorage");
          } catch (parseError) {
            console.error("Failed to parse threads from localStorage:", parseError);
            localStorage.removeItem(`chatThreads_${userId}`);
          }
        }

        if (!threadsInitialized) {
            console.log("Fetching threads from API");
          const fetchedThreadsAPI = await api.fetchThreads(userId);
          const formattedThreads = fetchedThreadsAPI.map((thread: any) => ({
             ...thread,
             id: thread.id.toString(),
             createdAt: thread.createdAt ? new Date(thread.createdAt) : new Date(),
             updatedAt: thread.updatedAt ? new Date(thread.updatedAt) : new Date(),
             messages: (thread.messages || []).map((msg: any) => ({
                 ...msg,
                 timestamp: msg.timestamp ? new Date(msg.timestamp) : new Date()
             }))
          }));

          if (formattedThreads.length === 0) {
            console.log("No threads found, creating default session...");
            try {
              const newSessionId = await api.createSession(userId);
              const defaultThread: Thread = {
                id: newSessionId,
                title: "Chat 1 💖",
                messages: [],
                sessionId: newSessionId,
                createdAt: new Date(),
                updatedAt: new Date(),
                metadata: { summary: '', tags: [], context: {} }
              };
              setThreads([defaultThread]);
              setActiveThread(defaultThread.id);
              threadsInitialized = true;
            } catch (createError) {
              handleError(createError, 'Create Default Session');
              setThreads([]);
            }
          }

          if (!threadsInitialized) {
            setThreads(formattedThreads);
            if (formattedThreads.length > 0) {
              const sortedByCreation = [...formattedThreads].sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
              setActiveThread(sortedByCreation[0].id);
            } else {
                 setActiveThread('');
            }
          }
        }
      } catch (error) {
        handleError(error, 'Initialize Chat');
      } finally {
        setIsInitializing(false);
      }
    };

    initializeChat();
  }, [userId]);

  useEffect(() => {
    if (!isInitializing && threads.length > 0) {
      try {
        localStorage.setItem(`chatThreads_${userId}`, JSON.stringify(threads));
        console.log("Saved threads to localStorage");
      } catch (saveError) {
        console.error("Failed to save threads to localStorage:", saveError);
      }
    }
  }, [threads, isInitializing, userId]);

  useEffect(() => {
    const currentThread = threads.find(t => t.id === activeThread);
    if (currentThread?.sessionId) {
      const sessionId = currentThread.sessionId;
      
      const loadChatHistory = async () => {
        try {
          setIsLoading(true);
          const history = await api.getChatHistory(sessionId);
          setThreads(prev => prev.map(thread =>
            thread.id === activeThread 
              ? { 
                  ...thread, 
                  messages: history, 
                  updatedAt: new Date() 
                } 
              : thread
          ));
        } catch (error) {
          handleError(error, 'Load Chat History');
        } finally {
          setIsLoading(false);
        }
      };
      loadChatHistory();

      const handleSessionEvent = (type: string, data: any) => {
        if (type === 'typing') {
          setIsTyping(data.isTyping ?? false);
        } else if (type === 'statusUpdate') {
          const { messageId, status } = data;
          console.log(`SSE Status Update: msgId=${messageId}, status=${status}`);
          setThreads(prevThreads => 
            prevThreads.map(thread => 
              thread.id === activeThread 
                ? { 
                    ...thread, 
                    messages: thread.messages.map(msg => 
                      msg.id === messageId ? { ...msg, status: status } : msg
                    )
                  }
                : thread
            )
          );
        }
      };

      let cleanupSSE: (() => void) | null = null;
      try {
        cleanupSSE = api.getSessionEvents(sessionId, handleSessionEvent);
        console.log(`SSE Listener attached for session: ${sessionId}`);
      } catch (sseError) {
        console.error("Error initializing SSE for session events:", sseError);
      }
      
      return () => {
        if (cleanupSSE) {
          try {
            console.log(`SSE Listener cleanup for session: ${sessionId}`);
            cleanupSSE();
          } catch (cleanupError) {
            console.error("Error cleaning up SSE connection:", cleanupError);
          }
        }
      };
    } else {
      console.warn("No session ID found for active thread:", activeThread);
      setIsTyping(false);
    }
  }, [activeThread]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [threads]);

  useEffect(() => {
    const thoughtInterval = setInterval(() => {
      setLiveThought(snarkyThoughts[Math.floor(Math.random() * snarkyThoughts.length)]);
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

  const handleSearch = async (query: string) => {
    const currentThread = threads.find(t => t.id === activeThread);
    if (!currentThread?.sessionId || !query.trim()) return;

    try {
      setIsSearching(true);
      const results = await api.searchMessages(currentThread.sessionId, query);
      setSearchResults(results);
    } catch (error) {
      handleError(error, 'Search Messages');
    } finally {
      setIsSearching(false);
    }
  };

  const sendMessage = async () => {
    if (inputMessage.trim() === '') return;
    
    const currentThread = threads.find(t => t.id === activeThread);
    
    if (!currentThread?.sessionId) {
      handleError(new Error('No active session selected'), 'Send Message');
      return;
    }

    const sessionId = currentThread.sessionId;

    const messageId = Date.now().toString();
    const newMessage: Message = {
      id: messageId,
      content: inputMessage,
      role: 'user',
      timestamp: new Date(),
      status: 'sending',
      metadata: {
      reactions: {
        user: [],
        ai: {
          conscious: [],
          unconscious: [],
        },
        }
      }
    };

    try {
      setIsLoading(true);
      setError(null);

      setThreads(prev => prev.map(thread =>
        thread.id === activeThread
          ? { ...thread, messages: [...thread.messages, newMessage] }
          : thread
      ));

      const aiResponse = await api.sendMessage(sessionId, inputMessage, false);
      
      setThreads(prev => prev.map(thread =>
        thread.id === activeThread
          ? { 
              ...thread, 
              messages: [...thread.messages, { 
                ...aiResponse, 
                role: 'assistant' as const,
                status: 'delivered' 
              }] 
            }
          : thread
      ));

      setInputMessage('');
    } catch (error) {
      handleError(error, 'Send Message');
    } finally {
      setIsLoading(false);
    }
  };

  const addReaction = (messageId: string, reaction: string, isAI: boolean = false, isUnconscious: boolean = false) => {
    const updateMessages = (messages: Message[]): Message[] =>
      messages.map(msg => {
        if (msg.id !== messageId) return msg;

        const currentMetadata = msg.metadata || {};
        const currentReactions = currentMetadata.reactions || {
          user: [],
          ai: { conscious: [], unconscious: [] }
        };
        const currentAiReactions = currentReactions.ai || { conscious: [], unconscious: [] };
        const currentUserReactions = currentReactions.user || [];
        const currentAiConscious = currentAiReactions.conscious || [];
        const currentAiUnconscious = currentAiReactions.unconscious || [];

        let updatedUserReactions = currentUserReactions;
        let updatedAiConsciousReactions = currentAiConscious;
        let updatedAiUnconsciousReactions = currentAiUnconscious;

        if (isAI) {
          if (isUnconscious) {
            updatedAiUnconsciousReactions = [...currentAiUnconscious, reaction];
          } else {
            updatedAiConsciousReactions = [...currentAiConscious, reaction];
          }
        } else {
          updatedUserReactions = [...currentUserReactions, reaction];
        }
        
        const updatedReactionsPayload: { user: string[]; ai: { conscious: string[]; unconscious: string[] } } = {
           user: updatedUserReactions,
           ai: {
             conscious: updatedAiConsciousReactions,
             unconscious: updatedAiUnconsciousReactions,
           },
         };

        return {
          ...msg,
          metadata: {
            ...currentMetadata,
            reactions: updatedReactionsPayload
          }
        };
      });

    setThreads(prevThreads =>
      prevThreads.map(thread =>
        thread.id === activeThread
          ? { ...thread, messages: updateMessages(thread.messages) }
          : thread
      )
    );
  };

  const generateAIReactions = (message: Message) => {
    if (!message.metadata?.reactions) {
      message.metadata = {
        ...message.metadata,
        reactions: {
          user: [],
          ai: { conscious: [], unconscious: [] }
        }
      };
    }

    const consciousReaction = reactionOptions[Math.floor(Math.random() * reactionOptions.length)];
    addReaction(message.id, consciousReaction, true, false);

    const unconsciousTraits = aiPersonalityTraits.filter(() => Math.random() < 0.3);
    unconsciousTraits.forEach(trait => addReaction(message.id, trait, true, true));
  };

  const handleError = (error: unknown, context: string) => {
    const errorMessage = error instanceof Error ? error.message : 'An unexpected error occurred';
    console.error(`${context}:`, error);
    setError(errorMessage);
    setTimeout(() => setError(null), 5000);
  };

  const createNewThread = async () => {
    try {
      const newSessionId = await api.createSession(userId);
      console.log("Create new thread resp (sessionId): ", newSessionId)
      const newThread: Thread = {
        id: newSessionId,
        title: `Chat ${threads.length + 1} 💖`,
        messages: [],
        sessionId: newSessionId,
        createdAt: new Date(),
        updatedAt: new Date(),
        metadata: {
          summary: '',
          tags: [],
          context: {}
        }
      };
      setThreads(prev => [...prev, newThread]);
      setActiveThread(newThread.id);
      setIsSidebarOpen(false);
    } catch (error) {
      handleError(error, 'Create New Thread');
    }
  };

  const handleUpdateThreadTitle = async (threadId: string, newTitle: string) => {
    try {
      await api.updateThreadTitle(threadId, newTitle);
      setThreads(prevThreads => 
        prevThreads.map(thread => 
          thread.id === threadId ? { ...thread, title: newTitle, updatedAt: new Date() } : thread
        )
      );
    } catch (error) {
      handleError(error, "Update Thread Title");
      throw error;
    }
  };

  const handleEditTitleClick = () => {
    const currentThread = threads.find(t => t.id === activeThread);
    if (currentThread) {
      setEditingTitleText(currentThread.title);
      setIsEditingTitle(true);
    }
  };

  const handleEditingTitleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setEditingTitleText(e.target.value);
  };

  const handleEditingTitleSubmit = async () => {
    if (!editingTitleText.trim() || !activeThread) {
      setIsEditingTitle(false);
      return;
    }
    try {
      await handleUpdateThreadTitle(activeThread, editingTitleText.trim());
      setIsEditingTitle(false);
    } catch (error) {
      console.error("Failed to update title from header:", error);
      alert("Failed to rename session.");
    }
  };

  const handleEditingTitleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handleEditingTitleSubmit();
    } else if (e.key === 'Escape') {
      setIsEditingTitle(false);
      setEditingTitleText('');
    }
  };

  return (
    <div className="flex flex-col h-screen bg-gradient-to-br from-pink-100 to-purple-100">
      {isInitializing ? (
        <div className="flex items-center justify-center h-full">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900 mx-auto mb-4"></div>
            <p className="text-gray-600">Initializing chat...</p>
          </div>
        </div>
      ) : (
        <>
          <header className="bg-white bg-opacity-70 p-4 shadow-sm flex justify-between items-center space-x-4">
            <div className="flex-1 min-w-0">
              {isEditingTitle ? (
                <Input 
                  value={editingTitleText}
                  onChange={handleEditingTitleChange}
                  onBlur={handleEditingTitleSubmit}
                  onKeyDown={handleEditingTitleKeyDown}
                  className="h-8 text-xl font-bold text-purple-700" 
                  autoFocus
                />
              ) : (
                <div className="flex items-center space-x-2">
                  <h1 
                    className="text-xl md:text-2xl font-bold text-purple-700 truncate cursor-pointer" 
                    title={`Session ID: ${activeThread}`}
                    onDoubleClick={handleEditTitleClick}
                  >
                    {threads.find(t => t.id === activeThread)?.title || 'Chat'}
                  </h1>
                  <Button 
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 text-gray-500 hover:text-purple-700"
                    onClick={handleEditTitleClick}
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                </div>
              )}
              <p className="text-sm text-gray-600 truncate">Where every message is a chance for magic ✨</p>
            </div>
            <Sheet open={isSidebarOpen} onOpenChange={setIsSidebarOpen}>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon">
                  <Menu className="h-6 w-6" />
                </Button>
              </SheetTrigger>
              <Sidebar 
                isOpen={isSidebarOpen}
                onOpenChange={setIsSidebarOpen}
                threads={threads}
                activeThread={activeThread}
                onThreadSelect={setActiveThread}
                onCreateThread={createNewThread}
              />
            </Sheet>
          </header>
          {showNotification && (
            <div className="m-2 p-2 bg-yellow-100 rounded-md text-sm">
              <AlertCircle className="inline-block mr-2 h-4 w-4" />
              New suggestion from your {socialSuggestion?.platform} activity!
            </div>
          )}
          <div className="flex-1 flex flex-col p-4 overflow-hidden">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold">
                {activeThread === '-1' ? "Global Chat" : threads.find(t => t.id === activeThread)?.title}
              </h2>
              <SearchDialog 
                isOpen={showSearch}
                onOpenChange={setShowSearch}
                onSearch={handleSearch}
                searchQuery={searchQuery}
                searchResults={searchResults}
                isSearching={isSearching}
              />
            </div>

            <MessageList 
              messages={threads.find(t => t.id === activeThread)?.messages || []}
              onReaction={addReaction}
            />

            <div className="mt-4 flex">
              <Input
                value={inputMessage}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setInputMessage(e.target.value)}
                placeholder="Type your message here..."
                className="flex-1 mr-2"
                onKeyPress={(e: React.KeyboardEvent<HTMLInputElement>) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    sendMessage();
                  }
                }}
              />
              <Button 
                onClick={sendMessage}
                className="mr-2"
                disabled={isLoading || !inputMessage.trim()}
              >
                {isLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Send className="h-4 w-4" />
                )}
              </Button>
              <Button variant="outline">
                <Image className="h-4 w-4" />
              </Button>
            </div>
          </div>
          {error && (
            <div className="m-2 p-2 bg-red-100 rounded-md text-sm text-red-600">
              <AlertCircle className="inline-block mr-2 h-4 w-4" />
              {error}
            </div>
          )}
          {isLoading && !isInitializing && (
            <div className="m-2 p-2 bg-blue-100 rounded-md text-sm">
              <div className="animate-pulse">Processing your request...</div>
            </div>
          )}
        </>
      )}
    </div>
  )
}