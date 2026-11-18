<template>
    <div>
        <infinite-scroll :can-load="!loadMoreEnabled" :loading="loading" :offset="400" @load="getConnections">
            <user-card :username="person" :show-cover="false" v-for="person in people" :key="person" />
        </infinite-scroll>
        <div class="text-center text-caption text-grey q-pa-md">
            Showing {{ people.length }} of {{ total }} {{ type }}
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
      limit: 100
    }
  },
  components: {
    userCard: defineAsyncComponent(() => import('components/userCard.vue')),
    infiniteScroll: defineAsyncComponent(() => import('components/ui/InfiniteScroll.vue'))
  },
  watch: {
    username () {
      this.people = []
      this.loading = false
      if (this.followCount === null) this.$hiveStore.getFollowCount(this.username)
      this.getConnections()
    }
  },
  methods: {
    getConnections () {
      if (this.loading) return
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
          this.getAccounts(newPeople)
          this.loading = false
        })
        .catch(() => {
          this.loading = false
          this.$q.notify({ type: 'negative', message: 'Failed to load ' + this.type })
        })
    },
    getAccounts (accounts) {
      var newPeopleToCache = []
      accounts.forEach(p => { if (this.$hiveStore.accounts[p] === undefined) { newPeopleToCache.push(p) } })
      if (newPeopleToCache.length > 0) { this.$hiveStore.getAccounts(newPeopleToCache) }
    }
  },
  computed: {
    globalProps: function () { return this.$hiveStore.globalProps },
    followCount: function () { return this.$hiveStore.followCounts[this.username] },
    total: function () {
      const count = this.type === 'following'
        ? this.followCount?.following_count
        : this.followCount?.follower_count
      return count === undefined || count === null ? this.people.length : count
    },
    loadMoreEnabled: function () {
      const count = this.type === 'following'
        ? this.followCount?.following_count
        : this.followCount?.follower_count
      if (count !== undefined && count !== null) return count <= this.people.length
      return this.people.length < this.limit
    }
  },
  mounted () {
    this.getConnections()
    if (this.globalProps.empty) { this.$hiveStore.getGlobalProps() }
    if (this.followCount === null) { this.$hiveStore.getFollowCount(this.username) }
  }
}
</script>
