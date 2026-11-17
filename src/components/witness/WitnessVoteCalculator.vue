<template>
  <q-card flat bordered class="vote-calculator">
    <q-card-section class="vote-calculator__body">
      <div class="vote-calculator__intro">
        <p>
          Every witness vote carries the full effective HP of the voting account. Use this
          calculator to see how much one vote is worth and what it would take to move a
          witness into the top 20.
        </p>
        <span v-if="proxy" class="net-chip net-chip--warning">
          <q-icon name="account_tree" size="14px" aria-hidden="true" />
          Using proxy @{{ proxy }}'s voting weight
        </span>
      </div>

      <div class="vote-calculator__inputs">
        <q-input
          v-model.number="hp"
          type="number"
          min="0"
          outlined
          dense
          label="Vote weight"
          suffix="HP"
          inputmode="decimal"
          aria-label="Vote weight in Hive Power"
        />
        <q-btn
          v-if="accountHp > 0"
          flat
          no-caps
          dense
          color="primary"
          icon="person"
          :label="'Use my ' + formatHp(accountHp) + ''"
          @click="useAccountHp"
        />
        <q-select
          v-model="selectedOwner"
          :options="witnessOptions"
          emit-value
          map-options
          outlined
          dense
          options-dense
          label="Witness to model"
          aria-label="Select a witness to model your vote"
        />
      </div>

      <div class="vote-calculator__results">
        <div class="vote-calculator__result">
          <span>Your vote weight</span>
          <strong>{{ formatHp(hp) }}</strong>
          <small>{{ percentOfNetwork }} of network HP</small>
        </div>
        <div class="vote-calculator__result">
          <span>Vote slots</span>
          <strong>{{ weight.votesUsed }} / 30</strong>
          <small>{{ weight.votesLeft }} remaining</small>
        </div>
        <div class="vote-calculator__result">
          <span>Top-20 cutoff</span>
          <strong>{{ formatHp(cutoffHp) }}</strong>
          <small>20th witness by approval</small>
        </div>
        <div class="vote-calculator__result">
          <span>Selected witness</span>
          <strong v-if="impact">{{ formatHp(impact.afterHp) }}</strong>
          <strong v-else>—</strong>
          <small v-if="impact">
            now {{ formatHp(impact.currentHp) }} · rank {{ impact.currentRank || '—' }}
          </small>
          <small v-else>Choose a witness above</small>
        </div>
      </div>

      <div v-if="impact && effectiveHp > 0" class="vote-calculator__outcome" :class="{ 'is-in': impact.entersTopTwenty }">
        <q-icon :name="impact.entersTopTwenty ? 'check_circle' : 'trending_up'" size="18px" aria-hidden="true" />
        <span v-if="impact.entersTopTwenty">
          With this vote, @{{ impact.owner }} would sit at rank #{{ impact.projectedRank }} and inside the top 20.
        </span>
        <span v-else>
          @{{ impact.owner }} would sit at rank #{{ impact.projectedRank }}.
          <template v-if="impact.gapHp > 0">
            It needs {{ formatHp(impact.gapHp) }} more approval to reach the top-20 cutoff.
          </template>
          <template v-else>
            The witness is already above the top-20 cutoff.
          </template>
        </span>
      </div>
      <div v-else-if="impact && effectiveHp <= 0" class="vote-calculator__outcome">
        <q-icon name="info" size="18px" aria-hidden="true" />
        <span>Enter a vote weight above to model how a vote would move @{{ impact.owner }}.</span>
      </div>

      <p class="vote-calculator__note">
        Calculations use the current witness approval totals and global vesting pool. The
        chain allows up to 30 witness votes per account.
      </p>
    </q-card-section>
  </q-card>
</template>

<style scoped>
.vote-calculator {
  overflow: hidden;
  background: rgba(255, 255, 255, 0.028);
}

.vote-calculator__body {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
  padding: 0.9rem 1rem;
}

.vote-calculator__intro {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 0.35rem;
}

.vote-calculator__intro p {
  margin: 0;
  color: #90a4ae;
  font-size: 0.8rem;
  line-height: 1.5;
}

.vote-calculator__inputs {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: var(--space-3);
}

.vote-calculator__inputs > :first-child {
  flex: 0 1 150px;
  min-width: 130px;
}

.vote-calculator__inputs > :last-child {
  flex: 1 1 220px;
  min-width: 0;
}

.vote-calculator__results {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: var(--space-2);
}

.vote-calculator__result {
  display: flex;
  flex-direction: column;
  gap: 0.1rem;
  min-width: 0;
  padding: 0.55rem 0.65rem;
  border-radius: var(--radius-sm);
  background: rgba(255, 255, 255, 0.035);
}

.vote-calculator__result > span {
  color: #90a4ae;
  font-size: 0.66rem;
  letter-spacing: 0.04em;
  text-transform: uppercase;
}

.vote-calculator__result strong {
  color: #e4eaed;
  font-size: 0.95rem;
  font-weight: 600;
  overflow-wrap: anywhere;
}

.vote-calculator__result small {
  color: #78909c;
  font-size: 0.68rem;
}

.vote-calculator__outcome {
  display: flex;
  align-items: flex-start;
  gap: 0.4rem;
  padding: 0.55rem 0.7rem;
  border: 1px solid rgba(255, 183, 77, 0.35);
  border-radius: var(--radius-sm);
  background: rgba(255, 183, 77, 0.07);
  color: #ffcc80;
  font-size: 0.78rem;
  line-height: 1.45;
}

.vote-calculator__outcome.is-in {
  border-color: rgba(76, 175, 80, 0.35);
  background: rgba(76, 175, 80, 0.08);
  color: #a5d6a7;
}

.vote-calculator__note {
  margin: 0;
  color: #78909c;
  font-size: 0.7rem;
  line-height: 1.45;
}

@media (max-width: 799px) {
  .vote-calculator__results {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (max-width: 499px) {
  .vote-calculator__results {
    grid-template-columns: minmax(0, 1fr);
  }
}
</style>

<script>
import {
  accountVoteWeight,
  formatHp,
  topTwentyCutoffHp,
  voteImpact
} from 'src/services/witnesses'

export default {
  name: 'WitnessVoteCalculator',
  props: {
    account: { type: Object, default: null },
    globalProps: { type: Object, default: null },
    witnesses: { type: Array, default: () => [] },
    proxy: { type: String, default: '' }
  },
  data () {
    return {
      hp: null,
      selectedOwner: ''
    }
  },
  computed: {
    weight () {
      return accountVoteWeight(this.account, this.globalProps)
    },
    accountHp () {
      return Math.round(this.weight.hp * 100) / 100
    },
    effectiveHp () {
      if (this.hp === null || this.hp === undefined || this.hp === '') return 0
      return Math.max(0, Number(this.hp) || 0)
    },
    percentOfNetwork () {
      if (!this.weight.networkHp) return '—'
      return ((this.effectiveHp / this.weight.networkHp) * 100).toFixed(5) + '%'
    },
    witnessOptions () {
      return this.witnesses
        .filter(witness => witness?.owner)
        .slice(0, 120)
        .map(witness => ({
          label: '@' + witness.owner + (witness.rank ? ' · #' + witness.rank : ''),
          value: witness.owner
        }))
    },
    cutoffHp () {
      return topTwentyCutoffHp(this.witnesses, this.globalProps)
    },
    impact () {
      if (!this.selectedOwner) return null
      return voteImpact(this.witnesses, this.selectedOwner, this.effectiveHp, this.globalProps)
    }
  },
  watch: {
    accountHp: {
      immediate: true,
      handler (value) {
        if ((this.hp === null || this.hp === undefined) && value > 0) this.hp = value
      }
    },
    witnesses: {
      immediate: true,
      handler (list) {
        if (!this.selectedOwner && list.length) this.selectedOwner = list[0].owner
      }
    }
  },
  methods: {
    formatHp,
    useAccountHp () {
      this.hp = this.accountHp
    }
  }
}
</script>
