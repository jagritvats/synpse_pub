import type { User } from "@/lib/types"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"

interface DashboardContentProps {
  user: User
}

export function DashboardContent({ user }: DashboardContentProps) {
  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Subscription</CardTitle>
          <Badge
            variant={user.subscription === "PREMIUM" ? "default" : "outline"}
            className={user.subscription === "PREMIUM" ? "bg-yellow-400 text-black" : ""}
          >
            {user.subscription}
          </Badge>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{user.subscription === "PREMIUM" ? "$30/month" : "Free"}</div>
          <p className="text-xs text-muted-foreground">
            {user.subscription === "PREMIUM" ? "You are on the Premium plan" : "Upgrade to Premium for more features"}
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Account Status</CardTitle>
          <Badge variant="outline" className="bg-green-100 text-green-800 border-green-200">
            Active
          </Badge>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{user.name}</div>
          <p className="text-xs text-muted-foreground">{user.email}</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">AI Companion</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">Synapse</div>
          <p className="text-xs text-muted-foreground">Your personal AI companion</p>
        </CardContent>
      </Card>
    </div>
  )
}
