import Link from "next/link"
import { VerifyForm } from "@/components/auth/verify-form"

export default function VerifyPage() {
  return (
    <div className="flex min-h-screen flex-col">
      <div className="flex min-h-screen flex-col items-center justify-center px-4 py-12">
        <Link href="/" className="mb-8 flex items-center">
          <span className="text-2xl font-bold">Synapse</span>
        </Link>
        <div className="w-full max-w-md space-y-8">
          <div className="text-center">
            <h1 className="text-2xl font-bold tracking-tight">Verify your email</h1>
            <p className="mt-2 text-sm text-gray-500">We've sent a verification code to your email</p>
          </div>
          <VerifyForm />
        </div>
      </div>
    </div>
  )
}
