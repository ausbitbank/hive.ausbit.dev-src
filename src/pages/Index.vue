<template>
  <q-page class="home-page">
    <div class="home-shell">
      <header class="home-head">
        <div class="home-head__text">
          <div class="home-head__eyebrow">
            <span class="home-live-dot is-live" aria-hidden="true"></span>
            Hive network dashboard
          </div>
          <h1 class="home-head__title">Hive at a glance</h1>
          <p class="home-head__tagline">
            Live blocks, markets, governance and community posts — read straight from the Hive blockchain.
          </p>
        </div>

        <nav class="home-links" aria-label="Quick links">
          <router-link class="home-link" to="/created">
            <q-icon name="explore" size="16px" aria-hidden="true" /> Browse posts
          </router-link>
          <router-link class="home-link" to="/shorts">
            <q-icon name="bolt" size="16px" aria-hidden="true" /> Short posts
          </router-link>
          <router-link class="home-link" to="/blocks">
            <q-icon name="view_agenda" size="16px" aria-hidden="true" /> Blocks
          </router-link>
          <router-link class="home-link" to="/witnesses">
            <q-icon name="how_to_vote" size="16px" aria-hidden="true" /> Witnesses
          </router-link>
          <router-link class="home-link" to="/markets">
            <q-icon name="show_chart" size="16px" aria-hidden="true" /> Markets
          </router-link>
          <router-link class="home-link" to="/proposals">
            <q-icon name="account_balance" size="16px" aria-hidden="true" /> Proposals
          </router-link>
          <button
            v-if="!editing"
            type="button"
            class="home-customise"
            @click="startEditing"
          >
            <q-icon name="dashboard_customize" size="16px" aria-hidden="true" />
            Customise
          </button>
        </nav>
      </header>

      <dashboard-customise-bar
        v-if="editing"
        :changes="draftChanges"
        :dirty="dirty"
        :add-disabled="available === 0"
        :layout="draft"
        :tiling="draftTiling"
        :layouts="savedLayouts"
        :active-layout-id="draftLayoutId"
        @save="saveDraft"
        @cancel="cancelEditing"
        @reset="resetToDefault"
        @add="drawerOpen = true"
        @import="importLayout"
        @tiling="setDraftTiling"
        @optimise="optimiseDraft"
        @load-layout="loadNamedLayout"
        @save-layout="saveNamedLayout"
        @rename-layout="renameNamedLayout"
        @delete-layout="deleteNamedLayout"
        @apply-preset="applyPreset"
      />

      <dashboard-setup-prompt
        v-if="setupPromptVisible"
        @apply="useStarterLayout"
        @dismiss="dismissSetupPrompt"
      />

      <dashboard-grid
        v-if="editing"
        class="home-editing"
        :widgets="draft"
        :signed-in="signedIn"
        :masonry="draftTiling === 'masonry'"
        editing
        @move-to="onMoveTo"
        @remove="onRemove"
        @width-step="onWidthStep"
        @configure="openConfigure"
      />

      <dashboard-grid
        v-else
        :widgets="widgets"
        :signed-in="signedIn"
        :masonry="tiling === 'masonry'"
        packed
      />

      <add-widget-drawer
        v-model="drawerOpen"
        :layout="draft"
        :signed-in="signedIn"
        @add="addWidget"
      />

      <widget-settings-dialog
        v-model="configureOpen"
        :widget="configureWidget"
        @save="applyConfigure"
      />
    </div>
  </q-page>
</template>

<style scoped>
.home-page {
  padding-bottom: var(--space-6);
}

.home-shell {
  width: 100%;
  max-width: 1280px;
  margin: 0 auto;
  padding: var(--space-5) var(--space-4) var(--space-6);
}

.home-head {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: var(--space-4);
  flex-wrap: wrap;
  margin-bottom: var(--space-4);
}

.home-head__text {
  min-width: 0;
}

.home-head__eyebrow {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  color: var(--c-text-faint);
  font-size: 0.68rem;
  letter-spacing: 0.07em;
  text-transform: uppercase;
}

.home-head__title {
  margin: 0.25rem 0 0.3rem;
  font-size: clamp(1.6rem, 3vw, 2.1rem);
  font-weight: 600;
  line-height: 1.15;
  letter-spacing: -0.02em;
}

.home-head__tagline {
  max-width: 680px;
  margin: 0;
  color: var(--c-text-subtle);
  font-size: 0.9rem;
  line-height: 1.5;
}

.home-links {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 0.4rem 0.9rem;
  padding-bottom: 0.2rem;
}

.home-link {
  display: inline-flex;
  align-items: center;
  gap: 0.3rem;
  color: var(--c-text-muted);
  font-size: 0.8rem;
  text-decoration: none;
}

.home-link:hover {
  color: var(--c-link-hover);
}

.home-customise {
  display: inline-flex;
  align-items: center;
  gap: 0.3rem;
  padding: 0.22rem 0.6rem;
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-pill);
  background: color-mix(in srgb, var(--c-text) 3%, transparent);
  color: var(--c-text-muted);
  font: inherit;
  font-size: 0.78rem;
  cursor: pointer;
}

.home-customise:hover,
.home-customise:focus-visible {
  border-color: color-mix(in srgb, var(--c-link) 45%, transparent);
  background: color-mix(in srgb, var(--c-link) 10%, transparent);
  color: var(--c-link-soft);
}

@media (max-width: 599px) {
  .home-shell {
    padding: var(--space-3) var(--space-2) var(--space-5);
  }

  .home-head {
    margin-bottom: var(--space-3);
  }

  .home-head__title {
    font-size: 1.5rem;
  }

  .home-links {
    gap: 0.35rem 0.7rem;
  }
}
</style>

<script>
import AddWidgetDrawer from 'components/dashboard/AddWidgetDrawer.vue'
import DashboardCustomiseBar from 'components/dashboard/DashboardCustomiseBar.vue'
import DashboardGrid from 'components/dashboard/DashboardGrid.vue'
import DashboardSetupPrompt from 'components/dashboard/DashboardSetupPrompt.vue'
import WidgetSettingsDialog from 'components/dashboard/WidgetSettingsDialog.vue'
import {
  LOGGED_IN_STARTER_LAYOUT,
  buildLayout,
  moveWidget,
  normaliseLayout,
  optimiseLayout,
  removeWidget,
  stepWidgetWidth
} from 'src/services/dashboardLayout'
import {
  addWidgetToLayout,
  availableWidgetCount,
  draftChanges,
  draftWidgets,
  isDefaultDraft,
  isDirtyDraft,
  updateWidgetSettings
} from 'src/services/dashboardEditing'
import { setPageMeta } from 'src/utils/pageMeta'
import { pruneSnapshots } from 'src/services/snapshots'

export default {
  name: 'Home',
  components: { DashboardGrid, DashboardCustomiseBar, AddWidgetDrawer, DashboardSetupPrompt, WidgetSettingsDialog },
  data () {
    return {
      // Edit mode works on a copy; Save applies it, Cancel throws it away.
      draft: [],
      // Layout the draft started from, for the change summary.
      draftBase: [],
      // Tiling and named layout are part of the draft too, so Cancel reverts
      // them along with the widgets.
      draftTiling: 'rows',
      draftLayoutId: '',
      drawerOpen: false,
      configureOpen: false,
      configureWidget: null
    }
  },
  computed: {
    widgets () {
      return this.$hiveStore.dashboard.widgets
    },
    editing () {
      return this.$hiveStore.dashboard.editing
    },
    tiling () {
      return this.$hiveStore.dashboard.tiling || 'rows'
    },
    savedLayouts () {
      return this.$hiveStore.dashboard.layouts || []
    },
    setupPromptVisible () {
      const dashboard = this.$hiveStore.dashboard
      return Boolean(
        this.signedIn &&
        !this.editing &&
        dashboard.setupPromptVisible &&
        !dashboard.customised
      )
    },
    signedIn () {
      return Boolean(this.$hiveStore.user.username)
    },
    draftChanges () {
      return draftChanges(this.draft, this.draftBase)
    },
    dirty () {
      return isDirtyDraft(this.draft, this.draftBase) ||
        this.draftTiling !== this.tiling ||
        this.draftLayoutId !== (this.$hiveStore.dashboard.activeLayoutId || '')
    },
    available () {
      const base = this.editing ? this.draft : this.widgets
      return availableWidgetCount(base, { signedIn: this.signedIn })
    }
  },
  mounted () {
    setPageMeta({
      title: 'hive.ausbit.dev — Hive block explorer',
      description: 'Explore the Hive blockchain: live blocks, accounts, posts, witnesses, proposals, HBD, markets and API nodes.',
      url: '/'
    })
    // Browse feeds save their own first-page snapshots. Prune expired keys on
    // the landing page so repeat visits cannot fill the origin quota.
    const prune = () => pruneSnapshots()
    if (typeof window !== 'undefined' && typeof window.requestIdleCallback === 'function') {
      window.requestIdleCallback(prune, { timeout: 4000 })
    }
  },
  methods: {
    startEditing () {
      this.draftBase = draftWidgets(this.widgets)
      this.draft = draftWidgets(this.widgets)
      this.draftTiling = this.tiling
      this.draftLayoutId = this.$hiveStore.dashboard.activeLayoutId || ''
      this.$hiveStore.setDashboardEditing(true)
    },
    setDraftTiling (value) {
      this.draftTiling = value === 'masonry' ? 'masonry' : 'rows'
    },
    saveDraft () {
      const customised = this.draftTiling !== 'rows' ||
        Boolean(this.draftLayoutId) ||
        !isDefaultDraft(this.draft)
      this.$hiveStore.applyDashboardWidgets(this.draft, {
        customised,
        tiling: this.draftTiling,
        activeLayoutId: this.draftLayoutId
      })
      // A layout that is already named follows edits made in the editor.
      if (this.draftLayoutId) {
        this.$hiveStore.updateDashboardLayout(this.draftLayoutId, {
          widgets: this.draft,
          tiling: this.draftTiling
        })
      }
      this.finishEditing()
    },
    cancelEditing () {
      this.draft = []
      this.draftBase = []
      this.draftTiling = 'rows'
      this.draftLayoutId = ''
      this.$hiveStore.setDashboardEditing(false)
    },
    resetToDefault () {
      this.$hiveStore.resetDashboard()
      this.finishEditing()
    },
    useStarterLayout () {
      this.$hiveStore.applyDashboardPreset(LOGGED_IN_STARTER_LAYOUT)
      this.dismissSetupPrompt()
    },
    dismissSetupPrompt () {
      this.$hiveStore.dismissDashboardSetupPrompt(this.$hiveStore.user.username)
    },
    finishEditing () {
      this.draft = []
      this.draftBase = []
      this.draftTiling = 'rows'
      this.draftLayoutId = ''
      this.drawerOpen = false
      this.$hiveStore.setDashboardEditing(false)
    },
    optimiseDraft () {
      this.draft = optimiseLayout(this.draft)
      this.$q.notify({ type: 'positive', message: 'Layout optimized — review it, then press Save' })
    },
    loadNamedLayout (layout) {
      if (!layout) return
      this.draft = draftWidgets(layout.widgets)
      this.draftTiling = layout.tiling || 'rows'
      this.draftLayoutId = layout.id
      this.$q.notify({ type: 'info', message: 'Loaded "' + layout.label + '" — press Save to apply' })
    },
    applyPreset (preset) {
      if (!preset) return
      this.draft = draftWidgets(buildLayout(preset.widgets))
      this.draftTiling = preset.tiling === 'masonry' ? 'masonry' : 'rows'
      this.draftLayoutId = ''
      this.$q.notify({ type: 'info', message: 'Loaded "' + preset.label + '" — press Save to apply' })
    },
    saveNamedLayout ({ label = '', id = '' } = {}) {
      const layoutId = this.$hiveStore.saveDashboardLayout(label, {
        widgets: this.draft,
        tiling: this.draftTiling,
        id
      })
      this.draftLayoutId = layoutId
      this.$q.notify({ type: 'positive', message: 'Saved layout "' + label + '"' })
    },
    renameNamedLayout ({ layout, label } = {}) {
      if (!layout) return
      this.$hiveStore.renameDashboardLayout(layout.id, label)
      this.$q.notify({ type: 'positive', message: 'Renamed layout to "' + label + '"' })
    },
    deleteNamedLayout (layout) {
      if (!layout) return
      this.$hiveStore.deleteDashboardLayout(layout.id)
      if (this.draftLayoutId === layout.id) this.draftLayoutId = ''
      this.$q.notify({ type: 'info', message: 'Deleted layout "' + layout.label + '"' })
    },
    onMoveTo ({ widget, to }) {
      this.draft = moveWidget(this.draft, widget.id, to)
    },
    openConfigure (widget) {
      this.configureWidget = widget
      this.configureOpen = true
    },
    applyConfigure ({ widget, settings }) {
      this.draft = updateWidgetSettings(this.draft, widget.id, settings)
    },
    onRemove (widget) {
      this.draft = removeWidget(this.draft, widget.id)
    },
    addWidget (type) {
      this.draft = addWidgetToLayout(this.draft, type)
    },
    importLayout (layout) {
      this.draft = normaliseLayout(layout)
    },
    onWidthStep ({ widget, direction }) {
      this.draft = stepWidgetWidth(this.draft, widget.id, direction)
    }
  }
}
</script>
