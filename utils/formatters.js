import { onlyDigits } from './validators.js';

export function formatNcm(value = '') {
  const d = onlyDigits(value);
  return d.length === 8 ? `${d.slice(0, 4)}.${d.slice(4, 6)}.${d.slice(6, 8)}` : value;
}

export function formatCnae(value = '') {
  const d = onlyDigits(value);
  return d.length === 7 ? `${d.slice(0, 4)}-${d.slice(4, 5)}/${d.slice(5, 7)}` : value;
}

export function parseNcmHierarchy(value = '', description = '') {
  const d = onlyDigits(value).padEnd(8, '0').slice(0, 8);
  const desc = description || 'Descrição não informada';
  return {
    capitulo: { codigo: d.slice(0, 2), descricao: desc },
    posicao: { codigo: d.slice(0, 4), descricao: desc },
    subposicao: { codigo: `${d.slice(0, 4)}.${d.slice(4, 6)}`, descricao: desc },
    ncm: { codigo: formatNcm(d), descricao: desc },
  };
}

export function parseCnaeHierarchy(value = '', description = '') {
  const d = onlyDigits(value).padEnd(7, '0').slice(0, 7);
  const desc = description || 'Descrição não informada';
  return {
    secao: { codigo: d.slice(0, 1), descricao: desc },
    divisao: { codigo: d.slice(0, 2), descricao: desc },
    grupo: { codigo: `${d.slice(0, 2)}.${d.slice(2, 3)}`, descricao: desc },
    classe: { codigo: `${d.slice(0, 2)}.${d.slice(2, 4)}`, descricao: desc },
    subclasse: { codigo: formatCnae(d), descricao: desc },
  };
}
