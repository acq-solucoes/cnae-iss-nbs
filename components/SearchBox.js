export function renderSearchBox() {
  return `<section class="global-search"><label class="search-label" for="global-q">Busca global NCM/CNAE</label><div class="search-row"><input id="global-q" class="search-input" placeholder="Ex: 40117000, 4520-0/01, máquinas agrícolas..." autocomplete="off"/><button id="global-clear" class="btn-clear">Limpar</button></div><div id="global-ac" class="ncm-autocomplete" style="display:none"></div></section>`;
}
