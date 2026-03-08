-- Extensão segura de estrutura fiscal (sem recriar tabelas existentes)

alter table if exists public.ncm_tributos
  add column if not exists pis_importacao text,
  add column if not exists cofins_importacao text,
  add column if not exists cest text,
  add column if not exists origem_dados text;

create table if not exists public.search_logs (
  id bigint primary key generated always as identity,
  search_term text not null,
  search_type text not null,
  timestamp timestamptz default now()
);

create index if not exists idx_search_logs_term on public.search_logs(search_term);
create index if not exists idx_search_logs_timestamp on public.search_logs(timestamp desc);
