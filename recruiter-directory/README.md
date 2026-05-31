# Tech Recruiter Directory

Fast, searchable directory of US tech company recruiters (focus: university / early-career / SWE & AI interns), built to power LinkedIn outreach from the `job/recruiter.json` dataset.

## Features

- **Three-tier search**
  1. Keyword match across companies + every recruiter field (name, title, location, notes, focus).
  2. **Industry/sector synonyms** — type `defense`, `big tech`, `fintech`, `machine learning`, `ecommerce`… and it matches even when that exact word isn't in the company name or category.
  3. **Semantic "did you mean"** — when a query gets zero keyword hits, the browser calls the **gte-server** service (see `../gte-server`), which embeds the query (gte-small, 384-dim) and runs a Supabase pgvector search, returning the closest companies *by meaning* ("company that makes rockets" → SpaceX/Astra; "self driving cars" → Cruise/Lucid). A **Min-match slider** lets you tune how strict/loose the matches are.
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

The keyword + sector search works with **no setup**. The semantic fallback needs the Supabase index + the running **gte-server** (see below and `../gte-server`).

## Environment variables

Config lives in `.env.local`, which is **gitignored** — your real secrets never get committed. The committed template is **`.env.example`**.

- Copy `.env.example` → `.env.local` and fill in the values from your Supabase project
  (Dashboard → Project Settings → **API** and **Database**).
- When you introduce a **new** env var, add it (with a placeholder, no secrets) to `.env.example` so the next person knows it exists.

| Variable | Used by | Notes |
|---|---|---|
| `NEXT_PUBLIC_GTE_SERVER_URL` | app (browser) + indexing script | URL of the gte-server service. The **only** var the deployed frontend needs at runtime. |
| `NEXT_PUBLIC_SUPABASE_URL` | indexing scripts | Project URL. |
| `SUPABASE_SECRET_KEY` | indexing scripts | **Local only.** Upserts embeddings (`npm run embed`). (gte-server has its own copy for `/search`.) |
| `SUPABASE_SERVICE_ROLE_KEY` | fallback for the above | Legacy service-role JWT. |
| `SUPABASE_DB_URL` | `npm run db:setup` | **Session-pooler** URI (IPv4). The direct `db.<ref>` host is IPv6-only. |
| `EMBEDDING_DIM` | `npm run db:setup` | pgvector column size; must match the gte-server model (gte-small = `384`). |

> The Supabase publishable/anon key is no longer needed by the frontend — the browser talks only to gte-server now, and gte-server holds the Supabase secret key server-side.

## Semantic search setup (one time)

Embedding now lives in the **gte-server** service (gte-small, 384-dim) — see `../gte-server/README.md`. Start it first (`cd ../gte-server && npm install && npm run dev`), then:

1. **Create the schema.** Either:
   - Run `npm run db:setup` (applies `supabase/schema.sql` over `SUPABASE_DB_URL`), **or**
   - Paste `supabase/schema.sql` into Supabase Dashboard → **SQL Editor** and run it.
2. **Embed + upload the companies** (calls gte-server `/embed`, upserts to Supabase):
   ```bash
   npm run embed
   ```

Re-run after the dataset changes (gte-server must be running):

```bash
npm run semantic:reindex   # = db:setup && embed
```

> **Swapping the model:** change `EMBEDDING_MODEL`/`EMBEDDING_DIM` in `../gte-server/.env` and `EMBEDDING_DIM` here, then re-run `semantic:reindex` (`db:setup` auto-drops/recreates the table when the dimension changes). Abstract sentiment queries (e.g. "evil") stay fuzzy for any model unless the embedded text carries reputation/description data.

## Keeping data in sync

The canonical dataset is `job/recruiter.json`, merged from the 8 agent partition files. From the repo root:

```bash
node job/scripts/merge-recruiter-partitions.js      # rebuilds recruiter.json + syncs both UI copies
cd recruiter-directory && npm run semantic:reindex   # refresh the vector index (optional)
```

The merge script writes `recruiter-directory/data/recruiter.json` (what the UI imports) and `public/data/recruiter.json`.

## Deployment

Two pieces:

1. **This frontend** — fully static. Deploy to Vercel (`vercel --prod`) or any static host. The
   only runtime env var it needs is `NEXT_PUBLIC_GTE_SERVER_URL` pointing at your deployed
   gte-server. Keyword/sector search is instant and offline; only the semantic fallback calls
   the server.
2. **gte-server** — an always-on Node process (model + Supabase query). Host it somewhere that
   keeps a persistent process (Render/Railway/Fly/VM), **not** a serverless platform. See
   `../gte-server/README.md`. Set its `ALLOWED_ORIGINS` to this frontend's origin.

> Why a separate server: `@huggingface/transformers` uses native onnxruntime, which can't load
> in a Vercel serverless function (`libonnxruntime.so` missing), and a warm always-on process
> answers in ~0.2s vs multi-second cold model loads in the browser.

## Notes

- JSON schema and the 1251 companies curated by Pablo Valdes.
- Always double-check a profile is current before sending InMail; respect LinkedIn limits.
- Data freshness: see `job/recruiter.json` → `meta.last_updated`.
