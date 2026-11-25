// Shared moderation wiring for content surfaces.
//
// Signed-in viewers get the full store lazily. Guests keep the same policy
// shape in localStorage and never load the chain-read/store chunk, which keeps
// the signed-out feed route budget small. Content always fails open, so no
// item disappears while the policy is loading.

import { decideContent } from 'src/services/moderationContent'
import { normalizeName } from 'src/services/moderationPolicy'
import { loadModerationStore } from 'src/services/moderationStoreLoader'

const GUEST_KEY = 'hive:moderation:v1:guest'

function guestPolicy () {
  const fallback = {
    preset: 'balanced',
    custom: null,
    listsOverrideFollows: false,
    disclosureSeen: false,
    overrides: { showAuthors: [], hideAuthors: [], showItems: [], hideItems: [], ignoredVoters: [] }
  }
  try {
    const parsed = JSON.parse(localStorage.getItem(GUEST_KEY) || 'null')
    if (!parsed || typeof parsed !== 'object') return fallback
    return {
      ...fallback,
      ...parsed,
      overrides: { ...fallback.overrides, ...(parsed.overrides || {}) }
    }
  } catch {
    return fallback
  }
}

function writeGuestPolicy (policy) {
  try {
    localStorage.setItem(GUEST_KEY, JSON.stringify(policy))
  } catch {
    // In-memory state still applies.
  }
}

function guestOverride (key, value, action) {
  const policy = guestPolicy()
  const overrides = policy.overrides || {}
  const list = Array.isArray(overrides[key]) ? overrides[key] : []
  if (action === 'add' && !list.includes(value)) list.push(value)
  if (action === 'remove') {
    const index = list.indexOf(value)
    if (index !== -1) list.splice(index, 1)
  }
  policy.overrides = { ...overrides, [key]: list.slice(-500) }
  writeGuestPolicy(policy)
  return policy
}

export default {
  data () {
    return {
      moderationStore: null,
      moderationError: false,
      moderationGuestPolicy: guestPolicy()
    }
  },
  computed: {
    moderationViewer () {
      return this.$hiveStore?.user?.username || ''
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
        this.moderationGuestPolicy = guestPolicy()
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
        return this.moderationStore.decisionForContent({ author, post, surface, itemKey: key })
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
          ignoredVoters: policy.overrides?.ignoredVoters || []
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
      this.moderationGuestPolicy = guestOverride('showItems', key, 'add')
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
      this.moderationGuestPolicy = policy
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
      this.moderationGuestPolicy = policy
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
      this.moderationGuestPolicy = guestOverride('ignoredVoters', name, ignored ? 'remove' : 'add')
    },

    moderationMarkDisclosure () {
      if (this.moderationStore) {
        this.moderationStore.markDisclosureSeen()
        return
      }
      const policy = { ...guestPolicy(), disclosureSeen: true }
      writeGuestPolicy(policy)
      this.moderationGuestPolicy = policy
    }
  }
}
