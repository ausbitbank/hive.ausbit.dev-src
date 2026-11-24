export const MARKER = '<!-- hive:metadata-only-prerender -->'
export const META_TEMPLATE_FILE = '__meta.html'

// Routes prerendered by scripts/prerender.mjs. The nginx config in
// deploy/nginx/hive.ausbit.dev.conf must serve each one with a real 200 and
// its own metadata shell; a missing entry makes direct navigation return the
// 404 shell (a title flash of "Page not found" before Vue mounts).
export const PRERENDER_ROUTES = [
  '/',
  '/blocks',
  '/trending',
  '/created',
  '/hot',
  '/communities',
  '/witnesses',
  '/witness',
  '/proposals',
  '/hbd',
  '/market',
  '/markets',
  '/health',
  '/nodes',
  '/magi',
  '/create',
  '/hbdstabilizer',
  '/compose',
  '/search',
  '/lightning',
  '/appearance',
  '/themes',
  '/settings/skin',
  '/settings/moderation',
  '/404',
  // Microblog index and the five formats. Their metadata is client-rendered,
  // so they get real prerendered shells instead of the generic 404 shell.
  '/shorts',
  '/shorts/snaps',
  '/shorts/waves',
  '/shorts/threads',
  '/shorts/dbuzz',
  '/shorts/moments'
]

export function escapeHtml (value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
}

function escapeRegExp (value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

// Vite minifies the built shell and drops optional attribute quotes, so the
// matchers must accept `name=description`, `name="description"` and
// `name='description'` alike. `(?=[\s>])` keeps `name=description` from also
// matching a longer attribute value such as `og:description`.
function attributePattern (attribute, value) {
  const clean = escapeRegExp(value)
  return '\\b' + attribute + '\\s*=\\s*(?:"' + clean + '"|\'' + clean + '\'|' + clean + '(?=[\\s>]))'
}

function insertInHead (html, tag) {
  return html.replace('</head>', '  ' + tag + '\n  </head>')
}

// Replace the first matching tag and remove any duplicates left by an earlier
// injector. The page must expose exactly one canonical/description/OG tag.
function replaceTag (html, pattern, tag) {
  const expression = new RegExp(pattern, 'gi')
  let found = false
  let kept = false
  const next = html.replace(expression, () => {
    found = true
    if (kept) return ''
    kept = true
    return tag
  })
  return found ? next : insertInHead(html, tag)
}

function replaceMeta (html, attribute, key, content, { raw = false } = {}) {
  if (content === undefined || content === null || content === '') return html
  const value = raw ? content : escapeHtml(content)
  const tag = '<meta ' + attribute + '="' + escapeHtml(key) + '" content="' + value + '">'
  const pattern = '<meta\\b[^>]*' + attributePattern(attribute, key) + '[^>]*>'
  return replaceTag(html, pattern, tag)
}

function replaceLink (html, rel, href, { raw = false } = {}) {
  if (!href) return html
  const value = raw ? href : escapeHtml(href)
  const tag = '<link rel="' + escapeHtml(rel) + '" href="' + value + '">'
  const pattern = '<link\\b[^>]*' + attributePattern('rel', rel) + '[^>]*>'
  return replaceTag(html, pattern, tag)
}

function removeLink (html, rel) {
  const pattern = '<link\\b[^>]*' + attributePattern('rel', rel) + '[^>]*>'
  return html.replace(new RegExp(pattern, 'gi'), '')
}

function replaceTitle (html, title, { raw = false } = {}) {
  if (!title) return html
  const value = raw ? title : escapeHtml(title)
  return replaceTag(html, '<title[^>]*>[\\s\\S]*?</title>', '<title>' + value + '</title>')
}

function removeJsonLd (html) {
  const pattern = '<script\\b[^>]*' + attributePattern('type', 'application/ld+json') + '[^>]*>[\\s\\S]*?</script>'
  return html.replace(new RegExp(pattern, 'gi'), '')
}

const SEO_LINKS = [
  ['/', 'Home'],
  ['/created', 'Browse posts'],
  ['/blocks', 'Blocks'],
  ['/witnesses', 'Witnesses'],
  ['/proposals', 'Proposals'],
  ['/markets', 'Markets'],
  ['/health', 'Network health'],
  ['/nodes', 'API nodes'],
  ['/magi', 'Magi contracts']
]

/**
 * A small static body inside the mount element. Vue replaces it on mount, but
 * crawlers and link previews that do not run JavaScript still get an h1, a
 * summary and a real internal link graph. `ssi` marks values that are nginx
 * variables rather than text to escape.
 */
function bodySkeleton (title, description, { ssi = false } = {}) {
  const heading = ssi ? title : escapeHtml(title)
  const text = ssi ? description : escapeHtml(description)
  const links = SEO_LINKS
    .map(([href, label]) => '<li><a href="' + href + '">' + label + '</a></li>')
    .join('')
  return '<div id="q-app"><main data-seo-shell style="max-width:960px;margin:0 auto;padding:2rem 1rem;font-family:system-ui,sans-serif">' +
    '<h1>' + heading + '</h1><p>' + text + '</p>' +
    '<nav aria-label="Explorer sections"><ul style="display:flex;flex-wrap:wrap;gap:0.5rem 1rem;padding:0;list-style:none">' + links + '</ul></nav>' +
    '</main></div>'
}

function applyBodySkeleton (html, title, description, { ssi = false } = {}) {
  if (!title || !description) return html
  const pattern = /<div\b[^>]*\bid=(?:"q-app"|'q-app'|q-app)[^>]*>\s*<\/div>/i
  if (!pattern.test(html)) return html
  return html.replace(pattern, bodySkeleton(title, description, { ssi }))
}

/**
 * Apply route metadata to the original SPA shell without copying any rendered
 * body. The shell's mount element and script tags stay exactly as built.
 */
export function applyMetadata (shell, metadata) {
  let html = replaceTitle(shell, metadata.title)
  html = replaceMeta(html, 'name', 'description', metadata.description)
  html = replaceLink(html, 'canonical', metadata.canonical)
  html = replaceMeta(html, 'name', 'robots', metadata.robots)
  if (String(metadata.robots || '').toLowerCase().includes('noindex')) {
    html = removeLink(html, 'canonical')
  }
  html = replaceMeta(html, 'property', 'og:title', metadata.ogTitle)
  html = replaceMeta(html, 'property', 'og:description', metadata.ogDescription)
  html = replaceMeta(html, 'property', 'og:url', metadata.ogUrl)
  html = replaceMeta(html, 'property', 'og:image', metadata.ogImage)
  html = replaceMeta(html, 'property', 'og:type', metadata.ogType)
  html = replaceMeta(html, 'name', 'twitter:card', metadata.twitterCard)
  html = replaceMeta(html, 'name', 'twitter:title', metadata.twitterTitle)
  html = replaceMeta(html, 'name', 'twitter:description', metadata.twitterDescription)
  html = replaceMeta(html, 'name', 'twitter:image', metadata.twitterImage)
  html = removeJsonLd(html)
  if (metadata.jsonLd) {
    html = html.replace('</head>', '  <script type="application/ld+json">' + metadata.jsonLd + '</script>\n  </head>')
  }
  html = applyBodySkeleton(html, metadata.title, metadata.description)
  if (!html.includes(MARKER)) html = html.replace('<head>', '<head>\n  ' + MARKER)
  return html
}

function ssi (variable, fallback) {
  return '<!--# echo var="' + variable + '" default="' + escapeHtml(fallback) + '" -->'
}

/**
 * Build the nginx SSI template used for unbounded dynamic routes (accounts,
 * posts, blocks, transactions, tags and tokens). The reverse proxy sets the
 * `page_*` variables after validating the URL segments, so crawlers get a
 * route-specific title and canonical even though the SPA data is client-side.
 */
export function buildMetadataTemplate (shell, { title, description, type = 'website', image = 'https://hive.ausbit.dev/statics/icons/icon-512x512.png' } = {}) {
  if (!title || !description) throw new Error('metadata template needs a default title and description')

  const pageTitle = ssi('page_title', title)
  const pageDescription = ssi('page_description', description)
  const pagePath = ssi('page_path', '/')
  const pageType = ssi('page_type', type)
  const pageImage = ssi('page_image', image)

  let html = replaceTitle(shell, pageTitle, { raw: true })
  html = replaceMeta(html, 'name', 'description', pageDescription, { raw: true })
  html = replaceLink(html, 'canonical', 'https://hive.ausbit.dev' + pagePath, { raw: true })
  html = replaceMeta(html, 'property', 'og:title', pageTitle, { raw: true })
  html = replaceMeta(html, 'property', 'og:description', pageDescription, { raw: true })
  html = replaceMeta(html, 'property', 'og:url', 'https://hive.ausbit.dev' + pagePath, { raw: true })
  html = replaceMeta(html, 'property', 'og:image', pageImage, { raw: true })
  html = replaceMeta(html, 'property', 'og:type', pageType, { raw: true })
  html = replaceMeta(html, 'name', 'twitter:title', pageTitle, { raw: true })
  html = replaceMeta(html, 'name', 'twitter:description', pageDescription, { raw: true })
  html = replaceMeta(html, 'name', 'twitter:image', pageImage, { raw: true })
  html = removeJsonLd(html)
  html = applyBodySkeleton(html, pageTitle, pageDescription, { ssi: true })
  return html
}
