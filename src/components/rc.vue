<template>
  <div v-if="RC.rc_manabar !== undefined">
    <q-linear-progress dark stripe rounded size="20px" :value="rcPercent" color="green" class="q-mt-sm" v-if="!showAccountClaimsOnly">
      <div class="absolute-full flex flex-center">
          <q-badge color="black" text-color="primary" >{{ (rcPercent * 100).toFixed(2) }} %</q-badge>
      </div>
    </q-linear-progress>
    <q-card-section class="text-center">
        <div class="text-bold">Enough Resource Credits for approximately <q-icon name="info" color="blue" title="Click for more RC info" @click="showAll = !showAll" /></div>
        <span v-if="!showAccountClaimsOnly">
        <div><q-badge color="primary">{{ resourceBudgetComments }}</q-badge> comments</div>
        <div><q-badge color="primary">{{ resourceBudgetVotes }}</q-badge> votes</div>
        <div><q-badge color="primary">{{ resourceBudgetTransfers }}</q-badge> transfers</div>
        </span>
        <div><q-badge :color="resourceBudgetClaimAccounts > 0 ? 'primary' : 'red'">{{ resourceBudgetClaimAccounts }}</q-badge> account claims</div>
    </q-card-section>
    <q-card-section v-if="showAccountClaimsOnly">
      <q-btn dense color="primary" icon="generating_tokens" label="Claim account creation token" @click="claimAccount()" v-if="loggedInUser" :disable="resourceBudgetClaimAccounts < 1" />
      <q-btn dense flat color="primary" icon="refresh" @click="init()" />
    </q-card-section>
    <q-dialog v-model="showAll">
      <q-card flat bordered style="min-width: 300px text-center">
        <div class="text-h5 text-center">Resource Costs</div>
        <div class="text-subtitle">RC for {{ username }}</div>
        <jsonViewer v-if="RC !== {}" :data="RC" />
        <div class="text-subtitle">Live costs</div>
        <jsonViewer v-if="costs !== null" :data="costs" />
      </q-card>
    </q-dialog>
  </div>
</template>
<script>
// Calculate Resource Credits availability, present as a progress bar
export default {
  name: 'rc',
  props: ['username', 'display', 'showAccountClaimsOnly'],
  data () {
    return {
      loading: false,
      RC: {},
      costs: null,
      showAll: false
    }
  },
  components: {
    jsonViewer: () => import('components/jsonViewer.vue')
  },
  computed: {
    loggedInUser: function () { return this.$store.state.hive.user.username },
    rcPercent: function () {
      if (this.RC.max_rc !== undefined) {
        var max = this.RC.max_rc
        var current = this.RC.rc_manabar.current_mana
        return parseFloat(((current / max)))
      } else {
        return null
      }
    },
    resourceBudgetComments: function () {
      if (this.RC.rc_manabar !== undefined) {
        var cost = 1175937456
        if (this.costs !== null) { cost = this.costs.comment }
        var available = (this.RC.rc_manabar.current_mana / cost)
        if (available >= 1000000) {
          return '1M+'
        } else {
          return this.tidyNumber(available.toFixed(0))
        }
      } else {
        return null
      }
    },
    resourceBudgetVotes: function () {
      if (this.RC.rc_manabar !== undefined) {
        var cost = 109514642
        if (this.costs !== null) { cost = this.costs.vote }
        var available = (this.RC.rc_manabar.current_mana / cost)
        if (available >= 1000000) {
          return '1M+'
        } else {
          return this.tidyNumber(available.toFixed(0))
        }
      } else {
        return null
      }
    },
    resourceBudgetTransfers: function () {
      if (this.RC.rc_manabar !== undefined) {
        var cost = 487237759
        if (this.costs !== null) { cost = this.costs.transfer }
        var available = (this.RC.rc_manabar.current_mana / cost)
        if (available >= 1000000) {
          return '1M+'
        } else {
          return this.tidyNumber(available.toFixed(0))
        }
      } else {
        return null
      }
    },
    resourceBudgetClaimAccounts: function () {
      if (this.RC.rc_manabar !== undefined) {
        var cost = 8541343515163
        if (this.costs !== null) { cost = this.costs.claim_account }
        var available = (this.RC.rc_manabar.current_mana / cost)
        if (available >= 1000000) {
          return '1M+'
        } else {
          return this.tidyNumber(available.toFixed(0))
        }
      } else {
        return null
      }
    }
  },
  methods: {
    getRcForAccount (account) {
      this.loading = true
      var params = { accounts: [account] }
      this.$hive.api.callAsync('rc_api.find_rc_accounts', params)
        .then(res => {
          this.loading = false
          this.RC = res.rc_accounts[0]
        })
    },
    getResourceCosts () {
      this.$axios.get('https://api.ausbit.dev/rc')
        .then((res) => { this.costs = res.data })
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
    claimAccount () {
      var tx = ['claim_account', { creator: this.loggedInUser, fee: '0.000 HIVE', extensions: [] }]
      this.$store.commit('hive/addToQueue', [this.loggedInUser, 'active', tx])
      this.init()
    },
    init () {
      this.getRcForAccount(this.username)
      if (this.costs === null) { this.getResourceCosts() }
      if (this.loggedInUser) { this.$store.dispatch('hive/getAccount', this.loggedInUser) }
    }
  },
  mounted () {
    this.init()
  }
}
</script>
