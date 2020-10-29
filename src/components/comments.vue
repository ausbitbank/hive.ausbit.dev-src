<template>
    <q-card dense flat bordered v-if="Object.keys(comments).length >= 2">
        <q-card-section class="text-h6 text-center">
            <q-icon name="comment" /> Replies
        </q-card-section>
        <span v-for="comment in comments" :key="comment.index">
           <comment :comment="comment" :comments="comments" :parentAuthor="author" :parentPermlink="permlink" :parentDepth="comment.depth"/>
        </span>
    </q-card>
</template>
<script>
import comment from 'components/comment.vue'
export default {
  name: 'comments',
  data () {
    return {
      comments: [],
      api: 'https://rpc.ausbit.dev'
    }
  },
  props: ['author', 'permlink'],
  components: { comment },
  computed: {
  },
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
        })
    }
  },
  mounted () {
    this.getReplies()
  }
}
</script>
