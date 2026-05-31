import { NextResponse } from "next/server";
import { embedOne, toPgVector } from "../../../lib/embed";
import { createAdminClient } from "../../../lib/supabase";

// Node runtime: @huggingface/transformers needs Node APIs (auto-externalized by Next).
export const runtime = "nodejs";
// Don't try to statically prerender; this is a live query endpoint.
export const dynamic = "force-dynamic";

type Match = {
  id: string;
  name: string;
  category: string;
  priority: number | null;
  recruiter_count: number | null;
  similarity: number;
};

// GET /api/semantic-search?q=...&limit=8&threshold=0.3
// Embeds the query with gte-small and returns nearest companies by cosine sim.
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const q = (searchParams.get("q") || "").trim();
  // Fetch a generous ranked set; the UI filters it client-side with the slider.
  const limit = Math.min(Math.max(Number(searchParams.get("limit")) || 50, 1), 100);
  const threshold = Number(searchParams.get("threshold"));

  if (q.length < 2) return NextResponse.json({ query: q, matches: [] });

  try {
    const vector = await embedOne(q);
    const supabase = createAdminClient();
    const { data, error } = await supabase.rpc("match_companies", {
      query_embedding: toPgVector(vector),
      match_threshold: Number.isFinite(threshold) ? threshold : 0.3,
      match_count: limit,
    });
    if (error) throw new Error(error.message);

    const matches = (data as Match[]) ?? [];
    return NextResponse.json(
      { query: q, matches },
      { headers: { "Cache-Control": "private, max-age=60" } },
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "semantic search failed";
    // Soft-fail: the UI treats an error like "no suggestions" rather than breaking.
    return NextResponse.json({ query: q, matches: [], error: message }, { status: 200 });
  }
}
