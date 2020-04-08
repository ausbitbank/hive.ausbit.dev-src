<template>
  <div>
    <q-list bordered>
      <q-expansion-item popup v-for="post in posts" :key="post.index" :label="post.title" group="posts">
        <card3-posts-tabs :post="post" />
      </q-expansion-item>
    </q-list>
  </div>
</template>

<script>
import hive from 'steem'
import card3PostsTabs from 'components/card3PostsTabs.vue'
export default {
  name: 'Card3ActivePosts',
  props: ['username'],
  components: {
    card3PostsTabs: card3PostsTabs
  },
  data () {
    return {
      posts: [],
      limit: 10
    }
  },
  methods: {
    getPosts () {
      hive.api.setOptions({ url: 'https://anyx.io' })
      hive.api.getDiscussionsByAuthorBeforeDate(this.username, null, new Date().toISOString().split('.')[0], this.limit, function (err, result) {
        if (err) { console.log(err) }
        console.log(result)
        this.posts = result
      }.bind(this))
    }
  },
  mounted () {
    this.getPosts()
  }
}
</script>
