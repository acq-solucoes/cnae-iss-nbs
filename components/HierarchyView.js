export function renderHierarchyView(items = []) {
  return `<div class="iss-list">${items.map((row) => `<div class="iss-item"><span class="iss-badge">${row.label}</span><span class="iss-desc">${row.value}</span></div>`).join('')}</div>`;
}
