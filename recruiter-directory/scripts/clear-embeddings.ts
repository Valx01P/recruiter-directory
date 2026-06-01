import "./load-env";
import postgres from "postgres";

async function main() {
  const dbUrl = process.env.SUPABASE_DB_URL;
  if (!dbUrl) throw new Error("Missing SUPABASE_DB_URL in .env.local");

  console.log("Clearing existing company_embeddings rows...");
  const sql = postgres(dbUrl, { max: 1, idle_timeout: 5, connect_timeout: 15 });
  try {
    await sql.unsafe("truncate table public.company_embeddings");
    console.log("✓ Cleared company_embeddings.");
  } finally {
    await sql.end({ timeout: 5 });
  }
}

main().catch((err) => {
  console.error("\n✗ Could not clear company_embeddings.");
  console.error(`  ${err.message || err}`);
  console.error(
    "\nFallback: open Supabase Dashboard → SQL Editor and run:\n" +
      "  recruiter-directory/supabase/reset-company-embeddings.sql\n" +
      "then run `npm run embed` to repopulate the vectors.",
  );
  process.exit(1);
});
