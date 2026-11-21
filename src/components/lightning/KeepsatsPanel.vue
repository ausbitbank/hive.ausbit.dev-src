<template>
  <section class="keepsats" :class="{ 'keepsats--connected': connected }" aria-labelledby="keepsats-title">
    <header class="keepsats__head">
      <div class="keepsats__title-wrap">
        <q-icon name="savings" size="22px" aria-hidden="true" />
        <div>
          <div class="keepsats__eyebrow">Optional · held by v4v.app</div>
          <h3 id="keepsats-title" class="keepsats__title">
            Lightning balance
            <q-badge color="orange-9" text-color="black" class="keepsats__badge">Custodial</q-badge>
          </h3>
        </div>
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
    </header>

    <div class="keepsats__body">
      <p class="keepsats__note">
        A sats balance kept by v4v.app, not by hive.ausbit.dev. Reading it uses
        your <strong>posting key</strong> to sign a short-lived v4v.app session.
        No active key, no Hive transaction, no transfers.
      </p>

      <div v-if="error" class="keepsats__error" role="alert">
        <q-icon name="error_outline" size="16px" aria-hidden="true" />
        <span>{{ error }}</span>
      </div>

      <template v-if="connected">
        <div class="keepsats__balance" aria-live="polite">
          <strong>{{ formatSats(data?.netSats || 0) }}</strong>
          <span v-if="fiatLabel" class="keepsats__fiat">{{ fiatLabel }}</span>
        </div>

        <div v-if="data?.inProgressSats" class="keepsats__pending">
          <q-icon name="pending" size="15px" aria-hidden="true" />
          {{ formatSats(data.inProgressSats) }} in flight
        </div>

        <div class="keepsats__meta">
          <span>Read-only session · expires {{ expiresLabel }}</span>
          <span v-if="data?.lastAt">Last activity {{ lastActivityLabel }}</span>
        </div>

        <div class="keepsats__actions">
          <q-btn flat dense no-caps color="primary" icon="refresh" label="Refresh" :loading="loading" @click="load" />
          <q-btn flat dense no-caps color="grey" label="Disconnect" @click="disconnect" />
        </div>

        <details v-if="data?.hasHistory" class="keepsats__history">
          <summary>Recent keepsats activity</summary>
          <ul>
            <li v-for="(row, index) in data.history" :key="row.ref || index">
              <span class="keepsats__history-type">{{ row.type || 'Keepsats entry' }}</span>
              <span class="keepsats__history-amount">{{ row.sats === null ? '—' : formatSats(row.sats) }}</span>
              <span class="keepsats__history-meta">{{ row.at ? formatDate(row.at) : '' }} {{ row.memo }}</span>
            </li>
          </ul>
        </details>

        <p class="keepsats__custody">
          Keepsats are an IOU from v4v.app. Withdraw or convert them on
          <a href="https://v4v.app" target="_blank" rel="noopener noreferrer">v4v.app</a>.
          This panel cannot move funds.
        </p>
      </template>

      <template v-else>
        <div class="keepsats__actions">
          <q-btn
            unelevated
            no-caps
            color="orange-9"
            text-color="black"
            icon="lock_open"
            label="Read balance"
            :loading="busy"
            :disable="!canConnect"
            @click="connect"
          />
        </div>
        <p class="keepsats__hint">
          <template v-if="!canConnect">
            Log in with Keychain or SmartLock to read a keepsats balance.
          </template>
          <template v-else>
            Signing a read-only challenge is not a Hive transaction and does not
            move funds. You can disconnect at any time.
          </template>
        </p>
      </template>

      <keepsats-actions
        :account="account"
        :balance-sats="data?.netSats || 0"
        @queued="$emit('queued')"
      />
    </div>
  </section>
</template>

<script>
import { formatSats } from 'src/services/lightning'
import {
  authenticate,
  clearAuthSession,
  getAuthSession,
  isAuthExpired,
  loadKeepsats
} from 'src/services/v4vappAuth'
import smartlock from 'components/smartlock/index.js'
import KeepsatsActions from 'components/lightning/KeepsatsActions.vue'

const DEFAULT_SMARTLOCK_TIMEOUT_MS = 15 * 60 * 1000

export default {
  name: 'KeepsatsPanel',
  components: { KeepsatsActions },
  props: {
    account: { type: String, required: true },
    loginType: { type: String, default: '' },
    smartlockTimeoutMs: { type: Number, default: DEFAULT_SMARTLOCK_TIMEOUT_MS }
  },
  emits: ['queued'],
  data () {
    return {
      auth: null,
      data: null,
      busy: false,
      loading: false,
      error: '',
      clock: Date.now()
    }
  },
  computed: {
    connected () {
      return Boolean(this.auth && !this.expired)
    },
    expired () {
      return Boolean(this.auth && this.auth.expiresAt <= this.clock)
    },
    canConnect () {
      return this.loginType === 'keychain' || this.loginType === 'smartlock'
    },
    expiresLabel () {
      if (!this.auth?.expiresAt) return '—'
      return new Date(this.auth.expiresAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    },
    lastActivityLabel () {
      return this.data?.lastAt ? this.formatDate(this.data.lastAt) : ''
    },
    fiatLabel () {
      if (!this.data) return ''
      const parts = []
      if (this.data.netHbd) parts.push(Number(this.data.netHbd).toFixed(3) + ' HBD')
      if (this.data.netUsd) parts.push('$' + Number(this.data.netUsd).toFixed(2))
      if (this.data.netHive) parts.push(Number(this.data.netHive).toFixed(3) + ' HIVE')
      return parts.length ? '≈ ' + parts.join(' · ') : ''
    }
  },
  watch: {
    account () {
      this.reset()
      this.refreshSession()
      if (this.connected) this.load()
    }
  },
  mounted () {
    this.refreshSession()
    if (this.connected) this.load()
    this.clockTimer = setInterval(() => {
      this.clock = Date.now()
    }, 30000)
  },
  beforeUnmount () {
    if (this.clockTimer) clearInterval(this.clockTimer)
    this.clockTimer = null
  },
  methods: {
    formatSats,
    formatDate (value) {
      const date = new Date(value)
      return Number.isNaN(date.getTime()) ? String(value) : date.toLocaleString([], {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      })
    },
    refreshSession () {
      this.auth = getAuthSession(this.account)
    },
    reset () {
      this.auth = null
      this.data = null
      this.error = ''
      this.busy = false
      this.loading = false
    },
    disconnect () {
      clearAuthSession(this.account)
      this.reset()
    },
    async promptPassword () {
      return new Promise((resolve, reject) => {
        this.$q.dialog({
          dark: true,
          title: 'Unlock SmartLock',
          message: 'Enter the SmartLock password for @' + this.account + '. It is only used to unlock the posting key in this tab.',
          prompt: { model: '', type: 'password' },
          cancel: true,
          persistent: true
        }).onOk(resolve).onCancel(() => reject(new Error('Cancelled by user.')))
      })
    },
    async ensureSmartlock () {
      if (this.loginType !== 'smartlock') return
      if (smartlock.isAccountUnlocked(this.account, this.smartlockTimeoutMs)) return
      const password = await this.promptPassword()
      await smartlock.unlockAccount(this.account, password, false)
    },
    async connect () {
      if (this.busy || !this.canConnect) return
      this.busy = true
      this.error = ''
      try {
        await this.ensureSmartlock()
        this.auth = await authenticate(this.account, { loginType: this.loginType })
        await this.load()
      } catch (error) {
        this.error = error?.message || 'Could not connect to v4v.app.'
        this.auth = getAuthSession(this.account)
      } finally {
        this.busy = false
      }
    },
    async load () {
      if (this.loading || !this.auth) return
      if (this.expired) {
        clearAuthSession(this.account)
        this.auth = null
        this.data = null
        this.error = 'The v4v.app session expired. Reconnect to read the balance.'
        return
      }
      this.loading = true
      this.error = ''
      try {
        this.data = await loadKeepsats(this.account)
      } catch (error) {
        if (isAuthExpired(error)) {
          this.auth = getAuthSession(this.account)
          this.error = error.message
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

<style scoped>
.keepsats {
  margin-top: var(--space-3);
  padding: 0.85rem 0.95rem;
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-card);
  background: rgba(255, 255, 255, 0.018);
}

.keepsats__head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: var(--space-2);
}

.keepsats__title-wrap {
  display: flex;
  align-items: center;
  gap: 0.55rem;
  min-width: 0;
  color: #ffcc80;
}

.keepsats__eyebrow {
  color: #b0a06a;
  font-size: 0.6rem;
  letter-spacing: 0.07em;
  text-transform: uppercase;
}

.keepsats__title {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  flex-wrap: wrap;
  margin: 0.1rem 0 0;
  color: #e4eaed;
  font-size: 0.92rem;
  font-weight: 600;
}

.keepsats__badge {
  font-size: 0.56rem;
  letter-spacing: 0.03em;
}

.keepsats__body {
  margin-top: 0.6rem;
}

.keepsats__note,
.keepsats__custody,
.keepsats__hint {
  margin: 0;
  color: #90a4ae;
  font-size: 0.7rem;
  line-height: 1.45;
}

.keepsats__hint {
  margin-top: 0.4rem;
}

.keepsats__custody {
  margin-top: 0.55rem;
  padding-top: 0.5rem;
  border-top: 1px solid var(--border-subtle);
  color: #78909c;
}

.keepsats__custody a,
.keepsats__note a {
  color: #ffe082;
}

.keepsats__error {
  display: flex;
  align-items: flex-start;
  gap: 0.35rem;
  margin-top: 0.55rem;
  padding: 0.45rem 0.55rem;
  border: 1px solid rgba(255, 152, 0, 0.35);
  border-radius: 0.4rem;
  background: rgba(255, 152, 0, 0.06);
  color: #ffcc80;
  font-size: 0.7rem;
  line-height: 1.4;
}

.keepsats__balance {
  display: flex;
  align-items: baseline;
  gap: 0.45rem;
  flex-wrap: wrap;
  margin-top: 0.55rem;
}

.keepsats__balance strong {
  color: #ffe082;
  font-size: 1.25rem;
  font-weight: 700;
}

.keepsats__fiat {
  color: #90a4ae;
  font-size: 0.72rem;
}

.keepsats__pending {
  display: flex;
  align-items: center;
  gap: 0.3rem;
  margin-top: 0.35rem;
  color: #ffcc80;
  font-size: 0.7rem;
}

.keepsats__meta {
  display: flex;
  flex-direction: column;
  gap: 0.15rem;
  margin-top: 0.45rem;
  color: #78909c;
  font-size: 0.66rem;
}

.keepsats__actions {
  display: flex;
  align-items: center;
  gap: 0.35rem;
  flex-wrap: wrap;
  margin-top: 0.55rem;
}

.keepsats__history {
  margin-top: 0.6rem;
  color: #b0bec5;
  font-size: 0.7rem;
}

.keepsats__history summary {
  cursor: pointer;
  color: #90a4ae;
}

.keepsats__history ul {
  display: flex;
  flex-direction: column;
  gap: 0.3rem;
  margin: 0.45rem 0 0;
  padding: 0;
  list-style: none;
}

.keepsats__history li {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 0.15rem 0.5rem;
  padding: 0.35rem 0;
  border-top: 1px solid var(--border-subtle);
}

.keepsats__history-type {
  font-weight: 600;
}

.keepsats__history-amount {
  color: #ffe082;
  text-align: right;
}

.keepsats__history-meta {
  grid-column: 1 / -1;
  color: #78909c;
  overflow-wrap: anywhere;
}
</style>
