"use client";

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase/client";

type AuthContextValue = {
  user: User | null;
  session: Session | null;
  loading: boolean;
  signInWithPassword: (email: string, password: string) => Promise<{
    success: boolean;
    error?: string;
  }>;
  signUpWithPassword: (
    email: string,
    password: string,
    name?: string,
    emailRedirectTo?: string,
  ) => Promise<{ success: boolean; error?: string }>;
  signInWithGoogle: (
    redirectTo?: string,
  ) => Promise<{ success: boolean; error?: string }>;
  signOut: () => Promise<void>;
  resetPasswordForEmail: (
    email: string,
    redirectTo: string,
  ) => Promise<{ success: boolean; error?: string }>;
  updatePassword: (password: string) => Promise<{ success: boolean; error?: string }>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return ctx;
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    supabase.auth
      .getSession()
      .then(({ data }) => {
        if (!mounted) return;
        setSession(data.session ?? null);
        setUser(data.session?.user ?? null);
        setLoading(false);
      })
      .catch(() => {
        if (!mounted) return;
        setLoading(false);
      });

    const { data: listener } = supabase.auth.onAuthStateChange(
      (_event, nextSession) => {
        setSession(nextSession);
        setUser(nextSession?.user ?? null);
        setLoading(false);
      },
    );

    return () => {
      mounted = false;
      listener.subscription.unsubscribe();
    };
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      session,
      loading,
      signInWithPassword: async (email, password) => {
        setLoading(true);
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (!error) {
          try {
            await fetch("/api/auth/sync-role", { method: "POST" });
          } catch {}
        }
        setLoading(false);
        return error
          ? { success: false, error: error.message }
          : { success: true };
      },
      signUpWithPassword: async (email, password, name, emailRedirectTo) => {
        setLoading(true);
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            ...(name ? { data: { name } } : {}),
            ...(emailRedirectTo ? { emailRedirectTo } : {}),
          },
        });
        setLoading(false);
        return error
          ? { success: false, error: error.message }
          : { success: true };
      },
      signInWithGoogle: async (redirectTo) => {
        const { error } = await supabase.auth.signInWithOAuth({
          provider: "google",
          options: redirectTo ? { redirectTo } : undefined,
        });
        return error
          ? { success: false, error: error.message }
          : { success: true };
      },
      signOut: async () => {
        await supabase.auth.signOut();
      },
      resetPasswordForEmail: async (email, redirectTo) => {
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo,
        });
        return error
          ? { success: false, error: error.message }
          : { success: true };
      },
      updatePassword: async (password) => {
        const { error } = await supabase.auth.updateUser({ password });
        return error
          ? { success: false, error: error.message }
          : { success: true };
      },
    }),
    [loading, session, user],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
