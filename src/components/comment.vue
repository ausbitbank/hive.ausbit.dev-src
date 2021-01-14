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
      <q-item-section side class="text-grey text-subtitle">
        <router-link :to="returnLink(this.comment.author, this.comment.permlink)">{{ timeDelta(this.comment.created) }}</router-link>
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
import moment from 'moment'
export default {
  name: 'comment',
  data () {
    return {
    }
  },
  props: ['comment', 'comments', 'parentAuthor', 'parentPermlink', 'parentDepth'],
  components: { commentBody, comment },
  methods: {
    returnLink (author, permlink) { return '/@' + author + '/' + permlink },
    linkAccount (author) { return '/@' + author },
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
