<template>
  <q-page class="connections-page">
    <account-header
      v-if="username !== undefined && account !== undefined"
      :globalProps="globalProps"
      :account="account"
      :showBalances="false"
    />

    <div class="connections-shell">
      <header class="connections-head">
        <div class="connections-head__text">
          <div class="home-eyebrow">Connections</div>
          <h1 class="page-title">{{ tab === 'followers' ? 'Followers' : 'Following' }}</h1>
          <p class="page-intro">{{ intro }}</p>
        </div>
      </header>

      <q-tabs
        v-model="tab"
        dense
        no-caps
        inline-label
        align="left"
        active-color="white"
        indicator-color="secondary"
        class="connections-tabs"
        aria-label="Connection lists"
      >
        <q-route-tab :to="linkFollowing" name="following">
          Following
          <q-badge v-if="followCount" color="primary" class="connections-tab__count">{{ formattedCount(followCount.following_count) }}</q-badge>
        </q-route-tab>
        <q-route-tab :to="linkFollowers" name="followers">
          Followers
          <q-badge v-if="followCount" color="primary" class="connections-tab__count">{{ formattedCount(followCount.follower_count) }}</q-badge>
        </q-route-tab>
      </q-tabs>

      <connections :key="tab + ':' + username" :type="tab" :username="username" />
    </div>
  </q-page>
</template>

<script>
import { defineAsyncComponent } from 'vue'
import { setPageMeta } from 'src/utils/pageMeta'

export default {
  name: 'ConnectionsPage',
  components: {
    accountHeader: defineAsyncComponent(() => import('components/accountHeader.vue')),
    connections: defineAsyncComponent(() => import('components/connections.vue'))
  },
  data () {
    return {
      username: this.$route.params.username || this.$route.params.account,
      tab: this.$route.path.endsWith('/followers') ? 'followers' : 'following'
    }
  },
  computed: {
    globalProps () {
      return this.$hiveStore.globalProps
    },
    account () {
      return this.$hiveStore.accounts[this.username]
    },
    linkFollowers () { return '/@' + this.username + '/followers' },
    linkFollowing () { return '/@' + this.username + '/following' },
    followCount () { return this.$hiveStore.followCounts[this.username] || null },
    intro () {
      const count = this.tab === 'followers'
        ? this.followCount?.follower_count
        : this.followCount?.following_count
      const noun = count === 1 ? 'account' : 'accounts'
      if (count === undefined || count === null) {
        return (this.tab === 'followers' ? 'Accounts following' : 'Accounts followed by') + ' @' + this.username + '.'
      }
      return (this.tab === 'followers' ? 'Accounts following' : 'Accounts followed by') + ' @' + this.username + ' — ' + this.formattedCount(count) + ' ' + noun + '.'
    }
  },
  watch: {
    '$route.path' () { this.syncRoute() }
  },
  methods: {
    tidyNumber (x) {
      if (x === null || x === undefined) return null
      const parts = String(x).split('.')
      parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',')
      return parts.join('.')
    },
    formattedCount (x) {
      if (x === null || x === undefined) return '…'
      return this.tidyNumber(x) ?? String(x)
    },
    applyPageMeta () {
      const kind = this.tab === 'followers' ? 'followers' : 'following'
      setPageMeta({
        title: '@' + this.username + "'s " + kind + ' — banksia.io',
        description: 'Accounts ' + (kind === 'followers' ? 'following' : 'followed by') + ' @' + this.username + ' on the Hive blockchain.',
        url: '/@' + this.username + '/' + kind
      })
    },
    load () {
      if (this.globalProps.empty) this.$hiveStore.getGlobalProps()
      if (this.account === undefined) this.$hiveStore.getAccount(this.username)
      if (this.followCount === null) this.$hiveStore.getFollowCount(this.username)
    },
    syncRoute () {
      this.username = this.$route.params.username || this.$route.params.account
      this.tab = this.$route.path.endsWith('/followers') ? 'followers' : 'following'
      this.applyPageMeta()
      this.load()
    }
  },
  mounted () {
    this.load()
    this.applyPageMeta()
  }
}
</script>

<style scoped>
.connections-page {
  min-width: 0;
  padding-bottom: var(--space-6);
}

.connections-shell {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
  width: 100%;
  max-width: 1180px;
  margin: 0 auto;
  padding: var(--space-4) var(--space-4) var(--space-6);
}

.connections-head {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: var(--space-3);
  flex-wrap: wrap;
}

.connections-head__text {
  min-width: 0;
}

.connections-head__text .page-intro {
  margin-left: 0;
}

.connections-tabs {
  align-self: flex-start;
  min-height: 38px;
  padding: 0.15rem;
  border: 1px solid var(--border-subtle);
  border-radius: 999px;
  background: color-mix(in srgb, var(--c-bg-deep) 84%, transparent);
}

.connections-tabs :deep(.q-tab) {
  min-height: 32px;
  padding: 0 0.9rem;
  border-radius: 999px;
  color: var(--c-text-subtle);
}

.connections-tabs :deep(.q-tab--active) {
  background: color-mix(in srgb, var(--c-link) 14%, transparent);
}

.connections-tab__count {
  margin-left: 0.3rem;
  font-size: 0.64rem;
}

@media (max-width: 599px) {
  .connections-shell {
    padding: var(--space-3) 0.75rem var(--space-6);
  }
}
</style>
