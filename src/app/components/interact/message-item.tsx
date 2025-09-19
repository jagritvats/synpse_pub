import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Message } from "@/types/types";
import { cn } from "@/lib/utils"; // Assuming cn utility exists for class names
import { Activity, Trash, RefreshCw, Check, AlertCircle, Zap } from 'lucide-react'; // Import needed icons
import { Button } from "@/components/ui/button";
import { chatApi } from "@/types/types";
import { useState } from "react";
import { 
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger
} from "@/components/ui/tooltip";

interface MessageItemProps {
  message: Message;
  isTyping?: boolean; // Added optional prop for typing indicator
  possiblyInActivity?: boolean; // Whether this message might be part of an activity (for optimistic UI)
  activeActivityId?: string | null; // Current active activity ID for the session
  onDelete?: (messageId: string) => void; // Callback for deleting messages
  onRestore?: (messageId: string) => void; // Callback for restoring messages
}

export default function MessageItem({ 
  message, 
  isTyping = false, 
  possiblyInActivity = false,
  activeActivityId = null,
  onDelete,
  onRestore
}: MessageItemProps) {
  const [isHovering, setIsHovering] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);

  const isUser = message.role === 'user'; // Use role instead of sender
  const avatarFallback = isUser ? 'U' : 'S';
  const avatarColor = isUser ? 'bg-blue-100 text-blue-800' : 'bg-amber-100 text-amber-800';
  const messageBgColor = isUser ? 'bg-blue-50' : 'bg-amber-50';

  // Determine if this message should be highlighted as part of an activity
  const isPartOfActivity = 
    // Explicit activity ID in message metadata (always true for assistant messages)
    (message.metadata?.activityId) || 
    // Optimistic highlighting for user messages in an active activity
    (isUser && possiblyInActivity && activeActivityId !== null);
  
  // Activity metadata for tooltip
  const activityName = message.metadata?.activityName || message.metadata?.activityType || 'Active';

  // Check if action was executed
  const actionExecuted = message.metadata?.actionExecuted || false;
  const actionName = message.metadata?.actionName;
  const actionSuccess = message.metadata?.actionSuccess;
  const actionMessage = message.metadata?.actionMessage;

  // Function to format timestamp (optional)
  const formatTimestamp = (date: Date) => {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const handleDelete = async () => {
    if (onDelete && !isDeleting) {
      setIsDeleting(true);
      try {
        // First, update the UI optimistically
        onDelete(message.id);
        // Then make the API call
        await chatApi.deleteMessage(message.sessionId, message.id);
      } catch (error) {
        console.error("Failed to delete message:", error);
        // If API call fails, we should ideally revert the UI change
        // but that would require passing both callbacks up
      } finally {
        setIsDeleting(false);
      }
    }
  };

  const handleRestore = async () => {
    if (onRestore && !isRestoring) {
      setIsRestoring(true);
      try {
        // First, update the UI optimistically
        onRestore(message.id);
        // Then make the API call
        await chatApi.restoreMessage(message.sessionId, message.id);
      } catch (error) {
        console.error("Failed to restore message:", error);
        // If API call fails, we should ideally revert the UI change
        // but that would require passing both callbacks up
      } finally {
        setIsRestoring(false);
      }
    }
  };

  return (
    <div 
      className={cn(
        "flex mb-4 w-full relative group hover:bg-opacity-50", 
        isUser ? "justify-end" : "justify-start",
        message.isDeleted ? "opacity-50" : ""
      )}
      onMouseEnter={() => setIsHovering(true)}
      onMouseLeave={() => setIsHovering(false)}
    >
      {!isUser && (
        <Avatar className={cn("h-8 w-8 mr-2 flex-shrink-0", avatarColor)}>
          {/* <AvatarImage src="/placeholder.svg?height=32&width=32" /> */}
          <AvatarFallback className={cn("text-xs", avatarColor)}>{avatarFallback}</AvatarFallback>
        </Avatar>
      )}
      <div className={cn("flex flex-col max-w-[75%]", isUser ? "items-end" : "items-start")}>
        {/* Add a subtle border/accent if message is part of an activity */}
        <div className={cn(
            "rounded-lg px-3 py-2 relative group", 
            messageBgColor, 
            isUser ? "text-right" : "text-left",
            isPartOfActivity ? "border border-purple-200" : ""
        )}>
          {isTyping ? (
            <div className="flex space-x-1">
              <span className="h-2 w-2 bg-amber-300 rounded-full animate-bounce [animation-delay:-0.3s]"></span>
              <span className="h-2 w-2 bg-amber-300 rounded-full animate-bounce [animation-delay:-0.15s]"></span>
              <span className="h-2 w-2 bg-amber-300 rounded-full animate-bounce"></span>
            </div>
          ) : (
            <>
              <p className="text-sm text-gray-800">
                {message.isDeleted ? <span className="italic text-gray-500">[Message deleted]</span> : message.content}
              </p>
              
              {/* Inline action buttons that appear on hover */}
              {isHovering && !message.isDeleted && onDelete && (
                <div className="absolute -top-3 right-2 bg-white rounded-full shadow-sm border border-gray-200 z-10">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 w-6 p-0 rounded-full text-red-500 hover:bg-red-50"
                    onClick={handleDelete}
                    disabled={isDeleting}
                  >
                    <Trash className="h-3 w-3" />
                  </Button>
                </div>
              )}
              
              {/* Restore button */}
              {isHovering && message.isDeleted && onRestore && (
                <div className="absolute -top-3 right-2 bg-white rounded-full shadow-sm border border-gray-200 z-10">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 w-6 p-0 rounded-full text-green-500 hover:bg-green-50"
                    onClick={handleRestore}
                    disabled={isRestoring}
                  >
                    <RefreshCw className="h-3 w-3" />
                  </Button>
                </div>
              )}
            </>
          )}
        </div>
        {/* Action display */}
        {!isUser && actionExecuted && (
          <div className={cn(
            "flex items-center mt-1 text-xs rounded-md px-2 py-1",
            actionSuccess ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700"
          )}>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger>
                  <div className="flex items-center gap-1">
                    <Zap className="h-3 w-3 mr-1" />
                    <span className="font-medium">{actionName}</span>
                    {actionSuccess ? <Check className="h-3 w-3 text-green-500" /> : <AlertCircle className="h-3 w-3 text-red-500" />}
                  </div>
                </TooltipTrigger>
                <TooltipContent>
                  <p>{actionMessage || (actionSuccess ? 'Action executed successfully' : 'Action execution failed')}</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
        )}
        <p className={cn("text-xs text-gray-400 mt-1 flex items-center gap-1", isUser ? "justify-end" : "justify-start")}>
          {/* Add Activity icon if message has activityId or is optimistically highlighted */} 
          {isPartOfActivity && (
            <span title={`Activity: ${activityName}`}>
              <Activity className="h-3 w-3 text-purple-400" />
            </span>
          )}
          {formatTimestamp(message.timestamp)}
          {message.status === 'PENDING' && isUser && <span className="ml-1">(Sending...)</span>}
          {message.status === 'ERROR' && isUser && <span className="ml-1 text-red-500">(Failed)</span>}
          {message.isDeleted && <span className="ml-1 text-gray-500">(Deleted)</span>}
        </p>
      </div>
      {isUser && (
        <Avatar className={cn("h-8 w-8 ml-2 flex-shrink-0", avatarColor)}>
          {/* <AvatarImage src="/placeholder.svg?height=32&width=32" /> */}
          <AvatarFallback className={cn("text-xs", avatarColor)}>{avatarFallback}</AvatarFallback>
        </Avatar>
      )}
    </div>
  );
}