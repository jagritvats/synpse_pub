"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Check, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { useToast } from "@/hooks/use-toast"

interface SubscriptionPlansProps {
  userId: string
  currentPlan: string
}

export function SubscriptionPlans({ userId, currentPlan }: SubscriptionPlansProps) {
  const [isLoading, setIsLoading] = useState(false)
  const [selectedPlan, setSelectedPlan] = useState<string | null>(null)
  const router = useRouter()
  const { toast } = useToast()

  const handleSubscribe = async (plan: string) => {
    setIsLoading(true)
    setSelectedPlan(plan)

    try {
      const response = await fetch("/api/subscription", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ plan }),
      })

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || "Something went wrong")
      }

      // If switching to free plan
      if (plan === "FREE") {
        toast({
          title: "Subscription updated",
          description: "You are now on the Free plan",
        })

        router.push("/dashboard")
        router.refresh()
        return
      }

      // If upgrading to premium, redirect to checkout
      if (result.url) {
        window.location.href = result.url
      }
    } catch (error: any) {
      toast({
        title: "Subscription failed",
        description: error.message,
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
      setSelectedPlan(null)
    }
  }

  return (
    <div className="grid gap-6 md:grid-cols-2 lg:gap-8">
      {/* Free Plan */}
      <Card className={`border-2 ${currentPlan === "FREE" ? "border-yellow-400" : "border-transparent"}`}>
        <CardHeader>
          <CardTitle className="text-2xl">Free</CardTitle>
          <CardDescription>Basic features for personal use</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="text-4xl font-bold">
            $0<span className="text-base font-normal text-gray-500">/month</span>
          </div>
          <ul className="space-y-2">
            <li className="flex items-center">
              <Check className="mr-2 h-4 w-4 text-green-500" />
              <span>Basic AI companion features</span>
            </li>
            <li className="flex items-center">
              <Check className="mr-2 h-4 w-4 text-green-500" />
              <span>Limited conversations per day</span>
            </li>
            <li className="flex items-center">
              <Check className="mr-2 h-4 w-4 text-green-500" />
              <span>Standard response time</span>
            </li>
          </ul>
        </CardContent>
        <CardFooter>
          <Button
            onClick={() => handleSubscribe("FREE")}
            disabled={isLoading || currentPlan === "FREE"}
            className={`w-full ${currentPlan === "FREE" ? "bg-gray-300 hover:bg-gray-300 cursor-not-allowed" : "bg-yellow-400 hover:bg-yellow-500 text-black"}`}
          >
            {isLoading && selectedPlan === "FREE" ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Processing...
              </>
            ) : currentPlan === "FREE" ? (
              "Current Plan"
            ) : (
              "Select Free Plan"
            )}
          </Button>
        </CardFooter>
      </Card>

      {/* Premium Plan */}
      <Card className={`border-2 ${currentPlan === "PREMIUM" ? "border-yellow-400" : "border-transparent"}`}>
        <CardHeader>
          <CardTitle className="text-2xl">Premium</CardTitle>
          <CardDescription>Advanced features for power users</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="text-4xl font-bold">
            $30<span className="text-base font-normal text-gray-500">/month</span>
          </div>
          <ul className="space-y-2">
            <li className="flex items-center">
              <Check className="mr-2 h-4 w-4 text-green-500" />
              <span>All Free features</span>
            </li>
            <li className="flex items-center">
              <Check className="mr-2 h-4 w-4 text-green-500" />
              <span>Unlimited conversations</span>
            </li>
            <li className="flex items-center">
              <Check className="mr-2 h-4 w-4 text-green-500" />
              <span>Priority response time</span>
            </li>
            <li className="flex items-center">
              <Check className="mr-2 h-4 w-4 text-green-500" />
              <span>Advanced personalization</span>
            </li>
            <li className="flex items-center">
              <Check className="mr-2 h-4 w-4 text-green-500" />
              <span>Integration with productivity tools</span>
            </li>
          </ul>
        </CardContent>
        <CardFooter>
          <Button
            onClick={() => handleSubscribe("PREMIUM")}
            disabled={isLoading || currentPlan === "PREMIUM"}
            className={`w-full ${currentPlan === "PREMIUM" ? "bg-gray-300 hover:bg-gray-300 cursor-not-allowed" : "bg-yellow-400 hover:bg-yellow-500 text-black"}`}
          >
            {isLoading && selectedPlan === "PREMIUM" ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Processing...
              </>
            ) : currentPlan === "PREMIUM" ? (
              "Current Plan"
            ) : (
              "Upgrade to Premium"
            )}
          </Button>
        </CardFooter>
      </Card>
    </div>
  )
}
