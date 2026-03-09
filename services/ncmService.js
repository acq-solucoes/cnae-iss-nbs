import { onlyDigits } from '../utils/validators.js';

const TTL_MS = 1000 * 60 * 60 * 12;

function getCache(key) {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (Date.now() - data.ts > TTL_MS) return null;
    return data.value;
  } catch {
    return null;
  }
}

function setCache(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify({ ts: Date.now(), value }));
  } catch { }
}

async function api(path) {
  const res = await fetch(`https://brasilapi.com.br/api/ncm/v1${path}`, { mode: 'cors', credentials: 'omit' });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

const IBPT_TOKEN = "ZcZ8sDmzuc3shJgqtjoTagap5BjAOBpoAR1rZoKqOEIKZx-b9WAL5Zi2CcwxOXmd";
const IBPT_CNPJ = "23986075000199";

const SUPABASE_URL = "https://zogsqlpskmalvijoeajw.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpvZ3NxbHBza21hbHZpam9lYWp3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI5MzUyMDUsImV4cCI6MjA4ODUxMTIwNX0.iJLfNTy1a3E6fOcvnHgn-cANLebLsl5dyGNh1rfWmXQ";

/**
 * Funções auxiliares para o Cache no Supabase
 */
async function getFromSupabase(code) {
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/ncm_cache?codigo=eq.${code}`, {
      headers: { "apikey": SUPABASE_KEY, "Authorization": `Bearer ${SUPABASE_KEY}` }
    });
    const data = await res.json();
    return data && data.length > 0 ? data[0] : null;
  } catch (e) {
    console.error("Erro ao ler do Supabase:", e);
    return null;
  }
}

async function saveToSupabase(data) {
  try {
    await fetch(`${SUPABASE_URL}/rest/v1/ncm_cache`, {
      method: "POST",
      headers: {
        "apikey": SUPABASE_KEY,
        "Authorization": `Bearer ${SUPABASE_KEY}`,
        "Content-Type": "application/json",
        "Prefer": "resolution=merge-duplicates"
      },
      body: JSON.stringify(data)
    });
  } catch (e) {
    console.error("Erro ao salvar no Supabase:", e);
  }
}

/**
 * Busca alíquotas reais na base de dados do IBPT com cache no Supabase
 */
async function lookupTaxRates(ncmCode) {
  const code = onlyDigits(ncmCode);
  const uf = "SP";

  // 1. Tenta buscar no Banco de Dados (Supabase)
  const cachedDb = await getFromSupabase(code);
  if (cachedDb) {
    return { ...cachedDb, fonte_cache: "Database" };
  }

  // Mantemos a lógica de avisos internos para enriquecer o dado
  let extraInfo = { is_monofasico: false, obs: '' };
  if (code.startsWith('29') || code.startsWith('30')) {
    extraInfo = { is_monofasico: true, obs: 'Sujeito a Regime Monofásico (Lei 10.147/00)' };
  }

  try {
    const url = `https://api.ibpt.org.br/v1/produtos?token=${IBPT_TOKEN}&cnpj=${IBPT_CNPJ}&codigo=${code}&uf=${uf}&ex=0`;
    const res = await fetch(url);
    if (!res.ok) throw new Error('Erro na consulta IBPT');

    const data = await res.json();
    const result = {
      codigo: code,
      descricao: data.Descricao ? data.Descricao.charAt(0).toUpperCase() + data.Descricao.slice(1).toLowerCase() : null,
      desc_ibpt: !!data.Descricao,
      aliquota_ii: Number(data.Importado) || 0,
      aliquota_ipi: Number(data.IPI || data.Federal) || 0,
      aliquota_pis: Number(data.PIS) || (extraInfo.is_monofasico ? 2.1 : 1.65),
      aliquota_cofins: Number(data.COFINS) || (extraInfo.is_monofasico ? 9.9 : 7.6),
      is_monofasico: extraInfo.is_monofasico,
      obs: extraInfo.obs,
      fonte: "Fonte: IBPT"
    };

    // 2. Salva no Supabase para futuras consultas
    saveToSupabase(result);

    return result;
  } catch (e) {
    console.error("Erro ao consultar IBPT:", e);
    return {
      aliquota_ii: 0,
      aliquota_ipi: 0,
      aliquota_pis: 1.65,
      aliquota_cofins: 7.6,
      ...extraInfo,
      fonte: "Erro na base IBPT"
    };
  }
}

export async function searchNcmByCode(code) {
  const digits = onlyDigits(code);
  if (!digits) return [];
  const key = `ncm:code:${digits}`;
  const cached = getCache(key);

  let items;
  if (cached) {
    items = cached;
  } else {
    try {
      const data = await api(`/${digits}`);
      items = Array.isArray(data) ? data : data?.codigo ? [data] : [];
      setCache(key, items);
    } catch {
      items = [];
    }
  }

  // Mescla com dados tributários simulados (ou de API externa)
  if (items.length > 0) {
    const taxes = await lookupTaxRates(digits);
    items[0] = { ...items[0], ...taxes };
  }

  return items;
}

export async function searchNcmByKeyword(keyword) {
  const q = String(keyword || '').trim();
  if (q.length < 2) return [];
  const key = `ncm:text:${q.toLowerCase()}`;
  const cached = getCache(key);
  if (cached) return cached;
  const data = await api(`?search=${encodeURIComponent(q)}`);
  const items = Array.isArray(data) ? data : [];
  setCache(key, items);
  return items;
}

export async function autocompleteNcm(value) {
  const d = onlyDigits(value);
  if (d.length < 2 || d.length > 7) return [];
  // No autocomplete não precisamos de taxas para performance
  const data = await api(`/${d}`);
  return Array.isArray(data) ? data : data?.codigo ? [data] : [];
}

export function getRelatedNcms(items, code) {
  const d = onlyDigits(code);
  const p6 = d.slice(0, 6);
  const p4 = d.slice(0, 4);
  return (items || []).filter((it) => {
    const c = onlyDigits(it.codigo);
    return c !== d && (c.startsWith(p6) || c.startsWith(p4));
  }).slice(0, 8);
}
