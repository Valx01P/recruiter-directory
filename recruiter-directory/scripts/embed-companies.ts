import "./load-env";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { embed, toPgVector } from "../lib/embed";
import { companyToText } from "../lib/sectors";
import { createAdminClient } from "../lib/supabase";
import type { JsonData, Company } from "../lib/types";

// Reads data/recruiter.json, builds an industry/profile text per *populated*
// company, embeds it with gte-small, and upserts the vectors into Supabase.
// Re-run any time the dataset changes (e.g. after a partition merge).
const here = path.dirname(fileURLToPath(import.meta.url));
const dataPath = path.resolve(here, "../data/recruiter.json");

const EMBED_BATCH = 64;   // texts per model forward pass
const UPSERT_BATCH = 250; // rows per Supabase write

async function main() {
  const data = JSON.parse(fs.readFileSync(dataPath, "utf8")) as JsonData;
  const companies: Company[] = data.companies.filter((c) => (c.recruiters?.length || 0) > 0);
  const modelName = process.env.EMBEDDING_MODEL || "Supabase/gte-small";
  console.log(`Embedding ${companies.length} populated companies with ${modelName} (${process.env.EMBEDDING_DIM || 384}d)…`);

  const supabase = createAdminClient();
  const texts = companies.map(companyToText);

  // Embed in batches to bound memory.
  const vectors: number[][] = [];
  for (let i = 0; i < texts.length; i += EMBED_BATCH) {
    const batch = texts.slice(i, i + EMBED_BATCH);
    vectors.push(...(await embed(batch)));
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
  console.error("  Make sure `npm run db:setup` (or the SQL Editor) created the schema first.");
  process.exit(1);
});
