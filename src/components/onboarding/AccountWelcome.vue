<template>
  <q-banner v-if="open" class="account-welcome" rounded role="status" aria-live="polite" aria-label="Account onboarding">
    <div class="welcome-inner">
      <div class="welcome-head">
        <div>
          <div class="welcome-eyebrow">Welcome to Hive</div>
          <h2 class="welcome-title">@{{ loggedInUser }}</h2>
          <p class="welcome-copy">
            Your account is live. These setup steps are optional — your account already works
            without them.
          </p>
        </div>
        <q-btn flat dense no-caps color="primary" label="Not now" @click="close()" />
      </div>

      <div class="welcome-steps">
        <div v-if="needsProfile" class="welcome-step">
          <div class="welcome-step__icon"><q-icon name="person" size="22px" aria-hidden="true" /></div>
          <div class="welcome-step__body">
            <h3 class="welcome-step__title">Complete your profile</h3>
            <p class="welcome-step__copy">
              Add a display name, bio and profile images. Hive stores this in your posting
              metadata, signed with your posting key.
            </p>
            <q-btn no-caps outline color="primary" icon="edit" label="Open profile editor" @click="openProfile()" />
          </div>
        </div>

        <div v-if="needsSponsor" class="welcome-step">
          <div class="welcome-step__icon"><q-icon name="favorite" size="22px" aria-hidden="true" /></div>
          <div class="welcome-step__body">
            <h3 class="welcome-step__title">Support @{{ sponsor }}</h3>
            <p class="welcome-step__copy">
              @{{ sponsor }} sponsored this account. You can add a 5% default beneficiary for
              posts you publish in Banksia. It is only a default; you can remove it on any post,
              and other Hive apps may not use it.
            </p>
            <q-checkbox
              v-model="supportSponsor"
              :label="'Use @' + sponsor + ' as a 5% default beneficiary'"
              :disable="beneficiarySaved"
            />
            <div class="welcome-step__actions">
              <q-btn
                no-caps
                unelevated
                color="primary"
                icon="volunteer_activism"
                :label="beneficiarySaved ? 'Beneficiary saved' : 'Save 5% default'"
                :disable="!supportSponsor || beneficiarySaved"
                @click="saveSponsorBeneficiary()"
              />
            </div>
          </div>
        </div>
      </div>

      <div class="welcome-actions">
        <q-btn flat no-caps color="primary" label="Done" @click="close()" />
      </div>
    </div>
  </q-banner>
</template>

<script>
import { MAX_BENEFICIARIES, normalizeBeneficiaries } from 'src/services/drafts'
import {
  DEFAULT_SPONSOR_BENEFICIARY_WEIGHT,
  hasProfileMetadata,
  isNewAccount,
  onboardingSponsor
} from 'src/services/accountOnboarding'

const SEEN_KEY_PREFIX = 'banksia_onboarding_welcome_v1:'

export default {
  name: 'AccountWelcome',
  data () {
    return {
      open: false,
      needsProfile: false,
      needsSponsor: false,
      sponsor: '',
      supportSponsor: false,
      beneficiarySaved: false
    }
  },
  computed: {
    loggedInUser () {
      return this.$hiveStore.user.username
    },
    account () {
      return this.$hiveStore.accounts[this.loggedInUser] || null
    },
    settings () {
      return this.$hiveStore.user.settings || {}
    }
  },
  watch: {
    loggedInUser (value) {
      this.open = false
      this.needsProfile = false
      this.needsSponsor = false
      this.sponsor = ''
      this.supportSponsor = false
      this.beneficiarySaved = false
      if (value) this.maybeShow()
    },
    account () {
      this.maybeShow()
    }
  },
  mounted () {
    this.maybeShow()
  },
  methods: {
    seenKey (user = this.loggedInUser) {
      return SEEN_KEY_PREFIX + String(user || '').toLowerCase()
    },
    hasSeen (user = this.loggedInUser) {
      return this.$q.localStorage.getItem(this.seenKey(user)) === true
    },
    markSeen () {
      if (!this.loggedInUser) return
      this.$q.localStorage.set(this.seenKey(), true)
    },
    close () {
      this.markSeen()
      this.open = false
    },
    maybeShow () {
      const user = this.loggedInUser
      if (!user || this.open || this.hasSeen(user)) return
      const account = this.account
      if (!account) {
        this.$hiveStore.getAccount(user)
        return
      }

      const sponsor = onboardingSponsor(account.json_metadata, account.posting_json_metadata)
      const profileMissing = !hasProfileMetadata(account.posting_json_metadata) && !hasProfileMetadata(account.json_metadata)
      const newAccount = isNewAccount(account.created)
      if (!newAccount && !sponsor) return

      this.sponsor = sponsor
      this.needsProfile = profileMissing
      this.needsSponsor = Boolean(sponsor) && sponsor !== user.toLowerCase() && !this.hasBeneficiary(sponsor)
      this.beneficiarySaved = !this.needsSponsor
      this.supportSponsor = false
      this.open = this.needsProfile || this.needsSponsor
    },
    hasBeneficiary (account) {
      const list = normalizeBeneficiaries(this.settings.beneficiary || [])
      return list.some(item => item.account === account)
    },
    saveSponsorBeneficiary () {
      const sponsor = this.sponsor
      if (!sponsor || this.beneficiarySaved) return
      const current = normalizeBeneficiaries(this.settings.beneficiary || [])
      if (current.some(item => item.account === sponsor)) {
        this.beneficiarySaved = true
        return
      }
      if (current.length >= MAX_BENEFICIARIES) {
        this.$q.notify({
          message: 'You already have the maximum number of default beneficiaries. Remove one in Settings first.',
          color: 'orange',
          icon: 'info',
          position: 'top',
          timeout: 6000
        })
        return
      }
      const total = current.reduce((sum, item) => sum + item.weight, 0)
      if (total + DEFAULT_SPONSOR_BENEFICIARY_WEIGHT > 10000) {
        this.$q.notify({
          message: 'Your existing beneficiaries already use the full author reward. Adjust them in Settings first.',
          color: 'orange',
          icon: 'info',
          position: 'top',
          timeout: 6000
        })
        return
      }
      const beneficiary = [...current, {
        account: sponsor,
        weight: DEFAULT_SPONSOR_BENEFICIARY_WEIGHT
      }].sort((a, b) => a.account.localeCompare(b.account))
      this.$hiveStore.updateSettings({ ...this.settings, beneficiary })
      this.beneficiarySaved = true
      this.$q.notify({
        message: 'Added @' + sponsor + ' as a 5% default beneficiary for new Banksia posts.',
        color: 'green',
        icon: 'favorite',
        position: 'top',
        timeout: 5000
      })
    },
    openProfile () {
      const user = this.loggedInUser
      if (!user) return
      this.close()
      this.$router.push({ path: '/@' + user, query: { edit: 'posting' } }).catch(() => {})
    }
  }
}
</script>

<style scoped>
.account-welcome {
  margin: 0;
  border-bottom: 1px solid var(--c-border-subtle);
  border-radius: 0;
  background: var(--c-surface-2);
  color: var(--c-text);
}

.welcome-inner {
  width: min(1120px, 100%);
  margin: 0 auto;
  padding: var(--space-3) var(--space-4);
}

.welcome-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: var(--space-3);
  padding-bottom: var(--space-3);
}

.welcome-eyebrow {
  color: var(--c-text-faint);
  font-size: 0.68rem;
  letter-spacing: 0.07em;
  text-transform: uppercase;
}

.welcome-title {
  margin: 0.2rem 0 0.35rem;
  font-size: 1.45rem;
  font-weight: 600;
}

.welcome-copy {
  margin: 0;
  color: var(--c-text-subtle);
  font-size: 0.85rem;
  line-height: 1.55;
}

.welcome-steps {
  display: grid;
  gap: var(--space-4);
}

.welcome-step {
  display: flex;
  align-items: flex-start;
  gap: var(--space-3);
}

.welcome-step__icon {
  display: grid;
  place-items: center;
  flex: 0 0 auto;
  width: 40px;
  height: 40px;
  border-radius: 11px;
  color: var(--c-primary);
  background: color-mix(in srgb, var(--c-primary) 12%, transparent);
}

.welcome-step__body {
  min-width: 0;
}

.welcome-step__title {
  margin: 0 0 0.2rem;
  font-size: 0.98rem;
  font-weight: 600;
}

.welcome-step__copy {
  margin: 0 0 var(--space-2);
  color: var(--c-text-subtle);
  font-size: 0.82rem;
  line-height: 1.5;
}

.welcome-step__actions {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-2);
  margin-top: var(--space-2);
}

.welcome-actions {
  display: flex;
  justify-content: flex-end;
  margin-top: var(--space-3);
}

@media (max-width: 599px) {
  .welcome-step {
    gap: var(--space-2);
  }
}
</style>
