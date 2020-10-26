<template>
    <q-card dense flat bordered class="q-pa-sm q-ma-md col-4" v-if="Object.keys(comments).length >= 1">
        <q-card-section class="text-h6 text-center">
            <q-icon name="comment" /> {{ Object.keys(comments).length - 1 }} replies
        </q-card-section>
        <q-card-section v-for="comment in comments" :key="comment.index">
            <q-item v-if="comment.permlink !== permlink">
                <q-item-section avatar>
                    <center>
                        <router-link :to="linkAccount(comment.author)">
                            <q-avatar><q-img :src="GetHiveAvatarUrl(comment.avatar)" /></q-avatar>
                            <span class="text-bold"> {{ comment.author }}</span>
                        </router-link>
                    </center>
                </q-item-section>
                <q-item-section>
                    <Card3PostsContent :post="comment" />
                    <div v-if="comment.children !== 0"><router-link :to="returnLink(comment.author, comment.permlink)">{{ comment.children }} replies</router-link></div>
                </q-item-section>
                <q-item-section side class="text-grey text-subtitle">
                    <router-link :to="returnLink(comment.author, comment.permlink)">{{ timeDelta(comment.created) }}</router-link>
                </q-item-section>
            </q-item>
        </q-card-section>
    </q-card>
</template>
<script>
// import hive from '@hiveio/hive-js'
import Card3PostsContent from 'components/Card3PostsContent.vue'
import moment from 'moment'
export default {
  name: 'comments',
  data () {
    return {
      comments: [],
      api: 'https://rpc.ausbit.dev'
    }
  },
  props: ['author', 'permlink'],
  components: { Card3PostsContent },
  methods: {
    getReplies () {
      this.$axios.post(this.api, {
        jsonrpc: '2.0',
        method: 'bridge.get_discussion',
        params: {
          author: this.author,
          permlink: this.permlink
        }
      })
        .then((res) => {
          this.comments = res.data.result
          console.log(this.comments)
        })
    },
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
    this.getReplies()
  }
}
</script>
