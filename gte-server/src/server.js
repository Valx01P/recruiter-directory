import "dotenv/config";
import express from "express";
import cors from "cors";
import { pipeline, env as hfEnv } from "@huggingface/transformers";
import { createClient } from "@supabase/supabase-js";

// --- config ----------------------------------------------------------------
const PORT = Number(process.env.PORT) || 8787;
const MODEL = process.env.EMBEDDING_MODEL || "Xenova/gte-base"; // 768-dim
const DIM = Number(process.env.EMBEDDING_DIM) || 768;
const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

hfEnv.allowLocalModels = false; // always fetch the model from the HF hub/cache

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
  return out.tolist(); // number[][]
}

// --- supabase (optional; only needed for /search) --------------------------
const supabase =
  SUPABASE_URL && SUPABASE_KEY
    ? createClient(SUPABASE_URL, SUPABASE_KEY, { auth: { persistSession: false, autoRefreshToken: false } })
    : null;

// --- app --------------------------------------------------------------------
const app = express();
const origins = process.env.ALLOWED_ORIGINS;
app.use(cors(origins && origins !== "*" ? { origin: origins.split(",").map((s) => s.trim()) } : {}));
app.use(express.json({ limit: "4mb" }));

app.get("/health", (_req, res) => res.json({ ok: true, model: MODEL, dim: DIM, warm }));

// Embed raw text(s). Used by the offline indexing script.
//   POST { texts: string[] }  ->  { model, dim, embeddings: number[][] }
//   POST { text: string }     ->  same, single-element array
app.post("/embed", async (req, res) => {
  try {
    const texts = Array.isArray(req.body?.texts)
      ? req.body.texts
      : typeof req.body?.text === "string"
        ? [req.body.text]
        : null;
    if (!texts || texts.length === 0) {
      return res.status(400).json({ error: "Provide { texts: string[] } or { text: string }" });
    }
    const embeddings = await embed(texts);
    res.json({ model: MODEL, dim: embeddings[0]?.length ?? DIM, embeddings });
  } catch (e) {
    res.status(500).json({ error: String(e?.message || e) });
  }
});

// Full semantic search: embed the query and return nearest companies.
//   POST { q: string, limit?: number, threshold?: number } -> { query, matches }
app.post("/search", async (req, res) => {
  try {
    if (!supabase) return res.status(500).json({ error: "Supabase not configured (set SUPABASE_URL + SUPABASE_SECRET_KEY)" });
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

app.listen(PORT, async () => {
  console.log(`gte-server listening on :${PORT} — model ${MODEL} (${DIM}d), supabase ${supabase ? "configured" : "NOT configured"}`);
  try {
    await embed(["warmup"]);
    warm = true;
    console.log("model warm ✓ ready");
  } catch (e) {
    console.error("warmup failed:", e.message);
  }
});
