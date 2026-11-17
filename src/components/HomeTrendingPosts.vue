<template>
  <q-card flat bordered class="home-card home-panel">
    <q-card-section class="home-panel__head">
      <div>
        <div class="home-eyebrow">Community</div>
        <h2 class="home-panel__title">Posts on Hive</h2>
      </div>
      <div class="home-panel__actions">
        <q-btn-toggle
          v-model="sort"
          :options="sortOptions"
          dense
          no-caps
          outline
          toggle-color="primary"
          aria-label="Post sort"
          @update:model-value="loadPosts"
        />
        <router-link :to="viewAllLink" class="home-panel__link">View all</router-link>
      </div>
    </q-card-section>

    <q-card-section v-if="loading" class="home-panel__body">
      <div v-for="i in 5" :key="i" class="home-post-skeleton">
        <q-skeleton type="rect" width="58px" height="44px" />
        <div class="home-post-skeleton__body">
          <q-skeleton type="text" width="85%" />
          <q-skeleton type="text" width="45%" />
        </div>
      </div>
    </q-card-section>

    <q-card-section v-else-if="error" class="home-panel__state">
      <q-icon name="error_outline" size="24px" color="orange" aria-hidden="true" />
      <span>{{ error }}</span>
      <q-btn flat dense no-caps color="primary" icon="refresh" label="Retry" @click="loadPosts" />
    </q-card-section>

    <q-card-section v-else-if="posts.length === 0" class="home-panel__state">
      <q-icon name="article" size="24px" aria-hidden="true" />
      <span>No posts found right now.</span>
      <q-btn flat dense no-caps color="primary" icon="refresh" label="Refresh" @click="loadPosts" />
    </q-card-section>

    <q-card-section v-else class="home-panel__body home-post-list">
      <home-post-row
        v-for="(post, index) in posts"
        :key="post.post_id || (post.author + '/' + post.permlink)"
        :post="post"
        :rank="index + 1"
      />
    </q-card-section>
  </q-card>
</template>

<style scoped>
.home-post-list {
  padding-top: 0.2rem;
  padding-bottom: 0.3rem;
}

.home-post-skeleton {
  display: flex;
  align-items: center;
  gap: 0.7rem;
  padding: 0.65rem 0;
}

.home-post-skeleton__body {
  flex: 1;
}
</style>

<script>
import HomePostRow from 'components/HomePostRow.vue'
import { fetchRankedPosts } from 'src/services/chainData'

const SORTS = [
  { label: 'Trending', value: 'trending' },
  { label: 'New', value: 'created' },
  { label: 'Hot', value: 'hot' }
]

const ROUTES = {
  trending: '/trending',
  created: '/created',
  hot: '/hot'
}

export default {
  name: 'homeTrendingPosts',
  components: { HomePostRow },
  data () {
    return {
      sort: 'trending',
      sortOptions: SORTS,
      posts: [],
      loading: true,
      error: ''
    }
  },
  computed: {
    loggedInUser () {
      return this.$hiveStore.user.username || null
    },
    viewAllLink () {
      return ROUTES[this.sort] || '/trending'
    }
  },
  mounted () {
    this.loadPosts()
  },
  methods: {
    async loadPosts () {
      this.loading = true
      this.error = ''
      try {
        const response = await fetchRankedPosts({
          observer: this.loggedInUser || null,
          limit: 6,
          sort: this.sort,
          start_author: null,
          start_permlink: null
        })
        this.posts = Array.isArray(response) ? response : []
      } catch (error) {
        console.error('Failed to load home posts', error)
        this.error = 'Could not load posts.'
      } finally {
        this.loading = false
      }
    }
  }
}
</script>
