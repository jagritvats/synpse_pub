import { useRef, useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Send, Copy, ArrowLeft, Star, Archive, Loader2, ClipboardCopy } from 'lucide-react';
import { Thread, Message } from "@/types/types"
import MessageItem from '@/app/components/interact/message-item';
import CompanionSpace from '@/app/components/companion-view';
import { toast } from "@/hooks/use-toast";
import { useAuth } from '@/context/auth-context';
import ReactMarkdown from "react-markdown";

interface ChatViewProps {
  sessionId: string;
  currentMessages: Message[];
  isLoadingMessages: boolean;
  isSendingMessage: boolean;
  isTyping: boolean;
  onSendMessage: (messageContent: string) => Promise<void>;
  currentThread: Thread | undefined;
  onUpdateThread: (thread: Thread) => void;
  setConnectionLevel: React.Dispatch<React.SetStateAction<number>>;
  connectionLevel: number;
  companionThought: string;
  userMood: { emoji: string; description: string };
  setUserMood: React.Dispatch<React.SetStateAction<{ emoji: string; description: string }>>;
  journal: string;
  setJournal: React.Dispatch<React.SetStateAction<string>>;
  empathicResponses: string[];
  onBack?: () => void;
  setCurrentMessages: React.Dispatch<React.SetStateAction<Message[]>>;
}

export default function ChatView({
  sessionId,
  currentMessages,
  isLoadingMessages,
  isSendingMessage,
  isTyping,
  onSendMessage,
  currentThread,
  onUpdateThread,
  setConnectionLevel,
  connectionLevel,
  companionThought,
  userMood,
  setUserMood,
  journal,
  setJournal,
  empathicResponses,
  onBack,
  setCurrentMessages,
}: ChatViewProps) {
  const [inputMessage, setInputMessage] = useState('');
  const [activeActivityId, setActiveActivityId] = useState<string | null>(null);
  const [activeActivityType, setActiveActivityType] = useState<string | null>(null);
  const [activityStartTimestamp, setActivityStartTimestamp] = useState<Date | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const { user } = useAuth();
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (currentMessages && currentMessages.length > 0) {
      const assistantMessages = currentMessages.filter(msg => msg.role === 'assistant');
      if (assistantMessages.length > 0) {
        const lastAssistantMessage = assistantMessages[assistantMessages.length - 1];
        if (lastAssistantMessage.metadata?.activityId) {
          if (activeActivityId !== lastAssistantMessage.metadata.activityId) {
            setActivityStartTimestamp(new Date());
          }
          setActiveActivityId(lastAssistantMessage.metadata.activityId);
          setActiveActivityType(lastAssistantMessage.metadata.activityType || "activity");
        } else {
          setActiveActivityId(null);
          setActiveActivityType(null);
          setActivityStartTimestamp(null);
        }
      }
    }
  }, [currentMessages, activeActivityId]);

  // Handle activityUpdate SSE events
  useEffect(() => {
    // Event handler for activity updates from the backend
    const handleActivityUpdate = (activityData: {
      activityId: string | null;
      isActive: boolean | null;
      type: string | null;
      name: string | null;
      endTime?: string | null;
    }) => {
      console.log("SSE activityUpdate received:", activityData);
      
      // Check if activityData exists
      if (!activityData) {
        console.warn("Received empty activityData in SSE activityUpdate");
        return;
      }
      
      // If activity is ended/inactive, reset activity status
      if (activityData.activityId && activityData.isActive === false) {
        setActiveActivityId(null);
        setActiveActivityType(null);
        setActivityStartTimestamp(null);
        console.log(`Activity ${activityData.activityId} ended, activity status reset`);
      }
    };

    // Add event listener for activityUpdate events
    const handleCustomEvent = (e: any) => {
      handleActivityUpdate(e.detail);
    };
    
    // Handle SSE error events
    const handleSSEError = (e: any) => {
      console.error("SSE connection error:", e.detail);
      // Optionally show a user-friendly error in the chat
      if (e.detail && e.detail.error) {
        toast({
          title: "Connection Error",
          description: e.detail.error,
          variant: "destructive",
        });
      }
    };
    
    document.querySelector('body')?.addEventListener('sse:activityUpdate', handleCustomEvent);
    document.querySelector('body')?.addEventListener('sse:error', handleSSEError);

    return () => {
      // Clean up event listeners
      document.querySelector('body')?.removeEventListener('sse:activityUpdate', handleCustomEvent);
      document.querySelector('body')?.removeEventListener('sse:error', handleSSEError);
    };
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [currentMessages]);

  const handleSend = async () => {
    if (inputMessage.trim() === '') return;
    setInputMessage('');
    await onSendMessage(inputMessage.trim());
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleCopySessionId = () => {
    const idToCopy = sessionId;
    navigator.clipboard.writeText(idToCopy);
    toast({
      title: "Session ID copied",
      description: `ID (${idToCopy}) copied to clipboard.`,
    });
  };

  const toggleFavorite = () => {
    if (!currentThread) return;
    const newStatus = currentThread.status === 'favorite' ? 'active' : 'favorite';
    onUpdateThread({ ...currentThread, status: newStatus });
  };

  const toggleArchive = () => {
    if (!currentThread) return;
    const newStatus = currentThread.status === 'archived' ? 'active' : 'archived';
    onUpdateThread({ ...currentThread, status: newStatus });
  };

  const handleSubmit = (e?: React.FormEvent<HTMLFormElement>) => {
    e?.preventDefault();
    if (!inputMessage.trim() || isSendingMessage) return;

    const messageToSend = inputMessage.trim();
    setInputMessage('');
    onSendMessage(messageToSend);

    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
  };

  const isGlobalSession = sessionId.startsWith('global-');
  const currentTitle = isGlobalSession ? "Global Chat" : currentThread?.title || "Chat";

  // Render activity status if there's an active activity
  const ActivityStatusIndicator = activeActivityId ? (
    <div className="text-xs flex items-center text-purple-700 font-medium py-1 px-2 bg-purple-50 rounded-full mx-auto mb-2">
      <span className="w-2 h-2 bg-purple-500 rounded-full mr-1 animate-pulse"></span>
      <span>Activity in progress: {activeActivityType}</span>
    </div>
  ) : null;

  return (
    <>
      {!isGlobalSession && currentThread && (
        <div className="bg-white border-b border-amber-100 p-2 px-4 flex items-center justify-between">
          <div className="flex items-center">
            <Button 
              variant="ghost" 
              size="icon" 
              className="mr-2 text-amber-800"
              onClick={onBack}
            >
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div>
              <h2 className="text-sm font-medium text-amber-800">{currentTitle}</h2>
              <div className="flex items-center text-xs text-gray-500">
                <span className="truncate max-w-[150px]">Session: {sessionId.substring(0, 8)}...</span>
                <Button 
                  variant="ghost" 
                  size="icon" 
                  className="h-5 w-5 ml-1 text-gray-400 hover:text-amber-800"
                  onClick={handleCopySessionId}
                >
                  <ClipboardCopy className="h-3 w-3" />
                </Button>
              </div>
            </div>
          </div>
          <div className="flex items-center">
            <Button 
              variant="ghost" 
              size="icon" 
              className={`h-8 w-8 ${currentThread.status === 'favorite' ? 'text-amber-500' : 'text-gray-400'}`}
              onClick={toggleFavorite}
              title={currentThread.status === 'favorite' ? 'Unfavorite' : 'Favorite'}
            >
              <Star className="h-4 w-4" />
            </Button>
            <Button 
              variant="ghost" 
              size="icon" 
              className={`h-8 w-8 ${currentThread.status === 'archived' ? 'text-amber-800' : 'text-gray-400'}`}
              onClick={toggleArchive}
              title={currentThread.status === 'archived' ? 'Unarchive' : 'Archive'}
            >
              <Archive className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
      {isGlobalSession && (
         <div className="bg-white border-b border-amber-100 p-2 px-4 flex items-center justify-between">
           <div className="flex items-center">
              <Button
                variant="ghost"
                size="icon"
                className="mr-2 text-amber-800 invisible"
              >
                <ArrowLeft className="h-4 w-4" />
              </Button>
              <div>
                <h2 className="text-sm font-medium text-amber-800">Global</h2>
                <div className="flex items-center text-xs text-gray-500">
                </div>
              </div>
           </div>
         </div>
      )}

      <div className="flex-1 flex flex-col p-4 overflow-hidden">
        {ActivityStatusIndicator}
        <ScrollArea className="flex-1 pr-2">
          {isLoadingMessages ? (
            <div className="flex justify-center items-center h-full">
              <Loader2 className="h-6 w-6 text-amber-500 animate-spin" />
            </div>
          ) : (
             currentMessages.map(message => (
                <MessageItem 
                  key={message.id} 
                  message={message} 
                  possiblyInActivity={
                    message.role === 'user' && 
                    !!activeActivityId && 
                    !!activityStartTimestamp && 
                    message.timestamp >= activityStartTimestamp
                  }
                  activeActivityId={activeActivityId}
                  isTyping={false}
                  onDelete={(messageId) => {
                    // Update the message in the current state to mark it as deleted
                    const updatedMessages = currentMessages.map(msg => 
                      msg.id === messageId ? { ...msg, isDeleted: true } : msg
                    );
                    // Update the messages in the parent component
                    setCurrentMessages(updatedMessages);
                  }}
                  onRestore={(messageId) => {
                    // Update the message in the current state to unmark it as deleted
                    const updatedMessages = currentMessages.map(msg => 
                      msg.id === messageId ? { ...msg, isDeleted: false } : msg
                    );
                    // Update the messages in the parent component
                    setCurrentMessages(updatedMessages);
                  }}
                />
             ))
          )}
          {isTyping && (
             <MessageItem key="typing-indicator" message={{
               id: 'typing',
               role: 'assistant',
               content: '...',
               timestamp: new Date(),
               sessionId: sessionId,
               status: 'PROCESSING'
              }} isTyping={true} />
          )}
          <div ref={messagesEndRef} />
        </ScrollArea>
        <div className="mt-4 flex items-center bg-white rounded-full border border-amber-100 px-4 py-2 shadow-sm">
          <Input
            value={inputMessage}
            onChange={(e) => setInputMessage(e.target.value)}
            onKeyDown={handleKeyPress}
            placeholder="Share your thoughts..."
            className="flex-1 border-none shadow-none focus-visible:ring-0 focus-visible:ring-offset-0 bg-transparent"
            disabled={isSendingMessage}
          />
          <Button
            onClick={handleSend}
            disabled={isSendingMessage || inputMessage.trim() === ''}
            size="icon"
            className="bg-amber-100 hover:bg-amber-200 text-amber-800 rounded-full h-8 w-8"
          >
            {isSendingMessage ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
          </Button>
        </div>
      </div>
      <CompanionSpace 
        userMood={userMood}
        setUserMood={setUserMood}
        connectionLevel={connectionLevel}
        companionThought={companionThought}
        journal={journal}
        setJournal={setJournal}
        empathicResponses={empathicResponses}
      />
    </>
  );
}