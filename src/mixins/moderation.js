// Shared moderation wiring for content surfaces.
//
// Signed-in viewers get the full store lazily. Guests keep the same policy
// shape in localStorage and never load the chain-read/store chunk, which keeps
// the signed-out feed route budget small. Content always fails open, so no
// item disappears while the policy is loading.

import { ref } from 'vue'
import { decideContent } from 'src/services/moderationContent'
import { normalizeName } from 'src/services/moderationPolicy'
import { loadModerationStore } from 'src/services/moderationStoreLoader'
import { safetyFloorState } from 'src/services/safetyFloor'
import {
  normalizeIgnoredTag,
  normalizeIgnoredTags
} from 'src/services/tagFilters'

const GUEST_KEY = 'hive:moderation:v1:guest'

function guestPolicy () {
  const fallback = {
    preset: 'balanced',
    custom: null,
    listsOverrideFollows: false,
    disclosureSeen: false,
    safetyFloor: { enabled: true },
    tags: { ignored: [] },
    overrides: { showAuthors: [], hideAuthors: [], showItems: [], hideItems: [], ignoredVoters: [] }
  }
  try {
    const parsed = JSON.parse(localStorage.getItem(GUEST_KEY) || 'null')
    if (!parsed || typeof parsed !== 'object') return fallback
    return {
      ...fallback,
      ...parsed,
      safetyFloor: { enabled: parsed?.safetyFloor?.enabled !== false },
      tags: { ignored: normalizeIgnoredTags(parsed?.tags?.ignored) },
      overrides: { ...fallback.overrides, ...(parsed.overrides || {}) }
    }
  } catch {
    return fallback
  }
}

// One reactive guest policy shared by every card and filter dialog on the page,
// so an “ignore tag” action updates the whole view immediately without loading
// the signed-in moderation store chunk.
const guestPolicyState = ref(guestPolicy())

function refreshGuestPolicy () {
  guestPolicyState.value = guestPolicy()
  return guestPolicyState.value
}

function writeGuestPolicy (policy) {
  guestPolicyState.value = policy
  try {
    localStorage.setItem(GUEST_KEY, JSON.stringify(policy))
  } catch {
    // In-memory state still applies.
  }
  return policy
}

function guestOverride (key, value, action) {
  const policy = guestPolicyState.value
  const overrides = policy.overrides || {}
  const list = Array.isArray(overrides[key]) ? overrides[key] : []
  if (action === 'add' && !list.includes(value)) list.push(value)
  if (action === 'remove') {
    const index = list.indexOf(value)
    if (index !== -1) list.splice(index, 1)
  }
  policy.overrides = { ...overrides, [key]: list.slice(-500) }
  return writeGuestPolicy(policy)
}

export default {
  data () {
    return {
      moderationStore: null,
      moderationError: false
    }
  },
  computed: {
    moderationViewer () {
      return this.$hiveStore?.user?.username || ''
    },
    moderationGuestPolicy () {
      return guestPolicyState.value
    },
    moderationIgnoredTags () {
      if (this.moderationStore) return this.moderationStore.ignoredTags
      return this.moderationGuestPolicy?.tags?.ignored || []
    }
  },
  mounted () {
    this.attachModerationContext()
  },
  watch: {
    moderationViewer () {
      this.attachModerationContext()
    }
  },
  methods: {
    attachModerationContext () {
      if (!this.moderationViewer) {
        this.moderationStore = null
        this.moderationError = false
        refreshGuestPolicy()
        return
      }
      loadModerationStore()
        .then(store => {
          this.moderationStore = store
          this.moderationError = false
          store.setScope(this.moderationViewer)
          store.ensureContext()
        })
        .catch(() => {
          this.moderationStore = null
          this.moderationError = true
        })
    },

    moderationDecision ({ author = '', post = null, surface = 'feed', itemKey = '' } = {}) {
      const key = itemKey || (post ? post.author + '/' + post.permlink : author)
      if (this.moderationStore) {
        return this.moderationStore.decisionForContent({
          author,
          post,
          surface,
          itemKey: key,
          safetyFloor: safetyFloorState
        })
      }
      const policy = this.moderationGuestPolicy || guestPolicy()
      return decideContent({
        surface,
        author,
        reputation: post ? post.author_reputation : null,
        post,
        viewer: {
          status: 'ready',
          showAuthors: policy.overrides?.showAuthors || [],
          hideAuthors: policy.overrides?.hideAuthors || [],
          showItems: policy.overrides?.showItems || [],
          hideItems: policy.overrides?.hideItems || [],
          ignoredVoters: policy.overrides?.ignoredVoters || [],
          safetyFloor: {
            ...safetyFloorState,
            enabled: policy.safetyFloor?.enabled !== false
          }
        },
        preset: policy.preset || 'balanced',
        custom: policy.custom || null,
        listsOverrideFollows: policy.listsOverrideFollows === true,
        itemKey: key
      })
    },

    moderationShowItem (decision) {
      if (!decision) return
      const key = decision.itemKey
      if (!key) return
      if (this.moderationStore) {
        this.moderationStore.showItem(key)
        return
      }
      guestOverride('showItems', key, 'add')
    },

    moderationShowAuthor (decision) {
      if (!decision || !decision.author) return
      if (this.moderationStore) {
        this.moderationStore.showSkinAuthor(decision.author)
        return
      }
      const policy = guestOverride('showAuthors', decision.author, 'add')
      policy.overrides.hideAuthors = (policy.overrides.hideAuthors || []).filter(item => item !== decision.author)
      writeGuestPolicy(policy)
    },

    moderationHideAuthor (decision) {
      if (!decision || !decision.author) return
      if (this.moderationStore) {
        this.moderationStore.hideSkinAuthor(decision.author)
        return
      }
      const policy = guestOverride('hideAuthors', decision.author, 'add')
      policy.overrides.showAuthors = (policy.overrides.showAuthors || []).filter(item => item !== decision.author)
      writeGuestPolicy(policy)
    },

    moderationToggleIgnoredVoter (voter) {
      const name = normalizeName(voter)
      if (!name) return
      const current = this.moderationStore
        ? this.moderationStore.ignoredVoters
        : (this.moderationGuestPolicy?.overrides?.ignoredVoters || [])
      const ignored = Array.isArray(current) && current.includes(name)
      if (this.moderationStore) {
        if (ignored) this.moderationStore.unignoreVoter(name)
        else this.moderationStore.ignoreVoter(name)
        return
      }
      guestOverride('ignoredVoters', name, ignored ? 'remove' : 'add')
    },

    moderationIgnoreTag (tag) {
      const name = normalizeIgnoredTag(tag)
      if (!name) return false
      if (this.moderationStore) return this.moderationStore.ignoreTag(name)
      const policy = this.moderationGuestPolicy || guestPolicy()
      const ignored = Array.isArray(policy.tags?.ignored) ? policy.tags.ignored : []
      writeGuestPolicy({
        ...policy,
        tags: { ...(policy.tags || {}), ignored: normalizeIgnoredTags([...ignored, name]) }
      })
      return true
    },

    moderationUnignoreTag (tag) {
      const name = normalizeIgnoredTag(tag)
      if (!name) return false
      if (this.moderationStore) return this.moderationStore.unignoreTag(name)
      const policy = this.moderationGuestPolicy || guestPolicy()
      const ignored = Array.isArray(policy.tags?.ignored) ? policy.tags.ignored : []
      writeGuestPolicy({
        ...policy,
        tags: {
          ...(policy.tags || {}),
          ignored: normalizeIgnoredTags(ignored.filter(item => normalizeIgnoredTag(item) !== name))
        }
      })
      return true
    },

    moderationToggleIgnoredTag (tag) {
      const name = normalizeIgnoredTag(tag)
      if (!name) return false
      const ignored = (this.moderationIgnoredTags || []).includes(name)
      return ignored ? this.moderationUnignoreTag(name) : this.moderationIgnoreTag(name)
    },

    moderationClearIgnoredTags () {
      if (this.moderationStore) return this.moderationStore.clearIgnoredTags()
      const policy = this.moderationGuestPolicy || guestPolicy()
      if (!Array.isArray(policy.tags?.ignored) || !policy.tags.ignored.length) return false
      writeGuestPolicy({
        ...policy,
        tags: { ...(policy.tags || {}), ignored: [] }
      })
      return true
    },

    moderationMarkDisclosure () {
      if (this.moderationStore) {
        this.moderationStore.markDisclosureSeen()
        return
      }
      writeGuestPolicy({ ...guestPolicy(), disclosureSeen: true })
    }
  }
}
