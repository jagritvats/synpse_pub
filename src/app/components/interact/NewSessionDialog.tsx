'use client'

import { useState } from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { PlusCircle } from 'lucide-react';

interface NewSessionDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onCreateThread: (title: string) => void;
  triggerButton?: React.ReactNode; // Optional custom trigger
}

export default function NewSessionDialog({ 
  isOpen, 
  onOpenChange, 
  onCreateThread, 
  triggerButton 
}: NewSessionDialogProps) {
  const [newSessionTitle, setNewSessionTitle] = useState('');

  const handleCreateClick = () => {
    if (newSessionTitle.trim() === '') return;
    onCreateThread(newSessionTitle.trim());
    setNewSessionTitle(''); // Reset title
    onOpenChange(false); // Close dialog
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      {triggerButton && <DialogTrigger asChild>{triggerButton}</DialogTrigger>}
      <DialogContent className="bg-white">
        <DialogHeader>
          <DialogTitle>Create New Session</DialogTitle>
          <DialogDescription>
            Enter a title for your new conversation session.
          </DialogDescription>
        </DialogHeader>
        <div className="py-4">
          <Input 
            value={newSessionTitle}
            onChange={(e) => setNewSessionTitle(e.target.value)}
            placeholder="Session title (e.g., Project Brainstorm)" 
            className="bg-[#FFFDF7] border-amber-100 focus-visible:ring-amber-200"
            onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  handleCreateClick();
                }
            }}
          />
        </div>
        <DialogFooter>
          <Button 
            variant="outline"
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </Button>
          <Button 
            className="bg-amber-100 text-amber-800 hover:bg-amber-200"
            onClick={handleCreateClick}
            disabled={newSessionTitle.trim() === ''}
          >
            Create
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
} 