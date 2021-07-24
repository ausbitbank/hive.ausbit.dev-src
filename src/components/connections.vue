<template>
    <div>
        <user-card :username="person" v-for="person in people" :key="person" />
        <div style="margin:auto" class="text-center">
            <q-btn flat icon="search" @click="getConnections()" color="primary">
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
      loading: false
    }
  },
  components: {
    userCard: () => import('components/userCard.vue')
  },
  methods: {
    getConnections () {
      this.loading = true
      var last = ''
      if (this.people.length > 0) { last = this.people[this.people.length - 1] }
      var params = ['follow_api', 'get_' + this.type, [this.username, last, 'blog', 50]]
      this.$hive.api.callAsync('call', params)
        .then(response => {
          var newPeople = []
          var newPeopleToCache = []
          response.forEach(r => {
            if (this.type === 'following') { newPeople.push(r.following) }
            if (this.type === 'followers') { newPeople.push(r.follower) }
          })
          newPeople.forEach(p => { if (this.$store.state.hive.accounts[p] === undefined) { newPeopleToCache.push(p) } })
          this.$store.dispatch('hive/getAccounts', newPeopleToCache)
          this.people.push.apply(this.people, newPeople)
          this.loading = false
        })
    },
    getHiveAvatarUrl (user) { return 'https://images.hive.blog/u/' + user + '/avatar' },
    getAccountLink (user) { return '/@' + user }
  },
  computed: {
    globalProps: function () { return this.$store.state.hive.globalProps }
  },
  mounted () {
    this.getConnections()
    if (this.globalProps.empty) { this.$store.dispatch('hive/getGlobalProps') }
  }
}
</script>
