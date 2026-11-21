<template>
  <q-card flat bordered class="home-card home-panel settings-card">
    <q-card-section class="home-panel__head">
      <div>
        <div class="home-eyebrow">Preferences</div>
        <h2 class="home-panel__title">Settings</h2>
      </div>
      <q-btn flat dense round icon="close" aria-label="Close settings" title="Close settings" v-close-popup />
    </q-card-section>

    <div class="settings-scroll">
      <section class="settings-section" aria-labelledby="settings-voting-title">
        <div class="settings-section__head">
          <q-icon name="how_to_vote" size="18px" color="primary" aria-hidden="true" />
          <div>
            <h3 id="settings-voting-title" class="settings-section__title">Voting</h3>
            <p class="settings-section__hint">Default weight for votes you cast from this device.</p>
          </div>
        </div>
        <div class="settings-vote">
          <q-slider
            v-model="voteWeightPost"
            :min="-100"
            :max="100"
            :step="1"
            :color="voteColor"
            label
            label-text-color="black"
            aria-label="Default vote weight"
          />
          <span class="settings-vote__value" :class="'text-' + voteColor">{{ voteWeightPost }}%</span>
        </div>
      </section>

      <section class="settings-section" aria-labelledby="settings-beneficiaries-title">
        <div class="settings-section__head">
          <q-icon name="volunteer_activism" size="18px" color="green" aria-hidden="true" />
          <div>
            <h3 id="settings-beneficiaries-title" class="settings-section__title">Comment beneficiaries</h3>
            <p class="settings-section__hint">Share part of your comment rewards with other accounts. This list is added to the comments and replies you send.</p>
          </div>
        </div>

        <ul v-if="beneficiaries.length" class="settings-bene-list" aria-label="Comment beneficiaries">
          <li v-for="bene in beneficiaries" :key="bene.account" class="settings-bene-row">
            <q-avatar size="26px">
              <q-img :src="avatarUrl(bene.account)" :alt="'Avatar of @' + bene.account" />
            </q-avatar>
            <span class="settings-bene-row__account">@{{ bene.account }}</span>
            <q-input
              v-model.number="bene.percent"
              class="settings-bene-row__percent"
              type="number"
              min="0"
              max="100"
              suffix="%"
              dense
              outlined
              :aria-label="'Beneficiary share for ' + bene.account"
              @blur="clampPercent(bene)"
            />
            <q-btn
              flat
              dense
              round
              icon="delete_outline"
              color="red-4"
              :aria-label="'Remove beneficiary ' + bene.account"
              :title="'Remove @' + bene.account"
              @click="removeBene(bene.account)"
            />
          </li>
        </ul>
        <div v-else class="settings-empty">
          <q-icon name="person_off" size="18px" aria-hidden="true" />
          <span>No beneficiaries. All comment rewards go to you.</span>
        </div>

        <div class="settings-bene-add">
          <q-input
            v-model.trim="newBeneAccount"
            class="settings-bene-add__account"
            label="Account"
            maxlength="16"
            dense
            outlined
            aria-label="New beneficiary account"
            @keyup.enter="addBene"
          />
          <q-input
            v-model.number="newBenePercent"
            class="settings-bene-add__percent"
            label="Share %"
            type="number"
            min="0"
            max="100"
            suffix="%"
            dense
            outlined
            aria-label="New beneficiary share"
            @keyup.enter="addBene"
          />
          <q-btn
            unelevated
            no-caps
            color="primary"
            icon="add"
            label="Add"
            :disable="!canAddBene"
            @click="addBene"
          />
        </div>
        <div v-if="beneficiaryTotal > 100" class="settings-warning" role="alert">
          <q-icon name="warning" size="16px" aria-hidden="true" />
          <span>Beneficiary shares cannot total more than 100%.</span>
        </div>
        <div v-else-if="beneficiaries.length" class="settings-total">
          {{ beneficiaryTotal }}% of comment rewards shared
        </div>
      </section>

      <section class="settings-section" aria-labelledby="settings-network-title">
        <div class="settings-section__head">
          <q-icon name="dns" size="18px" color="blue" aria-hidden="true" />
          <div>
            <h3 id="settings-network-title" class="settings-section__title">Network</h3>
            <p class="settings-section__hint">API endpoints used for reads and broadcasts. Keep the defaults unless you need a specific node.</p>
          </div>
        </div>
        <div class="settings-fields">
          <q-input v-model.trim="apiNode" label="Hive API node" dense outlined aria-label="Hive API node" />
          <q-input v-model.trim="ahNode" label="Account history node" dense outlined aria-label="Hive account history node" />
          <q-input v-model.trim="heApiNode" label="Hive-Engine API node" dense outlined aria-label="Hive-Engine API node" />
          <q-select
            v-model="magiApiNode"
            :options="magiNodeOptions"
            label="Magi API node"
            hint="Known Magi GraphQL endpoints. Type a custom URL to override."
            use-input
            hide-selected
            fill-input
            new-value-mode="add-unique"
            dense
            outlined
            aria-label="Magi API node"
          />
        </div>
      </section>

      <section class="settings-section" aria-labelledby="settings-smartlock-title">
        <div class="settings-section__head">
          <q-icon name="lock_clock" size="18px" color="orange" aria-hidden="true" />
          <div>
            <h3 id="settings-smartlock-title" class="settings-section__title">SmartLock</h3>
            <p class="settings-section__hint">Remove unlocked posting keys from memory after a period of inactivity. The active key is never kept in memory.</p>
          </div>
        </div>
        <q-select
          v-model.number="smartlockSessionMinutes"
          class="settings-select"
          :options="smartlockTimeoutOptions"
          emit-value
          map-options
          dense
          outlined
          label="Auto-lock after inactivity"
          aria-label="SmartLock auto-lock timeout"
        />
      </section>
    </div>

    <q-card-section class="settings-footer">
      <span class="settings-footer__note">Saved on this device.</span>
      <div class="settings-footer__actions">
        <q-btn flat no-caps label="Cancel" v-close-popup />
        <q-btn
          unelevated
          no-caps
          color="primary"
          icon="save"
          label="Save settings"
          :disable="beneficiaryTotal > 100"
          @click="saveSettings"
          v-close-popup
        />
      </div>
    </q-card-section>
  </q-card>
</template>
<style scoped>
.settings-card {
  display: flex;
  flex-direction: column;
  width: 470px;
  max-width: 94vw;
  max-height: min(680px, calc(100vh - 72px));
  background: #1d1d1d;
}

.settings-card :deep(.home-panel__head) {
  flex: none;
}

.settings-scroll {
  flex: 1 1 auto;
  min-height: 0;
  overflow-y: auto;
  overscroll-behavior: contain;
}

.settings-section {
  padding: 0.8rem 1rem 0.9rem;
  border-bottom: 1px solid var(--border-subtle);
}

.settings-section:last-child {
  border-bottom: 0;
}

.settings-section__head {
  display: flex;
  align-items: flex-start;
  gap: 0.55rem;
}

.settings-section__title {
  margin: 0;
  color: #e4eaed;
  font-size: 0.86rem;
  font-weight: 600;
  line-height: 1.3;
}

.settings-section__hint {
  margin: 0.15rem 0 0;
  color: #90a4ae;
  font-size: 0.72rem;
  line-height: 1.45;
}

.settings-vote {
  display: flex;
  align-items: center;
  gap: 0.9rem;
  margin-top: 0.7rem;
  padding: 0 0.15rem;
}

.settings-vote :deep(.q-slider) {
  flex: 1 1 auto;
  min-width: 0;
}

.settings-vote__value {
  min-width: 48px;
  color: #cfd8dc;
  font-size: 0.9rem;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
  text-align: right;
}

.settings-bene-list,
.settings-fields,
.settings-bene-add {
  margin: 0.65rem 0 0;
  padding: 0;
  list-style: none;
}

.settings-bene-list {
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
}

.settings-bene-row {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.35rem 0.45rem;
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-sm);
  background: rgba(255, 255, 255, 0.02);
}

.settings-bene-row__account {
  flex: 1 1 auto;
  min-width: 0;
  overflow: hidden;
  color: #cfd8dc;
  font-size: 0.8rem;
  font-weight: 500;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.settings-bene-row__percent {
  flex: 0 0 88px;
}

.settings-bene-row__percent :deep(.q-field__control) {
  min-height: 34px;
}

.settings-bene-add {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 96px auto;
  gap: 0.4rem;
  align-items: center;
}

.settings-fields {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.settings-empty {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  margin-top: 0.65rem;
  padding: 0.55rem 0.6rem;
  border: 1px dashed var(--border-subtle);
  border-radius: var(--radius-sm);
  color: #78909c;
  font-size: 0.74rem;
}

.settings-total,
.settings-warning {
  display: flex;
  align-items: center;
  gap: 0.3rem;
  margin-top: 0.5rem;
  font-size: 0.7rem;
}

.settings-total {
  color: #81c784;
}

.settings-warning {
  color: #ffb74d;
}

.settings-select {
  margin-top: 0.65rem;
}

.settings-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.6rem;
  flex-wrap: wrap;
  flex: none;
  padding: 0.6rem 1rem 0.7rem;
  border-top: 1px solid var(--border-subtle);
  background: rgba(255, 255, 255, 0.02);
}

.settings-footer__note {
  color: #78909c;
  font-size: 0.68rem;
}

.settings-footer__actions {
  display: flex;
  align-items: center;
  gap: 0.3rem;
  margin-left: auto;
}

@media (max-width: 599px) {
  .settings-card {
    max-height: calc(100vh - 72px);
  }

  .settings-section {
    padding: 0.7rem 0.8rem;
  }

  .settings-bene-row {
    gap: 0.35rem;
    padding: 0.3rem 0.35rem;
  }

  .settings-bene-row__percent {
    flex-basis: 76px;
  }

  .settings-bene-add {
    grid-template-columns: minmax(0, 1fr) 84px;
  }

  .settings-bene-add .q-btn {
    grid-column: 1 / -1;
    justify-self: end;
  }

  .settings-footer {
    padding: 0.55rem 0.8rem 0.65rem;
  }
}
</style>
<script>
import { setHiveNode } from 'src/services/hive'
import { DEFAULT_HIVE_ENGINE_NODE, DEFAULT_MAGI_NODE, MAGI_NODES } from 'src/services/hiveNodes'
import { hiveAvatarUrl } from 'src/utils/avatar'

function weightToPercent (weight) {
  const value = Number(weight)
  return Number.isFinite(value) ? Math.round(value / 100) : 0
}

export default {
  name: 'settings',
  data () {
    return {
      voteWeightPost: Number(this.$hiveStore.user.settings.voteWeightPost) || 0,
      beneficiaries: (this.$hiveStore.user.settings.beneficiary || []).map(bene => ({
        account: bene.account,
        percent: weightToPercent(bene.weight)
      })),
      newBeneAccount: '',
      newBenePercent: 10,
      apiNode: this.$hiveStore.user.settings.apiNode || 'https://api.hive.blog',
      heApiNode: this.$hiveStore.user.settings.heApiNode || DEFAULT_HIVE_ENGINE_NODE,
      magiApiNode: this.$hiveStore.user.settings.magiApiNode || DEFAULT_MAGI_NODE,
      magiNodeOptions: [...MAGI_NODES],
      ahNode: this.$hiveStore.user.settings.ahNode || 'https://api.hive.blog',
      smartlockSessionMinutes: Number(this.$hiveStore.user.settings.smartlockSessionMinutes) || 15,
      smartlockTimeoutOptions: [
        { label: '5 minutes', value: 5 },
        { label: '15 minutes', value: 15 },
        { label: '30 minutes', value: 30 },
        { label: '60 minutes', value: 60 }
      ]
    }
  },
  computed: {
    voteColor () {
      if (this.voteWeightPost > 0) return 'green'
      if (this.voteWeightPost < 0) return 'red'
      return 'grey'
    },
    beneficiaryTotal () {
      return this.beneficiaries.reduce((total, bene) => {
        const value = Number(bene.percent)
        return total + (Number.isFinite(value) ? Math.max(0, value) : 0)
      }, 0)
    },
    canAddBene () {
      const account = this.newBeneAccount.trim()
      const percent = Number(this.newBenePercent)
      return /^[a-z][a-z0-9.-]{2,15}$/.test(account) &&
        !this.beneficiaries.some(bene => bene.account === account) &&
        Number.isFinite(percent) && percent > 0 && percent <= 100 &&
        this.beneficiaryTotal + percent <= 100
    }
  },
  methods: {
    avatarUrl (user) {
      return hiveAvatarUrl(user)
    },
    addBene () {
      if (!this.canAddBene) return
      this.beneficiaries.push({
        account: this.newBeneAccount.trim(),
        percent: Math.round(Number(this.newBenePercent))
      })
      this.newBeneAccount = ''
      this.newBenePercent = 10
    },
    removeBene (account) {
      this.beneficiaries = this.beneficiaries.filter(bene => bene.account !== account)
    },
    clampPercent (bene) {
      const value = Number(bene.percent)
      bene.percent = Number.isFinite(value) ? Math.min(100, Math.max(0, Math.round(value))) : 0
    },
    saveSettings () {
      this.beneficiaries.forEach(bene => this.clampPercent(bene))
      if (this.beneficiaryTotal > 100) {
        this.$q.notify({ type: 'negative', message: 'Beneficiary shares cannot total more than 100%.' })
        return
      }

      const voteWeight = Number(this.voteWeightPost)
      const settings = {
        voteWeightPost: Number.isFinite(voteWeight) ? Math.min(100, Math.max(-100, voteWeight)) : 0,
        beneficiary: this.beneficiaries.map(bene => ({
          account: bene.account,
          weight: Math.round(Number(bene.percent) * 100)
        })),
        apiNode: this.apiNode.trim() || 'https://api.hive.blog',
        ahNode: this.ahNode.trim() || 'https://api.hive.blog',
        heApiNode: this.heApiNode.trim() || DEFAULT_HIVE_ENGINE_NODE,
        magiApiNode: String(this.magiApiNode || '').trim() || DEFAULT_MAGI_NODE,
        smartlockSessionMinutes: Number(this.smartlockSessionMinutes) || 15
      }
      this.$hiveStore.updateSettings(settings)
      setHiveNode(settings.apiNode)
      this.$emit('hide')
    }
  }
}
</script>
