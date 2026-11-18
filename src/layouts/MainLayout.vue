<template>
  <a href="#main-content" class="skip-link">Skip to main content</a>
  <q-layout view="hHh lpR fFf">
    <q-header reveal elevated>
      <q-toolbar class="bg-dark text-primary site-toolbar">
        <q-btn class="site-toolbar__menu" flat dense round icon="menu" aria-label="Menu" title="Menu" @click="leftDrawerOpen = !leftDrawerOpen"/>
        <q-toolbar-title class="site-toolbar__brand">
          <router-link to="/" class="site-brand" aria-label="hive.ausbit.dev home">
            <img
              src="/statics/hive.svg"
              class="site-brand__mark"
              alt=""
              width="30"
              height="26"
              aria-hidden="true"
            />
            <span class="site-brand__text gt-xs">hive.ausbit.dev</span>
          </router-link>
        </q-toolbar-title>
        <div class="site-toolbar__actions">
          <q-btn class="command-trigger gt-xs" flat no-caps aria-label="Search or jump to a Hive page" title="Search or jump to a Hive page" @click="openCommandPalette">
            <q-icon name="search" size="18px" aria-hidden="true" />
            <span class="command-trigger__label">Search or jump to…</span>
            <kbd class="command-trigger__kbd">Ctrl K</kbd>
          </q-btn>
          <q-btn class="lt-sm site-toolbar__icon" flat dense round icon="search" aria-label="Search or jump to a Hive page" title="Search or jump to" @click="openCommandPalette" />
          <q-btn class="site-toolbar__icon" flat dense round icon="edit_note" aria-label="Write a post" title="Write a post" @click="openCompose" />
          <queue v-if="loggedInUser !== null && queue.length > 0" />
          <notifications v-if="loggedInUser !== null" />
          <user-login />
          <q-btn class="site-toolbar__icon" dense flat icon="settings" title="Settings" aria-label="Settings" color="grey"><q-popup-proxy anchor="bottom right" self="top right" :offset="[0, 8]"><settings /></q-popup-proxy></q-btn>
        </div>
      </q-toolbar>
    </q-header>
    <q-drawer v-model="leftDrawerOpen" side="left" overlay elevated>
      <q-list class="site-nav" role="navigation" aria-label="Site navigation" @click="leftDrawerOpen = false">
        <q-item-label header class="site-nav__brand">
          <a
            href="https://hive.io"
            target="_blank"
            rel="noopener noreferrer"
            title="Powered by Hive"
            aria-label="Powered by Hive"
            class="inline-block"
          >
            <img
              src="/statics/badge_powered-by-hive_dark.svg"
              alt="Powered by Hive"
              style="height: 36px; width: auto"
            />
          </a>
        </q-item-label>
        <q-separator spaced />
        <q-item clickable @click="openCommandPalette">
          <q-item-section avatar><q-icon name="manage_search" /></q-item-section>
          <q-item-section>
            <q-item-label>Search / jump</q-item-label>
            <q-item-label caption>Ctrl K</q-item-label>
          </q-item-section>
        </q-item>
        <q-separator spaced />
        <q-item-label header class="site-nav__heading">Explore</q-item-label>
        <EssentialLink
          v-for="link in exploreLinks"
          :key="link.title"
          v-bind="link"
        />
        <q-item-label header class="site-nav__heading">Tools</q-item-label>
        <EssentialLink
          v-for="link in toolLinks"
          :key="link.title"
          v-bind="link"
        />
        <q-separator spaced />
        <q-item-label header class="site-nav__heading">Community &amp; links</q-item-label>
        <EssentialLink
          v-for="link in externalLinks"
          :key="link.title"
          v-bind="link"
        />
      </q-list>
      <div class="site-nav__footer"><q-icon name="code" color="grey" title="coded" aria-label="coded" /> with <q-icon name="favorite" color="red" title="love" aria-label="love" /> by <router-link to="/@ausbitbank">ausbitbank</router-link></div>
    </q-drawer>
    <q-page-container id="main-content" tabindex="-1">
      <error-boundary :key="$route.path">
        <router-view />
      </error-boundary>
      <footer class="site-footer" aria-label="Site footer">
        <nav class="site-footer__links" aria-label="Footer navigation">
          <router-link to="/browse">Browse</router-link>
          <router-link to="/blocks">Blocks</router-link>
          <router-link to="/proposals">Proposals</router-link>
          <router-link to="/nodes">Nodes</router-link>
        </nav>
        <div class="site-footer__meta">
          <a href="https://hive.io" target="_blank" rel="noopener noreferrer">Powered by Hive</a>
          <span aria-hidden="true">·</span>
          <a href="https://github.com/ausbitbank/hive.ausbit.dev-src" target="_blank" rel="noopener noreferrer">Source on GitHub</a>
        </div>
      </footer>
    </q-page-container>
    <command-palette ref="commandPalette" />
    <perf-panel v-if="showPerfPanel" @close="closePerfPanel" />
    <back-to-top />
    <keyboard-shortcuts />
  </q-layout>
</template>
<style>
.site-toolbar {
  gap: var(--space-1);
}

.site-toolbar__brand {
  display: flex;
  align-items: center;
  align-self: stretch;
  min-width: 0;
  padding: 0 var(--space-3) 0 0;
}

.site-toolbar__menu .q-icon {
  font-size: 22px;
}

.site-brand {
  display: inline-flex;
  align-items: center;
  gap: 9px;
  max-width: 100%;
  color: var(--q-primary);
  font-size: 1.22rem;
  font-weight: 600;
  letter-spacing: -0.01em;
  line-height: 1;
  text-decoration: none;
  white-space: nowrap;
}

.site-brand:hover {
  color: #81d4fa;
  text-decoration: none;
}

.site-brand__mark {
  display: block;
  flex: none;
  width: auto;
  height: 22px;
}

.site-brand__text {
  overflow: hidden;
  text-overflow: ellipsis;
}

.site-toolbar__actions {
  display: flex;
  align-items: center;
  gap: var(--space-1);
  flex: none;
  min-width: 0;
}

.site-toolbar__actions .q-btn {
  margin: 0;
}

.site-toolbar__icon {
  min-width: 36px;
  min-height: 36px;
}

.site-nav__brand {
  padding: var(--space-3) var(--space-4) var(--space-2);
  min-height: 0;
}

.site-nav__heading {
  padding: var(--space-3) var(--space-4) var(--space-1);
  min-height: 0;
  color: #90a4ae;
  font-size: 0.68rem;
  font-weight: 600;
  letter-spacing: 0.07em;
  line-height: 1.3;
  text-transform: uppercase;
}

.site-nav .q-item {
  min-height: 46px;
  padding-top: 6px;
  padding-bottom: 6px;
}

.site-nav .q-item__label--caption {
  margin-top: 1px;
  overflow: hidden;
  color: #78909c;
  font-size: 0.72rem;
  line-height: 1.35;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.site-nav__footer {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: var(--space-1);
  margin-top: auto;
  padding: var(--space-3) var(--space-4) var(--space-4);
  border-top: 1px solid var(--border-subtle);
  color: #90a4ae;
  font-size: 0.76rem;
  text-align: center;
}

.site-nav__footer .q-icon {
  font-size: 1.05em;
}

.command-trigger {
  gap: 0.4rem;
  min-width: 255px;
  max-width: 350px;
  min-height: 36px;
  padding: 0.2rem 0.55rem;
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-pill);
  background: rgba(255, 255, 255, 0.035);
  color: #90a4ae;
  font-size: 0.8rem;
  text-transform: none;
}

.command-trigger:hover {
  border-color: rgba(79, 195, 247, 0.45);
  color: #e4eaed;
}

.command-trigger__label {
  flex: 1;
  overflow: hidden;
  text-align: left;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.command-trigger__kbd {
  padding: 0.05rem 0.3rem;
  border: 1px solid var(--border-subtle);
  border-radius: 4px;
  background: rgba(255, 255, 255, 0.045);
  color: #78909c;
  font-family: monospace;
  font-size: 0.65rem;
}

@media (max-width: 599px) {
  .site-brand {
    gap: var(--space-2);
  }

  .site-brand__mark {
    height: 22px;
  }

  .site-toolbar__actions {
    gap: 0;
  }

  .site-toolbar__icon {
    min-width: 34px;
    min-height: 34px;
  }
}

</style>
<script>
import { defineAsyncComponent } from 'vue'
import EssentialLink from 'components/EssentialLink.vue'
import userLogin from 'components/userLogin.vue'
import CommandPalette from 'components/CommandPalette.vue'
import BackToTop from 'components/ui/BackToTop.vue'
import ErrorBoundary from 'components/ui/ErrorBoundary.vue'
import KeyboardShortcuts from 'components/ui/KeyboardShortcuts.vue'

const Notifications = defineAsyncComponent(() => import('components/notifications.vue'))
const Queue = defineAsyncComponent(() => import('components/queue.vue'))
const Settings = defineAsyncComponent(() => import('components/settings.vue'))
const PerfPanel = defineAsyncComponent(() => import('components/ui/PerfPanel.vue'))

export default {
  name: 'MainLayout',
  components: {
    EssentialLink,
    userLogin,
    Notifications,
    CommandPalette,
    queue: Queue,
    settings: Settings,
    PerfPanel,
    BackToTop,
    ErrorBoundary,
    KeyboardShortcuts
  },
  mounted () {
    window.addEventListener('hive:open-command-palette', this.openCommandPalette)
    if (this.loggedInUser) this.preloadQueueChunk()
  },
  beforeUnmount () {
    window.removeEventListener('hive:open-command-palette', this.openCommandPalette)
  },
  methods: {
    openCommandPalette () {
      this.leftDrawerOpen = false
      this.$refs.commandPalette?.openPalette()
    },
    openCompose () {
      this.leftDrawerOpen = false
      this.$router.push('/compose').catch(() => {})
    },
    preloadQueueChunk () {
      // Queue is deferred for startup, but a signed-in user may need it while
      // offline. Warm the chunk on idle so it is available from the shell cache.
      const load = () => { import('components/queue.vue').catch(() => {}) }
      if (typeof window !== 'undefined' && typeof window.requestIdleCallback === 'function') {
        window.requestIdleCallback(load, { timeout: 3000 })
      } else {
        window.setTimeout(load, 1500)
      }
    },
    closePerfPanel () {
      const query = { ...this.$route.query }
      delete query.perf
      delete query.debug
      this.$router.replace({ path: this.$route.path, query, hash: this.$route.hash }).catch(() => {})
    }
  },
  computed: {
    loggedInUser: {
      get () { return this.$hiveStore.user.username }
    },
    queue: {
      get () { return this.$hiveStore.queue }
    },
    showPerfPanel () {
      return this.$route.query.perf === '1' || this.$route.query.debug === 'perf'
    }
  },
  watch: {
    $route: function () {
      this.leftDrawerOpen = false
    },
    loggedInUser (value) {
      if (value) this.preloadQueueChunk()
    }
  },
  data () {
    return {
      leftDrawerOpen: false,
      searchSuggestions: null,
      exploreLinks: [
        {
          title: 'Home',
          caption: 'hive.ausbit.dev',
          icon: 'home',
          to: '/'
        },
        {
          title: 'Browse posts',
          caption: 'trending, created, hot',
          icon: 'explore',
          to: '/browse'
        },
        {
          title: 'Latest blocks',
          caption: 'live chain activity',
          icon: 'view_agenda',
          to: '/blocks'
        },
        {
          title: 'Witnesses',
          caption: 'chain governance',
          icon: 'how_to_vote',
          to: '/witnesses'
        },
        {
          title: 'Proposals',
          caption: 'decentralized Hive fund',
          icon: 'account_balance',
          to: '/proposals'
        }
      ],
      toolLinks: [
        {
          title: 'Write a post',
          caption: 'drafts and publishing',
          icon: 'edit_note',
          to: '/compose'
        },
        {
          title: 'HBD monitor',
          caption: 'stability and interest',
          icon: 'attach_money',
          to: '/hbd'
        },
        {
          title: 'Internal market',
          caption: 'trade HIVE and HBD',
          icon: 'store',
          to: '/market'
        },
        {
          title: 'API nodes',
          caption: 'network health',
          icon: 'dns',
          to: '/nodes'
        },
        {
          title: 'Health',
          caption: 'chain status',
          icon: 'monitor_heart',
          to: '/health'
        },
        {
          title: 'Tax export',
          caption: 'transaction CSV',
          icon: 'receipt_long',
          to: '/tax'
        },
        {
          title: 'Create an account',
          caption: 'join Hive',
          icon: 'person_add',
          to: '/create'
        }
      ],
      externalLinks: [
        {
          title: 'Hive onboarding',
          caption: 'hiveonboard.com',
          icon: 'person_add',
          link: 'https://hiveonboard.com?ref=ausbitbank'
        },
        {
          title: 'Developer Docs',
          caption: 'developers.hive.io',
          icon: 'code',
          link: 'https://developers.hive.io'
        },
        {
          title: 'Hive Source',
          caption: 'gitlab.syncad.com/hive',
          icon: 'code',
          link: 'https://gitlab.syncad.com/hive/'
        },
        {
          title: 'Site Source',
          caption: 'github.com/ausbitbank/hive.ausbit.dev-src',
          icon: 'code',
          link: 'https://github.com/ausbitbank/hive.ausbit.dev-src'
        },
        {
          title: 'Hive Discord',
          caption: 'myhive.li/discord',
          icon: 'chat',
          link: 'https://myhive.li/discord'
        },
        {
          title: 'Hive Telegram',
          caption: 't.me/hiveblockchain',
          icon: 'chat',
          link: 'https://t.me/hiveblockchain'
        },
        {
          title: 'OpenHive.chat',
          caption: 'openhive.chat',
          icon: 'chat',
          link: 'https://openhive.chat'
        },
        {
          title: 'Browse with peakD',
          caption: 'peakD.com',
          icon: 'web',
          link: 'https://peakd.com/@ausbitbank'
        },
        {
          title: 'Browse with Hive.blog',
          caption: 'Hive.blog/@ausbitbank',
          icon: 'web_asset',
          link: 'https://hive.blog/@ausbitbank'
        },
        {
          title: 'Trade HIVE on Binance',
          caption: 'Binance.com affiliate link',
          icon: 'monetization_on',
          link: 'https://www.binance.com/en/register?ref=WOL9Y5F6'
        },
        {
          title: 'Trade HIVE on SimpleSwap',
          caption: 'SimpleSwap.io affiliate link',
          icon: 'monetization_on',
          link: 'https://simpleswap.io/?ref=95c23a08220b'
        },
        {
          title: 'Trade HIVE on SwapZone',
          caption: 'SwapZone.io affiliate link',
          icon: 'monetization_on',
          link: 'https://swapzone.io/?refId=HQhLzavlXg'
        },
        {
          title: 'Anonymous Servers for Crypto',
          caption: 'Privex.io affiliate link',
          icon: 'monetization_on',
          link: 'https://www.privex.io/?r=ausbitbank'
        },
        {
          title: 'Project announcement post',
          caption: 'ANN',
          icon: 'help',
          link: 'https://hive.ausbit.dev/@ausbitbank/hive-ausbit-dev-an-open-source-hive-block-explorer-post-viewer-and-more'
        }
      ]
    }
  }
}
</script>
