<template>
  <q-page class="flex q-pa-md flex-center">
    <recent-voted-posts-carousel :account="account" />
  </q-page>
</template>
<style>
a:link { color: #1d8ce0; font-weight: bold; text-decoration: none; }
a:visited { color: #884488; }
:target { background-color: #ffa; }
</style>
<script>
import recentVotedPostsCarousel from 'components/recentVotedPostsCarousel.vue'
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
    document.title = 'Recent votes by ' + this.account
  }
}
</script>
