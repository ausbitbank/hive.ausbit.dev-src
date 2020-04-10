<template>
  <q-page class="flex flex-center q-pa-md">
    <div v-if="post">
      <div class="row text-title"><center>{{ post.title }}</center></div>
      <Card3PostsContent :post="post" />
    </div>
  </q-page>
</template>

<script>
import hive from 'steem'
import Card3PostsContent from 'components/Card3PostsContent.vue'
export default {
  name: 'postView',
  components: { Card3PostsContent: Card3PostsContent },
  data () {
    return {
      post: null,
      author: this.$router.currentRoute.params.author,
      permlink: this.$router.currentRoute.params.permlink
    }
  },
  methods: {
    getPost (author, permlink) {
      hive.api.getContentAsync(author, permlink)
        .then(post => this.setPost(post))
        .catch(error => console.log(error))
    },
    setPost (post) {
      this.post = post
    }
  },
  mounted () {
    this.getPost(this.author, this.permlink)
  }
}
</script>
