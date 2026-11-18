export const MARKER = '<!-- hive:metadata-only-prerender -->'

export function escapeHtml (value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
}

function replaceMeta (html, attribute, key, content) {
  if (content === undefined || content === null || content === '') return html
  const tag = '<meta ' + attribute + '="' + escapeHtml(key) + '" content="' + escapeHtml(content) + '">'
  const pattern = new RegExp('<meta[^>]*' + attribute + '="' + key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '"[^>]*>', 'i')
  if (pattern.test(html)) return html.replace(pattern, tag)
  return html.replace('</head>', '  ' + tag + '\n  </head>')
}

function replaceLink (html, rel, href) {
  if (!href) return html
  const tag = '<link rel="' + escapeHtml(rel) + '" href="' + escapeHtml(href) + '">'
  const pattern = new RegExp('<link[^>]*rel="' + rel + '"[^>]*>', 'i')
  if (pattern.test(html)) return html.replace(pattern, tag)
  return html.replace('</head>', '  ' + tag + '\n  </head>')
}

/**
 * Apply route metadata to the original SPA shell without copying any rendered
 * body. The shell's mount element and script tags stay exactly as built.
 */
export function applyMetadata (shell, metadata) {
  let html = shell.replace(/<title>[\s\S]*?<\/title>/i, '<title>' + escapeHtml(metadata.title) + '</title>')
  html = replaceMeta(html, 'name', 'description', metadata.description)
  html = replaceLink(html, 'canonical', metadata.canonical)
  html = replaceMeta(html, 'property', 'og:title', metadata.ogTitle)
  html = replaceMeta(html, 'property', 'og:description', metadata.ogDescription)
  html = replaceMeta(html, 'property', 'og:url', metadata.ogUrl)
  html = replaceMeta(html, 'property', 'og:image', metadata.ogImage)
  html = replaceMeta(html, 'property', 'og:type', metadata.ogType)
  html = replaceMeta(html, 'name', 'twitter:card', metadata.twitterCard)
  html = replaceMeta(html, 'name', 'twitter:title', metadata.twitterTitle)
  html = replaceMeta(html, 'name', 'twitter:description', metadata.twitterDescription)
  html = replaceMeta(html, 'name', 'twitter:image', metadata.twitterImage)
  html = html.replace(/\s*<script type="application\/ld\+json">[\s\S]*?<\/script>/gi, '')
  if (metadata.jsonLd) {
    html = html.replace('</head>', '  <script type="application/ld+json">' + metadata.jsonLd + '</script>\n  </head>')
  }
  if (!html.includes(MARKER)) html = html.replace('<head>', '<head>\n  ' + MARKER)
  return html
}
