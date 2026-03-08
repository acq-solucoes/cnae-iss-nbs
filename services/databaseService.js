import { supabase } from './supabaseClient.js';
import { onlyDigits } from '../utils/validators.js';
import { searchNcmByCode } from './ncmService.js';

const TTL_MS = 1000 * 60 * 30;

function getCache(key) {
  try {
    const v = JSON.parse(localStorage.getItem(key) || 'null');
    if (!v) return null;
    if (Date.now() - v.ts > TTL_MS) return null;
    return v.data;
  } catch {
    return null;
  }
}

function setCache(key, data) {
  try {
    localStorage.setItem(key, JSON.stringify({ ts: Date.now(), data }));
  } catch {}
}

async function persistNcmFromApi(item) {
  if (!supabase || !item?.codigo) return;
  try {
    await supabase.from('ncm').upsert({
      codigo: onlyDigits(item.codigo),
      descricao: item.descricao || null,
      capitulo: item.capitulo || null,
      posicao: item.posicao || null,
      subposicao: item.subposicao || null,
      unidade: item.unidade || item.unidade_estatistica || null,
    }, { onConflict: 'codigo' });

    const tribPayload = {
      ncm_codigo: onlyDigits(item.codigo),
      ii: item.ii ?? item.aliquota_ii ?? null,
      ipi: item.ipi ?? item.aliquota_ipi ?? null,
      pis: item.pis ?? item.aliquota_pis ?? null,
      cofins: item.cofins ?? item.aliquota_cofins ?? null,
      pis_importacao: item.pis_importacao ?? null,
      cofins_importacao: item.cofins_importacao ?? null,
      cest: item.cest ?? null,
      origem_dados: item.origem_dados ?? 'brasilapi',
    };

    await supabase.from('ncm_tributos').upsert(tribPayload, { onConflict: 'ncm_codigo' });
  } catch {
    // persistência não deve bloquear o fluxo principal
  }
}

export async function getNcmByCode(code) {
  const digits = onlyDigits(code);
  if (!digits || !supabase) return null;
  const cacheKey = `db:ncm:${digits}`;
  const cached = getCache(cacheKey);
  if (cached) return cached;

  const { data, error } = await supabase.from('ncm').select('*').eq('codigo', digits).maybeSingle();
  if (error) {
    console.error(error);
    return null;
  }
  if (data) setCache(cacheKey, data);
  return data;
}

export async function getOrFetchNcmByCode(code) {
  const digits = onlyDigits(code);
  if (!digits) return null;

  const dbNcm = await getNcmByCode(digits);
  if (dbNcm) return dbNcm;

  const apiItem = (await searchNcmByCode(digits))[0] || null;
  if (!apiItem) return null;

  await persistNcmFromApi(apiItem);
  return apiItem;
}

export async function getNcmTributos(code) {
  const digits = onlyDigits(code);
  if (!digits || !supabase) return null;
  const { data, error } = await supabase.from('ncm_tributos').select('*').eq('ncm_codigo', digits).maybeSingle();
  if (error) return null;
  return data;
}

export async function getCestByNcm(code) {
  const digits = onlyDigits(code);
  if (!digits || !supabase) return [];
  const { data, error } = await supabase.from('cest').select('*').eq('ncm_codigo', digits);
  if (error) return [];
  return data || [];
}

export async function getCnaeByCode(code) {
  const digits = onlyDigits(code);
  if (!digits || !supabase) return null;
  const cacheKey = `db:cnae:${digits}`;
  const cached = getCache(cacheKey);
  if (cached) return cached;

  const { data, error } = await supabase.from('cnae').select('*').eq('codigo', digits).maybeSingle();
  if (error) return null;
  if (data) setCache(cacheKey, data);
  return data;
}

export async function getSimplesByCnae(code) {
  const digits = onlyDigits(code);
  if (!digits || !supabase) return [];
  const { data, error } = await supabase.from('simples_nacional').select('*').eq('cnae_codigo', digits);
  if (error) return [];
  return data || [];
}

export async function logSearch(searchTerm, searchType) {
  const term = String(searchTerm || '').trim();
  const type = String(searchType || '').trim().toLowerCase();
  if (!term || !type) return;

  const payload = {
    search_term: term.slice(0, 120),
    search_type: type.slice(0, 24),
    timestamp: new Date().toISOString(),
  };

  if (supabase) {
    try {
      await supabase.from('search_logs').insert(payload);
      return;
    } catch {
      // fallback local em caso de erro de permissão/RLS
    }
  }

  try {
    const key = 'local:search_logs';
    const current = JSON.parse(localStorage.getItem(key) || '[]');
    current.unshift(payload);
    localStorage.setItem(key, JSON.stringify(current.slice(0, 100)));
  } catch {}
}

export async function testSupabaseConnection() {
  if (!supabase) {
    console.log('Supabase test:', null, 'supabase client indisponível');
    return { data: null, error: 'supabase client indisponível' };
  }

  const { data, error } = await supabase
    .from('ncm')
    .select('*')
    .limit(5);

  console.log('Supabase test:', data, error);
  return { data, error };
}
