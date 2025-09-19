import { NextRequest, NextResponse } from "next/server";

export function middleware(request: NextRequest) {
  // Clone the request headers
  const requestHeaders = new Headers(request.headers);

  // Get token from the cookie if needed (for edge functions)
  const authCookie = request.cookies.get("authToken");
  if (authCookie?.value) {
    requestHeaders.set("Authorization", `Bearer ${authCookie.value}`);
  }

  // Forward the request with the new headers
  return NextResponse.next({
    request: {
      headers: requestHeaders,
    },
  });
}

// Apply middleware to specific paths
export const config = {
  matcher: [
    // Apply to all paths under /settings
    "/settings/:path*",
    // Add other paths that need authentication
    "/api/:path*",
  ],
};
