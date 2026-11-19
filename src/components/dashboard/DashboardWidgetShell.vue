<template>
  <q-card
    flat
    bordered
    class="home-card home-panel dw-widget"
    :class="{ 'dw-widget--editing': editing, 'dw-widget--dragging': dragging, 'dw-widget--dropping': dropping }"
  >
    <q-card-section
      v-if="!hideHeader || editing"
      class="home-panel__head dw-widget__head"
      :class="{ 'dw-widget__head--bare': hideHeader }"
    >
      <div v-if="!hideHeader" class="dw-widget__heading">
        <div class="home-eyebrow">
          <slot name="eyebrow">
            <span>{{ meta.categoryLabel || meta.label }}</span>
          </slot>
        </div>
        <h2 class="home-panel__title dw-widget__title">
          <slot name="title">{{ meta.label }}</slot>
        </h2>
      </div>

      <div class="home-panel__actions dw-widget__actions">
        <slot name="actions" />
        <slot name="menu">
          <q-btn
            v-if="editing"
            flat
            dense
            round
            icon="more_vert"
            size="sm"
            :aria-label="'Options for ' + meta.label"
            :title="'Options for ' + meta.label"
          >
            <q-menu auto-close anchor="bottom right" self="top right">
              <q-list style="min-width: 200px">
                <q-item v-if="configurable" clickable @click="$emit('configure', widget)">
                  <q-item-section avatar><q-icon name="tune" /></q-item-section>
                  <q-item-section>Configure</q-item-section>
                </q-item>
                <q-item :disable="moveUpDisabled" clickable @click="$emit('nudge', { widget, direction: -1 })">
                  <q-item-section avatar><q-icon name="arrow_upward" /></q-item-section>
                  <q-item-section>Move earlier</q-item-section>
                </q-item>
                <q-item :disable="moveDownDisabled" clickable @click="$emit('nudge', { widget, direction: 1 })">
                  <q-item-section avatar><q-icon name="arrow_downward" /></q-item-section>
                  <q-item-section>Move later</q-item-section>
                </q-item>
                <q-separator />
                <q-item clickable @click="$emit('remove', widget)">
                  <q-item-section avatar><q-icon name="visibility_off" /></q-item-section>
                  <q-item-section>Remove widget</q-item-section>
                </q-item>
              </q-list>
            </q-menu>
          </q-btn>
        </slot>
      </div>
    </q-card-section>

    <q-card-section v-if="guestBlocked" class="dw-widget__guest">
      <q-icon name="lock_person" size="26px" aria-hidden="true" />
      <div>
        <div class="dw-widget__guest-title">{{ meta.label }} needs an account</div>
        <p class="dw-widget__guest-text">
          Log in to see your own numbers here. The dashboard stays saved to this browser until then.
        </p>
      </div>
    </q-card-section>

    <q-card-section v-else-if="unavailable" class="dw-widget__guest">
      <q-icon name="info" size="26px" aria-hidden="true" />
      <div>
        <div class="dw-widget__guest-title">{{ meta.label }} is not available yet</div>
        <p class="dw-widget__guest-text">
          This widget ships shortly. Your layout and settings stay saved on this browser.
        </p>
      </div>
    </q-card-section>

    <template v-else>
      <slot />
    </template>

    <div v-if="editing" class="dw-widget__edit-bar">
      <button
        type="button"
        class="dw-widget__drag-handle"
        :aria-label="'Move ' + meta.label + ' — drag, or press Enter then use the arrow keys'"
        :title="'Drag to reorder ' + meta.label"
        @pointerdown.prevent="$emit('drag-start', { widget, event: $event })"
        @keydown.enter.prevent="$emit('pick-up', widget)"
      >
        <q-icon name="drag_indicator" size="18px" aria-hidden="true" />
        <span>Drag to reorder</span>
      </button>

      <div class="dw-widget__width" role="group" :aria-label="'Width of ' + meta.label">
        <button
          type="button"
          class="dw-widget__width-btn"
          :disabled="!canNarrow"
          :aria-label="'Make ' + meta.label + ' narrower'"
          :title="'Narrower than ' + widthLabel"
          @click="$emit('width-step', { widget, direction: -1 })"
        >
          <q-icon name="remove" size="15px" aria-hidden="true" />
        </button>
        <span class="dw-widget__width-label" aria-live="polite">{{ widthLabel }}</span>
        <button
          type="button"
          class="dw-widget__width-btn"
          :disabled="!canWiden"
          :aria-label="'Make ' + meta.label + ' wider'"
          :title="'Wider than ' + widthLabel"
          @click="$emit('width-step', { widget, direction: 1 })"
        >
          <q-icon name="add" size="15px" aria-hidden="true" />
        </button>
      </div>
    </div>
  </q-card>
</template>

<style scoped>
.dw-widget {
  display: flex;
  flex-direction: column;
  height: 100%;
  transition: opacity 0.15s ease, box-shadow 0.15s ease, transform 0.15s ease;
}

.dw-widget--editing {
  box-shadow: inset 0 0 0 1px rgba(79, 195, 247, 0.35);
}

.dw-widget--dragging {
  opacity: 0.45;
}

.dw-widget--dropping {
  box-shadow: inset 0 0 0 2px rgba(79, 195, 247, 0.9);
  transform: translateY(-1px);
}

.dw-widget__head--bare {
  justify-content: flex-end;
}

.dw-widget__heading {
  min-width: 0;
}

.dw-widget__title {
  display: flex;
  align-items: center;
  gap: 0.35rem;
}

.dw-widget__guest {
  display: flex;
  align-items: flex-start;
  gap: 0.75rem;
  color: #90a4ae;
}

.dw-widget__guest-title {
  color: #e4eaed;
  font-size: 0.9rem;
  font-weight: 600;
}

.dw-widget__guest-text {
  margin: 0.25rem 0 0;
  font-size: 0.8rem;
  line-height: 1.45;
}

.dw-widget__edit-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
  margin-top: auto;
  padding: 0.4rem 0.75rem;
  border-top: 1px dashed var(--border-subtle);
  background: rgba(79, 195, 247, 0.05);
}

.dw-widget__drag-handle {
  display: inline-flex;
  align-items: center;
  gap: 0.3rem;
  padding: 0.2rem 0.35rem;
  border: 0;
  border-radius: var(--radius-sm, 6px);
  background: transparent;
  color: #90a4ae;
  font: inherit;
  font-size: 0.72rem;
  cursor: grab;
  touch-action: none;
}

.dw-widget__drag-handle:hover,
.dw-widget__drag-handle:focus-visible {
  background: rgba(255, 255, 255, 0.07);
  color: #e4eaed;
}

.dw-widget__drag-handle:active {
  cursor: grabbing;
}

.dw-widget__width {
  display: flex;
  align-items: center;
  gap: 0.2rem;
}

.dw-widget__width-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 22px;
  height: 22px;
  padding: 0;
  border: 1px solid var(--border-subtle);
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.03);
  color: #b0bec5;
  cursor: pointer;
}

.dw-widget__width-btn:hover:not(:disabled),
.dw-widget__width-btn:focus-visible {
  border-color: rgba(79, 195, 247, 0.5);
  background: rgba(79, 195, 247, 0.12);
  color: #e1f5fe;
}

.dw-widget__width-btn:disabled {
  opacity: 0.3;
  cursor: not-allowed;
}

.dw-widget__width-label {
  min-width: 4.6rem;
  color: #78909c;
  font-size: 0.7rem;
  letter-spacing: 0.04em;
  text-align: center;
  text-transform: uppercase;
}

@media (prefers-reduced-motion: reduce) {
  .dw-widget {
    transition: none;
  }
}
</style>

<script>
import { WIDGET_WIDTHS, widthChoicesFor } from 'src/services/dashboardLayout'

export default {
  name: 'DashboardWidgetShell',
  props: {
    widget: { type: Object, required: true },
    meta: { type: Object, required: true },
    editing: { type: Boolean, default: false },
    dragging: { type: Boolean, default: false },
    dropping: { type: Boolean, default: false },
    guestBlocked: { type: Boolean, default: false },
    // Nothing renders this widget type yet; show a placeholder, not an empty card.
    unavailable: { type: Boolean, default: false },
    // The wrapped component renders its own `home-panel__head` (all five live
    // cards do). The shell then shows only its own action buttons there — never
    // a second title or category line above the card's own header.
    hideHeader: { type: Boolean, default: false },
    configurable: { type: Boolean, default: true },
    index: { type: Number, default: 0 },
    count: { type: Number, default: 1 }
  },
  emits: ['configure', 'width-step', 'nudge', 'remove', 'drag-start', 'pick-up'],
  computed: {
    widthLabel () {
      const match = WIDGET_WIDTHS.find(entry => entry.value === this.widget.width)
      return match ? match.label : this.widget.width
    },
    widthChoices () {
      return widthChoicesFor(this.widget.type)
    },
    widthIndex () {
      return this.widthChoices.indexOf(this.widget.width)
    },
    canNarrow () {
      return this.widthIndex > 0
    },
    canWiden () {
      return this.widthIndex !== -1 && this.widthIndex < this.widthChoices.length - 1
    },
    moveUpDisabled () {
      return this.index <= 0
    },
    moveDownDisabled () {
      return this.index >= this.count - 1
    }
  }
}
</script>
