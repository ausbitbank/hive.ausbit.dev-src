<template>
  <q-layout view="hHh lpR fFf">
    <q-header reveal elevated>
      <q-toolbar reveal elevated class="bg-dark text-primary">
        <q-btn flat dense round icon="menu" aria-label="Menu" @click="leftDrawerOpen = !leftDrawerOpen"/>
        <q-toolbar-title>
          <router-link to="/"><q-icon name="img:statics/hextacular.svg" style="max-width:50%" /></router-link>
          hive.ausbit.dev
        </q-toolbar-title>
        <q-form @submit="onSearchSubmit" @reset="onSearchReset" class="q-mr-md">
          <q-input dark dense borderless v-model="search" input-class="text-right" class="q-ml-md" label="Search Account, Txid or Block">
          <template v-slot:append>
            <q-icon v-if="search !== ''" name="search" @click="onSearchSubmit" />
            <q-icon v-if="search !== ''" name="clear" class="cursor-pointer" @click="search = ''" />
          </template>
        </q-input>
        </q-form>
        <notifications />
        <user-login />
      </q-toolbar>
    </q-header>
    <q-drawer v-model="leftDrawerOpen" side="left" overlay elevated>
      <q-list :class="getBackgroundStyle()">
        <q-item-label header>
          <!-- <q-icon name="img:statics/badge_powered-by-hive_dark.svg" size="lg" /> -->
        </q-item-label>
        <EssentialLink
          v-for="link in essentialLinks"
          :key="link.title"
          v-bind="link"
        />
        <q-item><q-item-section><q-toggle v-model="darkBackgroundToggle" :label="getBackgroundLabel()" /></q-item-section></q-item>
      </q-list>
      <span :class="getBackgroundStyle()"><div class="text-center"><q-icon name="code" color="grey" title="coded" /> with <q-icon name="favorite" color="red" title="love" /> by <router-link to="/@ausbitbank">ausbitbank</router-link></div></span>
    </q-drawer>
    <q-page-container :class="getBackgroundStyle()">
      <router-view />
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
import Notifications from 'src/components/notifications.vue'
export default {
  name: 'MainLayout',
  components: {
    EssentialLink,
    userLogin,
    Notifications
  },
  methods: {
    onSearchSubmit () {
      if (!isNaN(this.search)) {
        this.$router.push('/block/' + this.search)
      } else {
        if (this.search.length === 40) {
          this.$router.push('/tx/' + this.search)
        } else {
          this.$router.push({ path: '/@' + this.search })
        }
      }
    },
    onSearchReset () {
      this.search = ''
    },
    getBackgroundStyle () {
      if (this.darkBackgroundToggle) {
        return null
      } else {
        return 'gradientBg'
      }
    },
    getBackgroundLabel () {
      if (this.darkBackgroundToggle) {
        return 'Dark'
      } else {
        return 'Fabulous'
      }
    }
  },
  computed: {
    loggedInUser: {
      get () { return this.$store.state.hive.user.username }
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
          link: 'https://pay.privex.io/order/?r=ausbitbank'
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
