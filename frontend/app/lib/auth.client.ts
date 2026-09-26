export type AuthRole = "PASSENGER" | "DRIVER";

type AuthSession = {
  token: string;
  role: AuthRole;
  name: string;
};

const STORAGE_KEY = "oitesla_auth";

export function getAuth(): AuthSession | null {
  const raw = sessionStorage.getItem(STORAGE_KEY);
  if (!raw) {
    return null;
  }

  try {
    return JSON.parse(raw) as AuthSession;
  } catch {
    return null;
  }
}

export function setAuth(session: AuthSession) {
  sessionStorage.setItem(STORAGE_KEY, JSON.stringify(session));
}

export function clearAuth() {
  sessionStorage.removeItem(STORAGE_KEY);
}
