<template>
  <q-card-section v-if="this.comment.author !== this.parentAuthor && this.comment.permlink !== this.parentPermlink">
  <q-list bordered separator>
    <q-item>
      <q-item-section avatar>
        <center>
          <router-link :to="linkAccount(this.comment.author)">
            <q-avatar>
              <q-img :src="GetHiveAvatarUrl(this.comment.avatar)" />
            </q-avatar>
            <div class="text-bold">
              {{ this.comment.author }}
            </div>
          </router-link>
        </center>
      </q-item-section>
      <q-item-section>
        <Card3PostsContent :post="comment" />
      </q-item-section>
      <q-item-section side class="text-grey text-subtitle">
        <router-link :to="returnLink(this.comment.author, this.comment.permlink)">{{ timeDelta(this.comment.created) }}</router-link>
      </q-item-section>
    </q-item>
    <q-item v-if="this.comment.children !== 0">
      <div v-for="authperm in comment.replies" :key="authperm.index">
        <span v-if="comment.depth >= parentDepth">
          <comment :comment="comments[authperm]" :comments="comments" :parentDepth="comment.depth" />
          </span>
        <span v-else>
          View <router-link :to="returnLink(comment.author, comment.permlink)">{{ comment.children }} replies</router-link>
        </span>
      </div>
    </q-item>
  </q-list>
  </q-card-section>
</template>
<script>
// import hive from '@hiveio/hive-js'
import Card3PostsContent from 'components/Card3PostsContent.vue'
import comment from 'components/comment.vue'
import moment from 'moment'
export default {
  name: 'comment',
  data () {
    return {
    }
  },
  props: ['comment', 'comments', 'parentAuthor', 'parentPermlink', 'parentDepth'],
  components: { Card3PostsContent, comment },
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
