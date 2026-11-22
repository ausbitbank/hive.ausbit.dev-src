<template>
  <div
    v-if="visibleImages.length"
    class="skin-atmosphere"
    :class="{ 'is-calm': calm }"
    :data-treatment="treatment"
    :data-intensity="intensity"
    aria-hidden="true"
  >
    <img
      v-for="(image, index) in visibleImages"
      :key="image.url"
      :src="image.src"
      alt=""
      class="skin-atmosphere__image"
      :class="'skin-atmosphere__image--' + (index + 1)"
      loading="lazy"
      decoding="async"
      @error="markBroken(image.key)"
    />
    <span class="skin-atmosphere__treatment"></span>
    <span class="skin-atmosphere__scrim"></span>
  </div>
</template>

<style scoped>
.skin-atmosphere {
  position: absolute;
  inset: 0;
  z-index: -1;
  display: flex;
  overflow: hidden;
  pointer-events: none;
}

.skin-atmosphere__image {
  position: relative;
  flex: 1 1 0;
  width: 100%;
  min-width: 0;
  height: 100%;
  object-fit: cover;
  opacity: 0.55;
  filter: saturate(0.9);
}

.skin-atmosphere[data-intensity='subtle'] .skin-atmosphere__image { opacity: 0.4; }
.skin-atmosphere[data-intensity='medium'] .skin-atmosphere__image { opacity: 0.55; }
.skin-atmosphere[data-intensity='strong'] .skin-atmosphere__image { opacity: 0.7; }

.skin-atmosphere.is-calm .skin-atmosphere__image {
  animation: none !important;
}

.skin-atmosphere__treatment,
.skin-atmosphere__scrim {
  position: absolute;
  inset: 0;
  display: block;
}

.skin-atmosphere[data-treatment='duotone'] .skin-atmosphere__image {
  filter: grayscale(1) contrast(1.08);
}

.skin-atmosphere[data-treatment='duotone'] .skin-atmosphere__treatment {
  background:
    linear-gradient(135deg, color-mix(in srgb, var(--skin-primary, var(--c-primary)) 80%, transparent), transparent 62%),
    linear-gradient(315deg, color-mix(in srgb, var(--skin-accent, var(--c-accent)) 70%, transparent), transparent 58%);
  mix-blend-mode: color;
  opacity: 0.9;
}

.skin-atmosphere[data-treatment='gradient'] .skin-atmosphere__treatment {
  background: linear-gradient(160deg, color-mix(in srgb, var(--skin-primary, var(--c-primary)) 55%, transparent), transparent 55%, color-mix(in srgb, var(--skin-accent, var(--c-accent)) 45%, transparent));
}

.skin-atmosphere[data-treatment='grain'] .skin-atmosphere__treatment {
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='120' height='120'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='120' height='120' filter='url(%23n)' opacity='0.18'/%3E%3C/svg%3E");
  mix-blend-mode: overlay;
}

.skin-atmosphere[data-treatment='halftone'] .skin-atmosphere__treatment {
  background-image: radial-gradient(circle at center, color-mix(in srgb, var(--skin-text, var(--c-text)) 24%, transparent) 1px, transparent 1.4px);
  background-size: 8px 8px;
  mix-blend-mode: soft-light;
  opacity: 0.7;
}

/* Readability is not optional: the scrim never drops below a safe floor. */
.skin-atmosphere__scrim {
  background: linear-gradient(180deg, color-mix(in srgb, var(--skin-bg, var(--c-bg)) 62%, transparent), color-mix(in srgb, var(--skin-bg, var(--c-bg)) 92%, transparent) 58%, var(--skin-bg, var(--c-bg)));
  opacity: 0.9;
}

.skin-atmosphere[data-intensity='subtle'] .skin-atmosphere__scrim { opacity: 0.82; }
.skin-atmosphere[data-intensity='medium'] .skin-atmosphere__scrim { opacity: 0.9; }
.skin-atmosphere[data-intensity='strong'] .skin-atmosphere__scrim { opacity: 0.96; }

@media (prefers-reduced-motion: no-preference) {
  .skin-atmosphere:not(.is-calm) .skin-atmosphere__image {
    animation: skin-atmosphere-drift 38s ease-in-out infinite alternate;
  }
}

@keyframes skin-atmosphere-drift {
  from { transform: scale(1.02) translate3d(-0.8%, -0.5%, 0); }
  to { transform: scale(1.06) translate3d(0.8%, 0.5%, 0); }
}
</style>

<script>
import { isSafeImageUrl } from 'src/themes/schema'

function profileFor (account) {
  if (!account) return {}
  if (account.profile && typeof account.profile === 'object') return account.profile
  try {
    const metadata = typeof account.posting_json_metadata === 'string'
      ? JSON.parse(account.posting_json_metadata)
      : account.posting_json_metadata
    return metadata?.profile && typeof metadata.profile === 'object' ? metadata.profile : {}
  } catch {
    return {}
  }
}

function resized (url, width) {
  if (!isSafeImageUrl(url)) return ''
  if (/^https:\/\/images\.hive\.blog\/(?:p|u)\//i.test(url)) return url
  if (/^https:\/\/images\.hive\.blog\/\d+x\d+\//i.test(url)) return url
  return 'https://images.hive.blog/' + width + 'x0/' + url
}

export default {
  name: 'Atmosphere',
  props: {
    theme: { type: Object, default: null },
    account: { type: Object, default: null },
    calm: { type: Boolean, default: false }
  },
  data () {
    return {
      broken: []
    }
  },
  computed: {
    atmosphere () {
      return this.theme?.profile?.atmosphere || null
    },
    source () {
      return this.atmosphere?.source || 'none'
    },
    treatment () {
      return this.atmosphere?.treatment || 'none'
    },
    intensity () {
      return ['subtle', 'medium', 'strong'].includes(this.atmosphere?.intensity)
        ? this.atmosphere.intensity
        : 'medium'
    },
    images () {
      if (this.source === 'cover') {
        const profile = profileFor(this.account)
        const cover = resized(profile.cover_image, 1200)
        return cover ? [{ key: 'cover', url: cover, src: cover }] : []
      }
      if (this.source === 'collage') {
        const rows = Array.isArray(this.theme?.profile?.banner?.images) ? this.theme.profile.banner.images.slice(0, 3) : []
        return rows
          .map((url, index) => ({ key: 'collage-' + index, url, src: resized(url, 800) }))
          .filter(item => item.src)
      }
      return []
    },
    visibleImages () {
      return this.images.filter(image => !this.broken.includes(image.key))
    }
  },
  methods: {
    markBroken (key) {
      if (!this.broken.includes(key)) this.broken = [...this.broken, key]
    }
  }
}
</script>
