"use client";

import React, { createContext, useCallback, useContext, useEffect, useState } from "react";
import { api, type User } from "./api";

type AuthValue = {
  user: User | null;
  loading: boolean;
  register: (email: string, password: string, name?: string) => Promise<void>;
  login: (email: string, password: string) => Promise<void>;
  loginGoogle: (credential: string) => Promise<void>;
  logout: () => Promise<void>;
};

const Ctx = createContext<AuthValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  // Restore session from the HttpOnly cookie on load.
  useEffect(() => {
    let cancelled = false;
    api
      .me()
      .then((d) => { if (!cancelled) setUser(d.user); })
      .catch(() => {})
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  const register = useCallback(async (email: string, password: string, name?: string) => {
    setUser((await api.register(email, password, name)).user);
  }, []);
  const login = useCallback(async (email: string, password: string) => {
    setUser((await api.login(email, password)).user);
  }, []);
  const loginGoogle = useCallback(async (credential: string) => {
    setUser((await api.google(credential)).user);
  }, []);
  const logout = useCallback(async () => {
    await api.logout().catch(() => {});
    setUser(null);
  }, []);

  return (
    <Ctx.Provider value={{ user, loading, register, login, loginGoogle, logout }}>
      {children}
    </Ctx.Provider>
  );
}

export function useAuth() {
  const c = useContext(Ctx);
  if (!c) throw new Error("useAuth must be used within <AuthProvider>");
  return c;
}
