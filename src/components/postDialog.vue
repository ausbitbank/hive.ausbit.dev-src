<template>
  <q-card flat class="post-dialog">
    <div class="post-dialog__head">
      <div class="post-dialog__eyebrow">Post preview</div>
      <h2 class="post-dialog__title">
        <router-link :to="returnPostPath(post.author, post.permlink)">{{ post.title }}</router-link>
      </h2>
    </div>
    <div class="post-dialog__body postbody">
      <render :input="post.body" v-if="post.body" />
      <render :input="summary" v-else />
    </div>
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

<style scoped>
.post-dialog {
  width: min(900px, 94vw);
  max-height: 88vh;
  overflow: auto;
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-card);
  background: #0f171c;
  box-shadow: var(--shadow-pop);
}

.post-dialog__head {
  padding: var(--space-4) var(--space-5) var(--space-2);
  border-bottom: 1px solid var(--border-subtle);
}

.post-dialog__eyebrow {
  color: #78909c;
  font-size: 0.66rem;
  letter-spacing: 0.07em;
  text-transform: uppercase;
}

.post-dialog__title {
  margin: 0.15rem 0 0.4rem;
  color: #e4eaed;
  font-size: 1.2rem;
  font-weight: 600;
  line-height: 1.3;
}

.post-dialog__title a {
  color: inherit;
  text-decoration: none;
}

.post-dialog__title a:hover {
  color: #81d4fa;
}

.post-dialog__body {
  padding: var(--space-4) var(--space-5);
}

@media (max-width: 599px) {
  .post-dialog__head,
  .post-dialog__body {
    padding-left: var(--space-4);
    padding-right: var(--space-4);
  }
}
</style>
