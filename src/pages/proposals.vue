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
                Daily Funded
              </q-item-section>
              <q-item-section>
                Daily Budget
              </q-item-section>
              <q-item-section>
                Total Budget <q-badge color="primary">{{ tidyNumber(daoAccount.hbd_balance) }}</q-badge>
              </q-item-section>
            </q-item>
          </q-list>
        </q-card-section>
        <q-separator />
        <q-card-section>
        <q-list bordered separator>
        <q-item v-for="proposal in proposals" :key="proposal.index">
          <q-list>
            <q-item class="text-h6">
              <router-link :to="returnPostLink(proposal.creator, proposal.permlink)">{{ proposal.subject }}</router-link> <span class="text-grey text-caption">{{ proposal.id }}</span>
            </q-item>
            <q-item dense>
              <q-item-section avatar>
                <q-avatar>
                  <img :src="getHiveAvatarUrl(proposal.creator)" />
                </q-avatar>
              </q-item-section>
              <q-item-section>
                {{ proposal.creator }} (creator)
              </q-item-section>
              <q-item-section avatar v-if="proposal.creator !== proposal.receiver">
                <q-avatar>
                  <img :src="getHiveAvatarUrl(proposal.receiver)" />
                </q-avatar>
              </q-item-section>
              <q-item-section class="q-ma-md" v-if="proposal.creator !== proposal.receiver">
                {{ proposal.receiver }} (receiver)
              </q-item-section>
            </q-item>
            <q-item>
              <q-item-section>
                Starts {{ timeDelta(proposal.start_date) }}
              </q-item-section>
              <q-item-section>
                Ends {{ timeDelta(proposal.end_date) }}
              </q-item-section>
              <q-item-section>
                Daily Pay {{ tidyNumber(proposal.daily_pay.amount / 1000)}} HBD
              </q-item-section>
            </q-item>
            <q-item>
              Total Votes {{ proposal.total_votes }}
            </q-item>
            <q-item>
              <q-icon v-if="proposal.status === 'active'" name="circle" color="green" title="active" />
              <q-icon v-if="proposal.status === 'expired'" name="cancel" color="grey" title="expired" />
              {{ proposal.status }}
            </q-item>
          </q-list>
        </q-item>
        </q-list>
        </q-card-section>
      </q-card>
    </q-page>
</template>
<script>
import moment from 'moment'
export default {
  name: 'Proposals',
  components: {},
  data () {
    return {
      proposals: []
    }
  },
  methods: {
    getAccount (username) {
      if (this.$store.state.hive.accounts[username] === undefined) {
        this.$store.dispatch('hive/getAccount', username)
      }
    },
    listProposals () {
      var params = { limit: 40, order: 'by_total_votes', order_direction: 'descending', start: [-1] }
      this.$hive.api.callAsync('database_api.list_proposals', params)
        .then(response => {
          this.proposals = response.proposals
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
    returnPostLink (author, permlink) { return '/@' + author + '/' + permlink },
    getHiveAvatarUrl (user) { return 'https://images.hive.blog/u/' + user + '/avatar' },
    timeDelta (timestamp) {
      var now = moment.utc()
      var stamp = moment.utc(timestamp)
      var diff = stamp.diff(now, 'minutes')
      return moment.duration(diff, 'minutes').humanize(true)
    }
  },
  computed: {
    daoAccount: {
      cache: false,
      get () {
        return this.$store.state.hive.accounts['hive.fund']
      }
    }
  },
  mounted () {
    document.title = 'Hive Proposal System'
    if (this.daoAccount === undefined || this.daoAccount.name !== this.username) {
      this.getAccount('hive.fund')
    }
    this.listProposals()
  }
}
</script>
