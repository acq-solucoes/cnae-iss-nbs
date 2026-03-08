import { onlyDigits } from '../utils/validators.js';

export function lookupCest(code) {
  const map = window.__CEST_MAP__ || {};
  const d = onlyDigits(code);
  for (const len of [8, 7, 6, 4]) {
    const key = d.slice(0, len);
    if (map[key]) return map[key];
  }
  return [];
}
