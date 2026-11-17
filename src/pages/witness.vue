<template>
  <q-page class="net-page">
    <div class="net-shell witness-edit">
      <header class="net-head">
        <div class="net-head__text">
          <div class="net-eyebrow">
            <q-icon name="tune" size="14px" aria-hidden="true" />
            Governance tools
          </div>
          <h1 class="net-head__title">Witness settings</h1>
          <p class="net-intro">
            Review your witness status, update public properties and signing keys, or
            register a new witness. Every broadcast is queued for active-key signing.
          </p>
        </div>
        <div class="net-actions">
          <q-btn no-caps outline color="primary" icon="how_to_vote" label="Witness directory" to="/witnesses" />
          <q-btn flat round dense icon="refresh" aria-label="Refresh witness data" title="Refresh witness data" :loading="loading" @click="init" />
        </div>
      </header>

      <q-card v-if="!username" flat bordered class="net-state witness-edit__state">
        <q-icon name="login" size="2.2em" color="primary" aria-hidden="true" />
        <h2 class="witness-edit__state-title">Log in to manage a witness</h2>
        <p>
          Use the account menu in the header to log in. Only the witness account itself can
          broadcast a witness update, and the transaction needs that account's active key.
        </p>
        <q-btn no-caps outline color="primary" icon="how_to_vote" label="Browse witnesses" to="/witnesses" />
      </q-card>

      <q-card v-else-if="loading && !witness" flat bordered class="witness-edit__state">
        <q-skeleton type="rect" height="120px" />
        <q-skeleton type="rect" height="320px" class="q-mt-md" />
      </q-card>

      <template v-else>
        <section v-if="witness" class="net-section" aria-labelledby="witness-status-title">
          <div class="net-section__head">
            <div>
              <h2 id="witness-status-title" class="net-section__title">Witness status</h2>
              <span class="net-section__hint">Live values from the chain for @{{ username }}</span>
            </div>
            <router-link :to="'/@' + username" class="witness-edit__profile-link">Open profile</router-link>
          </div>

          <div class="net-stat-grid">
            <health-stat-card label="Vote rank" :value="rank ? '#' + rank : '—'" icon="leaderboard" :hint="rank && rank <= 21 ? 'Inside the consensus set' : 'Backup witness position'" />
            <health-stat-card label="Approval" :value="votesHp" icon="how_to_vote" hint="Total witness approval in HP" />
            <health-stat-card label="Missed blocks" :value="missedLabel" icon="block" :status-label="missedStatus.label" :status-color="missedStatus.color" :hint="'Blocks since last: ' + blocksSinceLast" />
            <health-stat-card label="Price feed" :value="feedAge" icon="price_change" :status-label="feedStatus.label" :status-color="feedStatus.color" :hint="feedRateLabel" />
            <health-stat-card
              label="Signing key"
              :value="signingDisabled ? 'Disabled' : 'Enabled'"
              icon="key"
              :status-label="signingDisabled ? 'Cannot sign' : 'Signing'"
              :status-color="signingDisabled ? 'negative' : 'green'"
              :hint="signingDisabled ? 'The null signing key is set' : 'A block signing key is configured'"
            />
            <health-stat-card
              label="Version"
              :value="'v' + (witness.running_version || '?')"
              icon="system_update"
              :status-label="versionMismatch ? 'Mismatch' : 'Matches'"
              :status-color="versionMismatch ? 'orange' : 'green'"
              :hint="'Network consensus v' + (hardforkVersion || '—')"
            />
          </div>

          <ul v-if="statusWarnings.length" class="witness-edit__warnings">
            <li v-for="warning in statusWarnings" :key="warning.id" :class="'witness-edit__warning--' + warning.severity">
              <q-icon :name="warning.icon" size="16px" aria-hidden="true" />
              <span><strong>{{ warning.label }}:</strong> {{ warning.detail }}</span>
            </li>
          </ul>
        </section>

        <q-card v-if="!witness" flat bordered class="witness-edit__notice">
          <q-card-section>
            <div class="witness-edit__notice-head">
              <q-icon name="fiber_new" color="green" size="22px" aria-hidden="true" />
              <h2 id="witness-register-title" class="net-section__title">Register a new witness</h2>
            </div>
            <p>
              @{{ username }} is not registered as a witness. Fill in the signing key and URL
              for your node, then queue a witness update with the active key. Registration also
              uses the <code>witness_update</code> operation.
            </p>
          </q-card-section>
        </q-card>

        <section class="net-section" aria-labelledby="witness-settings-title">
          <div class="net-section__head">
            <div>
              <h2 id="witness-settings-title" class="net-section__title">
                {{ witness ? 'Witness properties' : 'Registration properties' }}
              </h2>
              <span class="net-section__hint">Changes are previewed before they are queued.</span>
            </div>
            <span class="net-key-hint">
              <q-icon name="key" size="14px" aria-hidden="true" />
              Requires active key
            </span>
          </div>

          <q-card flat bordered class="witness-edit__form-card">
            <q-card-section>
              <h3 class="witness-edit__subhead">Public identity</h3>
              <div class="witness-edit__fields">
                <q-input
                  v-model="form.url"
                  outlined
                  dense
                  label="Witness URL"
                  type="url"
                  placeholder="https://your-witness.example"
                  :error="Boolean(fieldError('url'))"
                  :error-message="fieldError('url')"
                  @blur="attempted = true"
                >
                  <template #prepend><q-icon name="link" aria-hidden="true" /></template>
                </q-input>
                <q-input
                  v-model="form.signingKey"
                  outlined
                  dense
                  label="Public signing key"
                  placeholder="STM..."
                  :error="Boolean(fieldError('signingKey'))"
                  :error-message="fieldError('signingKey')"
                  @blur="attempted = true"
                >
                  <template #prepend><q-icon name="key" aria-hidden="true" /></template>
                </q-input>

                <div class="witness-edit__keys" role="group" aria-labelledby="saved-keys-title">
                  <div class="witness-edit__keys-head">
                    <h4 id="saved-keys-title" class="witness-edit__keys-title">Saved signing keys</h4>
                    <q-btn
                      flat
                      dense
                      no-caps
                      color="primary"
                      icon="bookmark_add"
                      label="Save current key"
                      @click="openKeyDialog"
                    />
                  </div>

                  <p v-if="!savedKeys.length" class="witness-edit__keys-empty">
                    Save the current public key with a label to switch between node signing keys later.
                  </p>

                  <ul v-else class="witness-edit__keys-list">
                    <li v-for="saved in savedKeys" :key="saved.key" class="witness-edit__key">
                      <button
                        type="button"
                        class="witness-edit__key-apply"
                        :aria-label="'Use signing key ' + saved.label"
                        @click="applySavedKey(saved)"
                      >
                        <span class="witness-edit__key-label">{{ saved.label }}</span>
                        <code>{{ shortSigningKey(saved.key) }}</code>
                        <q-icon
                          v-if="saved.key === form.signingKey.trim()"
                          name="check_circle"
                          color="green"
                          size="16px"
                          aria-label="Currently selected"
                        />
                      </button>
                      <q-btn
                        flat
                        dense
                        round
                        color="grey"
                        icon="delete_outline"
                        :aria-label="'Delete saved signing key ' + saved.label"
                        title="Delete saved key"
                        @click="deleteSavedKey(saved)"
                      />
                    </li>
                  </ul>

                  <p class="witness-edit__keys-note">
                    Saved in this browser only. These are public keys, never private keys.
                  </p>
                </div>

                <p class="witness-edit__field-note">
                  Use the public key from your witness node's <code>config.ini</code>.
                  Never paste a private key. The null key
                  <code>{{ disabledKey }}</code> disables block signing.
                </p>
              </div>

              <h3 class="witness-edit__subhead">Chain parameters</h3>
              <div class="witness-edit__fields">
                <q-input
                  v-model="form.accountCreationFee"
                  outlined
                  dense
                  label="Account creation fee"
                  hint="HIVE asset, or a fee schedule is not supported here"
                  :error="Boolean(fieldError('accountCreationFee'))"
                  :error-message="fieldError('accountCreationFee')"
                  @blur="attempted = true"
                />
                <q-input
                  v-model.number="form.maximumBlockSize"
                  outlined
                  dense
                  type="number"
                  label="Maximum block size"
                  suffix="bytes"
                  :error="Boolean(fieldError('maximumBlockSize'))"
                  :error-message="fieldError('maximumBlockSize')"
                  @blur="attempted = true"
                />
                <q-input
                  v-model.number="form.hbdInterestPercent"
                  outlined
                  dense
                  type="number"
                  step="0.01"
                  min="0"
                  max="100"
                  label="HBD savings interest"
                  suffix="% APR"
                  :error="Boolean(fieldError('hbdInterestPercent'))"
                  :error-message="fieldError('hbdInterestPercent')"
                  @blur="attempted = true"
                />
                <p class="witness-edit__field-note">
                  The chain stores the HBD rate in basis points; {{ Number(form.hbdInterestPercent || 0).toFixed(2) }}%
                  is broadcast as {{ Math.round(Number(form.hbdInterestPercent || 0) * 100) }}.
                </p>
              </div>

              <h3 class="witness-edit__subhead">Advanced account subsidies</h3>
              <div class="witness-edit__fields">
                <q-input
                  v-model.number="form.subsidyBudget"
                  outlined
                  dense
                  type="number"
                  label="Account subsidy budget"
                  :error="Boolean(fieldError('subsidyBudget'))"
                  :error-message="fieldError('subsidyBudget')"
                  @blur="attempted = true"
                />
                <q-input
                  v-model.number="form.subsidyDecay"
                  outlined
                  dense
                  type="number"
                  label="Account subsidy decay"
                  :error="Boolean(fieldError('subsidyDecay'))"
                  :error-message="fieldError('subsidyDecay')"
                  @blur="attempted = true"
                />
              </div>
            </q-card-section>

            <q-separator />

            <q-card-actions class="witness-edit__actions">
              <q-btn
                no-caps
                :color="witness ? 'primary' : 'green'"
                :icon="witness ? 'publish' : 'person_add'"
                :label="witness ? 'Queue witness update' : 'Queue witness registration'"
                @click="submit"
              />
              <q-btn
                v-if="witness && !signingDisabled"
                flat
                no-caps
                color="red"
                icon="key_off"
                label="Disable signing"
                @click="confirmDisable = true"
              />
              <q-btn flat no-caps color="grey" icon="undo" label="Reset changes" :disable="!isDirty" @click="reset" />
              <q-space />
              <span v-if="isDirty" class="net-chip net-chip--warning">Unsaved changes</span>
              <span v-else class="net-key-hint">No changes yet</span>
            </q-card-actions>
          </q-card>
        </section>

        <section class="net-section" aria-labelledby="witness-preview-title">
          <div class="net-section__head">
            <div>
              <h2 id="witness-preview-title" class="net-section__title">Transaction preview</h2>
              <span class="net-section__hint">This is exactly what will enter the signing queue.</span>
            </div>
            <q-btn flat dense no-caps color="primary" icon="content_copy" label="Copy cli_wallet command" @click="copyCli" />
          </div>

          <q-card flat bordered class="witness-edit__preview">
            <q-card-section>
              <div class="witness-edit__cli">
                <code>{{ cli }}</code>
              </div>
              <json-viewer :data="payload" class="witness-edit__json" tabindex="0" role="region" aria-label="Witness update JSON preview" />
            </q-card-section>
          </q-card>
        </section>
      </template>
    </div>

    <q-dialog v-model="confirmDisable">
      <q-card class="witness-edit__dialog">
        <q-card-section>
          <h2 class="text-h6 q-my-none">Disable block signing?</h2>
          <p>
            This queues a witness update with the null signing key. Your witness will stop
            signing blocks until you publish a new valid public key. The update requires your
            active key.
          </p>
        </q-card-section>
        <q-card-actions align="right">
          <q-btn flat no-caps label="Cancel" v-close-popup />
          <q-btn color="red" no-caps icon="key_off" label="Disable signing" @click="disableSigning" />
        </q-card-actions>
      </q-card>
    </q-dialog>

    <q-dialog v-model="confirmRegister">
      <q-card class="witness-edit__dialog">
        <q-card-section>
          <h2 class="text-h6 q-my-none">Register @{{ username }} as a witness?</h2>
          <p>
            This queues a <code>witness_update</code> with the properties shown in the preview.
            Registration and every later update require your active key. You can edit the
            properties again after registration.
          </p>
        </q-card-section>
        <q-card-actions align="right">
          <q-btn flat no-caps label="Cancel" v-close-popup />
          <q-btn color="green" no-caps icon="person_add" label="Queue registration" @click="queueUpdate" />
        </q-card-actions>
      </q-card>
    </q-dialog>

    <q-dialog v-model="keyDialog">
      <q-card class="witness-edit__dialog">
        <q-card-section>
          <h2 class="text-h6 q-my-none">Save public signing key</h2>
          <p>
            Give this key a label so you can switch between node signing keys quickly.
            Only the public key is stored, locally in this browser.
          </p>
          <q-input
            v-model="keyLabel"
            outlined
            dense
            label="Label"
            placeholder="e.g. Primary node"
            maxlength="40"
            class="q-mt-md"
            :error="Boolean(keyError)"
            :error-message="keyError"
            autofocus
            @keyup.enter="saveCurrentKey"
          />
          <div class="witness-edit__key-preview">
            <span>Public key</span>
            <code>{{ form.signingKey }}</code>
          </div>
        </q-card-section>
        <q-card-actions align="right">
          <q-btn flat no-caps label="Cancel" v-close-popup />
          <q-btn color="primary" no-caps icon="bookmark_add" label="Save key" @click="saveCurrentKey" />
        </q-card-actions>
      </q-card>
    </q-dialog>
  </q-page>
</template>

<style scoped>
.witness-edit {
  min-width: 0;
}

.witness-edit__state {
  gap: var(--space-3);
  padding: var(--space-6) var(--space-4);
}

.witness-edit__state-title {
  margin: 0;
  color: #e4eaed;
  font-size: 1.15rem;
}

.witness-edit__state p {
  max-width: 56ch;
  margin: 0;
  color: #90a4ae;
  font-size: 0.86rem;
  line-height: 1.55;
}

.witness-edit__profile-link {
  color: #4fc3f7;
  font-size: 0.78rem;
  font-weight: 600;
  text-decoration: none;
}

.witness-edit__warnings {
  display: flex;
  flex-direction: column;
  gap: 0.3rem;
  margin: var(--space-3) 0 0;
  padding: 0;
  list-style: none;
}

.witness-edit__warnings li {
  display: flex;
  align-items: flex-start;
  gap: 0.35rem;
  padding: 0.45rem 0.6rem;
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-sm);
  background: rgba(255, 255, 255, 0.025);
  color: #b0bec5;
  font-size: 0.76rem;
  line-height: 1.45;
}

.witness-edit__warning--critical {
  border-color: rgba(239, 83, 80, 0.4) !important;
  color: #ef9a9a !important;
}

.witness-edit__warning--warning {
  border-color: rgba(255, 183, 77, 0.4) !important;
  color: #ffcc80 !important;
}

.witness-edit__notice {
  margin-top: var(--space-4);
  overflow: hidden;
  border-color: rgba(76, 175, 80, 0.35);
  background: rgba(76, 175, 80, 0.055);
}

.witness-edit__notice-head {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  margin-bottom: 0.35rem;
}

.witness-edit__notice p {
  margin: 0;
  color: #b0bec5;
  font-size: 0.82rem;
  line-height: 1.55;
}

.witness-edit__form-card,
.witness-edit__preview {
  overflow: hidden;
  background: rgba(255, 255, 255, 0.028);
}

.witness-edit__subhead {
  margin: 0.2rem 0 0.6rem;
  color: #cfd8dc;
  font-size: 0.92rem;
  font-weight: 600;
}

.witness-edit__subhead:not(:first-child) {
  margin-top: 1.2rem;
}

.witness-edit__fields {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0.55rem var(--space-3);
}

.witness-edit__field-note {
  grid-column: 1 / -1;
  margin: -0.15rem 0 0;
  color: #78909c;
  font-size: 0.7rem;
  line-height: 1.45;
}

.witness-edit__keys {
  grid-column: 1 / -1;
  padding: 0.55rem 0.65rem;
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-sm);
  background: rgba(255, 255, 255, 0.025);
}

.witness-edit__keys-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-2);
  flex-wrap: wrap;
}

.witness-edit__keys-title {
  margin: 0;
  color: #cfd8dc;
  font-size: 0.78rem;
  font-weight: 600;
}

.witness-edit__keys-empty,
.witness-edit__keys-note {
  margin: 0.2rem 0 0;
  color: #78909c;
  font-size: 0.7rem;
  line-height: 1.45;
}

.witness-edit__keys-note {
  margin-top: 0.4rem;
}

.witness-edit__keys-list {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  margin: 0.45rem 0 0;
  padding: 0;
  list-style: none;
}

.witness-edit__key {
  display: flex;
  align-items: center;
  gap: 0.25rem;
  min-width: 0;
}

.witness-edit__key-apply {
  display: flex;
  align-items: center;
  gap: 0.45rem;
  flex: 1;
  min-width: 0;
  padding: 0.35rem 0.45rem;
  border: 1px solid transparent;
  border-radius: var(--radius-sm);
  background: rgba(255, 255, 255, 0.035);
  color: #cfd8dc;
  font: inherit;
  text-align: left;
  cursor: pointer;
}

.witness-edit__key-apply:hover,
.witness-edit__key-apply:focus-visible {
  border-color: rgba(79, 195, 247, 0.4);
  background: rgba(79, 195, 247, 0.08);
}

.witness-edit__key-label {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  font-size: 0.78rem;
  font-weight: 600;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.witness-edit__key-apply code {
  color: #90a4ae;
  font-size: 0.68rem;
  white-space: nowrap;
}

.witness-edit__key-preview {
  display: flex;
  flex-direction: column;
  gap: 0.2rem;
  margin-top: 0.65rem;
  padding: 0.45rem 0.55rem;
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-sm);
  background: rgba(255, 255, 255, 0.025);
}

.witness-edit__key-preview span {
  color: #78909c;
  font-size: 0.64rem;
  letter-spacing: 0.04em;
  text-transform: uppercase;
}

.witness-edit__key-preview code {
  color: #b0bec5;
  font-size: 0.7rem;
  overflow-wrap: anywhere;
}

@media (max-width: 499px) {
  .witness-edit__key-apply {
    align-items: flex-start;
    flex-direction: column;
    gap: 0.1rem;
  }
}

.witness-edit__field-note code,
.witness-edit__notice code {
  padding: 0.08em 0.3em;
  border-radius: 4px;
  background: rgba(255, 255, 255, 0.07);
  color: #cfd8dc;
  overflow-wrap: anywhere;
}

.witness-edit__actions {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 0.35rem;
  padding: 0.7rem 1rem;
}

.witness-edit__cli {
  margin-bottom: 0.55rem;
  padding: 0.55rem 0.65rem;
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-sm);
  background: #0f171c;
  color: #b0bec5;
  font-size: 0.72rem;
  line-height: 1.5;
  overflow-wrap: anywhere;
}

.witness-edit__cli code {
  white-space: pre-wrap;
  word-break: break-word;
}

.witness-edit__json {
  max-height: 280px;
  overflow: auto;
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-sm);
  padding: 0.35rem;
}

.witness-edit__dialog {
  width: 100%;
  max-width: 460px;
  border-radius: var(--radius-card);
}

.witness-edit__dialog p {
  margin: 0.5rem 0 0;
  color: #b0bec5;
  font-size: 0.84rem;
  line-height: 1.55;
}

@media (max-width: 699px) {
  .witness-edit__fields {
    grid-template-columns: minmax(0, 1fr);
  }
}
</style>

<script>
import { copyToClipboard } from 'quasar'
import jsonViewer from 'components/jsonViewer.vue'
import HealthStatCard from 'components/health/HealthStatCard.vue'
import { setPageMeta } from 'src/utils/pageMeta'
import { fetchWitnessByAccount, fetchWitnessesByVote } from 'src/services/chainData'
import {
  DISABLED_SIGNING_KEY,
  buildWitnessUpdate,
  cliWalletCommand,
  formFromWitness,
  formatHp,
  relativeTime,
  validateSigningKey,
  validateWitnessForm,
  versionMatches,
  witnessHealth,
  witnessUpdateQueueItem,
  witnessVotesHp
} from 'src/services/witnesses'
import {
  addSavedKey,
  loadSavedKeys,
  removeSavedKey,
  saveSavedKeys,
  shortSigningKey
} from 'src/services/witnessKeys'

function cloneForm (form) {
  return JSON.parse(JSON.stringify(form))
}

export default {
  name: 'WitnessEdit',
  components: { jsonViewer, HealthStatCard },
  data () {
    return {
      witness: null,
      rank: null,
      hardforkVersion: '',
      loading: false,
      attempted: false,
      confirmDisable: false,
      confirmRegister: false,
      form: formFromWitness(null),
      initialForm: formFromWitness(null),
      disabledKey: DISABLED_SIGNING_KEY,
      savedKeys: loadSavedKeys(),
      keyDialog: false,
      keyLabel: '',
      keyError: ''
    }
  },
  computed: {
    username () {
      return this.$hiveStore.user.username
    },
    globalProps () {
      return this.$hiveStore.globalProps
    },
    votesHp () {
      return this.witness ? formatHp(witnessVotesHp(this.witness.votes, this.globalProps)) : '—'
    },
    missedLabel () {
      return Number(this.witness?.total_missed || 0).toLocaleString('en-US')
    },
    blocksSinceLast () {
      const head = Number(this.globalProps?.head_block_number) || 0
      const last = Number(this.witness?.last_confirmed_block_num) || 0
      return head > 0 && last > 0 ? Math.max(0, head - last).toLocaleString('en-US') : '—'
    },
    missedStatus () {
      const gap = Number(this.globalProps?.head_block_number || 0) - Number(this.witness?.last_confirmed_block_num || 0)
      return gap > 21
        ? { label: 'Missed slot', color: 'orange' }
        : { label: 'Signing', color: 'green' }
    },
    feedAge () {
      return relativeTime(this.witness?.last_hbd_exchange_update)
    },
    feedStatus () {
      const fresh = this.witness?.last_hbd_exchange_update &&
        (Date.now() - new Date(this.witness.last_hbd_exchange_update).getTime()) < 24 * 60 * 60 * 1000
      return fresh ? { label: 'Fresh', color: 'green' } : { label: 'Stale', color: 'orange' }
    },
    feedRateLabel () {
      const rate = this.witness?.hbd_exchange_rate
      return rate ? rate.base + ' per ' + rate.quote : 'No price feed'
    },
    signingDisabled () {
      return this.form.signingKey === DISABLED_SIGNING_KEY
    },
    versionMismatch () {
      return this.witness ? !versionMatches(this.witness.running_version, this.hardforkVersion) : false
    },
    statusWarnings () {
      if (!this.witness) return []
      return witnessHealth(this.witness, {
        globalProps: this.globalProps,
        hardforkVersion: this.hardforkVersion,
        headBlock: this.globalProps?.head_block_number,
        scheduled: this.rank ? this.rank <= 21 : false
      }).filter(warning => warning.severity !== 'info')
    },
    validation () {
      return validateWitnessForm(this.form)
    },
    isDirty () {
      return JSON.stringify(this.form) !== JSON.stringify(this.initialForm)
    },
    payload () {
      return buildWitnessUpdate({ owner: this.username || '', form: this.form })
    },
    cli () {
      return cliWalletCommand(this.payload)
    }
  },
  watch: {
    username (value) {
      if (value) this.init()
    }
  },
  mounted () {
    setPageMeta({
      title: 'Hive witness settings — update signing key and properties',
      description: 'Review your Hive witness status and update the signing key, URL, block size, HBD interest rate and subsidy parameters with active-key signing.',
      url: '/witness'
    })
    if (this.username) this.init()
  },
  methods: {
    shortSigningKey,
    fieldError (field) {
      if (!this.attempted) return ''
      return this.validation.errors[field] || ''
    },
    openKeyDialog () {
      const key = String(this.form.signingKey || '').trim()
      if (!validateSigningKey(key)) {
        this.$q.notify({ type: 'warning', message: 'Enter a valid public signing key before saving it.' })
        return
      }
      const existing = this.savedKeys.find(item => item.key === key)
      this.keyLabel = existing?.label || ''
      this.keyError = ''
      this.keyDialog = true
    },
    saveCurrentKey () {
      const key = String(this.form.signingKey || '').trim()
      if (!validateSigningKey(key)) {
        this.keyError = 'Enter a valid public signing key first.'
        return
      }
      const label = String(this.keyLabel || '').trim()
      if (!label) {
        this.keyError = 'Add a short label for this key.'
        return
      }

      this.savedKeys = addSavedKey(this.savedKeys, key, label)
      saveSavedKeys(this.savedKeys)
      this.keyDialog = false
      this.keyError = ''
      this.$q.notify({
        type: 'positive',
        message: 'Saved public signing key “' + label.slice(0, 40) + '”.'
      })
    },
    applySavedKey (saved) {
      this.form.signingKey = saved.key
      this.$q.notify({
        type: 'info',
        message: 'Using saved key “' + saved.label + '”. The transaction preview is updated.'
      })
    },
    deleteSavedKey (saved) {
      this.savedKeys = removeSavedKey(this.savedKeys, saved.key)
      saveSavedKeys(this.savedKeys)
      this.$q.notify({ type: 'info', message: 'Removed saved key “' + saved.label + '”.' })
    },
    async init () {
      if (!this.username) return
      this.loading = true
      try {
        if (!this.globalProps || this.globalProps.empty) {
          await this.$hiveStore.getGlobalProps()
        }
        if (this.$hiveStore.accounts[this.username] === undefined) {
          await this.$hiveStore.getAccount(this.username)
        }

        const [witnessResult, ranked, hardfork] = await Promise.allSettled([
          fetchWitnessByAccount(this.username),
          fetchWitnessesByVote(200),
          this.$hive.api.callAsync('condenser_api.get_hardfork_version', [])
        ])

        const witness = witnessResult.status === 'fulfilled' ? witnessResult.value : null
        const list = ranked.status === 'fulfilled' && Array.isArray(ranked.value) ? ranked.value : []
        const index = witness ? list.findIndex(item => item.owner === witness.owner) : -1

        this.witness = witness || null
        this.rank = index >= 0 ? index + 1 : null
        this.hardforkVersion = hardfork.status === 'fulfilled' ? (hardfork.value || '') : ''
        this.form = formFromWitness(witness)
        this.initialForm = cloneForm(this.form)
        this.attempted = false
      } catch {
        this.$q.notify({ type: 'negative', message: 'Could not load witness data' })
      } finally {
        this.loading = false
      }
    },
    reset () {
      this.form = cloneForm(this.initialForm)
      this.attempted = false
    },
    submit () {
      this.attempted = true
      if (!this.validation.valid) {
        const first = Object.values(this.validation.errors)[0]
        this.$q.notify({ type: 'negative', message: first || 'Check the witness properties.' })
        return
      }
      if (!this.witness) {
        this.confirmRegister = true
        return
      }
      this.queueUpdate()
    },
    queueUpdate () {
      this.confirmRegister = false
      const payload = buildWitnessUpdate({ owner: this.username, form: this.form })
      this.$hiveStore.addToQueue(witnessUpdateQueueItem(this.username, payload))
      this.initialForm = cloneForm(this.form)
      this.attempted = false
      this.$q.notify({
        type: 'positive',
        message: (this.witness ? 'Witness update' : 'Witness registration') + ' queued. Requires your active key.'
      })
    },
    disableSigning () {
      this.form.signingKey = DISABLED_SIGNING_KEY
      this.confirmDisable = false
      const payload = buildWitnessUpdate({ owner: this.username, form: this.form })
      this.$hiveStore.addToQueue(witnessUpdateQueueItem(this.username, payload))
      this.initialForm = cloneForm(this.form)
      this.attempted = false
      this.$q.notify({
        type: 'info',
        message: 'Signing disabled and witness update queued. A new valid key is required to sign again.'
      })
    },
    copyCli () {
      copyToClipboard(this.cli)
      this.$q.notify({ type: 'positive', message: 'cli_wallet command copied to clipboard' })
    }
  }
}
</script>
