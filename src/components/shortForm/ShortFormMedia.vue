<template>
  <div v-if="media.length" class="sfm" :class="'sfm--' + layout">
    <component
      :is="linked ? 'span' : 'a'"
      v-for="item in media"
      :key="item.url"
      v-bind="linkAttrs(item)"
      class="sfm__cell"
    >
      <img
        v-if="item.kind === 'image'"
        :src="proxied(item)"
        :alt="altFor(item)"
        class="sfm__img"
        :style="cellStyle(item)"
        loading="lazy"
        decoding="async"
        referrerpolicy="no-referrer"
      />
      <video
        v-else
        :src="item.url"
        class="sfm__img"
        :style="cellStyle(item)"
        muted
        playsinline
        preload="metadata"
      />
      <span v-if="item.kind === 'video'" class="sfm__badge" aria-hidden="true">
        <q-icon name="play_arrow" size="16px" />
      </span>
    </component>
  </div>
</template>

<script>
import { shortFormImageUrl } from 'src/services/imageProxy'

export default {
  name: 'ShortFormMedia',
  props: {
    // Output of `shortMedia()` — { url, kind, ratio, count, position }.
    items: { type: Array, default: () => [] },
    author: { type: String, default: '' },
    // Render plain cells when the parent handles opening the full gallery.
    linked: { type: Boolean, default: false }
  },
  computed: {
    media () {
      return Array.isArray(this.items) ? this.items.slice(0, 4) : []
    },
    layout () {
      if (this.media.length === 1) return 'single'
      return this.media.length === 2 ? 'duo' : 'grid'
    }
  },
  methods: {
    linkAttrs (item) {
      if (this.linked) return {}
      return {
        href: item.url,
        target: '_blank',
        rel: 'noopener noreferrer',
        'aria-label': 'Open ' + item.kind + ' in a new tab'
      }
    },
    proxied (item) {
      // Portrait images get a taller crop box, but every feed image is capped
      // so one photo cannot push the rest of the feed below the fold.
      if (item.ratio && item.ratio < 0.8) return this.resize(item.url, 600, 800)
      return this.resize(item.url, 900, 560)
    },
    resize (url, width, height) {
      return shortFormImageUrl(url, width, height)
    },
    cellStyle (item) {
      // Single media keeps its own shape inside a capped box; grids use a
      // near-square tile so a row always reads as one unit.
      if (!item.ratio) return null
      const ratio = Math.min(1.8, Math.max(0.75, item.ratio))
      return { aspectRatio: String(ratio) }
    },
    altFor (item) {
      const who = this.author ? '@' + this.author + "'s " : ''
      if (item.count > 1) return who + 'image ' + (item.position + 1) + ' of ' + item.count
      return who + 'image'
    }
  }
}
</script>

<style scoped>
.sfm {
  display: grid;
  gap: 2px;
  margin-top: var(--space-2);
  overflow: hidden;
  border-radius: var(--radius-sm);
}

.sfm--single {
  grid-template-columns: minmax(0, 1fr);
  max-width: 560px;
}

.sfm--duo,
.sfm--grid {
  grid-template-columns: repeat(2, minmax(0, 1fr));
}

.sfm__cell {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  background: color-mix(in srgb, var(--c-shadow) 30%, transparent);
}

.sfm__img {
  display: block;
  width: 100%;
  height: auto;
  max-height: 380px;
  object-fit: cover;
  aspect-ratio: 4 / 3;
}

.sfm--duo .sfm__img,
.sfm--grid .sfm__img {
  height: 100%;
  max-height: 200px;
}

.sfm__badge {
  position: absolute;
  right: 8px;
  bottom: 8px;
  display: inline-flex;
  align-items: center;
  padding: 2px 6px;
  border-radius: var(--radius-pill);
  background: color-mix(in srgb, var(--c-shadow) 60%, transparent);
  color: #fff;
}
</style>
