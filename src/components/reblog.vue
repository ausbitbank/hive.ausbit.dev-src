<template>
  <q-btn no-caps label="Reblog this post" :disabled="reblogged" dense push rounded flat size="md" @click="reblog(author, permlink)" class="capitalize" />
</template>
<script>
// import { keychain } from '@hiveio/keychain'
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
    undoReblog (author, permlink) {
      // a normal reblog, but with delete: delete in the params
      var json = '["reblog",{"account":"' + this.loggedInUser + '","author":"' + author + '","permlink":"' + permlink + '", "delete":"delete"}]'
      this.$store.commit('hive/addToQueue', [this.loggedInUser, 'posting', ['custom_json', { required_posting_auths: [this.loggedInUser], id: 'follow', json: json }]])
    },
    async reblog (author, permlink) {
      var json = '["reblog",{"account":"' + this.loggedInUser + '","author":"' + author + '","permlink":"' + permlink + '"}]'
      this.$store.commit('hive/addToQueue', [this.loggedInUser, 'posting', ['custom_json', { required_posting_auths: [this.loggedInUser], id: 'follow', json: json }]])
      /* const { success, msg, cancel, notInstalled, notActive } = await keychain(window, 'requestCustomJson', this.loggedInUser, 'follow', 'Posting', json, 'Reblog post ' + permlink + ' by ' + author)
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
      } */
    }
  }
}
</script>
