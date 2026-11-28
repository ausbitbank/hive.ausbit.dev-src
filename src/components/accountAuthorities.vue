<template>
<div class="authorities">
  <div class="authorities__head">
    <div>
      <div class="authorities__eyebrow">Permissions</div>
      <h2 class="authorities__title">Authorities</h2>
    </div>
    <q-btn
      v-if="loggedInUser === account.name"
      flat
      dense
      round
      size="sm"
      :icon="editorEnabled ? 'close' : 'edit'"
      :color="editorEnabled ? 'grey' : 'primary'"
      :title="editorEnabled ? 'Stop editing authorities' : 'Edit account authorities'"
      :aria-label="editorEnabled ? 'Stop editing authorities' : 'Edit account authorities'"
      class="authorities__edit"
      @click="editorEnabled = !editorEnabled"
    />
  </div>

  <section v-for="permission in permissionList" :key="permission.name" class="authorities__section">
    <div class="authorities__section-head">
      <q-icon :name="permission.icon" size="15px" class="authorities__section-icon" aria-hidden="true" />
      <h3 class="authorities__section-title">{{ permission.label }}</h3>
      <span class="authorities__threshold" :title="'Weight threshold: ' + permission.weightThreshold">
        Threshold {{ permission.weightThreshold }}
      </span>
      <q-icon name="info" size="14px" class="authorities__info" :title="permission.hint" :aria-label="permission.hint" />
    </div>

    <ul class="authorities__keys">
      <li v-for="auth in permission.keys" :key="'key-' + auth[0]" class="authorities__row">
        <q-icon name="vpn_key" size="14px" class="authorities__row-icon" aria-hidden="true" />
        <code class="authorities__key" tabindex="0" :title="auth[0]">{{ shortKey(auth[0]) }}</code>
        <span class="authorities__weight" title="Weight">{{ auth[1] }}</span>
      </li>

      <li v-for="auth in permission.accounts" :key="'account-' + auth[0]" class="authorities__row authorities__row--account">
        <q-icon name="person" size="14px" class="authorities__row-icon" aria-hidden="true" />
        <router-link :to="accountLink(auth[0])" class="authorities__account">@{{ auth[0] }}</router-link>
        <span class="authorities__weight" title="Weight">{{ auth[1] }}</span>
        <q-btn
          v-if="loggedInUser === account.name && editorEnabled"
          flat
          dense
          round
          size="sm"
          icon="delete_outline"
          color="red-4"
          class="authorities__remove"
          :aria-label="'Remove ' + permission.name + ' authority for @' + auth[0]"
          title="Remove authority"
          @click="removeAuth(permission.name, 'account', account.name, auth[0])"
        />
      </li>

      <li v-if="!permission.keys.length && !permission.accounts.length" class="authorities__none">
        No keys or accounts on this permission.
      </li>
    </ul>

    <div v-if="loggedInUser === account.name && editorEnabled" class="authorities__add">
      <q-btn flat dense no-caps icon="person_add" color="primary" class="authorities__add-btn" :title="'Add ' + permission.label + ' authority'">
        <q-popup-proxy>
          <q-card flat class="authorities__editor">
            <div class="authorities__editor-head">
              <div class="authorities__eyebrow">Grant access</div>
              <h4 class="authorities__editor-title">Add {{ permission.label }} authority</h4>
            </div>
            <div class="authorities__editor-body">
              <q-input dense outlined v-model="newAuth[permission.name].account" label="Account" />
              <q-input dense outlined v-model="newAuth[permission.name].weight" label="Weight" type="number" min="1" />
              <p class="authorities__editor-hint">
                <q-icon name="warning_amber" size="14px" aria-hidden="true" />
                <span>{{ permission.warning }}</span>
              </p>
            </div>
            <div class="authorities__editor-actions">
              <q-btn flat dense no-caps label="Cancel" color="grey" v-close-popup />
              <q-btn
                unelevated
                dense
                no-caps
                :label="'Add ' + permission.label"
                color="primary"
                @click="addAuth(permission.name, 'account', account.name, newAuth[permission.name].account, newAuth[permission.name].weight)"
                v-close-popup
              />
            </div>
          </q-card>
        </q-popup-proxy>
      </q-btn>
    </div>
  </section>

  <section v-if="witness" class="authorities__section">
    <div class="authorities__section-head">
      <q-icon name="gavel" size="15px" class="authorities__section-icon" aria-hidden="true" />
      <h3 class="authorities__section-title">Signing</h3>
      <span class="authorities__threshold">Witness</span>
      <q-icon name="info" size="14px" class="authorities__info" title="Signing keys are used by witnesses to sign blocks" />
    </div>
    <ul class="authorities__keys">
      <li class="authorities__row">
        <q-icon name="vpn_key" size="14px" class="authorities__row-icon" aria-hidden="true" />
        <code class="authorities__key" tabindex="0" :title="witness.signing_key">{{ shortKey(witness.signing_key) }}</code>
        <span class="authorities__weight" title="Weight">1</span>
      </li>
    </ul>
  </section>

  <section class="authorities__section">
    <div class="authorities__section-head">
      <q-icon name="mail_lock" size="15px" class="authorities__section-icon" aria-hidden="true" />
      <h3 class="authorities__section-title">Memo</h3>
      <q-icon name="info" size="14px" class="authorities__info" title="Use to encode and decode private memos" />
    </div>
    <ul class="authorities__keys">
      <li class="authorities__row">
        <q-icon name="vpn_key" size="14px" class="authorities__row-icon" aria-hidden="true" />
        <code class="authorities__key" tabindex="0" :title="account.memo_key">{{ shortKey(account.memo_key) }}</code>
        <span class="authorities__weight" title="Weight">1</span>
      </li>
    </ul>
  </section>
</div>
</template>
<script>
import { keychain } from '@hiveio/keychain'
import { accountAuthorityUpdate } from 'src/services/authority'
import { isValidHiveAccountName } from 'src/services/blogHost'

const PERMISSION_META = {
  owner: {
    label: 'Owner',
    icon: 'shield',
    hint: 'The admin key. It can perform any transaction, including changing every other permission.',
    warning: 'Owner authority can take full control of this account. Grant it only to keys or accounts you fully trust.'
  },
  active: {
    label: 'Active',
    icon: 'account_balance_wallet',
    hint: 'Needed for monetary transactions. It can also change the posting permission.',
    warning: 'Active authority can move funds and change permissions. Grant it only to keys or accounts you trust.'
  },
  posting: {
    label: 'Posting',
    icon: 'edit_note',
    hint: 'Used to post, comment, vote and perform some broadcasts.',
    warning: 'Posting authority can publish as this account. Grant it only to apps or accounts you trust.'
  }
}

export default {
  name: 'accountAuthorities',
  props: ['account', 'witness'],
  data () {
    return {
      editorEnabled: false,
      newAuth: {
        owner: { account: '', weight: 1 },
        active: { account: '', weight: 1 },
        posting: { account: '', weight: 1 }
      }
    }
  },
  computed: {
    loggedInUser: {
      get () { return this.$hiveStore.user.username }
    },
    permissionList () {
      return ['owner', 'active', 'posting'].map(name => {
        const permission = this.account?.[name] || {}
        return {
          name,
          ...PERMISSION_META[name],
          keys: permission.key_auths || [],
          accounts: permission.account_auths || [],
          weightThreshold: permission.weight_threshold ?? 0
        }
      })
    }
  },
  methods: {
    accountLink (username) { return '/@' + username },
    shortKey (key) {
      if (typeof key !== 'string' || key.length < 22) return key || '—'
      return key.slice(0, 11) + '…' + key.slice(-6)
    },
    async removeAuth (keyType, authType, accountToModify, toRemove) {
      if (authType !== 'account') return
      this.queueAuthorityChange(keyType, { add: false, target: toRemove })
    },
    async addAuth (keyType, authType, accountToModify, toAdd, weight) {
      if (authType !== 'account') return
      this.queueAuthorityChange(keyType, { add: true, target: toAdd, weight })
    },
    queueAuthorityChange (permission, options) {
      const username = this.$hiveStore.user.username
      if (!username || username !== this.account?.name) {
        this.$q.notify({ type: 'negative', message: 'Sign in as @' + (this.account?.name || 'this account') + ' to edit its authorities.' })
        return
      }
      if (permission === 'owner') {
        return this.changeOwnerAuthority(options)
      }
      try {
        const operation = accountAuthorityUpdate(this.account, permission, options)
        this.$hiveStore.addToQueue([username, 'active', operation])
        this.$q.notify({
          type: 'positive',
          message: 'Authority change queued.',
          caption: 'Review it in the signing queue. It needs active authority.',
          timeout: 6000
        })
      } catch (error) {
        this.$q.notify({
          type: 'negative',
          message: error?.message || 'That authority change is not valid.',
          timeout: 6000
        })
      }
    },
    async changeOwnerAuthority ({ add = true, target, weight = 1 } = {}) {
      const loginType = this.$hiveStore.user.loginType || ''
      if (loginType !== 'keychain') {
        this.$q.notify({
          type: 'negative',
          message: 'Owner authority changes require Hive Keychain.',
          caption: 'The signing queue has no owner-key role. Use a Keychain session or another owner-key tool.',
          timeout: 7000
        })
        return
      }
      const name = String(target || '').trim().replace(/^@/, '').toLowerCase()
      if (!isValidHiveAccountName(name)) {
        this.$q.notify({ type: 'negative', message: 'Enter a valid Hive account name.' })
        return
      }
      if (name === this.account?.name) {
        this.$q.notify({ type: 'negative', message: 'An account cannot delegate owner authority to itself.' })
        return
      }
      const ownerWeight = Number(weight)
      if (add && (!Number.isInteger(ownerWeight) || ownerWeight < 1 || ownerWeight > 65535)) {
        this.$q.notify({ type: 'negative', message: 'Authority weight must be a whole number between 1 and 65535.' })
        return
      }
      try {
        const result = add
          ? await keychain(window, 'requestAddAccountAuthority', this.account.name, name, 'Owner', ownerWeight)
          : await keychain(window, 'requestRemoveAccountAuthority', this.account.name, name, 'Owner')
        if (result?.success) {
          this.$emit('authEdited')
          return
        }
        let message = result?.msg || result?.message || 'Keychain did not approve the owner change.'
        if (result?.notInstalled) message = 'Hive Keychain is not installed.'
        else if (result?.notActive) message = 'Allow Hive Keychain to access this site.'
        else if (result?.cancel) message = 'Cancelled in Keychain.'
        this.$q.notify({
          type: 'negative',
          message: 'Could not change the owner authority.',
          caption: message,
          timeout: 7000
        })
      } catch (error) {
        this.$q.notify({
          type: 'negative',
          message: 'Could not change the owner authority.',
          caption: error?.message || 'Keychain did not respond.',
          timeout: 7000
        })
      }
    }
  }
}
</script>

<style scoped>
.authorities {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
}

.authorities__head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: var(--space-2);
}

.authorities__eyebrow {
  color: var(--c-text-faint);
  font-size: 0.64rem;
  letter-spacing: 0.07em;
  text-transform: uppercase;
}

.authorities__title {
  margin: 0.1rem 0 0;
  color: var(--c-text);
  font-size: 0.9rem;
  font-weight: 600;
  line-height: 1.25;
}

.authorities__edit {
  color: var(--c-text-subtle);
}

.authorities__section {
  padding: 0.5rem 0.6rem 0.55rem;
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-sm);
  background: color-mix(in srgb, var(--c-text) 2%, transparent);
}

.authorities__section-head {
  display: flex;
  align-items: center;
  gap: 0.3rem;
  min-width: 0;
}

.authorities__section-icon {
  flex: none;
  color: var(--c-text-faint);
}

.authorities__section-title {
  margin: 0;
  color: var(--c-text-soft);
  font-size: 0.76rem;
  font-weight: 600;
  line-height: 1.3;
}

.authorities__threshold {
  flex: none;
  margin-left: auto;
  padding: 0.02rem 0.35rem;
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-pill);
  color: var(--c-text-subtle);
  font-size: 0.62rem;
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
}

.authorities__info {
  flex: none;
  color: var(--c-text-faint);
  cursor: help;
}

.authorities__keys {
  margin: 0.35rem 0 0;
  padding: 0;
  list-style: none;
}

.authorities__row {
  display: flex;
  align-items: center;
  gap: 0.35rem;
  min-width: 0;
  padding: 0.22rem 0;
  border-top: 1px solid color-mix(in srgb, var(--c-text) 5%, transparent);
}

.authorities__row:first-child {
  border-top: 0;
}

.authorities__row-icon {
  flex: none;
  color: var(--c-text-faint);
}

.authorities__key {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  padding: 0.05rem 0.3rem;
  border: 1px solid color-mix(in srgb, var(--c-text) 6%, transparent);
  border-radius: 4px;
  background: color-mix(in srgb, var(--c-shadow) 22%, transparent);
  color: var(--c-text-muted);
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: 0.68rem;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.authorities__account {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  color: var(--c-link);
  font-size: 0.74rem;
  font-weight: 600;
  text-decoration: none;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.authorities__account:hover {
  text-decoration: underline;
}

.authorities__weight {
  flex: none;
  min-width: 1.4rem;
  color: var(--c-text-subtle);
  font-size: 0.7rem;
  font-variant-numeric: tabular-nums;
  text-align: right;
}

.authorities__remove {
  flex: none;
}

.authorities__none {
  padding: 0.25rem 0;
  color: var(--c-text-faint);
  font-size: 0.72rem;
  font-style: italic;
}

.authorities__add {
  margin-top: 0.35rem;
}

.authorities__add-btn {
  border: 1px dashed color-mix(in srgb, var(--c-link) 35%, transparent);
  border-radius: var(--radius-pill);
  padding: 0 0.6rem;
  color: var(--c-link);
  font-size: 0.7rem;
  font-weight: 600;
}

.authorities__add-btn:hover {
  background: color-mix(in srgb, var(--c-link) 8%, transparent);
}

.authorities__editor {
  width: min(320px, 92vw);
  overflow: hidden;
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-card);
  background: var(--c-surface-2);
  box-shadow: var(--shadow-pop);
}

.authorities__editor-head {
  padding: var(--space-3) var(--space-3) 0;
}

.authorities__editor-title {
  margin: 0.1rem 0 0;
  color: var(--c-text);
  font-size: 0.88rem;
  font-weight: 600;
}

.authorities__editor-body {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  padding: var(--space-3);
}

.authorities__editor-hint {
  display: flex;
  align-items: flex-start;
  gap: 0.35rem;
  margin: 0;
  padding: 0.4rem 0.5rem;
  border: 1px solid color-mix(in srgb, var(--c-warning) 30%, transparent);
  border-radius: var(--radius-sm);
  background: color-mix(in srgb, var(--c-warning) 6%, transparent);
  color: var(--c-warning-soft);
  font-size: 0.68rem;
  line-height: 1.4;
}

.authorities__editor-hint .q-icon {
  flex: none;
  margin-top: 1px;
}

.authorities__editor-actions {
  display: flex;
  justify-content: flex-end;
  gap: 0.3rem;
  padding: 0 var(--space-3) var(--space-3);
}
</style>
