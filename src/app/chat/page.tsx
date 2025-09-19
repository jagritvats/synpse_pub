'use client'

import { useState, useEffect, useCallback } from 'react'
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet"
import { Menu, Settings, Archive, LogIn, LogOut, User as UserIcon } from 'lucide-react'
import { Thread, Message, Mood, chatApi } from '@/types/types'
import ThreadItem from '@/app/components/interact/thread-item'
import ChatView from '@/app/components/interact/chat-view'
import SessionsView from '@/app/components/interact/sessions-view'
import { toast } from "@/hooks/use-toast"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import { useAuth } from '@/context/auth-context'
import { useRouter, useSearchParams } from 'next/navigation'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import Link from 'next/link'
import AppHeader from '@/components/layout/AppHeader'
import NewSessionDialog from '@/app/components/interact/NewSessionDialog'

export default function SerendipityCompanion() {
  const { user, isAuthenticated, isLoading: isAuthLoading, logout } = useAuth()
  const router = useRouter()
  const searchParams = useSearchParams()
  const [allThreads, setAllThreads] = useState<Thread[]>([])
  const [displayThreads, setDisplayThreads] = useState<Thread[]>([])
  const [activeThreadId, setActiveThreadId] = useState<string>('')
  const [currentMessages, setCurrentMessages] = useState<Message[]>([])
  const [isLoadingMessages, setIsLoadingMessages] = useState<boolean>(false)
  const [isSendingMessage, setIsSendingMessage] = useState<boolean>(false)
  const [isTyping, setIsTyping] = useState<boolean>(false)
  const [journal, setJournal] = useState('')
  const [connectionLevel, setConnectionLevel] = useState(50)
  const [companionThought, setCompanionThought] = useState('')
  const [userMood, setUserMood] = useState<Mood>({ emoji: '😊', description: 'Content' })
  const [isSidebarOpen, setIsSidebarOpen] = useState(false)
  const [activeView, setActiveView] = useState<'chat' | 'sessions'>('chat')
  const [isArchiveOpen, setIsArchiveOpen] = useState(false)
  const [isNewSessionDialogOpen, setIsNewSessionDialogOpen] = useState(false)

  console.log(`User: ${JSON.stringify(user)}`)

  useEffect(() => {
    if (!isAuthLoading && !isAuthenticated) {
      console.log('[Chat Page] Auth check complete, user not authenticated. Redirecting to login.');
      router.push('/login');
    }
  }, [isAuthLoading, isAuthenticated, router]);

  const empathicResponses = [
    "I'm here for you. Want to talk about it?",
    "That sounds challenging. How are you coping?",
    "I'm glad you shared that with me. How can I support you?",
    "It's okay to feel that way. What do you need right now?",
    "I appreciate your openness. Let's explore this together.",
  ]

  const companionThoughts = [
    "I wonder what makes them smile...",
    "Their resilience is truly inspiring.",
    "I hope they know how much they've grown.",
    "It's amazing how unique each person's journey is.",
    "I'm grateful for the trust they place in me.",
  ]

  useEffect(() => {
    let isCancelled = false;
    if (!isAuthLoading && isAuthenticated) {
        const querySessionId = searchParams.get('sessionId');
        let initialSessionId: string | null = null;

        if (querySessionId) {
            console.log(`Chat Page: Found sessionId in query param: ${querySessionId}`)
            initialSessionId = querySessionId;
        } else if (user) {
            initialSessionId = `global-${user._id}`;
            console.log(`Chat Page: No sessionId in query param, using user global: ${initialSessionId}`);
        } else {
            console.log('Chat Page: No sessionId in query and no user logged in. Cannot determine active session.');
            initialSessionId = ''; // Ensure it's always a string
        }

        setActiveThreadId(prevId => {
            if (prevId !== initialSessionId && initialSessionId) {
                console.log(`Chat Page: Setting activeThreadId to: ${initialSessionId}`);
                return initialSessionId;
            }
            return prevId;
        });

        const fetchInitialData = async () => {
          if (isCancelled) return;
          console.log(`Fetching threads... (User: ${user?.id || 'anonymous'})`)
          try {
             const fetchedThreads = await chatApi.fetchThreads()
             if (isCancelled) return;
             setAllThreads(fetchedThreads)
             const threadsForSidebar = fetchedThreads.filter(t => !t.sessionId.startsWith('global-'));
             setDisplayThreads(threadsForSidebar)
          } catch (error) {
              if (isCancelled) return;
              console.error("Error fetching initial threads:", error);
          }
        }
        if (user) {
          fetchInitialData()
        } else {
          setAllThreads([]);
          setDisplayThreads([]);
          setActiveThreadId('');
        }
    } else if (!isAuthLoading && !isAuthenticated) {
      setAllThreads([]);
      setDisplayThreads([]);
      setActiveThreadId('');
    }

    return () => { isCancelled = true; };
  }, [isAuthLoading, isAuthenticated, user, searchParams]);

  useEffect(() => {
    if (!activeThreadId || isAuthLoading || !isAuthenticated) return

    let isCancelled = false;

    const fetchMessages = async () => {
      console.log(`Fetching messages for thread: ${activeThreadId}`)
      setIsLoadingMessages(true)
      setCurrentMessages([])
      try {
        const messages = await chatApi.fetchMessages(activeThreadId)
        if (!isCancelled) {
          setCurrentMessages(messages)
        }
      } catch (error) {
        console.error("Error fetching messages:", error)
        if (!isCancelled) {
          toast({ title: "Error", description: "Could not load messages for this session.", variant: "destructive" })
        }
      } finally {
        if (!isCancelled) {
          setIsLoadingMessages(false)
        }
      }
    }

    fetchMessages()

    return () => {
      isCancelled = true;
    };
  }, [activeThreadId, isAuthLoading, isAuthenticated])

  useEffect(() => {
    if (!activeThreadId || isAuthLoading || !isAuthenticated) {
      console.log("SSE useEffect: activeThreadId is not set, auth loading, or not authenticated, skipping setup.");
      return;
    }

    console.log(`SSE useEffect: Setting up for thread: ${activeThreadId}`);
    setIsTyping(false)

    const handleNewMessage = (newMessage: Message & { clientTempId?: string }) => {
      console.log('SSE received messageUpdate:', newMessage);
      setCurrentMessages(prevMessages => {
        const { clientTempId, ...messageData } = newMessage;

        console.log(`[handleNewMessage] START | Processing incoming ID: ${messageData.id}, Role: ${messageData.role}, TempID supplied: ${clientTempId}`);
        console.log(`[handleNewMessage] Current first message: ID=${prevMessages[0]?.id}, Content='${prevMessages[0]?.content?.substring(0, 30)}...'`);
        console.log(`[handleNewMessage] Current last message: ID=${prevMessages[prevMessages.length - 1]?.id}, Content='${prevMessages[prevMessages.length - 1]?.content?.substring(0, 30)}...'`);

        if (messageData.role === 'user' && clientTempId) {
          const optimisticIndex = prevMessages.findIndex(msg => msg.id === clientTempId);
          console.log(`[handleNewMessage] Attempting optimistic reconciliation | TempID: ${clientTempId} | Found Index: ${optimisticIndex}`);
          if (optimisticIndex > -1) {
            console.log(`[handleNewMessage] SUCCESS: Reconciling optimistic message at index ${optimisticIndex} with real ID ${messageData.id}`);
            const updatedMessages = [...prevMessages];
            updatedMessages[optimisticIndex] = { ...messageData } as Message;
            console.log(`[handleNewMessage] END | Returning updated array after optimistic reconciliation.`);
            console.log(`[handleNewMessage] Post-Update first message: ID=${updatedMessages[0]?.id}, Content='${updatedMessages[0]?.content?.substring(0, 30)}...'`);
            return updatedMessages;
          } else {
            console.warn(`[handleNewMessage] FAILED: No optimistic message found for TempID ${clientTempId}. Proceeding.`);
          }
        }

        const existingIndex = prevMessages.findIndex(msg => msg.id === messageData.id);
        console.log(`[handleNewMessage] Attempting update by real ID | RealID: ${messageData.id} | Found Index: ${existingIndex}`);
        if (existingIndex > -1) {
          console.log(`[handleNewMessage] SUCCESS: Updating existing message at index ${existingIndex} with real ID ${messageData.id}`);
          const updatedMessages = [...prevMessages];
          updatedMessages[existingIndex] = { ...updatedMessages[existingIndex], ...messageData };
          console.log(`[handleNewMessage] END | Returning updated array after real ID update.`);
          console.log(`[handleNewMessage] Post-Update first message: ID=${updatedMessages[0]?.id}, Content='${updatedMessages[0]?.content?.substring(0, 30)}...'`);
          return updatedMessages;
        } else {
          console.log(`[handleNewMessage] Adding new message | RealID: ${messageData.id}`);
          const finalMessageToAdd = { ...messageData } as Message;
          const newArray = [...prevMessages, finalMessageToAdd];
          console.log(`[handleNewMessage] END | Returning new array with message appended.`);
          console.log(`[handleNewMessage] Post-Update first message: ID=${newArray[0]?.id}, Content='${newArray[0]?.content?.substring(0, 30)}...'`);
          return newArray;
        }
      });

      if (newMessage.role === 'assistant') {
        console.log("Assistant message arrived, ensuring typing indicator is off.");
        setIsTyping(false);
      }
    }

    const handleStatusUpdate = (statusUpdate: { messageId: string; status: Message['status'] }) => {
      console.log('SSE received statusUpdate:', statusUpdate);
      setCurrentMessages(prevMessages => {
        const messageIndex = prevMessages.findIndex(msg => msg.id === statusUpdate.messageId);

        if (messageIndex > -1) {
          console.log(`Updating status for message ${statusUpdate.messageId} to ${statusUpdate.status}`);
          const updatedMessages = [...prevMessages];
          updatedMessages[messageIndex] = { ...updatedMessages[messageIndex], status: statusUpdate.status };
          return updatedMessages;
        } else {
          console.warn(`SSE: Received statusUpdate for unknown message ID: ${statusUpdate.messageId}`);
          return prevMessages;
        }
      });
    }

    const handleTyping = (typingUpdate: { isTyping: boolean; messageId?: string }) => {
      console.log('SSE received typing update:', typingUpdate)
      setIsTyping(typingUpdate.isTyping);
    }

    const handleActivityUpdate = (activityUpdate: { activityId: string | null; isActive: boolean | null; type: string | null; name: string | null }) => {
      console.log('SSE received activity update:', activityUpdate)
      // If an activity has ended, update UI state accordingly
      if (activityUpdate.activityId && activityUpdate.isActive === false) {
        // We don't need to do anything here as the ChatView component will handle this via the custom DOM event
        console.log(`Activity ${activityUpdate.activityId} has ended`)
      }
    }

    const cleanup = chatApi.listenToSessionEvents(
      activeThreadId, 
      handleNewMessage, 
      handleStatusUpdate, 
      handleTyping,
      handleActivityUpdate
    )

    return () => {
      console.log(`SSE useEffect Cleanup: Cleaning up for thread: ${activeThreadId}`);
      if (typeof cleanup === 'function') {
        cleanup();
      } else {
        console.warn("SSE cleanup function was not returned or not a function.");
      }
      setIsTyping(false)
    }
  }, [activeThreadId, isAuthLoading, isAuthenticated])

  useEffect(() => {
    const thoughtInterval = setInterval(() => {
      setCompanionThought(companionThoughts[Math.floor(Math.random() * companionThoughts.length)])
    }, 30000)

    const connectionInterval = setInterval(() => {
      setConnectionLevel(prev => Math.max(Math.min(prev + Math.floor(Math.random() * 11) - 5, 100), 0))
    }, 60000)

    return () => {
      clearInterval(thoughtInterval)
      clearInterval(connectionInterval)
    }
  }, [])

  const handleUpdateThread = useCallback(async (updatedThread: Thread) => {
    setAllThreads(prevThreads =>
      prevThreads.map(thread =>
        thread.id === updatedThread.id ? updatedThread : thread
      )
    )
    setDisplayThreads(prevThreads =>
      prevThreads.map(thread =>
        thread.id === updatedThread.id ? updatedThread : thread
      )
    )
    await chatApi.updateSessionStatus(updatedThread.id, updatedThread.status)
  }, [])

  const handleCreateThread = async (title: string) => {
    console.log(`Creating new thread with title: ${title}`)
    try {
      const newThread = await chatApi.createThread(title)
      if (newThread) {
        setAllThreads(prev => [...prev, newThread])
        setDisplayThreads(prev => [...prev, newThread])
        setActiveThreadId(newThread.id)
        setActiveView('chat')
        setIsSidebarOpen(false)
        toast({ title: "Success", description: "New conversation created." })
      } else {
        throw new Error("API did not return new thread object")
      }
    } catch (error) {
      console.error("Error creating thread:", error)
      toast({ title: "Error", description: "Failed to create new conversation.", variant: "destructive" })
    }
  }

  const handleSelectThread = (id: string) => {
    console.log(`Selecting thread: ${id}`)
    setActiveThreadId(id)
    setActiveView('chat')
    setIsSidebarOpen(false)
    setCurrentMessages([])
    setIsTyping(false)
  }

  const handleSendMessage = useCallback(async (messageContent: string) => {
    if (!activeThreadId || isAuthLoading || !isAuthenticated) return

    const optimisticMessage: Message = {
      id: `temp-${Date.now()}`,
      content: messageContent,
      role: 'user',
      timestamp: new Date(),
      sessionId: activeThreadId,
      status: 'PENDING',
    }

    setCurrentMessages(prev => {
        console.log(`[handleSendMessage] BEFORE optimistic add | First message: ID=${prev[0]?.id}, Content='${prev[0]?.content?.substring(0,30)}...'`);
        const newState = [...prev, optimisticMessage];
        console.log(`[handleSendMessage] AFTER optimistic add | First message in NEW state: ID=${newState[0]?.id}, Content='${newState[0]?.content?.substring(0,30)}...'`);
        return newState;
    })
    setIsTyping(true)

    try {
      await chatApi.sendMessage(activeThreadId, messageContent, optimisticMessage.id)
    } catch (error) {
      console.error("Failed to send message:", error)
      toast({ title: "Error", description: "Could not send message.", variant: "destructive" })
      setCurrentMessages(prev => prev.map(msg =>
        msg.id === optimisticMessage.id ? { ...msg, status: 'ERROR' } : msg
      ))
      setIsTyping(false)
    } finally {
    }
  }, [activeThreadId, isAuthLoading, isAuthenticated])

  const getInitials = (name?: string) => {
    if (!name) return '?';
    const names = name.split(' ');
    if (names.length === 1) return names[0].charAt(0).toUpperCase();
    return (names[0].charAt(0) + names[names.length - 1].charAt(0)).toUpperCase();
  };

  const activeOrFavoriteThreads = displayThreads.filter(t => t.status !== 'archived')
  const archivedThreads = displayThreads.filter(t => t.status === 'archived')

  const currentThread = activeThreadId.startsWith('global-')
      ? undefined
      : allThreads.find(t => t.id === activeThreadId);

  return (
    <div className="flex flex-col h-screen bg-[#FFFDF7]">
      <AppHeader onMenuClick={() => setIsSidebarOpen(true)} />
      
      <Sheet open={isSidebarOpen} onOpenChange={setIsSidebarOpen}>
         <SheetContent side="left" className="bg-[#FFFDF7] border-r border-amber-100 w-[300px] sm:w-[350px]">
           <SheetHeader>
             <SheetTitle className="text-amber-800">Conversations</SheetTitle>
             <SheetDescription>Select a conversation or start a new one</SheetDescription>
           </SheetHeader>
            <div className="h-[calc(100vh-8rem)] mt-6 overflow-hidden flex flex-col">
              {/* Global Thread Item - Only show if user is logged in */}
              {user && (
                  <ThreadItem
                      key="global-session"
                      item={{
                          id: `global-${user._id}`,
                          sessionId: `global-${user._id}`,
                          title: "Global",
                          status: 'active', // Global is always active
                          type: 'global'
                      }}
                      activeThreadId={activeThreadId}
                      onSelectThread={handleSelectThread}
                      onUpdateThread={() => {}} // No-op for global
                  />
              )}
              {/* Divider */}
              <hr className="my-2 border-amber-100" />
              {/* Other Sessions */}
              <div className="flex-1 overflow-y-auto pr-2 mb-2">
                {activeOrFavoriteThreads.length > 0 ? (
                  activeOrFavoriteThreads.map(thread => (
                    <ThreadItem
                      key={thread.id}
                      item={thread} // Pass the full thread object
                      activeThreadId={activeThreadId}
                      onSelectThread={handleSelectThread}
                      onUpdateThread={handleUpdateThread}
                    />
                  ))
                ) : (
                  <p className="text-xs text-center text-gray-400 py-4">No active conversations.</p>
                )}
              </div>
              {/* Archived Section */}
              {archivedThreads.length > 0 && (
                <Collapsible open={isArchiveOpen} onOpenChange={setIsArchiveOpen} className="overflow-hidden flex flex-col flex-shrink-0 border-t border-amber-100 pt-2">
                  <CollapsibleTrigger className="flex items-center justify-between w-full text-sm font-medium text-amber-700 hover:bg-amber-50 p-2 rounded-md">
                    <div className="flex items-center">
                      <Archive className="h-4 w-4 mr-2"/>
                      Archived ({archivedThreads.length})
                    </div>
                    <span>{isArchiveOpen ? '▲' : '▼'}</span>
                  </CollapsibleTrigger>
                  <CollapsibleContent className="overflow-y-auto pr-2 mt-1 flex-1">
                    {archivedThreads.map(thread => (
                      <ThreadItem
                        key={thread.id}
                        item={thread} // Pass the full thread object
                        activeThreadId={activeThreadId}
                        onSelectThread={handleSelectThread}
                        onUpdateThread={handleUpdateThread}
                      />
                    ))}
                  </CollapsibleContent>
                </Collapsible>
              )}
              <NewSessionDialog
                  isOpen={isNewSessionDialogOpen}
                  onOpenChange={setIsNewSessionDialogOpen}
                  onCreateThread={handleCreateThread}
                  triggerButton={
                      <Button
                        className="w-full mt-auto bg-amber-100 text-amber-800 hover:bg-amber-200 border-none flex-shrink-0"
                      >
                        New Conversation
                      </Button>
                  }
              />
            </div>
         </SheetContent>
       </Sheet>

      {isAuthLoading ? (
          <div className="flex flex-1 justify-center items-center">Loading authentication...</div>
      ) : isAuthenticated && activeView === 'chat' ? (
        <ChatView
          sessionId={activeThreadId}
          currentMessages={currentMessages}
          isLoadingMessages={isLoadingMessages}
          isSendingMessage={isSendingMessage}
          isTyping={isTyping}
          onSendMessage={handleSendMessage}
          currentThread={currentThread}
          onUpdateThread={handleUpdateThread}
          setConnectionLevel={setConnectionLevel}
          connectionLevel={connectionLevel}
          companionThought={companionThought}
          userMood={userMood}
          setUserMood={setUserMood}
          journal={journal}
          setJournal={setJournal}
          empathicResponses={empathicResponses}
          onBack={user ? () => handleSelectThread(`global-${user._id}`) : undefined}
          setCurrentMessages={setCurrentMessages}
        />
      ) : isAuthenticated && activeView === 'sessions' ? (
        <SessionsView
          threads={displayThreads}
          onUpdateThread={handleUpdateThread}
          onCreateThread={handleCreateThread}
          onSelectThread={(id) => router.push(`/chat?sessionId=${encodeURIComponent(id)}`)}
          onBack={() => setActiveView('chat')}
        />
      ) : (
          <div className="flex flex-1 justify-center items-center">Redirecting...</div>
      )}
    </div>
  )
}