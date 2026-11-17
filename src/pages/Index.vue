<template>
  <q-page class="home-page">
    <header class="home-hero">
      <h1 class="home-hero__title page-title">Hive block explorer &amp; toolkit</h1>
      <p class="home-hero__tagline page-intro">
        Live blocks, posts, accounts, governance and markets — read straight from the Hive blockchain.
      </p>
      <nav class="home-hero__links" aria-label="Quick links">
        <router-link class="home-chip" to="/browse">
          <q-icon name="explore" aria-hidden="true" /> Browse posts
        </router-link>
        <router-link class="home-chip" to="/blocks">
          <q-icon name="view_agenda" aria-hidden="true" /> Latest blocks
        </router-link>
        <router-link class="home-chip" to="/nodes">
          <q-icon name="dns" aria-hidden="true" /> Nodes
        </router-link>
        <router-link class="home-chip" to="/witnesses">
          <q-icon name="how_to_vote" aria-hidden="true" /> Witnesses
        </router-link>
      </nav>
    </header>
    <div class="row items-start q-gutter-md content-start content-stretch col-grow justify-center home-dashboard">
      <div class="home-column">
        <block :blockNum="0" view="simple" class="q-mb-lg" />
        <recent-posts-carousel account="ausbitbank" type="blog" />
        <ranked-posts-carousel sortMethod="trending" />
        <coingeckoCarousel />
      </div>
        <!--<nodes />-->
        <witnesses />
    </div>
  </q-page>
</template>
<style scoped>
a {text-decoration: none; color: #3344dd }
a:link { color: #3344dd; font-weight: bold; text-decoration: none; }
a:visited { color: #884488; }
.home-page {
  padding-bottom: 1.5rem;
}
.home-hero {
  max-width: 1040px;
  margin: 1rem auto 0.25rem;
  padding: 1.25rem 1rem;
  text-align: center;
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: var(--radius-card, 10px);
  background: var(--surface-glass, rgba(8, 13, 17, 0.72));
}
.home-hero__title {
  margin: 0 0 0.4rem;
}
.home-hero__tagline {
  margin: 0 auto 1rem;
}
.home-hero__links {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 0.5rem;
}
.home-chip {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  padding: 0.45rem 0.85rem;
  border: 1px solid rgba(255, 255, 255, 0.16);
  border-radius: var(--radius-pill, 999px);
  background: rgba(255, 255, 255, 0.05);
  color: #e3f2fd;
  font-size: 0.85rem;
  font-weight: 600;
}
.home-chip:link,
.home-chip:visited {
  color: #e3f2fd;
}
.home-chip:hover {
  border-color: rgba(62, 146, 204, 0.65);
  background: rgba(62, 146, 204, 0.22);
  text-decoration: none;
}
.home-chip .q-icon {
  font-size: 1.05rem;
}
.home-dashboard {
  padding-top: 0.25rem;
}
@media (max-width: 599px) {
  .home-hero {
    margin: 0.5rem 0.5rem 0.25rem;
    padding: 1rem 0.85rem;
  }
}
.home-column {
  flex: 1 1 100%;
  min-width: 0;
  max-width: 450px;
}
</style>
<script>
// import nodes from 'components/nodes.vue'
import witnesses from 'components/witnesses.vue'
// import coingecko from 'components/coingecko.vue'
import coingeckoCarousel from 'components/coingeckoCarousel.vue'
import recentPostsCarousel from 'components/recentPostsCarousel.vue'
import rankedPostsCarousel from 'components/rankedPostsCarousel.vue'
import block from 'components/block.vue'
import { setPageMeta } from 'src/utils/pageMeta'

export default {
  name: 'Home',
  data () {
    return {
    }
  },
  components: {
    // nodes,
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
    setPageMeta({
      title: 'hive.ausbit.dev — Hive block explorer',
      description: 'Explore the Hive blockchain: live blocks, accounts, posts, witnesses, proposals, HBD, markets and API nodes.',
      url: '/'
    })
  }
}
</script>
