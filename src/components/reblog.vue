<template>
  <q-btn label="Reblog this post" :disabled="reblogged" dense push rounded flat size="md" @click="reblog(author, permlink)"/>
</template>
<script>
import { keychain } from '@hiveio/keychain'
export default {
  name: 'reblog',
  data () {
    return {
      reblogged: false
    }
  },
  props: ['author', 'permlink'],
  computed: {
    loggedInUser: {
      get () { return this.$store.state.hive.user.username }
    }
  },
  methods: {
    async reblog (author, permlink) {
      var json = '["reblog",{"account":"' + this.loggedInUser + '","author":"' + author + '","permlink":"' + permlink + '"}]'
      const { success, msg, cancel, notInstalled, notActive } = await keychain(window, 'requestCustomJson', this.loggedInUser, 'follow', 'Posting', json, 'Reblog post ' + permlink + ' by ' + author)
      if (success) {
        this.$q.notify('Reblogged post ' + permlink + ' by ' + author + ' as ' + this.loggedInUser)
        this.reblogged = true
      }
      if (!cancel) {
        if (notActive) {
          console.error('Please allow Keychain to access this website')
        } else if (notInstalled) { // alert('Please install Keychain')
          console.error('Keychain not available')
        } else {
          console.info(msg)
        }
      }
    }
  }
}
</script>
