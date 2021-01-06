<template>
  <span>
    <span v-if="!viewComments" class="text-center">
      <div @click="viewComments = !viewComments" class="cursor-pointer"><q-icon name="comment" />  View replies</div>
    </span>
    <span v-if="viewComments">
    <q-spinner-grid size="2em" color="primary" v-if="loading" />
    <q-card dense flat bordered v-if="!loading">
      <q-card-section class="text-h6 text-center">
          <q-icon name="comment" /> Replies
      </q-card-section>
      <span v-for="comment in comments" :key="comment.index">
        <comment :comment="comment" :comments="comments" :parentAuthor="author" :parentPermlink="permlink" :parentDepth="comment.depth" v-if="comment.depth === 1" />
      </span>
    </q-card>
    </span>
  </span>
</template>
<script>
import comment from 'components/comment.vue'
export default {
  name: 'comments',
  data () {
    return {
      comments: [],
      api: 'https://rpc.ausbit.dev',
      viewComments: false,
      loading: false
    }
  },
  watch: {
    viewComments: function () {
      if (this.viewComments) {
        this.getReplies()
      }
    }
  },
  props: ['author', 'permlink'],
  components: { comment },
  computed: {
  },
  methods: {
    getReplies () {
      this.loading = true
      this.$axios.post(this.api, {
        jsonrpc: '2.0',
        method: 'bridge.get_discussion',
        params: {
          author: this.author,
          permlink: this.permlink
        }
      })
        .then((res) => {
          this.loading = false
          this.comments = res.data.result
          this.comments = this.sortData('net_rshares', this.comments, 'desc')
        })
        .catch((err) => {
          this.loading = false
          console.log(err)
        })
    },
    sortData (key, data, type) {
      const ordered = {}
      let compareFunction = function (a, b) {
        return data[b][key] - data[a][key]
      }
      if (type === 'asc') {
        compareFunction = function (a, b) {
          return data[a][key] - data[b][key]
        }
      }
      Object.keys(data).sort(compareFunction).forEach(function (key) {
        ordered[key] = data[key]
      })
      return ordered
    }
  },
  mounted () {
    this.getReplies()
  }
}
</script>
