<template>
  <q-card-section v-if="this.comment.permlink !== this.parentPermlink">
  <q-list bordered separator>
    <q-item>
      <q-item-section avatar>
        <center>
          <router-link :to="linkAccount(this.comment.author)">
            <q-avatar>
              <q-img :src="GetHiveAvatarUrl(this.comment.author)" />
            </q-avatar>
            <div class="text-bold">
              {{ this.comment.author }}
            </div>
          </router-link>
        </center>
      </q-item-section>
      <q-item-section>
        <comment-body :post="comment" />
      </q-item-section>
      <q-item-section side class="text-grey text-center text-subtitle">
        <router-link :to="returnLink(this.comment.author, this.comment.permlink)">{{ timeDelta(this.comment.created) }}</router-link>
        <q-btn icon="comment" dense flat v-if="this.loggedInUser">
          <q-popup-proxy persistent>
            <commentBox :parent_author="this.comment.author" :parent_permlink="this.comment.permlink" />
          </q-popup-proxy>
        </q-btn>
        <q-btn dense flat :icon="voteIcon" color="secondary" v-if="comment.active_votes" :label="comment.active_votes.length"><q-popup-proxy v-if="myVote === undefined"><q-banner><vote :votes="comment.active_votes" :author="comment.author" :permlink="comment.permlink" /></q-banner></q-popup-proxy></q-btn>
      </q-item-section>
    </q-item>
  </q-list>
  <span v-for="authperm in comment.replies" :key="authperm.index">
    <comment :comment="comments[authperm]" :comments="comments" :parentDepth="comment.depth" />
  </span>
  </q-card-section>
</template>
<script>
import commentBody from 'components/commentBody.vue'
import comment from 'components/comment.vue'
import commentBox from 'components/commentBox.vue'
import vote from 'components/vote.vue'
import moment from 'moment'
export default {
  name: 'comment',
  data () {
    return {
    }
  },
  props: ['comment', 'comments', 'parentAuthor', 'parentPermlink', 'parentDepth'],
  components: { commentBody, comment, commentBox, vote },
  computed: {
    loggedInUser: {
      get () { return this.$store.state.hive.user.username }
    },
    defaultVoteWeight: {
      get () { return this.$store.state.hive.user.settings.voteWeightComment }
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
