<template>
  <div
    ref="grid"
    class="dw-grid"
    :class="{
      'dw-grid--pair': pair && !editing,
      'dw-grid--packed': packed && !editing,
      'dw-grid--editing': editing,
      'dw-grid--masonry': masonryReady,
      'dw-grid--dragging': dragging
    }"
    :style="gridStyle"
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
      :style="cellStyle(entry)"
      :data-span="entry.span"
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
        :configurable="configurableFor(entry.widget)"
        :index="entry.index"
        :count="widgets.length"
        @drag-start="startDrag"
        @pick-up="pickUp"
        @nudge="onNudge"
        @configure="$emit('configure', $event)"
        @width-step="$emit('width-step', $event)"
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
          v-bind="settingsFor(entry.widget, { reference: entry.widget.settings?.reference, source: entry.widget.settings?.source, tag: entry.widget.settings?.tag, account: entry.widget.settings?.account, feedSort: entry.widget.settings?.feedSort, limit: entry.widget.settings?.limit, showSortToggle: entry.widget.settings?.showSortToggle, view: entry.widget.settings?.view, showBody: entry.widget.settings?.showBody, pollSeconds: entry.widget.settings?.pollSeconds })"
        />
        <widget-my-witness
          v-else-if="entry.widget.type === 'myWitness'"
          v-bind="settingsFor(entry.widget, { account: entry.widget.settings?.account })"
        />
        <widget-wallet
          v-else-if="entry.widget.type === 'wallet'"
          v-bind="settingsFor(entry.widget, { account: entry.widget.settings?.account, currency: entry.widget.settings?.currency, includeHiveEngine: entry.widget.settings?.includeHiveEngine, includeMagi: entry.widget.settings?.includeMagi })"
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
        <widget-operations
          v-else-if="entry.widget.type === 'operations'"
          v-bind="settingsFor(entry.widget, { account: entry.widget.settings?.account, filters: entry.widget.settings?.filters, jsonIds: entry.widget.settings?.jsonIds, limit: entry.widget.settings?.limit, pollSeconds: entry.widget.settings?.pollSeconds, includeMagi: entry.widget.settings?.includeMagi })"
        />
      </dashboard-widget-shell>
    </div>

    <button
      v-if="editing"
      type="button"
      class="dw-grid__end"
      :class="{ 'is-target': endMarker }"
      :style="endStyle"
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

/* Edit mode and customised view mode: the real 12-column grid. */
.dw-grid--editing,
.dw-grid--packed {
  display: grid;
  grid-template-columns: repeat(12, minmax(0, 1fr));
  align-items: start;
  gap: var(--space-4);
}

.dw-grid--masonry {
  position: relative;
  display: block;
  min-height: 1px;
}

.dw-grid.dw-grid--masonry > .dw-grid__cell {
  position: absolute;
  margin: 0;
}

.dw-grid--editing > .dw-grid__cell,
.dw-grid--packed > .dw-grid__cell {
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

  .dw-grid--packed {
    grid-template-columns: minmax(0, 1fr);
  }

  .dw-grid--packed > .dw-grid__cell {
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
import WidgetOperations from 'components/dashboard/WidgetOperations.vue'
import WidgetWallet from 'components/dashboard/WidgetWallet.vue'
import HomeBlockCard from 'components/HomeBlockCard.vue'
import HomeMarketCard from 'components/HomeMarketCard.vue'
import HomeWitnessCard from 'components/HomeWitnessCard.vue'
import HomeTrendingPosts from 'components/HomeTrendingPosts.vue'
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
const RENDERED_TYPES = ['block', 'market', 'witnesses', 'posts', 'wallet', 'myWitness', 'witnessHealth', 'network', 'notifications', 'operations']

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
    WidgetOperations,
    WidgetWallet,
    HomeBlockCard,
    HomeMarketCard,
    HomeWitnessCard,
    HomeTrendingPosts
  },
  props: {
    widgets: { type: Array, default: () => [] },
    // Edit mode: 12-column grid with drag/keyboard reorder.
    editing: { type: Boolean, default: false },
    // Signed-in user; account widgets show a log-in state when false.
    signedIn: { type: Boolean, default: false },
    // Render two widgets side by side when not editing (the block/coin row).
    pair: { type: Boolean, default: false },
    // View mode for a customised layout: one packed 12-column grid instead of
    // the page's main/sidebar shell.
    packed: { type: Boolean, default: false },
    // View mode tiling: fill vertical gaps by measuring widget heights.
    masonry: { type: Boolean, default: false }
  },
  emits: ['move-to', 'remove', 'width-step', 'configure'],
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
      endMarker: false,
      // Masonry view mode: measured absolute positions and container height.
      masonryStyles: {},
      masonryHeight: 0,
      masonryWidth: 0,
      masonryTimer: null,
      masonryObserver: null,
      resizeObserver: null
    }
  },
  computed: {
    masonryReady () {
      return this.masonryActive() && Object.keys(this.masonryStyles).length > 0
    },
    // The absolute masonry cells are out of flow, so the grid owns its height.
    // In edit mode the "End of layout" target sits below the measured cards.
    gridStyle () {
      if (!this.masonryReady) return null
      const extra = this.editing ? 60 : 0
      return { height: (this.masonryHeight + extra) + 'px' }
    },
    endStyle () {
      if (!this.masonryReady) return null
      return { position: 'absolute', top: this.masonryHeight + 'px', left: '0', right: '0' }
    },
    cells () {
      if (this.editing || this.packed) {
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
  watch: {
    masonry () {
      this.resetMasonry()
    },
    editing () {
      this.resetMasonry()
    },
    packed () {
      this.resetMasonry()
    },
    widgets: {
      handler () {
        this.scheduleMasonry()
      },
      deep: true
    }
  },
  mounted () {
    if (typeof window === 'undefined') return
    window.addEventListener('pointermove', this.onPointerMove, { passive: false })
    window.addEventListener('pointerup', this.onPointerUp)
    window.addEventListener('pointercancel', this.cancelDrag)
    window.addEventListener('keydown', this.onKeyDown)
    this.$nextTick(this.scheduleMasonry)
  },
  beforeUnmount () {
    if (this.masonryTimer) clearTimeout(this.masonryTimer)
    this.disconnectMasonry()
    if (typeof window === 'undefined') return
    window.removeEventListener('pointermove', this.onPointerMove)
    window.removeEventListener('pointerup', this.onPointerUp)
    window.removeEventListener('pointercancel', this.cancelDrag)
    window.removeEventListener('keydown', this.onKeyDown)
  },
  methods: {
    masonryActive () {
      // Edit mode uses the same absolute tiling when the saved dashboard is in
      // masonry mode, so dragging/resizing previews the final arrangement
      // instead of shifting after Save.
      return Boolean(this.masonry) && (this.packed || this.editing)
    },
    cellStyle (entry) {
      if (this.masonryActive()) {
        const style = this.masonryStyles[entry.widget.id]
        if (style) return style
        return { gridColumn: 'span ' + entry.span }
      }
      return this.editing || this.packed ? { gridColumn: 'span ' + entry.span } : null
    },
    resetMasonry () {
      if (this.masonryTimer) {
        clearTimeout(this.masonryTimer)
        this.masonryTimer = null
      }
      this.masonryStyles = {}
      this.masonryHeight = 0
      this.masonryWidth = 0
      if (!this.masonryActive()) {
        this.disconnectMasonry()
        return
      }
      this.$nextTick(this.measureMasonry)
    },
    scheduleMasonry () {
      if (!this.masonryActive()) return
      if (this.masonryTimer) clearTimeout(this.masonryTimer)
      this.masonryTimer = setTimeout(() => {
        this.masonryTimer = null
        this.measureMasonry()
      }, 80)
    },
    measureMasonry () {
      if (!this.masonryActive()) return
      const grid = this.$refs.grid
      if (!grid || typeof window === 'undefined') return
      const width = grid.clientWidth
      const cells = Array.from(grid.querySelectorAll(':scope > .dw-grid__cell'))
      if (!width || !cells.length) return

      // A width change means the previous absolute widths are stale. Drop them
      // so the next pass measures the widgets at their real grid width.
      if (this.masonryWidth && Math.abs(width - this.masonryWidth) > 1) {
        this.masonryStyles = {}
        this.masonryHeight = 0
        this.masonryWidth = width
        this.$nextTick(this.measureMasonry)
        return
      }
      this.masonryWidth = width

      const style = getComputedStyle(grid)
      const gap = parseFloat(style.columnGap) || parseFloat(style.gap) || 16
      const columnWidth = (width - gap * (GRID_COLUMNS - 1)) / GRID_COLUMNS
      const heights = new Array(GRID_COLUMNS).fill(0)
      const styles = {}
      let bottom = 0

      for (const cell of cells) {
        const id = cell.getAttribute('data-widget-id')
        const span = Math.max(1, Math.min(GRID_COLUMNS, Number(cell.getAttribute('data-span')) || GRID_COLUMNS))
        let best = 0
        let top = Infinity
        for (let start = 0; start <= GRID_COLUMNS - span; start++) {
          let candidate = 0
          for (let column = start; column < start + span; column++) {
            if (heights[column] > candidate) candidate = heights[column]
          }
          if (candidate < top - 0.5) {
            top = candidate
            best = start
          }
        }
        if (!Number.isFinite(top)) top = 0
        const cellWidth = span * columnWidth + (span - 1) * gap
        styles[id] = {
          position: 'absolute',
          top: Math.round(top) + 'px',
          left: Math.round(best * (columnWidth + gap)) + 'px',
          width: Math.round(cellWidth) + 'px'
        }
        const next = top + cell.offsetHeight + gap
        for (let column = best; column < best + span; column++) heights[column] = next
        if (next > bottom) bottom = next
      }

      this.masonryStyles = styles
      this.masonryHeight = Math.max(0, Math.round(bottom - gap))
      this.observeMasonry(cells, grid)
    },
    observeMasonry (cells, grid) {
      if (typeof ResizeObserver === 'undefined') return
      if (!this.resizeObserver) {
        this.resizeObserver = new ResizeObserver(() => this.scheduleMasonry())
      }
      this.resizeObserver.disconnect()
      this.resizeObserver.observe(grid)
      if (!this.masonryObserver) {
        this.masonryObserver = new ResizeObserver(() => this.scheduleMasonry())
      }
      this.masonryObserver.disconnect()
      for (const cell of cells) this.masonryObserver.observe(cell)
    },
    disconnectMasonry () {
      if (this.resizeObserver) {
        this.resizeObserver.disconnect()
        this.resizeObserver = null
      }
      if (this.masonryObserver) {
        this.masonryObserver.disconnect()
        this.masonryObserver = null
      }
    },
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
    configurableFor (widget) {
      return widgetMeta(widget.type)?.configurable !== false
    },
    guestBlocked (widget) {
      return Boolean(widgetMeta(widget.type)?.requiresAccount) && !this.signedIn
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
