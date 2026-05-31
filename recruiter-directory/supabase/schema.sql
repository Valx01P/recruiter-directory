create extension if not exists vector;

create table if not exists public.company_embeddings (
  id text primary key,
  name text not null,
  category text not null,
  priority smallint,
  recruiter_count integer default 0,
  content text not null,
  embedding vector(384) not null,
  updated_at timestamptz not null default now()
);

create index if not exists company_embeddings_embedding_hnsw
  on public.company_embeddings
  using hnsw (embedding vector_cosine_ops);

create or replace function public.match_companies (
  query_embedding vector(384),
  match_threshold float default 0.0,
  match_count int default 8
)
returns table (
  id text,
  name text,
  category text,
  priority smallint,
  recruiter_count integer,
  similarity float
)
language sql
stable
as $$
  select
    ce.id,
    ce.name,
    ce.category,
    ce.priority,
    ce.recruiter_count,
    1 - (ce.embedding <=> query_embedding) as similarity
  from public.company_embeddings ce
  where 1 - (ce.embedding <=> query_embedding) >= match_threshold
  order by ce.embedding <=> query_embedding
  limit least(match_count, 100);
$$;

alter table public.company_embeddings enable row level security;

drop policy if exists "public read company_embeddings" on public.company_embeddings;
create policy "public read company_embeddings"
  on public.company_embeddings
  for select
  to anon, authenticated
  using (true);
