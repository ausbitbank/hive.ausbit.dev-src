<template>
  <q-card flat bordered style="max-width:900px; margin: auto" class="q-pa-md">
    <div class="text-h5 text-center vertical-top"><router-link :to="returnPostPath(post.author, post.permlink)">{{ post.title }}</router-link></div>
    <render :input="post.body" v-if="post.body" />
    <render :input="summary" v-else />
    <postFooter :post="post" />
  </q-card>
</template>
<script>
import { defineAsyncComponent } from 'vue'
export default {
  name: 'postDialog',
  props: ['post'],
  data () {
    return {
    }
  },
  components: {
    postFooter: defineAsyncComponent(() => import('components/postFooter.vue')),
    render: defineAsyncComponent(() => import('components/render.vue'))
  },
  methods: {
    returnPostPath (author, permlink) { return '/@' + author + '/' + permlink }
  }
}
</script>
