<template>
    <q-page class="flex q-pa-md flex-center">
      <q-card>
        <q-card-section class="text-h5 text-center">
          Decentralized Hive Fund
        </q-card-section>
        <q-card-section>
          <q-list v-if="daoAccount !== undefined">
            <q-item>
              <q-item-section>
                Maximum Daily Budget <q-badge color="primary">{{ tidyNumber(parseInt(daoAccount.hbd_balance.split(' ')[0]) / 10) }} HBD</q-badge>
              </q-item-section>
              <q-item-section>
                Total Budget <q-badge color="primary">{{ tidyNumber(daoAccount.hbd_balance) }}</q-badge>
              </q-item-section>
            </q-item>
          </q-list>
        </q-card-section>
        <q-card-section class="text-center">
          <q-checkbox v-model="filterExpired" label="Hide Expired" />
          <q-checkbox v-model="filterFunded" label="Hide Funded" />
          <q-checkbox v-model="filterUnfunded" label="Hide Unfunded" />
          <q-checkbox v-model="filterActive" label="Hide Active" /><br />
          <q-checkbox v-model="filterVoted" label="Hide Already Voted" v-if="loggedInUser" /><br />
          <div class="text-center">{{ filteredProposals.length }} proposals displayed, {{ proposals.length }} loaded</div>
          <div class="text-center">Votes needed for funding: ~{{ tidyNumber((vestToHive(returnProposalVotes) / 1000000).toFixed()) }} HP</div>
        </q-card-section>
        <q-card-section class="text-center q-gutter-y-md">
          <div style="text-align: center">
            <q-input v-model="search" label="Search proposals">
              <template v-if="search" v-slot:append>
                <q-icon name="cancel" @click.stop="search = ''" class="cursor-pointer" />
              </template>
            </q-input>
          </div>
        </q-card-section>
        <q-card-section>
        <q-list bordered separator>
        <q-item v-for="proposal in filteredProposals" :key="proposal.index">
          <proposal :p="proposal" :returnProposalVotes="returnProposalVotes" />
        </q-item>
        </q-list>
        <q-btn class="q-ma-md" @click="listProposals()" label="Load more proposals" push color="primary" icon="sync" v-if="false" />
        </q-card-section>
      </q-card>
    </q-page>
</template>
<script>
import moment from 'moment'
import proposal from 'components/proposal.vue'
export default {
  name: 'Proposals',
  components: { proposal },
  data () {
    return {
      proposals: [],
      filterExpired: true,
      filterFunded: false,
      filterUnfunded: false,
      filterActive: false,
      filterVoted: false,
      search: this.$route.query.search || '',
      votes: null
    }
  },
  methods: {
    getAccount (username) {
      if (this.$store.state.hive.accounts[username] === undefined) {
        this.$store.dispatch('hive/getAccount', username)
      }
    },
    listProposals () {
      var start = [-1]
      if (this.proposals.length > 0) { start = [this.proposals[this.proposals.length - 10].proposal_id] }
      var params = { limit: 200, order: 'by_total_votes', order_direction: 'descending', start: start }
      this.$hive.api.callAsync('database_api.list_proposals', params)
        .then(response => {
          if (this.proposals.length > 0) {
            this.proposals.concat(response.proposals)
          } else {
            this.proposals = response.proposals
          }
          if (this.loggedInUser) {
            this.getUserVotes()
          }
        })
    },
    tidyNumber (x) {
      if (x) {
        var parts = x.toString().split('.')
        parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',')
        return parts.join('.')
      } else {
        return null
      }
    },
    timeDelta (timestamp) {
      var now = moment.utc()
      var stamp = moment.utc(timestamp)
      var diff = stamp.diff(now, 'minutes')
      return moment.duration(diff, 'minutes').humanize(true)
    },
    vestToHive (vests) {
      if (this.globalProps) {
        return this.$hive.formatter.vestToHive(vests, this.globalProps.total_vesting_shares, this.globalProps.total_vesting_fund_hive)
      } else {
        return null
      }
    },
    getUserVotes () {
      var params = { limit: 100, order: 'by_voter_proposal', order_direction: 'ascending', start: [this.loggedInUser] }
      this.$hive.api.callAsync('database_api.list_proposal_votes', params)
        .then(response => {
          this.votes = response.proposal_votes
          this.votes.forEach(v => {
            if (v.voter === this.loggedInUser) {
              var prop = this.proposals.find(p => p.id === v.proposal.id)
              if (prop) { prop.voted = true }
            }
          })
        })
    }
  },
  computed: {
    loggedInUser: function () {
      return this.$store.state.hive.user.username
    },
    globalProps: function () {
      return this.$store.state.hive.globalProps
    },
    daoAccount: {
      cache: false,
      get () {
        return this.$store.state.hive.accounts['hive.fund']
      }
    },
    filteredProposals: function () {
      var fp = this.proposals
      if (this.proposals.length > 0) {
        if (this.filterExpired) { fp = fp.filter(proposal => proposal.status !== 'expired') }
        if (this.filterActive) { fp = fp.filter(proposal => proposal.status !== 'active') }
        if (this.filterVoted) { fp = fp.filter(proposal => proposal.voted !== true) }
        if (this.filterFunded) { fp = fp.filter(proposal => proposal.total_votes < this.returnProposalVotes) }
        if (this.filterUnfunded) { fp = fp.filter(proposal => proposal.total_votes >= this.returnProposalVotes) }
        if (this.search !== '') { fp = fp.filter(proposal => proposal.subject.includes(this.search) || proposal.receiver.includes(this.search) || proposal.creator.includes(this.search)) }
        return fp
      } else {
        return []
      }
    },
    returnProposalVotes: function () {
      var returnProp = this.proposals.find(proposal => proposal.id === 0)
      if (returnProp) { return parseInt(returnProp.total_votes) } else { return 0 }
    }
  },
  mounted () {
    document.title = 'Hive Proposal System'
    if (this.daoAccount === undefined || this.daoAccount.name !== this.username) {
      this.getAccount('hive.fund')
    }
    this.listProposals()
    if (this.globalProps.empty) {
      this.$store.dispatch('hive/getGlobalProps')
    }
  }
}
</script>
