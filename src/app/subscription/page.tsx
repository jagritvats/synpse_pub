import { SubscriptionPlans } from "@/components/subscription/subscription-plans"
import { getUser } from "@/lib/auth"
import { redirect } from "next/navigation"

export default async function SubscriptionPage() {
  const user = await getUser();

  if (!user) {
    redirect("/login")
  }

  return (
    <div className="flex min-h-screen flex-col">
      <div className="container max-w-6xl py-12">
        <div className="mb-8 text-center">
          <h1 className="text-3xl font-bold">Choose Your Plan</h1>
          <p className="mt-2 text-gray-500">Select the plan that best fits your needs</p>
        </div>
        <SubscriptionPlans userId={user._id} currentPlan={user.subscription} />
      </div>
    </div>
  )
}
