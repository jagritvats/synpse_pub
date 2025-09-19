'use client'

import { useState, useRef, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { MessageSquare, Copy, Edit2, Star, Archive, Globe } from 'lucide-react';
import { Thread, SessionStatus } from '@/types/types';
import { toast } from "@/hooks/use-toast";

interface ThreadItemProps {
  item: Pick<Thread, 'id' | 'title' | 'status' | 'sessionId'> & { type?: 'global' | 'normal' };
  activeThreadId: string;
  onSelectThread: (id: string) => void;
  onUpdateThread: (thread: Thread) => void;
}

export default function ThreadItem({ item, activeThreadId, onSelectThread, onUpdateThread }: ThreadItemProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [title, setTitle] = useState(item.title);
  const editInputRef = useRef<HTMLInputElement>(null);

  const isGlobal = item.id.startsWith('global-') || item.type === 'global';
  const isActive = item.id === activeThreadId;

  useEffect(() => {
    if (isEditing && editInputRef.current) {
      editInputRef.current.focus();
    }
  }, [isEditing]);

  const handleSave = () => {
    if (title.trim() === '') return;
    onUpdateThread({ ...item, title: title.trim() });
    setIsEditing(false);
  };

  const handleCopyId = (e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(item.sessionId || item.id);
    toast({ title: "Session ID Copied", description: `${item.sessionId || item.id}` });
  };

  const handleToggleFavorite = (e: React.MouseEvent) => {
    if (isGlobal) return;
    e.stopPropagation();
    const newStatus = item.status === 'favorite' ? 'active' : 'favorite';
    onUpdateThread({ ...item, status: newStatus });
  };

  const handleToggleArchive = (e: React.MouseEvent) => {
    if (isGlobal) return;
    e.stopPropagation();
    const newStatus = item.status === 'archived' ? 'active' : 'archived';
    onUpdateThread({ ...item, status: newStatus });
  };

  return (
    <div
      className={`p-2 rounded-md cursor-pointer mb-1 ${isActive ? 'bg-amber-100 font-medium' : 'hover:bg-amber-50'}`}
      onClick={() => onSelectThread(item.id)}
    >
      <div className="flex justify-between items-center text-sm">
        <span className="flex items-center">
          {isGlobal && <Globe className="h-3 w-3 mr-1.5 text-blue-500" />}
          <span className="truncate max-w-[180px]">{item.title}</span>
        </span>
        <div className="flex items-center space-x-1">
          <Button variant="ghost" size="icon" className="h-6 w-6 text-gray-400 hover:text-amber-800" onClick={handleCopyId}>
            <Copy className="h-3 w-3" />
          </Button>
          {!isGlobal && (
            <>
              <Button variant="ghost" size="icon" className={`h-6 w-6 ${item.status === 'favorite' ? 'text-amber-500' : 'text-gray-400 hover:text-amber-600'}`} onClick={handleToggleFavorite}>
                <Star className="h-3 w-3" />
              </Button>
              <Button variant="ghost" size="icon" className={`h-6 w-6 ${item.status === 'archived' ? 'text-amber-800' : 'text-gray-400 hover:text-amber-600'}`} onClick={handleToggleArchive}>
                <Archive className="h-3 w-3" />
              </Button>
            </>
          )}
        </div>
      </div>
      <p className="text-xs text-gray-400 mt-1 truncate">ID: {item.sessionId || item.id}</p>
    </div>
  );
}