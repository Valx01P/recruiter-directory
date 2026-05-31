"use client";

import { createSupabaseBrowserClient } from "./supabase-browser";

// Browser-side semantic search. Embeds the query in the browser with
// Transformers.js (gte-small, WASM — no server, no native onnxruntime) and
// calls the Supabase `match_companies` RPC directly with the publishable key.
// This whole module (incl. the ~30MB model lib) is loaded lazily via dynamic
// import from page.tsx, so it never touches the main bundle or first paint.

let embedderPromise: Promise<(text: string, opts: object) => Promise<{ data: Float32Array }>> | null = null;

async function getEmbedder() {
  if (!embedderPromise) {
    embedderPromise = (async () => {
      const { pipeline, env } = await import("@huggingface/transformers");
      // Always fetch the model from the HF hub/CDN (no local files in browser).
      env.allowLocalModels = false;
      return pipeline("feature-extraction", "Supabase/gte-small") as unknown as (
        text: string,
        opts: object,
      ) => Promise<{ data: Float32Array }>;
    })();
  }
  return embedderPromise;
}

let client: ReturnType<typeof createSupabaseBrowserClient> | null = null;
function supabase() {
  return (client ??= createSupabaseBrowserClient());
}

export type SemanticMatch = { id: string; similarity: number };

/**
 * Embed `query` and return the nearest companies (id + cosine similarity),
 * ranked, up to `limit`. Returns the full ranked set at threshold 0 so the UI
 * slider can filter locally. Throws on RPC error; caller soft-fails.
 */
export async function semanticSearch(query: string, limit = 100): Promise<SemanticMatch[]> {
  const q = query.trim();
  if (q.length < 2) return [];

  const embedder = await getEmbedder();
  const out = await embedder(q, { pooling: "mean", normalize: true });
  const vector = Array.from(out.data);

  const { data, error } = await supabase().rpc("match_companies", {
    query_embedding: `[${vector.join(",")}]`,
    match_threshold: 0,
    match_count: limit,
  });
  if (error) throw new Error(error.message);

  return ((data as SemanticMatch[]) ?? []).map((m) => ({ id: m.id, similarity: m.similarity }));
}
