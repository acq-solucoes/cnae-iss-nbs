import { supabase } from './supabaseClient.js';
import { onlyDigits } from '../utils/validators.js';

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
