import { NextRequest, NextResponse } from "next/server";
import jwt from "jsonwebtoken";
import { userService } from "@/../server/src/services/user.service"; // Adjust path as needed
import mongoose from "mongoose";
import { databaseService } from "@/../server/src/config/mongodb"; // Adjust path

// --- Temporary Auth Utility --- G
// TODO: Replace this with a shared library or proper session management
interface AuthResult {
  userId?: string;
  error?: string;
  status?: number;
}

async function verifyAuth(req: NextRequest): Promise<AuthResult> {
  const authHeader = req.headers.get("authorization");
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return { error: "Unauthorized: No token provided", status: 401 };
  }

  const token = authHeader.split(" ")[1];

  // Handle anonymous
  if (token === "anonymous") {
    // Decide how to handle anonymous for this specific route.
    // For fetching/setting user-specific prompts, anonymous doesn't make sense.
    return { error: "Unauthorized: Operation requires login", status: 401 };
    // If anonymous *should* be allowed for some reason:
    // return { userId: 'anonymous' };
  }

  try {
    const secret = process.env.JWT_SECRET;
    if (!secret) {
      console.error("JWT_SECRET is not defined");
      return { error: "Internal Server Error", status: 500 };
    }
    const decoded = jwt.verify(token, secret) as { id: string };
    return { userId: decoded.id };
  } catch (error: unknown) {
    if (error instanceof jwt.TokenExpiredError) {
      return { error: "Unauthorized: Token expired", status: 401 };
    }
    if (error instanceof jwt.JsonWebTokenError) {
      return { error: `Unauthorized: ${error.message}`, status: 401 };
    }
    console.error("Auth verification error:", error);
    return { error: "Internal Server Error", status: 500 };
  }
}
// --- End Temporary Auth Utility ---

export async function GET(req: NextRequest) {
  await databaseService.connect(); // Ensure DB connection

  const auth = await verifyAuth(req);
  if (auth.error || !auth.userId) {
    return NextResponse.json(
      { message: auth.error },
      { status: auth.status || 401 }
    );
  }

  try {
    const user = await userService.findUserById(auth.userId);
    if (!user) {
      return NextResponse.json({ message: "User not found" }, { status: 404 });
    }
    return NextResponse.json({ globalPrompt: user.globalPrompt || "" });
  } catch (error) {
    console.error("Error fetching global prompt:", error);
    return NextResponse.json(
      { message: "Error fetching global prompt" },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  await databaseService.connect(); // Ensure DB connection

  const auth = await verifyAuth(req);
  if (auth.error || !auth.userId) {
    return NextResponse.json(
      { message: auth.error },
      { status: auth.status || 401 }
    );
  }

  try {
    const body = await req.json();
    const { prompt } = body;

    if (typeof prompt !== "string") {
      return NextResponse.json(
        { message: "Invalid prompt data" },
        { status: 400 }
      );
    }

    const updatedUser = await userService.updateUserPrompt(auth.userId, prompt);

    if (!updatedUser) {
      return NextResponse.json({ message: "User not found" }, { status: 404 });
    }

    return NextResponse.json({
      message: "Prompt updated successfully",
      globalPrompt: updatedUser.globalPrompt,
    });
  } catch (error) {
    console.error("Error updating global prompt:", error);
    // Handle JSON parsing errors
    if (error instanceof SyntaxError) {
      return NextResponse.json(
        { message: "Invalid JSON body" },
        { status: 400 }
      );
    }
    return NextResponse.json(
      { message: "Error updating global prompt" },
      { status: 500 }
    );
  }
}
