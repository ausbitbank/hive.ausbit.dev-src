<template>
  <q-layout view="lHh Lpr lFf">
    <q-header elevated>
      <q-toolbar>
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

      </q-toolbar>
    </q-header>

    <q-drawer
      v-model="leftDrawerOpen"
      show-if-above
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

  data () {
    return {
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
          title: 'Hive Discord',
          caption: 'discord.gg/ZcG7jgX',
          icon: 'chat',
          link: 'https://discord.gg/ZcG7jgX'
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
