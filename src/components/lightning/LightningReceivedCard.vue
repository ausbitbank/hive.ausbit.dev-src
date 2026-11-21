<template>
  <q-card v-if="count" flat bordered class="home-card home-panel lightning-received">
    <q-card-section class="home-panel__head">
      <div>
        <div class="home-eyebrow">Lightning</div>
        <h2 class="home-panel__title">Sats received</h2>
      </div>
      <q-badge color="amber-9" text-color="black">{{ count }} {{ count === 1 ? 'payment' : 'payments' }}</q-badge>
    </q-card-section>

    <div class="lightning-received__body">
      <div class="lightning-received__total">+{{ formatSats(sats) }}</div>
      <dl class="lightning-received__list">
        <div>
          <dt>Bridge fees</dt>
          <dd>{{ fees ? formatSats(fees) : '—' }}</dd>
        </div>
        <div>
          <dt>Latest</dt>
          <dd>{{ latestLabel }}</dd>
        </div>
      </dl>
      <p class="lightning-received__note">
        Incoming @v4vapp transfers and keepsats notifications from the wallet
        rows loaded on this page. This is not a global Lightning index and may
        include a notification and its matching transfer.
      </p>
    </div>

    <q-card-section class="home-panel__footer">
      <span>Settled on Hive</span>
      <router-link to="/lightning">Open Lightning</router-link>
    </q-card-section>
  </q-card>
</template>

<script>
import { formatSats } from 'src/services/lightning'
import { lightningReceivedStats } from 'src/services/lightningStats'

export default {
  name: 'LightningReceivedCard',
  props: {
    entries: { type: Array, default: () => [] },
    username: { type: String, required: true }
  },
  computed: {
    stats () {
      return lightningReceivedStats(this.entries, this.username)
    },
    count () {
      return this.stats.count
    },
    sats () {
      return this.stats.sats
    },
    fees () {
      return this.stats.fees
    },
    latestLabel () {
      if (!this.stats.latest) return '—'
      const date = new Date(this.stats.latest)
      return Number.isNaN(date.getTime()) ? this.stats.latest : date.toLocaleDateString([], {
        day: 'numeric',
        month: 'short',
        year: 'numeric'
      })
    }
  },
  methods: {
    formatSats
  }
}
</script>

<style scoped>
.lightning-received__body {
  padding: 0.75rem 1rem 0.8rem;
}

.lightning-received__total {
  color: #a5d6a7;
  font-size: 1.35rem;
  font-weight: 700;
}

.lightning-received__list {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(130px, 1fr));
  gap: 0.4rem;
  margin: 0.5rem 0 0;
}

.lightning-received__list > div {
  padding-top: 0.35rem;
  border-top: 1px solid var(--border-subtle);
}

.lightning-received__list dt {
  color: #78909c;
  font-size: 0.64rem;
  text-transform: uppercase;
  letter-spacing: 0.04em;
}

.lightning-received__list dd {
  margin: 0.1rem 0 0;
  color: #e4eaed;
  font-size: 0.8rem;
  font-weight: 600;
}

.lightning-received__note {
  margin: 0.55rem 0 0;
  color: #78909c;
  font-size: 0.66rem;
  line-height: 1.45;
}
</style>
