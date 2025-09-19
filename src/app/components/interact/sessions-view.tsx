import { useState } from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { ArrowLeft, PlusCircle, Copy, Edit2, Star, Archive, Search, Clock, MessageSquare, Globe } from 'lucide-react';
import { Thread, SessionStatus } from '@/types/types';
import { toast } from "@/hooks/use-toast";
import NewSessionDialog from './NewSessionDialog';

interface SessionsViewProps {
  threads: Thread[];
  onUpdateThread: (thread: Thread) => void;
  onCreateThread: (title: string) => void;
  onSelectThread: (id: string) => void;
  onBack: () => void;
}

export default function SessionsView({
  threads,
  onUpdateThread,
  onCreateThread,
  onSelectThread,
  onBack,
}: SessionsViewProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [importSessionId, setImportSessionId] = useState('');
  const [filter, setFilter] = useState<'all' | SessionStatus>('all');
  const [isNewSessionDialogOpen, setIsNewSessionDialogOpen] = useState(false);

  const filteredThreads = threads.filter(thread => {
    const matchesSearch = thread.title.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesFilter = filter === 'all' || thread.status === filter;
    return matchesSearch && matchesFilter;
  });

  const copySessionId = (sessionId: string) => {
    navigator.clipboard.writeText(sessionId);
    toast({
      title: "Session ID copied",
      description: "The session ID has been copied to your clipboard.",
    });
  };

  const handleImportSession = () => {
    if (importSessionId.trim() === '') return;
    // In a real app, this would validate and import the session
    toast({
      title: "Session import attempted",
      description: `Tried to import session: ${importSessionId}`,
    });
    setImportSessionId('');
  };

  const updateStatus = (thread: Thread, status: SessionStatus) => {
    onUpdateThread({ ...thread, status });
  };

  const formatDate = (date: Date) => {
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    
    if (diffDays === 0) {
      return 'Today';
    } else if (diffDays === 1) {
      return 'Yesterday';
    } else if (diffDays < 7) {
      return `${diffDays} days ago`;
    } else {
      return date.toLocaleDateString();
    }
  };

  const getStatusBadge = (status: SessionStatus, isGlobal: boolean) => {
    if (isGlobal) {
       return <span className="px-2 py-0.5 bg-blue-100 text-blue-800 rounded-full text-xs flex items-center"><Globe className="h-3 w-3 mr-1" /> Global</span>;
    }
    switch (status) {
      case 'favorite':
        return <span className="px-2 py-0.5 bg-amber-100 text-amber-800 rounded-full text-xs flex items-center"><Star className="h-3 w-3 mr-1" /> Favorite</span>;
      case 'archived':
        return <span className="px-2 py-0.5 bg-gray-100 text-gray-600 rounded-full text-xs flex items-center"><Archive className="h-3 w-3 mr-1" /> Archived</span>;
      case 'active':
        return <span className="px-2 py-0.5 bg-green-100 text-green-800 rounded-full text-xs flex items-center">Active</span>;
      default:
        return null;
    }
  };

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <div className="bg-white border-b border-amber-100 p-3 flex items-center">
        <Button 
          variant="ghost" 
          size="icon" 
          className="mr-2 text-amber-800"
          onClick={onBack}
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <h2 className="text-lg font-medium text-amber-800">Session Management</h2>
      </div>
      
      <div className="p-4 flex-1 overflow-hidden flex flex-col">
        <div className="mb-4 flex items-center">
          <div className="relative flex-1 mr-2">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search sessions..." 
              className="pl-9 bg-[#FFFDF7] border-amber-100"
            />
          </div>
          <Button 
            className="bg-amber-100 text-amber-800 hover:bg-amber-200 border-none"
            onClick={() => setIsNewSessionDialogOpen(true)}
          >
            <PlusCircle className="h-4 w-4 mr-2" />
            New
          </Button>
        </div>
        
        <div className="mb-4 flex space-x-2">
          <Button 
            variant={filter === 'all' ? 'secondary' : 'outline'} 
            size="sm"
            className={filter === 'all' ? 'bg-amber-100 text-amber-800' : 'border-amber-100 text-amber-800'}
            onClick={() => setFilter('all')}
          >
            All
          </Button>
          <Button 
            variant={filter === 'active' ? 'secondary' : 'outline'} 
            size="sm"
            className={filter === 'active' ? 'bg-amber-100 text-amber-800' : 'border-amber-100 text-amber-800'}
            onClick={() => setFilter('active')}
          >
            Active
          </Button>
          <Button 
            variant={filter === 'favorite' ? 'secondary' : 'outline'} 
            size="sm"
            className={filter === 'favorite' ? 'bg-amber-100 text-amber-800' : 'border-amber-100 text-amber-800'}
            onClick={() => setFilter('favorite')}
          >
            <Star className="h-3 w-3 mr-1" />
            Favorites
          </Button>
          <Button 
            variant={filter === 'archived' ? 'secondary' : 'outline'} 
            size="sm"
            className={filter === 'archived' ? 'bg-amber-100 text-amber-800' : 'border-amber-100 text-amber-800'}
            onClick={() => setFilter('archived')}
          >
            <Archive className="h-3 w-3 mr-1" />
            Archived
          </Button>
        </div>
        
        <div className="flex-1 overflow-hidden">
          <ScrollArea className="h-full">
            {filteredThreads.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                No sessions found. Create a new one to get started.
              </div>
            ) : (
              filteredThreads.map(thread => {
                const isGlobalSession = thread.id.startsWith('global-') || thread.metadata?.type === 'global';
                return (
                  <div key={thread.id} className="mb-4 p-3 bg-white rounded-lg border border-amber-100">
                    <div className="flex justify-between items-center mb-2">
                      <h4 className="font-medium text-amber-900 flex items-center">
                         {isGlobalSession && <Globe className="h-4 w-4 mr-1.5 text-blue-500" />}
                         {thread.title}
                      </h4>
                      <div className="flex">
                        {getStatusBadge(thread.status, isGlobalSession)}
                      </div>
                    </div>
                    {!isGlobalSession && (
                       <div className="flex items-center justify-between text-xs text-gray-500 mb-3">
                         <div className="flex items-center">
                           <Clock className="h-3 w-3 mr-1" />
                           <span>{formatDate(thread.lastActive)}</span>
                         </div>
                       </div>
                    )}
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-gray-500 truncate max-w-[200px]">Session ID: {thread.sessionId}</span>
                      <div className="flex">
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          className="h-6 text-xs text-amber-700 hover:text-amber-900 hover:bg-amber-50 px-2"
                          onClick={() => copySessionId(thread.sessionId)}
                        >
                          <Copy className="h-3 w-3 mr-1" />
                          Copy ID
                        </Button>
                      </div>
                    </div>
                    <div className="mt-3 flex justify-between">
                      <div className="flex space-x-1">
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          className="h-7 text-xs hover:bg-amber-50 text-gray-500"
                          onClick={() => !isGlobalSession && updateStatus(thread, thread.status === 'favorite' ? 'active' : 'favorite')}
                          disabled={isGlobalSession}
                        >
                          <Star className={`h-3 w-3 mr-1 ${thread.status === 'favorite' ? 'text-amber-500' : ''}`} />
                          {thread.status === 'favorite' ? 'Unfavorite' : 'Favorite'}
                        </Button>
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          className="h-7 text-xs hover:bg-amber-50 text-gray-500"
                          onClick={() => !isGlobalSession && updateStatus(thread, thread.status === 'archived' ? 'active' : 'archived')}
                          disabled={isGlobalSession}
                        >
                          <Archive className={`h-3 w-3 mr-1 ${thread.status === 'archived' ? 'text-amber-800' : ''}`} />
                          {thread.status === 'archived' ? 'Unarchive' : 'Archive'}
                        </Button>
                      </div>
                      <Button 
                        variant="outline" 
                        size="sm" 
                        className="h-7 text-xs bg-amber-50 border-amber-100 text-amber-800 hover:bg-amber-100"
                        onClick={() => onSelectThread(thread.id)}
                      >
                        Open Chat
                      </Button>
                    </div>
                  </div>
                );
              })
            )}
          </ScrollArea>
        </div>
        
        <div className="mt-4">
          <Dialog>
            <DialogTrigger asChild>
              <Button variant="outline" className="w-full border-amber-100 text-amber-800 hover:bg-amber-50">
                Import Session
              </Button>
            </DialogTrigger>
            <DialogContent className="bg-white">
              <DialogHeader>
                <DialogTitle>Import Session</DialogTitle>
                <DialogDescription>
                  Enter a session ID to import an existing conversation.
                </DialogDescription>
              </DialogHeader>
              <div className="py-4">
                <Input 
                  value={importSessionId}
                  onChange={(e) => setImportSessionId(e.target.value)}
                  placeholder="Enter session ID" 
                  className="bg-[#FFFDF7] border-amber-100 focus-visible:ring-amber-200"
                />
              </div>
              <DialogFooter>
                <Button 
                  className="bg-amber-100 text-amber-800 hover:bg-amber-200"
                  onClick={handleImportSession}
                >
                  Import
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <NewSessionDialog 
        isOpen={isNewSessionDialogOpen} 
        onOpenChange={setIsNewSessionDialogOpen} 
        onCreateThread={onCreateThread} 
      />
    </div>
  );
}