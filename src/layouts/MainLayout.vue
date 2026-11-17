<template>
  <q-layout view="hHh lpR fFf">
    <q-header reveal elevated>
      <q-toolbar class="bg-dark text-primary">
        <q-btn flat dense round icon="menu" aria-label="Menu" @click="leftDrawerOpen = !leftDrawerOpen"/>
        <q-toolbar-title>
          <router-link to="/" class="text-primary" style="font-weight: normal"><q-icon name="img:/statics/hive.svg" style="max-width:50%" /> hive.ausbit.dev </router-link>
        </q-toolbar-title>
        <searchbox />
        <queue v-if="loggedInUser !== null && queue.length > 0" />
        <notifications v-if="loggedInUser !== null" />
        <user-login />
        <q-btn dense flat icon="settings" title="Settings" color="grey"><q-popup-proxy><settings /></q-popup-proxy></q-btn>
      </q-toolbar>
    </q-header>
    <q-drawer v-model="leftDrawerOpen" side="left" overlay elevated>
      <q-list>
        <q-item-label header>
          <a
            href="https://hive.io"
            target="_blank"
            rel="noopener"
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
        <EssentialLink
          v-for="link in essentialLinks"
          :key="link.title"
          v-bind="link"
        />
      </q-list>
      <div class="text-center"><q-icon name="code" color="grey" title="coded" /> with <q-icon name="favorite" color="red" title="love" /> by <router-link to="/@ausbitbank">ausbitbank</router-link></div>
    </q-drawer>
    <q-page-container>
      <router-view :key="$route.fullPath" :class="backgroundStyle" />
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
  data () {
    return {
      search: '',
      leftDrawerOpen: false,
      searchSuggestions: null,
      darkBackgroundToggle: true,
      essentialLinks: [
        {
          title: 'Front page',
          caption: 'hive.ausbit.dev',
          icon: 'home',
          link: 'https://hive.ausbit.dev'
        },
        {
          title: 'Create an Account',
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
