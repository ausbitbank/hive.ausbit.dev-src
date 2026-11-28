<template>
  <section
    v-if="price"
    id="membership"
    class="blog-membership"
    aria-labelledby="blog-membership-title"
  >
    <div class="blog-membership__copy">
      <p class="blog-membership__kicker">
        <q-icon name="lock" size="14px" aria-hidden="true" />
        Membership
      </p>
      <h2 id="blog-membership-title" class="blog-membership__title">{{ heading }}</h2>
      <p class="blog-membership__lede">{{ lede }}</p>

      <ul v-if="benefits.length" class="blog-membership__benefits">
        <li v-for="benefit in benefits" :key="benefit">
          <q-icon name="check" size="14px" aria-hidden="true" />
          {{ benefit }}
        </li>
      </ul>

      <div class="blog-membership__actions">
        <a :href="subscribeUrl" class="blog-membership__button">Become a member</a>
        <router-link v-if="productPath" :to="productPath" class="blog-membership__link">
          See what’s included
        </router-link>
      </div>
    </div>

    <div class="blog-membership__price-card">
      <span class="blog-membership__price">{{ price }}</span>
      <span class="blog-membership__cadence">{{ cadence }}</span>
      <span class="blog-membership__note">Cancel anytime</span>
    </div>
  </section>
</template>

<script>
const DEFAULT_BENEFITS = [
  'Every members-only post',
  'The full members-only archive',
  'Direct support for this blog'
]

function cadenceFor (hours) {
  const value = Number(hours)
  if (!Number.isFinite(value) || value <= 0) return 'each period'
  if (value === 24) return 'per day'
  if (value === 48) return 'every 2 days'
  if (value === 168) return 'per week'
  if (value === 720 || value === 730 || value === 744) return 'per month'
  if (value === 8760) return 'per year'
  if (value % 24 === 0) return 'every ' + (value / 24) + ' days'
  return 'every ' + value + ' hours'
}

export default {
  name: 'BlogMembershipCallout',
  props: {
    settings: { type: Object, default: null },
    blog: { type: String, default: '' },
    subscribeUrl: { type: String, default: '' },
    productPath: { type: String, default: '' }
  },
  computed: {
    price () {
      return this.settings && typeof this.settings.price === 'string' ? this.settings.price : ''
    },
    cadence () {
      return cadenceFor(this.settings && this.settings.recurrence)
    },
    heading () {
      const title = this.settings && this.settings.productTitle
      return title || 'Support this blog'
    },
    lede () {
      const description = this.settings && this.settings.productDescription
      if (description) return description
      return 'Members get every members-only post and the full archive. Your payment goes directly to @' +
        String(this.blog || '').replace(/^@/, '') + '.'
    },
    benefits () {
      const listed = this.settings && Array.isArray(this.settings.benefits) ? this.settings.benefits : []
      const cleaned = listed.map(item => String(item || '').trim()).filter(Boolean).slice(0, 3)
      return cleaned.length ? cleaned : DEFAULT_BENEFITS
    }
  }
}
</script>

<style scoped>
.blog-membership {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 1.5rem;
  align-items: center;
  padding: 1.5rem 1.6rem;
  border: 1px solid color-mix(in srgb, var(--c-primary) 26%, var(--c-border));
  border-radius: calc(var(--skin-radius-card, 12px) + 2px);
  background:
    linear-gradient(135deg, color-mix(in srgb, var(--c-primary) 10%, var(--c-surface)), var(--c-surface) 64%);
}

.blog-membership__kicker {
  display: flex;
  align-items: center;
  gap: 0.35rem;
  margin: 0 0 0.35rem;
  color: var(--c-primary);
  font-size: 0.7rem;
  font-weight: 700;
  letter-spacing: 0.1em;
  text-transform: uppercase;
}

.blog-membership__title {
  margin: 0;
  font-family: var(--font-display);
  font-size: clamp(1.3rem, 2.6vw, 1.75rem);
  line-height: 1.2;
}

.blog-membership__lede {
  margin: 0.5rem 0 0;
  max-width: 62ch;
  color: var(--c-text-soft);
  font-size: 0.94rem;
  line-height: 1.55;
}

.blog-membership__benefits {
  display: flex;
  flex-wrap: wrap;
  gap: 0.35rem 1rem;
  margin: 0.8rem 0 0;
  padding: 0;
  list-style: none;
  color: var(--c-text-muted);
  font-size: 0.82rem;
}

.blog-membership__benefits li {
  display: flex;
  align-items: center;
  gap: 0.3rem;
}

.blog-membership__benefits .q-icon {
  color: var(--c-primary);
}

.blog-membership__actions {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 0.5rem 1rem;
  margin-top: 1rem;
}

.blog-membership__button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: 42px;
  padding: 0.55rem 1.1rem;
  border: 1px solid var(--c-primary);
  border-radius: 999px;
  background: var(--c-primary);
  color: var(--c-on-primary);
  font-size: 0.88rem;
  font-weight: 600;
  text-decoration: none;
}

.blog-membership__button:hover {
  filter: brightness(1.06);
}

.blog-membership__link {
  color: var(--c-link);
  font-size: 0.84rem;
}

.blog-membership__price-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-width: 150px;
  padding: 1rem 1.1rem;
  border: 1px solid var(--c-border);
  border-radius: calc(var(--skin-radius-card, 12px) - 2px);
  background: var(--c-surface);
  text-align: center;
}

.blog-membership__price {
  font-family: var(--font-display);
  font-size: 1.35rem;
  font-weight: 700;
}

.blog-membership__cadence {
  margin-top: 0.15rem;
  color: var(--c-text-muted);
  font-size: 0.8rem;
}

.blog-membership__note {
  margin-top: 0.5rem;
  color: var(--c-text-faint);
  font-size: 0.72rem;
}

@media (max-width: 640px) {
  .blog-membership {
    grid-template-columns: minmax(0, 1fr);
    gap: 1rem;
    padding: 1.2rem;
  }

  .blog-membership__price-card {
    align-items: flex-start;
    text-align: left;
  }
}
</style>
