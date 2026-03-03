"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

type AuthActionResult = {
  success: boolean;
  error?: string;
};

type AuthUser = {
  id: string;
  email: string;
  name?: string;
  role?: string;
};

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000';
const TOKEN_STORAGE_KEY = 'auth_token';
const USER_STORAGE_KEY = 'auth_user';
const LAST_ACTIVE_STORAGE_KEY = 'auth_last_active';
const SESSION_TIMEOUT_MS = 30 * 60 * 1000; // 30 minutes

const readStoredValue = (key: string): string | null => {
  if (typeof window === 'undefined') {
    return null;
  }
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
};

const readLastActive = (): number | null => {
  const raw = readStoredValue(LAST_ACTIVE_STORAGE_KEY);
  if (!raw) return null;
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : null;
};

const readStoredUser = (): AuthUser | null => {
  const raw = readStoredValue(USER_STORAGE_KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as AuthUser;
    if (parsed && typeof parsed.email === 'string' && typeof parsed.id === 'string') {
      return parsed;
    }
  } catch {
    return null;
  }
  return null;
};

type AuthContextValue = {
  user: AuthUser | null;
  token: string | null;
  isAuthenticated: boolean;
  login: (
    email: string,
    password: string,
    metadata?: Partial<AuthUser>,
  ) => Promise<AuthActionResult>;
  register: (
    name: string,
    email: string,
    password: string,
    role?: string,
  ) => Promise<AuthActionResult>;
  logout: () => void;
  loading: boolean;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(() => readStoredValue(TOKEN_STORAGE_KEY));
  const [user, setUser] = useState<AuthUser | null>(() => readStoredUser());
  const [loading, setLoading] = useState(false);

  // On mount or when token changes, enforce session timeout
  useEffect(() => {
    if (!token) return;
    const lastActive = readLastActive();
    if (lastActive && Date.now() - lastActive > SESSION_TIMEOUT_MS) {
      setToken(null);
      setUser(null);
      if (typeof window !== "undefined") {
        window.localStorage.removeItem(TOKEN_STORAGE_KEY);
        window.localStorage.removeItem(USER_STORAGE_KEY);
        window.localStorage.removeItem(LAST_ACTIVE_STORAGE_KEY);
      }
    }
  }, [token]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (token) {
      window.localStorage.setItem(TOKEN_STORAGE_KEY, token);
    } else {
      window.localStorage.removeItem(TOKEN_STORAGE_KEY);
    }
  }, [token]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (user) {
      window.localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(user));
    } else {
      window.localStorage.removeItem(USER_STORAGE_KEY);
    }
  }, [user]);

  const touchLastActive = useCallback(() => {
    if (typeof window === "undefined") return;
    if (!token) return;
    try {
      window.localStorage.setItem(LAST_ACTIVE_STORAGE_KEY, Date.now().toString());
    } catch {
      // ignore storage errors
    }
  }, [token]);

  const logout = useCallback(() => {
    setToken(null);
    setUser(null);
    if (typeof window !== "undefined") {
      window.localStorage.removeItem(TOKEN_STORAGE_KEY);
      window.localStorage.removeItem(USER_STORAGE_KEY);
      window.localStorage.removeItem(LAST_ACTIVE_STORAGE_KEY);
    }
  }, []);

  const login = useCallback(
    async (
      email: string,
      password: string,
      metadata?: Partial<AuthUser>,
    ): Promise<AuthActionResult> => {
      setLoading(true);
      try {
        const response = await fetch(`${API_URL}/auth/login`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ userid: email, password }),
        });

        const data = await response.json().catch(() => ({}));
        if (!response.ok) {
          const detail =
            typeof data?.detail === "string"
              ? data.detail
              : "Unable to sign in. Please try again.";
          return { success: false, error: detail };
        }

        if (typeof data?.access_token !== "string") {
          return { success: false, error: "Login response did not contain an access token." };
        }

        // Try to get existing user data from localStorage to preserve role
        const existingUser = readStoredUser();
        const preservedRole = existingUser?.email === email ? existingUser.role : undefined;

        const authUser: AuthUser = {
          id: metadata?.id ?? email,
          email,
          name: metadata?.name ?? existingUser?.name,
          role: metadata?.role ?? preservedRole ?? 'student',
        };

        setToken(data.access_token);
        setUser(authUser);
        touchLastActive();
        return { success: true };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : "Login failed. Please try again.",
        };
      } finally {
        setLoading(false);
      }
    },
    [touchLastActive],
  );

  const register = useCallback(
    async (
      name: string,
      email: string,
      password: string,
      role: string = "student",
    ): Promise<AuthActionResult> => {
      setLoading(true);
      try {
        const response = await fetch(`${API_URL}/auth/signup`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ userid: email, password }),
        });

        const data = await response.json().catch(() => ({}));
        if (!response.ok) {
          const detail =
            typeof data?.detail === "string"
              ? data.detail
              : "Unable to create an account. Please try again.";
          return { success: false, error: detail };
        }

        const result = await login(email, password, { name, role, id: email });
        if (result.success) {
          touchLastActive();
        }
        return result;
      } catch (error) {
        return {
          success: false,
          error:
            error instanceof Error ? error.message : "Registration failed. Please try again.",
        };
      } finally {
        setLoading(false);
      }
    },
    [login, touchLastActive],
  );

  // Track user activity to keep session alive while active and expire after inactivity
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!token) return;

    const events: Array<keyof WindowEventMap> = ["click", "keydown", "mousemove", "touchstart"];
    const handler = () => touchLastActive();

    events.forEach((event) => window.addEventListener(event, handler));
    return () => {
      events.forEach((event) => window.removeEventListener(event, handler));
    };
  }, [token, touchLastActive]);

  // Periodically check for session timeout
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!token) return;

    const interval = window.setInterval(() => {
      const lastActive = readLastActive();
      if (lastActive && Date.now() - lastActive > SESSION_TIMEOUT_MS) {
        logout();
      }
    }, 60_000);

    return () => window.clearInterval(interval);
  }, [token, logout]);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      token,
      isAuthenticated: Boolean(token),
      login,
      register,
      logout,
      loading,
    }),
    [user, token, login, register, logout, loading],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
