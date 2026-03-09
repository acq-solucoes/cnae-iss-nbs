import { detectSearchType, onlyDigits } from './utils/validators.js';
import { formatNcm, formatCnae, parseNcmHierarchy, parseCnaeHierarchy } from './utils/formatters.js';
import { searchNcmByCode, searchNcmByKeyword, autocompleteNcm, getRelatedNcms } from './services/ncmService.js';
import { searchCnaeByCode, searchCnaeByKeyword, autocompleteCnae, getRelatedCnaes } from './services/cnaeService.js';
import { lookupCest } from './services/cestService.js';
import { renderSearchBox } from './components/SearchBox.js';
import { renderResultCard } from './components/ResultCard.js';
import { renderHierarchyView } from './components/HierarchyView.js';
import { renderRelatedItems } from './components/RelatedItems.js';
import { interpretActivity } from './services/openaiService.js';

const hero = document.querySelector('.wrap');
const tabBar = document.querySelector('.tab-bar');
const cnaeSec = document.getElementById('cnae-section');
const ncmSec = document.getElementById('ncm-section');

if (tabBar) tabBar.style.display = 'none';
if (cnaeSec) cnaeSec.style.display = 'none';
if (ncmSec) ncmSec.style.display = 'none';

// CSS para garantir que o layout antigo não apareça e o novo seja fluido e premium
const style = document.createElement('style');
style.textContent = `
  .tab-bar, #cnae-section, #ncm-section, .view-switch { display: none !important; }
  .wrap { max-width: 900px !important; margin: 0 auto !important; }
  .ncm-ac-item { cursor: pointer; transition: background 0.2s; padding: 12px; border-bottom: 1px solid var(--border); }
  .ncm-ac-item:hover { background: rgba(139, 92, 246, 0.08); color: var(--violet-hi); }
  .ai-badge { animation: pulse 2s infinite; }
  @keyframes pulse { 0% { opacity: 0.6; } 50% { opacity: 1; } 100% { opacity: 0.6; } }
  #global-result { padding-bottom: 50px; }
`;
document.head.appendChild(style);

const host = document.createElement('div');
host.style.cssText = 'transition: all 0.3s ease; margin-bottom: 40px; margin-top: 20px;';
host.innerHTML = `${renderSearchBox()}<div id="global-result" style="min-height:200px; transition: opacity 0.3s ease;"></div>`;
hero.insertBefore(host, tabBar || hero.firstChild);

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
  const digits = onlyDigits(code);
  result.innerHTML = '<div class="ncm-status"><span class="ncm-spin"></span>Processando NCM ' + formatNcm(digits) + '...</div>';
  try {
    const items = await searchNcmByCode(digits);
    const item = items[0];
    if (!item) {
      result.innerHTML = '<div class="ncm-empty">NCM não localizado em nossa base oficial. Verifique se o código está correto.</div>';
      return;
    }
    const h = parseNcmHierarchy(item.codigo, item.descricao);

    // Melhora na descrição: Se o IBPT trouxer uma descrição específica, usamos ela. Caso contrário, a do BrasilAPI.
    // Também garantimos que a descrição seja amigável.
    const displayDesc = (item.descricao || 'Descrição não informada').toUpperCase();

    const hierarchy = renderHierarchyView([
      { label: 'Capítulo', value: h.capitulo.descricao ? `${h.capitulo.codigo} — ${h.capitulo.descricao}` : h.capitulo.codigo },
      { label: 'Posição', value: h.posicao.descricao ? `${h.posicao.codigo} — ${h.posicao.descricao}` : h.posicao.codigo },
      { label: 'Subposição', value: h.subposicao.descricao ? `${h.subposicao.codigo} — ${h.subposicao.descricao}` : h.subposicao.codigo },
      { label: 'Vigência', value: `Início em ${item.data_inicio || '01/04/2022'}` },
    ]);

    const cest = lookupCest(item.codigo);
    const cestHtml = cest.length
      ? cest.map((c) => `<div class="ncm-vig-item" style="color:var(--orange-hi)"><strong>CEST ${c.cest}</strong> — ${c.segmento}</div>`).join('')
      : '<div class="ncm-vig-item" style="opacity:0.6">NCM não sujeito à ST (Sem CEST mapeado)</div>';

    // Formatação de alíquotas com fallback seguro para 0%
    const aliq = (val) => (val !== undefined && val !== null) ? `${Number(val).toFixed(2)}%` : '0,00%';

    const taxes = `
      <div style="display:grid; grid-template-columns: repeat(4, 1fr); gap:10px; margin-top:15px; background:rgba(255,255,255,0.02); padding:12px; border-radius:8px; border:1px solid var(--border)">
        <div style="text-align:center"><div style="font-size:10px; color:var(--muted); text-transform:uppercase">II (Imp.)</div><div style="font-size:14px; font-weight:bold">${aliq(item.aliquota_ii)}</div></div>
        <div style="text-align:center"><div style="font-size:10px; color:var(--muted); text-transform:uppercase">IPI</div><div style="font-size:14px; font-weight:bold">${aliq(item.aliquota_ipi)}</div></div>
        <div style="text-align:center"><div style="font-size:10px; color:var(--muted); text-transform:uppercase">PIS</div><div style="font-size:14px; font-weight:bold">${aliq(item.aliquota_pis)}</div></div>
        <div style="text-align:center"><div style="font-size:10px; color:var(--muted); text-transform:uppercase">COFINS</div><div style="font-size:14px; font-weight:bold">${aliq(item.aliquota_cofins)}</div></div>
      </div>`;

    const taxAlertHtml = item.is_monofasico
      ? `<div style="margin-top:12px; padding:10px; background:rgba(217, 70, 239, 0.08); border:1px solid var(--violet-lo); border-radius:6px;">
          <strong style="color:var(--violet-hi); font-size:11px;">⚠️ REGIME MONOFÁSICO / BENEFÍCIO</strong>
          <p style="margin:4px 0 0; font-size:11px; color:var(--muted)">${item.obs || 'Verifique a legislação vigente para este item.'}</p>
         </div>`
      : '';

    result.innerHTML = renderResultCard(`${formatNcm(item.codigo)} — ${displayDesc}`,
      `${hierarchy}
      ${taxes}
      <div style="margin-top:20px;">
        <h4 style="font-size:11px; color:var(--muted); text-transform:uppercase; margin-bottom:10px; border-bottom:1px solid var(--border); padding-bottom:5px">Substituição Tributária / Legal</h4>
        ${cestHtml}
      </div>
      ${taxAlertHtml}
      <div style="margin-top:20px; padding-top:10px; border-top:1px dashed var(--border); font-size:10px; color:var(--muted); display:flex; justify-content:space-between;">
        <span>Fonte: ${item.fonte || 'Receita Federal / IBPT'}</span>
        <span>${item.desc_ibpt ? '✓ Descrição Oficial IBPT' : ''}</span>
      </div>`);

    setSeo('ncm', item.codigo, displayDesc);
    pushRoute('ncm', item.codigo);
  } catch (e) {
    console.error(e);
    result.innerHTML = '<div class="ncm-empty">Ocorreu um erro ao buscar os detalhes deste NCM. Tente novamente em instantes.</div>';
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
    { label: 'Classe', value: `${h.classe.codigo} — ${h.classe.descricao}` },
    { label: 'CNAE', value: item.cnae },
  ]);

  const issHtml = (item.items || []).length
    ? item.items.map((it) => `<div class="iss-item">
        <span class="iss-badge">Subitem ${it.idIss}</span> 
        <span class="iss-desc">${it.descItem}</span>
      </div>`).join('')
    : '<div class="no-iss">Sem correlação direta com a LC 116/03 mapeada.</div>';

  const simplesHtml = (item.simples || []).length
    ? item.simples.map((s) => `<div class="simples-row">
        <span class="simples-badge">Anexo ${s.anexo}</span>
        <span class="simples-pill pill-fatorr-${s.fatorR ? 'sim' : 'nao'}">Fator R: ${s.fatorR ? 'Sim' : 'Não'}</span>
        <span class="simples-pill pill-aliquota">Aliq. inicial: ${s.aliqIni}</span>
      </div>`).join('')
    : '<div class="no-simples">Atividade não permitida ou sem enquadramento direto no Simples Nacional.</div>';

  const related = getRelatedCnaes(item).map((x) => ({ code: x.cnae, description: x.descCnae }));
  const relatedHtml = renderRelatedItems('CNAEs Relacionados (Mesma Classe)', related, formatCnae);

  result.innerHTML = renderResultCard(`${formatCnae(item.cnae)} — ${item.descCnae.toUpperCase()}`,
    `${hierarchy}
    <div style="display:grid; grid-template-columns:1fr 1fr; gap:20px; margin-top:20px;">
      <div class="section" style="padding-left:0; border-right:1px solid var(--border); padding-right:15px">
        <h4 style="font-size:10px; color:var(--muted); text-transform:uppercase; margin-bottom:12px;">Serviços (ISS/LC 116)</h4>
        ${issHtml}
      </div>
      <div class="section" style="padding-left:0">
        <h4 style="font-size:10px; color:var(--muted); text-transform:uppercase; margin-bottom:12px;">Simples Nacional</h4>
        ${simplesHtml}
      </div>
    </div>
    <div style="margin-top:20px; border-top:1px solid var(--border); padding-top:15px">
      ${relatedHtml}
    </div>
    <div style="margin-top:20px; padding-top:10px; border-top:1px dashed var(--border); font-size:10px; color:var(--muted); display:flex; justify-content:space-between;">
      <span>Fonte: CONCLA / Receita Federal</span>
      <span>Base: CNAE 2.3 / Simples Nac. 2024</span>
    </div>`);

  setSeo('cnae', item.cnae, item.descCnae);
  pushRoute('cnae', item.cnae);
}

async function runGlobalSearch(value) {
  const query = String(value || '').replace(/[.\-/ ]/g, '').trim();
  if (!query) {
    result.innerHTML = '';
    return;
  }

  const type = detectSearchType(query);
  if (type === 'ncm' && query.length >= 8) {
    result.style.opacity = '1';
    return renderNcm(query);
  }
  if (type === 'cnae' && query.length >= 7) {
    const items = searchCnaeByCode(query);
    if (items[0]) {
      result.style.opacity = '1';
      return renderCnae(items[0]);
    }
  }

  // Busca por Texto / Semântica
  const localCnae = searchCnaeByKeyword(query);
  const localNcm = await searchNcmByKeyword(query);

  if (!localCnae.length && !localNcm.length) {
    result.innerHTML = '<div class="ncm-empty">Buscando inteligência avançada para "' + query + '"...</div>';
  } else {
    result.innerHTML = '<div class="ncm-results-header" style="font-size:11px; color:var(--muted); margin-bottom:15px; border-bottom:1px solid var(--border); padding-bottom:8px">Resultados Oficiais (CNAE/NCM)</div>';
    localCnae.slice(0, 5).forEach((item) => {
      const div = document.createElement('div');
      div.className = 'ncm-ac-item';
      div.style.marginBottom = '8px';
      div.innerHTML = `<span class="ncm-ac-code" style="color:var(--green)">CNAE ${formatCnae(item.cnae)}</span><span class="ncm-ac-desc">${item.descCnae}</span>`;
      div.onclick = () => renderCnae(item);
      result.appendChild(div);
    });
    localNcm.slice(0, 5).forEach((item) => {
      const div = document.createElement('div');
      div.className = 'ncm-ac-item';
      div.style.marginBottom = '8px';
      div.innerHTML = `<span class="ncm-ac-code">NCM ${formatNcm(item.codigo)}</span><span class="ncm-ac-desc">${item.descricao}</span>`;
      div.onclick = () => renderNcm(item.codigo);
      result.appendChild(div);
    });
  }

  if (query.length > 3) {
    const aiLoading = document.createElement('div');
    aiLoading.id = 'ai-loading';
    aiLoading.innerHTML = '<div class="ncm-status"><span class="ncm-spin"></span>Consultando Interpretador de Atividades (IA)...</div>';
    result.appendChild(aiLoading);

    try {
      const suggestions = await interpretActivity(query);
      if (aiLoading) aiLoading.remove();

      if (suggestions && suggestions.length > 0) {
        const aiHeader = document.createElement('div');
        aiHeader.innerHTML = '<div class="ncm-results-header" style="font-size:11px; color:var(--violet-hi); margin:20px 0 10px; border-bottom:1px solid var(--violet-lo); padding-bottom:8px; display:flex; align-items:center; gap:8px"><span class="ai-badge" style="background:var(--violet); color:#000; padding:2px 6px; border-radius:3px; font-weight:bold">IA</span> Sugestões Interpretadas</div>';
        result.appendChild(aiHeader);

        suggestions.forEach(s => {
          const item = searchCnaeByCode(s.codigo)[0];
          if (item) {
            const div = document.createElement('div');
            div.className = 'ncm-ac-item';
            div.style.borderLeft = '2px solid var(--violet)';
            div.style.background = 'rgba(139, 92, 246, 0.05)';
            div.style.marginBottom = '10px';
            div.innerHTML = `
              <div style="flex:1">
                <div style="display:flex; justify-content:space-between">
                  <span class="ncm-ac-code" style="color:var(--violet-hi)">CNAE ${formatCnae(item.cnae)}</span>
                  <span style="font-size:9px; color:var(--violet-hi); background:rgba(139,92,246,0.1); padding:1px 4px; border-radius:2px">Confiança: ${s.confianca}%</span>
                </div>
                <div class="ncm-ac-desc" style="white-space:normal; font-weight:bold; color:var(--text)">${item.descCnae}</div>
                <div style="font-size:10px; color:var(--muted); margin-top:4px; font-style:italic"><strong>Por que?</strong> ${s.justificativa}</div>
              </div>
            `;
            div.onclick = () => renderCnae(item);
            result.appendChild(div);
          }
        });
      }
    } catch (e) {
      console.error("AI Error:", e);
      if (aiLoading) aiLoading.remove();
    }
  }
}
window.runGlobalSearch = runGlobalSearch;

let acTimer;
input.addEventListener('input', () => {
  const v = input.value.trim();
  const digits = onlyDigits(v);

  // Regra de Usabilidade: Se o usuário digitou ou colou um código completo, abre direto
  if (digits.length === 8 || digits.length === 7) {
    clearTimeout(acTimer);
    ac.style.display = 'none';
    runGlobalSearch(v);
    return;
  }

  clearTimeout(acTimer);
  acTimer = setTimeout(async () => {
    const q = input.value.trim();
    if (!q) {
      result.innerHTML = '';
      ac.style.display = 'none';
      return;
    }
    const [ncm, cnae] = await Promise.all([autocompleteNcm(q), Promise.resolve(autocompleteCnae(q))]);
    const merged = [...cnae.map((x) => ({ label: `CNAE ${formatCnae(x.cnae)}`, value: x.cnae })), ...ncm.map((x) => ({ label: `NCM ${formatNcm(x.codigo)}`, value: x.codigo }))].slice(0, 8);
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
