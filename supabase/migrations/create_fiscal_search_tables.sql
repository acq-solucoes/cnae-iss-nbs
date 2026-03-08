-- Estrutura complementar para busca fiscal inteligente
-- Não altera tabelas existentes do domínio fiscal principal.

create table if not exists public.fiscal_keywords (
  id bigint primary key generated always as identity,
  keyword text not null,
  tipo text not null,
  codigo text not null,
  created_at timestamptz default now()
);

create table if not exists public.cnae_ncm_relacao (
  id bigint primary key generated always as identity,
  cnae_codigo text not null,
  ncm_codigo text not null,
  confianca integer default 50,
  created_at timestamptz default now()
);

create table if not exists public.ncm_cest_relacao (
  id bigint primary key generated always as identity,
  ncm_codigo text not null,
  cest_codigo text not null,
  created_at timestamptz default now()
);

create index if not exists idx_keywords_keyword on public.fiscal_keywords(keyword);
create index if not exists idx_cnae_codigo on public.cnae_ncm_relacao(cnae_codigo);
create index if not exists idx_ncm_codigo on public.cnae_ncm_relacao(ncm_codigo);
create index if not exists idx_ncm_cest on public.ncm_cest_relacao(ncm_codigo);
