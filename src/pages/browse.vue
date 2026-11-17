<template>
  <q-page class="browse-page">
    <account-header
      v-if="isAccount && account !== undefined"
      :globalProps="globalProps"
      :account="account"
      :showBalances="false"
      :showProfile="false"
      compact
    />
    <community-header
      v-else-if="isCommunity && account !== undefined"
      :globalProps="globalProps"
      :account="account"
    />

    <h1 v-if="isCommunity" class="sr-only">{{ communityTitle }} community posts</h1>

    <div class="browse-wrap">
      <header class="browse-head">
        <div class="browse-head__text">
          <h1 v-if="isGlobal" class="browse-head__title">{{ heading }}</h1>
          <h2 v-else class="browse-head__title">{{ heading }}</h2>
          <p class="browse-head__subtitle">{{ subtitle }}</p>
        </div>

        <div v-if="isGlobal && tag" class="browse-head__tag">
          <q-chip dense square color="primary" text-color="black" icon="tag">#{{ tag }}</q-chip>
          <q-btn flat dense no-caps color="primary" icon="close" label="Clear tag" :to="clearTagLink" />
        </div>
      </header>

      <nav v-if="isGlobal" class="browse-sort-nav" aria-label="Post sort">
        <router-link
          v-for="option in sortOptions"
          :key="option.route"
          :to="sortLink(option)"
          class="browse-sort-link"
          :class="{ 'browse-sort-link--active': option.route === section }"
        >
          <q-icon :name="option.icon" size="16px" aria-hidden="true" />
          {{ option.label }}
        </router-link>
      </nav>

      <browse-container
        :callMethod="callMethod"
        :sortMethod="section"
        :showAccount="showAccount"
        :showTag="showTag"
        :showToolbar="false"
      />
    </div>
  </q-page>
</template>

<style scoped>
.browse-page {
  min-width: 0;
}

.browse-wrap {
  width: 100%;
  max-width: 1280px;
  margin: 0 auto;
  padding: var(--space-4) var(--space-4) var(--space-6);
}

.browse-head {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: var(--space-3);
  flex-wrap: wrap;
  margin-bottom: var(--space-3);
}

.browse-head__title {
  margin: 0;
  font-size: clamp(1.35rem, 2.4vw, 1.8rem);
  font-weight: 600;
  line-height: 1.2;
  letter-spacing: -0.01em;
}

.browse-head__subtitle {
  margin: 0.35rem 0 0;
  color: #90a4ae;
  font-size: 0.86rem;
}

.browse-head__tag {
  display: flex;
  align-items: center;
  gap: 0.25rem;
  flex-wrap: wrap;
}

.browse-sort-nav {
  display: flex;
  gap: 0.3rem;
  overflow-x: auto;
  padding-bottom: 0.35rem;
  margin-bottom: var(--space-3);
  scrollbar-width: thin;
}

.browse-sort-link {
  display: inline-flex;
  align-items: center;
  gap: 0.3rem;
  flex: none;
  padding: 0.32rem 0.7rem;
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-pill);
  color: #b0bec5;
  font-size: 0.78rem;
  text-decoration: none;
  white-space: nowrap;
}

.browse-sort-link:hover {
  border-color: rgba(79, 195, 247, 0.4);
  color: #e4eaed;
}

.browse-sort-link--active {
  border-color: rgba(79, 195, 247, 0.45);
  background: rgba(79, 195, 247, 0.14);
  color: #81d4fa;
}

@media (max-width: 599px) {
  .browse-wrap {
    padding: var(--space-3) var(--space-2) var(--space-5);
  }
}
</style>

<script>
import browseContainer from 'components/browseContainer.vue'
import accountHeader from 'components/accountHeader.vue'
import communityHeader from 'components/communityHeader.vue'
import { setPageMeta } from 'src/utils/pageMeta'

const SORT_LABELS = {
  trending: 'Trending',
  created: 'New',
  hot: 'Hot',
  promoted: 'Promoted',
  payout: 'Top payout',
  payout_comments: 'Top payout comments',
  muted: 'Muted',
  posts: 'Posts',
  blog: 'Blog',
  feed: 'Feed',
  replies: 'Replies',
  comments: 'Comments'
}

const PROFILE_SUBTITLES = {
  posts: 'Everything @{account} has published.',
  blog: 'Posts @{account} wrote or reblogged.',
  feed: 'Posts from accounts @{account} follows.',
  replies: 'Replies @{account} has written.',
  comments: 'Comments @{account} has written.'
}

const STANDARD_SORTS = new Set(['trending', 'created', 'hot', 'promoted', 'muted'])

const SORT_OPTIONS = [
  { route: 'trending', label: 'Trending', icon: 'trending_up' },
  { route: 'created', label: 'New', icon: 'schedule' },
  { route: 'hot', label: 'Hot', icon: 'local_fire_department' },
  { route: 'promoted', label: 'Promoted', icon: 'campaign' },
  { route: 'payout', label: 'Top payout', icon: 'payments' },
  { route: 'payout_comments', label: 'Top comments', icon: 'forum' },
  { route: 'muted', label: 'Muted', icon: 'volume_off' }
]

export default {
  name: 'browsePage',
  props: {
    defaultSort: { type: String, default: null }
  },
  components: {
    browseContainer,
    accountHeader,
    communityHeader
  },
  data () {
    return {
      username: this.$route.params.username || this.$route.params.account,
      sortOptions: SORT_OPTIONS
    }
  },
  computed: {
    globalProps () {
      return this.$hiveStore.globalProps
    },
    account () {
      return this.$hiveStore.accounts[this.username]
    },
    isCommunity () {
      return this.$route.path.startsWith('/c/')
    },
    isAccount () {
      return !this.isCommunity && Boolean(this.$route.params.account)
    },
    isGlobal () {
      return !this.isAccount && !this.isCommunity
    },
    accountName () {
      return this.$route.params.account || ''
    },
    communityName () {
      return this.$route.params.username || ''
    },
    communityInfo () {
      return this.isCommunity ? this.$hiveStore.communityInfo[this.communityName] : null
    },
    communityTitle () {
      return (this.communityInfo && this.communityInfo.title) || this.communityName
    },
    section () {
      if (this.isAccount) {
        const name = String(this.$route.name || '')
        return name.startsWith('account-') ? name.slice('account-'.length) : 'posts'
      }
      if (this.isCommunity) return this.$route.params.sortMethod || 'trending'
      return this.$route.params.sortMethod || this.defaultSort || 'created'
    },
    tag () {
      return this.$route.params.tag || ''
    },
    sortLabel () {
      return SORT_LABELS[this.section] || this.section
    },
    heading () {
      if (this.isAccount) return SORT_LABELS[this.section] || 'Posts'
      if (this.isCommunity) return STANDARD_SORTS.has(this.section) ? this.sortLabel + ' posts' : this.sortLabel
      if (this.tag) return this.sortLabel + ' in #' + this.tag
      return STANDARD_SORTS.has(this.section) ? this.sortLabel + ' Hive posts' : this.sortLabel
    },
    subtitle () {
      if (this.isAccount) {
        return (PROFILE_SUBTITLES[this.section] || 'Posts by @{account}.').replace('{account}', this.accountName)
      }
      if (this.isCommunity) return 'Browse ' + this.sortLabel.toLowerCase() + ' posts in ' + this.communityTitle + '.'
      if (this.tag) return 'Posts tagged #' + this.tag + ' across Hive.'
      const subject = STANDARD_SORTS.has(this.section)
        ? this.sortLabel.toLowerCase() + ' posts'
        : this.sortLabel.toLowerCase()
      return 'Discover ' + subject + ' from across the Hive ecosystem.'
    },
    callMethod () {
      return this.isAccount ? 'bridge.get_account_posts' : 'bridge.get_ranked_posts'
    },
    showAccount () {
      return this.isAccount ? this.accountName : undefined
    },
    showTag () {
      if (this.isCommunity) return this.communityName
      if (this.isGlobal && this.tag) return this.tag
      return undefined
    },
    clearTagLink () {
      const path = '/' + (this.section === 'created' ? 'created' : this.section)
      const style = this.$route.query.style
      return style ? { path, query: { style } } : path
    }
  },
  watch: {
    '$route' () {
      this.updatePageMeta()
    },
    communityInfo () {
      this.updatePageMeta()
    }
  },
  methods: {
    sortLink (option) {
      const path = '/' + option.route + (this.tag ? '/' + this.tag : '')
      const style = this.$route.query.style
      return style ? { path, query: { style } } : path
    },
    updatePageMeta () {
      const section = this.section
      const label = (SORT_LABELS[section] || 'Posts').toLowerCase()

      let title
      let description

      if (this.isAccount) {
        title = '@' + this.accountName + "'s Hive " + label
        description = 'Browse @' + this.accountName + "'s " + label + ' on the Hive blockchain at hive.ausbit.dev.'
      } else if (this.isCommunity) {
        title = this.communityTitle + ' — ' + this.sortLabel + ' Hive posts'
        description = 'Browse ' + label + ' posts in the ' + this.communityTitle + ' Hive community at hive.ausbit.dev.'
      } else {
        const tagLabel = this.tag ? '#' + this.tag : null
        title = tagLabel ? this.sortLabel + ' Hive posts in ' + tagLabel : this.sortLabel + ' Hive posts'
        description = tagLabel
          ? 'Browse ' + label + ' Hive posts tagged ' + tagLabel + ' on hive.ausbit.dev.'
          : 'Browse ' + label + ' posts on the Hive blockchain: trending, new, hot and community content.'
      }

      setPageMeta({ title, description, url: this.$route.path })
    }
  },
  mounted () {
    if (this.globalProps && this.globalProps.empty) this.$hiveStore.getGlobalProps()
    if (this.username && this.account === undefined) this.$hiveStore.getAccount(this.username)
    this.updatePageMeta()
  }
}
</script>
