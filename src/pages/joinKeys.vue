<template>
  <q-page class="join-keys-page">
    <div class="join-keys-shell">
      <page-header
        eyebrow="Join Hive"
        title="Create your keys"
        intro="Choose a username, generate your password and keys in this browser, then share a claim link containing only your public keys with someone who can sponsor the account."
      >
        <template #actions>
          <q-btn no-caps flat color="primary" icon="arrow_back" label="Back to join" to="/join" />
        </template>
      </page-header>

      <div class="join-keys-layout">
        <q-card flat bordered class="join-keys-card">
          <q-card-section>
            <div class="join-step">
              <span class="join-step__num">1</span>
              <div>
                <h2 class="join-step__title">Choose your Hive username</h2>
                <p class="join-step__copy">Your username is permanent. Use 3–16 lowercase letters, digits, dashes or periods.</p>
              </div>
            </div>

            <div class="join-username">
              <q-input
                v-model="username"
                label="Username"
                outlined
                dense
                autocomplete="off"
                spellcheck="false"
                :error="Boolean(usernameError)"
                :error-message="usernameError"
                :loading="checking"
                @blur="checkUsernameAvailability()"
                @keyup.enter="checkUsernameAvailability()"
              >
                <template #prepend><span class="join-at">@</span></template>
              </q-input>
              <q-btn
                no-caps
                outline
                color="primary"
                label="Check availability"
                :loading="checking"
                :disable="Boolean(validateUsername(username))"
                @click="checkUsernameAvailability()"
              />
            </div>

            <div v-if="available === true" class="join-status join-status--ok" role="status">
              <q-icon name="check_circle" size="16px" aria-hidden="true" />
              <strong>@{{ username }}</strong> is available.
            </div>
            <div v-else-if="available === false" class="join-status join-status--bad" role="status">
              <q-icon name="error" size="16px" aria-hidden="true" />
              <strong>@{{ username }}</strong> is already registered.
              <router-link :to="'/@' + username">View the account</router-link>
            </div>
          </q-card-section>

          <q-separator />

          <q-card-section>
            <div class="join-step">
              <span class="join-step__num">2</span>
              <div>
                <h2 class="join-step__title">Generate your keys</h2>
                <p class="join-step__copy">Keys are generated locally. Banksia never sees them and cannot recover them for you.</p>
              </div>
            </div>

            <q-btn
              v-if="!keys"
              no-caps
              unelevated
              color="primary"
              icon="enhanced_encryption"
              label="Generate keys"
              :disable="available !== true"
              @click="generateKeysForUser()"
            />
            <p v-else class="join-step__copy">Keys generated for <strong>@{{ keys.username }}</strong>.</p>
          </q-card-section>

          <template v-if="keys">
            <q-separator />
            <q-card-section>
              <div class="join-step">
                <span class="join-step__num">3</span>
                <div>
                  <h2 class="join-step__title">Save your password and keys</h2>
                  <p class="join-step__copy">This is the only copy. Hive has no password reset.</p>
                </div>
              </div>

              <q-banner class="join-warning" rounded>
                <template #avatar><q-icon name="warning" color="warning" aria-hidden="true" /></template>
                <strong>Download the backup before you share anything.</strong>
                <div class="join-warning__copy">
                  Anyone with the claim link can see your public keys. Nobody needs your password or
                  private keys except you. A sponsor only needs the link.
                </div>
              </q-banner>

              <div class="join-key-list" aria-label="New account credentials">
                <div v-for="row in keyRows" :key="row.label" class="join-key-row">
                  <span class="join-key-row__label">{{ row.label }}</span>
                  <code class="join-key-row__value">{{ row.value }}</code>
                  <q-btn dense flat round icon="content_copy" :aria-label="'Copy ' + row.label" @click="copy(row.value, row.label)" />
                </div>
              </div>

              <div class="join-key-actions">
                <q-btn no-caps outline color="primary" icon="download" label="Download backup" @click="downloadKeys()" />
                <q-btn no-caps outline color="primary" icon="content_copy" label="Copy all" @click="copy(JSON.stringify(keys, null, 2), 'keys')" />
              </div>

              <q-checkbox v-model="confirmedSaved" label="I saved my password and keys in a secure place" class="join-confirm" />
            </q-card-section>

            <q-separator />
            <q-card-section>
              <div class="join-step">
                <span class="join-step__num">4</span>
                <div>
                  <h2 class="join-step__title">Share your claim link</h2>
                  <p class="join-step__copy">
                    Send this to a trusted Hive member who has an account token or 3 HIVE. They
                    create the account with your public keys; you keep the private keys.
                  </p>
                </div>
              </div>

              <q-input
                :model-value="claimLink"
                readonly
                outlined
                dense
                label="Claim link (public keys only)"
                class="join-claim-input"
              >
                <template #append>
                  <q-btn dense flat round icon="content_copy" aria-label="Copy claim link" :disable="!confirmedSaved" @click="copy(claimLink, 'claim link')" />
                </template>
              </q-input>

              <div class="join-claim-meta">
                <span>Key fingerprint <code>{{ fingerprint || '…' }}</code></span>
                <span v-if="claimAgeLabel">{{ claimAgeLabel }}</span>
              </div>

              <div class="join-key-actions">
                <q-btn
                  no-caps
                  unelevated
                  color="primary"
                  icon="link"
                  label="Copy claim link"
                  :disable="!confirmedSaved"
                  @click="copy(claimLink, 'claim link')"
                />
                <q-btn no-caps flat color="primary" icon="refresh" label="Check if created" :loading="checkingCreated" @click="checkCreated()" />
              </div>

              <p class="join-step__copy q-mt-md">
                The link contains only your username and public keys. Do not send your password or
                private keys to your sponsor. The sponsor becomes the account's recovery account by
                default; you can change that later with your owner key.
              </p>
            </q-card-section>
          </template>
        </q-card>

        <aside class="join-keys-aside">
          <q-card flat bordered class="join-aside-card">
            <q-card-section>
              <div class="join-eyebrow">What happens next</div>
              <ol class="join-aside-list">
                <li>You send the claim link to a sponsor.</li>
                <li>The sponsor signs in and creates the account with an account token or 3 HIVE.</li>
                <li>You check that the account exists, then import your posting, active and memo keys into SmartLock or Hive Keychain.</li>
                <li>Keep the owner key and master password offline.</li>
              </ol>
            </q-card-section>
          </q-card>

          <q-card flat bordered class="join-aside-card">
            <q-card-section>
              <div class="join-eyebrow">No sponsor yet?</div>
              <p class="join-aside-copy">
                Use a verified provider instead. Ecency offers free email signup; Hivedex offers
                anonymous paid signup from $0.49.
              </p>
              <div class="join-key-actions">
                <q-btn no-caps outline color="primary" icon="groups" label="See providers" to="/join" />
                <q-btn no-caps outline color="primary" icon="paid" label="Pay with crypto" to="/join/hivedex" />
              </div>
            </q-card-section>
          </q-card>

          <q-card flat bordered class="join-aside-card">
            <q-card-section>
              <div class="join-eyebrow">Safety check</div>
              <p class="join-aside-copy">
                Banksia will never ask for your master password or owner key. A claim link only
                ever contains public keys.
              </p>
            </q-card-section>
          </q-card>
        </aside>
      </div>

      <p class="join-keys-footnote">
        Hive account names are permanent. Creating an account burns 3 HIVE or uses one account
        token; the sponsor pays. If the sponsor cannot create the account, the claim link can be
        reused.
      </p>
    </div>
  </q-page>
</template>

<script>
import { copyToClipboard, exportFile } from 'quasar'
import { setPageMeta } from 'src/utils/pageMeta'
import { validateAccountName } from 'src/services/hiveNames'
import { createPassword, generateKeys } from 'src/services/hiveTx'
import {
  buildClaimLink,
  buildClaimPayload,
  claimAgeDays,
  claimFingerprint,
  publicKeysFromAuthorities
} from 'src/services/accountClaim'
import PageHeader from 'components/ui/PageHeader.vue'

export default {
  name: 'joinKeysPage',
  components: { PageHeader },
  data () {
    return {
      username: '',
      usernameError: '',
      checking: false,
      available: null,
      keys: null,
      generatedAuthorities: null,
      claimPayload: null,
      claimLink: '',
      fingerprint: '',
      confirmedSaved: false,
      checkingCreated: false
    }
  },
  computed: {
    keyRows () {
      if (!this.keys) return []
      return [
        { label: 'Master password', value: this.keys.password },
        { label: 'Owner key', value: this.keys.owner },
        { label: 'Active key', value: this.keys.active },
        { label: 'Posting key', value: this.keys.posting },
        { label: 'Memo key', value: this.keys.memo }
      ]
    },
    claimAgeLabel () {
      if (!this.claimPayload) return ''
      const days = claimAgeDays(this.claimPayload)
      if (days === null) return ''
      if (days < 1) return 'Created today'
      return 'Created ' + Math.floor(days) + ' day' + (days < 2 ? '' : 's') + ' ago'
    }
  },
  watch: {
    username (value) {
      this.available = null
      this.usernameError = value ? (validateAccountName(value.trim().toLowerCase()) || '') : ''
      if (this.keys && value.trim().toLowerCase() !== this.keys.username) {
        this.resetGenerated()
      }
    }
  },
  mounted () {
    setPageMeta({
      title: 'Create your Hive keys — join Hive',
      description: 'Generate a Hive master password and owner, active, posting and memo keys locally, then share a claim link containing only your public keys with a sponsor.',
      url: '/join/keys'
    })
  },
  methods: {
    validateUsername (value) {
      return validateAccountName(String(value || '').trim().toLowerCase())
    },
    async checkUsernameAvailability () {
      const name = String(this.username || '').trim().toLowerCase()
      this.username = name
      this.usernameError = this.validateUsername(name) || ''
      if (this.usernameError) {
        this.available = null
        return
      }
      this.checking = true
      try {
        const accounts = await this.$hive.api.getAccountsAsync([name])
        if (name !== String(this.username || '').trim().toLowerCase()) return
        this.available = accounts.length === 0
      } catch {
        this.available = null
        this.usernameError = 'Could not check that username. Try again.'
      } finally {
        this.checking = false
      }
    },
    async generateKeysForUser () {
      const name = String(this.username || '').trim().toLowerCase()
      this.username = name
      this.usernameError = this.validateUsername(name) || ''
      if (this.usernameError || this.available !== true) return

      try {
        const password = await createPassword()
        const generated = await generateKeys(name, password)
        const publicKeys = publicKeysFromAuthorities(generated)
        const payload = buildClaimPayload({ username: name, ...publicKeys })
        this.keys = { username: name, password, ...generated.privateKeys }
        this.generatedAuthorities = generated
        this.claimPayload = payload
        this.claimLink = buildClaimLink(payload)
        this.confirmedSaved = false
        this.fingerprint = await claimFingerprint(payload)
      } catch (error) {
        this.$q.notify({
          type: 'negative',
          message: error?.message || 'Could not generate keys.',
          position: 'top'
        })
      }
    },
    resetGenerated () {
      this.keys = null
      this.generatedAuthorities = null
      this.claimPayload = null
      this.claimLink = ''
      this.fingerprint = ''
      this.confirmedSaved = false
    },
    copy (value, label) {
      copyToClipboard(String(value || ''))
      this.$q.notify({
        message: label === 'claim link' ? 'Claim link copied.' : label + ' copied.',
        color: 'primary',
        icon: 'content_copy',
        position: 'top',
        timeout: 1800
      })
    },
    downloadKeys () {
      if (!this.keys) return
      const status = exportFile(this.keys.username + '-HiveKeys.txt', JSON.stringify(this.keys, null, 2))
      if (status === true) {
        this.$q.notify({ message: 'Downloaded ' + this.keys.username + '-HiveKeys.txt', color: 'primary', icon: 'download', position: 'top' })
      } else {
        this.$q.notify({ message: 'Could not download the backup: ' + status, color: 'negative', icon: 'error', position: 'top' })
      }
    },
    async checkCreated () {
      if (!this.keys?.username) return
      this.checkingCreated = true
      try {
        const accounts = await this.$hive.api.getAccountsAsync([this.keys.username])
        if (accounts.length) {
          this.$q.notify({
            message: 'Account @' + this.keys.username + ' exists. You can import your keys now.',
            color: 'green',
            icon: 'check_circle',
            position: 'top',
            timeout: 5000
          })
        } else {
          this.$q.notify({
            message: 'Not created yet. Send the claim link to your sponsor and check again.',
            color: 'orange',
            icon: 'schedule',
            position: 'top',
            timeout: 4000
          })
        }
      } catch {
        this.$q.notify({ message: 'Could not check the account. Try again.', color: 'negative', icon: 'error', position: 'top' })
      } finally {
        this.checkingCreated = false
      }
    }
  }
}
</script>

<style scoped>
.join-keys-page {
  padding: var(--space-5) var(--space-4) var(--space-6);
}

.join-keys-shell {
  width: min(1120px, 100%);
  margin: 0 auto;
}

.join-keys-layout {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(260px, 320px);
  gap: var(--space-4);
  align-items: start;
}

.join-keys-card {
  background: var(--c-card);
}

.join-step {
  display: flex;
  gap: var(--space-3);
  align-items: flex-start;
  margin-bottom: var(--space-3);
}

.join-step__num {
  display: grid;
  place-items: center;
  flex: 0 0 auto;
  width: 26px;
  height: 26px;
  border-radius: 50%;
  background: color-mix(in srgb, var(--c-primary) 16%, transparent);
  color: var(--c-primary);
  font-size: 0.78rem;
  font-weight: 700;
}

.join-step__title {
  margin: 0 0 0.2rem;
  font-size: 1rem;
  font-weight: 600;
}

.join-step__copy {
  margin: 0;
  color: var(--c-text-subtle);
  font-size: 0.82rem;
  line-height: 1.55;
}

.join-username {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: var(--space-2);
  align-items: start;
}

.join-at {
  color: var(--c-text-faint);
  font-weight: 600;
}

.join-status {
  display: flex;
  align-items: center;
  gap: 0.35rem;
  flex-wrap: wrap;
  margin-top: var(--space-2);
  font-size: 0.82rem;
}

.join-status a {
  color: var(--c-link);
}

.join-status--ok {
  color: var(--c-positive);
}

.join-status--bad {
  color: var(--c-negative);
}

.join-warning {
  background: color-mix(in srgb, var(--c-warning) 10%, transparent);
  border: 1px solid color-mix(in srgb, var(--c-warning) 35%, transparent);
  color: var(--c-text);
}

.join-warning__copy {
  margin-top: 0.25rem;
  color: var(--c-text-subtle);
  font-size: 0.8rem;
  line-height: 1.5;
}

.join-key-list {
  margin: var(--space-3) 0;
  border: 1px solid var(--c-border);
  border-radius: var(--radius-sm);
  overflow: hidden;
}

.join-key-row {
  display: grid;
  grid-template-columns: 8.5rem minmax(0, 1fr) auto;
  gap: var(--space-2);
  align-items: center;
  padding: 0.5rem 0.65rem;
  border-bottom: 1px solid var(--c-border-subtle);
}

.join-key-row:last-child {
  border-bottom: 0;
}

.join-key-row__label {
  color: var(--c-text-faint);
  font-size: 0.74rem;
}

.join-key-row__value {
  min-width: 0;
  overflow: hidden;
  color: var(--c-text);
  font-family: var(--font-mono);
  font-size: 0.72rem;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.join-key-actions {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-2);
}

.join-confirm {
  margin-top: var(--space-3);
  font-size: 0.85rem;
}

.join-claim-input {
  margin-top: var(--space-2);
}

.join-claim-meta {
  display: flex;
  justify-content: space-between;
  gap: var(--space-2);
  flex-wrap: wrap;
  margin: var(--space-2) 0 var(--space-3);
  color: var(--c-text-faint);
  font-size: 0.72rem;
}

.join-claim-meta code {
  color: var(--c-text-subtle);
  font-family: var(--font-mono);
}

.join-keys-aside {
  display: grid;
  gap: var(--space-3);
}

.join-aside-card {
  background: var(--c-card);
}

.join-eyebrow {
  color: var(--c-text-faint);
  font-size: 0.68rem;
  letter-spacing: 0.07em;
  text-transform: uppercase;
}

.join-aside-list {
  margin: var(--space-2) 0 0;
  padding-left: 1.1rem;
  color: var(--c-text-subtle);
  font-size: 0.8rem;
  line-height: 1.55;
}

.join-aside-list li + li {
  margin-top: 0.4rem;
}

.join-aside-copy {
  margin: var(--space-2) 0 var(--space-3);
  color: var(--c-text-subtle);
  font-size: 0.8rem;
  line-height: 1.55;
}

.join-keys-footnote {
  margin: var(--space-4) 0 0;
  color: var(--c-text-faint);
  font-size: 0.74rem;
  line-height: 1.5;
}

@media (max-width: 899px) {
  .join-keys-layout {
    grid-template-columns: minmax(0, 1fr);
  }
}

@media (max-width: 599px) {
  .join-keys-page {
    padding: var(--space-4) var(--space-3) var(--space-5);
  }

  .join-username {
    grid-template-columns: minmax(0, 1fr);
  }

  .join-key-row {
    grid-template-columns: minmax(0, 1fr) auto;
  }

  .join-key-row__label {
    grid-column: 1 / -1;
  }
}
</style>
