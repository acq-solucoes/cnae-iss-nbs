function section(title, content) {
  return `<div class="section"><div class="section-title"><span class="dot dot-green"></span>${title}</div>${content}</div>`;
}

export function renderResultCard({ title, subtitle = '', sections = [] }) {
  const body = sections.map((s) => section(s.title, s.content)).join('');
  return `<article class="ncm-card"><div class="ncm-card-header"><span class="ncm-code">${title}</span><span class="ncm-desc">${subtitle}</span></div><div>${body}</div></article>`;
}
