import { supabase } from './supabaseClient';

type JsonObject = Record<string, unknown>;

function digits(value: string) {
  return (value || '').replace(/\D/g, '');
}

export async function buscarCNAE(codigo: string) {
  const key = digits(codigo);
  const { data, error } = await supabase.from('cnae').select('*').eq('codigo', key).maybeSingle();
  if (error) throw error;
  return data;
}

export async function buscarNCM(codigo: string) {
  const key = digits(codigo);
  const { data, error } = await supabase.from('ncm').select('*').eq('codigo', key).maybeSingle();
  if (error) throw error;
  return data;
}

export async function buscarCEST(codigo: string) {
  const key = digits(codigo);
  const { data, error } = await supabase.from('cest').select('*').eq('ncm_codigo', key);
  if (error) throw error;
  return data ?? [];
}

export async function buscarTributacaoNCM(ncmCodigo: string) {
  const { data, error } = await supabase
    .from('ncm_tributos')
    .select('*')
    .eq('ncm_codigo', digits(ncmCodigo))
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function buscarSimplesNacional(cnaeCodigo: string) {
  const { data, error } = await supabase
    .from('simples_nacional')
    .select('*')
    .eq('cnae_codigo', digits(cnaeCodigo));
  if (error) throw error;
  return data ?? [];
}

export async function buscarPorKeyword(termo: string) {
  const keyword = (termo || '').trim().toLowerCase();
  if (!keyword) return [];

  const { data, error } = await supabase
    .from('fiscal_keywords')
    .select('*')
    .ilike('keyword', `%${keyword}%`)
    .limit(30);

  if (error) throw error;
  return data ?? [];
}

export async function buscarNCMporCNAE(cnae: string) {
  const cnaeCodigo = digits(cnae);
  if (!cnaeCodigo) return [];

  const { data: relacoes, error } = await supabase
    .from('cnae_ncm_relacao')
    .select('*')
    .eq('cnae_codigo', cnaeCodigo)
    .order('confianca', { ascending: false });

  if (error) throw error;
  if (!relacoes?.length) return [];

  const ncmCodigos = relacoes.map((r: JsonObject) => String(r.ncm_codigo));
  const { data: ncms, error: ncmError } = await supabase.from('ncm').select('*').in('codigo', ncmCodigos);
  if (ncmError) throw ncmError;

  return ncms ?? [];
}

export async function buscarCESTporNCM(ncm: string) {
  const ncmCodigo = digits(ncm);
  if (!ncmCodigo) return [];

  const { data: relacoes, error } = await supabase
    .from('ncm_cest_relacao')
    .select('*')
    .eq('ncm_codigo', ncmCodigo);

  if (error) throw error;

  if (!relacoes?.length) {
    return buscarCEST(ncmCodigo);
  }

  const cestCodigos = relacoes.map((r: JsonObject) => String(r.cest_codigo));
  const { data: cests, error: cestError } = await supabase.from('cest').select('*').in('cest', cestCodigos);
  if (cestError) throw cestError;

  return cests ?? [];
}

function extrairNcmDoCnae(cnaeRow: JsonObject | null): string | null {
  if (!cnaeRow) return null;
  const raw = (cnaeRow.ncm_codigo || cnaeRow.ncm || cnaeRow.codigo_ncm || '') as string;
  const d = digits(raw);
  return d.length === 8 ? d : null;
}

export async function buscarFiscalAvancado(params: { cnaeCodigo?: string; ncmCodigo?: string }) {
  const cnaeCodigo = params.cnaeCodigo ? digits(params.cnaeCodigo) : null;
  const ncmCodigoParam = params.ncmCodigo ? digits(params.ncmCodigo) : null;

  const cnae = cnaeCodigo ? await buscarCNAE(cnaeCodigo) : null;
  const ncmRelacionados = cnaeCodigo ? await buscarNCMporCNAE(cnaeCodigo) : [];
  const ncmCodigo = ncmCodigoParam || (ncmRelacionados[0]?.codigo as string) || extrairNcmDoCnae((cnae as JsonObject) || null);

  const [ncm, cest, tributacao, simplesNacional] = await Promise.all([
    ncmCodigo ? buscarNCM(ncmCodigo) : Promise.resolve(null),
    ncmCodigo ? buscarCESTporNCM(ncmCodigo) : Promise.resolve([]),
    ncmCodigo ? buscarTributacaoNCM(ncmCodigo) : Promise.resolve(null),
    cnaeCodigo ? buscarSimplesNacional(cnaeCodigo) : Promise.resolve([]),
  ]);

  return {
    cnae,
    ncm,
    ncm_relacionados: ncmRelacionados,
    cest,
    tributacao,
    simples_nacional: simplesNacional,
  };
}
