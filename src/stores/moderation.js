// Viewer moderation policy and context.
//
// The pure rules live in `services/moderationPolicy.js`, settings schema in
// `services/moderationSettings.js`, and chain reads in
// `services/moderationData.js`. This store only keeps the reactive snapshot
// and the local override actions.

import { defineStore } from 'pinia'
import {
  decideSkin,
  normalizeName,
  SKIN_DEFAULT_SETTINGS
} from 'src/services/moderationPolicy'
import { decideContent } from 'src/services/moderationContent'
import {
  defaultModerationPolicy,
  parseModerationExport,
  readModerationPolicy,
  serializeModerationExport,
  writeModerationPolicy,
  scopeFor
} from 'src/services/moderationSettings'
import { fetchViewerModerationContext } from 'src/services/moderationData'

export const MODERATION_CONTEXT_KEY_PREFIX = 'hive:moderation:context:v1:'
export const MODERATION_CONTEXT_TTL_MS = 10 * 60 * 1000
const SNAPSHOT_LIST_MAX = 5000

let inflight = null
let inflightScope = ''

function emptyContext (status = 'ready') {
  return {
    status,
    muted: [],
    blacklisted: [],
    following: [],
    followedMuteOwners: [],
    followedBlacklistOwners: [],
    followedMuteLists: [],
    followedBlacklistLists: [],
    listErrors: 0,
    loadedAt: 0,
    error: ''
  }
}

function session () {
  try {
    if (typeof sessionStorage !== 'undefined') return sessionStorage
  } catch {
    // Private mode or blocked storage.
  }
  return null
}

function contextKey (scope) {
  return MODERATION_CONTEXT_KEY_PREFIX + scopeFor(scope)
}

function normalizeNameList (value, cap = SNAPSHOT_LIST_MAX) {
  if (!Array.isArray(value)) return []
  const seen = new Set()
  const out = []
  for (const item of value) {
    const name = normalizeName(item)
    if (!name || seen.has(name)) continue
    seen.add(name)
    out.push(name)
    if (out.length >= cap) break
  }
  return out
}

function normalizeOwnerList (value) {
  if (!Array.isArray(value)) return []
  return value
    .map(entry => ({
      name: normalizeName(entry && typeof entry === 'object' ? entry.name : entry),
      description: typeof entry?.description === 'string' ? entry.description.slice(0, 200) : ''
    }))
    .filter(entry => entry.name)
    .slice(0, 200)
}

function normalizeFollowedLists (value) {
  if (!Array.isArray(value)) return []
  return value
    .map(entry => ({
      owner: normalizeName(entry && entry.owner),
      members: normalizeNameList(entry && entry.members)
    }))
    .filter(entry => entry.owner)
    .slice(0, 50)
}

function readSnapshot (scope) {
  const store = session()
  if (!store) return null
  try {
    const raw = store.getItem(contextKey(scope))
    if (!raw) return null
    const parsed = JSON.parse(raw)
    if (!parsed || typeof parsed !== 'object') return null
    const savedAt = Number(parsed.savedAt)
    if (!Number.isFinite(savedAt) || Date.now() - savedAt > MODERATION_CONTEXT_TTL_MS) {
      store.removeItem(contextKey(scope))
      return null
    }
    return {
      status: 'ready',
      muted: normalizeNameList(parsed.muted),
      blacklisted: normalizeNameList(parsed.blacklisted),
      following: normalizeNameList(parsed.following),
      followedMuteOwners: normalizeOwnerList(parsed.followedMuteOwners),
      followedBlacklistOwners: normalizeOwnerList(parsed.followedBlacklistOwners),
      followedMuteLists: normalizeFollowedLists(parsed.followedMuteLists),
      followedBlacklistLists: normalizeFollowedLists(parsed.followedBlacklistLists),
      listErrors: Math.max(0, Number(parsed.listErrors) || 0),
      loadedAt: savedAt,
      error: ''
    }
  } catch {
    return null
  }
}

function writeSnapshot (scope, context) {
  const store = session()
  if (!store) return
  try {
    store.setItem(contextKey(scope), JSON.stringify({
      savedAt: context.loadedAt || Date.now(),
      muted: normalizeNameList(context.muted),
      blacklisted: normalizeNameList(context.blacklisted),
      following: normalizeNameList(context.following),
      followedMuteOwners: normalizeOwnerList(context.followedMuteOwners),
      followedBlacklistOwners: normalizeOwnerList(context.followedBlacklistOwners),
      followedMuteLists: normalizeFollowedLists(context.followedMuteLists),
      followedBlacklistLists: normalizeFollowedLists(context.followedBlacklistLists),
      listErrors: Math.max(0, Number(context.listErrors) || 0)
    }))
  } catch {
    // Quota/private mode: the in-memory snapshot still works.
  }
}

function clearSnapshot (scope) {
  const store = session()
  if (!store) return
  try {
    store.removeItem(contextKey(scope))
  } catch {
    // Ignore.
  }
}

export const useModerationStore = defineStore('moderation', {
  state: () => ({
    scope: 'guest',
    hydrated: false,
    policy: defaultModerationPolicy(),
    context: emptyContext('ready')
  }),

  getters: {
    skinSettings (state) {
      return { ...SKIN_DEFAULT_SETTINGS, ...(state.policy.skins || {}) }
    },
    skinShowAuthors (state) {
      return state.policy.overrides?.showAuthors || []
    },
    skinHideAuthors (state) {
      return state.policy.overrides?.hideAuthors || []
    },
    showItems (state) {
      return state.policy.overrides?.showItems || []
    },
    hideItems (state) {
      return state.policy.overrides?.hideItems || []
    },
    ignoredVoters (state) {
      return state.policy.overrides?.ignoredVoters || []
    },
    contentPreset (state) {
      return state.policy.preset || 'balanced'
    },
    contentCustom (state) {
      return state.policy.custom || null
    },
    listsOverrideFollows (state) {
      return state.policy.lists?.listsOverrideFollows === true
    },
    shouldDisclose (state) {
      return state.policy.preset === 'balanced' && state.policy.disclosureSeen !== true
    },
    isGuest (state) {
      return state.scope === 'guest'
    }
  },

  actions: {
    hydrate (scope = null) {
      const next = scopeFor(scope)
      this.scope = next
      this.policy = readModerationPolicy(next)
      const snapshot = next === 'guest' ? null : readSnapshot(next)
      this.context = snapshot || emptyContext(next === 'guest' ? 'ready' : 'idle')
      this.hydrated = true
      return this
    },

    setScope (scope = null) {
      const next = scopeFor(scope)
      if (this.hydrated && this.scope === next) return this
      this.hydrate(next)
      return this
    },

    restoreContext () {
      if (this.scope === 'guest') {
        this.context = emptyContext('ready')
        return
      }
      const snapshot = readSnapshot(this.scope)
      if (snapshot) this.context = snapshot
    },

    async ensureContext ({ force = false } = {}) {
      if (this.scope === 'guest') {
        this.context = emptyContext('ready')
        return this.context
      }

      const now = Date.now()
      const age = now - (Number(this.context.loadedAt) || 0)
      if (!force && this.context.status === 'ready' && age < MODERATION_CONTEXT_TTL_MS) {
        return this.context
      }
      if (inflight && inflightScope === this.scope) return inflight

      const hadData = this.context.status === 'ready' && Number(this.context.loadedAt) > 0
      if (!hadData) {
        this.context = { ...this.context, status: 'loading', error: '' }
      }

      const requestScope = this.scope
      inflightScope = requestScope
      const request = fetchViewerModerationContext(requestScope, { force })
        .then(data => {
          if (this.scope !== requestScope) return this.context
          this.context = {
            ...emptyContext('ready'),
            ...data,
            status: 'ready',
            error: ''
          }
          writeSnapshot(requestScope, this.context)
          return this.context
        })
        .catch(error => {
          if (this.scope !== requestScope) return this.context
          const message = error && error.message ? error.message : 'Moderation lists could not be loaded'
          if (hadData) {
            // Keep the last proven snapshot; the policy can still explain
            // that a refresh failed without blocking every skin.
            this.context = { ...this.context, error: message }
          } else {
            this.context = { ...this.context, status: 'error', error: message }
          }
          return this.context
        })

      inflight = request
      request.finally(() => {
        if (inflight === request) {
          inflight = null
          inflightScope = ''
        }
      })
      return request
    },

    refreshContext () {
      return this.ensureContext({ force: true })
    },

    decisionForSkin ({ author, account = null, reputation = null } = {}) {
      const name = normalizeName(author || (account && account.name))
      const value = reputation !== null && reputation !== undefined
        ? reputation
        : (account ? account.reputation : null)
      return decideSkin({
        author: name,
        reputation: value,
        viewer: {
          status: this.context.status,
          muted: this.context.muted,
          following: this.context.following,
          followedMuteLists: this.context.followedMuteLists,
          showAuthors: this.skinShowAuthors,
          hideAuthors: this.skinHideAuthors,
          listErrors: this.context.listErrors
        },
        settings: this.skinSettings
      })
    },

    decisionForContent ({ author, post = null, surface = 'feed', itemKey = '' } = {}) {
      const name = normalizeName(author || (post && post.author))
      return decideContent({
        surface,
        author: name,
        reputation: post ? post.author_reputation : null,
        post,
        viewer: {
          status: this.context.status,
          muted: this.context.muted,
          blacklisted: this.context.blacklisted,
          following: this.context.following,
          followedMuteLists: this.context.followedMuteLists,
          followedBlacklistLists: this.context.followedBlacklistLists,
          showAuthors: this.skinShowAuthors,
          hideAuthors: this.skinHideAuthors,
          showItems: this.showItems,
          hideItems: this.hideItems,
          listErrors: this.context.listErrors
        },
        preset: this.contentPreset,
        custom: this.contentCustom,
        listsOverrideFollows: this.listsOverrideFollows,
        itemKey
      })
    },

    isFollowing (author) {
      const name = normalizeName(author)
      if (!name) return false
      return (this.context.following || []).includes(name)
    },

    setPreset (preset) {
      this.policy = { ...this.policy, preset }
      this.persistPolicy()
      return true
    },

    setCustomRule (surface, signal, display) {
      const current = this.policy.custom || {}
      const surfaceRules = current[surface]
      if (!surfaceRules) return false
      this.policy = {
        ...this.policy,
        custom: {
          ...current,
          [surface]: { ...surfaceRules, [signal]: display }
        }
      }
      this.persistPolicy()
      return true
    },

    noteListSubscription (owner, type = 'mute', subscribed = true) {
      const name = normalizeName(owner)
      if (!name) return false
      const blacklist = type === 'blacklist'
      const contextKey = blacklist ? 'followedBlacklistOwners' : 'followedMuteOwners'
      const membersKey = blacklist ? 'followedBlacklistLists' : 'followedMuteLists'
      const policyKey = blacklist ? 'blacklistOwners' : 'muteOwners'
      const entries = Array.isArray(this.context[contextKey]) ? this.context[contextKey] : []
      const lists = Array.isArray(this.context[membersKey]) ? this.context[membersKey] : []
      let nextEntries
      let nextLists
      if (subscribed) {
        nextEntries = entries.some(item => normalizeName(item?.name || item) === name)
          ? entries
          : [...entries, { name, description: '' }]
        nextLists = lists.some(item => normalizeName(item?.owner) === name)
          ? lists
          : [...lists, { owner: name, members: [] }]
      } else {
        nextEntries = entries.filter(item => normalizeName(item?.name || item) !== name)
        nextLists = lists.filter(item => normalizeName(item?.owner) !== name)
      }
      this.context = {
        ...this.context,
        [contextKey]: nextEntries,
        [membersKey]: nextLists,
        loadedAt: Date.now()
      }
      const owners = nextEntries.map(item => normalizeName(item?.name || item)).filter(Boolean)
      this.policy = {
        ...this.policy,
        lists: { ...(this.policy.lists || {}), [policyKey]: owners }
      }
      this.persistPolicy()
      writeSnapshot(this.scope, this.context)
      return true
    },

    setListsOverrideFollows (value) {
      this.policy = {
        ...this.policy,
        lists: { ...(this.policy.lists || {}), listsOverrideFollows: value === true }
      }
      this.persistPolicy()
      return true
    },

    markDisclosureSeen () {
      this.policy = { ...this.policy, disclosureSeen: true }
      this.persistPolicy()
      return true
    },

    resetDisclosure () {
      this.policy = { ...this.policy, disclosureSeen: false }
      this.persistPolicy()
      return true
    },

    resetOverrides () {
      this.policy = {
        ...this.policy,
        overrides: {
          showAuthors: [],
          hideAuthors: [],
          showItems: [],
          hideItems: [],
          ignoredVoters: []
        }
      }
      this.persistPolicy()
      return true
    },

    resetPolicy () {
      this.policy = defaultModerationPolicy()
      this.persistPolicy()
      return true
    },

    showItem (itemKey) {
      const key = String(itemKey || '').trim().slice(0, 200)
      if (!key) return false
      const show = new Set(this.showItems)
      show.add(key)
      this.policy.overrides = {
        ...this.policy.overrides,
        showItems: [...show].slice(-300),
        hideItems: (this.hideItems || []).filter(item => item !== key)
      }
      this.persistPolicy()
      return true
    },

    hideItem (itemKey) {
      const key = String(itemKey || '').trim().slice(0, 200)
      if (!key) return false
      const hide = new Set(this.hideItems)
      hide.add(key)
      this.policy.overrides = {
        ...this.policy.overrides,
        hideItems: [...hide].slice(-300),
        showItems: (this.showItems || []).filter(item => item !== key)
      }
      this.persistPolicy()
      return true
    },

    clearItemOverride (itemKey) {
      const key = String(itemKey || '').trim().slice(0, 200)
      if (!key) return false
      this.policy.overrides = {
        ...this.policy.overrides,
        showItems: (this.showItems || []).filter(item => item !== key),
        hideItems: (this.hideItems || []).filter(item => item !== key)
      }
      this.persistPolicy()
      return true
    },

    ignoreVoter (voter) {
      const name = normalizeName(voter)
      if (!name) return false
      const next = new Set(this.ignoredVoters)
      next.add(name)
      this.policy.overrides = {
        ...this.policy.overrides,
        ignoredVoters: [...next].slice(-500)
      }
      this.persistPolicy()
      return true
    },

    unignoreVoter (voter) {
      const name = normalizeName(voter)
      if (!name) return false
      this.policy.overrides = {
        ...this.policy.overrides,
        ignoredVoters: (this.ignoredVoters || []).filter(item => item !== name)
      }
      this.persistPolicy()
      return true
    },

    exportPolicyText () {
      const muteOwners = [...new Set([
        ...(this.policy.lists?.muteOwners || []),
        ...(this.context.followedMuteOwners || []).map(item => normalizeName(item?.name || item))
      ].filter(Boolean))]
      const blacklistOwners = [...new Set([
        ...(this.policy.lists?.blacklistOwners || []),
        ...(this.context.followedBlacklistOwners || []).map(item => normalizeName(item?.name || item))
      ].filter(Boolean))]
      const policy = {
        ...this.policy,
        lists: { ...(this.policy.lists || {}), muteOwners, blacklistOwners }
      }
      return serializeModerationExport(policy, {
        subscriptions: { muteOwners, blacklistOwners }
      })
    },

    importPolicyText (text) {
      const result = parseModerationExport(text)
      if (!result.policy) return result
      this.policy = result.policy
      this.persistPolicy()
      return result
    },

    persistPolicy () {
      writeModerationPolicy(this.scope, this.policy)
    },

    setSkinSetting (key, value) {
      if (!Object.prototype.hasOwnProperty.call(SKIN_DEFAULT_SETTINGS, key)) return false
      this.policy.skins = { ...this.policy.skins, [key]: value === true }
      this.persistPolicy()
      return true
    },

    setFollowedOverrides (value) {
      const enabled = value === true
      this.policy.skins = {
        ...this.policy.skins,
        followedMuteListOverride: enabled,
        followedReputationOverride: enabled
      }
      this.persistPolicy()
      return true
    },

    showSkinAuthor (author) {
      const name = normalizeName(author)
      if (!name) return false
      const show = new Set(this.skinShowAuthors)
      show.add(name)
      this.policy.overrides = {
        ...this.policy.overrides,
        showAuthors: [...show].slice(-200),
        hideAuthors: (this.skinHideAuthors || []).filter(item => item !== name)
      }
      this.persistPolicy()
      return true
    },

    hideSkinAuthor (author) {
      const name = normalizeName(author)
      if (!name) return false
      const hide = new Set(this.skinHideAuthors)
      hide.add(name)
      this.policy.overrides = {
        ...this.policy.overrides,
        hideAuthors: [...hide].slice(-200),
        showAuthors: (this.skinShowAuthors || []).filter(item => item !== name)
      }
      this.persistPolicy()
      return true
    },

    clearSkinOverride (author) {
      const name = normalizeName(author)
      if (!name) return false
      this.policy.overrides = {
        ...this.policy.overrides,
        showAuthors: (this.skinShowAuthors || []).filter(item => item !== name),
        hideAuthors: (this.skinHideAuthors || []).filter(item => item !== name)
      }
      this.persistPolicy()
      return true
    },

    noteMuteChange (author, muted) {
      const name = normalizeName(author)
      if (!name) return false
      const next = new Set(this.context.muted)
      if (muted) next.add(name)
      else next.delete(name)
      this.context = { ...this.context, muted: [...next], loadedAt: Date.now() }
      writeSnapshot(this.scope, this.context)
      return true
    },

    noteFollowChange (author, follows) {
      const name = normalizeName(author)
      if (!name) return false
      const next = new Set(this.context.following)
      if (follows) next.add(name)
      else next.delete(name)
      this.context = { ...this.context, following: [...next], loadedAt: Date.now() }
      writeSnapshot(this.scope, this.context)
      return true
    },

    reset () {
      this.scope = 'guest'
      this.policy = defaultModerationPolicy()
      this.context = emptyContext('ready')
      this.hydrated = true
      clearSnapshot('guest')
    }
  }
})
