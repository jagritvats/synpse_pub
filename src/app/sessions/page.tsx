'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Thread, chatApi, SessionStatus } from '@/types/types'
import SessionsView from '@/app/components/interact/sessions-view'
import AppHeader from '@/components/layout/AppHeader'
import { useAuth } from '@/context/auth-context'
import { toast } from "@/hooks/use-toast"
import { Skeleton } from "@/components/ui/skeleton"

export default function SessionsPage() {
  const { user, isLoading: isAuthLoading } = useAuth()
  const router = useRouter()
  const [threads, setThreads] = useState<Thread[]>([])
  const [isLoading, setIsLoading] = useState<boolean>(true)

  // Fetch threads when auth state is ready
  useEffect(() => {
    if (!isAuthLoading) {
      const fetchInitialData = async () => {
        console.log(`Sessions Page: Fetching threads... (User: ${user?.id || 'anonymous'})`)
        setIsLoading(true)
        try {
          const fetchedThreads = await chatApi.fetchThreads()
          // Filter out any global session potentially returned by API
          const manageableThreads = fetchedThreads.filter(t => !t.sessionId.startsWith('global-'))
          
          // Create synthetic global thread object
          const globalThread: Thread = {
            id: `global-${user._id}`,
            sessionId: `global-${user._id}`,
            title: "Global",
            userId: user._id,
            status: 'active',
            lastActive: new Date(), // Use current time or fetch from backend if available
            messages: [], // Cannot display message count easily
            metadata: { type: 'global' } // Mark as global
          };

          // Combine global thread with the filtered manageable threads
          setThreads([globalThread, ...manageableThreads]);

        } catch (error) {
          console.error("Sessions Page: Failed to fetch threads:", error)
          toast({ title: "Error", description: "Could not load sessions.", variant: "destructive" })
        } finally {
          setIsLoading(false)
        }
      }
      fetchInitialData()
    }
  }, [isAuthLoading, user?.id])

  const handleSelectThread = useCallback((id: string) => {
    console.log(`Sessions Page: Selecting thread ${id}`)
    router.push(`/chat?sessionId=${encodeURIComponent(id)}`)
  }, [router])

  const handleUpdateThread = useCallback(async (updatedThread: Thread) => {
    setThreads(prevThreads =>
      prevThreads.map(thread =>
        thread.id === updatedThread.id ? updatedThread : thread
      )
    )
    try {
      await chatApi.updateSessionStatus(updatedThread.sessionId, updatedThread.status)
      toast({ title: "Status Updated", description: `Session "${updatedThread.title}" status set to ${updatedThread.status}.` })
    } catch (error) {
      console.error("Sessions Page: Failed to update thread status:", error)
      toast({ title: "Error", description: "Could not update session status.", variant: "destructive" })
      // Revert state on error?
      const fetchedThreads = await chatApi.fetchThreads()
      const manageableThreads = fetchedThreads.filter(t => !t.sessionId.startsWith('global-'))
      setThreads(manageableThreads) // Or revert more specifically
    }
  }, [])

  const handleCreateThread = useCallback(async (title: string) => {
    console.log(`Sessions Page: Creating new thread with title: ${title}`)
    try {
        const newThread = await chatApi.createThread(title)
        if (newThread) {
          setThreads(prev => [...prev, newThread])
          toast({ title: "Success", description: "New session created." })
          // Optionally navigate immediately to the new chat
          // router.push(`/chat?sessionId=${encodeURIComponent(newThread.id)}`)
        } else {
           throw new Error("API did not return a new thread.")
        }
    } catch (error) {
        console.error("Sessions Page: Failed to create new thread:", error)
        toast({ title: "Error", description: "Failed to create new session.", variant: "destructive" })
    } 
  }, [])

  const handleBack = useCallback(() => {
    router.push('/chat')
  }, [router])

  return (
    <div className="flex flex-col h-screen bg-[#FFFDF7]">
      <AppHeader />
      <div className="flex-1 overflow-y-auto p-4">
        {isAuthLoading || isLoading ? (
          <div className="space-y-4">
             <Skeleton className="h-10 w-full" />
             <Skeleton className="h-20 w-full" />
             <Skeleton className="h-20 w-full" />
             <Skeleton className="h-20 w-full" />
          </div>
        ) : (
          <SessionsView
            threads={threads}
            onUpdateThread={handleUpdateThread}
            onCreateThread={handleCreateThread}
            onSelectThread={handleSelectThread}
            onBack={handleBack}
          />
        )}
      </div>
    </div>
  )
} 