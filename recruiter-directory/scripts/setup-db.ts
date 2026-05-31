import "./load-env";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import postgres from "postgres";

// Runs supabase/schema.sql against the Supabase Postgres over the direct
// connection string (SUPABASE_DB_URL). Idempotent.
const here = path.dirname(fileURLToPath(import.meta.url));
const schemaPath = path.resolve(here, "../supabase/schema.sql");

async function main() {
  const dbUrl = process.env.SUPABASE_DB_URL;
  if (!dbUrl) throw new Error("Missing SUPABASE_DB_URL in .env.local");

  const schema = fs.readFileSync(schemaPath, "utf8");
  const wantDim = Number(process.env.EMBEDDING_DIM) || 384;
  console.log("Connecting to Supabase Postgres…");
  const sql = postgres(dbUrl, { max: 1, idle_timeout: 5, connect_timeout: 15 });

  try {
    // `create table if not exists` can't change an existing column's vector
    // dimension, so if the embedding dim changed (e.g. model swap 384→768),
    // drop the table first and let the schema recreate it at the new size.
    const existing = await sql`
      select format_type(a.atttypid, a.atttypmod) as t
      from pg_attribute a
      where a.attrelid = to_regclass('public.company_embeddings') and a.attname = 'embedding'`;
    const curDim = existing.length ? Number(existing[0].t.match(/\((\d+)\)/)?.[1]) : null;
    if (curDim && curDim !== wantDim) {
      console.log(`Embedding dimension changed ${curDim} → ${wantDim}; dropping table to recreate.`);
      await sql.unsafe("drop table if exists public.company_embeddings cascade");
    }

    // simple protocol (no params) runs the whole multi-statement file, including
    // the $$-quoted function body.
    await sql.unsafe(schema);
    console.log("✓ Schema applied (extension, table, HNSW index, match_companies RPC, RLS).");
  } finally {
    await sql.end({ timeout: 5 });
  }
}

main().catch((err) => {
  console.error("\n✗ Could not apply schema over the direct connection.");
  console.error(`  ${err.message || err}`);
  console.error(
    "\nFallback: open Supabase Dashboard → SQL Editor and paste the contents of\n" +
      "  recruiter-directory/supabase/schema.sql\n" +
      "then run `npm run embed` to populate the vectors. (Direct :5432 connections\n" +
      "require IPv6 or the IPv4 add-on; the SQL Editor always works.)",
  );
  process.exit(1);
});
