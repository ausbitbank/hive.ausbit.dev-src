<template>
  <article class="community-card" :class="{ 'community-card--compact': compact }">
    <router-link :to="card.link" class="community-card__avatar" :aria-label="'Open ' + card.title + ' community'">
      <q-img :src="avatarSrc" :alt="card.title + ' avatar'" fit="cover" loading="lazy" @error="avatarFailed = true" />
    </router-link>

    <div class="community-card__body">
      <header class="community-card__head">
        <div class="community-card__title-wrap">
          <h2 class="community-card__title">
            <router-link :to="card.link">{{ card.title }}</router-link>
          </h2>
          <div class="community-card__meta">
            <span class="community-card__handle">{{ card.name }}</span>
            <span v-if="card.roleLabel" class="community-card__role" :class="'community-card__role--' + card.role">{{ card.roleLabel }}</span>
            <span v-if="card.typeLabel" class="community-card__role" :class="'community-card__role--' + card.type">{{ card.typeLabel }}</span>
            <span v-if="card.nsfw" class="community-card__flag">NSFW</span>
            <span v-if="card.restricted" class="community-card__flag">Restricted</span>
          </div>
        </div>

        <router-link :to="card.link" class="community-card__action" :aria-label="'Visit ' + card.title">
          Open <q-icon name="arrow_forward" size="15px" aria-hidden="true" />
        </router-link>
      </header>

      <p v-if="card.about" class="community-card__about">{{ card.about }}</p>
      <p v-else class="community-card__about community-card__about--muted">No community description published yet.</p>

      <dl class="community-card__stats">
        <div class="community-card__stat">
          <dt>Subscribers</dt>
          <dd>{{ card.known ? formatNumber(card.subscribers) : '—' }}</dd>
        </div>
        <div class="community-card__stat">
          <dt>Active authors</dt>
          <dd>{{ card.known ? formatNumber(card.authors) : '—' }}</dd>
        </div>
        <div v-if="!compact" class="community-card__stat">
          <dt>Pending payouts</dt>
          <dd>{{ card.known ? formatHbd(card.pendingRewards) : '—' }}</dd>
        </div>
      </dl>

      <footer class="community-card__footer">
        <router-link :to="card.link" class="community-card__link">Trending</router-link>
        <router-link :to="'/c/' + card.name + '/created'" class="community-card__link">New</router-link>
        <router-link :to="'/c/' + card.name + '/hot'" class="community-card__link">Hot</router-link>
        <q-space />
        <router-link :to="'/created/' + card.name" class="community-card__link community-card__link--muted">#tag feed</router-link>
      </footer>
    </div>
  </article>
</template>

<script>
import { hiveAvatarUrl } from 'src/utils/avatar'
export default {
  name: 'CommunityCard',
  props: {
    card: { type: Object, required: true },
    compact: { type: Boolean, default: false }
  },
  data () {
    return {
      avatarFailed: false
    }
  },
  watch: {
    'card.name' () {
      this.avatarFailed = false
    }
  },
  computed: {
    avatarSrc () {
      return this.avatarFailed
        ? '/statics/member.webp'
        : hiveAvatarUrl(this.card.name)
    }
  },
  methods: {
    formatNumber (value) {
      const number = Number(value)
      if (!Number.isFinite(number) || number <= 0) return '0'
      return number.toLocaleString('en-US', { maximumFractionDigits: 0 })
    },
    formatHbd (value) {
      const number = Number(value)
      if (!Number.isFinite(number) || number <= 0) return '0 HBD'
      return number.toLocaleString('en-US', { maximumFractionDigits: 1 }) + ' HBD'
    }
  }
}
</script>

<style scoped>
.community-card {
  display: flex;
  gap: 0.85rem;
  min-width: 0;
  padding: 0.9rem;
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-card);
  background: color-mix(in srgb, var(--c-text) 3%, transparent);
  transition: border-color 0.15s ease, box-shadow 0.15s ease, transform 0.15s ease;
}

.community-card:hover {
  border-color: color-mix(in srgb, var(--c-link) 32%, transparent);
  box-shadow: var(--shadow-card);
  transform: translateY(-1px);
}

.community-card__avatar {
  flex: none;
  width: 52px;
  height: 52px;
  overflow: hidden;
  border: 1px solid var(--border-subtle);
  border-radius: 12px;
  background: var(--c-bg-deep);
}

.community-card__avatar :deep(.q-img) {
  width: 100%;
  height: 100%;
}

.community-card__body {
  display: flex;
  flex: 1;
  flex-direction: column;
  gap: 0.45rem;
  min-width: 0;
}

.community-card__head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: var(--space-2);
}

.community-card__title-wrap {
  min-width: 0;
}

.community-card__title {
  margin: 0;
  font-size: 0.98rem;
  font-weight: 600;
  line-height: 1.3;
  overflow-wrap: anywhere;
}

.community-card__title a {
  color: var(--c-text);
  text-decoration: none;
}

.community-card__title a:hover {
  color: var(--c-link-hover);
}

.community-card__meta {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 0.3rem;
  margin-top: 0.15rem;
  font-size: 0.7rem;
}

.community-card__handle {
  color: var(--c-text-faint);
  font-variant-numeric: tabular-nums;
}

.community-card__role {
  padding: 0 0.35rem;
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-pill);
  color: var(--c-text-muted);
  font-size: 0.64rem;
  letter-spacing: 0.04em;
  text-transform: uppercase;
}

.community-card__role--owner,
.community-card__role--admin {
  border-color: color-mix(in srgb, var(--c-negative) 40%, transparent);
  color: var(--c-negative);
}

.community-card__role--mod {
  border-color: color-mix(in srgb, var(--c-warning) 40%, transparent);
  color: var(--c-warning-soft);
}

.community-card__role--member {
  border-color: color-mix(in srgb, var(--c-positive) 40%, transparent);
  color: var(--c-info);
}

.community-card__flag {
  padding: 0 0.35rem;
  border-radius: var(--radius-pill);
  background: color-mix(in srgb, var(--c-warning) 12%, transparent);
  color: var(--c-warning-soft);
  font-size: 0.62rem;
  letter-spacing: 0.04em;
  text-transform: uppercase;
}

.community-card__action {
  display: inline-flex;
  align-items: center;
  gap: 0.1rem;
  flex: none;
  color: var(--c-link) !important;
  font-size: 0.75rem;
  font-weight: 600;
  text-decoration: none;
  white-space: nowrap;
}

.community-card__action:hover {
  color: var(--c-link-hover) !important;
}

.community-card__about {
  display: -webkit-box;
  -webkit-line-clamp: 3;
  -webkit-box-orient: vertical;
  overflow: hidden;
  margin: 0;
  color: var(--c-text-muted);
  font-size: 0.8rem;
  line-height: 1.5;
}

.community-card__about--muted {
  color: var(--c-text-faint);
  font-style: italic;
}

.community-card__stats {
  display: flex;
  flex-wrap: wrap;
  gap: 0.35rem 1.15rem;
  margin: 0;
  padding: 0.4rem 0.55rem;
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-sm);
  background: color-mix(in srgb, var(--c-text) 2%, transparent);
}

.community-card__stat {
  min-width: 0;
}

.community-card__stat dt {
  color: var(--c-text-faint);
  font-size: 0.6rem;
  letter-spacing: 0.05em;
  text-transform: uppercase;
}

.community-card__stat dd {
  margin: 0;
  color: var(--c-text);
  font-size: 0.84rem;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
}

.community-card__footer {
  display: flex;
  align-items: center;
  gap: 0.65rem;
  flex-wrap: wrap;
  margin-top: auto;
  padding-top: 0.3rem;
}

.community-card__link {
  padding: 0.22rem 0.6rem;
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-pill);
  color: var(--c-text-muted) !important;
  font-size: 0.72rem;
  font-weight: 600;
  text-decoration: none;
  transition: border-color 0.15s ease, color 0.15s ease, background 0.15s ease;
}

.community-card__link:hover {
  border-color: color-mix(in srgb, var(--c-link) 45%, transparent);
  background: color-mix(in srgb, var(--c-link) 10%, transparent);
  color: var(--c-link-hover) !important;
  text-decoration: none;
}

.community-card__link--muted {
  color: var(--c-text-subtle) !important;
  font-weight: 500;
}

.community-card--compact {
  padding: 0.7rem;
}

.community-card--compact .community-card__avatar {
  width: 40px;
  height: 40px;
}

@media (max-width: 599px) {
  .community-card__action {
    display: none;
  }
}
</style>
