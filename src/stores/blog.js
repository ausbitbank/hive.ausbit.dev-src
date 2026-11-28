// Blog tenant state for a `<label>.banksia.io` host.
//
// The store resolves the host once, loads the owning account and its on-chain
// blog settings, then reads the account's posts (plus any curated authors or
// community). It never writes directly: claim and save actions queue normal
// posting-key `account_update2` operations for the existing signing stack.

import { defineStore } from 'pinia'
import { LocalStorage } from 'quasar'
import { BLOG_APEX_URL } from 'src/config/blog'
import { fetchAccount, fetchAccountPosts, fetchPostContent, fetchRankedPosts } from 'src/services/chainData'
import { parseAccountMetadata } from 'src/services/accountMetadata'
import { claimBlog, defaultBlogBlocks, readBlogSettings, updateBlog } from 'src/services/blogSettings'
import { apexAccountUrl, blogBaseUrl, blogSettingsUrl, encodeBlogLabel, resolveBlogHost } from 'src/services/blogHost'
import { isBlogPost, sortBlogPosts } from 'src/services/blogPosts'
import { readAccountTheme } from 'src/themes/account'
import { resolveBlogTheme } from 'src/themes/blogThemes'
import { quasarVarsFor, shapeVarsFor, themeModeOf, tokensFor } from 'src/themes/tokens'
import { useAppearanceStore } from 'src/stores/appearance'
import { useHiveStore } from 'src/stores/hive'

const PAGE_SIZE = 20
// Contributors are an addition to the owner archive, not a replacement, so
// their first page stays small; each source pages forward independently.
const CONTRIBUTOR_PAGE_SIZE = 10
const BLOG_MODE_KEY = 'banksia:blog-mode'

const TYPOGRAPHY_STACKS = {
  serif: 'Georgia, "Iowan Old Style", "Palatino Linotype", "Book Antiqua", serif',
  sans: 'Roboto, "Helvetica Neue", Helvetica, Arial, sans-serif',
  mono: 'ui-monospace, SFMono-Regular, Menlo, Consolas, "Liberation Mono", monospace'
}

function readModePreference () {
  try {
    const value = LocalStorage.getItem(BLOG_MODE_KEY)
    return value === 'light' || value === 'dark' ? value : 'auto'
  } catch {
    return 'auto'
  }
}

function profileFromAccount (account) {
  if (!account) return {}
  const posting = parseAccountMetadata(account.posting_json_metadata).value.profile
  const legacy = parseAccountMetadata(account.json_metadata).value.profile
  return {
    ...(legacy && typeof legacy === 'object' ? legacy : {}),
    ...(posting && typeof posting === 'object' ? posting : {})
  }
}

function isAllowedPost (post, accountName, settings) {
  if (!post || !post.author) return false
  if (String(post.author).toLowerCase() === String(accountName).toLowerCase()) return true
  const authors = Array.isArray(settings?.authors) ? settings.authors : []
  if (authors.includes(String(post.author).toLowerCase())) return true
  const community = settings?.community
  if (community && (post.community === community || post.category === community)) return true
  return false
}

/**
 * The feeds that make up one blog archive. Each source keeps its own cursor so
 * a contributor or community page can never stop the owner archive from
 * paging, and vice versa.
 */
function blogSources (accountName, settings, claimed) {
  const owner = {
    key: 'owner',
    kind: 'account',
    account: accountName,
    limit: PAGE_SIZE
  }
  const authors = Array.isArray(settings && settings.authors) ? settings.authors : []
  const community = (settings && settings.community) || ''
  // An unclaimed blog is a single-account preview: the on-chain authors and
  // community fields are not trusted until the owner claims the blog.
  if (!claimed || (!authors.length && !community)) return [owner]

  const sources = [owner]
  for (const author of authors) {
    const name = String(author || '').toLowerCase()
    if (!name || name === accountName) continue
    sources.push({
      key: 'author:' + name,
      kind: 'account',
      account: name,
      limit: CONTRIBUTOR_PAGE_SIZE
    })
  }
  if (community) {
    sources.push({
      key: 'community:' + community,
      kind: 'community',
      tag: community,
      limit: PAGE_SIZE
    })
  }
  return sources
}

function sourceParams (source, cursor, observer) {
  const params = source.kind === 'community'
    ? { sort: 'created', tag: source.tag, observer, limit: source.limit }
    : { sort: 'posts', account: source.account, observer, limit: source.limit }
  if (cursor) {
    params.start_author = cursor.start_author
    params.start_permlink = cursor.start_permlink
  }
  return params
}

function fetchSourcePage (source, cursor, observer, { force = false } = {}) {
  const params = sourceParams(source, cursor, observer)
  return source.kind === 'community'
    ? fetchRankedPosts(params, { force })
    : fetchAccountPosts(params, { force })
}

/** Cursor from the raw page, not the filtered cards, so hidden rows step too. */
function pageCursor (rows) {
  for (let index = rows.length - 1; index >= 0; index--) {
    const row = rows[index]
    if (row && row.author && row.permlink) {
      return { start_author: row.author, start_permlink: row.permlink }
    }
  }
  return null
}

export const useBlogStore = defineStore('blog', {
  state: () => ({
    initialized: false,
    host: '',
    label: '',
    accountName: '',
    account: null,
    settings: null,
    claimed: false,
    settingsError: '',
    loading: false,
    error: '',
    posts: [],
    postsLoading: false,
    postsError: '',
    loadPromise: null,
    hasMore: false,
    sources: [],
    modePreference: readModePreference(),
    pending: false,
    pendingText: ''
  }),

  getters: {
    isBlog: (state) => Boolean(state.accountName),
    hostLabel: (state) => {
      const label = encodeBlogLabel(state.accountName)
      return label ? label + '.banksia.io' : ''
    },
    baseUrl: (state) => blogBaseUrl(state.accountName),
    settingsUrl: (state) => blogSettingsUrl(state.accountName),
    apexAccountUrl: (state) => apexAccountUrl(state.accountName),
    apexUrl: () => BLOG_APEX_URL,
    rssUrl: (state) => (state.accountName ? blogBaseUrl(state.accountName) + '/rss.xml' : ''),
    profile (state) {
      return profileFromAccount(state.account)
    },
    title (state) {
      const settings = state.settings
      const profile = profileFromAccount(state.account)
      return (settings && settings.title) || profile.name || state.accountName || 'Hive blog'
    },
    description (state) {
      const settings = state.settings
      const profile = profileFromAccount(state.account)
      return (settings && settings.description) || profile.about || ''
    },
    avatar (state) {
      const profile = profileFromAccount(state.account)
      const image = typeof profile.profile_image === 'string' ? profile.profile_image.trim() : ''
      if (/^https:\/\//i.test(image)) return image
      return state.accountName ? 'https://images.hive.blog/u/' + state.accountName + '/avatar' : ''
    },
    cover (state) {
      const profile = profileFromAccount(state.account)
      const image = typeof profile.cover_image === 'string' ? profile.cover_image.trim() : ''
      return /^https:\/\//i.test(image) ? image : ''
    },
    ogImage (state) {
      const value = state.settings && state.settings.ogImage
      return typeof value === 'string' && /^https:\/\//i.test(value) ? value : ''
    },
    website (state) {
      const profile = profileFromAccount(state.account)
      const value = typeof profile.website === 'string' ? profile.website.trim() : ''
      return /^https?:\/\//i.test(value) ? value : ''
    },
    location (state) {
      const profile = profileFromAccount(state.account)
      return typeof profile.location === 'string' ? profile.location : ''
    },
    about (state) {
      const profile = profileFromAccount(state.account)
      return typeof profile.about === 'string' ? profile.about : ''
    },
    joined (state) {
      return (state.account && state.account.created) || ''
    },
    accountTheme (state) {
      if (!state.account) return null
      return readAccountTheme(state.account).theme
    },
    theme (state) {
      return resolveBlogTheme(state.settings || {}, this.accountTheme)
    },
    viewerMode () {
      if (this.modePreference === 'light' || this.modePreference === 'dark') return this.modePreference
      const authorMode = this.settings && this.settings.mode
      if (authorMode === 'light' || authorMode === 'dark') return authorMode
      if (typeof window !== 'undefined' && typeof window.matchMedia === 'function') {
        return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
      }
      return this.theme && this.theme.mode === 'dark' ? 'dark' : 'light'
    },
    themeStyle () {
      const appearance = useAppearanceStore()
      const mode = this.viewerMode
      const style = {
        ...tokensFor(this.theme, { highContrast: appearance.highContrast, mode }),
        ...quasarVarsFor(this.theme, { mode }),
        ...shapeVarsFor(this.theme)
      }
      const typography = this.typography
      if (TYPOGRAPHY_STACKS[typography]) {
        style['--font-body'] = TYPOGRAPHY_STACKS[typography]
        style['--font-display'] = TYPOGRAPHY_STACKS[typography]
      }
      return style
    },
    mode () {
      return themeModeOf(this.theme, this.viewerMode)
    },
    modeSwitchable () {
      return Boolean(this.theme && this.theme.variants &&
        (this.theme.variants.light || this.theme.variants.dark))
    },
    motion () {
      const appearance = useAppearanceStore()
      return appearance.motion === 'reduced' || appearance.skinEffects === 'calm' ? 'reduced' : 'full'
    },
    layout () {
      return (this.settings && this.settings.layout) || 'grid'
    },
    width () {
      return (this.settings && this.settings.width) || 'comfortable'
    },
    typography () {
      return (this.settings && this.settings.typography) || 'theme'
    },
    hero () {
      return (this.settings && this.settings.hero) || 'cover'
    },
    showTags () {
      return !this.settings || this.settings.showTags !== false
    },
    showReadingTime () {
      return !this.settings || this.settings.showReadingTime !== false
    },
    navLinks () {
      return Array.isArray(this.settings && this.settings.nav) ? this.settings.nav : []
    },
    blocks () {
      const blocks = this.settings && this.settings.blocks
      return Array.isArray(blocks) ? blocks : defaultBlogBlocks()
    },
    customCss () {
      return (this.settings && this.settings.css) || ''
    },
    logo () {
      const custom = this.settings && this.settings.logo
      if (typeof custom === 'string' && /^https:\/\//i.test(custom)) return custom
      return this.avatar
    },
    heroImage () {
      const custom = this.settings && this.settings.heroImage
      if (typeof custom === 'string' && /^https:\/\//i.test(custom)) return custom
      return this.cover
    },
    favicon () {
      const value = this.settings && this.settings.favicon
      return typeof value === 'string' && /^https:\/\//i.test(value) ? value : ''
    },
    portfolio () {
      const value = this.settings && this.settings.portfolio
      return value && typeof value === 'object'
        ? value
        : { enabled: false, title: 'Portfolio', description: '', layout: 'grid', items: [] }
    },
    shop () {
      const value = this.settings && this.settings.shop
      return value && typeof value === 'object'
        ? value
        : { enabled: false, title: 'Shop', description: '' }
    },
    portfolioEnabled () {
      return Boolean(this.portfolio.enabled)
    },
    shopEnabled () {
      return Boolean(this.shop.enabled)
    },
    vault () {
      const value = this.settings && this.settings.vault
      return value && typeof value === 'object' ? value : null
    },
    vaultEnabled () {
      return Boolean(this.vault && this.vault.enabled && this.vault.product)
    },
    vaultProductPath () {
      const product = this.vault && this.vault.product
      return product ? '/@' + product : ''
    },
    vaultSubscribeUrl (state) {
      const product = this.vault && this.vault.product
      if (!product || !state.accountName) return ''
      return BLOG_APEX_URL + '/subscribe?blog=' + encodeURIComponent(state.accountName) +
        '&product=' + encodeURIComponent(product)
    },
    canEdit () {
      const hive = useHiveStore()
      return Boolean(this.accountName && hive.user.username === this.accountName)
    },
    pinnedPermlinks (state) {
      return Array.isArray(state.settings?.pinned) ? state.settings.pinned : []
    },
    pinnedPosts (state) {
      const pinned = new Set(this.pinnedPermlinks)
      return state.posts.filter(post => pinned.has(String(post.permlink).toLowerCase()))
    },
    archivePosts (state) {
      const pinned = new Set(this.pinnedPermlinks)
      return state.posts.filter(post => !pinned.has(String(post.permlink).toLowerCase()))
    },
    postCount (state) {
      return state.posts.length
    }
  },

  actions: {
    setModePreference (value) {
      const next = value === 'light' || value === 'dark' ? value : 'auto'
      this.modePreference = next
      try {
        if (next === 'auto') LocalStorage.remove(BLOG_MODE_KEY)
        else LocalStorage.set(BLOG_MODE_KEY, next)
      } catch {
        // Private mode or blocked storage; the in-memory preference still works.
      }
    },

    init (hostname) {
      const resolved = resolveBlogHost(hostname)
      if (resolved.mode !== 'blog' || !resolved.account) {
        this.error = 'This host is not a Banksia blog.'
        return Promise.resolve(false)
      }
      if (this.initialized && this.host === resolved.host && this.accountName === resolved.account) {
        return Promise.resolve(true)
      }
      this.reset()
      this.host = resolved.host
      this.label = resolved.label
      this.accountName = resolved.account
      this.initialized = true
      return this.load()
    },

    reset () {
      this.initialized = false
      this.host = ''
      this.label = ''
      this.accountName = ''
      this.account = null
      this.settings = null
      this.claimed = false
      this.settingsError = ''
      this.loading = false
      this.error = ''
      this.posts = []
      this.postsLoading = false
      this.postsError = ''
      this.loadPromise = null
      this.hasMore = false
      this.sources = []
      this.pending = false
      this.pendingText = ''
    },

    async load (options = {}) {
      if (!this.accountName) return false
      // Direct visits race the layout's account read: the post page calls
      // loadPost() as soon as it is created. Share the in-flight tenant load so
      // the settings are known before a contributor/community post is judged.
      if (!this.loadPromise) {
        const run = this.loadInternal(options)
        this.loadPromise = run
        run.then(
          () => { if (this.loadPromise === run) this.loadPromise = null },
          () => { if (this.loadPromise === run) this.loadPromise = null }
        )
      }
      return this.loadPromise
    },

    async loadInternal ({ force = false } = {}) {
      if (!this.accountName) return false
      this.loading = true
      this.error = ''
      try {
        const account = await fetchAccount(this.accountName, { force })
        if (!account) {
          this.error = 'This Hive account could not be loaded.'
          return false
        }
        this.account = account
        const read = readBlogSettings(account)
        this.settings = read.settings
        this.claimed = read.claimed
        this.settingsError = read.error || ''
        await this.loadPosts({ force })
        return true
      } catch (error) {
        this.error = error && error.message ? error.message : 'The blog could not be loaded.'
        return false
      } finally {
        this.loading = false
      }
    },

    async loadPosts ({ force = false } = {}) {
      if (!this.accountName) return []
      this.postsLoading = true
      this.postsError = ''
      try {
        const settings = this.settings || {}
        const authors = Array.isArray(settings.authors) ? settings.authors : []
        const hive = useHiveStore()
        const observer = hive.user.username || ''

        this.sources = blogSources(this.accountName, settings, this.claimed)
        const batches = await Promise.allSettled(
          this.sources.map(source => fetchSourcePage(source, null, observer, { force }))
        )

        const rows = []
        batches.forEach((batch, index) => {
          const source = this.sources[index]
          const page = batch.status === 'fulfilled' && Array.isArray(batch.value) ? batch.value : []
          rows.push(...page)
          source.cursor = pageCursor(page)
          source.hasMore = Boolean(source.cursor) && page.length >= source.limit
        })
        this.hasMore = this.claimed && this.sources.some(source => source.hasMore)

        let ordered = sortBlogPosts(rows.filter(isBlogPost), settings.pinned)
        // Pinned posts may be older than the page window. Fetch any that are
        // missing so an author's "start here" link always resolves.
        const pinned = Array.isArray(settings.pinned) ? settings.pinned : []
        if (pinned.length) {
          const known = new Set(ordered.map(post => String(post.permlink).toLowerCase()))
          const missing = pinned.filter(permlink => !known.has(String(permlink).toLowerCase()))
          if (missing.length) {
            // A pinned permlink can belong to a curated contributor, not only
            // the blog owner. Try the owner and every configured author, and
            // keep the same post filter the feed uses so a comment, Vault
            // container or product is not injected as hero content.
            const candidates = [...new Set([this.accountName, ...authors]
              .map(name => String(name || '').toLowerCase())
              .filter(Boolean))]
            const extra = await Promise.all(missing.map(async permlink => {
              for (const author of candidates) {
                const found = await fetchPostContent(author, permlink, { force }).catch(() => null)
                if (found && isBlogPost(found)) return found
              }
              return null
            }))
            ordered = sortBlogPosts([...ordered, ...extra.filter(Boolean)], pinned)
          }
        }

        this.posts = ordered
        return this.posts
      } catch (error) {
        this.postsError = error && error.message ? error.message : 'Posts could not be loaded.'
        this.posts = []
        return []
      } finally {
        this.postsLoading = false
      }
    },

    async loadMore () {
      if (!this.hasMore || this.postsLoading) return []
      const pending = this.sources.filter(source => source.hasMore && source.cursor)
      if (!pending.length) {
        this.hasMore = false
        return []
      }
      this.postsLoading = true
      try {
        const hive = useHiveStore()
        const observer = hive.user.username || ''
        const batches = await Promise.allSettled(
          pending.map(source => fetchSourcePage(source, source.cursor, observer))
        )
        const added = []
        batches.forEach((batch, index) => {
          // A failed source keeps its cursor so the next click retries it
          // instead of silently ending that part of the archive.
          if (batch.status !== 'fulfilled' || !Array.isArray(batch.value)) return
          const source = pending[index]
          const page = batch.value
          added.push(...page.filter(isBlogPost))
          source.cursor = pageCursor(page)
          source.hasMore = Boolean(source.cursor) && page.length >= source.limit
        })
        this.hasMore = this.claimed && this.sources.some(source => source.hasMore)
        if (added.length) {
          this.posts = sortBlogPosts([...this.posts, ...added], this.settings?.pinned)
        }
        return added
      } catch (error) {
        this.postsError = error && error.message ? error.message : 'More posts could not be loaded.'
        return []
      } finally {
        this.postsLoading = false
      }
    },

    async loadPost (permlink, { author = '', force = false } = {}) {
      if (!this.accountName || !permlink) return null
      // The blog page can create before the layout finishes the tenant read.
      // Wait for it so a contributor/community post is not rejected against an
      // empty settings object.
      if (!this.settings && this.loadPromise) {
        try { await this.loadPromise } catch {}
      }
      const authorName = String(author || this.accountName).toLowerCase()
      const cached = this.posts.find(post =>
        String(post.permlink).toLowerCase() === String(permlink).toLowerCase() &&
        String(post.author).toLowerCase() === authorName
      )
      let post
      try {
        post = await fetchPostContent(authorName, permlink, { force })
      } catch {
        return null
      }
      if (!post || !isBlogPost(post)) return null
      if (!isAllowedPost(post, this.accountName, this.settings)) {
        // Community feeds and curated contributor lists may not expose the
        // community/category field on every row. If the post is already in the
        // loaded blog feed, it is allowed to open.
        const listed = this.posts.some(item =>
          String(item.permlink).toLowerCase() === String(post.permlink).toLowerCase() &&
          String(item.author).toLowerCase() === String(post.author).toLowerCase()
        )
        if (!listed) return null
      }
      return cached && cached.body ? cached : post
    },

    claim (patch = {}) {
      if (!this.account) return { ok: false, error: 'The account is not loaded.' }
      const hive = useHiveStore()
      if (hive.user.username !== this.accountName) {
        return { ok: false, error: 'Sign in as @' + this.accountName + ' to claim this blog.' }
      }
      const result = claimBlog(this.account, {
        title: this.settings?.title,
        description: this.settings?.description,
        theme: this.settings?.theme,
        ...patch
      })
      if (!result.ok || !result.operation) return result
      hive.addToQueue([this.accountName, 'posting', result.operation])
      this.pending = true
      this.pendingText = result.text
      return result
    },

    save (patch = {}) {
      if (!this.account) return { ok: false, error: 'The account is not loaded.' }
      const hive = useHiveStore()
      if (hive.user.username !== this.accountName) {
        return { ok: false, error: 'Sign in as @' + this.accountName + ' to edit this blog.' }
      }
      const result = updateBlog(this.account, { ...this.settings, ...patch })
      if (!result.ok || !result.operation) return result
      hive.addToQueue([this.accountName, 'posting', result.operation])
      this.pending = true
      this.pendingText = result.text
      return result
    }
  }
})
