<template>
  <div style="max-height:100%; max-width: 90vw; overflow:auto">
    <q-card bordered>
      <q-tabs v-model="card3PostsTab" dense align="justify" narrow-indicator indicator-color="secondary">
        <q-tab name="active" label="Active" />
        <q-tab name="finished" label="Finished" />
      </q-tabs>
      <q-separator />
      <q-tab-panels v-model="card3PostsTab" animated>
        <q-tab-panel name="active">
          <card3PostsList :username="username" :posts="posts.filter(filterActiveOnly)" type="active" />
        </q-tab-panel>
        <q-tab-panel name="finished">
          <card3PostsList :username="username" :posts="posts.filter(filterPaidOut)" type="finished" />
        </q-tab-panel>
      </q-tab-panels>
    </q-card>
  </div>
</template>

<script>
import card3PostsList from 'src/components/hiveworld/Card3PostsList.vue'
export default {
  name: 'Card3Posts',
  props: ['username'],
  components: {
    card3PostsList: card3PostsList
  },
  data () {
    return {
      card3PostsTab: 'active',
      limit: 10,
      posts: []
    }
  },
  methods: {
    getPosts () {
      this.$hive.api.getDiscussionsByAuthorBeforeDate(this.username, null, new Date().toISOString().split('.')[0], this.limit, function (err, result) {
        if (err) { console.log(err) }
        this.posts = result
      }.bind(this))
    },
    filterActiveOnly (post) {
      if (post.cashout_time.startsWith('1969')) {
        return false
      } else {
        return true
      }
    },
    filterPaidOut (post) {
      if (post.cashout_time.startsWith('1969')) {
        return true
      } else {
        return false
      }
    }
  },
  mounted () {
    this.getPosts()
  }
}
</script>
