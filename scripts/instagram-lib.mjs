// Funções puras do robô do Instagram: filtro de compliance e geração do HTML dos cards.
// Sem dependências do Node, para poder ser testado também no navegador.

const START = '<!-- IG:START';
const END = '<!-- IG:END -->';

export function normalize(text) {
  return (text || '').normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();
}

// Termo só com letras e espaços: casa palavra inteira ("cura" não pega "curadoria").
// Termo com símbolo (ex.: "r$"): casa como trecho.
export function blockedTerm(caption, terms) {
  const text = normalize(caption);
  for (const raw of terms) {
    const term = normalize(raw);
    if (/^[a-z ]+$/.test(term)) {
      if (new RegExp(`(^|[^a-z0-9])${term}($|[^a-z0-9])`).test(text)) return raw;
    } else if (text.includes(term)) {
      return raw;
    }
  }
  return null;
}

export function isBlockedPost(media, blockedPosts) {
  return blockedPosts.some(b => b && (media.id === b || (media.permalink || '').includes(b)));
}

export function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

// Primeira linha com conteúdo, sem hashtags/menções soltas, cortada em palavra inteira.
export function captionSnippet(caption, max = 120) {
  const lines = (caption || '').split('\n')
    .map(l => l.replace(/(^|\s)[#@][\p{L}\p{N}_.]+/gu, ' ').replace(/\s+/g, ' ').trim())
    .filter(l => /[\p{L}\p{N}]/u.test(l));
  const first = lines[0] || '';
  if (first.length <= max) return first;
  const cut = first.slice(0, max);
  return cut.slice(0, cut.lastIndexOf(' ') > 40 ? cut.lastIndexOf(' ') : max).replace(/[\s,.;:]+$/, '') + '…';
}

export function formatDate(iso) {
  return new Date(iso).toLocaleDateString('pt-BR', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'America/Sao_Paulo' });
}

export function pickPosts(media, config) {
  const chosen = [];
  for (const m of media) {
    if (chosen.length >= config.quantidade) break;
    const image = m.media_type === 'VIDEO' ? m.thumbnail_url : m.media_url;
    if (!image) { console.log(`- pulando ${m.permalink}: sem imagem disponível`); continue; }
    if (isBlockedPost(m, config.postsBloqueados || [])) { console.log(`- pulando ${m.permalink}: está em postsBloqueados`); continue; }
    const term = blockedTerm(m.caption, config.termosBloqueados || []);
    if (term) { console.log(`- pulando ${m.permalink}: legenda contém "${term}"`); continue; }
    chosen.push({ ...m, image });
  }
  return chosen;
}

const ICON_VIDEO = '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M8 5.5v13l11-6.5z"/></svg>';
const ICON_ALBUM = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="7" y="7" width="13" height="13" rx="2"/><path d="M4 16V6a2 2 0 0 1 2-2h10"/></svg>';

export function renderPost(p, indent) {
  const snippet = captionSnippet(p.caption);
  const alt = `Post de @psi.cidpinheiro no Instagram${snippet ? ': ' + snippet : ''}`;
  const kind = p.media_type === 'VIDEO' ? `<span class="ig-kind" aria-label="Vídeo">${ICON_VIDEO}</span>`
    : p.media_type === 'CAROUSEL_ALBUM' ? `<span class="ig-kind" aria-label="Carrossel">${ICON_ALBUM}</span>` : '';
  return [
    `<a class="ig-post reveal" href="${escapeHtml(p.permalink)}" target="_blank" rel="noopener">`,
    `  <span class="ig-media"><img src="${escapeHtml(p.file)}" alt="${escapeHtml(alt)}" loading="lazy" decoding="async">${kind}</span>`,
    `  <span class="ig-body"><span class="ig-date">${escapeHtml(formatDate(p.timestamp))}</span>${snippet ? `<span class="ig-caption">${escapeHtml(snippet)}</span>` : ''}</span>`,
    `</a>`,
  ].map(l => indent + l).join('\n');
}

export function replaceBlock(html, posts) {
  const s = html.indexOf(START);
  const e = html.indexOf(END);
  if (s < 0 || e < s) throw new Error('Marcadores IG:START / IG:END não encontrados no index.html');
  const startLineEnd = html.indexOf('\n', s);
  const indent = html.slice(html.lastIndexOf('\n', s) + 1, s);
  const body = posts.map(p => renderPost(p, indent)).join('\n');
  return html.slice(0, startLineEnd + 1) + body + '\n' + indent + html.slice(e);
}
