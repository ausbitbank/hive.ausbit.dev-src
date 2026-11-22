<template>
  <q-card flat bordered class="home-card home-panel hbd-peg-card">
    <q-card-section class="home-panel__head">
      <div>
        <div class="home-eyebrow">
          <q-icon name="attach_money" size="14px" aria-hidden="true" />
          Stablecoin
        </div>
        <h3 class="home-panel__title">HBD peg</h3>
      </div>
      <q-badge
        v-if="peg && peg.primary"
        :color="peg.primary.color"
        text-color="black"
      >{{ peg.primary.label }}</q-badge>
    </q-card-section>

    <div class="hbd-peg__body">
      <p class="hbd-peg__intro">
        HBD targets $1.00. Premiums and discounts show where it trades against that peg.
      </p>

      <dl class="hbd-peg__list">
        <div v-for="row in rows" :key="row.key" class="hbd-peg__row">
          <dt>{{ row.label }}</dt>
          <dd>
            <span>{{ row.price }}</span>
            <span v-if="row.premium !== null" class="hbd-peg__premium" :class="row.className">
              {{ row.premium }}
            </span>
          </dd>
        </div>
      </dl>
    </div>

    <q-card-section class="home-panel__footer">
      <span>External quote, internal market and median feed</span>
      <router-link to="/hbd">HBD monitor</router-link>
    </q-card-section>
  </q-card>
</template>

<script>
import { formatSignedPercent } from 'src/services/market'
import { formatUsd } from 'src/services/home'

function pegRow (key, label, peg) {
  if (!peg) {
    return { key, label, price: '—', premium: null, className: 'is-flat' }
  }
  return {
    key,
    label,
    price: formatUsd(peg.price),
    premium: formatSignedPercent(peg.premium),
    className: peg.premium > 0 ? 'is-up' : peg.premium < 0 ? 'is-down' : 'is-flat'
  }
}

export default {
  name: 'HbdPegCard',
  props: {
    peg: { type: Object, default: null }
  },
  computed: {
    rows () {
      return [
        pegRow('external', 'External HBD price', this.peg?.external),
        pegRow('internal', 'Internal market implies', this.peg?.internal),
        pegRow('median', 'Median feed implies', this.peg?.median)
      ]
    }
  }
}
</script>

<style scoped>
.hbd-peg__body {
  padding: 0.75rem 1rem 0.7rem;
}

.hbd-peg__intro {
  margin: 0 0 0.4rem;
  color: var(--c-text-subtle);
  font-size: 0.78rem;
  line-height: 1.45;
}

.hbd-peg__list {
  margin: 0;
}

.hbd-peg__row {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: var(--space-2);
  padding: 0.4rem 0;
  border-top: 1px solid var(--border-subtle);
}

.hbd-peg__row dt {
  color: var(--c-text-faint);
  font-size: 0.72rem;
}

.hbd-peg__row dd {
  display: flex;
  align-items: baseline;
  gap: 0.35rem;
  margin: 0;
  color: var(--c-text);
  font-size: 0.82rem;
  font-weight: 600;
  text-align: right;
  font-variant-numeric: tabular-nums;
}

.hbd-peg__premium {
  font-size: 0.7rem;
  font-weight: 600;
}

.is-up {
  color: var(--c-positive);
}

.is-down {
  color: var(--c-negative);
}

.is-flat {
  color: var(--c-text-subtle);
}
</style>
