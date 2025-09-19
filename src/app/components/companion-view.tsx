import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ChevronUp, ChevronDown, Smile, Settings, Save, BrainCircuit } from 'lucide-react';
import { Mood } from '../../types/types';
import { apiClient } from '@/lib/api-client';
import { toast } from "@/hooks/use-toast";

interface CompanionSpaceProps {
  userMood: Mood;
  setUserMood: (mood: Mood) => void;
  connectionLevel: number;
  companionThought: string;
  journal: string;
  setJournal: (journal: string) => void;
  empathicResponses: string[];
}

export default function CompanionSpace({
  userMood,
  setUserMood,
  connectionLevel,
  companionThought,
  journal,
  setJournal,
  empathicResponses
}: CompanionSpaceProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [desireStatement, setDesireStatement] = useState("");
  const [companionThinking, setCompanionThinking] = useState<boolean>(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [savedDesire, setSavedDesire] = useState("");
  const router = useRouter();

  // Fetch user's saved desire statement on component mount
  useEffect(() => {
    const fetchUserDesires = async () => {
      try {
        const response = await apiClient('/api/user-state/companion-desires', {
          method: 'GET',
          targetBackend: 'nextjs'
        });
        if (response.data && response.data.statement) {
          setDesireStatement(response.data.statement);
          setSavedDesire(response.data.statement);
        }
      } catch (error) {
        console.error('Failed to fetch user desires:', error);
        // Non-critical error, so just log it
      }
    };

    fetchUserDesires();
  }, []);

  // Fetch companion thinking status
  useEffect(() => {
    const fetchThinkingStatus = async () => {
      try {
        const response = await apiClient('/api/dev/companion-thinking/status', {
          method: 'GET',
          targetBackend: 'express'
        });
        if (response.data && typeof response.data.enabled === 'boolean') {
          setCompanionThinking(response.data.enabled);
        }
      } catch (error) {
        console.error('Failed to fetch companion thinking status:', error);
      }
    };

    fetchThinkingStatus();
  }, []);

  const handleSettingsClick = () => {
    router.push('/settings/prompt');
  };

  const saveDesireStatement = async () => {
    if (!desireStatement.trim()) {
      toast({
        title: "Empty input",
        description: "Please enter what you want from your companion.",
        variant: "destructive"
      });
      return;
    }

    setIsSubmitting(true);
    try {
      await apiClient('/api/user-state/companion-desires', {
        method: 'POST',
        body: { desireStatement },
        targetBackend: 'nextjs'
      });
      
      setSavedDesire(desireStatement);
      toast({
        title: "Preferences saved",
        description: "Your companion now understands what you expect from them."
      });
    } catch (error) {
      console.error('Failed to save desire statement:', error);
      toast({
        title: "Failed to save",
        description: "There was an error saving your preferences.",
        variant: "destructive"
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const toggleCompanionThinking = async () => {
    try {
      await apiClient('/api/dev/companion-thinking/toggle', {
        method: 'POST',
        body: { enabled: !companionThinking },
        targetBackend: 'express'
      });
      setCompanionThinking(!companionThinking);
      toast({
        title: companionThinking ? "Mind disabled" : "Mind enabled",
        description: companionThinking 
          ? "Your companion is no longer thinking about your psychology."
          : "Your companion will now analyze your psychology and adapt to your needs."
      });
    } catch (error) {
      console.error('Failed to toggle companion thinking:', error);
      toast({
        title: "Failed to update",
        description: "There was an error updating the companion mind.",
        variant: "destructive"
      });
    }
  };

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen} className="border-t border-amber-100">
      <CollapsibleTrigger asChild>
        <Button variant="ghost" className="w-full flex justify-center items-center h-8 text-amber-800">
          {isOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronUp className="h-4 w-4" />}
          <span className="text-xs ml-2">{isOpen ? "Close" : "Companion Space"}</span>
        </Button>
      </CollapsibleTrigger>
      <CollapsibleContent>
        <Tabs defaultValue="mood" className="p-4 bg-white">
          <TabsList className="grid w-full grid-cols-2 sm:grid-cols-5 bg-amber-50 h-auto sm:h-10">
            <TabsTrigger value="mood" className="data-[state=active]:bg-amber-100 data-[state=active]:text-amber-900 text-xs sm:text-sm py-1.5 sm:py-2">
              Mood
            </TabsTrigger>
            <TabsTrigger value="journal" className="data-[state=active]:bg-amber-100 data-[state=active]:text-amber-900 text-xs sm:text-sm py-1.5 sm:py-2">
              Journal
            </TabsTrigger>
            <TabsTrigger value="companion" className="data-[state=active]:bg-amber-100 data-[state=active]:text-amber-900 text-xs sm:text-sm py-1.5 sm:py-2">
              Insights
            </TabsTrigger>
            <TabsTrigger value="desires" className="data-[state=active]:bg-amber-100 data-[state=active]:text-amber-900 text-xs sm:text-sm py-1.5 sm:py-2">
              Expectations
            </TabsTrigger>
            <TabsTrigger
              value="settings"
              className="text-xs sm:text-sm py-1.5 sm:py-2 flex items-center gap-1 text-gray-600 hover:text-amber-800 data-[state=active]:bg-amber-100 data-[state=active]:text-amber-900"
              onClick={handleSettingsClick}
            >
              <span><Settings className="h-3 w-3 sm:h-4 sm:w-4" /> </span>
            </TabsTrigger>
          </TabsList>
          <TabsContent value="mood">
            <Card className="border-none shadow-none">
              <CardHeader className="px-0 pt-4 pb-2">
                <CardTitle className="text-amber-800 text-lg">Mood & Connection</CardTitle>
                <CardDescription>How are you feeling today?</CardDescription>
              </CardHeader>
              <CardContent className="px-0 space-y-4">
                <div className="bg-[#FFFDF7] p-4 rounded-lg">
                  <h3 className="text-sm font-medium mb-3 text-amber-800">Your Mood</h3>
                  <div className="flex items-center space-x-3 mb-3">
                    <span className="text-3xl">{userMood.emoji}</span>
                    <span className="text-sm text-gray-600">{userMood.description}</span>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {[
                      { emoji: '😊', description: 'Content' },
                      { emoji: '😄', description: 'Happy' },
                      { emoji: '😔', description: 'Sad' },
                      { emoji: '😠', description: 'Angry' },
                      { emoji: '😴', description: 'Tired' },
                    ].map((mood) => (
                      <Button 
                        key={mood.emoji}
                        variant="outline" 
                        className="bg-white border-amber-100 hover:bg-amber-50"
                        onClick={() => setUserMood(mood)}
                      >
                        {mood.emoji}
                      </Button>
                    ))}
                  </div>
                </div>
                <div className="bg-[#FFFDF7] p-4 rounded-lg">
                  <h3 className="text-sm font-medium mb-3 text-amber-800">Connection</h3>
                  <div className="w-full bg-amber-50 rounded-full h-1.5 mb-2">
                    <div 
                      className="bg-amber-400 h-1.5 rounded-full transition-all duration-500 ease-in-out" 
                      style={{width: `${connectionLevel}%`}}
                    ></div>
                  </div>
                  <p className="text-xs text-gray-500">
                    {connectionLevel < 30 ? "I'm here whenever you need me." :
                     connectionLevel < 60 ? "We're building a great connection." :
                     connectionLevel < 90 ? "I feel like we really understand each other." :
                     "Our connection is truly special."}
                  </p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
          <TabsContent value="journal">
            <Card className="border-none shadow-none">
              <CardHeader className="px-0 pt-4 pb-2">
                <CardTitle className="text-amber-800 text-lg">Reflection Journal</CardTitle>
                <CardDescription>A private space for your thoughts</CardDescription>
              </CardHeader>
              <CardContent className="px-0">
                <Textarea
                  value={journal}
                  onChange={(e) => setJournal(e.target.value)}
                  placeholder="Write your reflections here..."
                  className="min-h-[120px] bg-[#FFFDF7] border-amber-100 focus-visible:ring-amber-200"
                />
              </CardContent>
            </Card>
          </TabsContent>
          <TabsContent value="companion">
            <Card className="border-none shadow-none">
              <CardHeader className="px-0 pt-4 pb-2">
                <CardTitle className="text-amber-800 text-lg">Companion Insights</CardTitle>
                <CardDescription>Thoughts to support your journey</CardDescription>
              </CardHeader>
              <CardContent className="px-0 space-y-4">
                <div className="bg-[#FFFDF7] p-4 rounded-lg">
                  <h3 className="text-sm font-medium mb-2 text-amber-800">Reflection</h3>
                  <p className="text-sm italic text-gray-600">{companionThought}</p>
                </div>
                <div className="bg-[#FFFDF7] p-4 rounded-lg">
                  <h3 className="text-sm font-medium mb-3 text-amber-800">Daily Inspiration</h3>
                  <Button 
                    variant="outline" 
                    className="w-full bg-white border-amber-100 hover:bg-amber-50 text-amber-800"
                    onClick={() => alert(empathicResponses[Math.floor(Math.random() * empathicResponses.length)])}
                  >
                    <Smile className="mr-2 h-4 w-4" />
                    <span className="text-sm">Get a Thoughtful Message</span>
                  </Button>
                </div>
                <div className="bg-[#FFFDF7] p-4 rounded-lg">
                  <h3 className="text-sm font-medium mb-3 text-amber-800">AI Mind</h3>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-600">AI psychological analysis</span>
                    <Button 
                      variant="outline" 
                      className={`${
                        companionThinking 
                          ? 'bg-amber-100 hover:bg-amber-200 text-amber-800' 
                          : 'bg-gray-100 hover:bg-gray-200 text-gray-600'
                      } border-amber-100`}
                      onClick={toggleCompanionThinking}
                      size="sm"
                    >
                      <BrainCircuit className="mr-2 h-3 w-3" />
                      <span className="text-xs">{companionThinking ? 'Enabled' : 'Disabled'}</span>
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
          <TabsContent value="desires">
            <Card className="border-none shadow-none">
              <CardHeader className="px-0 pt-4 pb-2">
                <CardTitle className="text-amber-800 text-lg">Your Expectations</CardTitle>
                <CardDescription>What do you want from your companion?</CardDescription>
              </CardHeader>
              <CardContent className="px-0 space-y-4">
                <div className="bg-[#FFFDF7] p-4 rounded-lg">
                  <h3 className="text-sm font-medium mb-3 text-amber-800">Tell your companion what you want</h3>
                  <Textarea
                    value={desireStatement}
                    onChange={(e) => setDesireStatement(e.target.value)}
                    placeholder="e.g., I want a companion who helps me learn new things, challenges my thinking, and encourages me to be more productive."
                    className="min-h-[100px] bg-white border-amber-100 focus-visible:ring-amber-200 mb-3"
                  />
                  <Button 
                    variant="outline" 
                    className="w-full bg-white border-amber-100 hover:bg-amber-50 text-amber-800"
                    onClick={saveDesireStatement}
                    disabled={isSubmitting || desireStatement === savedDesire}
                  >
                    <Save className="mr-2 h-4 w-4" />
                    <span className="text-sm">
                      {isSubmitting ? "Saving..." : "Save Your Preferences"}
                    </span>
                  </Button>
                </div>
                {savedDesire && (
                  <div className="bg-[#FFFDF7] p-4 rounded-lg">
                    <h3 className="text-sm font-medium mb-2 text-amber-800">Current Understanding</h3>
                    <p className="text-sm text-gray-600">
                      Your companion understands that you want: 
                    </p>
                    <p className="text-sm italic mt-2 text-amber-800">"{savedDesire}"</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </CollapsibleContent>
    </Collapsible>
  );
}