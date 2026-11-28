<template>
  <q-page class="blogs-page">
    <div class="blogs-shell">
      <section class="blogs-hero">
        <p class="blogs-eyebrow">Free Hive blogs</p>
        <h1 class="blogs-title">A blog that is already yours.</h1>
        <p class="blogs-lede">
          Every Hive account has a clean reading page at
          <code>username.banksia.io</code>: all your posts, none of the explorer
          chrome. Claim it free and share one link.
        </p>

        <div class="blogs-preview">
          <q-input
            v-model="usernameInput"
            outlined
            dense
            label="Your Hive username"
            placeholder="alice"
            prefix="@"
            class="blogs-preview__input"
            :error="Boolean(error)"
            :error-message="error"
            @keyup.enter="preview"
          />
          <q-btn unelevated no-caps color="primary" label="Preview blog" @click="preview" />
          <q-btn outline no-caps color="primary" label="Claim this blog" @click="claim" />
        </div>

        <p class="blogs-example">
          Not sure yet?
          <a href="https://asgarth.banksia.io" target="_blank" rel="noopener noreferrer">See a live blog</a>,
          <router-link to="/blogs/directory">browse the directory</router-link>
          or
          <router-link to="/settings/blog">open the claim page</router-link>.
        </p>
      </section>

      <section class="blogs-section">
        <div class="blogs-section__head">
          <h2>Three ways to read</h2>
          <p>Pick one, or reuse the profile skin you already published.</p>
        </div>
        <div class="blogs-themes">
          <article
            v-for="theme in themes"
            :key="theme.id"
            class="blogs-theme"
            :style="themeStyle(theme)"
          >
            <div class="blogs-theme__chrome" aria-hidden="true">
              <span></span><span></span><span></span>
            </div>
            <h3>{{ theme.name }}</h3>
            <p>{{ theme.mood }}</p>
            <div class="blogs-theme__lines" aria-hidden="true">
              <span></span><span></span><span></span>
            </div>
            <span class="blogs-theme__accent" aria-hidden="true"></span>
          </article>
        </div>
        <p class="blogs-note">Using “Match my profile skin” keeps the blog and your Hive profile in the same visual language.</p>
      </section>

      <section class="blogs-section">
        <div class="blogs-section__head">
          <h2>What is inside</h2>
          <p>Everything a reader needs. Nothing they do not.</p>
        </div>
        <ul class="blogs-features">
          <li>
            <strong>All your posts.</strong>
            Whatever app published them — Banksia, PeakD, Ecency, InLeo or a direct broadcast.
          </li>
          <li>
            <strong>Pinned “Start here” posts.</strong>
            Put an introduction, a project page or a best-of list in front of the archive.
          </li>
          <li>
            <strong>Team and community blogs.</strong>
            Add contributors or merge a Hive community feed into one reading surface.
          </li>
          <li>
            <strong>RSS, sitemap and link previews.</strong>
            Readers can follow the blog, and shared links show the real title and cover.
          </li>
          <li>
            <strong>Hive comments, votes and Lightning tips.</strong>
            Readers open the post on Banksia to interact; the blog stays clean and read-only.
          </li>
          <li>
            <strong>No account needed to read.</strong>
            No sign-in wall, no site-wide ranking, no lock-in. The posts live on Hive.
          </li>
        </ul>
      </section>

      <section class="blogs-section">
        <div class="blogs-section__head">
          <h2>Claim it in three steps</h2>
          <p>The whole flow is a normal posting-key metadata update.</p>
        </div>
        <ol class="blogs-steps">
          <li>
            <span class="blogs-steps__number">1</span>
            <div>
              <strong>Enter your Hive username.</strong>
              <p>No new account and no migration. Your public posts are already there.</p>
            </div>
          </li>
          <li>
            <span class="blogs-steps__number">2</span>
            <div>
              <strong>Claim with your posting key.</strong>
              <p>Keychain, HiveAuth or SmartLock signs a small blog object into your posting metadata.</p>
            </div>
          </li>
          <li>
            <span class="blogs-steps__number">3</span>
            <div>
              <strong>Share <code>username.banksia.io</code>.</strong>
              <p>Pick a theme, pin a few posts and put the link on a card, a profile or a business page.</p>
            </div>
          </li>
        </ol>
      </section>

      <section class="blogs-free">
        <div>
          <h2>Free forever. Memberships optional.</h2>
          <p>
            The free blog includes the reading surface, all your posts, five
            themes, profile-skin matching, pinned posts, contributors, RSS,
            sitemap and link previews. You can also sell members-only posts with
            Banksia Vault: set a price in HBD, get paid directly, and keep the
            content encrypted in the reader's browser. Banksia takes 0% and holds
            no funds. Custom domains and team features are planned.
          </p>
        </div>
        <q-btn unelevated no-caps color="primary" label="Claim your blog" to="/settings/blog" />
      </section>

      <section class="blogs-section">
        <div class="blogs-section__head">
          <h2>Questions</h2>
        </div>
        <dl class="blogs-faq">
          <dt>Do I need to move my posts?</dt>
          <dd>No. The blog reads the posts that are already on Hive. Publish from any app and they appear.</dd>
          <dt>Who holds my keys?</dt>
          <dd>You do. Claiming and editing use the posting key through your wallet. No server stores a key.</dd>
          <dt>How do paid memberships work?</dt>
          <dd>Readers pay you directly in HBD. Your browser encrypts the members-only part of a post, and each member's browser decrypts it with a key the payment granted. There is no platform fee and no escrow.</dd>
          <dt>Can I still publish free posts?</dt>
          <dd>Yes. Free and members-only posts live side by side, and every premium post keeps a public teaser for search and sharing.</dd>
          <dt>Can I use my own domain?</dt>
          <dd>Custom domains are planned. The free address is <code>username.banksia.io</code>.</dd>
          <dt>What happens if I stop using Banksia?</dt>
          <dd>Your posts stay on Hive and your profile metadata is portable. The blog is a reading surface, not a silo.</dd>
        </dl>
      </section>
    </div>
  </q-page>
</template>

<style scoped>
.blogs-page {
  background: var(--c-bg);
}

.blogs-shell {
  max-width: 1000px;
  margin: 0 auto;
  padding: 1.5rem 1.1rem 4rem;
  display: flex;
  flex-direction: column;
  gap: 3rem;
}

.blogs-hero {
  padding: 2.5rem 2rem;
  border: 1px solid var(--c-border);
  border-radius: 18px;
  background:
    radial-gradient(120% 140% at 100% 0%, color-mix(in srgb, var(--c-primary) 20%, transparent), transparent 55%),
    var(--c-surface);
}

.blogs-eyebrow {
  margin: 0 0 0.6rem;
  color: var(--c-primary);
  font-size: 0.76rem;
  font-weight: 700;
  letter-spacing: 0.14em;
  text-transform: uppercase;
}

.blogs-title {
  margin: 0;
  max-width: 18ch;
  font-size: clamp(2rem, 5vw, 3.4rem);
  line-height: 1.04;
  letter-spacing: -0.02em;
}

.blogs-lede {
  margin: 0.9rem 0 0;
  max-width: 62ch;
  color: var(--c-text-soft);
  font-size: 1.05rem;
  line-height: 1.65;
}

.blogs-lede code,
.blogs-steps code,
.blogs-faq code {
  padding: 0.05rem 0.3rem;
  border-radius: 4px;
  background: var(--c-surface-2);
  color: var(--c-text);
  font-size: 0.9em;
}

.blogs-preview {
  display: flex;
  align-items: flex-start;
  gap: 0.6rem;
  flex-wrap: wrap;
  margin-top: 1.5rem;
}

.blogs-preview__input {
  flex: 1;
  min-width: 14rem;
}

.blogs-example {
  margin: 0.8rem 0 0;
  color: var(--c-text-muted);
  font-size: 0.86rem;
}

.blogs-example a {
  color: var(--c-link);
}

.blogs-section {
  display: flex;
  flex-direction: column;
  gap: 1.1rem;
}

.blogs-section__head h2 {
  margin: 0;
  font-size: clamp(1.35rem, 2.6vw, 1.8rem);
  letter-spacing: -0.01em;
}

.blogs-section__head p {
  margin: 0.35rem 0 0;
  color: var(--c-text-muted);
}

.blogs-themes {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 1rem;
}

.blogs-theme {
  position: relative;
  padding: 1.1rem;
  border: 1px solid;
  border-radius: 14px;
  overflow: hidden;
  min-height: 13rem;
  display: flex;
  flex-direction: column;
}

.blogs-theme__chrome {
  display: flex;
  gap: 0.3rem;
  margin-bottom: 1.2rem;
  opacity: 0.6;
}

.blogs-theme__chrome span {
  width: 0.5rem;
  height: 0.5rem;
  border-radius: 50%;
  background: currentColor;
}

.blogs-theme h3 {
  margin: 0;
  font-size: 1.25rem;
}

.blogs-theme p {
  margin: 0.3rem 0 1rem;
  font-size: 0.86rem;
  opacity: 0.75;
}

.blogs-theme__lines {
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
  margin-top: auto;
  opacity: 0.45;
}

.blogs-theme__lines span {
  height: 0.4rem;
  border-radius: 999px;
  background: currentColor;
}

.blogs-theme__lines span:nth-child(2) { width: 78%; }
.blogs-theme__lines span:nth-child(3) { width: 52%; }

.blogs-theme__accent {
  position: absolute;
  right: -1.5rem;
  bottom: -1.5rem;
  width: 5rem;
  height: 5rem;
  border-radius: 50%;
  background: var(--theme-accent);
  opacity: 0.35;
}

.blogs-note {
  margin: 0;
  color: var(--c-text-muted);
  font-size: 0.86rem;
}

.blogs-features {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0.9rem 1.4rem;
  margin: 0;
  padding: 0;
  list-style: none;
}

.blogs-features li {
  position: relative;
  padding-left: 1.5rem;
  color: var(--c-text-muted);
  line-height: 1.6;
  font-size: 0.94rem;
}

.blogs-features li::before {
  content: '✓';
  position: absolute;
  left: 0;
  top: 0;
  color: var(--c-positive);
  font-weight: 700;
}

.blogs-features strong {
  display: block;
  color: var(--c-text);
}

.blogs-steps {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  margin: 0;
  padding: 0;
  list-style: none;
}

.blogs-steps li {
  display: flex;
  gap: 0.9rem;
  align-items: flex-start;
  padding: 1rem 1.1rem;
  border: 1px solid var(--c-border);
  border-radius: 12px;
  background: var(--c-surface);
}

.blogs-steps__number {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 2rem;
  height: 2rem;
  flex: none;
  border-radius: 50%;
  background: var(--c-primary);
  color: var(--c-on-primary);
  font-weight: 700;
}

.blogs-steps strong {
  display: block;
}

.blogs-steps p {
  margin: 0.2rem 0 0;
  color: var(--c-text-muted);
  font-size: 0.9rem;
}

.blogs-free {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1.25rem 2rem;
  flex-wrap: wrap;
  padding: 1.6rem 1.8rem;
  border: 1px solid var(--c-border);
  border-left: 3px solid var(--c-primary);
  border-radius: 14px;
  background: var(--c-surface-2);
}

.blogs-free h2 {
  margin: 0;
  font-size: 1.3rem;
}

.blogs-free p {
  margin: 0.45rem 0 0;
  max-width: 66ch;
  color: var(--c-text-muted);
  line-height: 1.6;
}

.blogs-faq {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 1.4fr);
  gap: 0.75rem 1.5rem;
  margin: 0;
}

.blogs-faq dt {
  font-weight: 600;
  padding-top: 0.55rem;
}

.blogs-faq dd {
  margin: 0;
  padding: 0.55rem 0;
  border-top: 1px solid var(--c-border-subtle);
  color: var(--c-text-muted);
  line-height: 1.6;
}

@media (max-width: 820px) {
  .blogs-themes {
    grid-template-columns: minmax(0, 1fr);
  }

  .blogs-features {
    grid-template-columns: minmax(0, 1fr);
  }

  .blogs-faq {
    grid-template-columns: minmax(0, 1fr);
  }

  .blogs-faq dd {
    border-top: 0;
    padding-top: 0;
  }
}

@media (max-width: 599px) {
  .blogs-hero {
    padding: 1.5rem 1.1rem;
  }

  .blogs-shell {
    padding: 1rem 0.75rem 3rem;
    gap: 2.25rem;
  }

  .blogs-preview {
    flex-direction: column;
    align-items: stretch;
  }
}
</style>

<script>
import { setPageMeta } from 'src/utils/pageMeta'
import { blogBaseUrl, isValidHiveAccountName } from 'src/services/blogHost'
import { BLOG_THEMES } from 'src/themes/blogThemes'

export default {
  name: 'BlogsPage',
  data () {
    return {
      usernameInput: '',
      error: '',
      themes: BLOG_THEMES
    }
  },
  computed: {
    username () {
      return String(this.usernameInput || '')
        .trim()
        .toLowerCase()
        .replace(/^@+/, '')
    }
  },
  mounted () {
    setPageMeta({
      title: 'Free Hive blogs — banksia.io',
      description: 'Every Hive account has a clean reading page at username.banksia.io. All your posts, three themes, RSS and link previews. Claim it free.',
      url: '/blogs',
      type: 'website',
      jsonLd: {
        '@context': 'https://schema.org',
        '@type': 'WebPage',
        name: 'Free Hive blogs on Banksia',
        description: 'Every Hive account has a clean reading page at username.banksia.io. Claim it free.',
        url: 'https://banksia.io/blogs'
      }
    })
  },
  methods: {
    themeStyle (theme) {
      return {
        background: theme.tokens.bg,
        color: theme.tokens.text,
        borderColor: theme.tokens.border,
        '--theme-accent': theme.tokens.primary
      }
    },
    validate () {
      this.error = ''
      if (!this.username) {
        this.error = 'Enter a Hive username first.'
        return false
      }
      if (!isValidHiveAccountName(this.username)) {
        this.error = 'That does not look like a Hive account name.'
        return false
      }
      return true
    },
    preview () {
      if (!this.validate()) return
      const url = blogBaseUrl(this.username)
      if (url) window.open(url, '_blank', 'noopener')
    },
    claim () {
      if (!this.validate()) return
      this.$router.push({ path: '/settings/blog', query: { account: this.username } })
    }
  }
}
</script>
