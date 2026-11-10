"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { api, getToken, setToken, type User } from "@/lib/api";

interface AuthCtx {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  signup: (email: string, password: string, name: string) => Promise<void>;
  logout: () => void;
  refresh: () => Promise<void>;
}

const Ctx = createContext<AuthCtx | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!getToken()) {
      setUser(null);
      setLoading(false);
      return;
    }
    try {
      setUser(await api<User>("/api/auth/me"));
    } catch {
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const login = async (email: string, password: string) => {
    const r = await api<{ access_token: string; user: User }>("/api/auth/login", { method: "POST", json: { email, password } });
    setToken(r.access_token);
    setUser(r.user);
  };

  const signup = async (email: string, password: string, name: string) => {
    const r = await api<{ access_token: string; user: User }>("/api/auth/signup", {
      method: "POST",
      json: { email, password, name },
    });
    setToken(r.access_token);
    setUser(r.user);
  };

  const logout = () => {
    setToken(null);
    setUser(null);
    window.location.href = "/";
  };

  return <Ctx.Provider value={{ user, loading, login, signup, logout, refresh }}>{children}</Ctx.Provider>;
}

export function useAuth() {
  const c = useContext(Ctx);
  if (!c) throw new Error("useAuth must be used inside AuthProvider");
  return c;
}
