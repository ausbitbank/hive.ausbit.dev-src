<template>
<q-card-section dense class="text-center q-my-none q-pb-xs q-pt-xs">
  <q-btn color="blue-grey" icon="push_pin" v-if="post.stats && post.stats.is_pinned" label="Pinned" flat dense />
  <router-link :to="linkAccount(post.author)"><q-avatar size="sm"><q-img :src="getHiveAvatarUrl(post.author)" /></q-avatar> {{ post.author }}</router-link>
  <router-link :to="linkCommunity(post.community)"><q-chip color="blue-grey" dense v-if="post.community_title"><q-avatar><img :src="getHiveAvatarUrl(post.community)" size=""></q-avatar> {{ post.community_title }}</q-chip></router-link>
  <q-chip color="blue-grey-10" dense v-if="post.author_role">{{ post.author_role }}</q-chip>
  <span v-if="post.author_title" class="text-caption">{{ post.author_title }}</span>
  <span class="text-caption text-center text-grey">  {{ timeDelta(post.created) }}</span>
  <q-btn dense icon="comment" flat color="blue-grey" :label="post.children">
    <q-popup-proxy>
      <commentBox :parent_author="post.author" :parent_permlink="post.permlink" />
    </q-popup-proxy>
  </q-btn>
  <q-btn flat dense>
    <q-icon name="img:statics/hive.svg" color="secondary" class="q-mr-sm" v-if="!post.token" />
    <span title="Hive Rewards" v-if="!post.is_paidout && post.pending_payout_value">{{ post.pending_payout_value.split(' ')[0] }}</span>
    <span title="Token Rewards" v-else-if="!post.is_paidout && post.pending_token && post.precision">{{ post.pending_token / Math.pow(10, post.precision) }} {{ post.token }}</span>
    <span title="Hive Rewards" v-else>{{ post.payout }}</span>
  </q-btn>
  <vote v-on:Voted="showVoteEarly" :votes="post.active_votes" :author="post.author" :permlink="post.permlink" />
  <q-btn dense icon="more_horiz" flat color="grey">
    <q-popup-proxy>
      <q-list>
        <q-item clickable @click="postDialogVisible = true">
          <q-item-section avatar>
            <q-icon name="visibility" color="primary" />
          </q-item-section>
          <q-item-section>
            View post in dialog
          </q-item-section>
        </q-item>
        <q-item>
          <q-item-section avatar>
            <q-icon name="share" color="red" />
          </q-item-section>
          <q-item-section>
            <reblog :author="post.author" :permlink="post.permlink" />
          </q-item-section>
        </q-item>
      </q-list>
    </q-popup-proxy>
  </q-btn>
  <q-dialog v-model="postDialogVisible">
    <postDialog :post="post" />
  </q-dialog>
</q-card-section>
</template>
<script>
import moment from 'moment'
export default {
  name: 'postFooter',
  props: ['post'],
  data () {
    return {
      votedWeight: null,
      postDialogVisible: false
    }
  },
  components: {
    reblog: () => import('components/reblog.vue'),
    vote: () => import('components/vote.vue'),
    postDialog: () => import('components/postDialog.vue'),
    commentBox: () => import('components/commentBox.vue')
  },
  computed: {
    loggedInUser: {
      get () { return this.$store.state.hive.user.username }
    },
    postMeta: function () {
      if (this.post.json_metadata) {
        return this.post.json_metadata
      } else {
        return null
      }
    },
    downVotes: function () {
      return null
    },
    myVote: function () {
      if (this.votedWeight !== null) {
        return { voter: this.loggedInUser, weight: this.votedWeight, author: this.post.author, permlink: this.post.permlink, rshares: this.votedWeight }
      } else {
        if (this.post !== undefined) {
          return this.post.active_votes.filter(this.filterMyVote)[0]
        } else {
          return null
        }
      }
    },
    voteIcon: function () {
      if (this.myVote !== undefined) {
        if (Math.sign(this.myVote.rshares) === 1) {
          return 'favorite'
        } else {
          return 'favorite_border'
        }
      } else {
        return 'favorite_border'
      }
    }
  },

  methods: {
    linkAccount (account) { return '/@' + account },
    linkCommunity (community) { return '/c/' + community + '/created' },
    filterMyVote (op) { if (op.voter === this.loggedInUser) { return true } else { return false } },
    getHiveAvatarUrl (user) { return 'https://images.hive.blog/u/' + user + '/avatar' },
    timeDelta (timestamp) {
      var now = moment.utc()
      var stamp = moment.utc(timestamp)
      var diff = stamp.diff(now, 'minutes')
      return moment.duration(diff, 'minutes').humanize(true)
    },
    showVoteEarly (weight) {
      this.votedWeight = weight
    }
  }
}
</script>
