<template>
  <span>
    <q-btn size="sm" dense flat :icon="upvoteIcon" color="green" :label="upvoteLabel" @click="voteClicked('up')" :disable="disableVoting" v-if="direction === null || direction === 'up'" class="hvr" />
    <q-btn size="sm" dense flat :icon="downvoteIcon" color="red" :label="downvoteLabel" @click="voteClicked('down')" :disable="disableVoting" v-if="direction === null || direction === 'down'" class="hvr" />
    <q-knob v-model="upvotePercent" :min="1" :max="100" :step="5" show-value color="green" v-if="weight > 0 && direction === 'up' && !voteSent"> {{ upvotePercent }} %</q-knob>
    <q-knob v-model="downvotePercent" :min="1" :max="100" :step="5" show-value color="red" v-if="weight < 0 && direction === 'down' && !voteSent"> {{ downvotePercent }} % </q-knob>
    <q-btn dense flat round icon="clear" title="Close" @click="direction = null" v-if="direction !== null && !voteSent" class="hvr" />
  </span>
</template>
<script>
// import { keychain } from '@hiveio/keychain'
export default {
  name: 'vote',
  props: ['votes', 'active_votes', 'author', 'permlink'],
  data () {
    return {
      weight: this.$store.state.hive.user.settings.voteWeightPost,
      voteSent: false,
      voteSentWeight: null,
      direction: null
    }
  },
  computed: {
    loggedInUser: {
      get () { return this.$store.state.hive.user.username }
    },
    upvotes () {
      if (this.votes) {
        return this.votes.filter(v => Math.sign(v.rshares) === 1)
      } else {
        return null
      }
    },
    downvotes () {
      if (this.votes) {
        return this.votes.filter(v => Math.sign(v.rshares) === -1)
      } else {
        return null
      }
    },
    myVote: function () {
      if (this.voteSentWeight !== null) {
        return { voter: this.loggedInUser, weight: this.voteSentWeight, author: this.author, permlink: this.permlink, rshares: this.voteSentWeight }
      } else {
        if (this.votes) {
          return this.votes.filter(this.filterMyVote)[0]
        } else {
          return undefined
        }
      }
    },
    disableVoting: function () {
      if (this.loggedInUser === undefined) { return true }
      if (this.myVote === undefined) { return false } else { return true }
    },
    upvotePercent: {
      get () {
        if (this.weight > 0) {
          return this.weight
        } else {
          return 0
        }
      },
      set (val) {
        this.weight = val
      }
    },
    downvotePercent: {
      get () {
        if (this.weight < 0) {
          return Math.abs(this.weight)
        } else {
          return 0
        }
      },
      set (val) {
        this.weight = val * -1
      }
    },
    upvoteLabel: function () {
      if (this.upvotes) {
        return this.upvotes.length
      } else {
        return null
      }
    },
    downvoteLabel: function () {
      if (this.downvotes) {
        return this.downvotes.length
      } else {
        return null
      }
    },
    voteColor: function () {
      if (Math.sign(this.weight) !== -1) { if (Math.sign(this.weight) === 0) { return 'grey' } return 'green' } else { return 'red' }
    },
    voteIcon: function () {
      if (Math.sign(this.weight) !== -1) { if (Math.sign(this.weight) === 0) { return 'cancel' } return 'thumb_up' } else { return 'thumb_down' }
    },
    upvoteIcon: function () {
      if (this.myVote !== undefined) {
        if (Math.sign(this.myVote.rshares) === 1) {
          return 'thumb_up'
        } else {
          return 'thumb_up_off_alt'
        }
      } else {
        return 'thumb_up_off_alt'
      }
    },
    downvoteIcon: function () {
      if (this.myVote !== undefined) {
        if (Math.sign(this.myVote.rshares) === -1) {
          return 'thumb_down'
        } else {
          return 'thumb_down_off_alt'
        }
      } else {
        return 'thumb_down_off_alt'
      }
    },
    voteLabel: function () {
      if (Math.sign(this.weight) !== -1) { if (Math.sign(this.weight) === 0) { return 'Cancel vote on this post' } return this.votePercentBuffer + '% upvote this post' } else { return this.votePercentBuffer + '% downvote this post' }
    },
    votePercentBuffer: function () {
      if (this.weight > 100) { return 100 }
      if (this.weight < -100) { return 100 }
      return this.weight
    }
  },
  watch: {
  },
  methods: {
    voteClicked (d) {
      if (this.direction === d) { // second click, vote
        this.direction = null
        this.vote(this.permlink, this.author, this.weight)
      } else {
        this.direction = d
        if (d === 'up') {
          this.weight = this.$store.state.hive.user.settings.voteWeightPost || 100
        } else {
          this.weight = -100
        }
      }
      this.direction = d
    },
    getHiveAvatarUrl (user) { return 'https://images.hive.blog/u/' + user + '/avatar' },
    getAccountLink (user) { return '/@' + user },
    getWalletLink (user) { return '/@' + user + '/wallet' },
    async vote (permlink, author, weight) {
      this.voteSent = true
      this.voteSentWeight = weight
      this.$store.commit('hive/addToQueue', [this.loggedInUser, 'posting', ['vote', { voter: this.loggedInUser, weight: weight * 100, author: author, permlink: permlink }]])
      /* const { success, msg, cancel, notInstalled, notActive } = await keychain(window, 'requestVote', this.loggedInUser, permlink, author, weight * 100)
      if (success) {
        this.$q.notify('Voted ' + weight + '% on @' + author + '/' + permlink)
        this.$emit('Voted', weight)
      }
      if (cancel) { this.voteSent = false }
      if (!cancel) {
        if (notActive) {
          console.error('Please allow Keychain to access this website')
          this.voteSent = false
        } else if (notInstalled) { // alert('Please install Keychain')
          console.error('Keychain not available')
          this.voteSent = false
        } else {
          console.info(msg)
        }
      } */
    },
    filterMyVote (op) { if (op.voter === this.loggedInUser) { return true } else { return false } }
  },
  mounted () {
  }
}
</script>
