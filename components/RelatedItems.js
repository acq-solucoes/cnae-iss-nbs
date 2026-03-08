export function renderRelatedItems(title, items = [], formatter = (x) => x) {
  if (!items.length) return `<div class="no-nbs">Nenhum relacionado encontrado.</div>`;
  return `<div><div class="section-title nbs-title"><span class="dot dot-blue"></span>${title}</div><div class="nbs-list">${items.map((it) => `<div class="nbs-item"><span class="nbs-badge">${formatter(it.code)}</span><span class="nbs-desc">${it.description}</span></div>`).join('')}</div></div>`;
}
