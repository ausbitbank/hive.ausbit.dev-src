<template>
    <div>
        <user-card :username="person" v-for="person in currentPage" :key="person" />
        <div class="q-pa-lg flex flex-center" v-if="maxPages > 1">
          <q-pagination v-model="page" :max="maxPages" :max-pages="3" direction-links input unelevated style="margin:auto"/>
        </div>
        <div style="margin:auto" class="text-center">
            <q-btn flat icon="search" @click="getConnections()" v-if="!loadMoreEnabled" color="primary">
                Load more ({{ people.length }} so far)
            </q-btn>
        </div>
    </div>
</template>
<script>
import { defineAsyncComponent } from 'vue'
export default {
  name: 'connections',
  props: ['type', 'username'],
  data () {
    return {
      people: [],
      loading: false,
      limit: 100,
      page: 1
    }
  },
  components: {
    userCard: defineAsyncComponent(() => import('components/userCard.vue'))
  },
  watch: {
    currentPage: function (newState) {
      if (newState.length === 0) {
        this.getConnections()
      }
      this.getAccounts(newState)
    }
  },
  methods: {
    getConnections () {
      this.loading = true
      var last = ''
      if (this.people.length > 0) { last = this.people[this.people.length - 1] }
      var params = [this.username, last, 'blog', this.limit]
      this.$hive.api.callAsync('condenser_api.get_' + this.type, params)
        .then(response => {
          var newPeople = []
          response.forEach(r => {
            if (this.type === 'following') { newPeople.push(r.following) }
            if (this.type === 'followers') { newPeople.push(r.follower) }
          })
          this.people.push.apply(this.people, newPeople)
          this.loading = false
        })
        .catch(() => {
          this.loading = false
          this.$q.notify({ type: 'negative', message: 'Failed to load ' + this.type })
        })
    },
    getHiveAvatarUrl (user) { return 'https://images.hive.blog/u/' + user + '/avatar' },
    getAccountLink (user) { return '/@' + user },
    getAccounts (accounts) {
      var newPeopleToCache = []
      accounts.forEach(p => { if (this.$hiveStore.accounts[p] === undefined) { newPeopleToCache.push(p) } })
      if (newPeopleToCache.length > 0) { this.$hiveStore.getAccounts(newPeopleToCache) }
    }
  },
  computed: {
    globalProps: function () { return this.$hiveStore.globalProps },
    followCount: function () { return this.$hiveStore.followCounts[this.username] },
    loadMoreEnabled: function () {
      const count = this.type === 'following'
        ? this.followCount?.following_count
        : this.followCount?.follower_count
      if (count !== undefined) return count <= this.people.length
      return this.people.length < this.limit
    },
    currentPage: function () {
      return this.people.slice((this.page * this.limit - this.limit), (this.page * this.limit))
    },
    maxPages: function () {
      const count = this.type === 'following'
        ? this.followCount?.following_count
        : this.followCount?.follower_count
      if (count !== undefined) return Math.ceil(count / this.limit)
      return Math.ceil(this.people.length / this.limit)
    }
  },
  mounted () {
    this.getConnections()
    if (this.globalProps.empty) { this.$hiveStore.getGlobalProps() }
    if (this.followCount === null) { this.$hiveStore.getFollowCount(this.username) }
    this.page = 1
  }
}
</script>
