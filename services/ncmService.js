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
  } catch {}
}

async function api(path) {
  const res = await fetch(`https://brasilapi.com.br/api/ncm/v1${path}`, { mode: 'cors', credentials: 'omit' });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

export async function searchNcmByCode(code) {
  const digits = onlyDigits(code);
  if (!digits) return [];
  const key = `ncm:code:${digits}`;
  const cached = getCache(key);
  if (cached) return cached;
  const data = await api(`/${digits}`);
  const items = Array.isArray(data) ? data : data?.codigo ? [data] : [];
  setCache(key, items);
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
  const raw = String(value || '').trim();
  const d = onlyDigits(raw);

  if (!raw) return [];

  if (d.length >= 2 && d.length <= 8 && d === raw) {
    return searchNcmByKeyword(d);
  }

  if (raw.length >= 3) {
    return searchNcmByKeyword(raw);
  }

  return [];
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
