import { getSession } from "next-auth/react";

/**
 * Fetch with authentication headers for authenticated API requests
 *
 * @param url URL to fetch
 * @param options Fetch options
 * @returns Fetch response
 */
export async function fetchWithAuth(
  url: string,
  options?: RequestInit
): Promise<Response> {
  const session = await getSession();
  const token = session?.user?.token || "";

  const headers = new Headers(options?.headers || {});
  headers.set("Authorization", `Bearer ${token}`);

  return fetch(url, {
    ...options,
    headers,
  });
}

/**
 * Parse error from API response
 *
 * @param response Fetch response
 * @returns Error message
 */
export async function parseApiError(response: Response): Promise<string> {
  try {
    const data = await response.json();
    return (
      data.message ||
      data.error ||
      `Error: ${response.status} ${response.statusText}`
    );
  } catch (e) {
    return `Error: ${response.status} ${response.statusText}`;
  }
}
