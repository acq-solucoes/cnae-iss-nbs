export function renderSearchBox() {
  return `
    <section class="global-search" style="margin-bottom:32px; position:relative;">
      <label class="search-label" for="global-q" style="display:flex; justify-content:space-between; align-items:center;">
        <span>Busca Unificada <small style="color:var(--muted); font-weight:normal; margin-left:8px;">NCM, CNAE, ISS, NBS</small></span>
      </label>
      <div class="search-row" style="position:relative;">
        <input id="global-q" class="search-input" placeholder="Digite código ou descrição... (Ex: 40117000, Café, 6201500)" autocomplete="off" style="padding-right:100px; width:100%;" />
        <button id="global-clear" class="btn-clear" style="position:absolute; right:8px; top:50%; transform:translateY(-50%); height:32px; padding:0 12px; font-size:10px; text-transform:uppercase;">Limpar</button>
      </div>
      <div id="global-ac" class="ncm-autocomplete" style="display:none; width:100%; top:100%;"></div>
    </section>
  `;
}
