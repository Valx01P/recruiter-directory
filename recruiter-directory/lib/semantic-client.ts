// Thin client for the always-on gte-server. The model + Supabase query now live
// on the server (gte-server/), so the browser just POSTs the query text and gets
// back the nearest companies. No model download, no Supabase client in the browser.

const BASE = process.env.NEXT_PUBLIC_GTE_SERVER_URL || "http://localhost:8787";

export type SemanticMatch = { id: string; similarity: number };

/**
 * Ask gte-server for the companies nearest to `query` (id + cosine similarity),
 * ranked, up to `limit`. Returns the full ranked set (threshold 0) so the UI
 * slider can filter locally. Throws on a non-OK response; the caller soft-fails.
 */
export async function semanticSearch(query: string, limit = 100): Promise<SemanticMatch[]> {
  const q = query.trim();
  if (q.length < 2) return [];

  const res = await fetch(`${BASE}/search`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ q, limit, threshold: 0 }),
  });
  if (!res.ok) throw new Error(`gte-server ${res.status}`);

  const data = (await res.json()) as { matches?: SemanticMatch[] };
  return (data.matches ?? []).map((m) => ({ id: m.id, similarity: m.similarity }));
}
