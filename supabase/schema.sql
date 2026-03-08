create table if not exists public.ncm (
  codigo text primary key,
  descricao text,
  capitulo text,
  posicao text,
  subposicao text,
  unidade text
);

create table if not exists public.ncm_tributos (
  ncm_codigo text references public.ncm(codigo) on delete cascade,
  ii text,
  ipi text,
  pis text,
  cofins text,
  pis_importacao text,
  cofins_importacao text,
  cest text,
  origem_dados text,
  primary key (ncm_codigo)
);

create table if not exists public.cest (
  cest text,
  descricao text,
  segmento text,
  ncm_codigo text references public.ncm(codigo) on delete cascade,
  base_legal text,
  primary key (cest, ncm_codigo)
);

create table if not exists public.cnae (
  codigo text primary key,
  descricao text,
  secao text,
  divisao text,
  grupo text,
  classe text,
  subclasse text
);

create table if not exists public.simples_nacional (
  cnae_codigo text references public.cnae(codigo) on delete cascade,
  anexo text,
  aliquota_inicial text
);

create index if not exists idx_ncm_descricao on public.ncm using gin (to_tsvector('portuguese', coalesce(descricao,'')));
create index if not exists idx_cnae_descricao on public.cnae using gin (to_tsvector('portuguese', coalesce(descricao,'')));


create table if not exists public.search_logs (
  id bigint primary key generated always as identity,
  search_term text not null,
  search_type text not null,
  timestamp timestamptz default now()
);

create index if not exists idx_search_logs_term on public.search_logs(search_term);
create index if not exists idx_search_logs_timestamp on public.search_logs(timestamp desc);
