import "./load-env";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { companyToText } from "../lib/sectors";
import { createAdminClient } from "../lib/supabase";
import type { JsonData, Company } from "../lib/types";

// Reads data/recruiter.json, builds an industry/profile text per *populated*
// company, embeds it via gte-server's /embed endpoint (so the index and the
// live query path share one model), and upserts the vectors into Supabase.
// Re-run any time the dataset changes (e.g. after a partition merge).
const here = path.dirname(fileURLToPath(import.meta.url));
const dataPath = path.resolve(here, "../data/recruiter.json");
const GTE_SERVER = process.env.NEXT_PUBLIC_GTE_SERVER_URL || process.env.GTE_SERVER_URL || "http://localhost:8787";

const EMBED_BATCH = 64;   // texts per /embed request
const UPSERT_BATCH = 250; // rows per Supabase write

const toPgVector = (v: number[]) => `[${v.join(",")}]`;

async function embedViaServer(texts: string[]): Promise<number[][]> {
  const res = await fetch(`${GTE_SERVER}/embed`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ texts }),
  });
  if (!res.ok) throw new Error(`gte-server /embed ${res.status}: ${await res.text()}`);
  const data = (await res.json()) as { embeddings: number[][] };
  return data.embeddings;
}

async function main() {
  const data = JSON.parse(fs.readFileSync(dataPath, "utf8")) as JsonData;
  const companies: Company[] = data.companies.filter((c) => (c.recruiters?.length || 0) > 0);
  console.log(`Embedding ${companies.length} populated companies via ${GTE_SERVER}/embed …`);

  const supabase = createAdminClient();
  const texts = companies.map(companyToText);

  // Embed in batches via the server.
  const vectors: number[][] = [];
  for (let i = 0; i < texts.length; i += EMBED_BATCH) {
    const batch = texts.slice(i, i + EMBED_BATCH);
    vectors.push(...(await embedViaServer(batch)));
    process.stdout.write(`\r  embedded ${Math.min(i + EMBED_BATCH, texts.length)}/${texts.length}`);
  }
  process.stdout.write("\n");

  const rows = companies.map((c, i) => ({
    id: c.id,
    name: c.name,
    category: c.category,
    priority: c.priority,
    recruiter_count: c.recruiters.length,
    content: texts[i],
    embedding: toPgVector(vectors[i]),
  }));

  // Upsert in batches.
  for (let i = 0; i < rows.length; i += UPSERT_BATCH) {
    const batch = rows.slice(i, i + UPSERT_BATCH);
    const { error } = await supabase.from("company_embeddings").upsert(batch, { onConflict: "id" });
    if (error) throw new Error(`Upsert failed at row ${i}: ${error.message}`);
    process.stdout.write(`\r  upserted ${Math.min(i + UPSERT_BATCH, rows.length)}/${rows.length}`);
  }
  process.stdout.write("\n");

  const { count } = await supabase
    .from("company_embeddings")
    .select("*", { count: "exact", head: true });
  console.log(`✓ Done. company_embeddings now holds ${count ?? "?"} rows.`);
}

main().catch((err) => {
  console.error("\n✗ Embedding failed:", err.message || err);
  console.error("  Make sure gte-server is running (npm run dev in gte-server/) and the schema");
  console.error("  exists (`npm run db:setup` or the SQL Editor).");
  process.exit(1);
});
