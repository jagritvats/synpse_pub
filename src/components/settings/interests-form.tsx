"use client"

import React, { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Slider } from "@/components/ui/slider"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { toast } from "sonner"
import { Loader2, Trash2 } from "lucide-react"
import { fetchUserInterests, updateUserInterests, fetchAIInterests, updateAIInterests } from "@/lib/settings-api"
import { IUserInterest } from "@/../server/src/models/user-state.model" // Adjust path if needed
// Assuming AI Interests have a similar structure for simplicity in the form
// If not, we might need a separate interface
interface InterestItem {
  topic: string
  level: number // Assuming 1-10 scale for both?
}

export function InterestsForm() {
  const [userInterests, setUserInterests] = useState<InterestItem[]>([])
  const [aiInterests, setAiInterests] = useState<InterestItem[]>([])
  const [newUserInterestTopic, setNewUserInterestTopic] = useState("")
  const [newUserInterestLevel, setNewUserInterestLevel] = useState(5)
  const [newAiInterestTopic, setNewAiInterestTopic] = useState("")
  const [newAiInterestLevel, setNewAiInterestLevel] = useState(5)
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)

  useEffect(() => {
    async function fetchData() {
      setIsLoading(true)
      try {
        const [userRes, aiRes] = await Promise.all([
          fetchUserInterests(),
          fetchAIInterests(),
        ])
        setUserInterests(userRes || [])
        setAiInterests(aiRes || [])
      } catch (error: any) {
        console.error("Failed to fetch interests:", error)
        toast.error("Failed to load interests.", { description: error.message })
      } finally {
        setIsLoading(false)
      }
    }
    fetchData()
  }, [])

  const handleAddInterest = (type: 'user' | 'ai') => {
    if (type === 'user') {
      if (!newUserInterestTopic.trim()) return
      if (!userInterests.some(i => i.topic.toLowerCase() === newUserInterestTopic.trim().toLowerCase())) {
        setUserInterests([...userInterests, { topic: newUserInterestTopic.trim(), level: newUserInterestLevel }])
      }
      setNewUserInterestTopic("")
      setNewUserInterestLevel(5)
    } else {
      if (!newAiInterestTopic.trim()) return
      if (!aiInterests.some(i => i.topic.toLowerCase() === newAiInterestTopic.trim().toLowerCase())) {
        setAiInterests([...aiInterests, { topic: newAiInterestTopic.trim(), level: newAiInterestLevel }])
      }
      setNewAiInterestTopic("")
      setNewAiInterestLevel(5)
    }
  }

  const handleRemoveInterest = (type: 'user' | 'ai', topic: string) => {
    if (type === 'user') {
      setUserInterests(userInterests.filter((i) => i.topic !== topic))
    } else {
      setAiInterests(aiInterests.filter((i) => i.topic !== topic))
    }
  }

  const handleSave = async () => {
    setIsSaving(true)
    try {
      await Promise.all([
        updateUserInterests(userInterests as IUserInterest[]), // Type assertion might be needed
        updateAIInterests(aiInterests),
      ])
      toast.success("Interests saved successfully!")
    } catch (error: any) {
      console.error("Failed to save interests:", error)
      toast.error("Failed to save interests.", { description: error.message })
    } finally {
      setIsSaving(false)
    }
  }

  const renderInterestList = (type: 'user' | 'ai') => {
    const list = type === 'user' ? userInterests : aiInterests
    return list.length > 0 ? (
      <ul className="space-y-2">
        {list.map((interest) => (
          <li key={interest.topic} className="flex items-center justify-between p-2 border rounded bg-gray-50 dark:bg-gray-800 dark:border-gray-700">
            <span className="text-sm flex-1 mr-2 dark:text-gray-200">
              <span className="font-medium text-amber-700 dark:text-amber-500">[{interest.level}]</span> {interest.topic}
            </span>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => handleRemoveInterest(type, interest.topic)}
              className="text-red-500 hover:bg-red-100 dark:hover:bg-red-900/20 dark:text-red-400"
              disabled={isSaving}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </li>
        ))}
      </ul>
    ) : (
      <p className="text-sm text-gray-500 dark:text-gray-400">No {type === 'user' ? 'user' : 'AI'} interests added yet.</p>
    )
  }

  const renderAddInterestForm = (type: 'user' | 'ai') => {
    const topic = type === 'user' ? newUserInterestTopic : newAiInterestTopic
    const setTopic = type === 'user' ? setNewUserInterestTopic : setNewAiInterestTopic
    const level = type === 'user' ? newUserInterestLevel : newAiInterestLevel
    const setLevel = type === 'user' ? setNewUserInterestLevel : setNewAiInterestLevel

    return (
      <div className="space-y-2 pt-4 border-t dark:border-gray-700">
        <Label htmlFor={`new-${type}-interest`} className="dark:text-gray-300">Add New {type === 'user' ? 'User' : 'AI'} Interest</Label>
        <div className="flex flex-col sm:flex-row items-start sm:items-center space-y-2 sm:space-y-0 sm:space-x-2">
           <Input
            id={`new-${type}-interest`}
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            placeholder="e.g., Technology, Philosophy..."
            className="flex-grow dark:bg-gray-700 dark:border-gray-600 dark:text-gray-200"
            disabled={isLoading || isSaving}
          />
          <div className="flex items-center space-x-2 w-full sm:w-auto">
            <Slider
              defaultValue={[level]}
              value={[level]}
              onValueChange={(value) => setLevel(value[0])}
              min={1}
              max={10}
              step={1}
              className="w-full sm:w-32"
              disabled={isLoading || isSaving}
            />
            <span className="text-sm font-medium w-8 text-right dark:text-gray-300">{level}</span>
          </div>
          <Button
            onClick={() => handleAddInterest(type)}
            disabled={isLoading || isSaving || !topic.trim()}
            className="w-full sm:w-auto dark:bg-amber-600 dark:text-white dark:hover:bg-amber-700"
          >
            Add
          </Button>
        </div>
      </div>
    )
  }

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Interests</CardTitle>
          <CardDescription>Define your interests and configure the AI's areas of focus.</CardDescription>
        </CardHeader>
        <CardContent className="flex justify-center py-8">
          <Loader2 className="h-8 w-8 animate-spin text-amber-500" />
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Interests</CardTitle>
        <CardDescription>Define your interests and configure the AI's areas of focus.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-8">
        {/* User Interests Section */}
        <div className="space-y-4">
          <h3 className="text-lg font-medium dark:text-gray-200">Your Interests</h3>
          {renderInterestList('user')}
          {renderAddInterestForm('user')}
        </div>

        {/* AI Interests Section */}
        <div className="space-y-4">
          <h3 className="text-lg font-medium dark:text-gray-200">AI Companion Interests</h3>
          {renderInterestList('ai')}
          {renderAddInterestForm('ai')}
        </div>
      </CardContent>
      <CardFooter className="border-t px-6 py-4 dark:border-gray-700">
        <Button onClick={handleSave} disabled={isSaving || isLoading}
          className="dark:bg-blue-600 dark:text-white dark:hover:bg-blue-700"
        >
          {isSaving ? (
            <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Saving...</>
          ) : (
            "Save All Interests"
          )}
        </Button>
      </CardFooter>
    </Card>
  )
}
