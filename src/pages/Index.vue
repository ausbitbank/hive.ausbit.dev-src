<template>
  <q-page class="flex flex-center">
    <div class="q-pa-md row items-start q-gutter-md content-start content-stretch self-stretch col-grow justify-center">
      <transition appear enter-active-class="animated fadeInLeft" leave-active-class="animated fadeOutLeft">
        <div style="width:400px" class="justify-center">
          <block :blockNum="0" view="simple" />
          <recent-posts-carousel account="ausbitbank" type="blog" />
          <ranked-posts-carousel sortMethod="trending" />
          <ranked-posts-carousel sortMethod="hot" />
        </div>
      </transition>
      <transition appear enter-active-class="animated fadeIn" leave-active-class="animated fadeOut">
        <nodes />
      </transition>
      <transition appear enter-active-class="animated fadeIn" leave-active-class="animated fadeOut">
        <witnesses />
      </transition>
      <transition appear enter-active-class="animated fadeInRight" leave-active-class="animated fadeOutRight">
        <coingecko />
      </transition>
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
