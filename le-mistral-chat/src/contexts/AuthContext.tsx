import { createContext, useContext, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";

const SESSION_CACHE_KEY = "mistral-chat-session-cache";

type AuthContextValue = {
  user: User | null;
  session: Session | null;
  initializing: boolean;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signUp: (email: string, password: string) => Promise<{ error: Error | null }>;
  signInWithGoogle: () => Promise<{ error: Error | null }>;
  resetPassword: (email: string) => Promise<{ error: Error | null }>;
  passwordResetRequested: boolean;
  dismissPasswordReset: () => void;
  completePasswordReset: (password: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [initializing, setInitializing] = useState(true);
  const [passwordResetRequested, setPasswordResetRequested] = useState(false);

  // Hydrate immediately from our own cache so UI updates before Supabase finishes.
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const cached = window.localStorage.getItem(SESSION_CACHE_KEY);
      if (cached) {
        const parsed = JSON.parse(cached) as Session;
        setSession(parsed);
        setUser(parsed.user ?? null);
      }
    } catch (error) {
      console.warn("Failed to parse cached session", error);
    }
  }, []);

  useEffect(() => {
    let subscribed = true;

    supabase.auth.getSession().then(({ data, error }) => {
      if (!subscribed) return;
      if (error) {
        console.error("Supabase session load failed", error);
      }
      setSession(data.session ?? null);
      setUser(data.session?.user ?? null);
      setInitializing(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, nextSession) => {
      if (!subscribed) return;
      setSession(nextSession);
      setUser(nextSession?.user ?? null);
      setInitializing(false);
      if (event === "PASSWORD_RECOVERY") {
        setPasswordResetRequested(true);
      }
    });

    return () => {
      subscribed = false;
      subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (session) {
      window.localStorage.setItem(SESSION_CACHE_KEY, JSON.stringify(session));
    } else {
      window.localStorage.removeItem(SESSION_CACHE_KEY);
    }
  }, [session]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const hash = window.location.hash;
    if (hash.includes("type=recovery")) {
      setPasswordResetRequested(true);
      // Strip the hash so future reloads don't re-trigger the modal unnecessarily.
      window.history.replaceState({}, document.title, window.location.pathname + window.location.search);
    }
  }, []);

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return { error };
  };

  const signUp = async (email: string, password: string) => {
    const redirectTo = typeof window === "undefined" ? undefined : window.location.origin;
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: redirectTo,
      },
    });
    return { error };
  };

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  const resetPassword = async (email: string) => {
    const redirectTo = typeof window === "undefined" ? undefined : window.location.origin;
    const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo });
    return { error };
  };

  const completePasswordReset = async (password: string) => {
    const { error } = await supabase.auth.updateUser({ password });
    if (!error) {
      setPasswordResetRequested(false);
    }
    return { error };
  };

  const dismissPasswordReset = () => {
    setPasswordResetRequested(false);
  };

  const signInWithGoogle = async () => {
    const redirectTo = typeof window === "undefined" ? undefined : window.location.origin;
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo },
    });
    return { error };
  };

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      session,
      initializing,
      signIn,
      signUp,
      signInWithGoogle,
      resetPassword,
      passwordResetRequested,
      dismissPasswordReset,
      completePasswordReset,
      signOut,
    }),
    [user, session, initializing, passwordResetRequested]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
