<template>
  <div>
    <span v-if="myVote && !voteSent">
      <div>Already voted on this post at {{ myVote.percent / 100 }}%</div>
      <div class="q-pa-md">
        <q-list dense>
          <q-item>
            <q-item-section>
              <q-slider v-model="weight" :min="-100" :max="100" label :color="voteColor" />
            </q-item-section>
          </q-item>
          <q-item>
            <q-item-section>
              <q-btn push :icon="voteIcon" :color="voteColor" :label="voteLabel" @click="vote(permlink, author, weight)" v-if="myVote.percent !== weight * 100"/>
            </q-item-section>
          </q-item>
        </q-list>
      </div>
    </span>
    <span v-else-if="voteSent">
      Voted at {{ weight }} %
    </span>
    <span v-else>
      <div class="q-pa-md">
        <q-list dense>
          <q-item>
            <q-item-section>
              <q-slider v-model="weight" :min="-100" :max="100" label :color="voteColor" />
            </q-item-section>
          </q-item>
          <q-item>
            <q-item-section>
              <q-btn push :icon="voteIcon" :color="voteColor" :label="voteLabel" @click="vote(permlink, author, weight)" />
            </q-item-section>
          </q-item>
        </q-list>
      </div>
    </span>
  </div>
</template>
<script>
import { keychain } from '@hiveio/keychain'
export default {
  name: 'vote',
  props: ['votes', 'active_votes', 'author', 'permlink'],
  data () {
    return {
      weight: 100, // TODO move default vote weight to stored per user setting
      voteSent: false
    }
  },
  computed: {
    loggedInUser: {
      get () { return this.$store.state.hive.user.username }
    },
    myVote: function () {
      return this.active_votes.filter(this.filterMyVote)[0]
    },
    voteColor: function () {
      if (Math.sign(this.weight) !== -1) { if (Math.sign(this.weight) === 0) { return 'grey' } return 'green' } else { return 'red' }
    },
    voteIcon: function () {
      if (Math.sign(this.weight) !== -1) { if (Math.sign(this.weight) === 0) { return 'cancel' } return 'thumb_up' } else { return 'thumb_down' }
    },
    voteLabel: function () {
      if (Math.sign(this.weight) !== -1) { if (Math.sign(this.weight) === 0) { return 'Undo vote on this post' } return 'Upvote this post at ' + this.weight + '%' } else { return 'Downvote this post at ' + this.weight + '%' }
    }
  },
  methods: {
    getHiveAvatarUrl (user) { return 'https://images.hive.blog/u/' + user + '/avatar' },
    getAccountLink (user) { return '/@' + user },
    getWalletLink (user) { return '/@' + user + '/wallet' },
    async vote (permlink, author, weight) {
      const { success, msg, cancel, notInstalled, notActive } = await keychain(window, 'requestVote', this.loggedInUser, permlink, author, weight * 100)
      if (success) {
        this.voteSent = true
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
    },
    filterMyVote (op) { if (op.voter === this.loggedInUser) { return true } else { return false } }
  },
  mounted () {
    /* if (this.$q.localStorage.getItem('savedUsers') === null) {
      this.savedUsers = []
    } else {
      this.savedUsers = this.$q.localStorage.getItem('savedUsers')
    } */
  }
}
</script>
