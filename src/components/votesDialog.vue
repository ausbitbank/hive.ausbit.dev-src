<template>
    <q-card flat bordered style="max-width: 1000px; max-width: 95%">
        <q-card-section header class="text-center text-h5">
            Votes on this post : {{ upvotesOnly.length }} upvotes<span v-if="downvotesOnly.length > 0">, {{ downvotesOnly.length }} down</span><span v-if="unvotesOnly.length > 0">, {{ unvotesOnly.length }} unvotes</span><br />
        </q-card-section>
        <q-tabs dense inline-label v-model="view" v-if="!simple">
          <q-tab name="influencers" icon="analytics" label="Influencers" class="text-primary" />
          <q-tab name="table" icon="table_view" label="Full vote data table" class="text-primary" />
        </q-tabs>
        <q-table v-if="view === 'table'" :data="votes" :columns="voteColumns" :pagination="{ sortBy: 'weight', descending: true, rowsPerPage: 25 }" dense bordered separator="cell" />
        <q-card-section v-if="view === 'influencers'" class="text-center">
            <div class="text-h5">The {{ biggestUpvotes.length }} largest upvotes came from</div>
            <span v-for="voter in biggestUpvotes" :key="voter.voter" class="q-ma-sm">
                <router-link :to="linkAccount(voter.voter)">
                <q-avatar>
                    <q-img :src="getHiveAvatarUrl(voter.voter)" :title="voter.voter" />
                </q-avatar>
                {{ voter.voter }}
                </router-link>
            </span>
            <span v-if="downvotesOnly.length > 0">
                <div class="text-h5">The {{ biggestDownvotes.length }} largest downvotes came from</div>
                <span v-for="voter in biggestDownvotes" :key="voter.voter" class="q-ma-sm">
                    <router-link :to="linkAccount(voter.voter)">
                    <q-avatar>
                        <q-img :src="getHiveAvatarUrl(voter.voter)" :title="voter.voter" />
                    </q-avatar>
                    {{ voter.voter }}
                    </router-link>
                </span>
            </span>
        </q-card-section>
    </q-card>
</template>
<script>
export default {
  name: 'votesDialog',
  components: {
  },
  data () {
    return {
      view: 'influencers',
      viewOptions: ['table', 'influencers'],
      voteColumns: [
        { name: 'voter', label: 'Voter', field: 'voter', sortable: true },
        { name: 'percent', label: 'Percent', field: 'percent', sortable: true, format: (val, row) => `${val / 100} %` },
        { name: 'rshares', label: 'rshares', field: 'rshares', sortable: true },
        { name: 'weight', label: 'weight', field: 'weight', sortable: true },
        { name: 'reputation', label: 'reputation', field: 'reputation', sortable: true },
        { name: 'time', label: 'time', field: 'time', sortable: true }
      ]
    }
  },
  props: {
    votes: { type: Array, required: true },
    simple: { type: Boolean, required: false, default: false }
  },
  computed: {
    upvotesOnly: function () { return this.votes.filter(v => Math.sign(v.rshares) === 1) },
    downvotesOnly: function () { return this.votes.filter(v => Math.sign(v.rshares) === -1) },
    unvotesOnly: function () { return this.votes.filter(v => v.rshares === 0) },
    biggestUpvotes: function () {
      var votesSortedByRshares = this.upvotesOnly
      votesSortedByRshares.sort(this.sortByRshares)
      if (votesSortedByRshares.length > 10) { return votesSortedByRshares.slice(0, 10) } else { return votesSortedByRshares }
    },
    biggestDownvotes: function () {
      if (this.downvotesOnly.length > 0) {
        var votesSortedByRshares = this.downvotesOnly
        votesSortedByRshares.sort(this.sortByRshares)
        if (votesSortedByRshares.length > 10) { return votesSortedByRshares.slice(votesSortedByRshares.length - 10, votesSortedByRshares.length - 1) } else { return votesSortedByRshares }
      } else {
        return []
      }
    }
  },
  methods: {
    sortByRshares (a, b) { if (parseFloat(a.rshares) < parseFloat(b.rshares)) { return 1 } else { return -1 } },
    getHiveAvatarUrl (user) { return 'https://images.hive.blog/u/' + user + '/avatar' },
    linkAccount (username) { return '/@' + username }
  },
  mounted () {
  }
}
</script>
