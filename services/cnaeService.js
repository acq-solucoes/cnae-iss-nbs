import { onlyDigits } from '../utils/validators.js';

function source() {
  return Array.isArray(window.__CNAE_DATA__) ? window.__CNAE_DATA__ : [];
}

export function searchCnaeByCode(code) {
  const d = onlyDigits(code);
  return source().filter((item) => onlyDigits(item.cnae) === d).slice(0, 1);
}

export function searchCnaeByKeyword(term) {
  const q = String(term || '').toLowerCase().trim();
  if (!q) return [];
  return source().filter((item) => {
    if (String(item.descCnae || '').toLowerCase().includes(q)) return true;
    return (item.items || []).some((it) => String(it.descItem || '').toLowerCase().includes(q));
  }).slice(0, 30);
}

export function autocompleteCnae(value) {
  const raw = String(value || '').trim();
  const d = onlyDigits(raw);
  if (!raw) return [];

  if (d.length >= 2 && d === raw) {
    return source().filter((item) => onlyDigits(item.cnae).startsWith(d)).slice(0, 8);
  }

  if (raw.length >= 3) {
    return searchCnaeByKeyword(raw).slice(0, 8);
  }

  return [];
}

export function getRelatedCnaes(item) {
  if (!item) return [];
  const d = onlyDigits(item.cnae);
  const cls = d.slice(0, 5);
  const grp = d.slice(0, 3);
  return source().filter((row) => {
    const c = onlyDigits(row.cnae);
    return c !== d && (c.slice(0, 5) === cls || c.slice(0, 3) === grp);
  }).slice(0, 8);
}
