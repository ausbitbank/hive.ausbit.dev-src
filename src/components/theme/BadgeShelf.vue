<template>
  <section v-if="badges.length" class="skin-badges" aria-labelledby="skin-badges-title">
    <h2 id="skin-badges-title" class="skin-shelf__label">Badges</h2>
    <ul class="skin-badges__list">
      <li v-for="badge in badges" :key="badge.source + ':' + badge.id">
        <button
          type="button"
          class="skin-badge-chip"
          :aria-label="chipLabel(badge)"
          @click="openBadge(badge)"
        >
          <img :src="badge.image" :alt="badge.title + ' badge'" class="skin-badge-chip__image" loading="lazy" />
          <span class="skin-badge-chip__text">
            <span class="skin-badge-chip__title">{{ badge.title }}</span>
            <span class="skin-badge-chip__issuer">
              <q-icon v-if="badge.verified" name="verified" size="12px" aria-hidden="true" />
              {{ badge.issuer }}<template v-if="badge.verified"> · Verified</template>
            </span>
          </span>
        </button>
      </li>
    </ul>

    <q-dialog v-model="dialogOpen">
      <q-card v-if="active" class="skin-badge-dialog">
        <q-card-section class="skin-badge-dialog__head">
          <img :src="active.image" :alt="active.title + ' badge'" class="skin-badge-dialog__image" />
          <div>
            <div class="skin-badge-dialog__eyebrow">{{ active.issuer }}</div>
            <h2 class="skin-badge-dialog__title">{{ active.title }}</h2>
            <p v-if="active.verified" class="skin-badge-dialog__verified">
              <q-icon name="verified" size="15px" aria-hidden="true" />
              Verified by {{ active.issuer }}
            </p>
          </div>
        </q-card-section>
        <q-card-section v-if="active.description" class="skin-badge-dialog__body">
          <p>{{ active.description }}</p>
        </q-card-section>
        <q-card-actions align="right">
          <a
            v-if="active.url"
            class="skin-badge-dialog__link"
            :href="active.url"
            target="_blank"
            rel="noopener noreferrer"
          >View on {{ active.source === 'peakd' ? 'PeakD' : 'HiveBuzz' }}</a>
          <q-btn flat no-caps label="Close" v-close-popup />
        </q-card-actions>
      </q-card>
    </q-dialog>
  </section>
</template>

<style scoped>
.skin-badges__list {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 0.35rem;
  margin: 0;
  padding: 0;
  list-style: none;
}

.skin-badge-chip {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  max-width: 220px;
  padding: 0.25rem 0.5rem 0.25rem 0.25rem;
  border: 1px solid color-mix(in srgb, var(--skin-border, var(--c-border)) 70%, transparent);
  border-radius: var(--radius-pill);
  background: color-mix(in srgb, var(--skin-surface, var(--c-surface)) 70%, transparent);
  color: var(--skin-text, var(--c-text));
  font: inherit;
  text-align: left;
  cursor: pointer;
}

.skin-badge-chip:hover,
.skin-badge-chip:focus-visible {
  border-color: var(--skin-primary, var(--c-primary));
}

.skin-badge-chip__image {
  width: 28px;
  height: 28px;
  border-radius: 50%;
  object-fit: cover;
}

.skin-badge-chip__text {
  display: flex;
  flex-direction: column;
  min-width: 0;
}

.skin-badge-chip__title,
.skin-badge-chip__issuer {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.skin-badge-chip__title {
  font-size: 0.7rem;
  font-weight: 650;
}

.skin-badge-chip__issuer {
  color: var(--skin-muted, var(--c-text-muted));
  font-size: 0.6rem;
}

.skin-badge-dialog {
  width: min(460px, 94vw);
  background: var(--c-surface);
}

.skin-badge-dialog__head {
  display: flex;
  align-items: center;
  gap: 0.7rem;
}

.skin-badge-dialog__image {
  width: 52px;
  height: 52px;
  border-radius: 50%;
  object-fit: cover;
}

.skin-badge-dialog__eyebrow {
  color: var(--c-text-faint);
  font-size: 0.66rem;
  font-weight: 700;
  letter-spacing: 0.06em;
  text-transform: uppercase;
}

.skin-badge-dialog__title {
  margin: 0.15rem 0;
  font-size: 1rem;
}

.skin-badge-dialog__verified {
  display: flex;
  align-items: center;
  gap: 0.25rem;
  margin: 0;
  color: var(--c-positive);
  font-size: 0.72rem;
  font-weight: 600;
}

.skin-badge-dialog__body p {
  margin: 0;
  color: var(--c-text-muted);
  font-size: 0.84rem;
  line-height: 1.5;
}

.skin-badge-dialog__link {
  margin-right: auto;
  color: var(--c-link);
  font-size: 0.8rem;
  font-weight: 600;
}
</style>

<script>
import { normalizeBadge } from 'src/services/badges'

export default {
  name: 'BadgeShelf',
  props: {
    badges: { type: Array, default: () => [] }
  },
  data () {
    return {
      dialogOpen: false,
      active: null
    }
  },
  methods: {
    openBadge (badge) {
      this.active = normalizeBadge(badge) || badge
      this.dialogOpen = true
    },
    chipLabel (badge) {
      const verified = badge.verified ? ' verified' : ''
      return badge.title + ' — ' + badge.issuer + verified + ' badge'
    }
  }
}
</script>
