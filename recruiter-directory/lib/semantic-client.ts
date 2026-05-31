// Thin client for the always-on gte-server. The model + Supabase query now live
// on the server (gte-server/), so the browser just POSTs the query text and gets
// back the nearest companies. No model download, no Supabase client in the browser.

// Only fall back to localhost in dev. In production an UNSET env must NOT default
// to localhost — a deployed site fetching http://localhost:8787 makes the browser
// pop a scary "wants to access devices on your local network" permission prompt
// (and points at the visitor's own machine). With no configured server we throw,
// so the UI shows its graceful "semantic search offline" hint instead.
const BASE =
  process.env.NEXT_PUBLIC_GTE_SERVER_URL ||
  (process.env.NODE_ENV === "development" ? "http://localhost:8787" : "");

export type SemanticMatch = { id: string; similarity: number };

/**
 * Ask gte-server for the companies nearest to `query` (id + cosine similarity),
 * ranked, up to `limit`. Returns the full ranked set (threshold 0) so the UI
 * slider can filter locally. Throws on a non-OK response; the caller soft-fails.
 */
export async function semanticSearch(query: string, limit = 100): Promise<SemanticMatch[]> {
  const q = query.trim();
  if (q.length < 2) return [];
  if (!BASE) throw new Error("NEXT_PUBLIC_GTE_SERVER_URL is not set");

  const res = await fetch(`${BASE}/search`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ q, limit, threshold: 0 }),
  });
  if (!res.ok) throw new Error(`gte-server ${res.status}`);

  const data = (await res.json()) as { matches?: SemanticMatch[] };
  return (data.matches ?? []).map((m) => ({ id: m.id, similarity: m.similarity }));
}
