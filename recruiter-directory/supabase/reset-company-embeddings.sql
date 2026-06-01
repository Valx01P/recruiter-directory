-- Optional manual reset before re-embedding.
-- Run this in Supabase SQL Editor if `npm run clear:embeddings` cannot connect
-- through SUPABASE_DB_URL.

truncate table public.company_embeddings;
