"use client";

import React, { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
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
      // GIS only takes a fixed pixel width (max 400), so match the container's
      // measured width to line the button up with the full-width form inputs.
      const width = Math.min(400, Math.round(ref.current.clientWidth));
      id.renderButton(ref.current, { theme: "outline", size: "large", text: "continue_with", shape: "rectangular", width });
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
  return <div ref={ref} className="w-full overflow-hidden rounded-lg [&>div]:!w-full [&_iframe]:!w-full" />;
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

  if (typeof document === "undefined") return null;
  // Portal to <body> so the overlay isn't trapped inside the header's z-50 stacking
  // context (otherwise the backdrop paints OVER the nav instead of behind it).
  return createPortal(
    <>
      {/* Dim backdrop sits ABOVE the sticky header (z-50) so the nav is dimmed too. */}
      <div className="fixed inset-0 z-[90] bg-black/40" onClick={onClose} aria-hidden />
      {/* Panel layer is above everything; transparent + pointer-events-none so clicks
          outside the panel fall through to the backdrop (close) and the nav stays usable. */}
      <div className="fixed inset-0 z-[100] grid place-items-center p-4 pointer-events-none">
        <div
          className="pointer-events-auto w-full max-w-sm rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-6 shadow-xl"
          onClick={(e) => e.stopPropagation()}
        >
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">{mode === "login" ? "Sign in" : "Create account"}</h2>
          <button onClick={onClose} className="text-zinc-400 hover:text-zinc-600" aria-label="Close"><X className="h-4 w-4" /></button>
        </div>

        <form onSubmit={submit} className="space-y-3">
          {mode === "register" && (
            <label className="block">
              <span className="mb-1 block text-sm font-medium text-zinc-600 dark:text-zinc-400">Name</span>
              <input value={name} onChange={(e) => setName(e.target.value)} className={inputCls} />
            </label>
          )}
          <label className="block">
            <span className="mb-1 block text-sm font-medium text-zinc-600 dark:text-zinc-400">Email</span>
            <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} className={inputCls} />
          </label>
          <label className="block">
            <span className="mb-1 block text-sm font-medium text-zinc-600 dark:text-zinc-400">Password</span>
            <input type="password" required minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} className={inputCls} />
          </label>
          {err && <div className="text-xs text-red-600 dark:text-red-400">{err}</div>}
          <button disabled={busy} className="w-full h-9 rounded-lg bg-black text-white dark:bg-white dark:text-black text-sm font-medium disabled:opacity-50">
            {busy ? "…" : mode === "login" ? "Sign in" : "Create account"}
          </button>
        </form>

        {GOOGLE_CLIENT_ID && (
          <div className="my-4 flex items-center gap-3 text-[10px] uppercase tracking-widest text-zinc-400">
            <div className="h-px flex-1 bg-zinc-200 dark:bg-zinc-800" />or<div className="h-px flex-1 bg-zinc-200 dark:bg-zinc-800" />
          </div>
        )}
        <GoogleButton onError={setErr} onDone={onClose} />

        <div className="mt-3 text-center text-xs text-zinc-500">
          {mode === "login" ? (
            <>No account? <button onClick={() => { setMode("register"); setErr(null); }} className="underline">Create one</button></>
          ) : (
            <>Have an account? <button onClick={() => { setMode("login"); setErr(null); }} className="underline">Sign in</button></>
          )}
        </div>
        </div>
      </div>
    </>,
    document.body,
  );
}

export function AuthControls() {
  const { user, loading, logout } = useAuth();
  const [open, setOpen] = useState(false); // sign-in modal
  const [menuOpen, setMenuOpen] = useState(false); // account dropdown
  const menuRef = useRef<HTMLDivElement>(null);

  // Close the account dropdown on outside click.
  useEffect(() => {
    if (!menuOpen) return;
    const onDown = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [menuOpen]);

  if (loading) return <div className="w-8 h-8" aria-hidden />;

  if (user) {
    const label = user.name || user.email;
    return (
      <div className="relative" ref={menuRef}>
        {/* Nav shows ONLY the avatar circle; click it for the account menu. */}
        <button
          onClick={() => setMenuOpen((o) => !o)}
          aria-label="Account menu"
          aria-haspopup="menu"
          aria-expanded={menuOpen}
          className="block rounded-full ring-1 ring-zinc-200 dark:ring-zinc-800 hover:ring-zinc-300 dark:hover:ring-zinc-700 transition-shadow"
        >
          {user.picture ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={user.picture} alt="" className="w-8 h-8 rounded-full" referrerPolicy="no-referrer" />
          ) : (
            <div className="w-8 h-8 rounded-full bg-zinc-200 dark:bg-zinc-800 grid place-items-center text-xs font-medium">
              {label.charAt(0).toUpperCase()}
            </div>
          )}
        </button>

        {menuOpen && (
          <div
            role="menu"
            className="absolute right-0 top-full mt-2 z-50 w-56 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-lg p-1"
          >
            <div className="px-3 py-2 border-b border-zinc-100 dark:border-zinc-800">
              {user.name && <div className="text-sm font-medium truncate">{user.name}</div>}
              <div className="text-xs text-zinc-500 truncate">{user.email}</div>
            </div>
            <button
              onClick={() => { setMenuOpen(false); logout(); }}
              role="menuitem"
              className="mt-1 w-full text-left px-3 py-2 text-sm rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 inline-flex items-center gap-2"
            >
              <LogOut className="h-4 w-4" /> Sign out
            </button>
          </div>
        )}
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
