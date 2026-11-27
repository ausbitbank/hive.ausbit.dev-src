<template>
  <q-page class="flex q-pa-md flex-center">
    <h1 class="sr-only">Recent votes by @{{ account }}</h1>
    <recent-voted-posts-carousel :account="account" />
  </q-page>
</template>
<style scoped>
:deep(a:link) { color: var(--c-link); font-weight: bold; text-decoration: none; }
:deep(a:visited) { color: var(--c-accent); }
:deep(:target) { background-color: color-mix(in srgb, var(--c-warning) 24%, transparent); }
</style>
<script>
import recentVotedPostsCarousel from 'components/recentVotedPostsCarousel.vue'
import { setPageMeta } from 'src/utils/pageMeta'
export default {
  name: 'trailViewPage',
  components: {
    recentVotedPostsCarousel
  },
  data () {
    return {
      account: this.$route.params.account
    }
  },
  computed: {
  },
  methods: {
  },
  mounted () {
    setPageMeta({
      title: 'Recent votes by @' + this.account + ' — Hive',
      description: 'Recent Hive votes and curation activity by @' + this.account + ' on banksia.io.',
      url: this.$route.path
    })
  }
}
</script>
