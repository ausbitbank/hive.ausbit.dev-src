<template>
  <span>
    <span v-if="!viewComments" class="text-center">
      <q-btn @click="viewComments = !viewComments" icon="forum" color="blue-grey-6" dense push label="View replies" />
    </span>
    <span v-if="viewComments">
    <q-card dense flat bordered v-if="!loading">
      <q-card-section class="text-h6 text-center">
          {{ Object.keys(this.comments).length - 1 }} Replies
          <div>
            <q-btn icon="settings" title="Comment filtering and sorting options" class="hvr" dense glossy rounded push>
              <q-popup-proxy>
                <q-card class="q-pa-md shadow-4" bordered>
                  <span class="text-caption">Gray <q-checkbox v-model="filter.gray" /> Hidden <q-checkbox v-model="filter.hide" /></span>
                  <q-select v-model="commentSortMethod" :options="commentSortMethods" label="Sort" dense />
                  <q-select v-model="commentSortDirection" :options="commentSortDirections" label="Direction" dense />
              </q-card>
              </q-popup-proxy>
            </q-btn>
          </div>
      </q-card-section>
      <span v-for="comment in comments" :key="comment.index" class="text-justify">
        <comment :comment="comment" :comments="comments" :parentAuthor="author" :parentPermlink="permlink" :parentDepth="comment.depth" v-if="comment.parent_permlink === permlink && returnFilterStatus(comment)" />
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
      loading: false,
      filter: {
        gray: true,
        hide: true
      },
      commentSortMethod: 'net_rshares',
      commentSortMethods: [
        { label: 'Votes (rshares)', value: 'net_rshares' },
        { label: 'Age', value: 'post_id' },
        { label: 'Author Reputation', value: 'author_reputation' },
        { label: 'Replies', value: 'children' }
      ],
      commentSortDirection: 'desc',
      commentSortDirections: [
        { label: 'Ascending', value: 'asc' },
        { label: 'Descending', value: 'desc' }
      ]
    }
  },
  watch: {
    viewComments: function () {
      if (this.viewComments) {
        this.getReplies()
      }
    },
    commentSortMethod: {
      deep: true,
      handler: 'resortComments'
    },
    commentSortDirection: {
      deep: true,
      handler: 'resortComments'
    }
  },
  props: ['author', 'permlink'],
  components: { comment },
  computed: {
  },
  methods: {
    resortComments () {
      var c = this.comments
      this.comments = null
      this.comments = this.sortData(this.commentSortMethod.value, c, this.commentSortDirection.value)
    },
    returnFilterStatus (comment) {
      if (this.filter.gray && comment.stats.gray) { return false }
      if (this.filter.hide && comment.stats.hide) { return false }
      return true
    },
    getReplies () {
      this.loading = true
      this.$axios.post(this.api, { // TODO change this to hivejs call
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
          console.log(this.comments)
          this.comments = this.sortData(this.commentSortMethod.value, this.comments, this.commentSortDirection.value)
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
