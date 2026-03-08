import { detectSearchType, onlyDigits } from './utils/validators.js';
import { formatNcm, formatCnae, parseNcmHierarchy, parseCnaeHierarchy } from './utils/formatters.js';
import { searchNcmByCode, searchNcmByKeyword, autocompleteNcm, getRelatedNcms } from './services/ncmService.js';
import { searchCnaeByCode, searchCnaeByKeyword, autocompleteCnae, getRelatedCnaes } from './services/cnaeService.js';
import { lookupCest } from './services/cestService.js';
import { renderResultCard } from './components/ResultCard.js';
import { renderHierarchyView } from './components/HierarchyView.js';
import { renderRelatedItems } from './components/RelatedItems.js';

const input = document.getElementById('q');
const clearBtn = document.getElementById('btn-clear');
const result = document.getElementById('results');

let ac = document.getElementById('global-ac');

function setSeo(type, code, description) {
  if (!code) return;
  const clean = onlyDigits(code);
  const title = `${type.toUpperCase()} ${clean} | Consulta Fiscal`;
  const desc = `${type.toUpperCase()} ${clean}: ${description || 'consulta detalhada com hierarquia e itens relacionados.'}`;
  document.title = title;
  let meta = document.querySelector('meta[name="description"]');
  if (!meta) {
    meta = document.createElement('meta');
    meta.setAttribute('name', 'description');
    document.head.appendChild(meta);
  }
  meta.setAttribute('content', desc);
}

function pushRoute(type, code) {
  const clean = onlyDigits(code);
  const url = new URL(window.location.href);
  url.searchParams.set('tipo', type);
  url.searchParams.set('codigo', clean);
  history.replaceState({}, '', `${url.pathname}?${url.searchParams.toString()}`);
}

function friendlyTax(value) {
  return value === undefined || value === null || value === '' ? 'Não informado na base consultada' : `${value}%`;
}

async function renderNcm(code) {
  result.innerHTML = '<div class="ncm-status"><span class="ncm-spin"></span>Carregando NCM...</div>';
  try {
    const items = await searchNcmByCode(code);
    const item = items[0];
    if (!item) {
      result.innerHTML = '<div class="ncm-empty">Nenhum resultado encontrado.</div>';
      return;
    }
    const h = parseNcmHierarchy(item.codigo, item.descricao);
    const hierarchy = renderHierarchyView([
      { label: 'Capítulo', value: `${h.capitulo.codigo} — ${h.capitulo.descricao}` },
      { label: 'Posição', value: `${h.posicao.codigo} — ${h.posicao.descricao}` },
      { label: 'Subposição', value: `${h.subposicao.codigo} — ${h.subposicao.descricao}` },
      { label: 'NCM', value: h.ncm.codigo },
      { label: 'Ex-Tarifário', value: item.ex ? `Ex ${item.ex}` : 'Não aplicável' },
    ]);
    const cest = lookupCest(item.codigo);
    const cestHtml = cest.length
      ? cest.map((c) => `<div class="ncm-vig-item"><strong>${c.cest}</strong> — ${c.segmento} (Convênio ICMS 92/2015)</div>`).join('')
      : '<div class="ncm-vig-item">Não sujeito à substituição tributária</div>';
    const taxes = `<div class="ncm-aliq-row"><span class="ncm-aliq-label">II</span><span class="ncm-aliq-value">${friendlyTax(item.aliquota_ii)}</span></div>
      <div class="ncm-aliq-row"><span class="ncm-aliq-label">IPI</span><span class="ncm-aliq-value">${friendlyTax(item.aliquota_ipi)}</span></div>
      <div class="ncm-aliq-row"><span class="ncm-aliq-label">PIS</span><span class="ncm-aliq-value">${friendlyTax(item.aliquota_pis)}</span></div>
      <div class="ncm-aliq-row"><span class="ncm-aliq-label">COFINS</span><span class="ncm-aliq-value">${friendlyTax(item.aliquota_cofins)}</span></div>`;
    const relatedRaw = await searchNcmByKeyword(onlyDigits(code).slice(0, 4));
    const related = getRelatedNcms(relatedRaw, code).map((x) => ({ code: x.codigo, description: x.descricao }));
    const relatedHtml = renderRelatedItems('NCM relacionados', related, formatNcm);

    result.innerHTML = renderResultCard(`${formatNcm(item.codigo)} — ${item.descricao}`, `${hierarchy}<hr style="border-color:var(--border);margin:10px 0">${taxes}<div class="section" style="padding-left:0">${cestHtml}</div>${relatedHtml}`);
    setSeo('ncm', item.codigo, item.descricao);
    pushRoute('ncm', item.codigo);
  } catch {
    result.innerHTML = '<div class="ncm-empty">Erro amigável: não foi possível consultar o NCM agora.</div>';
  }
}

function renderCnae(item) {
  if (!item) {
    result.innerHTML = '<div class="ncm-empty">Nenhum resultado encontrado.</div>';
    return;
  }
  const h = parseCnaeHierarchy(item.cnae, item.descCnae);
  const hierarchy = renderHierarchyView([
    { label: 'Seção', value: `${h.secao.codigo} — ${h.secao.descricao}` },
    { label: 'Divisão', value: `${h.divisao.codigo} — ${h.divisao.descricao}` },
    { label: 'Grupo', value: `${h.grupo.codigo} — ${h.grupo.descricao}` },
    { label: 'Classe', value: `${h.classe.codigo} — ${h.classe.descricao}` },
    { label: 'Subclasse', value: `${h.subclasse.codigo} — ${h.subclasse.descricao}` },
  ]);
  const related = getRelatedCnaes(item).map((x) => ({ code: x.cnae, description: x.descCnae }));
  const relatedHtml = renderRelatedItems('CNAEs relacionados', related, formatCnae);
  result.innerHTML = renderResultCard(`${formatCnae(item.cnae)} — ${item.descCnae}`, `${hierarchy}${relatedHtml}`);
  setSeo('cnae', item.cnae, item.descCnae);
  pushRoute('cnae', item.cnae);
}

async function runGlobalSearch(value) {
  const query = String(value || '').trim();
  if (!query) {
    result.innerHTML = '';
    return;
  }
  const type = detectSearchType(query);
  if (type === 'ncm') return renderNcm(query);
  if (type === 'cnae') return renderCnae(searchCnaeByCode(query)[0]);

  result.innerHTML = '<div class="ncm-status"><span class="ncm-spin"></span>Buscando em NCM e CNAE...</div>';
  const [ncm, cnae] = await Promise.all([searchNcmByKeyword(query), Promise.resolve(searchCnaeByKeyword(query))]);
  const blocks = [];
  if (ncm[0]) blocks.push(renderResultCard(`NCM ${formatNcm(ncm[0].codigo)}`, ncm[0].descricao));
  if (cnae[0]) blocks.push(renderResultCard(`CNAE ${formatCnae(cnae[0].cnae)}`, cnae[0].descCnae));
  result.innerHTML = blocks.length ? blocks.join('') : '<div class="ncm-empty">Nenhum resultado encontrado.</div>';
}

let acTimer;
if (input && clearBtn && ac && result) input.addEventListener('input', () => {
  clearTimeout(acTimer);
  acTimer = setTimeout(async () => {
    const q = input.value.trim();
    runGlobalSearch(q);
    const [ncm, cnae] = await Promise.all([autocompleteNcm(q), Promise.resolve(autocompleteCnae(q))]);
    const merged = [...ncm.map((x) => ({ label: `NCM ${formatNcm(x.codigo)}`, value: x.codigo })), ...cnae.map((x) => ({ label: `CNAE ${formatCnae(x.cnae)}`, value: x.cnae }))].slice(0, 8);
    if (!merged.length) {
      ac.style.display = 'none';
      return;
    }
    ac.innerHTML = merged.map((x) => `<div class="ncm-ac-item" data-v="${x.value}">${x.label}</div>`).join('');
    ac.style.display = 'block';
  }, 250);
});

if (input && clearBtn && ac && result) ac.addEventListener('mousedown', (e) => {
  const row = e.target.closest('.ncm-ac-item');
  if (!row) return;
  input.value = row.dataset.v;
  ac.style.display = 'none';
  runGlobalSearch(row.dataset.v);
});

if (input && clearBtn && ac && result) clearBtn.addEventListener('click', () => {
  input.value = '';
  result.innerHTML = '';
  ac.style.display = 'none';
});

(function handleRoute() {
  if (!input || !result) return;
  const params = new URLSearchParams(window.location.search);
  const tipo = params.get('tipo');
  const codigo = params.get('codigo');
  if ((tipo === 'ncm' || tipo === 'cnae') && /^\d{7,8}$/.test(codigo || '')) {
    input.value = codigo;
    runGlobalSearch(codigo);
    return;
  }

  const legacyMatch = location.pathname.match(/^\/(ncm|cnae)\/(\d{7,8})$/);
  if (!legacyMatch) return;
  input.value = legacyMatch[2];
  runGlobalSearch(legacyMatch[2]);
})();
