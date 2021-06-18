<template>
  <q-card flat bordered style="max-width:900px; margin: auto" class="q-pa-md">
    <div class="text-h5 text-center vertical-top"><router-link :to="returnPostPath(post.author, post.permlink)">{{ post.title }}</router-link></div>
    <render :input="post.body" v-if="post.body" />
    <render :input="summary" v-else />
    <postFooter :post="post" />
  </q-card>
</template>
<script>
export default {
  name: 'postDialog',
  props: ['post'],
  data () {
    return {
    }
  },
  components: {
    postFooter: () => import('components/postFooter.vue'),
    render: () => import('components/render.vue')
  },
  methods: {
    returnPostPath (author, permlink) { return '/@' + author + '/' + permlink }
  }
}
</script>
