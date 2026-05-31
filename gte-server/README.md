# gte-server

Backend for the recruiter directory: an always-on embedding service (**gte-small, 384-dim**,
loaded once and kept warm via `@huggingface/transformers`) **plus auth + per-user data**.

### Embedding / search
| Method | Route | Body | Returns |
|---|---|---|---|
| GET | `/health` | — | `{ ok, model, dim, warm, auth, google }` |
| POST | `/embed` | `{ texts }` or `{ text }` | `{ model, dim, embeddings }` |
| POST | `/search` | `{ q, limit?, threshold? }` | `{ query, matches: [{ id, name, category, … , similarity }] }` |

### Auth (JWT in an HttpOnly cookie) + per-user connections
| Method | Route | Body | Notes |
|---|---|---|---|
| POST | `/auth/register` | `{ email, password, name? }` | email+password; bcrypt; sets session cookie |
| POST | `/auth/login` | `{ email, password }` | sets session cookie |
| POST | `/auth/google` | `{ credential }` | verifies Google ID token; upserts user; sets cookie |
| GET | `/auth/me` | — | `{ user }` from cookie (or null) |
| POST | `/auth/logout` | — | clears cookie |
| GET | `/connections` | — *(cookie)* | `{ keys }` for the signed-in user |
| POST | `/connections` | `{ key, connected }` *(cookie)* | mark/unmark one |
| POST | `/connections/merge` | `{ keys }` *(cookie)* | bulk-upsert (localStorage→DB on first sign-in); returns union |

`/search` and `/embed` use the Supabase **service key** (never leaves the server). Auth issues a
JWT signed with `AUTH_JWT_SECRET`, stored in an **HttpOnly `session` cookie** (`SameSite=None;
Secure` in prod). Users/connections live in the `app_users` / `connections` tables (RLS locked;
only the service key touches them).

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
- Env vars: `EMBEDDING_MODEL=Supabase/gte-small`, `EMBEDDING_DIM=384`,
  `ALLOWED_ORIGINS=https://recruiter-directory.vercel.app`, `SUPABASE_URL`, `SUPABASE_SECRET_KEY`,
  `AUTH_JWT_SECRET` (long random), and `GOOGLE_CLIENT_ID` (when ready).
  (Don't set `PORT` — Render injects it. Don't set `COOKIE_SECURE`/`COOKIE_SAMESITE` in prod — the
  secure/`none` defaults are correct; those overrides are for local http dev only.)

Then point the frontend's `NEXT_PUBLIC_GTE_SERVER_URL` (in Vercel) at the resulting
`https://<service>.onrender.com`.

> **⚠ Cross-site cookies:** the session cookie is set by `*.onrender.com` while the app runs on
> `*.vercel.app` — different sites, so it's a **third-party cookie**. Chrome currently allows it
> (`SameSite=None; Secure`), but **Safari blocks third-party cookies**, so sign-in won't persist
> there. The robust fix is to put frontend + api on a **shared parent domain** (e.g.
> `app.example.com` + `api.example.com`) and set `COOKIE_DOMAIN=.example.com` — then it's a
> first-party cookie everywhere.

> **Plan:** gte-small + onnxruntime is light and fits small instances, but free instances still
> spin down when idle (cold model reload on the next request → the frontend briefly shows its
> "semantic search offline" hint). Use a paid plan for genuinely "always on". Keep
> `EMBEDDING_MODEL`/`EMBEDDING_DIM` in sync with `vector(N)` in
> `recruiter-directory/supabase/schema.sql`; changing the model means re-running the index.
> (Bump both to `Xenova/gte-base` / `768` for stronger conceptual matching if you have the RAM.)

— host elsewhere (Railway/Fly/VM) the same way: persistent Node process, set the same env vars.
