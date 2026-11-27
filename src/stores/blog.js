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
import { claimBlog, readBlogSettings, updateBlog } from 'src/services/blogSettings'
import { apexAccountUrl, blogBaseUrl, blogSettingsUrl, encodeBlogLabel, resolveBlogHost } from 'src/services/blogHost'
import { isBlogPost, sortBlogPosts } from 'src/services/blogPosts'
import { readAccountTheme } from 'src/themes/account'
import { resolveBlogTheme } from 'src/themes/blogThemes'
import { quasarVarsFor, shapeVarsFor, themeModeOf, tokensFor } from 'src/themes/tokens'
import { useAppearanceStore } from 'src/stores/appearance'
import { useHiveStore } from 'src/stores/hive'

const PAGE_SIZE = 20
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
    hasMore: false,
    cursor: null,
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
      this.hasMore = false
      this.cursor = null
      this.pending = false
      this.pendingText = ''
    },

    async load ({ force = false } = {}) {
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
        const community = settings.community || ''
        const hive = useHiveStore()
        const observer = hive.user.username || ''
        const sources = []

        // A claimed multi-author or community blog merges its sources. An
        // unclaimed blog stays a single-account preview.
        if (!this.claimed || (!authors.length && !community)) {
          sources.push(fetchAccountPosts({
            sort: 'posts',
            account: this.accountName,
            observer,
            limit: PAGE_SIZE,
            start_author: null,
            start_permlink: null
          }, { force }))
        } else {
          sources.push(fetchAccountPosts({
            sort: 'posts',
            account: this.accountName,
            observer,
            limit: PAGE_SIZE,
            start_author: null,
            start_permlink: null
          }, { force }))
          for (const author of authors) {
            if (author === this.accountName) continue
            sources.push(fetchAccountPosts({
              sort: 'posts',
              account: author,
              observer,
              limit: 10,
              start_author: null,
              start_permlink: null
            }, { force }))
          }
          if (community) {
            sources.push(fetchRankedPosts({
              sort: 'created',
              tag: community,
              observer,
              limit: PAGE_SIZE,
              start_author: null,
              start_permlink: null
            }, { force }))
          }
        }

        const batches = await Promise.allSettled(sources)
        const rows = batches
          .filter(batch => batch.status === 'fulfilled' && Array.isArray(batch.value))
          .flatMap(batch => batch.value)
          .filter(isBlogPost)

        const primary = batches[0] && batches[0].status === 'fulfilled' ? batches[0].value : []
        const last = Array.isArray(primary) && primary.length ? primary[primary.length - 1] : null
        this.cursor = last ? { start_author: last.author, start_permlink: last.permlink } : null
        this.hasMore = this.claimed && !authors.length && !community && Array.isArray(primary) && primary.length >= PAGE_SIZE

        let ordered = sortBlogPosts(rows, settings.pinned)
        // Pinned posts may be older than the page window. Fetch any that are
        // missing so an author's "start here" link always resolves.
        const pinned = Array.isArray(settings.pinned) ? settings.pinned : []
        if (pinned.length) {
          const known = new Set(ordered.map(post => String(post.permlink).toLowerCase()))
          const missing = pinned.filter(permlink => !known.has(String(permlink).toLowerCase()))
          if (missing.length) {
            const extra = await Promise.all(missing.map(permlink =>
              fetchPostContent(this.accountName, permlink, { force }).catch(() => null)
            ))
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
      if (!this.hasMore || !this.cursor || this.postsLoading) return []
      this.postsLoading = true
      try {
        const hive = useHiveStore()
        const rows = await fetchAccountPosts({
          sort: 'posts',
          account: this.accountName,
          observer: hive.user.username || '',
          limit: PAGE_SIZE,
          start_author: this.cursor.start_author,
          start_permlink: this.cursor.start_permlink
        })
        const page = Array.isArray(rows) ? rows.filter(isBlogPost) : []
        const last = page.length ? page[page.length - 1] : null
        if (last) this.cursor = { start_author: last.author, start_permlink: last.permlink }
        this.hasMore = page.length >= PAGE_SIZE
        this.posts = sortBlogPosts([...this.posts, ...page], this.settings?.pinned)
        return page
      } catch (error) {
        this.postsError = error && error.message ? error.message : 'More posts could not be loaded.'
        return []
      } finally {
        this.postsLoading = false
      }
    },

    async loadPost (permlink, { author = '', force = false } = {}) {
      if (!this.accountName || !permlink) return null
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
