<template>
  <q-dialog
    :model-value="modelValue"
    position="right"
    maximized
    transition-show="slide-left"
    transition-hide="slide-right"
    @update:model-value="$emit('update:modelValue', $event)"
  >
    <q-card class="dw-drawer" aria-labelledby="dw-drawer-title">
      <q-card-section class="dw-drawer__head">
        <div>
          <div class="home-eyebrow">Add to dashboard</div>
          <h2 id="dw-drawer-title" class="dw-drawer__title">Widgets</h2>
        </div>
        <q-btn flat dense round icon="close" aria-label="Close the widget drawer" v-close-popup />
      </q-card-section>

      <q-card-section class="dw-drawer__body">
        <q-input
          v-model="query"
          dense
          outlined
          clearable
          placeholder="Search widgets"
          aria-label="Search widgets"
          class="dw-drawer__search"
        >
          <template #prepend>
            <q-icon name="search" size="18px" />
          </template>
        </q-input>

        <p v-if="!signedIn" class="dw-drawer__note">
          Account widgets show a log-in prompt until you sign in. Your layout is saved to this browser either way.
        </p>

        <div v-if="visibleGroups.length" class="dw-drawer__groups">
          <section v-for="group in visibleGroups" :key="group.id" class="dw-drawer__group">
            <h3 class="dw-drawer__group-title">{{ group.label }}</h3>
            <ul class="dw-drawer__list" role="list">
              <li v-for="entry in group.widgets" :key="entry.type" class="dw-drawer__item">
                <span class="dw-drawer__icon" aria-hidden="true"><q-icon :name="entry.icon" size="18px" /></span>
                <div class="dw-drawer__text">
                  <div class="dw-drawer__label">
                    {{ entry.label }}
                    <span v-if="entry.added && entry.singleton" class="dw-drawer__tag">On dashboard</span>
                  </div>
                  <p class="dw-drawer__desc">{{ entry.description }}</p>
                  <p v-if="entry.disabled && entry.reason" class="dw-drawer__reason">{{ entry.reason }}</p>
                  <p v-else-if="entry.note" class="dw-drawer__reason">{{ entry.note }}</p>
                </div>
                <q-btn
                  no-caps
                  dense
                  unelevated
                  color="primary"
                  icon="add"
                  :label="entry.added && !entry.singleton ? 'Add again' : 'Add'"
                  :disable="entry.disabled"
                  :aria-label="'Add ' + entry.label"
                  @click="$emit('add', entry.type)"
                />
              </li>
            </ul>
          </section>
        </div>

        <div v-else class="dw-drawer__empty">
          <q-icon name="search_off" size="26px" aria-hidden="true" />
          <p>No widgets match “{{ query.trim() }}”.</p>
        </div>
      </q-card-section>

      <q-card-section class="dw-drawer__foot">
        <span>{{ totalCount }} widget{{ totalCount === 1 ? '' : 's' }} on your dashboard · {{ remaining }} can be added</span>
        <q-btn flat no-caps label="Done" v-close-popup />
      </q-card-section>
    </q-card>
  </q-dialog>
</template>

<style scoped>
.dw-drawer {
  display: flex;
  flex-direction: column;
  width: min(420px, 100vw);
  max-width: 100vw;
  background: var(--c-bg-deep);
}

.dw-drawer__head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: var(--space-2);
  border-bottom: 1px solid var(--border-subtle);
}

.dw-drawer__title {
  margin: 0.1rem 0 0;
  color: var(--c-text);
  font-size: 1.15rem;
  font-weight: 600;
}

.dw-drawer__body {
  flex: 1;
  overflow-y: auto;
}

.dw-drawer__search {
  margin-bottom: 0.5rem;
}

.dw-drawer__note {
  margin: 0 0 0.6rem;
  padding: 0.45rem 0.6rem;
  border-radius: var(--radius-sm);
  background: color-mix(in srgb, var(--c-warning) 8%, transparent);
  color: var(--c-warning-soft);
  font-size: 0.74rem;
  line-height: 1.4;
}

.dw-drawer__groups {
  display: flex;
  flex-direction: column;
  gap: 0.9rem;
}

.dw-drawer__group-title {
  margin: 0 0 0.25rem;
  color: var(--c-text-faint);
  font-size: 0.66rem;
  font-weight: 600;
  letter-spacing: 0.07em;
  text-transform: uppercase;
}

.dw-drawer__list {
  display: flex;
  flex-direction: column;
  margin: 0;
  padding: 0;
  list-style: none;
}

.dw-drawer__item {
  display: flex;
  align-items: flex-start;
  gap: 0.6rem;
  padding: 0.55rem 0;
  border-top: 1px solid var(--border-subtle);
}

.dw-drawer__item:first-child {
  border-top: 0;
}

.dw-drawer__icon {
  display: inline-flex;
  flex: none;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border-radius: var(--radius-sm);
  background: color-mix(in srgb, var(--c-text) 5%, transparent);
  color: var(--c-link-hover);
}

.dw-drawer__text {
  flex: 1;
  min-width: 0;
}

.dw-drawer__label {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 0.35rem;
  color: var(--c-text);
  font-size: 0.85rem;
  font-weight: 600;
}

.dw-drawer__tag {
  padding: 0.02rem 0.35rem;
  border-radius: var(--radius-pill);
  background: color-mix(in srgb, var(--c-link) 14%, transparent);
  color: var(--c-link-hover);
  font-size: 0.62rem;
  font-weight: 600;
  letter-spacing: 0.03em;
  text-transform: uppercase;
}

.dw-drawer__desc {
  margin: 0.15rem 0 0;
  color: var(--c-text-subtle);
  font-size: 0.74rem;
  line-height: 1.35;
}

.dw-drawer__reason {
  margin: 0.2rem 0 0;
  color: var(--c-warning-soft);
  font-size: 0.7rem;
}

.dw-drawer__empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.4rem;
  padding: 2rem 1rem;
  color: var(--c-text-faint);
  font-size: 0.8rem;
  text-align: center;
}

.dw-drawer__empty p {
  margin: 0;
}

.dw-drawer__foot {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-2);
  border-top: 1px solid var(--border-subtle);
  color: var(--c-text-faint);
  font-size: 0.72rem;
}

@media (min-width: 600px) {
  .dw-drawer {
    height: 100%;
  }
}
</style>

<script>
import { widgetCatalogue } from 'src/services/dashboardEditing'
import { MAX_WIDGETS } from 'src/services/dashboardLayout'

export default {
  name: 'AddWidgetDrawer',
  props: {
    modelValue: { type: Boolean, default: false },
    layout: { type: Array, default: () => [] },
    signedIn: { type: Boolean, default: true }
  },
  emits: ['update:modelValue', 'add'],
  data () {
    return {
      query: ''
    }
  },
  computed: {
    groups () {
      return widgetCatalogue(this.layout, { signedIn: this.signedIn })
    },
    visibleGroups () {
      const needle = this.query.trim().toLowerCase()
      if (!needle) return this.groups
      return this.groups
        .map(group => ({
          ...group,
          widgets: group.widgets.filter(entry => (
            entry.label.toLowerCase().includes(needle) ||
            entry.description.toLowerCase().includes(needle) ||
            group.label.toLowerCase().includes(needle)
          ))
        }))
        .filter(group => group.widgets.length)
    },
    totalCount () {
      return this.layout.length
    },
    remaining () {
      const addable = this.groups.reduce((total, group) => total + group.widgets.filter(entry => !entry.disabled).length, 0)
      return Math.min(addable, Math.max(0, MAX_WIDGETS - this.layout.length))
    }
  }
}
</script>
