# gte-server

Always-on embedding microservice for the recruiter directory. Loads **gte-small (384-dim)**
once via `@huggingface/transformers`, keeps it warm, and exposes:

| Method | Route | Body | Returns |
|---|---|---|---|
| GET | `/health` | — | `{ ok, model, dim, warm }` |
| POST | `/embed` | `{ texts: string[] }` or `{ text }` | `{ model, dim, embeddings: number[][] }` |
| POST | `/search` | `{ q, limit?, threshold? }` | `{ query, matches: [{ id, name, category, priority, recruiter_count, similarity }] }` |

`/search` embeds the query (gte-small) and runs the Supabase `match_companies` pgvector RPC server-side
(the Supabase secret key never leaves the server). `/embed` is used by the recruiter-directory
indexing script so the index and queries share one model.

## Run

```bash
cd gte-server
npm install
cp .env.example .env     # fill SUPABASE_URL + SUPABASE_SECRET_KEY
npm run dev              # or: npm start  → http://localhost:8787
```

The model downloads once on first boot and is warmed automatically (a "model warm ✓" log).

## Deploy on Render (always-on)

A blueprint lives at the repo root (`../render.yaml`). Either:

**Blueprint (one click):** Render Dashboard → New → Blueprint → pick this repo. It creates the
service with `rootDir: gte-server`, build `npm install`, start `npm start`, health check
`/health`. Then set the two secrets it leaves blank: `SUPABASE_URL` and `SUPABASE_SECRET_KEY`.

**Manual:** New → Web Service → this repo, then:
- Root Directory: `gte-server`
- Build: `npm install` · Start: `npm start` · Health Check Path: `/health`
- Env vars: `EMBEDDING_MODEL=Xenova/gte-base`, `EMBEDDING_DIM=768`,
  `ALLOWED_ORIGINS=https://recruiter-directory.vercel.app`, `SUPABASE_URL`, `SUPABASE_SECRET_KEY`.
  (Don't set `PORT` — Render injects it.)

Then point the frontend's `NEXT_PUBLIC_GTE_SERVER_URL` (in Vercel) at the resulting
`https://<service>.onrender.com`.

> **Plan:** gte-small + onnxruntime is light and fits small instances, but free instances still
> spin down when idle (cold model reload on the next request → the frontend briefly shows its
> "semantic search offline" hint). Use a paid plan for genuinely "always on". Keep
> `EMBEDDING_MODEL`/`EMBEDDING_DIM` in sync with `vector(N)` in
> `recruiter-directory/supabase/schema.sql`; changing the model means re-running the index.
> (Bump both to `Xenova/gte-base` / `768` for stronger conceptual matching if you have the RAM.)

— host elsewhere (Railway/Fly/VM) the same way: persistent Node process, set the same env vars.
