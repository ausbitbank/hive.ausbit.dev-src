<template>
  <a href="#main-content" class="skip-link">Skip to main content</a>
  <q-layout view="hHh lpR fFf">
    <q-header reveal elevated>
      <q-toolbar class="bg-dark text-primary">
        <q-btn flat dense round icon="menu" aria-label="Menu" title="Menu" @click="leftDrawerOpen = !leftDrawerOpen"/>
        <q-toolbar-title>
          <router-link to="/" class="text-primary" style="font-weight: normal" aria-label="hive.ausbit.dev home">
            <q-icon name="img:/statics/hive.svg" style="max-width:50%" aria-hidden="true" />
            <span class="gt-xs">hive.ausbit.dev</span>
          </router-link>
        </q-toolbar-title>
        <div class="gt-xs"><searchbox /></div>
        <q-btn class="lt-sm" flat dense round icon="search" aria-label="Search" title="Search" @click="mobileSearchOpen = true" />
        <queue v-if="loggedInUser !== null && queue.length > 0" />
        <notifications v-if="loggedInUser !== null" />
        <user-login />
        <q-btn dense flat icon="settings" title="Settings" aria-label="Settings" color="grey"><q-popup-proxy><settings /></q-popup-proxy></q-btn>
      </q-toolbar>
    </q-header>
    <q-dialog v-model="mobileSearchOpen" position="top" full-width>
      <q-card class="mobile-search-card">
        <div class="mobile-search-header">
          <div>
            <div class="mobile-search-title"><q-icon name="search" aria-hidden="true" /> Search Hive</div>
            <div class="mobile-search-hint">Account, @account/post, #tag, block number or transaction id.</div>
          </div>
          <q-btn flat dense round icon="close" aria-label="Close search" title="Close search" v-close-popup />
        </div>
        <q-card-section class="q-pt-none">
          <searchbox autofocus full-width @submitted="mobileSearchOpen = false" />
        </q-card-section>
      </q-card>
    </q-dialog>
    <q-drawer v-model="leftDrawerOpen" side="left" overlay elevated>
      <q-list @click="leftDrawerOpen = false">
        <q-item-label header>
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
        <q-item-label header class="text-overline text-grey-5 q-py-none">Explore</q-item-label>
        <EssentialLink
          v-for="link in exploreLinks"
          :key="link.title"
          v-bind="link"
        />
        <q-item-label header class="text-overline text-grey-5 q-py-none">Tools</q-item-label>
        <EssentialLink
          v-for="link in toolLinks"
          :key="link.title"
          v-bind="link"
        />
        <q-separator spaced />
        <q-item-label header class="text-overline text-grey-5 q-py-none">Community &amp; links</q-item-label>
        <EssentialLink
          v-for="link in externalLinks"
          :key="link.title"
          v-bind="link"
        />
      </q-list>
      <div class="text-center q-pb-md"><q-icon name="code" color="grey" title="coded" aria-label="coded" /> with <q-icon name="favorite" color="red" title="love" aria-label="love" /> by <router-link to="/@ausbitbank">ausbitbank</router-link></div>
    </q-drawer>
    <q-page-container id="main-content" tabindex="-1">
      <router-view :key="$route.fullPath" :class="backgroundStyle" />
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
  </q-layout>
</template>
<style>
.gradientBg {
background: linear-gradient(-45deg, #9C27B0, #E31337, #3E92CC, #23d5ab); /* -45deg, #ee7752, #e73c7e, #23a6d5, #23d5ab */
background-size: 400% 400%;
animation: gradient 15s ease infinite;
}

@keyframes gradient {
0% {background-position: 0% 50%;}
50% {background-position: 100% 50%;}
100% {background-position: 0% 50%;}
}
</style>
<script>
import EssentialLink from 'components/EssentialLink.vue'
import userLogin from 'components/userLogin.vue'
import Notifications from 'components/notifications.vue'
import searchbox from 'components/searchbox.vue'
import queue from 'components/queue.vue'
import settings from 'components/settings.vue'
export default {
  name: 'MainLayout',
  components: {
    EssentialLink,
    userLogin,
    Notifications,
    searchbox,
    queue,
    settings
  },
  computed: {
    loggedInUser: {
      get () { return this.$hiveStore.user.username }
    },
    queue: {
      get () { return this.$hiveStore.queue }
    },
    backgroundStyle: function () {
      if (this.$hiveStore.user.settings.darkBackground) {
        return ''
      } else {
        return 'gradientBg'
      }
    }
  },
  watch: {
    $route: function () {
      this.leftDrawerOpen = false
      this.mobileSearchOpen = false
    }
  },
  data () {
    return {
      leftDrawerOpen: false,
      mobileSearchOpen: false,
      searchSuggestions: null,
      darkBackgroundToggle: true,
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
