<template>
  <div
    ref="grid"
    class="dw-grid"
    :class="{
      'dw-grid--pair': pair && !editing,
      'dw-grid--editing': editing,
      'dw-grid--dragging': dragging
    }"
  >
    <div
      v-for="entry in cells"
      :key="entry.widget.id"
      class="dw-grid__cell"
      :class="{
        'dw-grid__cell--dragging': dragging && dragId === entry.widget.id,
        'dw-grid__cell--before': markerFor(entry.widget, 'before'),
        'dw-grid__cell--after': markerFor(entry.widget, 'after')
      }"
      :style="editing ? { gridColumn: 'span ' + entry.span } : null"
      :data-widget-type="entry.widget.type"
      :data-widget-id="entry.widget.id"
    >
      <dashboard-widget-shell
        :widget="entry.widget"
        :meta="metaFor(entry.widget)"
        :editing="editing"
        :dragging="dragging && dragId === entry.widget.id"
        :dropping="keyboardId === entry.widget.id"
        :guest-blocked="guestBlocked(entry.widget)"
        :unavailable="entry.unavailable"
        :hide-header="true"
        :index="entry.index"
        :count="widgets.length"
        @drag-start="startDrag"
        @pick-up="pickUp"
        @nudge="onNudge"
        @remove="$emit('remove', $event)"
      >
        <home-block-card
          v-if="entry.widget.type === 'block'"
          v-bind="settingsFor(entry.widget, { compact: entry.widget.settings?.compact })"
        />
        <home-market-card
          v-else-if="entry.widget.type === 'market'"
          v-bind="settingsFor(entry.widget, { coinIds: entry.widget.settings?.coinIds, currency: entry.widget.settings?.currency, compact: entry.widget.settings?.compact })"
        />
        <home-witness-card
          v-else-if="entry.widget.type === 'witnesses'"
          v-bind="settingsFor(entry.widget, { limit: entry.widget.settings?.limit, pinMine: entry.widget.settings?.pinMine, highlight: entry.widget.settings?.highlight, showHealth: entry.widget.settings?.showHealth })"
        />
        <home-trending-posts
          v-else-if="entry.widget.type === 'posts'"
          v-bind="settingsFor(entry.widget, { source: entry.widget.settings?.source, tag: entry.widget.settings?.tag, limit: entry.widget.settings?.limit, showSortToggle: entry.widget.settings?.showSortToggle })"
        />
        <home-recent-posts
          v-else-if="entry.widget.type === 'accountPosts'"
          v-bind="settingsFor(entry.widget, { account: entry.widget.settings?.account, limit: entry.widget.settings?.limit })"
        />
        <widget-my-witness
          v-else-if="entry.widget.type === 'myWitness'"
          v-bind="settingsFor(entry.widget, { account: entry.widget.settings?.account })"
        />
        <widget-witness-health
          v-else-if="entry.widget.type === 'witnessHealth'"
          v-bind="settingsFor(entry.widget, { account: entry.widget.settings?.account })"
        />
        <widget-network-stats v-else-if="entry.widget.type === 'network'" />
        <widget-notifications
          v-else-if="entry.widget.type === 'notifications'"
          v-bind="settingsFor(entry.widget, { account: entry.widget.settings?.account, limit: entry.widget.settings?.limit })"
        />
      </dashboard-widget-shell>
    </div>

    <button
      v-if="editing"
      type="button"
      class="dw-grid__end"
      :class="{ 'is-target': endMarker }"
      @pointerenter="endMarker = true"
      @pointerleave="endMarker = false"
      @keydown.enter.prevent="moveToEndFromKeyboard"
    >
      <q-icon name="arrow_downward" size="16px" aria-hidden="true" />
      <span>End of layout</span>
    </button>
  </div>
</template>

<style scoped>
.dw-grid {
  display: block;
}

/* Edit mode: the real 12-column grid, always. */
.dw-grid--editing {
  display: grid;
  grid-template-columns: repeat(12, minmax(0, 1fr));
  align-items: start;
  gap: var(--space-4);
}

.dw-grid--editing > .dw-grid__cell {
  min-width: 0;
  position: relative;
}

/* The block/coin pair in view mode: two equal columns stacking below 800px. */
.dw-grid--pair {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  align-items: start;
  gap: var(--space-4);
}

.dw-grid--pair > .dw-grid__cell {
  min-width: 0;
}

.dw-grid--dragging,
.dw-grid--dragging .dw-widget {
  cursor: grabbing;
}

/* Insertion markers: a bright edge on the side the widget will land. */
.dw-grid__cell--before::before,
.dw-grid__cell--after::after {
  content: '';
  position: absolute;
  z-index: 3;
  top: 6px;
  bottom: 6px;
  width: 3px;
  border-radius: var(--radius-pill);
  background: #4fc3f7;
  box-shadow: 0 0 10px rgba(79, 195, 247, 0.75);
  pointer-events: none;
}

.dw-grid__cell--before::before {
  left: calc(var(--space-4) / -2 - 1px);
}

.dw-grid__cell--after::after {
  right: calc(var(--space-4) / -2 - 1px);
}

.dw-grid__end {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.35rem;
  grid-column: 1 / -1;
  min-height: 48px;
  border: 1px dashed var(--border-subtle);
  border-radius: var(--radius-card);
  background: transparent;
  color: #78909c;
  font: inherit;
  font-size: 0.76rem;
  cursor: pointer;
}

.dw-grid__end.is-target {
  border-color: rgba(79, 195, 247, 0.7);
  background: rgba(79, 195, 247, 0.08);
  color: #e1f5fe;
}

@media (max-width: 799px) {
  .dw-grid--pair {
    grid-template-columns: minmax(0, 1fr);
  }

  .dw-grid--editing {
    grid-template-columns: minmax(0, 1fr);
  }

  .dw-grid--editing > .dw-grid__cell {
    grid-column: 1 / -1 !important;
  }
}
</style>

<script>
import DashboardWidgetShell from 'components/dashboard/DashboardWidgetShell.vue'
import WidgetMyWitness from 'components/dashboard/WidgetMyWitness.vue'
import WidgetWitnessHealth from 'components/dashboard/WidgetWitnessHealth.vue'
import WidgetNetworkStats from 'components/dashboard/WidgetNetworkStats.vue'
import WidgetNotifications from 'components/dashboard/WidgetNotifications.vue'
import HomeBlockCard from 'components/HomeBlockCard.vue'
import HomeMarketCard from 'components/HomeMarketCard.vue'
import HomeWitnessCard from 'components/HomeWitnessCard.vue'
import HomeTrendingPosts from 'components/HomeTrendingPosts.vue'
import HomeRecentPosts from 'components/HomeRecentPosts.vue'
import { GRID_COLUMNS, WIDGET_WIDTHS, packRows, widgetMeta } from 'src/services/dashboardLayout'
import {
  dropTargetFor,
  insertIndexFor,
  isDragGesture,
  moveTargetFor
} from 'src/services/dashboardGrid'

const SPANS = new Map(WIDGET_WIDTHS.map(entry => [entry.value, entry.columns]))

// Types this grid renders today. Registry entries without a component are
// still laid out and show the shell's "available shortly" placeholder.
// `wallet` is deliberately absent until its numbers are verified against the
// wallet page; its registry entry renders the shell's "available shortly" state.
const RENDERED_TYPES = ['block', 'market', 'witnesses', 'posts', 'accountPosts', 'myWitness', 'witnessHealth', 'network', 'notifications']

// Key bindings that move a picked-up widget. Arrows follow reading order; the
// home/end keys jump to the ends of the layout.
const KEY_STEPS = {
  ArrowLeft: -1,
  ArrowUp: -1,
  ArrowRight: 1,
  ArrowDown: 1
}

export default {
  name: 'DashboardGrid',
  components: {
    DashboardWidgetShell,
    WidgetMyWitness,
    WidgetWitnessHealth,
    WidgetNetworkStats,
    WidgetNotifications,
    HomeBlockCard,
    HomeMarketCard,
    HomeWitnessCard,
    HomeTrendingPosts,
    HomeRecentPosts
  },
  props: {
    widgets: { type: Array, default: () => [] },
    // Edit mode: 12-column grid with drag/keyboard reorder.
    editing: { type: Boolean, default: false },
    // Signed-in user; account widgets show a log-in state when false.
    signedIn: { type: Boolean, default: false },
    // Render two widgets side by side when not editing (the block/coin row).
    pair: { type: Boolean, default: false }
  },
  emits: ['move-to', 'remove'],
  data () {
    return {
      dragId: '',
      dragPointerId: null,
      dragStartX: 0,
      dragStartY: 0,
      dragging: false,
      // { id, edge } of the card being dropped on, or null.
      marker: null,
      // Widget picked up from the keyboard and being moved with arrows.
      keyboardId: '',
      endMarker: false
    }
  },
  computed: {
    cells () {
      if (this.editing) {
        const rows = packRows(this.widgets, GRID_COLUMNS)
        const spans = new Map()
        for (const row of rows) {
          for (const item of row) spans.set(item.widget.id, item.columns)
        }
        return this.widgets.map((widget, index) => ({
          widget,
          index,
          span: spans.get(widget.id) || SPANS.get(widget.width) || GRID_COLUMNS,
          unavailable: !RENDERED_TYPES.includes(widget.type)
        }))
      }
      return this.widgets.map((widget, index) => ({
        widget,
        index,
        span: GRID_COLUMNS,
        unavailable: !RENDERED_TYPES.includes(widget.type)
      }))
    }
  },
  mounted () {
    if (typeof window === 'undefined') return
    window.addEventListener('pointermove', this.onPointerMove, { passive: false })
    window.addEventListener('pointerup', this.onPointerUp)
    window.addEventListener('pointercancel', this.cancelDrag)
    window.addEventListener('keydown', this.onKeyDown)
  },
  beforeUnmount () {
    if (typeof window === 'undefined') return
    window.removeEventListener('pointermove', this.onPointerMove)
    window.removeEventListener('pointerup', this.onPointerUp)
    window.removeEventListener('pointercancel', this.cancelDrag)
    window.removeEventListener('keydown', this.onKeyDown)
  },
  methods: {
    /**
     * The subset of a widget's settings that maps to the card's props. Only
     * declared keys are passed: unknown ones would land as DOM attributes, and
     * keys the card does not declare at all are not props it can accept.
     */
    settingsFor (widget, keys) {
      const settings = widget.settings || {}
      const props = {}
      for (const [name, fallback] of Object.entries(keys)) {
        props[name] = settings[name] !== undefined ? settings[name] : fallback
      }
      return Object.fromEntries(Object.entries(props).filter(([, value]) => value !== undefined))
    },
    metaFor (widget) {
      return widgetMeta(widget.type) || { label: widget.type, category: '' }
    },
    guestBlocked (widget) {
      return Boolean(widgetMeta(widget)?.requiresAccount) && !this.signedIn
    },
    markerFor (widget, edge) {
      return Boolean(this.marker && this.marker.id === widget.id && this.marker.edge === edge)
    },
    indexOfId (id) {
      return this.widgets.findIndex(widget => widget.id === id)
    },
    /** Insertion index among the other widgets -> `moveWidget` target. */
    move (widget, insert) {
      const from = this.indexOfId(widget.id)
      if (from === -1) return
      const target = moveTargetFor(insert, this.widgets.length - 1)
      if (target === from) return
      this.$emit('move-to', { widget, to: target })
    },
    onNudge ({ widget, direction }) {
      const from = this.indexOfId(widget.id)
      if (from === -1) return
      this.$emit('move-to', { widget, to: Math.max(0, Math.min(this.widgets.length - 1, from + direction)) })
    },


    /* --- pointer drag ---------------------------------------------------- */

    startDrag ({ widget, event }) {
      if (!this.editing || !event) return
      if (typeof event.button === 'number' && event.button > 0) return
      this.cancelKeyboardPickUp()
      this.marker = null
      this.endMarker = false
      this.dragging = false
      this.dragId = widget.id
      this.dragPointerId = event.pointerId
      this.dragStartX = event.clientX
      this.dragStartY = event.clientY
    },
    onPointerMove (event) {
      if (!this.dragId || event.pointerId !== this.dragPointerId) return
      if (!this.dragging) {
        if (!isDragGesture(event.clientX - this.dragStartX, event.clientY - this.dragStartY)) return
        this.dragging = true
        document.body.classList.add('dw-drag-active')
      }
      if (event.cancelable) event.preventDefault()
      this.marker = this.targetAt(event.clientX, event.clientY, this.dragId)
      if (this.marker) this.endMarker = false
    },
    onPointerUp (event) {
      if (!this.dragId || (event && event.pointerId !== this.dragPointerId)) return
      const marker = this.dragging ? this.marker : null
      const widget = this.widgets.find(entry => entry.id === this.dragId)
      this.resetDrag()
      if (!widget) return
      if (marker) this.dropOn(widget, marker)
    },
    cancelDrag () {
      if (this.dragId) this.resetDrag()
    },
    resetDrag () {
      this.dragId = ''
      this.dragging = false
      this.dragPointerId = null
      this.marker = null
      if (typeof document !== 'undefined') document.body.classList.remove('dw-drag-active')
    },
    /** Live card rectangles in DOM order, excluding the dragged card. */
    cardRects (excludeId) {
      const list = []
      for (const cell of this.$el.querySelectorAll('[data-widget-id]')) {
        const id = cell.getAttribute('data-widget-id')
        if (!id || id === excludeId) continue
        const card = cell.querySelector('.dw-widget') || cell
        list.push({ id, rect: card.getBoundingClientRect() })
      }
      return list
    },
    targetAt (x, y, excludeId) {
      const cards = this.cardRects(excludeId)
      const target = dropTargetFor({ rects: cards.map(card => card.rect), x, y })
      if (!target) return null
      return { id: cards[target.index].id, edge: target.edge }
    },
    /**
     * Drop before/after the marker card. Marker indexes are positions among the
     * other widgets (the dragged one is excluded), which is exactly the slot
     * `moveWidget` expects after it removes the dragged widget.
     */
    dropOn (widget, marker) {
      const others = this.widgets.filter(entry => entry.id !== widget.id)
      const index = others.findIndex(entry => entry.id === marker.id)
      if (index === -1) return
      this.move(widget, insertIndexFor({ index, edge: marker.edge }))
    },
    moveToEndFromKeyboard () {
      if (!this.keyboardId) return
      const widget = this.widgets.find(entry => entry.id === this.keyboardId)
      if (!widget) return
      this.$emit('move-to', { widget, to: this.widgets.length - 1 })
      this.$nextTick(() => this.focusHandle(this.keyboardId))
    },

    /* --- keyboard reorder ------------------------------------------------ */

    pickUp (widget) {
      this.resetDrag()
      if (this.keyboardId === widget.id) {
        this.cancelKeyboardPickUp()
        return
      }
      this.keyboardId = widget.id
      this.$nextTick(() => this.focusHandle(widget.id))
    },
    cancelKeyboardPickUp () {
      this.keyboardId = ''
    },
    onKeyDown (event) {
      if (!this.keyboardId) return
      const index = this.indexOfId(this.keyboardId)
      if (index === -1) {
        this.cancelKeyboardPickUp()
        return
      }
      const widget = this.widgets[index]

      if (event.key === 'Escape') {
        event.preventDefault()
        const id = this.keyboardId
        this.cancelKeyboardPickUp()
        this.$nextTick(() => this.focusHandle(id))
        return
      }
      if (event.key === 'Home' || event.key === 'End') {
        event.preventDefault()
        const to = event.key === 'Home' ? 0 : this.widgets.length - 1
        if (to !== index) this.$emit('move-to', { widget, to })
        this.$nextTick(() => this.focusHandle(this.keyboardId))
        return
      }
      const step = KEY_STEPS[event.key]
      if (!step) return
      event.preventDefault()
      const to = Math.max(0, Math.min(this.widgets.length - 1, index + step))
      if (to === index) return
      this.$emit('move-to', { widget, to })
      this.$nextTick(() => this.focusHandle(this.keyboardId))
    },
    focusHandle (id) {
      if (!id) return
      const node = this.$el.querySelector('[data-widget-id="' + id + '"] .dw-widget__drag-handle')
      if (node) node.focus()
    }
  }
}
</script>
