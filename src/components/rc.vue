<template>
  <div v-if="RC.rc_manabar !== undefined" class="rc" :class="{ 'rc--compact': compact }">
    <template v-if="compact">
      <span class="rc__value">{{ rcLabel }}%</span>
      <q-linear-progress
        dark
        rounded
        size="8px"
        :value="rcPercent"
        :color="rcColor"
        class="rc__bar account-stat__bar"
        aria-label="Resource credits available"
      />
      <small class="rc__legend">
        <span class="rc__dot" :class="'rc__dot--' + rcColor" aria-hidden="true"></span>
        <span>{{ rcStateLabel }}</span>
      </small>
    </template>

    <template v-else>
      <div class="rc__full-head">
        <div class="rc__full-title">Resource credits</div>
        <button type="button" class="rc__value rc__value--button" :aria-expanded="showAll" @click="showAll = !showAll" title="Show resource credit details">
          {{ rcLabel }}%
          <q-icon name="info" size="15px" aria-hidden="true" />
        </button>
      </div>
      <q-linear-progress dark rounded size="10px" :value="rcPercent" :color="rcColor" class="rc__bar rc__bar--full" aria-label="Resource credits available" />
      <div class="rc__full-legend">{{ rcStateLabel }}</div>

      <div class="rc__budget" v-if="!showAccountClaimsOnly">
        <div class="rc__budget-item"><span class="rc__budget-value">{{ resourceBudgetComments }}</span><span class="rc__budget-label">comments</span></div>
        <div class="rc__budget-item"><span class="rc__budget-value">{{ resourceBudgetVotes }}</span><span class="rc__budget-label">votes</span></div>
        <div class="rc__budget-item"><span class="rc__budget-value">{{ resourceBudgetTransfers }}</span><span class="rc__budget-label">transfers</span></div>
        <div class="rc__budget-item" :class="{ 'is-low': resourceBudgetClaimAccounts < 1 }"><span class="rc__budget-value">{{ resourceBudgetClaimAccounts }}</span><span class="rc__budget-label">account claims</span></div>
      </div>
      <p class="rc__note">Approximate operation budgets; actual costs vary with chain state.</p>

      <div class="rc__actions">
        <q-btn dense no-caps unelevated color="primary" icon="generating_tokens" label="Claim account token" @click="claimAccount()" v-if="loggedInUser && showAccountClaimsOnly" :disable="resourceBudgetClaimAccounts < 1" class="rc__action" />
        <q-btn dense flat round color="grey" icon="refresh" title="Refresh resource credits" aria-label="Refresh resource credits" @click="init()" class="rc__refresh" />
      </div>
    </template>

    <q-dialog v-model="showAll">
      <q-card flat class="rc-dialog">
        <div class="rc-dialog__head">
          <div class="rc-dialog__eyebrow">Resource credits</div>
          <h3 class="rc-dialog__title">Resource costs for @{{ username }}</h3>
        </div>
        <div class="rc-dialog__body">
          <jsonViewer v-if="RC !== {}" :data="RC" />
        </div>
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
  components: {
    jsonViewer: defineAsyncComponent(() => import('components/jsonViewer.vue'))
  },
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
  computed: {
    loggedInUser: function () { return this.$hiveStore.user.username },
    rcPercent: function () {
      if (this.RC.max_rc !== undefined) {
        var max = this.RC.max_rc
        var current = this.RC.rc_manabar.current_mana
        return Math.min(1, Math.max(0, parseFloat(((current / max)))))
      } else {
        return null
      }
    },
    rcLabel: function () {
      if (this.rcPercent === null) return '—'
      return (this.rcPercent * 100).toFixed(2)
    },
    rcColor: function () {
      if (this.rcPercent === null) return 'grey'
      if (this.rcPercent <= 0.1) return 'red'
      if (this.rcPercent <= 0.3) return 'orange'
      return 'green'
    },
    rcStateLabel: function () {
      if (this.rcPercent === null) return 'Unavailable'
      if (this.rcPercent <= 0.1) return 'Low'
      if (this.rcPercent <= 0.3) return 'Running low'
      return 'Healthy'
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

<style scoped>
/* Compact form: mirrors the account-stat tile next to it (label, value, bar,
   small hint) so the overview grid keeps one visual rhythm. */
.rc--compact {
  display: flex;
  flex-direction: column;
  gap: 0.1rem;
  min-width: 0;
}

.rc__value {
  color: #e4eaed;
  font-size: 0.95rem;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
  line-height: 1.3;
}

.rc__value--button {
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
  padding: 0;
  border: 0;
  background: none;
  font: inherit;
  font-size: 0.95rem;
  font-weight: 600;
  cursor: pointer;
}

.rc__value--button .q-icon {
  color: #78909c;
}

.rc__value--button:hover .q-icon {
  color: #4fc3f7;
}

.rc__bar {
  margin-top: 0.2rem;
}

.rc__legend {
  display: flex;
  align-items: center;
  gap: 0.25rem;
  color: #78909c;
  font-size: 0.68rem;
  line-height: 1.3;
}

.rc__dot {
  flex: none;
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: #78909c;
}

.rc__dot--green { background: #66bb6a; }
.rc__dot--orange { background: #ffb74d; }
.rc__dot--red { background: #e57373; }

/* Full form used by the account creation page. */
.rc__full-head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: var(--space-2);
}

.rc__full-title {
  color: #90a4ae;
  font-size: 0.64rem;
  letter-spacing: 0.05em;
  text-transform: uppercase;
}

.rc__bar--full {
  margin-top: 0.35rem;
}

.rc__full-legend {
  margin-top: 0.3rem;
  color: #78909c;
  font-size: 0.72rem;
}

.rc__budget {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(110px, 1fr));
  gap: var(--space-2);
  margin-top: var(--space-3);
}

.rc__budget-item {
  display: flex;
  flex-direction: column;
  gap: 1px;
  padding: 0.45rem 0.55rem;
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-sm);
  background: rgba(255, 255, 255, 0.025);
}

.rc__budget-item.is-low {
  border-color: rgba(229, 115, 115, 0.35);
}

.rc__budget-value {
  color: #e4eaed;
  font-size: 0.92rem;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
}

.rc__budget-label {
  color: #78909c;
  font-size: 0.66rem;
  letter-spacing: 0.04em;
  text-transform: uppercase;
}

.rc__note {
  margin: 0.55rem 0 0;
  color: #78909c;
  font-size: 0.7rem;
  line-height: 1.4;
}

.rc__actions {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  margin-top: var(--space-2);
}

.rc__action {
  border-radius: var(--radius-pill);
  font-size: 0.78rem;
  font-weight: 600;
}

.rc__refresh {
  margin-left: auto;
  color: #90a4ae;
}

.rc-dialog {
  width: min(560px, 94vw);
  max-height: 82vh;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-card);
  background: #10181d;
  box-shadow: var(--shadow-pop);
}

.rc-dialog__head {
  padding: var(--space-4) var(--space-4) var(--space-2);
  border-bottom: 1px solid var(--border-subtle);
}

.rc-dialog__eyebrow {
  color: #78909c;
  font-size: 0.64rem;
  letter-spacing: 0.07em;
  text-transform: uppercase;
}

.rc-dialog__title {
  margin: 0.1rem 0 0;
  color: #e4eaed;
  font-size: 0.95rem;
  font-weight: 600;
}

.rc-dialog__body {
  padding: var(--space-3) var(--space-4) var(--space-4);
  overflow: auto;
}
</style>