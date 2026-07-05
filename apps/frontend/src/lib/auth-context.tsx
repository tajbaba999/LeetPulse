"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

import type { AuthTokens, UserProfile } from "./api/types";

import { getUserProfile } from "./api/codingprofile";
import { clearTokens, hasSession, setTokens } from "./api/tokens";

type AuthStatus = "loading" | "authenticated" | "unauthenticated";

type AuthContextValue = {
  user: UserProfile | null;
  status: AuthStatus;
  login: (tokens: AuthTokens) => Promise<UserProfile>;
  logout: () => void;
  refreshUser: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [status, setStatus] = useState<AuthStatus>("loading");

  const loadUser = useCallback(async () => {
    try {
      const profile = await getUserProfile();
      setUser(profile);
      setStatus("authenticated");
      return profile;
    } catch {
      clearTokens();
      setUser(null);
      setStatus("unauthenticated");
      throw new Error("Session expired");
    }
  }, []);

  useEffect(() => {
    if (!hasSession()) {
      setStatus("unauthenticated");
      return;
    }
    loadUser().catch(() => {});
  }, [loadUser]);

  const login = useCallback(
    async (tokens: AuthTokens) => {
      setTokens(tokens.accessToken, tokens.refreshToken);
      return loadUser();
    },
    [loadUser],
  );

  const logout = useCallback(() => {
    clearTokens();
    setUser(null);
    setStatus("unauthenticated");
  }, []);

  const refreshUser = useCallback(async () => {
    await loadUser().catch(() => {});
  }, [loadUser]);

  const value = useMemo(
    () => ({ user, status, login, logout, refreshUser }),
    [user, status, login, logout, refreshUser],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within an AuthProvider");
  return ctx;
}
