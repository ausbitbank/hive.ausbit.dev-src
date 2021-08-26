<template>
  <q-layout view="hHh lpR fFf">
    <q-header reveal elevated>
      <q-toolbar reveal elevated class="bg-dark text-primary q-electron-drag">
        <q-btn flat dense round icon="menu" aria-label="Menu" @click="leftDrawerOpen = !leftDrawerOpen"/>
        <q-toolbar-title>
          <router-link to="/" class="q-electron-drag--exception text-primary" style="font-weight: normal"><q-icon name="img:statics/hive.svg" style="max-width:50%" /> hive.ausbit.dev </router-link>
        </q-toolbar-title>
        <searchbox />
        <queue v-if="loggedInUser !== null && queue.length > 0" />
        <notifications v-if="loggedInUser !== null" />
        <user-login />
        <span v-if="$q.platform.is.electron">
        <q-btn dense flat icon="cached" title="refresh" @click="refresh" />
        <q-btn dense flat icon="minimize" title="minimize" @click="minimize" />
        <q-btn dense flat icon="crop_square" title="maximize" @click="maximize" />
        <q-btn dense flat icon="close" title="close" @click="closeApp" />
        </span>
      </q-toolbar>
    </q-header>
    <q-drawer v-model="leftDrawerOpen" side="left" overlay elevated>
      <q-list>
        <q-item-label header>
          <!-- <q-icon name="img:statics/badge_powered-by-hive_dark.svg" size="lg" /> -->
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
      <router-view :class="backgroundStyle" />
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
import EssentialLink from 'components/EssentialLink'
import userLogin from 'components/userLogin.vue'
import Notifications from 'components/notifications.vue'
import searchbox from 'components/searchbox.vue'
import queue from 'components/queue.vue'
export default {
  name: 'MainLayout',
  components: {
    EssentialLink,
    userLogin,
    Notifications,
    searchbox,
    queue
  },
  methods: {
    minimize () {
      if (process.env.MODE === 'electron') {
        this.$q.electron.remote.BrowserWindow.getFocusedWindow().minimize()
      }
    },
    maximize () {
      if (process.env.MODE === 'electron') {
        const win = this.$q.electron.remote.BrowserWindow.getFocusedWindow()
        if (win.isMaximized()) {
          win.unmaximize()
        } else {
          win.maximize()
        }
      }
    },
    closeApp () {
      if (process.env.MODE === 'electron') {
        this.$q.electron.remote.BrowserWindow.getFocusedWindow().close()
      }
    },
    refresh () {
      window.location.reload()
    }
  },
  computed: {
    loggedInUser: {
      get () { return this.$store.state.hive.user.username }
    },
    queue: {
      get () { return this.$store.state.hive.queue }
    },
    backgroundStyle: function () {
      if (this.$store.state.hive.user.settings.darkBackground) {
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
          title: 'Trade HIVE on Bittrex',
          caption: 'Bittrex.com affiliate link',
          icon: 'monetization_on',
          link: 'https://bittrex.com/Account/Register?referralCode=PPA-HMA-3VD'
        },
        {
          title: 'Trade HIVE on Ionomy',
          caption: 'Ionomy.com affiliate link',
          icon: 'monetization_on',
          link: 'https://ionomy.com/en/aff/c91aa3ae712e0ab1d5eb1cd8c007bc70'
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
