<template>
  <q-page class="home-page">
    <div class="home-shell">
      <header class="home-head">
        <div class="home-head__text">
          <div class="home-head__eyebrow">
            <span class="home-live-dot is-live" aria-hidden="true"></span>
            Hive network dashboard
          </div>
          <h1 class="home-head__title">Hive at a glance</h1>
          <p class="home-head__tagline">
            Live blocks, markets, governance and community posts — read straight from the Hive blockchain.
          </p>
        </div>

        <nav class="home-links" aria-label="Quick links">
          <router-link class="home-link" to="/browse">
            <q-icon name="explore" size="16px" aria-hidden="true" /> Browse posts
          </router-link>
          <router-link class="home-link" to="/blocks">
            <q-icon name="view_agenda" size="16px" aria-hidden="true" /> Blocks
          </router-link>
          <router-link class="home-link" to="/witnesses">
            <q-icon name="how_to_vote" size="16px" aria-hidden="true" /> Witnesses
          </router-link>
          <router-link class="home-link" to="/markets">
            <q-icon name="show_chart" size="16px" aria-hidden="true" /> Markets
          </router-link>
          <router-link class="home-link" to="/proposals">
            <q-icon name="account_balance" size="16px" aria-hidden="true" /> Proposals
          </router-link>
        </nav>
      </header>

      <div class="home-layout">
        <div class="home-main">
          <div class="home-top">
            <home-block-card />
            <home-market-card />
          </div>
          <home-trending-posts />
        </div>

        <aside class="home-side">
          <home-witness-card />
          <home-recent-posts account="ausbitbank" />
        </aside>
      </div>
    </div>
  </q-page>
</template>

<style scoped>
.home-page {
  padding-bottom: var(--space-6);
}

.home-shell {
  width: 100%;
  max-width: 1280px;
  margin: 0 auto;
  padding: var(--space-5) var(--space-4) var(--space-6);
}

.home-head {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: var(--space-4);
  flex-wrap: wrap;
  margin-bottom: var(--space-4);
}

.home-head__text {
  min-width: 0;
}

.home-head__eyebrow {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  color: #78909c;
  font-size: 0.68rem;
  letter-spacing: 0.07em;
  text-transform: uppercase;
}

.home-head__title {
  margin: 0.25rem 0 0.3rem;
  font-size: clamp(1.6rem, 3vw, 2.1rem);
  font-weight: 600;
  line-height: 1.15;
  letter-spacing: -0.02em;
}

.home-head__tagline {
  max-width: 680px;
  margin: 0;
  color: #90a4ae;
  font-size: 0.9rem;
  line-height: 1.5;
}

.home-links {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 0.4rem 0.9rem;
  padding-bottom: 0.2rem;
}

.home-link {
  display: inline-flex;
  align-items: center;
  gap: 0.3rem;
  color: #b0bec5;
  font-size: 0.8rem;
  text-decoration: none;
}

.home-link:hover {
  color: #81d4fa;
}

.home-layout {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 340px;
  align-items: start;
  gap: var(--space-4);
}

.home-main {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
  min-width: 0;
}

.home-top {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  align-items: start;
  gap: var(--space-4);
}

.home-side {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
  min-width: 0;
}

@media (max-width: 1023px) {
  .home-layout {
    grid-template-columns: minmax(0, 1fr);
  }

  .home-side {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (max-width: 799px) {
  .home-top {
    grid-template-columns: minmax(0, 1fr);
  }

  .home-side {
    grid-template-columns: minmax(0, 1fr);
  }
}

@media (max-width: 599px) {
  .home-shell {
    padding: var(--space-3) var(--space-2) var(--space-5);
  }

  .home-head {
    margin-bottom: var(--space-3);
  }

  .home-head__title {
    font-size: 1.5rem;
  }

  .home-links {
    gap: 0.35rem 0.7rem;
  }
}
</style>

<script>
import HomeBlockCard from 'components/HomeBlockCard.vue'
import HomeMarketCard from 'components/HomeMarketCard.vue'
import HomeWitnessCard from 'components/HomeWitnessCard.vue'
import HomeTrendingPosts from 'components/HomeTrendingPosts.vue'
import HomeRecentPosts from 'components/HomeRecentPosts.vue'
import { setPageMeta } from 'src/utils/pageMeta'

export default {
  name: 'Home',
  components: {
    HomeBlockCard,
    HomeMarketCard,
    HomeWitnessCard,
    HomeTrendingPosts,
    HomeRecentPosts
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
