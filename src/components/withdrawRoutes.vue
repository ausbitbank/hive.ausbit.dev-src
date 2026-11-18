<template>
  <div class="withdraw-routes">
    <ul v-if="routes && routes.length" class="withdraw-list" aria-label="Withdraw routes">
      <li v-for="route in routes" :key="route.to_account + route.percent" class="withdraw-row">
        <router-link :to="'/@' + route.to_account" class="withdraw-row__account">@{{ route.to_account }}</router-link>
        <span class="withdraw-row__percent">{{ route.percent / 100 }}%</span>
        <span class="withdraw-row__mode" :class="route.auto_vest ? 'is-staked' : 'is-liquid'">
          {{ route.auto_vest ? 'Staked' : 'Liquid' }}
        </span>
        <q-btn
          v-if="loggedInUser === username"
          flat
          dense
          round
          size="sm"
          icon="close"
          color="red-4"
          class="withdraw-row__remove"
          :aria-label="'Remove withdraw route to ' + route.to_account"
          :title="'Remove route to @' + route.to_account"
          @click="setWithdrawRoute(username, route.to_account, 0, false)"
        />
      </li>
    </ul>
    <p v-else class="withdraw-empty">
      <q-icon name="alt_route" size="15px" aria-hidden="true" />
      <span>No withdraw routes set. Rewards stay in this account.</span>
    </p>

    <div v-if="loggedInUser === username" class="withdraw-actions">
      <q-btn flat dense no-caps icon="add" color="primary" class="withdraw-actions__btn" title="Add withdraw route">
        <q-popup-proxy>
          <q-card flat class="withdraw-editor">
            <div class="withdraw-editor__head">
              <div class="withdraw-editor__eyebrow">Rewards</div>
              <h3 class="withdraw-editor__title">Add a withdraw route</h3>
            </div>
            <div class="withdraw-editor__body">
              <q-input disable dense outlined label="From account" v-model="newRoute.from_account" />
              <q-input dense outlined label="To account" v-model="newRoute.to_account" :rules="[val => !!val || 'Field is required']" />
              <div class="withdraw-editor__slider">
                <div class="withdraw-editor__slider-row">
                  <span>Percentage</span>
                  <span class="withdraw-editor__slider-value">{{ newRoute.percent }}%</span>
                </div>
                <q-slider dense v-model="newRoute.percent" :min="0" :max="100" color="primary" :aria-label="'Percentage for new route'" />
              </div>
              <q-checkbox left-label label="Automatic vesting (stake rewards)" v-model="newRoute.auto_vest" class="withdraw-editor__check" />
            </div>
            <div class="withdraw-editor__actions">
              <q-btn flat dense no-caps label="Cancel" color="grey" v-close-popup />
              <q-btn unelevated dense no-caps label="Add route" color="primary" @click="setWithdrawRoute(username, newRoute.to_account, newRoute.percent * 100, newRoute.auto_vest)" v-close-popup />
            </div>
          </q-card>
        </q-popup-proxy>
      </q-btn>
      <q-btn flat dense round size="sm" icon="refresh" color="grey" class="withdraw-actions__refresh" title="Refresh withdraw routes" aria-label="Refresh withdraw routes" @click="getWithdrawRoutes()" />
    </div>
  </div>
</template>
<script>
export default {
  name: 'withdrawRoutes',
  data () {
    return {
      routes: null,
      newRoute: { from_account: this.username, to_account: '', percent: 100, auto_vest: false }
    }
  },
  props: ['username'],
  computed: {
    loggedInUser: {
      get () { return this.$hiveStore.user.username }
    }
  },
  methods: {
    getWithdrawRoutes () {
      this.$hive.api.getWithdrawRoutesAsync(this.username, 1)
        .then(res => { this.routes = res })
    },
    setWithdrawRoute (fromAccount, toAccount, percent, autoVest) {
      this.$hiveStore.addToQueue([this.username, 'active', ['set_withdraw_vesting_route', { from_account: fromAccount, to_account: toAccount, percent: percent, auto_vest: autoVest }]])
    }
  },
  mounted () {
    this.getWithdrawRoutes()
  }
}
</script>

<style scoped>
.withdraw-routes {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

.withdraw-list {
  margin: 0;
  padding: 0;
  list-style: none;
}

.withdraw-row {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  min-width: 0;
  padding: 0.35rem 0;
  border-top: 1px solid var(--border-subtle);
  font-size: 0.78rem;
}

.withdraw-row:first-child {
  border-top: 0;
}

.withdraw-row__account {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  color: #4fc3f7;
  font-weight: 600;
  text-decoration: none;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.withdraw-row__account:hover {
  text-decoration: underline;
}

.withdraw-row__percent {
  color: #e4eaed;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
}

.withdraw-row__mode {
  padding: 0.05rem 0.4rem;
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-pill);
  color: #b0bec5;
  font-size: 0.66rem;
  font-weight: 600;
  letter-spacing: 0.03em;
  text-transform: uppercase;
}

.withdraw-row__mode.is-staked {
  border-color: rgba(129, 199, 132, 0.35);
  color: #a5d6a7;
}

.withdraw-row__mode.is-liquid {
  border-color: rgba(79, 195, 247, 0.3);
  color: #81d4fa;
}

.withdraw-row__remove {
  flex: none;
}

.withdraw-empty {
  display: flex;
  align-items: center;
  gap: 0.35rem;
  margin: 0;
  color: #90a4ae;
  font-size: 0.76rem;
  line-height: 1.45;
}

.withdraw-empty .q-icon {
  color: #78909c;
}

.withdraw-actions {
  display: flex;
  align-items: center;
  gap: 0.25rem;
  padding-top: 0.35rem;
  border-top: 1px solid var(--border-subtle);
}

.withdraw-actions__btn {
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-pill);
  color: #4fc3f7;
  font-size: 0.74rem;
  font-weight: 600;
}

.withdraw-actions__btn:hover {
  border-color: rgba(79, 195, 247, 0.4);
  background: rgba(79, 195, 247, 0.08);
}

.withdraw-actions__refresh {
  margin-left: auto;
  color: #90a4ae;
}

.withdraw-editor {
  width: min(340px, 92vw);
  overflow: hidden;
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-card);
  background: #10181d;
  box-shadow: var(--shadow-pop);
}

.withdraw-editor__head {
  padding: var(--space-3) var(--space-3) 0;
}

.withdraw-editor__eyebrow {
  color: #78909c;
  font-size: 0.64rem;
  letter-spacing: 0.07em;
  text-transform: uppercase;
}

.withdraw-editor__title {
  margin: 0.1rem 0 0;
  color: #e4eaed;
  font-size: 0.92rem;
  font-weight: 600;
}

.withdraw-editor__body {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  padding: var(--space-3);
}

.withdraw-editor__slider-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  color: #90a4ae;
  font-size: 0.74rem;
}

.withdraw-editor__slider-value {
  color: #e4eaed;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
}

.withdraw-editor__check {
  font-size: 0.8rem;
}

.withdraw-editor__actions {
  display: flex;
  justify-content: flex-end;
  gap: 0.3rem;
  padding: 0 var(--space-3) var(--space-3);
}
</style>
