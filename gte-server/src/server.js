import "dotenv/config";
import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import { OAuth2Client } from "google-auth-library";
import { pipeline, env as hfEnv } from "@huggingface/transformers";
import { createClient } from "@supabase/supabase-js";

// --- config ----------------------------------------------------------------
const PORT = Number(process.env.PORT) || 8787;
const MODEL = process.env.EMBEDDING_MODEL || "Supabase/gte-small";
const DIM = Number(process.env.EMBEDDING_DIM) || 384;
const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
const JWT_SECRET = process.env.AUTH_JWT_SECRET;
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;

const COOKIE_NAME = "session";
const SESSION_DAYS = 30;
const COOKIE_OPTS = {
  httpOnly: true,
  secure: process.env.COOKIE_SECURE !== "false", // false only for http localhost dev
  sameSite: process.env.COOKIE_SAMESITE || "none", // "none" for cross-site (vercel↔render)
  path: "/",
  ...(process.env.COOKIE_DOMAIN ? { domain: process.env.COOKIE_DOMAIN } : {}),
};

hfEnv.allowLocalModels = false;

// --- model (loaded once, kept warm) ----------------------------------------
let extractor = null;
let warm = false;
async function getExtractor() {
  if (!extractor) extractor = await pipeline("feature-extraction", MODEL);
  return extractor;
}
async function embed(texts) {
  const ex = await getExtractor();
  const out = await ex(texts, { pooling: "mean", normalize: true });
  return out.tolist();
}

// --- supabase (service key — bypasses RLS) ---------------------------------
const supabase =
  SUPABASE_URL && SUPABASE_KEY
    ? createClient(SUPABASE_URL, SUPABASE_KEY, { auth: { persistSession: false, autoRefreshToken: false } })
    : null;

const googleClient = GOOGLE_CLIENT_ID ? new OAuth2Client(GOOGLE_CLIENT_ID) : null;

// --- auth helpers -----------------------------------------------------------
const PUBLIC_USER = "id,email,name,picture";

function issueSession(res, user) {
  const token = jwt.sign({ uid: user.id, email: user.email }, JWT_SECRET, { expiresIn: `${SESSION_DAYS}d` });
  res.cookie(COOKIE_NAME, token, { ...COOKIE_OPTS, maxAge: SESSION_DAYS * 864e5 });
}
function readSession(req) {
  const token = req.cookies?.[COOKIE_NAME];
  if (!token || !JWT_SECRET) return null;
  try {
    return jwt.verify(token, JWT_SECRET); // { uid, email }
  } catch {
    return null;
  }
}
function requireUser(req, res, next) {
  const s = readSession(req);
  if (!s) return res.status(401).json({ error: "not authenticated" });
  req.uid = s.uid;
  next();
}

// --- app --------------------------------------------------------------------
const app = express();
const origins = process.env.ALLOWED_ORIGINS;
// credentials:true requires reflecting the specific origin (never "*"). `origin:true`
// echoes the request origin; a comma-list restricts to those origins.
app.use(
  cors({
    origin: origins && origins !== "*" ? origins.split(",").map((s) => s.trim()) : true,
    credentials: true,
  }),
);
app.use(express.json({ limit: "4mb" }));
app.use(cookieParser());

app.get("/health", (_req, res) =>
  res.json({ ok: true, model: MODEL, dim: DIM, warm, auth: Boolean(JWT_SECRET), google: Boolean(googleClient) }),
);

// --- embeddings -------------------------------------------------------------
app.post("/embed", async (req, res) => {
  try {
    const texts = Array.isArray(req.body?.texts)
      ? req.body.texts
      : typeof req.body?.text === "string"
        ? [req.body.text]
        : null;
    if (!texts || texts.length === 0) return res.status(400).json({ error: "Provide { texts } or { text }" });
    const embeddings = await embed(texts);
    res.json({ model: MODEL, dim: embeddings[0]?.length ?? DIM, embeddings });
  } catch (e) {
    res.status(500).json({ error: String(e?.message || e) });
  }
});

app.post("/search", async (req, res) => {
  try {
    if (!supabase) return res.status(500).json({ error: "Supabase not configured" });
    const q = String(req.body?.q || "").trim();
    const limit = Math.min(Math.max(Number(req.body?.limit) || 100, 1), 100);
    const threshold = Number.isFinite(Number(req.body?.threshold)) ? Number(req.body.threshold) : 0;
    if (q.length < 2) return res.json({ query: q, matches: [] });
    const [vector] = await embed([q]);
    const { data, error } = await supabase.rpc("match_companies", {
      query_embedding: `[${vector.join(",")}]`,
      match_threshold: threshold,
      match_count: limit,
    });
    if (error) throw new Error(error.message);
    res.json({ query: q, matches: data ?? [] });
  } catch (e) {
    res.status(500).json({ error: String(e?.message || e) });
  }
});

// --- auth -------------------------------------------------------------------
function ensureAuthConfigured(res) {
  if (!JWT_SECRET) {
    res.status(500).json({ error: "Auth not configured (set AUTH_JWT_SECRET)" });
    return false;
  }
  if (!supabase) {
    res.status(500).json({ error: "Supabase not configured" });
    return false;
  }
  return true;
}

app.post("/auth/register", async (req, res) => {
  if (!ensureAuthConfigured(res)) return;
  try {
    const email = String(req.body?.email || "").trim().toLowerCase();
    const password = String(req.body?.password || "");
    const name = req.body?.name ? String(req.body.name).slice(0, 120) : null;
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email) || password.length < 8) {
      return res.status(400).json({ error: "Valid email and password (min 8 chars) required" });
    }
    const { data: existing } = await supabase.from("app_users").select("id").eq("email", email).maybeSingle();
    if (existing) return res.status(409).json({ error: "Email already registered" });
    const password_hash = await bcrypt.hash(password, 10);
    const { data: user, error } = await supabase
      .from("app_users")
      .insert({ email, name, password_hash })
      .select(PUBLIC_USER)
      .single();
    if (error) throw new Error(error.message);
    issueSession(res, user);
    res.json({ user });
  } catch (e) {
    res.status(500).json({ error: String(e?.message || e) });
  }
});

app.post("/auth/login", async (req, res) => {
  if (!ensureAuthConfigured(res)) return;
  try {
    const email = String(req.body?.email || "").trim().toLowerCase();
    const password = String(req.body?.password || "");
    const { data: user } = await supabase
      .from("app_users")
      .select("id,email,name,picture,password_hash")
      .eq("email", email)
      .maybeSingle();
    if (!user || !user.password_hash || !(await bcrypt.compare(password, user.password_hash))) {
      return res.status(401).json({ error: "Invalid email or password" });
    }
    issueSession(res, user);
    res.json({ user: { id: user.id, email: user.email, name: user.name, picture: user.picture } });
  } catch (e) {
    res.status(500).json({ error: String(e?.message || e) });
  }
});

app.post("/auth/google", async (req, res) => {
  if (!ensureAuthConfigured(res)) return;
  if (!googleClient) return res.status(500).json({ error: "GOOGLE_CLIENT_ID not configured" });
  try {
    const credential = String(req.body?.credential || "");
    if (!credential) return res.status(400).json({ error: "Missing credential" });
    let payload;
    try {
      const ticket = await googleClient.verifyIdToken({ idToken: credential, audience: GOOGLE_CLIENT_ID });
      payload = ticket.getPayload();
    } catch {
      return res.status(401).json({ error: "Invalid Google token" });
    }
    const email = payload.email?.toLowerCase();
    const google_sub = payload.sub;
    const profile = { name: payload.name || null, picture: payload.picture || null };

    // Find by google_sub, else link by email, else create.
    let { data: user } = await supabase.from("app_users").select(PUBLIC_USER).eq("google_sub", google_sub).maybeSingle();
    if (!user) {
      const { data: byEmail } = await supabase.from("app_users").select("id").eq("email", email).maybeSingle();
      if (byEmail) {
        const { data: upd } = await supabase
          .from("app_users")
          .update({ google_sub, ...profile, last_seen_at: new Date().toISOString() })
          .eq("id", byEmail.id)
          .select(PUBLIC_USER)
          .single();
        user = upd;
      } else {
        const { data: ins, error } = await supabase
          .from("app_users")
          .insert({ email, google_sub, ...profile })
          .select(PUBLIC_USER)
          .single();
        if (error) throw new Error(error.message);
        user = ins;
      }
    }
    issueSession(res, user);
    res.json({ user });
  } catch (e) {
    res.status(500).json({ error: String(e?.message || e) });
  }
});

app.get("/auth/me", async (req, res) => {
  const s = readSession(req);
  if (!s || !supabase) return res.json({ user: null });
  const { data: user } = await supabase.from("app_users").select(PUBLIC_USER).eq("id", s.uid).maybeSingle();
  res.json({ user: user ?? null });
});

app.post("/auth/logout", (_req, res) => {
  res.clearCookie(COOKIE_NAME, COOKIE_OPTS);
  res.json({ ok: true });
});

// --- connections (per-user, DB-backed) -------------------------------------
app.get("/connections", requireUser, async (req, res) => {
  const { data, error } = await supabase.from("connections").select("rec_key").eq("user_id", req.uid);
  if (error) return res.status(500).json({ error: error.message });
  res.json({ keys: (data ?? []).map((r) => r.rec_key) });
});

app.post("/connections", requireUser, async (req, res) => {
  const key = String(req.body?.key || "");
  const connected = Boolean(req.body?.connected);
  if (!key) return res.status(400).json({ error: "missing key" });
  const q = connected
    ? supabase.from("connections").upsert({ user_id: req.uid, rec_key: key }, { onConflict: "user_id,rec_key" })
    : supabase.from("connections").delete().eq("user_id", req.uid).eq("rec_key", key);
  const { error } = await q;
  if (error) return res.status(500).json({ error: error.message });
  res.json({ ok: true });
});

// Bulk-merge localStorage keys into the DB on first sign-in; returns the union.
app.post("/connections/merge", requireUser, async (req, res) => {
  const keys = Array.isArray(req.body?.keys) ? req.body.keys.filter((k) => typeof k === "string" && k) : [];
  if (keys.length) {
    const rows = keys.map((k) => ({ user_id: req.uid, rec_key: k }));
    const { error } = await supabase.from("connections").upsert(rows, { onConflict: "user_id,rec_key" });
    if (error) return res.status(500).json({ error: error.message });
  }
  const { data } = await supabase.from("connections").select("rec_key").eq("user_id", req.uid);
  res.json({ keys: (data ?? []).map((r) => r.rec_key) });
});

app.listen(PORT, async () => {
  console.log(
    `gte-server :${PORT} — model ${MODEL} (${DIM}d), supabase ${supabase ? "ok" : "OFF"}, auth ${JWT_SECRET ? "ok" : "OFF"}, google ${googleClient ? "ok" : "OFF"}`,
  );
  try {
    await embed(["warmup"]);
    warm = true;
    console.log("model warm ✓ ready");
  } catch (e) {
    console.error("warmup failed:", e.message);
  }
});
