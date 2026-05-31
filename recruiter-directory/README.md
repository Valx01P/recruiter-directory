# Tech Recruiter Directory

Fast, searchable directory of US tech company recruiters (focus: university / early-career / SWE & AI interns), built to power LinkedIn outreach from the `job/recruiter.json` dataset.

## Features

- **Three-tier search**
  1. Keyword match across companies + every recruiter field (name, title, location, notes, focus).
  2. **Industry/sector synonyms** — type `defense`, `big tech`, `fintech`, `machine learning`, `ecommerce`… and it matches even when that exact word isn't in the company name or category.
  3. **Semantic "did you mean"** — when a query gets zero keyword hits, it falls back to a vector search (Supabase + pgvector) and shows the closest companies *by meaning* ("company that makes rockets" → SpaceX/Astra; "self driving cars" → Cruise/Lucid). A **Min-match slider** lets you tune how strict/loose the matches are.
- **Industry sector chips** fold 130+ raw categories into ~16 searchable industries, each with a live count.
- Priority filters (P1 = top targets), connection-status filters, "only unconnected people" toggle.
- Per-recruiter: open LinkedIn profile, one-click **Copy URL**, **Message** button; per-company **Find more recruiters** LinkedIn People search.
- **Export CSV** of every populated recruiter.
- Connection tracking saved per-browser (localStorage); dark mode; mobile responsive.

## Quick start (local)

```bash
cd recruiter-directory
npm install
cp .env.example .env.local     # then fill in your Supabase values (see below)
npm run dev                    # http://localhost:3000
```

The keyword + sector search works with **no setup**. The semantic fallback needs the one-time Supabase setup below.

## Environment variables

Config lives in `.env.local`, which is **gitignored** — your real secrets never get committed. The committed template is **`.env.example`**.

- Copy `.env.example` → `.env.local` and fill in the values from your Supabase project
  (Dashboard → Project Settings → **API** and **Database**).
- When you introduce a **new** env var, add it (with a placeholder, no secrets) to `.env.example` so the next person knows it exists.

| Variable | Used by | Notes |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | app + scripts | Project URL. Safe for the browser. |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | app (browser) | Browser-safe publishable key — used for the semantic `match_companies` RPC. |
| `SUPABASE_SECRET_KEY` | indexing scripts only | **Server/local only.** Writes embeddings (`npm run embed`). Not needed at runtime. |
| `SUPABASE_SERVICE_ROLE_KEY` | fallback for the above | Legacy service-role JWT. |
| `SUPABASE_DB_URL` | `npm run db:setup` | **Session-pooler** URI (IPv4). The direct `db.<ref>` host is IPv6-only. |
| `EMBEDDING_MODEL` / `EMBEDDING_DIM` | scripts + route | `Supabase/gte-small` / `384` (fast). Must match `vector(N)` in `supabase/schema.sql`. |

## Semantic search setup (one time)

Embeddings use **gte-small (384-dim)** via `@huggingface/transformers`, run **locally** — no embedding API key. The model auto-downloads (~30MB) and caches on first run.

1. **Create the schema.** Either:
   - Run `npm run db:setup` (applies `supabase/schema.sql` over `SUPABASE_DB_URL`), **or**
   - Paste `supabase/schema.sql` into Supabase Dashboard → **SQL Editor** and run it.
2. **Embed + upload the companies:**
   ```bash
   npm run embed
   ```
   This embeds the ~874 populated companies and upserts them into `company_embeddings` (over HTTPS, so it works even when the Postgres port doesn't).

Re-run both after the dataset changes:

```bash
npm run semantic:reindex   # = db:setup && embed
```

> **Swapping the embedding model:** set `EMBEDDING_MODEL` to another sentence-transformer. If its dimension differs, update `vector(N)` in `supabase/schema.sql` and `EMBEDDING_DIM`, then re-run `semantic:reindex` (`db:setup` auto-drops/recreates the table when the dimension changes). `Xenova/gte-base` (768-dim) gives stronger conceptual matching at the cost of speed/size. Abstract sentiment queries (e.g. "evil") are inherently fuzzy for any local model unless the embedded text carries reputation/description data.

## Keeping data in sync

The canonical dataset is `job/recruiter.json`, merged from the 8 agent partition files. From the repo root:

```bash
node job/scripts/merge-recruiter-partitions.js      # rebuilds recruiter.json + syncs both UI copies
cd recruiter-directory && npm run semantic:reindex   # refresh the vector index (optional)
```

The merge script writes `recruiter-directory/data/recruiter.json` (what the UI imports) and `public/data/recruiter.json`.

## Deployment

**Fully static / client-side** — there is no server function. The semantic fallback embeds the
query *in the browser* (Transformers.js + gte-small via WASM) and calls the Supabase
`match_companies` RPC directly with the publishable key. Deploy anywhere:

- **Vercel**: `vercel --prod`. Set `NEXT_PUBLIC_SUPABASE_URL` + `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` in the project env (those are the only vars the runtime needs; the secret key and DB URL are only for the local indexing scripts).
- Any static/Node host via `npm run build`.

> Why browser-side: `@huggingface/transformers` uses native onnxruntime, which can't load in a
> Vercel serverless function (`libonnxruntime.so` missing). Embedding in the browser (WASM)
> sidesteps that entirely. First semantic search downloads the ~30MB model to the browser
> (cached thereafter); keyword/sector search is instant and needs no network.

## Notes

- JSON schema and the 1251 companies curated by Pablo Valdes.
- Always double-check a profile is current before sending InMail; respect LinkedIn limits.
- Data freshness: see `job/recruiter.json` → `meta.last_updated`.
