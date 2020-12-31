<template>
  <q-page class="flex flex-center">
    <div class="q-pa-md row items-start q-gutter-md content-start content-stretch self-stretch col-grow justify-center">
      <div style="width:450px">
        <recent-posts-carousel account="ausbitbank" />
        <ranked-posts-carousel sortMethod="trending" />
        <ranked-posts-carousel sortMethod="hot" />
      </div>
      <nodes />
      <witnesses />
      <coingecko />
      <block :blockNum="0" view="simple" />
    </div>
  </q-page>
</template>
<style scoped>
a {text-decoration: none; color: #3344dd }
a:link { color: #3344dd; font-weight: bold; text-decoration: none; }
a:visited { color: #884488; }
</style>
<script>
import nodes from 'components/nodes.vue'
import witnesses from 'components/witnesses.vue'
import coingecko from 'components/coingecko.vue'
import recentPostsCarousel from 'components/recentPostsCarousel.vue'
import rankedPostsCarousel from 'components/rankedPostsCarousel.vue'
import block from 'components/block.vue'

export default {
  name: 'Home',
  data () {
    return {
      globalProps: null
    }
  },
  components: {
    nodes,
    witnesses,
    coingecko,
    recentPostsCarousel,
    rankedPostsCarousel,
    block
  },
  computed: {
  },
  methods: {
  },
  mounted () {
    document.title = 'hive.ausbit.dev'
  }
}
</script>
