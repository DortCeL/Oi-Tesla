import { apiUrl } from "./api";
import { clearAuth, getAuth } from "./auth.client";

export async function authFetch(path: string, init: RequestInit = {}) {
  const auth = getAuth();
  if (!auth) {
    throw new Response("Unauthorized", { status: 401 });
  }

  const headers = new Headers(init.headers);
  if (!headers.has("Content-Type") && init.body) {
    headers.set("Content-Type", "application/json");
  }
  headers.set("Authorization", `Bearer ${auth.token}`);

  const res = await fetch(apiUrl(path), { ...init, headers });

  if (res.status === 401) {
    clearAuth();
    throw new Response("Session expired", { status: 401 });
  }

  return res;
}

export async function authJson<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await authFetch(path, init);
  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as { error?: string } | null;
    throw new Error(body?.error ?? `Request failed (${res.status})`);
  }
  return res.json() as Promise<T>;
}
