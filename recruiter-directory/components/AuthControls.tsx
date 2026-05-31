"use client";

import React, { useEffect, useRef, useState } from "react";
import { LogOut, X } from "lucide-react";
import { useAuth } from "../lib/auth";

const GOOGLE_CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;

// Minimal GIS typing
declare global {
  interface Window {
    google?: { accounts?: { id?: { initialize: (o: object) => void; renderButton: (el: HTMLElement, o: object) => void } } };
  }
}

const inputCls =
  "w-full h-9 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-transparent px-3 text-sm focus:outline-none focus:ring-2 focus:ring-black/5 dark:focus:ring-white/10";

/** "Sign in with Google" button via Google Identity Services (ID-token flow). */
function GoogleButton({ onError, onDone }: { onError: (m: string) => void; onDone: () => void }) {
  const { loginGoogle } = useAuth();
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!GOOGLE_CLIENT_ID || !ref.current) return;
    let cancelled = false;
    const render = () => {
      const id = window.google?.accounts?.id;
      if (cancelled || !id || !ref.current) return;
      id.initialize({
        client_id: GOOGLE_CLIENT_ID,
        callback: async (resp: { credential: string }) => {
          try {
            await loginGoogle(resp.credential);
            onDone();
          } catch (e) {
            onError(e instanceof Error ? e.message : "Google sign-in failed");
          }
        },
      });
      id.renderButton(ref.current, { theme: "outline", size: "large", text: "continue_with", shape: "pill", width: 260 });
    };
    if (window.google?.accounts?.id) {
      render();
    } else {
      const existing = document.getElementById("gsi-client") as HTMLScriptElement | null;
      const s = existing ?? document.createElement("script");
      if (!existing) {
        s.id = "gsi-client";
        s.src = "https://accounts.google.com/gsi/client";
        s.async = true;
        document.head.appendChild(s);
      }
      s.addEventListener("load", render);
    }
    return () => { cancelled = true; };
  }, [loginGoogle, onDone, onError]);

  if (!GOOGLE_CLIENT_ID) return null;
  return <div ref={ref} className="flex justify-center" />;
}

function AuthModal({ onClose }: { onClose: () => void }) {
  const { login, register } = useAuth();
  const [mode, setMode] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr(null);
    setBusy(true);
    try {
      if (mode === "login") await login(email, password);
      else await register(email, password, name || undefined);
      onClose();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] grid place-items-center bg-black/40 p-4" onClick={onClose}>
      <div
        className="w-full max-w-sm rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">{mode === "login" ? "Sign in" : "Create account"}</h2>
          <button onClick={onClose} className="text-zinc-400 hover:text-zinc-600" aria-label="Close"><X className="h-4 w-4" /></button>
        </div>

        <GoogleButton onError={setErr} onDone={onClose} />
        {GOOGLE_CLIENT_ID && (
          <div className="my-4 flex items-center gap-3 text-[10px] uppercase tracking-widest text-zinc-400">
            <div className="h-px flex-1 bg-zinc-200 dark:bg-zinc-800" />or<div className="h-px flex-1 bg-zinc-200 dark:bg-zinc-800" />
          </div>
        )}

        <form onSubmit={submit} className="space-y-3">
          {mode === "register" && (
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Name (optional)" className={inputCls} />
          )}
          <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email" className={inputCls} />
          <input type="password" required minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Password (min 8 chars)" className={inputCls} />
          {err && <div className="text-xs text-red-600 dark:text-red-400">{err}</div>}
          <button disabled={busy} className="w-full h-9 rounded-lg bg-black text-white dark:bg-white dark:text-black text-sm font-medium disabled:opacity-50">
            {busy ? "…" : mode === "login" ? "Sign in" : "Create account"}
          </button>
        </form>

        <div className="mt-3 text-center text-xs text-zinc-500">
          {mode === "login" ? (
            <>No account? <button onClick={() => { setMode("register"); setErr(null); }} className="underline">Create one</button></>
          ) : (
            <>Have an account? <button onClick={() => { setMode("login"); setErr(null); }} className="underline">Sign in</button></>
          )}
        </div>
      </div>
    </div>
  );
}

export function AuthControls() {
  const { user, loading, logout } = useAuth();
  const [open, setOpen] = useState(false);

  if (loading) return <div className="w-8 h-8" aria-hidden />;

  if (user) {
    const label = user.name || user.email;
    return (
      <div className="flex items-center gap-2">
        {user.picture ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={user.picture} alt="" className="w-7 h-7 rounded-full" referrerPolicy="no-referrer" />
        ) : (
          <div className="w-7 h-7 rounded-full bg-zinc-200 dark:bg-zinc-800 grid place-items-center text-xs font-medium">
            {label.charAt(0).toUpperCase()}
          </div>
        )}
        <span className="hidden sm:block text-xs text-zinc-600 dark:text-zinc-400 max-w-[140px] truncate" title={user.email}>{label}</span>
        <button onClick={() => logout()} title="Sign out" aria-label="Sign out" className="inline-flex items-center justify-center rounded-full border border-zinc-200 dark:border-zinc-800 w-8 h-8 text-zinc-600 dark:text-zinc-400">
          <LogOut className="h-4 w-4" />
        </button>
      </div>
    );
  }

  return (
    <>
      <button onClick={() => setOpen(true)} className="inline-flex items-center gap-1.5 rounded-full px-3 h-8 text-xs font-medium border border-zinc-200 dark:border-zinc-800">
        Sign in
      </button>
      {open && <AuthModal onClose={() => setOpen(false)} />}
    </>
  );
}
