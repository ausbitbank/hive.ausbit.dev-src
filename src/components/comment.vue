<template>
  <span>
  <q-item flat separator bordered v-if="comment.permlink !== parentPermlink">
    <q-item-section>
      <q-item-label>
        <render :input="comment.body" />
      </q-item-label>
      <q-item-label><postFooter :post="comment" /></q-item-label>
    </q-item-section>
  </q-item>
  <q-item v-for="authperm in comment.replies" :key="authperm.index">
    <comment :comment="comments[authperm]" :comments="comments" :parentDepth="comment.depth" />
  </q-item>
  </span>
</template>
<script>
import { defineAsyncComponent } from 'vue'
import render from 'components/render.vue'
import comment from 'components/comment.vue'
import moment from 'src/utils/time'
export default {
  name: 'comment',
  data () {
    return {
    }
  },
  props: ['comment', 'comments', 'parentAuthor', 'parentPermlink', 'parentDepth'],
  components: { render, comment, postFooter: defineAsyncComponent(() => import('components/postFooter.vue')) },
  computed: {
    loggedInUser: {
      get () { return this.$hiveStore.user.username }
    },
    defaultVoteWeight: {
      get () { return this.$hiveStore.user.settings.voteWeightComment }
    },
    myVote: function () {
      return this.comment.active_votes.filter(this.filterMyVote)[0]
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
    returnLink (author, permlink) { return '/@' + author + '/' + permlink },
    linkAccount (author) { return '/@' + author },
    filterMyVote (op) { if (op.voter === this.loggedInUser) { return true } else { return false } },
    GetHiveAvatarUrl (user) { return 'https://images.hive.blog/u/' + user + '/avatar' },
    timeDelta (timestamp) {
      var now = moment.utc()
      var stamp = moment.utc(timestamp)
      var diff = stamp.diff(now, 'minutes')
      return moment.duration(diff, 'minutes').humanize(true)
    }
  },
  mounted () {
  }
}
</script>
