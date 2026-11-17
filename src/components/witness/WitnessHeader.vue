<template>
  <header class="net-head">
    <div class="net-head__text">
      <div class="net-eyebrow">
        <span class="home-live-dot" :class="{ 'is-live': !loading }" aria-hidden="true"></span>
        Hive governance
      </div>
      <h1 class="net-head__title">Witnesses</h1>
      <p class="net-intro">
        Browse the witnesses securing the Hive chain, compare their votes and health,
        and manage the witnesses your account supports.
      </p>
    </div>

    <div class="net-actions">
      <q-btn
        v-if="loggedIn"
        no-caps
        outline
        :color="myVotesOnly ? 'orange' : 'primary'"
        :icon="myVotesOnly ? 'groups' : 'face'"
        :label="myVotesOnly ? 'Show all witnesses' : 'My votes'"
        :aria-pressed="myVotesOnly"
        @click="$emit('toggle-my-votes')"
      />
      <q-btn
        v-if="loggedIn"
        no-caps
        outline
        :color="proxy ? 'red' : 'primary'"
        icon="account_tree"
        :label="proxy ? 'Proxy: @' + proxy : 'Voting proxy'"
        :aria-label="proxy ? 'Voting proxy is @' + proxy + '. Change or clear it.' : 'Set a voting proxy'"
        @click="$emit('manage-proxy')"
      />
      <q-btn
        no-caps
        outline
        color="primary"
        icon="tune"
        label="Witness tools"
        to="/witness"
      />
      <q-btn flat round dense icon="refresh" aria-label="Refresh witnesses" title="Refresh witnesses" :loading="loading" @click="$emit('refresh')" />
    </div>
  </header>

  <q-card flat bordered class="witness-overview home-card">
    <div class="witness-overview__stats">
      <div class="witness-overview__stat">
        <span class="net-eyebrow">Consensus seats</span>
        <strong>{{ consensusCount }}</strong>
        <span>top 20 voted + one miner</span>
      </div>
      <div class="witness-overview__stat">
        <span class="net-eyebrow">Listed witnesses</span>
        <strong>{{ totalWitnesses.toLocaleString('en-US') }}</strong>
        <span>{{ warningCount }} with health warnings</span>
      </div>
      <div class="witness-overview__stat">
        <span class="net-eyebrow">My votes</span>
        <strong>{{ loggedIn ? myVotes + ' / ' + voteLimit : '—' }}</strong>
        <span v-if="proxy">Controlled by proxy @{{ proxy }}</span>
        <span v-else-if="loggedIn">{{ voteLimit - myVotes }} vote slots remaining</span>
        <span v-else>Log in to vote</span>
      </div>
      <div class="witness-overview__stat">
        <span class="net-eyebrow">Network version</span>
        <strong>v{{ hardforkVersion || '—' }}</strong>
        <span v-if="accountHp !== null">{{ accountHp }} · {{ myVotes }} votes cast</span>
        <span v-else>Consensus version reported by witnesses</span>
      </div>
    </div>
  </q-card>
</template>

<style scoped>
.witness-overview {
  background: rgba(255, 255, 255, 0.028);
}

.witness-overview__stats {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 0;
}

.witness-overview__stat {
  display: flex;
  flex-direction: column;
  gap: 0.15rem;
  min-width: 0;
  padding: 0.85rem 1rem;
  border-left: 1px solid var(--border-subtle);
}

.witness-overview__stat:first-child {
  border-left: 0;
}

.witness-overview__stat strong {
  color: #e4eaed;
  font-size: 1.15rem;
  font-weight: 600;
  line-height: 1.2;
  font-variant-numeric: tabular-nums;
  overflow-wrap: anywhere;
}

.witness-overview__stat > span:last-child {
  color: #78909c;
  font-size: 0.7rem;
  line-height: 1.35;
}

@media (max-width: 899px) {
  .witness-overview__stats {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .witness-overview__stat:nth-child(3) {
    border-left: 0;
    border-top: 1px solid var(--border-subtle);
  }

  .witness-overview__stat:nth-child(4) {
    border-top: 1px solid var(--border-subtle);
  }
}

@media (max-width: 499px) {
  .witness-overview__stats {
    grid-template-columns: minmax(0, 1fr);
  }

  .witness-overview__stat,
  .witness-overview__stat:nth-child(3),
  .witness-overview__stat:nth-child(4) {
    border-left: 0;
    border-top: 1px solid var(--border-subtle);
  }

  .witness-overview__stat:first-child {
    border-top: 0;
  }
}
</style>

<script>
export default {
  name: 'WitnessHeader',
  props: {
    loggedIn: { type: Boolean, default: false },
    myVotesOnly: { type: Boolean, default: false },
    proxy: { type: String, default: '' },
    myVotes: { type: Number, default: 0 },
    voteLimit: { type: Number, default: 30 },
    totalWitnesses: { type: Number, default: 0 },
    warningCount: { type: Number, default: 0 },
    consensusCount: { type: Number, default: 21 },
    hardforkVersion: { type: String, default: '' },
    accountHp: { type: String, default: null },
    loading: { type: Boolean, default: false }
  },
  emits: ['refresh', 'toggle-my-votes', 'manage-proxy']
}
</script>
