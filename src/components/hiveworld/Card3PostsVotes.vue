<template>
  <div>
    <q-table title="Votes" :data="voteData" :columns="voteColumns" row-key="voter" style="max-height: 100vh"/>
  </div>
</template>

<script>
export default {
  name: 'Card3PostsVotes',
  props: ['post'],
  data () {
    return {
      voteColumns: [
        {
          name: 'voter',
          label: 'Voter',
          field: row => row.voter,
          sortable: true
        },
        {
          name: 'rshares',
          label: 'Reward Shares',
          field: row => row.rshares,
          sortable: true
        },
        {
          name: 'percent',
          label: 'Vote Weight %',
          field: row => row.percent,
          sortable: true
        }
      ]
    }
  },
  computed: {
    voteData: function () {
      if (this.post.active_votes !== null) {
        var v = []
        this.post.active_votes.forEach(vote => {
          v.push({ voter: vote.voter, rshares: vote.rshares, percent: vote.percent })
        })
        return v
      } else {
        return []
      }
    }
  },
  methods: {
  }
}
</script>
