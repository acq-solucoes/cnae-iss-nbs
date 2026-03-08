import { detectSearchType, onlyDigits } from './utils/validators.js';
import { formatNcm, formatCnae, parseNcmHierarchy, parseCnaeHierarchy } from './utils/formatters.js';
import { searchNcmByCode, searchNcmByKeyword, autocompleteNcm, getRelatedNcms } from './services/ncmService.js';
import { searchCnaeByCode, searchCnaeByKeyword, autocompleteCnae, getRelatedCnaes } from './services/cnaeService.js';
import { lookupCest } from './services/cestService.js';
import { getNcmByCode, getNcmTributos, getCestByNcm, getCnaeByCode, getSimplesByCnae, testSupabaseConnection } from './services/databaseService.js';
import { renderSearchBox } from './components/SearchBox.js';
import { renderResultCard } from './components/ResultCard.js';
import { renderHierarchyView } from './components/HierarchyView.js';
import { renderRelatedItems } from './components/RelatedItems.js';

const hero = document.querySelector('.wrap');
const tabBar = document.querySelector('.tab-bar');
const host = document.createElement('div');
host.innerHTML = `${renderSearchBox()}<div id="global-result"></div>`;
hero.insertBefore(host, tabBar);

const input = document.getElementById('global-q');
const clearBtn = document.getElementById('global-clear');
const ac = document.getElementById('global-ac');
const result = document.getElementById('global-result');

function setSeo(type, code, description) {
  const clean = onlyDigits(code || '');
  if (!clean) return;
  document.title = `${type.toUpperCase()} ${clean} | Consulta Fiscal`;
  const content = `${type.toUpperCase()} ${clean}: ${description || 'consulta fiscal detalhada'}`;
  let meta = document.querySelector('meta[name="description"]');
  if (!meta) {
    meta = document.createElement('meta');
    meta.setAttribute('name', 'description');
    document.head.appendChild(meta);
  }
  meta.setAttribute('content', content);
}

function pushRoute(type, code) {
  history.replaceState({}, '', `/${type}/${onlyDigits(code)}`);
}

function friendlyTax(v) {
  return v === undefined || v === null || v === '' ? 'Não informado na base consultada' : `${v}%`;
}

async function renderNcm(code) {
  result.innerHTML = '<div class="ncm-status"><span class="ncm-spin"></span>Carregando NCM...</div>';

  const dbNcm = await getNcmByCode(code);
  const item = dbNcm || (await searchNcmByCode(code))[0];

  if (!item) {
    result.innerHTML = '<div class="ncm-empty">Nenhum resultado encontrado.</div>';
    return;
  }

  const h = parseNcmHierarchy(item.codigo, item.descricao);
  const hierarchy = renderHierarchyView([
    { label: 'Capítulo', value: `${h.capitulo.codigo} — ${item.capitulo || h.capitulo.descricao}` },
    { label: 'Posição', value: `${h.posicao.codigo} — ${item.posicao || h.posicao.descricao}` },
    { label: 'Subposição', value: `${h.subposicao.codigo} — ${item.subposicao || h.subposicao.descricao}` },
    { label: 'NCM', value: h.ncm.codigo },
  ]);

  const trib = (await getNcmTributos(item.codigo)) || item;
  const tribHtml = [
    ['II', friendlyTax(trib.ii ?? trib.aliquota_ii)],
    ['IPI', friendlyTax(trib.ipi ?? trib.aliquota_ipi)],
    ['PIS', friendlyTax(trib.pis ?? trib.aliquota_pis)],
    ['COFINS', friendlyTax(trib.cofins ?? trib.aliquota_cofins)],
  ].map(([k, v]) => `<div class="ncm-aliq-row"><span class="ncm-aliq-label">${k}</span><span class="ncm-aliq-value">${v}</span></div>`).join('');

  const dbCest = await getCestByNcm(item.codigo);
  const cests = dbCest.length ? dbCest : (lookupCest(item.codigo) || []).map((c) => ({
    cest: c.cest,
    descricao: c.descricao,
    segmento: c.segmento,
    base_legal: 'Convênio ICMS 92/2015',
  }));
  const cestHtml = cests.length
    ? cests.map((c) => `<div class="ncm-vig-item"><strong>${c.cest}</strong> — ${c.segmento || c.descricao}<br><small>${c.base_legal || 'Base legal não informada'}</small></div>`).join('')
    : '<div class="ncm-vig-item">Não sujeito à substituição tributária</div>';

  const relatedRaw = await searchNcmByKeyword(onlyDigits(item.codigo).slice(0, 4));
  const relatedNcm = getRelatedNcms(relatedRaw, item.codigo).map((x) => ({ code: x.codigo, description: x.descricao }));

  result.innerHTML = renderResultCard({
    title: `NCM ${formatNcm(item.codigo)}`,
    subtitle: item.descricao,
    sections: [
      { title: 'Estrutura NCM', content: hierarchy },
      { title: 'Tributação Federal', content: tribHtml },
      { title: 'CEST / Base legal', content: cestHtml },
      { title: 'NCM relacionados', content: renderRelatedItems('NCM relacionados', relatedNcm, formatNcm) },
    ],
  });

  setSeo('ncm', item.codigo, item.descricao);
  pushRoute('ncm', item.codigo);
}

async function renderCnae(code) {
  const dbCnae = await getCnaeByCode(code);
  const fallback = searchCnaeByCode(code)[0];
  const item = dbCnae ? { cnae: dbCnae.codigo, descCnae: dbCnae.descricao, ...dbCnae } : fallback;

  if (!item) {
    result.innerHTML = '<div class="ncm-empty">Nenhum resultado encontrado.</div>';
    return;
  }

  const h = parseCnaeHierarchy(item.cnae || item.codigo, item.descCnae || item.descricao);
  const hierarchy = renderHierarchyView([
    { label: 'Seção', value: `${item.secao || h.secao.codigo} — ${h.secao.descricao}` },
    { label: 'Divisão', value: `${item.divisao || h.divisao.codigo} — ${h.divisao.descricao}` },
    { label: 'Grupo', value: `${item.grupo || h.grupo.codigo} — ${h.grupo.descricao}` },
    { label: 'Classe', value: `${item.classe || h.classe.codigo} — ${h.classe.descricao}` },
    { label: 'Subclasse', value: `${item.subclasse || h.subclasse.codigo} — ${h.subclasse.descricao}` },
  ]);

  const related = getRelatedCnaes({ cnae: item.cnae || item.codigo }).map((x) => ({ code: x.cnae, description: x.descCnae }));
  const simples = await getSimplesByCnae(item.cnae || item.codigo);
  const simplesHtml = simples.length
    ? simples.map((s) => `<div class="ncm-vig-item"><strong>Anexo ${s.anexo}</strong> — alíquota inicial ${s.aliquota_inicial}</div>`).join('')
    : '<div class="ncm-vig-item">Não informado na base consultada</div>';

  result.innerHTML = renderResultCard({
    title: `CNAE ${formatCnae(item.cnae || item.codigo)}`,
    subtitle: item.descCnae || item.descricao,
    sections: [
      { title: 'Estrutura CNAE', content: hierarchy },
      { title: 'CNAE relacionados', content: renderRelatedItems('CNAE relacionados', related, formatCnae) },
      { title: 'Simples Nacional', content: simplesHtml },
    ],
  });

  setSeo('cnae', item.cnae || item.codigo, item.descCnae || item.descricao);
  pushRoute('cnae', item.cnae || item.codigo);
}

async function runGlobalSearch(value) {
  const query = String(value || '').trim();
  if (!query) {
    result.innerHTML = '';
    return;
  }

  const type = detectSearchType(query);
  if (type === 'ncm') return renderNcm(query);
  if (type === 'cnae') return renderCnae(query);

  result.innerHTML = '<div class="ncm-status"><span class="ncm-spin"></span>Buscando em NCM/CNAE...</div>';
  const [ncm, cnae] = await Promise.all([searchNcmByKeyword(query), Promise.resolve(searchCnaeByKeyword(query))]);

  const cards = [];
  if (ncm[0]) cards.push(renderResultCard({ title: `NCM ${formatNcm(ncm[0].codigo)}`, subtitle: ncm[0].descricao }));
  if (cnae[0]) cards.push(renderResultCard({ title: `CNAE ${formatCnae(cnae[0].cnae)}`, subtitle: cnae[0].descCnae }));

  result.innerHTML = cards.length ? cards.join('') : '<div class="ncm-empty">Nenhum resultado encontrado.</div>';
}

let timer;
input.addEventListener('input', () => {
  clearTimeout(timer);
  timer = setTimeout(async () => {
    const q = input.value.trim();
    runGlobalSearch(q);
    const [ncm, cnae] = await Promise.all([autocompleteNcm(q), Promise.resolve(autocompleteCnae(q))]);
    const merged = [
      ...ncm.map((x) => ({ label: `NCM ${formatNcm(x.codigo)}`, value: x.codigo })),
      ...cnae.map((x) => ({ label: `CNAE ${formatCnae(x.cnae)}`, value: x.cnae })),
    ].slice(0, 8);

    if (!merged.length) {
      ac.style.display = 'none';
      return;
    }

    ac.innerHTML = merged.map((x) => `<div class="ncm-ac-item" data-v="${x.value}">${x.label}</div>`).join('');
    ac.style.display = 'block';
  }, 250);
});

ac.addEventListener('mousedown', (e) => {
  const row = e.target.closest('.ncm-ac-item');
  if (!row) return;
  input.value = row.dataset.v;
  ac.style.display = 'none';
  runGlobalSearch(row.dataset.v);
});

clearBtn.addEventListener('click', () => {
  input.value = '';
  result.innerHTML = '';
  ac.style.display = 'none';
});

(function routeBoot() {
  const m = location.pathname.match(/^\/(ncm|cnae)\/(\d{7,8})$/);
  if (!m) return;
  input.value = m[2];
  runGlobalSearch(m[2]);
})();


// teste simples de conectividade com Supabase
testSupabaseConnection();
