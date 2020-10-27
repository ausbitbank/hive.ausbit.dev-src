<template>
  <q-layout view="lHh Lpr lFf">
    <q-header elevated>
      <q-toolbar class="bg-dark text-primary">
        <q-btn
          flat
          dense
          round
          icon="menu"
          aria-label="Menu"
          @click="leftDrawerOpen = !leftDrawerOpen"
        />

        <q-toolbar-title>
          <router-link to="/"><q-icon name="img:statics/hextacular.svg" style="max-width:50%" /></router-link>
          hive.ausbit.dev
        </q-toolbar-title>
        <q-form @submit="onSearchSubmit" @reset="onSearchReset">
          <q-input dark dense borderless v-model="search" input-class="text-right" class="q-ml-md" label="Account, Txid or Block">
          <template v-slot:append>
            <q-icon v-if="search === ''" name="search" />
            <q-icon v-else name="clear" class="cursor-pointer" @click="search = ''" />
          </template>
        </q-input>
        </q-form>
      </q-toolbar>
    </q-header>

    <q-drawer
      v-model="leftDrawerOpen"
      bordered
    >
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
    </q-drawer>

    <q-page-container>
      <router-view />
    </q-page-container>
  </q-layout>
</template>

<script>
import EssentialLink from 'components/EssentialLink'
export default {
  name: 'MainLayout',
  components: {
    EssentialLink
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
    }
  },
  data () {
    return {
      search: '',
      leftDrawerOpen: false,
      searchSuggestions: null,
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
          caption: 'github.com/openhive-network',
          icon: 'code',
          link: 'https://github.com/openhive-network'
        },
        {
          title: 'Hive Discord',
          caption: 'discord.gg/xHKUjeC',
          icon: 'chat',
          link: 'https://discord.gg/xHKUjeC'
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
        }
      ]
    }
  }
}
</script>
