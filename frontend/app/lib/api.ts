/** Normalize paths so callers can pass `/zones` or `/api/zones`. */
function withApiPrefix(path: string): string {
  if (path.startsWith("/api/")) {
    return path;
  }
  return `/api${path.startsWith("/") ? path : `/${path}`}`;
}

/**
 * Base URL for backend API calls.
 * - Browser (prod Docker): VITE_API_URL from build args
 * - Browser (local dev): empty → relative `/api` via Vite proxy
 * - SSR in Docker: API_URL → http://api:3001
 */
export function getApiBaseUrl(): string {
  if (import.meta.env.SSR) {
    return process.env.API_URL ?? "http://localhost:3001";
  }

  return import.meta.env.VITE_API_URL ?? "";
}

export function apiUrl(path: string): string {
  const base = getApiBaseUrl().replace(/\/$/, "");
  const normalized = withApiPrefix(path);
  return base ? `${base}${normalized}` : normalized;
}
