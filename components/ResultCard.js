export function renderResultCard(title, body) {
  return `
    <article class="ncm-card" style="margin-bottom:16px; border-left:4px solid var(--green);">
      <div class="ncm-card-header" style="background:var(--surface2); padding:16px;">
        <span class="ncm-code" style="font-size:16px;">${title}</span>
      </div>
      <div class="section" style="padding:16px; background:var(--surface);">
        ${body}
      </div>
    </article>
  `;
}
