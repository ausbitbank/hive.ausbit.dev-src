<template>
  <router-link :to="card.link" class="community-mini">
    <img
      class="community-mini__avatar"
      :src="avatarSrc"
      alt=""
      width="38"
      height="38"
      loading="lazy"
      @error="avatarFailed = true"
    >
    <span class="community-mini__body">
      <strong class="community-mini__title">{{ card.title }}</strong>
      <span class="community-mini__meta">
        {{ formatNumber(card.subscribers) }} subscribers
        <template v-if="card.authors"> · {{ formatNumber(card.authors) }} active</template>
      </span>
    </span>
    <q-icon class="community-mini__arrow" name="arrow_forward" size="16px" aria-hidden="true" />
  </router-link>
</template>

<script>
import { hiveAvatarUrl } from 'src/utils/avatar'

export default {
  name: 'CommunityMiniCard',
  props: {
    card: { type: Object, required: true }
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
    }
  }
}
</script>

<style scoped>
.community-mini {
  display: flex;
  align-items: center;
  gap: 0.55rem;
  flex: 0 0 auto;
  width: 245px;
  min-width: 0;
  padding: 0.55rem 0.65rem;
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-card);
  background: color-mix(in srgb, var(--c-text) 3%, transparent);
  color: inherit;
  text-decoration: none;
  transition: border-color 0.15s ease, background 0.15s ease, transform 0.15s ease;
}

.community-mini:hover {
  border-color: color-mix(in srgb, var(--c-link) 35%, transparent);
  background: color-mix(in srgb, var(--c-link) 6%, transparent);
  color: inherit;
  text-decoration: none;
  transform: translateY(-1px);
}

.community-mini:focus-visible {
  outline: 2px solid color-mix(in srgb, var(--c-link) 70%, transparent);
  outline-offset: 2px;
}

.community-mini__avatar {
  flex: none;
  width: 38px;
  height: 38px;
  border: 1px solid var(--border-subtle);
  border-radius: 10px;
  background: var(--c-bg-deep);
  object-fit: cover;
}

.community-mini__body {
  display: flex;
  flex: 1;
  flex-direction: column;
  gap: 0.1rem;
  min-width: 0;
}

.community-mini__title {
  overflow: hidden;
  color: var(--c-text);
  font-size: 0.8rem;
  font-weight: 600;
  line-height: 1.25;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.community-mini__meta {
  overflow: hidden;
  color: var(--c-text-faint);
  font-size: 0.67rem;
  line-height: 1.3;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.community-mini__arrow {
  flex: none;
  color: var(--c-link);
}
</style>
