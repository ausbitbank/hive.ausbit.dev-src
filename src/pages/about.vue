<template>
  <q-page class="about-page">
    <div class="about-shell">
      <page-header
        eyebrow="About"
        title="Banksia"
        intro="A fast, local-first explorer, wallet and creator toolkit for the Hive blockchain — and the story behind the name."
      >
        <template #actions>
          <q-btn no-caps outline color="primary" icon="explore" label="Explore Hive" to="/created" />
          <q-btn
            no-caps
            outline
            color="primary"
            icon="code"
            label="Source on GitHub"
            :href="brand.repoUrl"
            target="_blank"
            rel="noopener noreferrer"
          />
        </template>
      </page-header>

      <section class="about-hero" aria-labelledby="about-tagline">
        <img
          class="about-hero__mark"
          src="/statics/app-logo-128x128.png"
          alt=""
          width="96"
          height="96"
        />
        <div class="about-hero__text">
          <p class="about-kicker">Banksia · banksia.io</p>
          <p id="about-tagline" class="about-tagline">Rooted in Hive.</p>
          <p class="about-hero__copy">
            One interface for the whole chain: blocks, accounts, posts, communities,
            governance, markets, wallets, layer-2 data and Lightning.
          </p>
        </div>
      </section>

      <section class="about-section" aria-labelledby="about-what">
        <h2 id="about-what" class="about-title">What Banksia is</h2>
        <div class="about-pitch">
          <p>
            Banksia is a fast, local-first explorer, wallet and creator toolkit for the Hive
            blockchain. It brings blocks, transactions, accounts, authorities, posts, communities,
            governance, markets and layer-2 data into one interface, reading directly from public
            Hive JSON-RPC, bridge/Hivemind, Hive-Engine, Magi and v4v.app APIs.
          </p>
          <p>
            Most of Banksia works without an account. There is no site-wide ban list, no
            site-controlled feed ranking and no required sign-up. Reads are cached locally and fail
            over between API nodes, so a slow or dead node does not become a dead page.
          </p>
          <p>
            When you sign in, keys stay under your control through Hive Keychain, HiveAuth on a
            mobile wallet or the built-in SmartLock. Posting and active actions are separated,
            reviewed and queued. The active key is never held in memory, and SmartLock keeps
            encrypted keys in the browser until you unlock them.
          </p>
          <p>
            Banksia is also a working creator and trader surface. The composer supports autosaved
            drafts, history, media embeds, snippets, templates, checklists and cross-posting. The
            wallet covers HIVE, HBD, Hive Power, savings, Hive-Engine tokens, the internal market,
            HBD peg tools and a tax-friendly CSV export. Discovery covers a public community
            browser, five short-form formats and Lightning tips. A unified search
            spans accounts, posts, tags, communities, blocks, transactions, proposals, witnesses and
            Lightning invoices, with saved searches and optional semantic post search.
          </p>
          <p>
            Governance covers witnesses, proxies, vote-weight calculation, DHF proposals and funding
            outlook. Personal state stays in your browser: dashboard layouts, drafts, themes, saved
            searches and moderation policy. Moderation is explainable and overridable, never hidden.
          </p>
          <p>
            Banksia is free, open source under the Unlicense, mobile-friendly, keyboard-friendly and
            built for people who use Hive every day: exploring a block, publishing a post, checking a
            witness, moderating a community or moving value.
          </p>
        </div>
      </section>

      <section class="about-section" aria-labelledby="about-name">
        <h2 id="about-name" class="about-title">The name and the mark</h2>
        <div class="about-grid">
          <q-card flat bordered class="about-card">
            <div class="about-card__media">
              <img
                class="about-card__illustration"
                src="/statics/banksia-flower.svg"
                alt="A banksia flower spike with serrated leaves"
                width="640"
                height="360"
                loading="lazy"
              />
            </div>
            <q-card-section>
              <h3 class="about-card__title">A banksia</h3>
              <p class="about-card__copy">
                Banksia is a genus of roughly 170 Australian wildflowers, named for Joseph Banks,
                the botanist on the <em>Endeavour</em>. Its flower spikes are rich in nectar; its
                woody cones survive fire and feed the next generation of birds and bees.
              </p>
            </q-card-section>
          </q-card>

          <q-card flat bordered class="about-card">
            <div class="about-card__media">
              <img
                class="about-card__mark"
                src="/statics/app-logo-128x128.png"
                alt=""
                width="76"
                height="76"
                aria-hidden="true"
              />
            </div>
            <q-card-section>
              <h3 class="about-card__title">The mark</h3>
              <p class="about-card__copy">
                A banksia flower spike built from honeycomb cells, inside a comb cell. The spike is
                the plant; the hex is the hive; the honeycomb pattern is the chain's data. It is
                drawn in Hive red so the app reads as part of the Hive family without reusing the
                Hive logo.
              </p>
            </q-card-section>
          </q-card>

          <q-card flat bordered class="about-card">
            <div class="about-card__media about-card__media--tagline" aria-hidden="true">
              <span>Rooted in Hive.</span>
            </div>
            <q-card-section>
              <h3 class="about-card__title">Rooted in Hive</h3>
              <p class="about-card__copy">
                The tagline is both literal and local: the banksia is rooted in Australian soil, and
                the app is rooted in Hive's public chain. It also says what the engineering aims
                for — survive a dead node, keep working, come back.
              </p>
            </q-card-section>
          </q-card>
        </div>
      </section>

      <section class="about-section" aria-labelledby="about-principles">
        <h2 id="about-principles" class="about-title">What it stands for</h2>
        <div class="about-grid about-grid--principles">
          <q-card flat bordered class="about-card">
            <q-card-section>
              <q-icon name="visibility" size="24px" class="about-card__icon" aria-hidden="true" />
              <h3 class="about-card__title">Local-first</h3>
              <p class="about-card__copy">
                Dashboards, drafts, themes, saved searches and moderation policy live in your
                browser. No account is required to explore.
              </p>
            </q-card-section>
          </q-card>

          <q-card flat bordered class="about-card">
            <q-card-section>
              <q-icon name="key" size="24px" class="about-card__icon" aria-hidden="true" />
              <h3 class="about-card__title">Keys stay yours</h3>
              <p class="about-card__copy">
                Keychain, HiveAuth or the built-in SmartLock. Posting and active actions are
                separated, reviewed and queued; the active key is never kept in memory.
              </p>
            </q-card-section>
          </q-card>

          <q-card flat bordered class="about-card">
            <q-card-section>
              <q-icon name="shield" size="24px" class="about-card__icon" aria-hidden="true" />
              <h3 class="about-card__title">Explainable moderation</h3>
              <p class="about-card__copy">
                No hidden global ban list. Decisions name their source, and you can override them
                locally. Local-first means the policy is yours to inspect.
              </p>
            </q-card-section>
          </q-card>

          <q-card flat bordered class="about-card">
            <q-card-section>
              <q-icon name="code" size="24px" class="about-card__icon" aria-hidden="true" />
              <h3 class="about-card__title">Open source</h3>
              <p class="about-card__copy">
                Free under the Unlicense. The source, issues and release notes are public, and the
                app is built by <router-link to="/@ausbitbank">@ausbitbank</router-link>.
              </p>
            </q-card-section>
          </q-card>
        </div>
      </section>

      <section class="about-section about-source" aria-labelledby="about-source">
        <h2 id="about-source" class="about-title">Source and license</h2>
        <p class="about-source__copy">
          Banksia is free and open source under the Unlicense. The full source, issue tracker and
          release notes live on GitHub. The app reads public Hive APIs and is not affiliated with
          or endorsed by the Hive blockchain's core team.
        </p>
        <div class="about-links">
          <q-btn
            no-caps
            color="primary"
            icon="code"
            label="View source on GitHub"
            :href="brand.repoUrl"
            target="_blank"
            rel="noopener noreferrer"
          />
          <q-btn
            no-caps
            outline
            color="primary"
            icon="description"
            label="Read the license"
            :href="brand.repoUrl + '/blob/master/LICENSE'"
            target="_blank"
            rel="noopener noreferrer"
          />
          <q-btn
            no-caps
            flat
            color="primary"
            icon="public"
            label="Powered by Hive"
            href="https://hive.io"
            target="_blank"
            rel="noopener noreferrer"
          />
        </div>
      </section>
    </div>
  </q-page>
</template>

<script>
import PageHeader from 'components/ui/PageHeader.vue'
import { BRAND } from 'src/config/brand'
import { setPageMeta } from 'src/utils/pageMeta'

export default {
  name: 'AboutPage',
  components: { PageHeader },
  data () {
    return { brand: BRAND }
  },
  mounted () {
    setPageMeta({
      title: 'About Banksia — a Hive explorer, wallet and creator toolkit',
      description: 'The story behind Banksia: a fast, local-first Hive explorer, wallet and creator toolkit. Why the app is named for the Australian banksia, what the mark means, the design principles and where the source lives.',
      url: '/about',
      image: '/statics/og-banksia.png',
      jsonLd: {
        '@context': 'https://schema.org',
        '@type': 'AboutPage',
        name: 'About Banksia',
        description: 'The story behind Banksia, a fast, local-first explorer, wallet and creator toolkit for the Hive blockchain.',
        url: BRAND.url + '/about',
        mainEntity: {
          '@type': 'SoftwareApplication',
          name: BRAND.name,
          applicationCategory: 'FinanceApplication',
          operatingSystem: 'Web',
          url: BRAND.url + '/',
          description: BRAND.description,
          license: 'https://unlicense.org/',
          sameAs: [BRAND.repoUrl]
        }
      }
    })
  }
}
</script>

<style scoped>
.about-page {
  min-width: 0;
  padding-bottom: var(--space-6);
}

.about-shell {
  width: 100%;
  max-width: 1100px;
  margin: 0 auto;
  padding: var(--space-5) var(--space-4) var(--space-6);
}

.about-hero {
  display: flex;
  align-items: center;
  gap: var(--space-4);
  margin: var(--space-2) 0 var(--space-5);
  padding: var(--space-4);
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-card);
  background: var(--c-card);
}

.about-hero__mark {
  flex: none;
  width: 96px;
  height: 96px;
  border-radius: 22px;
  box-shadow: var(--shadow-card);
}

.about-hero__text {
  min-width: 0;
}

.about-kicker {
  margin: 0;
  color: var(--c-text-faint);
  font-size: 0.68rem;
  font-weight: 600;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.about-tagline {
  margin: 0.15rem 0 0.3rem;
  color: var(--c-text-strong);
  font-size: clamp(1.8rem, 5vw, 3rem);
  font-weight: 700;
  letter-spacing: -0.03em;
  line-height: 1.05;
}

.about-hero__copy {
  max-width: 720px;
  margin: 0;
  color: var(--c-text-subtle);
  font-size: 0.95rem;
  line-height: 1.6;
}

.about-section {
  margin-top: var(--space-6);
}

.about-title {
  margin: 0 0 var(--space-3);
  color: var(--c-text);
  font-size: 1.2rem;
  font-weight: 600;
  letter-spacing: -0.01em;
}

.about-pitch {
  max-width: 760px;
}

.about-pitch p {
  margin: 0 0 1rem;
  color: var(--c-text-soft);
  font-size: 0.95rem;
  line-height: 1.75;
}

.about-pitch p:last-child {
  margin-bottom: 0;
}

.about-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(min(100%, 260px), 1fr));
  gap: var(--space-3);
}

.about-grid--principles {
  grid-template-columns: repeat(4, minmax(0, 1fr));
}

@media (max-width: 900px) {
  .about-grid--principles {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

.about-card {
  height: 100%;
  overflow: hidden;
}

.about-card__media {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  height: 132px;
  overflow: hidden;
  background: var(--c-bg-deep);
}

.about-card__illustration {
  display: block;
  width: 100%;
  height: 100%;
  object-fit: cover;
  object-position: center 40%;
}

.about-card__mark {
  display: block;
  width: 96px;
  height: 96px;
}

.about-card__media--tagline::before {
  content: "";
  position: absolute;
  inset: 0;
  background-image: url('/statics/banksia-pattern.svg');
  background-size: 78px;
  opacity: 0.2;
}

.about-card__media--tagline span {
  position: relative;
  z-index: 1;
  color: var(--c-secondary);
  font-size: 1.25rem;
  font-weight: 700;
  letter-spacing: -0.02em;
  text-align: center;
  padding: 0 var(--space-3);
}

.about-card__icon {
  color: var(--c-secondary);
}

.about-card__title {
  margin: 0.55rem 0 0.35rem;
  color: var(--c-text);
  font-size: 1rem;
  font-weight: 600;
}

.about-card__copy {
  margin: 0;
  color: var(--c-text-subtle);
  font-size: 0.88rem;
  line-height: 1.65;
}

.about-card__copy a {
  color: var(--c-primary);
}

.about-source {
  padding-top: var(--space-4);
  border-top: 1px solid var(--border-subtle);
}

.about-source__copy {
  max-width: 760px;
  margin: 0 0 var(--space-3);
  color: var(--c-text-subtle);
  font-size: 0.9rem;
  line-height: 1.7;
}

.about-links {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-2);
}

@media (max-width: 599px) {
  .about-shell {
    padding: var(--space-3) var(--space-2) var(--space-5);
  }

  .about-hero {
    align-items: flex-start;
    flex-direction: column;
    padding: var(--space-3);
  }

  .about-hero__mark {
    width: 72px;
    height: 72px;
    border-radius: 18px;
  }

  .about-links .q-btn {
    flex: 1 1 100%;
  }

  .about-grid--principles {
    grid-template-columns: 1fr;
  }
}
</style>
