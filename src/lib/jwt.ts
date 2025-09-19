import { SignJWT, jwtVerify } from "jose"
import type { JWTPayload } from "@/lib/types"

const secret = new TextEncoder().encode(process.env.JWT_SECRET || "your-secret-key")

export async function generateToken(payload: JWTPayload): Promise<string> {
  return await new SignJWT(payload)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("7d")
    .sign(secret)
}

export async function verifyToken(token: string): Promise<JWTPayload> {
  const { payload } = await jwtVerify(token, secret)
  return payload as JWTPayload
}
