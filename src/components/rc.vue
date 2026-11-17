<template>
  <div v-if="RC.rc_manabar !== undefined" :class="{ 'rc--compact': compact }">
    <q-linear-progress dark stripe rounded :size="compact ? '10px' : '20px'" :value="rcPercent" color="green" :class="compact ? 'q-mt-xs' : 'q-mt-sm'" aria-label="Resource credits available" v-if="!showAccountClaimsOnly">
      <div class="absolute-full flex flex-center">
          <q-badge color="black" text-color="primary" >{{ (rcPercent * 100).toFixed(2) }} %</q-badge>
      </div>
    </q-linear-progress>
    <q-card-section class="text-center" v-if="!compact">
        <div class="text-bold">Enough Resource Credits for approximately <q-icon name="info" color="blue" title="Click for more RC info" @click="showAll = !showAll" /></div>
        <span v-if="!showAccountClaimsOnly">
        <div><q-badge color="primary">{{ resourceBudgetComments }}</q-badge> comments</div>
        <div><q-badge color="primary">{{ resourceBudgetVotes }}</q-badge> votes</div>
        <div><q-badge color="primary">{{ resourceBudgetTransfers }}</q-badge> transfers</div>
        </span>
        <div><q-badge :color="resourceBudgetClaimAccounts > 0 ? 'primary' : 'red'">{{ resourceBudgetClaimAccounts }}</q-badge> account claims</div>
        <div class="text-caption text-grey q-mt-xs">Protocol approximations based on typical operation sizes; actual costs vary with chain state.</div>
    </q-card-section>
    <q-card-section v-if="showAccountClaimsOnly && !compact">
      <q-btn dense color="primary" icon="generating_tokens" label="Claim account creation token" @click="claimAccount()" v-if="loggedInUser" :disable="resourceBudgetClaimAccounts < 1" />
      <q-btn dense flat color="primary" icon="refresh" @click="init()" />
    </q-card-section>
    <q-dialog v-model="showAll">
      <q-card flat bordered style="min-width: 300px text-center">
        <div class="text-h5 text-center">Resource Costs</div>
        <div class="text-subtitle">RC for {{ username }}</div>
        <jsonViewer v-if="RC !== {}" :data="RC" />
      </q-card>
    </q-dialog>
  </div>
</template>
<script>
import { defineAsyncComponent } from 'vue'

// Protocol approximations, not live chain quotes. Hive does not expose a stable
// per-operation RC price through rc_api, and the real cost depends on the
// current resource pool and transaction size. These constants are typical
// values observed on mainnet and are presented as estimates.
const RC_COST_APPROXIMATIONS = {
  comment: 1175937456,
  vote: 109514642,
  transfer: 487237759,
  claimAccount: 8541343515163
}

// Calculate Resource Credits availability, present as a progress bar
export default {
  name: 'rc',
  props: {
    username: { type: String, required: true },
    display: { type: Boolean, default: false },
    showAccountClaimsOnly: { type: Boolean, default: false },
    compact: { type: Boolean, default: false }
  },
  data () {
    return {
      loading: false,
      RC: {},
      showAll: false
    }
  },
  components: {
    jsonViewer: defineAsyncComponent(() => import('components/jsonViewer.vue'))
  },
  computed: {
    loggedInUser: function () { return this.$hiveStore.user.username },
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
        const cost = RC_COST_APPROXIMATIONS.comment
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
        const cost = RC_COST_APPROXIMATIONS.vote
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
        const cost = RC_COST_APPROXIMATIONS.transfer
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
        const cost = RC_COST_APPROXIMATIONS.claimAccount
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
      this.$hiveStore.addToQueue([this.loggedInUser, 'active', tx])
      this.init()
    },
    init () {
      this.getRcForAccount(this.username)
      if (this.loggedInUser) { this.$hiveStore.getAccount(this.loggedInUser) }
    }
  },
  mounted () {
    this.init()
  }
}
</script>
