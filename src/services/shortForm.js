// Short-form ("microblog") formats on Hive: Snaps, Waves, Threads, D.Buzz and
// Moments.
//
// All five are ordinary Hive `comment` operations — none of them use
// custom_json. What differs is *where* they hang and which metadata they carry:
//
//   snaps    PeakD   comments on `peak.snaps` container posts (hive-124838)
//   waves    Ecency  comments on `ecency.waves` container posts (hive-125125)
//   threads  InLeo   top-level posts tagged `inleo`/`leofinance` (hive-167922)
//   dbuzz    D.Buzz  top-level posts in hive-193084 marked `shortForm: true`
//   moments  Liketu  comments on `liketu.moments` container posts (hive-147010)
//
// Container-based formats publish one container per time window; the actual
// microblogs are its direct comments. Threads and D.Buzz publish a top-level
// post per microblog. This module keeps that knowledge in one place: the pure
// classifiers and builders here are shared by the reader UI, the composer and
// the tests.

import { byteLength } from '../utils/markdownEditor'
import { postMetadata } from './posts'

export const SHORT_FORM_FORMATS = ['snaps', 'waves', 'threads', 'dbuzz', 'moments']

/** Hive rejects bodies over 65,535 bytes; short posts cap far lower. */
export const MAX_SHORT_BODY_BYTES = 65535

/**
 * Per-format storage profile.
 *
 * `container` formats read a list of container posts and show their direct
 * comments; `feed` formats read a ranked post list directly. `community` is the
 * first tag / category a reply inherits when the format posts top-level.
 */
export const SHORT_FORMATS = {
  snaps: {
    id: 'snaps',
    label: 'Snaps',
    app: 'PeakD',
    icon: 'bolt',
    color: '#f5b83d',
    mode: 'container',
    containerAuthor: 'peak.snaps',
    containerPrefix: 'snap-container-',
    containerTag: 'snaps',
    community: 'hive-124838',
    tag: 'snaps',
    titleField: false,
    description: 'PeakD\'s image-first short posts. Each snap is a comment on a shared container post.'
  },
  waves: {
    id: 'waves',
    label: 'Waves',
    app: 'Ecency',
    icon: 'waves',
    color: '#3d9be9',
    mode: 'container',
    containerAuthor: 'ecency.waves',
    containerPrefix: 'waves-',
    containerTag: 'waves',
    community: 'hive-125125',
    tag: 'waves',
    titleField: false,
    description: 'Ecency\'s timeline of short posts. Each wave is a comment on a daily container.'
  },
  threads: {
    id: 'threads',
    label: 'Threads',
    app: 'InLeo',
    icon: 'forum',
    color: '#f7931a',
    mode: 'feed',
    community: 'hive-167922',
    tag: 'inleo',
    appTag: 'inleo',
    titleField: false,
    description: 'InLeo\'s microblog. Newer threads are top-level posts tagged #inleo; replies are comments.'
  },
  dbuzz: {
    id: 'dbuzz',
    label: 'D.Buzz',
    app: 'D.Buzz',
    icon: 'chat_bubble',
    color: '#e8453c',
    mode: 'feed',
    community: 'hive-193084',
    tag: 'dbuzz',
    appTag: 'dbuzz',
    shortFormMarker: true,
    titleField: false,
    description: 'D.Buzz\'s microblog. Posts live in the DBuzz community and are flagged shortForm.'
  },
  moments: {
    id: 'moments',
    label: 'Moments',
    app: 'Liketu',
    icon: 'photo_camera',
    color: '#8e6fd8',
    mode: 'container',
    containerAuthor: 'liketu.moments',
    containerPrefix: 'liketu-moments-',
    containerTag: 'liketu-moments',
    community: 'hive-147010',
    tag: 'moments',
    titleField: false,
    description: 'Liketu\'s photo moments. Each moment is a comment on a Liketu container.'
  }
}

export function shortFormatList () {
  return SHORT_FORM_FORMATS.map(id => SHORT_FORMATS[id])
}

export function getShortFormat (id) {
  return SHORT_FORMATS[id] || null
}

function isObject (value) {
  return value !== null && typeof value === 'object'
}

function asString (value) {
  return typeof value === 'string' ? value : ''
}

/** `app: 'leothreads/0.3'` → `'leothreads'` (lowercased, version stripped). */
function appName (metadata) {
  const app = asString(metadata && metadata.app).toLowerCase()
  return app.split(/[/@\s]/)[0]
}

function tagList (metadata) {
  const tags = metadata && metadata.tags
  return Array.isArray(tags) ? tags.filter(tag => typeof tag === 'string').map(tag => tag.toLowerCase()) : []
}

function parentPath (post) {
  const author = asString(post && post.parent_author).toLowerCase()
  const permlink = asString(post && post.parent_permlink).toLowerCase()
  return author ? author + '/' + permlink : ''
}

/** Watch for the container formats: any direct child of a known container author. */
const CONTAINER_FORMATS = SHORT_FORM_FORMATS.filter(id => SHORT_FORMATS[id].mode === 'container')

/**
 * Identify which short-form format a post belongs to.
 *
 * Inferred from content only (parent account, app name, tags and shortForm
 * marker), never from which feed the post was loaded in. Returns `null` for
 * ordinary posts and comments. `hint` is an optional format id used only as a
 * tie-breaker when several format signals match.
 */
export function detectShortForm (post, hint = null) {
  if (!isObject(post)) return null
  const metadata = postMetadata(post)
  const app = appName(metadata)
  const tags = tagList(metadata)
  const parentAuthor = asString(post.parent_author).toLowerCase()
  const parentPermlink = asString(post.parent_permlink).toLowerCase()
  const community = asString(post.category || post.community).toLowerCase()
  const score = Object.create(null)
  const add = (id, weight) => {
    if (!weight) return
    score[id] = (score[id] || 0) + weight
  }

  for (const id of CONTAINER_FORMATS) {
    const format = SHORT_FORMATS[id]
    if (parentAuthor && parentAuthor === format.containerAuthor) {
      add(id, 10)
      if (parentPermlink.startsWith(format.containerPrefix)) add(id, 4)
    }
  }

  // InLeo migrated threads from comments to top-level posts. Both shapes carry
  // the `leothreads` app name; older comments were parented to `leofinance`
  // thread containers.
  if (app === 'leothreads' || app === 'inleo') add('threads', 8)
  if (tags.includes('inleo')) add('threads', 4)
  if (tags.includes('leofinance') && app === 'leothreads') add('threads', 2)
  if (parentAuthor === 'leofinance' && /^threads?-/.test(parentPermlink)) add('threads', 6)

  if (metadata.shortForm === true) add('dbuzz', 8)
  if (app === 'dbuzz') add('dbuzz', 5)
  if (community === 'hive-193084') add('dbuzz', 3)

  if (app === 'peakd' && tags.includes('snaps')) add('snaps', 3)
  if (app === 'ecency' && metadata.type === 'wave') add('waves', 4)
  if (app === 'liketu' && tags.includes('liketu-moments')) add('moments', 4)

  const entries = Object.entries(score)
  if (!entries.length) return null
  entries.sort((a, b) => {
    if (b[1] !== a[1]) return b[1] - a[1]
    if (hint && a[0] === hint) return -1
    if (hint && b[0] === hint) return 1
    return 0
  })
  return entries[0][0]
}

/** True when a post is a top-level short-form post (not a container or reply). */
export function isTopLevelShortForm (post) {
  if (!isObject(post)) return false
  if (asString(post.parent_author)) return false
  return Boolean(detectShortForm(post))
}

/** True when the post is one of the periodical containers microblogs hang from. */
export function isShortFormContainer (post) {
  if (!isObject(post)) return false
  const author = asString(post.author).toLowerCase()
  const permlink = asString(post.permlink).toLowerCase()
  return CONTAINER_FORMATS.some(id => {
    const format = SHORT_FORMATS[id]
    return author === format.containerAuthor && (!permlink || permlink.startsWith(format.containerPrefix))
  })
}

/**
 * Classify a flat `bridge.get_discussion` map for a container post.
 *
 * Returns the container as `container` and its direct comments as `items`,
 * newest first. Nested replies stay out of the timeline but each item keeps its
 * own `children` count for the UI.
 */
export function containerTimeline (discussion, containerKey, { limit = 40 } = {}) {
  if (!isObject(discussion)) return { container: null, items: [] }
  const container = discussion[containerKey] || null
  let items
  if (container && Array.isArray(container.replies)) {
    items = container.replies.map(key => discussion[key]).filter(isObject)
  } else {
    // Fallback for a response without the root: keep direct children by depth.
    items = Object.values(discussion).filter(post =>
      isObject(post) && (Number(post.depth) === 1 || parentPath(post) === String(containerKey).toLowerCase())
    )
  }
  const sorted = items
    .filter(post => !post.stats?.gray && !post.stats?.hide)
    .sort((a, b) => Date.parse(b.created || '') - Date.parse(a.created || ''))
  return { container, items: limit ? sorted.slice(0, limit) : sorted }
}

/**
 * Strip HTML and collapse whitespace for a one-line card preview.
 * Images are dropped first so alt text and URLs do not leak into previews.
 */
export function shortPreview (body, max = 220) {
  const text = asString(body)
    .replace(/!\[[^\]]*\]\([^)]*\)/g, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/[#>*_~`]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  if (!max || text.length <= max) return text
  return text.slice(0, Math.max(0, max - 1)).trimEnd() + '…'
}

/** Image URLs declared in post metadata, in author order. */
export function shortImages (post) {
  const metadata = postMetadata(post)
  const images = Array.isArray(metadata.image) ? metadata.image : []
  return images.filter(url => typeof url === 'string' && /^https?:\/\//i.test(url))
}

const VIDEO_EXTENSION = /\.(?:mp4|webm|ogv|mov)(?:[?#]|$)/i

function cleanUrl (value) {
  const url = String(value || '').trim().replace(/^<|>$/g, '')
  if (!/^https?:\/\//i.test(url)) return ''
  return url.replace(/\|\d*x\d*$/, '')
}

/**
 * Media a short post embeds, de-duplicated and capped.
 *
 * Three sources cover the formats in practice: `json_metadata.image` (what
 * most front ends write), markdown `![alt](url)` and HTML `<img src>`.
 * Kind is inferred from the extension; GIF hosts such as Giphy have no
 * extension, so those are left as images. `count` is shared because bridge
 * returns a single positional array (`image_ratios`) for every image.
 */
export function shortMedia (post, { limit = 4 } = {}) {
  const metadata = postMetadata(post)
  const body = asString(post && post.body)
  const urls = []
  const seen = new Set()
  const add = value => {
    const url = cleanUrl(value)
    if (!url || seen.has(url) || urls.length >= limit * 2) return
    seen.add(url)
    urls.push(url)
  }

  const declared = Array.isArray(metadata.image) ? metadata.image : []
  declared.forEach(add)
  for (const match of body.matchAll(/!\[[^\]]*\]\(([^)\s]+)/g)) add(match[1])
  for (const match of body.matchAll(/<img[^>]+src=["']([^"']+)["']/gi)) add(match[1])

  const ratios = Array.isArray(metadata.image_ratios) ? metadata.image_ratios : []
  const media = urls.slice(0, limit).map((url, index) => {
    const kind = VIDEO_EXTENSION.test(url) ? 'video' : 'image'
    const parsed = Number(ratios[index])
    return {
      url,
      kind,
      position: index,
      count: Math.max(1, urls.length),
      // width / height when the author's client recorded it (0 when unknown).
      ratio: Number.isFinite(parsed) && parsed > 0 ? parsed : null
    }
  })
  return media
}

/** True when the post body embeds something in an iframe-friendly way. */
export function shortHasEmbed (post) {
  const body = asString(post && post.body)
  return /<iframe/i.test(body) || /(?:youtube\.com|youtu\.be|3speak\.tv|vimeo\.com)\//i.test(body)
}

/** Canonical web page for a short-form post, on its home front end. */
export function shortFormUrl (post, formatId = null) {
  if (!isObject(post)) return ''
  const author = asString(post.author)
  const permlink = asString(post.permlink)
  if (!author || !permlink) return ''
  const metadata = postMetadata(post)
  const canonical = asString(metadata.canonical_url || metadata.canonicalUrl)
  if (formatId === 'threads' && canonical.startsWith('https://')) return canonical
  return 'https://peakd.com/@' + author + '/' + permlink
}

/** Lowercase ASCII permlink with a short random suffix. */
export function shortFormPermlink ({ format, body, now = new Date(), random = Math.random } = {}) {
  const formatId = getShortFormat(format) ? format : 'snaps'
  const slug = shortPreview(body || '', 60)
    .normalize('NFKD')
    .replace(/[\u0300-\u036F]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40)
  if (formatId === 'threads') {
    const stamp = String((now instanceof Date ? now.getTime() : Number(now)) || Date.now()).toLowerCase()
    return (slug ? slug + '-' : 'thread-') + stamp.toString(36)
  }
  const suffix = Math.floor(Math.abs(Number(random())) * 0xffffffff).toString(16).padStart(8, '0')
  return 'hive-' + formatId + '-' + (slug ? slug + '-' : '') + suffix
}

function tagsFor (format, extraTags = []) {
  const community = format.community
  const seen = new Set()
  const tags = []
  for (const tag of [community, format.tag, ...extraTags]) {
    if (typeof tag !== 'string') continue
    const value = tag.trim().toLowerCase()
    if (!value || seen.has(value)) continue
    seen.add(value)
    tags.push(value)
  }
  return tags.slice(0, 8)
}

/**
 * Build the `[username, 'posting', op]` queue item for a new short-form post.
 *
 * Container formats (snaps, waves, moments) post a comment on a container
 * post: the container author/permlink come from `parent`. Threads and D.Buzz
 * post top-level; replies to any format target the parent post directly.
 */
export function shortFormQueueItem ({
  format,
  username,
  body,
  permlink,
  parent = null,
  reply = null,
  app = 'hive.ausbit.dev',
  now = new Date(),
  random = Math.random
} = {}) {
  const profile = getShortFormat(format)
  if (!profile) throw new Error('Unknown short-form format: ' + format)

  const author = asString(username).trim().toLowerCase()
  if (!/^[a-z][a-z0-9.-]{2,15}$/.test(author)) {
    throw new Error('A valid Hive account is required to post.')
  }
  const text = asString(body).trim()
  if (!text) throw new Error('Write something before posting.')
  const bytes = byteLength(text)
  if (bytes > MAX_SHORT_BODY_BYTES) {
    throw new Error('The body is ' + bytes + ' bytes; the Hive limit is ' + MAX_SHORT_BODY_BYTES + '.')
  }

  const postPermlink = asString(permlink).trim() || shortFormPermlink({ format: profile.id, body: text, now, random })
  if (!/^[a-z0-9][a-z0-9-]{0,254}$/.test(postPermlink)) throw new Error('The permlink is not valid.')

  const target = reply && isObject(reply) ? reply : null
  const container = profile.mode === 'container' ? parent : null
  if (profile.mode === 'container' && !target && !container) {
    throw new Error(profile.label + ' posts need a container to reply to.')
  }

  const metadata = {
    app,
    format: 'markdown',
    tags: tagsFor(profile)
  }
  if (profile.id === 'threads') metadata.type = 'post'
  if (profile.id === 'dbuzz') metadata.shortForm = true
  if (profile.id === 'waves') metadata.type = 'wave'

  const parentAuthor = target
    ? asString(target.author).toLowerCase()
    : container
      ? asString(container.author).toLowerCase()
      : ''
  const parentPermlink = target
    ? asString(target.permlink).toLowerCase()
    : container
      ? asString(container.permlink).toLowerCase()
      : profile.community

  if (!parentPermlink) throw new Error('A parent permlink is required.')
  if (/[^a-z0-9-]/.test(parentPermlink) || !/^[a-z0-9]/.test(parentPermlink)) {
    throw new Error('The parent permlink is not valid.')
  }

  const operation = {
    parent_author: parentAuthor,
    parent_permlink: parentPermlink,
    author,
    permlink: postPermlink,
    title: '',
    body: text,
    json_metadata: JSON.stringify(metadata)
  }

  // Top-level posts (and only those) carry reward options. Comments inherit
  // their parent's payout settings, so comment_options is not sent for them.
  if (!parentAuthor) {
    operation.comment_options = {
      author,
      permlink: postPermlink,
      max_accepted_payout: '1000000.000 HBD',
      percent_hbd: 10000,
      allow_votes: true,
      allow_curation_rewards: true
    }
  }

  return [author, 'posting', ['comment', operation]]
}

/** A one-line summary for the signing queue. */
export function shortFormQueueSummary (item) {
  const op = Array.isArray(item) && Array.isArray(item[2]) ? item[2] : []
  if (op[0] !== 'comment' || !isObject(op[1])) return ''
  const data = op[1]
  return data.parent_author
    ? 'Reply to @' + data.parent_author + '/' + data.permlink
    : 'Post to ' + (data.parent_permlink || 'Hive')
}

// -- Engagement queue items ---------------------------------------------------
//
// Short posts are ordinary Hive posts, so the same posting-key operations work.
// These mirror the shapes used by components/vote.vue and components/reblog.vue.

/**
 * Vote queue item. `direction` is `up`, `down` or `clear`; `percent` is the
 * 0..100 weight shown in the UI and is multiplied by 100 for the chain.
 */
export function shortFormVoteQueueItem ({ username, post, direction = 'up', percent = 100 } = {}) {
  const voter = asString(username).trim().toLowerCase()
  const author = asString(post && post.author).trim().toLowerCase()
  const permlink = asString(post && post.permlink).trim()
  if (!/^[a-z][a-z0-9.-]{2,15}$/.test(voter)) throw new Error('A valid Hive account is required to vote.')
  if (!author || !permlink) throw new Error('A post is required to vote.')
  const weight = direction === 'clear'
    ? 0
    : direction === 'down'
      ? -Math.round(Math.abs(Number(percent) || 0) * 100)
      : Math.round(Math.abs(Number(percent) || 0) * 100)
  return [voter, 'posting', ['vote', { voter, weight, author, permlink }]]
}

/** Reblog or un-reblog a post (the `follow` custom_json convention). */
export function shortFormReblogQueueItem ({ username, post, remove = false } = {}) {
  const account = asString(username).trim().toLowerCase()
  const author = asString(post && post.author).trim().toLowerCase()
  const permlink = asString(post && post.permlink).trim()
  if (!/^[a-z][a-z0-9.-]{2,15}$/.test(account)) throw new Error('A valid Hive account is required to reblog.')
  if (!author || !permlink) throw new Error('A post is required to reblog.')
  const payload = [remove ? 'unreblog' : 'reblog', { account, author, permlink }]
  return [account, 'posting', ['custom_json', {
    required_posting_auths: [account],
    id: 'follow',
    json: JSON.stringify(payload)
  }]]
}

// -- Chain reads --------------------------------------------------------------
//
// Thin I/O wrappers over the shared JSON-RPC client. Each takes an optional
// `request` so callers and tests can inject a stub instead of hitting a node.

async function defaultRequest (method, params, options) {
  const { bridgeRequest, rpcRequest } = await import('./api')
  return method.startsWith('bridge.')
    ? bridgeRequest(method.slice('bridge.'.length), params, options)
    : rpcRequest(method, params, options)
}

/** Hive's bridge rejects ranked-post limits outside 1..20. */
const RANKED_LIMIT = 20



async function containerPosts (request, profile, limit, options) {
  const posts = await request('bridge.get_account_posts', { sort: 'posts', account: profile.containerAuthor, limit }, options)
  return (Array.isArray(posts) ? posts : []).filter(post => String(post.permlink || '').startsWith(profile.containerPrefix))
}


function isThreadPost (post) {
  return detectShortForm(post, 'threads') === 'threads' && !String(post.parent_author || '')
}

/**
 * D.Buzz marks its short posts with `shortForm: true` and the `dBuzz` app.
 * The DBuzz community also hosts regular long-form posts tagged `hive-193084`;
 * those have neither marker and are excluded from the microblog feed.
 */
function isDbuzzPost (post) {
  if (detectShortForm(post, 'dbuzz') !== 'dbuzz') return false
  const metadata = postMetadata(post)
  return metadata.shortForm === true || appName(metadata) === 'dbuzz'
}

/**
 * Read a short-form feed.
 *
 * `sort` is `new` (created) or `top` (trending by payout). Threads and D.Buzz
 * read ranked posts directly; container formats read the newest containers.
 */
export async function fetchShortFormFeed (format, { sort = 'new', limit = 20, observer = '', request = defaultRequest } = {}) {
  const page = await fetchShortFormPage(format, { sort, limit, observer, request })
  return page.items
}

/**
 * One page of a short-form feed, with a cursor for the next page.
 *
 * Container formats walk containers newest-first, continuing inside the
 * current container before opening the next. Ranked feeds (Threads, D.Buzz)
 * page with `start_author` / `start_permlink`, skipping a boundary post that
 * the previous page already returned.
 *
 * Returns `{ items, cursor, done }`. `cursor` is opaque JSON - pass it back as
 * `cursor` to continue; `done` means no more items exist.
 */
export async function fetchShortFormPage (format, { sort = 'new', limit = 20, observer = '', request = defaultRequest, cursor = null } = {}) {
  const profile = getShortFormat(format)
  if (!profile) throw new Error('Unknown short-form format: ' + format)
  const wanted = Math.max(1, Math.min(50, Number(limit) || 20))
  const state = cursor ? parseCursor(cursor) : null
  const rankedSort = sort === 'top' ? 'trending' : 'created'

  if (profile.mode === 'container') {
    return containerPage(request, profile, { wanted, observer, state, sort })
  }

  const accept = profile.id === 'threads'
    ? isThreadPost
    : post => isDbuzzPost(post) && !String(post.parent_author || '')
  const tag = profile.id === 'threads' ? 'inleo' : profile.community
  return rankedPage(request, tag, rankedSort, wanted, accept, state)
}

function parseCursor (cursor) {
  try {
    const parsed = typeof cursor === 'string' ? JSON.parse(cursor) : cursor
    return parsed && typeof parsed === 'object' ? parsed : null
  } catch {
    return null
  }
}

async function rankedPage (request, tag, sort, wanted, accept, state) {
  const items = []
  let startAuthor = (state && state.skip && state.startAuthor) || ''
  let startPermlink = (state && state.skip && state.startPermlink) || ''
  let skipFirst = Boolean(state && state.skip)

  for (let page = 0; page < 4 && items.length < wanted; page++) {
    const params = { sort, tag, limit: RANKED_LIMIT }
    if (startPermlink) {
      params.start_author = startAuthor
      params.start_permlink = startPermlink
    }
    const batch = await request('bridge.get_ranked_posts', params)
    if (!Array.isArray(batch) || batch.length === 0) {
      return { items, cursor: null, done: true }
    }
    for (const post of batch) {
      if (skipFirst) {
        skipFirst = false
        continue
      }
      if (accept(post)) items.push(post)
    }
    const last = batch[batch.length - 1]
    const shortPage = batch.length < RANKED_LIMIT
    if (!last || (last.author === startAuthor && last.permlink === startPermlink)) {
      return { items, cursor: null, done: true }
    }
    startAuthor = last.author
    startPermlink = last.permlink
    if (items.length >= wanted) {
      return {
        items: items.slice(0, wanted),
        cursor: JSON.stringify({ startAuthor: last.author, startPermlink: last.permlink, skip: true }),
        done: false
      }
    }
    if (shortPage) return { items, cursor: null, done: true }
  }

  return {
    items: items.slice(0, wanted),
    cursor: startPermlink ? JSON.stringify({ startAuthor, startPermlink, skip: true }) : null,
    done: items.length < wanted
  }
}

/**
 * Container formats: `state.containers` lists container permlinks seen and
 * `state.current` is the container still being walked, with the created time
 * of the last item returned so ordering survives a reload.
 */
async function containerPage (request, profile, { wanted, observer, state, sort }) {
  const seen = new Set((state && state.containers) || [])
  const items = []
  let current = state && state.current ? state.current : null
  let pages = 0
  const maxContainers = 6

  while (items.length < wanted && pages < maxContainers) {
    pages++
    if (!current) {
      const containers = await containerPosts(request, profile, maxContainers + seen.size)
      const next = containers.find(post => !seen.has(post.permlink))
      if (!next) break
      current = { author: next.author, permlink: next.permlink, title: next.title, cursor: '' }
      seen.add(next.permlink)
    }

    const discussion = await request('bridge.get_discussion', {
      author: current.author,
      permlink: current.permlink,
      observer
    })
    const key = current.author + '/' + current.permlink
    const timeline = containerTimeline(discussion, key, { limit: 0 })
    let ordered = timeline.items
    if (sort === 'top') {
      ordered = ordered.slice().sort((a, b) => Number(b.pending_payout_value && parseFloat(b.pending_payout_value) || 0) - Number(a.pending_payout_value && parseFloat(a.pending_payout_value) || 0))
    }
    const from = current.cursor ? ordered.findIndex(post => post.author + '/' + post.permlink === current.cursor) + 1 : 0
    const slice = ordered.slice(from, from + (wanted - items.length))
    const decorated = slice.map(post => ({
      ...post,
      _container: { author: current.author, permlink: current.permlink, title: current.title }
    }))
    items.push(...decorated)

    if (slice.length > 0) {
      const last = slice[slice.length - 1]
      current = { ...current, cursor: last.author + '/' + last.permlink }
    }
    const exhausted = from + slice.length >= ordered.length || ordered.length === 0
    if (exhausted) current = null
    if (items.length >= wanted) break
  }

  const done = !current && items.length === 0 && seen.size > 0
  return {
    items,
    cursor: done ? null : JSON.stringify({ containers: [...seen], current }),
    done
  }
}

/**
 * Read one short-form post and its reply tree.
 * Returns `{ root, replies }` where `replies` are flattened depth-tagged
 * comments, or `null` when the post cannot be read.
 */
export async function fetchShortFormPost (author, permlink, { observer = '', request = defaultRequest } = {}) {
  const root = await request('bridge.get_post', { author, permlink, observer })
  if (!root || !root.author) return null
  const discussion = await request('bridge.get_discussion', { author, permlink, observer })
  const key = root.author + '/' + root.permlink
  const replies = []
  const visit = (node, depth) => {
    const children = Array.isArray(node && node.replies) ? node.replies : []
    for (const childKey of children) {
      const child = discussion && discussion[childKey]
      if (!child) continue
      replies.push({ ...child, _depth: depth })
      visit(child, depth + 1)
    }
  }
  if (discussion && discussion[key]) visit(discussion[key], 1)
  return { root, replies, format: detectShortForm(root) }
}

export { isThreadPost, isDbuzzPost }
