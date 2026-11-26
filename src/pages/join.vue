<template>
  <q-page class="join-page">
    <div class="join-shell">
      <page-header
        eyebrow="Join Hive"
        title="Create your Hive account"
        intro="Hive accounts are created by existing accounts. Choose a provider for a free or paid instant account, or create your keys and share a claim link with someone who can sponsor you."
      >
        <template #actions>
          <q-btn no-caps outline color="primary" icon="key" label="Create keys & claim link" to="/join/keys" />
          <q-btn no-caps outline color="primary" icon="paid" label="Buy with crypto" to="/join/hivedex" />
          <q-btn no-caps flat color="primary" icon="login" label="I already have an account" to="/create" />
        </template>
      </page-header>

      <section class="join-paths" aria-label="Choose how to join">
        <router-link to="/join/keys" class="join-path">
          <div class="join-path__icon"><q-icon name="key" size="26px" aria-hidden="true" /></div>
          <div>
            <div class="join-path__eyebrow">Free with a sponsor</div>
            <h2 class="join-path__title">Create your keys first</h2>
            <p class="join-path__copy">
              Generate your password and keys in this browser. Keep them private and share a
              claim link containing only your public keys. A sponsor creates the account.
            </p>
          </div>
          <q-icon name="arrow_forward" size="20px" aria-hidden="true" />
        </router-link>

        <router-link to="/create" class="join-path">
          <div class="join-path__icon"><q-icon name="group_add" size="26px" aria-hidden="true" /></div>
          <div>
            <div class="join-path__eyebrow">Already on Hive</div>
            <h2 class="join-path__title">Create an account for someone</h2>
            <p class="join-path__copy">
              Use an account token or 3 HIVE to create an account and hand over the keys.
              Best when you can give the new owner their backup securely in person.
            </p>
          </div>
          <q-icon name="arrow_forward" size="20px" aria-hidden="true" />
        </router-link>
      </section>

      <section class="join-section" aria-labelledby="join-providers">
        <div class="join-section__head">
          <div>
            <div class="join-eyebrow">Verified providers</div>
            <h2 id="join-providers" class="join-title">Get an account from a provider</h2>
          </div>
          <span class="join-verified">Checked 26 Nov 2026</span>
        </div>

        <div class="join-provider-grid">
          <q-card v-for="provider in providers" :key="provider.id" flat bordered class="join-provider">
            <q-card-section class="join-provider__body">
              <div class="join-provider__head">
                <div class="join-provider__icon" :style="{ '--provider-accent': provider.accent }">
                  <q-icon :name="provider.icon" size="24px" aria-hidden="true" />
                </div>
                <div class="join-provider__ident">
                  <h3 class="join-provider__name">{{ provider.name }}</h3>
                  <span class="join-provider__badge">{{ provider.badge }}</span>
                </div>
              </div>

              <div class="join-provider__price">
                {{ provider.id === 'hivedex' ? '$' + hivedexPrice : provider.price }}
                <span v-if="provider.id === 'hivedex' && !hivedexLive" class="join-provider__fallback" title="The live price could not be loaded; this is the last known value.">last known</span>
              </div>

              <p class="join-provider__copy">{{ provider.description }}</p>

              <dl class="join-provider__facts">
                <div><dt>Speed</dt><dd>{{ provider.speed }}</dd></div>
                <div><dt>Verification</dt><dd>{{ provider.verification }}</dd></div>
                <div><dt>Keys</dt><dd>{{ provider.keys }}</dd></div>
              </dl>
            </q-card-section>
            <q-card-actions class="join-provider__actions">
              <q-btn
                v-if="provider.id === 'hivedex'"
                no-caps
                unelevated
                color="primary"
                icon="paid"
                label="Pay with crypto here"
                to="/join/hivedex"
                class="join-provider__cta"
              />
              <q-btn
                no-caps
                :unelevated="provider.id !== 'hivedex'"
                :outline="provider.id === 'hivedex'"
                color="primary"
                :label="provider.id === 'hivedex' ? 'hivedex.io' : 'Open ' + provider.name"
                :href="provider.url"
                target="_blank"
                rel="noopener noreferrer"
                :icon-right="provider.id === 'hivedapps' ? '' : 'open_in_new'"
                class="join-provider__cta"
              />
            </q-card-actions>
          </q-card>
        </div>

        <p class="join-note">
          These are independent community services; Banksia does not operate them. Free accounts
          require verification and can be paused. Paid accounts usually require no verification.
          Always download and store the keys the provider gives you.
        </p>
      </section>

      <section class="join-section join-secondary" aria-label="More ways to join">
        <q-card flat bordered class="join-claim-card">
          <q-card-section>
            <div class="join-eyebrow">Already have a claim link?</div>
            <h2 class="join-title">Finish creating the account</h2>
            <p class="join-card__copy">
              A claim link contains a new account's username and public keys. Sign in with a Hive
              account that has an account token or enough HIVE, and you can create it.
            </p>
          </q-card-section>
          <q-card-actions class="join-claim-card__actions">
            <q-btn no-caps outline color="primary" icon="link" label="Open a claim link" to="/create/claim" />
          </q-card-actions>
        </q-card>

        <q-card flat bordered class="join-claim-card">
          <q-card-section>
            <div class="join-eyebrow">Other options</div>
            <h2 class="join-title">Compare every provider</h2>
            <p class="join-card__copy">
              The official Hive signup directory lists community providers with their current
              terms. Check the link and the provider's reputation before paying or sharing anything.
            </p>
          </q-card-section>
          <q-card-actions class="join-claim-card__actions">
            <q-btn
              no-caps
              outline
              color="primary"
              icon="open_in_new"
              label="Open signup.hive.io"
              href="https://signup.hive.io/"
              target="_blank"
              rel="noopener noreferrer"
            />
          </q-card-actions>
        </q-card>
      </section>

      <section class="join-explain" aria-labelledby="join-explain-title">
        <h2 id="join-explain-title" class="join-title">Before you choose</h2>
        <div class="join-explain__grid">
          <div>
            <h3>Your keys are the account</h3>
            <p>Hive has no password reset. Download the master password and keys, keep them offline, and never paste them into a website that did not generate them.</p>
          </div>
          <div>
            <h3>Who pays</h3>
            <p>Creating an account burns 3 HIVE or uses one account token. A provider or a sponsor pays that cost; the new account owner should not send private keys to anyone.</p>
          </div>
          <div>
            <h3>Who can recover it</h3>
            <p>The account creator becomes the recovery account by default. Ask your sponsor who that is; you can change it later with your owner key after the 30-day delay.</p>
          </div>
        </div>
      </section>
    </div>
  </q-page>
</template>

<script>
import { setPageMeta } from 'src/utils/pageMeta'
import PageHeader from 'components/ui/PageHeader.vue'

const HIDEDEX_PRICE_FALLBACK = '0.49'

export default {
  name: 'joinHivePage',
  components: { PageHeader },
  data () {
    return {
      hivedexPrice: HIDEDEX_PRICE_FALLBACK,
      hivedexLive: false,
      providers: [
        {
          id: 'ecency',
          name: 'Ecency',
          badge: 'Free',
          icon: 'mail',
          accent: 'var(--c-primary)',
          price: 'Free',
          speed: 'Instant',
          verification: 'Email + extra checks',
          keys: 'Provider-assisted',
          description: 'Email signup with extra verification for the free account. Also offers a paid in-app option with perks.',
          url: 'https://ecency.com/signup?referral=ausbitbank'
        },
        {
          id: 'hivedex',
          name: 'Hivedex',
          badge: 'Paid',
          icon: 'currency_bitcoin',
          accent: 'var(--c-warning)',
          price: 'from $0.49',
          speed: 'Instant',
          verification: 'No verification',
          keys: 'Generated in your browser',
          description: 'Anonymous account creation paid with crypto. The site only receives your public keys.',
          url: 'https://hivedex.io/signup'
        },
        {
          id: 'hivedapps',
          name: 'HiveDapps',
          badge: 'Community',
          icon: 'groups',
          accent: 'var(--c-positive)',
          price: 'Free',
          speed: 'Delayed',
          verification: 'Community sponsor',
          keys: 'Generated in your browser',
          description: 'Create your keys, then share a link with a Hive member who has an account token to create the account.',
          url: 'https://hivedapps.com'
        },
        {
          id: 'actifit',
          name: 'Actifit',
          badge: 'Fitness',
          icon: 'directions_run',
          accent: 'var(--c-secondary)',
          price: '$2 in HIVE',
          speed: 'Instant',
          verification: 'No verification',
          keys: 'Generated in your browser',
          description: 'Fitness app onboarding. Best if you already hold HIVE and want the Actifit/AFIT experience.',
          url: 'https://actifit.io/signup'
        }
      ]
    }
  },
  mounted () {
    setPageMeta({
      title: 'Join Hive — create a Hive account',
      description: 'Create a Hive account with a trusted provider, or generate your keys and share a public-key-only claim link with a sponsor. Compare free, paid and community options.',
      url: '/join'
    })
    this.loadHivedexPrice()
  },
  methods: {
    async loadHivedexPrice () {
      const controller = new AbortController()
      const timer = setTimeout(() => controller.abort(), 6000)
      try {
        const response = await fetch('https://api2.hivedex.io/price', {
          signal: controller.signal,
          headers: { Accept: 'application/json' }
        })
        if (!response.ok) return
        const data = await response.json()
        const price = Number(data?.price)
        if (Number.isFinite(price) && price > 0) {
          this.hivedexPrice = price.toFixed(2)
          this.hivedexLive = true
        }
      } catch {
        // Keep the last-known fallback; the card labels it as such.
      } finally {
        clearTimeout(timer)
      }
    }
  }
}
</script>

<style scoped>
.join-page {
  padding: var(--space-5) var(--space-4) var(--space-6);
}

.join-shell {
  width: min(1120px, 100%);
  margin: 0 auto;
}

.join-paths {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
  gap: var(--space-4);
  margin: var(--space-5) 0 var(--space-6);
}

.join-path {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) auto;
  align-items: start;
  gap: var(--space-3);
  padding: var(--space-4);
  border: 1px solid var(--c-border);
  border-radius: var(--radius-card);
  background:
    linear-gradient(145deg, color-mix(in srgb, var(--c-primary) 10%, transparent), transparent 55%),
    var(--c-card);
  color: inherit;
  text-decoration: none;
  transition: border-color 0.16s ease, transform 0.16s ease, background 0.16s ease;
}

.join-path:hover {
  border-color: color-mix(in srgb, var(--c-primary) 45%, var(--c-border));
  background:
    linear-gradient(145deg, color-mix(in srgb, var(--c-primary) 15%, transparent), transparent 55%),
    var(--c-card);
  transform: translateY(-1px);
}

.join-path__icon {
  display: grid;
  place-items: center;
  width: 46px;
  height: 46px;
  border-radius: 12px;
  color: var(--c-primary);
  background: color-mix(in srgb, var(--c-primary) 12%, transparent);
}

.join-path__eyebrow,
.join-eyebrow {
  color: var(--c-text-faint);
  font-size: 0.68rem;
  letter-spacing: 0.07em;
  text-transform: uppercase;
}

.join-path__title {
  margin: 0.15rem 0 0.35rem;
  font-size: 1.08rem;
  font-weight: 600;
}

.join-path__copy {
  margin: 0;
  color: var(--c-text-subtle);
  font-size: 0.85rem;
  line-height: 1.5;
}

.join-section {
  margin-top: var(--space-6);
}

.join-section__head {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: var(--space-3);
  flex-wrap: wrap;
  margin-bottom: var(--space-3);
}

.join-title {
  margin: 0.2rem 0 0;
  font-size: 1.25rem;
  font-weight: 600;
}

.join-verified {
  color: var(--c-text-faint);
  font-size: 0.72rem;
  font-variant-numeric: tabular-nums;
}

.join-provider-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
  gap: var(--space-4);
}

.join-provider {
  display: flex;
  flex-direction: column;
  background: var(--c-card);
}

.join-provider__body {
  flex: 1;
}

.join-provider__head {
  display: flex;
  align-items: center;
  gap: var(--space-3);
}

.join-provider__icon {
  display: grid;
  place-items: center;
  width: 42px;
  height: 42px;
  border-radius: 11px;
  color: var(--provider-accent, var(--c-primary));
  background: color-mix(in srgb, var(--provider-accent, var(--c-primary)) 12%, transparent);
}

.join-provider__name {
  margin: 0;
  font-size: 1rem;
  font-weight: 600;
}

.join-provider__badge {
  display: inline-block;
  margin-top: 2px;
  color: var(--c-text-faint);
  font-size: 0.68rem;
  letter-spacing: 0.04em;
  text-transform: uppercase;
}

.join-provider__price {
  margin: var(--space-3) 0 var(--space-2);
  font-size: 1.35rem;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
}

.join-provider__fallback {
  display: inline-block;
  margin-left: 0.35rem;
  color: var(--c-text-faint);
  font-size: 0.68rem;
  font-weight: 400;
  vertical-align: middle;
}

.join-provider__copy {
  margin: 0 0 var(--space-3);
  color: var(--c-text-subtle);
  font-size: 0.82rem;
  line-height: 1.5;
}

.join-provider__facts {
  display: grid;
  gap: 0.35rem;
  margin: 0;
  font-size: 0.78rem;
}

.join-provider__facts div {
  display: flex;
  justify-content: space-between;
  gap: var(--space-2);
  border-top: 1px solid var(--c-border-subtle);
  padding-top: 0.35rem;
}

.join-provider__facts dt {
  color: var(--c-text-faint);
}

.join-provider__facts dd {
  margin: 0;
  color: var(--c-text);
  text-align: right;
}

.join-provider__actions {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  padding: 0 var(--space-4) var(--space-4);
}

.join-provider__cta {
  width: 100%;
}

.join-note {
  margin: var(--space-3) 0 0;
  color: var(--c-text-faint);
  font-size: 0.75rem;
  line-height: 1.5;
}

.join-secondary {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
  gap: var(--space-4);
}

.join-claim-card {
  background: var(--c-card);
}

.join-card__copy {
  margin: 0;
  color: var(--c-text-subtle);
  font-size: 0.85rem;
  line-height: 1.55;
}

.join-claim-card__actions {
  padding: 0 var(--space-4) var(--space-4);
}

.join-explain {
  margin-top: var(--space-6);
  padding-top: var(--space-4);
  border-top: 1px solid var(--c-border-subtle);
}

.join-explain__grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
  gap: var(--space-4);
  margin-top: var(--space-3);
}

.join-explain h3 {
  margin: 0 0 0.3rem;
  font-size: 0.92rem;
  font-weight: 600;
}

.join-explain p {
  margin: 0;
  color: var(--c-text-subtle);
  font-size: 0.82rem;
  line-height: 1.55;
}

@media (max-width: 599px) {
  .join-page {
    padding: var(--space-4) var(--space-3) var(--space-5);
  }

  .join-path {
    grid-template-columns: auto minmax(0, 1fr);
  }

  .join-path > .q-icon:last-child {
    display: none;
  }
}
</style>
