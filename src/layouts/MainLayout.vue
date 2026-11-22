<template>
  <a href="#main-content" class="skip-link">Skip to main content</a>
  <q-layout view="hHh lpR fFf">
    <q-header reveal elevated>
      <q-toolbar class="site-toolbar">
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
          <q-btn class="lt-sm site-toolbar__icon" flat dense round icon="search" aria-label="Open the full Hive search page" title="Search Hive" @click="openSearch" />
          <q-btn class="site-toolbar__icon site-toolbar__cta" flat dense no-caps icon="edit_note" aria-label="Write a post" title="Write a post" @click="openCompose"><span class="site-toolbar__cta-label gt-xs">Write</span></q-btn>
          <queue v-if="loggedInUser !== null && queue.length > 0" />
          <notifications v-if="loggedInUser !== null" />
          <user-login />
          <q-btn class="site-toolbar__icon" dense flat round icon="settings" title="Settings" aria-label="Settings" color="grey"><q-popup-proxy anchor="bottom right" self="top right" :offset="[0, 8]"><settings /></q-popup-proxy></q-btn>
        </div>
      </q-toolbar>
    </q-header>
    <q-drawer v-model="leftDrawerOpen" side="left" overlay elevated class="site-drawer" :width="300">
      <div class="site-nav__scroll">
        <q-list class="site-nav" role="navigation" aria-label="Site navigation" @click="leftDrawerOpen = false">
          <q-item-label header class="site-nav__brand">
            <a
              href="https://hive.io"
              target="_blank"
              rel="noopener noreferrer"
              title="Powered by Hive"
              aria-label="Powered by Hive"
              class="site-nav__badge"
            >
              <img
                src="/statics/badge_powered-by-hive_dark.svg"
                alt="Powered by Hive"
                class="site-nav__badge-img"
              />
            </a>
          </q-item-label>

          <div class="site-nav__quick">
            <q-item clickable class="site-nav__quick-item" @click="openSearch">
              <q-item-section avatar><q-icon name="manage_search" /></q-item-section>
              <q-item-section>
                <q-item-label>Search Hive</q-item-label>
                <q-item-label caption>Accounts, posts and tags</q-item-label>
              </q-item-section>
            </q-item>
            <q-item clickable class="site-nav__quick-item" @click="openCommandPalette">
              <q-item-section avatar><q-icon name="bolt" /></q-item-section>
              <q-item-section>
                <q-item-label>Quick jump</q-item-label>
                <q-item-label caption>Jump to any page</q-item-label>
              </q-item-section>
              <q-item-section side>
                <kbd class="site-nav__kbd">Ctrl K</kbd>
              </q-item-section>
            </q-item>
          </div>

          <q-item-label header class="site-nav__heading">Explore</q-item-label>
          <q-item
            v-for="link in exploreLinks"
            :key="link.title"
            clickable
            :to="link.to"
            :active="isActiveLink(link)"
          >
            <q-item-section avatar><q-icon :name="link.icon" aria-hidden="true" /></q-item-section>
            <q-item-section>
              <q-item-label>{{ link.title }}</q-item-label>
              <q-item-label caption :title="link.caption">{{ link.caption }}</q-item-label>
            </q-item-section>
          </q-item>
          <q-item-label header class="site-nav__heading">Tools</q-item-label>
          <q-item
            v-for="link in toolLinks"
            :key="link.title"
            clickable
            :to="link.to"
            :active="isActiveLink(link)"
          >
            <q-item-section avatar><q-icon :name="link.icon" aria-hidden="true" /></q-item-section>
            <q-item-section>
              <q-item-label>{{ link.title }}</q-item-label>
              <q-item-label caption :title="link.caption">{{ link.caption }}</q-item-label>
            </q-item-section>
          </q-item>
          <q-item-label header class="site-nav__heading">Community &amp; links</q-item-label>
          <EssentialLink
            v-for="link in externalLinks"
            :key="link.title"
            v-bind="link"
          />
        </q-list>
      </div>
      <div class="site-nav__footer">
        <span class="site-nav__footer-line">
          <q-icon name="code" size="15px" aria-hidden="true" /> with
          <q-icon name="favorite" size="15px" class="site-nav__heart" aria-label="love" /> by
          <router-link to="/@ausbitbank">ausbitbank</router-link>
        </span>
        <span class="site-nav__footer-tag">hive.ausbit.dev · open source Hive explorer</span>
      </div>
    </q-drawer>
    <q-page-container id="main-content" tabindex="-1">
      <error-boundary :key="$route.path">
        <router-view />
      </error-boundary>
      <footer class="site-footer" aria-label="Site footer">
        <nav class="site-footer__links" aria-label="Footer navigation">
          <router-link to="/created">Browse</router-link>
          <router-link to="/communities">Communities</router-link>
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
  border-bottom: 1px solid var(--border-subtle);
  background: var(--c-header);
  color: var(--c-text);
  box-shadow: 0 1px 0 var(--c-border-subtle);
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
  color: var(--c-link-hover);
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
  border-radius: var(--radius-pill);
  color: var(--c-text-muted);
}

.site-toolbar__icon:hover {
  background: var(--c-overlay);
  color: var(--c-text-strong);
}

.site-toolbar__cta {
  gap: 0.3rem;
  padding: 0 0.6rem 0 0.4rem;
  border: 1px solid var(--border-subtle);
  background: var(--c-overlay-weak);
  color: var(--c-text);
}

.site-toolbar__cta:hover {
  border-color: color-mix(in srgb, var(--c-primary) 40%, transparent);
  background: color-mix(in srgb, var(--c-primary) 10%, transparent);
}

.site-toolbar__cta-label {
  font-size: 0.8rem;
  font-weight: 600;
}

.site-drawer {
  background: var(--c-drawer) !important;
  border-right: 1px solid var(--border-subtle);
}

.site-nav__scroll {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  overscroll-behavior: contain;
}

.site-nav__brand {
  padding: var(--space-4) var(--space-4) var(--space-2);
  min-height: 0;
}

.site-nav__badge {
  display: inline-flex;
  padding: 0.3rem 0.55rem;
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-sm);
  background: var(--c-overlay-weak);
  text-decoration: none;
}

.site-nav__badge:hover {
  border-color: color-mix(in srgb, var(--c-primary) 40%, transparent);
  text-decoration: none;
}

.site-nav__badge-img {
  display: block;
  height: 28px;
  width: auto;
}

.site-nav__quick {
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding: 0 var(--space-2) var(--space-2);
}

.site-nav__quick .q-item {
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-sm);
  background: var(--c-overlay-weak);
}

.site-nav__quick .q-item:hover {
  border-color: color-mix(in srgb, var(--c-primary) 35%, transparent);
  background: color-mix(in srgb, var(--c-primary) 8%, transparent);
}

.site-nav__quick .q-item__section--avatar .q-icon {
  color: var(--c-link);
}

.site-nav__kbd {
  padding: 0.05rem 0.3rem;
  border: 1px solid var(--border-subtle);
  border-radius: 4px;
  background: var(--c-overlay-weak);
  color: var(--c-text-faint);
  font-family: monospace;
  font-size: 0.65rem;
}

.site-nav__heading {
  padding: var(--space-3) var(--space-4) var(--space-1);
  min-height: 0;
  color: var(--c-text-faint);
  font-size: 0.66rem;
  font-weight: 600;
  letter-spacing: 0.07em;
  line-height: 1.3;
  text-transform: uppercase;
}

.site-nav {
  padding: 0 var(--space-2) var(--space-3);
}

.site-nav .q-item {
  min-height: 46px;
  padding-top: 6px;
  padding-bottom: 6px;
  border-radius: var(--radius-sm);
  color: var(--c-text-soft);
  transition: background 0.15s ease, color 0.15s ease;
}

.site-nav .q-item:hover {
  background: color-mix(in srgb, var(--c-primary) 8%, transparent);
  color: var(--c-text-strong);
}

.site-nav .q-item.q-router-link--active,
.site-nav .q-item--active {
  background: color-mix(in srgb, var(--c-primary) 10%, transparent);
  box-shadow: inset 2px 0 0 var(--c-link);
  color: var(--c-text-strong);
}

.site-nav .q-item__section--avatar {
  min-width: 40px;
  padding-right: 0.6rem;
}

.site-nav .q-item__section--avatar .q-icon {
  color: var(--c-text-faint);
  font-size: 20px;
}

.site-nav .q-item:hover .q-item__section--avatar .q-icon,
.site-nav .q-item.q-router-link--active .q-item__section--avatar .q-icon {
  color: var(--c-link);
}

.site-nav .q-item__label--caption {
  margin-top: 1px;
  overflow: hidden;
  color: var(--c-text-faint);
  font-size: 0.72rem;
  line-height: 1.35;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.site-nav__footer {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
  margin-top: auto;
  padding: var(--space-3) var(--space-4) var(--space-4);
  border-top: 1px solid var(--border-subtle);
  color: var(--c-text-subtle);
  font-size: 0.76rem;
  text-align: center;
}

.site-nav__footer-line {
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
}

.site-nav__footer-line .q-icon {
  font-size: 1.05em;
  color: var(--c-text-faint);
}

.site-nav__footer-line .site-nav__heart {
  color: var(--c-negative);
}

.site-nav__footer-line a {
  color: var(--c-link);
  font-weight: 600;
  text-decoration: none;
}

.site-nav__footer-tag {
  color: var(--c-text-faint);
  font-size: 0.68rem;
}

.command-trigger {
  gap: 0.4rem;
  min-width: 255px;
  max-width: 350px;
  min-height: 36px;
  padding: 0.2rem 0.55rem;
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-pill);
  background: var(--c-overlay-weak);
  color: var(--c-text-subtle);
  font-size: 0.8rem;
  text-transform: none;
}

.command-trigger:hover {
  border-color: color-mix(in srgb, var(--c-primary) 45%, transparent);
  color: var(--c-text);
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
  background: var(--c-overlay-weak);
  color: var(--c-text-faint);
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
    window.addEventListener('hive:open-search', this.openSearch)
    if (this.loggedInUser) this.preloadQueueChunk()
  },
  beforeUnmount () {
    window.removeEventListener('hive:open-command-palette', this.openCommandPalette)
    window.removeEventListener('hive:open-search', this.openSearch)
  },
  methods: {
    openCommandPalette () {
      if (this.$route.name === 'search') {
        // The search page has its own full-surface search; Ctrl K focuses it
        // instead of stacking the quick-jump palette on top.
        window.dispatchEvent(new CustomEvent('hive:open-search'))
        return
      }
      this.leftDrawerOpen = false
      this.$refs.commandPalette?.openPalette()
    },
    openCompose () {
      this.leftDrawerOpen = false
      this.$router.push('/compose').catch(() => {})
    },
    openSearch () {
      this.leftDrawerOpen = false
      this.$router.push('/search').catch(() => {})
    },
    isActiveLink (link) {
      if (!link.to) return false
      if (link.to === '/') return this.$route.path === '/'
      return this.$route.path === link.to || this.$route.path.startsWith(link.to + '/')
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
          title: 'Communities',
          caption: 'discover and join',
          icon: 'forum',
          to: '/communities'
        },
        {
          title: 'Short posts',
          caption: 'snaps, waves, threads, D.Buzz',
          icon: 'bolt',
          to: '/shorts'
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
          title: 'Search Hive',
          caption: 'accounts, posts, tags',
          icon: 'search',
          to: '/search'
        },
        {
          title: 'Write a post',
          caption: 'drafts and publishing',
          icon: 'edit_note',
          to: '/compose'
        },
        {
          title: 'Appearance',
          caption: 'themes and profile skins',
          icon: 'palette',
          to: '/appearance'
        },
        {
          title: 'Lightning',
          caption: 'sats to Hive and back',
          icon: 'bolt',
          to: '/lightning'
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
          title: 'Magi contracts',
          caption: 'layer-2 explorer',
          icon: 'hub',
          to: '/magi'
        },
        {
          title: 'Health',
          caption: 'chain status',
          icon: 'monitor_heart',
          to: '/health'
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
