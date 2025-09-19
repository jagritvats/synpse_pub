'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { fetchTimelineEvents } from '@/lib/settings-api'; // Import API function
import { ScrollArea } from "@/components/ui/scroll-area"; // For potentially long lists

// Define a basic structure for timeline events (adjust based on actual data)
interface TimelineEvent {
  id: string; // Assuming events have IDs
  timestamp: string | Date;
  type: string;
  description: string;
  metadata?: Record<string, any>;
}

export function AITimelineView() {
  const [events, setEvents] = useState<TimelineEvent[]>([]);
  const [isFetching, setIsFetching] = useState(true);

  useEffect(() => {
    const loadEvents = async () => {
      setIsFetching(true);
      try {
        // Fetching latest 50 events by default
        const fetchedEvents = await fetchTimelineEvents(50);
        // Ensure fetched data is an array
        setEvents(Array.isArray(fetchedEvents) ? fetchedEvents : []);
      } catch (error) {
        console.error("Failed to fetch timeline events:", error);
        toast.error("Failed to load AI timeline.");
        setEvents([]); // Clear on error
      } finally {
        setIsFetching(false);
      }
    };
    loadEvents();
  }, []);

  // Helper to format timestamp
  const formatTimestamp = (ts: string | Date) => {
    try {
      return new Date(ts).toLocaleString();
    } catch {
      return String(ts); // Fallback
    }
  };

  return (
    <Card className="bg-white shadow-sm">
      <CardHeader>
        <CardTitle className="text-xl font-semibold text-gray-800">AI Timeline</CardTitle>
        <CardDescription className="text-gray-600">
          A recent log of the AI companion's internal events and actions.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {isFetching ? (
          <p className="text-gray-600">Loading timeline...</p>
        ) : (
          <ScrollArea className="h-[400px] pr-4"> {/* Limit height and add scroll */} 
            {events.length > 0 ? (
              <ul className="space-y-3">
                {events.map((event) => (
                  <li key={event.id} className="p-3 border-l-4 border-amber-400 bg-gray-50 rounded-r">
                    <div className="flex justify-between items-center mb-1">
                      <span className="text-sm font-semibold text-amber-800">
                        {event.type?.toUpperCase() || 'EVENT'}
                      </span>
                      <span className="text-xs text-gray-500">
                        {formatTimestamp(event.timestamp)}
                      </span>
                    </div>
                    <p className="text-sm text-gray-700">
                      {event.description}
                    </p>
                    {event.metadata && Object.keys(event.metadata).length > 0 && (
                      <pre className="mt-2 text-xs text-gray-500 bg-gray-100 p-2 rounded overflow-x-auto">
                        {JSON.stringify(event.metadata, null, 2)}
                      </pre>
                    )}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-gray-500">No timeline events found or unable to load.</p>
            )}
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  );
}
