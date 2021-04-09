<template>
  <q-page class="flex q-pa-md flex-center">
    <q-card v-if="globalProps !== undefined && globalProps !== null" class="text-center q-pa-sm q-ma-sm" bordered>
      <q-card-section>
        <div class="text-h5"><q-icon name="img:statics/hbd.svg" title="HBD" size="md" />&nbsp; HBD Stabilizer</div>
        <p><router-link to="@hbdstabilizer">@hbdstabilizer</router-link> is a project by <router-link to="@smooth">@smooth</router-link> that uses HBD from <router-link to="@hive.fund">@hive.fund</router-link> to buy Hive & return it back to <router-link to="@hive.fund">@hive.fund</router-link> whenever HBD is above its fair-value ($1 USD).</p>
        <div class="text-subtitle"><router-link to="@smooth/posts"><q-icon name="info" color="blue" />&nbsp; Learn more from @smooth's posts</router-link></div>
      </q-card-section>
      <q-card-section v-if="dao !== null">
        <div class="text-h6"><q-icon name="account_balance_wallet" color="blue-grey" />&nbsp; <router-link to="@hive.fund">hive.fund</router-link></div>
        <div class="text-subtitle">{{ tidyNumber(dao.balance.split(' ')[0]) }} HIVE<br />
        {{ tidyNumber(dao.hbd_balance.split(' ')[0]) }} HBD</div>
      </q-card-section>
      <q-card-section>
        <div class="text-h6">Funding Proposals</div>
        <div v-for="proposal in proposals" :key="proposal.index">
          #{{ proposal.proposal_id }} - <router-link :to="returnPostLink(proposal.creator, proposal.permlink)">{{ proposal.subject }}</router-link> <q-icon v-if="proposal.status === 'active'" name="check" color="green" title="Proposal funding is active" /><q-icon v-else name="clear" color="red" title="Proposal funding is inactive" />
          {{ tidyNumber(proposal.daily_pay.amount / 1000) }} HBD per day<br />
        </div>
        <div>Daily: <strong>{{ tidyNumber(fundingBudgetDaoDaily) }}</strong> HBD</div>
        <div>Hourly: <strong>{{ tidyNumber(fundingBudgetDaoDaily / 24) }}</strong> HBD</div>
      </q-card-section>
      <q-card-section v-if="openOrders.length > 0">
        <div class="text-h6">Open Market Orders</div>
        <div v-for="order in openOrders" :key="order.index">
          {{ order }}
        </div>
      </q-card-section>
      <q-card-section v-else class="text-subtitle">
        <q-icon name="clear" color="red" />&nbsp; hbdstabilizer has no outstanding market orders
      </q-card-section>
      <q-card-section v-if="hiveTransactions.length > 0">
        <div class="text-h6">Recent transactions for <router-link to="@hbdstabilizer">hbdstabilizer</router-link></div>
        <div class="subtitle">Only show: <q-badge color="blue-grey" class="q-mr-sm" v-for="a in ['transfer', 'fill_order', 'limit_order_create', 'interest', 'fill_convert_request' ]" :key="a.index">{{ a }}</q-badge><router-link to="@hbdstabilizer?filter=transfer,fill_order,limit_order_create,interest,fill_convert_request"><q-icon name="external_link" /></router-link></div>
        <q-scroll-area style="height: 400px; max-width: 100%;">
        <q-list separator>
          <account-operations :account-operations="hiveTransactions" />
        </q-list>
        </q-scroll-area>
      </q-card-section>
    </q-card>
  </q-page>
</template>
<style scoped>
a {text-decoration: none; color: #1d8ce0 }
a:link { color: #1d8ce0; font-weight: normal; text-decoration: none; }
a:visited { color: #1d8ce0; }
</style>
<script>
import { debounce } from 'quasar'
import accountOperations from 'components/accountOperations.vue'
import { ChainTypes, makeBitMaskFilter } from '@hiveio/hive-js/lib/auth/serializer'
const op = ChainTypes.operations
const walletBitmask = makeBitMaskFilter([
  op.transfer,
  op.withdraw_vesting,
  op.interest,
  op.fill_convert_request,
  op.fill_order,
  op.limit_order_create
])
export default {
  name: 'hbd',
  data () {
    return {
      medianPrice: null,
      daoHbdBalance: 0,
      hbdStabilizer: null,
      dao: null,
      openOrders: [],
      accountHistoryPointer: -1,
      accountHistoryLimit: 100,
      hiveTransactions: [],
      bitmask: walletBitmask,
      proposals: []
    }
  },
  components: { accountOperations },
  computed: {
    globalProps: {
      get () {
        return this.$store.state.hive.globalProps
      }
    },
    fundingBudgetDaoDaily: function () {
      var budget = 0
      if (this.proposals.length > 0) {
        this.proposals.forEach(p => { if (p.status === 'active') { budget = budget + (p.daily_pay.amount / 1000) } })
        return budget
      } else {
        return 0
      }
    }
  },
  methods: {
    tidyNumber (x) {
      if (x == null) { return null }
      var parts = x.toString().split('.')
      parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',')
      return parts.join('.')
    },
    getHbdStabilizerAccount () {
      this.$hive.api.getAccountsAsync(['hive.fund'])
        .then((response) => { this.dao = response[0] })
        .catch(() => console.log('Failed to load @hbdstabilizer profile'))
    },
    getOpenOrders () {
      this.$hive.api.getOpenOrdersAsync('hbdstabilizer')
        .then(res => { this.openOrders = res })
    },
    findProposals (ids) { // array of ids
      var params = { proposal_ids: ids }
      this.$hive.api.callAsync('database_api.find_proposals', params)
        .then(response => { this.proposals = response.proposals })
    },
    returnPostLink (author, permlink) {
      return '@' + author + '/' + permlink
    },
    async getHiveWalletTransactions () {
      await this.$hive.api.callAsync(
        'call',
        ['database_api',
          'get_account_history',
          ['hbdstabilizer',
            this.accountHistoryPointer,
            this.accountHistoryLimit,
            ...this.bitmask
          ]
        ]
      )
        .then(res => {
          this.accountHistoryPointer = parseInt(res[0][0]) - 1
          if (this.hiveTransactions.length === 0) {
            this.hiveTransactions = res.reverse()
          } else {
            this.hiveTransactions = this.hiveTransactions.concat(res.reverse())
          }
        })
        .catch(err => {
          console.log(err)
          if (err.data.stack[0].data.sequence && err.cause.message.includes('Could not find filtered operation in')) {
            this.accountHistoryPointer = err.data.stack[0].data.sequence
            debounce(this.getHiveWalletTransactions(), 100)
          }
        })
    }
  },
  mounted () {
    document.title = 'HBDStabilizer Monitor'
    this.getHbdStabilizerAccount()
    this.getOpenOrders()
    this.getHiveWalletTransactions()
    this.findProposals([158, 159, 166, 169])
  },
  created () {
    this.$store.dispatch('hive/getGlobalProps')
  }
}
</script>
