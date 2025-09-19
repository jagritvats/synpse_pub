"use client"

import { useState, useEffect } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { z } from "zod"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Loader2 } from "lucide-react"
import { useToast } from "@/hooks/use-toast"

// Schema for validation
const verifySchema = z.object({
  code: z.string().length(6, "Verification code must be 6 digits"),
})

type VerifyFormValues = z.infer<typeof verifySchema>

export function VerifyForm() {
  const [isLoading, setIsLoading] = useState(false)
  const [email, setEmail] = useState("")
  const [countdown, setCountdown] = useState(30)
  const [canResend, setCanResend] = useState(false)

  const router = useRouter()
  const searchParams = useSearchParams()
  const { toast } = useToast()

  useEffect(() => {
    const email = searchParams.get("email")
    if (email) {
      setEmail(email)
    } else {
      router.push("/login")
    }
  }, [searchParams, router])

  useEffect(() => {
    if (countdown > 0 && !canResend) {
      const timer = setTimeout(() => {
        setCountdown(countdown - 1)
      }, 1000)
      return () => clearTimeout(timer)
    } else if (countdown === 0 && !canResend) {
      setCanResend(true)
    }
  }, [countdown, canResend])

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<VerifyFormValues>({
    resolver: zodResolver(verifySchema),
    defaultValues: {
      code: "",
    },
  })

  const onSubmit = async (data: VerifyFormValues) => {
    setIsLoading(true)

    try {
      const response = await fetch("/api/auth/verify", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email,
          code: data.code,
        }),
      })

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || "Something went wrong")
      }

      toast({
        title: "Email verified",
        description: "You can now access your account",
      })

      // Redirect to chat page instead of subscription
      router.push("/chat")
      router.refresh()
    } catch (error: any) {
      toast({
        title: "Verification failed",
        description: error.message,
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
    }
  }

  const handleResendCode = async () => {
    setIsLoading(true)

    try {
      const response = await fetch("/api/auth/resend-code", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email }),
      })

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || "Something went wrong")
      }

      toast({
        title: "Code resent",
        description: "A new verification code has been sent to your email",
      })

      setCountdown(30)
      setCanResend(false)
    } catch (error: any) {
      toast({
        title: "Failed to resend code",
        description: error.message,
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="code">Verification Code</Label>
        <Input id="code" placeholder="123456" {...register("code")} disabled={isLoading} maxLength={6} />
        {errors.code && <p className="text-sm text-red-500">{errors.code.message}</p>}
      </div>

      <Button type="submit" className="w-full bg-yellow-400 hover:bg-yellow-500 text-black" disabled={isLoading}>
        {isLoading ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Verifying...
          </>
        ) : (
          "Verify Email"
        )}
      </Button>

      <div className="text-center text-sm">
        {canResend ? (
          <Button
            type="button"
            variant="link"
            onClick={handleResendCode}
            disabled={isLoading}
            className="text-yellow-500 hover:text-yellow-400"
          >
            Resend code
          </Button>
        ) : (
          <p className="text-gray-500">Resend code in {countdown} seconds</p>
        )}
      </div>
    </form>
  )
}
