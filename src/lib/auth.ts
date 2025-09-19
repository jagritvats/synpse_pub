import { verifyToken } from "@/lib/jwt";
import type { User } from "@/lib/types";
import { db } from "@/lib/db";
import { ObjectId } from "mongodb";
import { headers } from "next/headers";

/**
 * Gets the current user for server components, retrieving the JWT token
 * from either the Authorization header or localStorage.
 */
export async function getUser(): Promise<User | null> {
  let token: string | null = null;

  // For server components (Server-Side Rendering)
  try {
    // Check headers for Authorization token first
    const headersList = headers();
    const authorization = headersList.get("Authorization");
    if (authorization && authorization.startsWith("Bearer ")) {
      token = authorization.split("Bearer ")[1];
    }
  } catch (error) {
    // Headers might not be available in all contexts
    console.error("Error accessing headers:", error);
  }

  if (!token) {
    return null;
  }

  try {
    const payload = await verifyToken(token);

    // Get fresh user data from database
    const user = await db
      .collection("users")
      .findOne({ _id: new ObjectId(payload.id) });

    if (!user) {
      return null;
    }

    return {
      id: user._id.toString(),
      name: user.name,
      email: user.email,
      subscription: user.subscription,
      verified: user.verified,
    } as User;
  } catch (error) {
    console.error("Error verifying token:", error);
    return null;
  }
}
