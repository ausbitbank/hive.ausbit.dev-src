<template>
  <q-page class="flex flex-center">
    <div class="q-pa-md row items-start q-gutter-md content-start content-stretch self-stretch col-grow justify-center">
      <div style="width:400px">
        <block :blockNum="0" view="simple" class="q-mb-lg" />
        <recent-posts-carousel account="ausbitbank" type="blog" style="width:400px" />
        <ranked-posts-carousel sortMethod="trending" style="width:400px" />
        <coingeckoCarousel />
      </div>
        <nodes />
        <witnesses />
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
// import coingecko from 'components/coingecko.vue'
import coingeckoCarousel from 'components/coingeckoCarousel.vue'
import recentPostsCarousel from 'components/recentPostsCarousel.vue'
import rankedPostsCarousel from 'components/rankedPostsCarousel.vue'
import block from 'components/block.vue'

export default {
  name: 'Home',
  data () {
    return {
    }
  },
  components: {
    nodes,
    witnesses,
    // coingecko,
    coingeckoCarousel,
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
