<template>
  <div class="dw-sats">
    <q-card-section class="home-panel__head dw-sats__head">
      <div>
        <div class="home-eyebrow">Lightning · custodial</div>
        <h2 class="home-panel__title">
          <template v-if="accountName">@{{ accountName }} sats</template>
          <template v-else>Keepsats</template>
        </h2>
      </div>
      <q-btn
        v-if="connected"
        flat
        dense
        round
        icon="refresh"
        aria-label="Refresh keepsats balance"
        title="Refresh keepsats balance"
        :loading="loading"
        @click="load"
      />
    </q-card-section>

    <dashboard-widget-state
      v-if="!targetAccount"
      state="guest"
      guest-title="Log in to read your keepsats"
      guest-text="Keepsats is an optional sats balance held by v4v.app. Reading it needs a short-lived read-only session."
    />

    <dashboard-widget-state
      v-else-if="state === 'loading'"
      state="loading"
    />

    <dashboard-widget-state
      v-else-if="state === 'error'"
      state="error"
      :error="error"
      @retry="load"
    />

    <template v-else>
      <p v-if="state === 'stale' && error" class="dw-sats__notice" role="status">
        <q-icon name="cloud_off" size="16px" aria-hidden="true" />
        <span>{{ error }}</span>
      </p>

      <template v-if="!connected">
        <q-card-section class="dw-sats__connect">
          <q-icon name="lock_open" size="22px" aria-hidden="true" />
          <div>
            <strong>No read-only session</strong>
            <span>{{ expired ? 'The v4v.app session expired.' : 'Connect from the wallet Lightning panel to read the balance.' }}</span>
          </div>
        </q-card-section>
        <q-card-section class="home-panel__footer dw-sats__footer">
          <router-link :to="walletPath">Connect in the wallet</router-link>
          <span>No active key · no transfers</span>
        </q-card-section>
      </template>

      <template v-else>
        <q-card-section class="dw-sats__balance">
          <strong>{{ formatSats(data?.netSats || 0) }}</strong>
          <span v-if="fiatLabel" class="dw-sats__fiat">{{ fiatLabel }}</span>
          <span v-if="data?.inProgressSats" class="dw-sats__pending">
            <q-icon name="pending" size="14px" aria-hidden="true" />
            {{ formatSats(data.inProgressSats) }} in flight
          </span>
        </q-card-section>

        <q-card-section class="dw-sats__meta">
          <span>Session expires {{ expiresLabel }}</span>
          <span v-if="lastActivityLabel">Last activity {{ lastActivityLabel }}</span>
        </q-card-section>

        <p class="dw-sats__note">
          Held by v4v.app as an IOU, not by hive.ausbit.dev. This card is read-only and cannot move funds.
        </p>

        <q-card-section class="home-panel__footer dw-sats__footer">
          <router-link :to="walletPath">Manage in the wallet</router-link>
          <span>Read-only session</span>
        </q-card-section>
      </template>
    </template>
  </div>
</template>

<style scoped>
.dw-sats {
  display: flex;
  flex-direction: column;
  min-width: 0;
}

.dw-sats__head {
  align-items: flex-start;
}

.dw-sats__notice {
  display: flex;
  align-items: flex-start;
  gap: 0.35rem;
  margin: 0;
  padding: 0.45rem 1rem 0;
  color: var(--c-warning-soft);
  font-size: 0.7rem;
  line-height: 1.4;
}

.dw-sats__connect {
  display: flex;
  align-items: flex-start;
  gap: 0.55rem;
  color: var(--c-text-subtle);
  font-size: 0.8rem;
  line-height: 1.4;
}

.dw-sats__connect .q-icon {
  color: var(--c-text-faint);
  flex: none;
}

.dw-sats__connect strong {
  display: block;
  color: var(--c-text);
}

.dw-sats__connect span {
  display: block;
}

.dw-sats__balance {
  display: flex;
  align-items: baseline;
  flex-wrap: wrap;
  gap: 0.5rem;
  padding-top: 0.2rem;
  padding-bottom: 0.2rem;
}

.dw-sats__balance strong {
  color: var(--c-text);
  font-size: 1.6rem;
  font-weight: 650;
  font-variant-numeric: tabular-nums;
  line-height: 1.15;
}

.dw-sats__fiat {
  color: var(--c-text-subtle);
  font-size: 0.78rem;
}

.dw-sats__pending {
  display: inline-flex;
  align-items: center;
  gap: 0.2rem;
  color: var(--c-warning-soft);
  font-size: 0.7rem;
}

.dw-sats__meta {
  display: flex;
  flex-wrap: wrap;
  gap: 0.4rem 0.9rem;
  padding-top: 0;
  color: var(--c-text-faint);
  font-size: 0.68rem;
  font-variant-numeric: tabular-nums;
}

.dw-sats__note {
  margin: 0;
  padding: 0 1rem 0.4rem;
  color: var(--c-text-faint);
  font-size: 0.67rem;
  line-height: 1.4;
}

.dw-sats__footer {
  align-items: center;
  flex-wrap: wrap;
  gap: 0.6rem;
}

@media (max-width: 599px) {
  .dw-sats__balance,
  .dw-sats__meta {
    padding-left: 0.7rem;
    padding-right: 0.7rem;
  }

  .dw-sats__note {
    padding-left: 0.7rem;
    padding-right: 0.7rem;
  }
}
</style>

<script>
import DashboardWidgetState from 'components/dashboard/DashboardWidgetState.vue'
import { formatSats } from 'src/services/lightning'
import { getAuthSession, isAuthExpired, loadKeepsats } from 'src/services/v4vappAuth'

export default {
  name: 'WidgetKeepsats',
  components: { DashboardWidgetState },
  data () {
    return {
      auth: null,
      data: null,
      loading: false,
      loaded: false,
      error: ''
    }
  },
  computed: {
    targetAccount () {
      return String(this.$hiveStore?.user?.username || '').replace(/^@/, '').trim()
    },
    accountName () {
      return this.targetAccount
    },
    walletPath () {
      return '/@' + this.accountName + '/wallet'
    },
    connected () {
      return Boolean(this.auth && !this.expired)
    },
    expired () {
      return Boolean(this.auth && this.auth.expiresAt <= Date.now())
    },
    expiresLabel () {
      if (!this.auth?.expiresAt) return '—'
      return new Date(this.auth.expiresAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    },
    lastActivityLabel () {
      if (!this.data?.lastAt) return ''
      const date = new Date(this.data.lastAt)
      return Number.isNaN(date.getTime())
        ? String(this.data.lastAt)
        : date.toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
    },
    fiatLabel () {
      if (!this.data) return ''
      const parts = []
      if (this.data.netHbd) parts.push(Number(this.data.netHbd).toFixed(3) + ' HBD')
      if (this.data.netUsd) parts.push('$' + Number(this.data.netUsd).toFixed(2))
      if (this.data.netHive) parts.push(Number(this.data.netHive).toFixed(3) + ' HIVE')
      return parts.length ? '≈ ' + parts.join(' · ') : ''
    },
    state () {
      if (!this.targetAccount) return 'guest'
      if (this.loading && !this.loaded) return 'loading'
      if (this.error) return this.loaded ? 'stale' : 'error'
      if (this.loaded) return 'ready'
      return 'loading'
    }
  },
  watch: {
    targetAccount () {
      this.reset()
      this.refreshSession()
      if (this.connected) this.load()
    }
  },
  mounted () {
    this.refreshSession()
    if (!this.targetAccount) {
      this.loaded = true
      return
    }
    if (this.connected) this.load()
    else this.loaded = true
  },
  methods: {
    formatSats,
    refreshSession () {
      this.auth = getAuthSession(this.targetAccount)
    },
    reset () {
      this.auth = null
      this.data = null
      this.error = ''
      this.loading = false
      this.loaded = false
    },
    async load () {
      const account = this.targetAccount
      if (!account) return
      this.refreshSession()
      if (!this.connected) {
        this.loaded = true
        return
      }
      this.loading = true
      this.error = ''
      try {
        this.data = await loadKeepsats(account)
        this.loaded = true
      } catch (error) {
        if (isAuthExpired(error)) {
          this.auth = null
          this.error = 'The v4v.app session expired. Reconnect from the wallet Lightning panel.'
        } else {
          this.error = error?.message || 'Could not read the keepsats balance.'
        }
      } finally {
        this.loading = false
      }
    }
  }
}
</script>
