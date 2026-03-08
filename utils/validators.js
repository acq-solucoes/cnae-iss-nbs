export function onlyDigits(value = '') {
  return String(value).replace(/\D/g, '');
}

function hasLetters(value = '') {
  return /[A-Za-zÀ-ÖØ-öø-ÿ]/.test(String(value));
}

export function detectSearchType(value = '') {
  const raw = String(value).trim();
  const digits = onlyDigits(raw);

  if (!raw) return 'keyword';
  if (hasLetters(raw)) return 'keyword';

  if (digits.length === 8) return 'ncm';
  if (digits.length === 7) return 'cnae';
  return 'keyword';
}

export function isValidNcm(value = '') {
  return onlyDigits(value).length === 8;
}

export function isValidCnae(value = '') {
  return onlyDigits(value).length === 7;
}
