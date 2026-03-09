import { detectSearchType, onlyDigits } from './utils/validators.js';
import { formatNcm, formatCnae, parseNcmHierarchy, parseCnaeHierarchy } from './utils/formatters.js';
import { searchNcmByCode, searchNcmByKeyword, autocompleteNcm, getRelatedNcms } from './services/ncmService.js';
import { searchCnaeByCode, searchCnaeByKeyword, autocompleteCnae, getRelatedCnaes } from './services/cnaeService.js';
import { lookupCest } from './services/cestService.js';
import { renderSearchBox } from './components/SearchBox.js';
import { renderResultCard } from './components/ResultCard.js';
import { renderHierarchyView } from './components/HierarchyView.js';
import { renderRelatedItems } from './components/RelatedItems.js';

const hero = document.querySelector('.wrap');
const tabBar = document.querySelector('.tab-bar');
const cnaeSec = document.getElementById('cnae-section');
const ncmSec = document.getElementById('ncm-section');

if (tabBar) tabBar.style.display = 'none';
if (cnaeSec) cnaeSec.style.display = 'none';
if (ncmSec) ncmSec.style.display = 'none';

const host = document.createElement('div');
host.style.cssText = 'transition: all 0.3s ease;';
host.innerHTML = `${renderSearchBox()}<div id="global-result" style="min-height:200px; transition: opacity 0.3s ease;"></div>`;
hero.insertBefore(host, tabBar);

const input = document.getElementById('global-q');
const clearBtn = document.getElementById('global-clear');
const ac = document.getElementById('global-ac');
const result = document.getElementById('global-result');

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
  history.replaceState({}, '', `/${type}/${onlyDigits(code)}`);
}

function friendlyTax(value) {
  return value === undefined || value === null || value === '' ? 'Não informado na base consultada' : `${value}%`;
}

function getRegimeComparison(cnaeItem) {
  const isService = !cnaeItem.noISS;
  const isFatorR = (window.SIMPLES_MAP && window.SIMPLES_MAP[onlyDigits(cnaeItem.cnae)] || []).some(s => s.fatorR === 'Sim' || s.anexo === 'V');

  const presumidoPIS = 0.65;
  const presumidoCOFINS = 3.0;
  const presumidoIRCS = isService ? 4.8 : 2.28; // Estimativa média (IRPJ 4.8% ou 1.2% + CSLL 2.88% ou 1.08%)

  const realPIS = 1.65;
  const realCOFINS = 7.6;

  return `
    <div class="tax-comparison" style="margin-top:20px; border-top:1px solid var(--border); padding-top:16px;">
      <h4 style="font-size:12px; text-transform:uppercase; color:var(--muted); margin-bottom:12px;">Comparativo de Regimes (Estimativa)</h4>
      <div style="display:grid; grid-template-columns: 1fr 1fr 1fr; gap:10px;">
        <div class="regime-card" style="padding:10px; border:1px solid var(--violet-lo); border-radius:6px; background:rgba(139, 92, 246, 0.05)">
          <div style="font-weight:bold; font-size:11px; color:var(--violet-hi)">SIMPLES NACIONAL</div>
          <div style="font-size:18px; margin:4px 0" id="tax-simples-val">Sob consulta</div>
          <div style="font-size:10px; color:var(--muted)">${isFatorR ? 'Sujeito a Fator R' : 'Alíquota Progressiva'}</div>
        </div>
        <div class="regime-card" style="padding:10px; border:1px solid var(--orange-lo); border-radius:6px; background:rgba(249, 115, 22, 0.05)">
          <div style="font-weight:bold; font-size:11px; color:var(--orange-hi)">LUCRO PRESUMIDO</div>
          <div style="font-size:18px; margin:4px 0">${(presumidoPIS + presumidoCOFINS + presumidoIRCS + 2).toFixed(2)}%*</div>
          <div style="font-size:10px; color:var(--muted)">Cumulativo (+ISS/ICMS)</div>
        </div>
        <div class="regime-card" style="padding:10px; border:1px solid var(--blue-lo); border-radius:6px; background:rgba(59, 130, 246, 0.05)">
          <div style="font-weight:bold; font-size:11px; color:var(--blue-hi)">LUCRO REAL</div>
          <div style="font-size:18px; margin:4px 0">${(realPIS + realCOFINS).toFixed(2)}%*</div>
          <div style="font-size:10px; color:var(--muted)">Não-cumulativo (+IR/CS)</div>
        </div>
      </div>
      <p style="font-size:9px; color:var(--muted); margin-top:8px;">*Estimativa baseada em alíquotas federais padrão para ${isService ? 'Serviços' : 'Comércio'}. Consulte um contador para valores exatos.</p>
    </div>
  `;
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

    const taxAlertHtml = item.is_monofasico
      ? `<div style="margin-top:12px; padding:10px; background:rgba(217, 70, 239, 0.1); border:1px solid var(--violet-hi); border-radius:6px;">
          <strong style="color:var(--violet-hi); font-size:11px;">💡 AVISO PARA CONTADORES:</strong>
          <p style="margin:4px 0 0; font-size:11px;">Este item possui indicativo de <strong>Regime Monofásico</strong>. ${item.obs || ''}</p>
         </div>`
      : '';

    const relatedRaw = await searchNcmByKeyword(onlyDigits(code).slice(0, 4));
    const related = getRelatedNcms(relatedRaw, code).map((x) => ({ code: x.codigo, description: x.descricao }));
    const relatedHtml = renderRelatedItems('NCM relacionados', related, formatNcm);

    result.innerHTML = renderResultCard(`${formatNcm(item.codigo)} — ${item.descricao}`,
      `${hierarchy}<hr style="border-color:var(--border);margin:10px 0">
      ${taxes}
      ${taxAlertHtml}
      <div class="section" style="padding-left:0">${cestHtml}</div>
      ${relatedHtml}`);
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

  // ISS
  const issHtml = item.noISS
    ? '<div class="ncm-vig-item">ISS não se aplica (comércio/indústria)</div>'
    : (item.items || []).map(it => `<div class="ncm-vig-item"><strong>${it.item}</strong> — ${it.descItem}</div>`).join('');

  // NBS & Simples
  const key = onlyDigits(item.cnae);
  const nbsList = (window.NBS_MAP || {})[key] || [];
  const nbsHtml = nbsList.length
    ? nbsList.map(n => `<div class="ncm-vig-item"><strong>${n.codigo}</strong> — ${n.descricao}</div>`).join('')
    : '<div class="ncm-vig-item">Sem mapeamento NBS</div>';

  const simplesList = (window.SIMPLES_MAP || {})[key] || [];
  const simplesHtml = simplesList.length
    ? simplesList.map(s => `<div class="ncm-aliq-row"><span class="ncm-aliq-label">Anexo ${s.anexo}</span><span class="ncm-aliq-value">${s.aliquota}% (Fator R: ${s.fatorR})</span></div>`).join('')
    : '<div class="ncm-vig-item">Não consta no Simples</div>';

  const comparisonHtml = getRegimeComparison(item);

  const related = getRelatedCnaes(item).map((x) => ({ code: x.cnae, description: x.descCnae }));
  const relatedHtml = renderRelatedItems('CNAEs relacionados', related, formatCnae);

  result.innerHTML = renderResultCard(`${formatCnae(item.cnae)} — ${item.descCnae}`,
    `${hierarchy}<hr style="border-color:var(--border);margin:10px 0">
    <div class="ncm-body" style="border-top:none;grid-template-columns:1fr 1fr">
      <div class="ncm-col" style="padding-left:0">
        <div class="ncm-col-title"><span class="dot-green" style="width:7px;height:7px;border-radius:50%;display:inline-block;margin-right:5px;"></span>ISS (LC 116)</div>
        ${issHtml}
      </div>
      <div class="ncm-col" style="border-right:none">
        <div class="ncm-col-title"><span class="dot-orange" style="width:7px;height:7px;border-radius:50%;display:inline-block;margin-right:5px;"></span>Simples Nacional</div>
        ${simplesHtml}
      </div>
    </div>
    <div class="section" style="padding-left:0">
      <div class="ncm-col-title"><span style="width:7px;height:7px;border-radius:50%;background:var(--blue);display:inline-block;margin-right:5px;"></span>NBS Relacionados</div>
      ${nbsHtml}
    </div>
    ${comparisonHtml}
    ${relatedHtml}`);

  // Update simples value in comparison if available
  const simplesValDisplay = document.getElementById('tax-simples-val');
  if (simplesValDisplay && simplesList.length) {
    simplesValDisplay.innerText = `${simplesList[0].aliquota}%`;
  }

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
  if (type === 'cnae') {
    const items = searchCnaeByCode(query);
    if (items[0]) return renderCnae(items[0]);
  }

  result.innerHTML = '<div class="ncm-status"><span class="ncm-spin"></span>Buscando em NCM e CNAE...</div>';
  const [ncm, cnae] = await Promise.all([searchNcmByKeyword(query), Promise.resolve(searchCnaeByKeyword(query))]);

  const blocks = [];
  if (ncm.length) {
    ncm.slice(0, 3).forEach(x => {
      blocks.push(renderResultCard(`NCM ${formatNcm(x.codigo)}`, `<div class="ncm-desc">${x.descricao}</div><button class="ncm-ac-item" style="border:1px solid var(--border);margin-top:8px;padding:4px 10px;border-radius:4px" onclick="window.runGlobalSearch('${x.codigo}')">Ver detalhes</button>`));
    });
  }
  if (cnae.length) {
    cnae.slice(0, 3).forEach(x => {
      blocks.push(renderResultCard(`CNAE ${formatCnae(x.cnae)}`, `<div class="ncm-desc">${x.descCnae}</div><button class="ncm-ac-item" style="border:1px solid var(--border);margin-top:8px;padding:4px 10px;border-radius:4px" onclick="window.runGlobalSearch('${x.cnae}')">Ver detalhes</button>`));
    });
  }

  result.innerHTML = blocks.length ? blocks.join('') : '<div class="ncm-empty">Nenhum resultado encontrado para "' + query + '".</div>';
}
window.runGlobalSearch = runGlobalSearch;

let acTimer;
input.addEventListener('input', () => {
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

(function handleRoute() {
  const match = location.pathname.match(/^\/(ncm|cnae)\/(\d{7,8})$/);
  if (!match) return;
  input.value = match[2];
  runGlobalSearch(match[2]);
})();
