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
          <a href="https://hive.ausbit.dev"><q-icon name="img:statics/hextacular.svg" style="max-width:50%" /></a>
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
      console.log('Searching ' + this.search)
      if (!isNaN(this.search)) {
        console.log('searching for block ' + this.search)
        this.$router.push('/block/' + this.search)
        this.$router.go()
      } else {
        if (this.search.length === 40) {
          console.log('searching for txid ' + this.search)
          this.$router.push('/tx/' + this.search)
          this.$router.go()
        } else {
          console.log('searching for account ' + this.search)
          this.$router.push('/@' + this.search)
          this.$router.go()
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
      essentialLinks: [
        {
          title: 'Create an Account',
          caption: 'signup.hive.io',
          icon: 'person_add',
          link: 'https://signup.hive.io'
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
        }
      ]
    }
  }
}
</script>
