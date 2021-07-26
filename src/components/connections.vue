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
    userCard: () => import('components/userCard.vue')
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
      var params = ['follow_api', 'get_' + this.type, [this.username, last, 'blog', this.limit]]
      this.$hive.api.callAsync('call', params)
        .then(response => {
          var newPeople = []
          response.forEach(r => {
            if (this.type === 'following') { newPeople.push(r.following) }
            if (this.type === 'followers') { newPeople.push(r.follower) }
          })
          this.people.push.apply(this.people, newPeople)
          this.loading = false
        })
    },
    getHiveAvatarUrl (user) { return 'https://images.hive.blog/u/' + user + '/avatar' },
    getAccountLink (user) { return '/@' + user },
    getAccounts (accounts) {
      var newPeopleToCache = []
      accounts.forEach(p => { if (this.$store.state.hive.accounts[p] === undefined) { newPeopleToCache.push(p) } })
      if (newPeopleToCache.length > 0) { this.$store.dispatch('hive/getAccounts', newPeopleToCache) }
    }
  },
  computed: {
    globalProps: function () { return this.$store.state.hive.globalProps },
    followCount: function () { return this.$store.state.hive.followCounts[this.username] },
    loadMoreEnabled: function () {
      if (this.followCount) {
        if (this.type === 'following') {
          if (this.followCount.following_count <= this.people.length) { return true } else { return false }
        } else {
          if (this.followCount.follower_count <= this.people.length) { return true } else { return false }
        }
      } else {
        if (this.people.length < this.limit) { return false } else { return true }
      }
    },
    currentPage: function () {
      return this.people.slice((this.page * this.limit - this.limit), (this.page * this.limit))
    },
    maxPages: function () {
      if (this.type === 'following' && this.followCount) {
        return Math.ceil(this.followCount.following_count / this.limit)
      } else if (this.type === 'followers' && this.followCount) {
        return Math.ceil(this.followCount.follower_count / this.limit)
      } else {
        return Math.ceil(this.people / this.limit)
      }
    }
  },
  mounted () {
    this.getConnections()
    if (this.globalProps.empty) { this.$store.dispatch('hive/getGlobalProps') }
    if (this.followCount === undefined) { this.$store.dispatch('hive/getFollowCount', this.username) }
    this.page = 1
  }
}
</script>
