function getAuthToken(): string | null {
  // Check if running in a browser environment
  if (typeof window === "undefined" || typeof localStorage === "undefined") {
    // Handle server-side or environments without localStorage
    // console.warn("localStorage not available. Returning null.");
    return null;
  }
  const token = localStorage.getItem("authToken");
  // Return stored token or null if none found
  return token || null;
}

const NEXTJS_API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:3000";
const EXPRESS_API_BASE_URL = "http://localhost:5000"; // Assume Express runs on 5000

interface FetchOptions extends RequestInit {
  includeAuth?: boolean;
  body?: any;
  targetBackend?: "nextjs" | "express"; // Add option to target specific backend
}

/**
 * Custom fetch wrapper to handle base URL, JSON parsing, and authentication.
 */
export const apiClient = async <T = any>(
  endpoint: string,
  options: FetchOptions = {}
): Promise<T> => {
  // Determine target backend: default to nextjs, unless endpoint starts with /auth or /chat
  const isExpressRoute =
    endpoint.startsWith("/auth") ||
    endpoint.startsWith("/chat") ||
    endpoint.startsWith("/api/dev/companion-thinking");
  const target =
    options.targetBackend || (isExpressRoute ? "express" : "nextjs");
  const baseUrl =
    target === "express" ? EXPRESS_API_BASE_URL : NEXTJS_API_BASE_URL;

  const { includeAuth = true, headers = {}, body, ...restOptions } = options;

  // For debug:
  console.log(
    `API call: ${options.method || "GET"} ${endpoint} to ${target} backend`
  );

  // Adjust endpoint for Express backend to include /api prefix
  const finalEndpoint =
    target === "express" && !endpoint.startsWith("/api")
      ? `/api${endpoint}`
      : endpoint;

  const fetchHeaders = new Headers(headers);

  // Add Authorization header if requested and token exists
  if (includeAuth) {
    const token = getAuthToken();
    if (token) {
      fetchHeaders.set("Authorization", `Bearer ${token}`);
      console.log("Using auth token:", token.substring(0, 10) + "...");
    } else {
      console.warn("No auth token available for API call");
    }
  }

  // Set Content-Type for JSON body
  let requestBody = body;
  if (body && typeof body === "object" && !(body instanceof FormData)) {
    fetchHeaders.set("Content-Type", "application/json");
    requestBody = JSON.stringify(body);
    console.log("Request body:", body);
  }

  const url = `${baseUrl}${finalEndpoint}`;
  console.log(`Fetching: ${options.method || "GET"} ${url}`);

  try {
    const response = await fetch(url, {
      ...restOptions,
      headers: fetchHeaders,
      body: requestBody,
    });

    console.log(`Response status:`, response.status);

    // Attempt to parse JSON response, handle empty response
    let responseData: T;
    const contentType = response.headers.get("content-type");
    if (
      response.status !== 204 &&
      contentType &&
      contentType.includes("application/json")
    ) {
      responseData = await response.json();
      console.log("Response data:", responseData);
    } else {
      // Handle non-JSON or empty responses appropriately
      console.log("Non-JSON response:", response.statusText);
      responseData = undefined as T;
    }

    if (!response.ok) {
      // Throw an error object with status and message if possible
      const errorData = responseData as any;
      const errorMessage =
        errorData?.message ||
        response.statusText ||
        `Request failed with status ${response.status}`;
      console.error(`API Error (${response.status}): ${errorMessage}`);
      const error = new Error(errorMessage) as any;
      error.status = response.status;
      error.response = responseData;
      throw error;
    }

    return responseData;
  } catch (error) {
    console.error(
      `API Fetch Error (${options.method || "GET"} ${url}):`,
      error
    );
    throw error;
  }
};

/**
 * Adds the authentication token to headers for server components
 * @param headers Headers object to modify
 */
export function addAuthToHeaders(headers: Headers): void {
  if (typeof window !== "undefined" && localStorage) {
    const token = localStorage.getItem("authToken");
    if (token) {
      headers.set("Authorization", `Bearer ${token}`);
    }
  }
}

/**
 * Helper function to get current auth token for server components
 * This can be used to pass the token to the server in a more explicit way
 */
export function getServerAuthToken(): string | null {
  if (typeof window !== "undefined" && localStorage) {
    return localStorage.getItem("authToken");
  }
  return null;
}

// Example Usage:
// apiClient('/chat/sessions') // GET request with auth
// apiClient('/auth/login', { method: 'POST', body: { email, password }, includeAuth: false })
// apiClient('/user/profile', { method: 'PUT', body: profileData })
