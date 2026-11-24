<template>
  <div class="dw-safety">
    <q-card-section class="home-panel__head dw-safety__head">
      <div>
        <div class="home-eyebrow">Warning only</div>
        <h2 class="home-panel__title">
          <template v-if="targetAccount">@{{ targetAccount }}</template>
          <template v-else>Account safety</template>
        </h2>
      </div>
      <q-btn
        flat
        dense
        round
        icon="refresh"
        aria-label="Recheck the warning lists"
        title="Recheck the warning lists"
        :loading="loading"
        :disable="!targetAccount"
        @click="load(true)"
      />
    </q-card-section>

    <dashboard-widget-state
      v-if="!targetAccount"
      state="guest"
      guest-title="Log in to check this account"
      guest-text="The check compares one public account name against curated warning lists. Nothing is hidden or blocked."
    />

    <dashboard-widget-state
      v-else-if="loading && !loaded"
      state="loading"
    />

    <dashboard-widget-state
      v-else-if="error && !loaded"
      state="error"
      :error="error"
      @retry="load(true)"
    />

    <template v-else-if="loaded">
      <p v-if="error" class="dw-safety__notice" role="status">
        <q-icon name="cloud_off" size="16px" aria-hidden="true" />
        <span>{{ error }}</span>
      </p>

      <div v-if="!selectedSources.length" class="dw-safety__state">
        <q-icon name="tune" size="22px" aria-hidden="true" />
        <div>
          <strong>No lists selected.</strong>
          <span>Choose at least one warning list in widget settings.</span>
        </div>
      </div>

      <template v-else>
        <q-card-section
          class="dw-safety__verdict"
          :class="'dw-safety__verdict--' + summary.level"
          aria-live="polite"
        >
          <q-icon :name="verdictIcon" size="26px" aria-hidden="true" />
          <div class="dw-safety__verdict-copy">
            <strong>{{ summary.levelLabel }}</strong>
            <span v-if="summary.level === 'listed'">
              {{ summary.matches.length }} warning list{{ summary.matches.length === 1 ? '' : 's' }} names this account.
            </span>
            <span v-else-if="summary.level === 'clear'">
              No match in {{ summary.checked }} checked list{{ summary.checked === 1 ? '' : 's' }}.
            </span>
            <span v-else-if="summary.level === 'partial'">
              {{ summary.checked }} of {{ summary.total }} lists checked. A missing list could still contain this account.
            </span>
          </div>
        </q-card-section>

        <ul v-if="summary.hasWarnings" class="dw-safety__matches">
          <li v-for="match in summary.matches" :key="match.id">
            <div class="dw-safety__match-main">
              <span class="dw-safety__match-title">{{ match.title }}</span>
              <span class="dw-safety__match-meta">List by @{{ match.owner }} · as of {{ match.asOf }}</span>
              <span v-if="showCaution" class="dw-safety__match-caution">{{ match.caution }}</span>
            </div>
            <router-link :to="'/@' + match.owner" class="dw-safety__link">Source</router-link>
          </li>
        </ul>

        <ul v-if="summary.failures.length" class="dw-safety__failures">
          <li v-for="failure in summary.failures" :key="'fail-' + failure.id">
            <q-icon name="report_problem" size="14px" aria-hidden="true" />
            <span>{{ failure.title }} could not be read.</span>
          </li>
        </ul>

        <p class="dw-safety__limitation">
          <q-icon name="info" size="14px" aria-hidden="true" />
          <span>{{ summary.limitation }}</span>
        </p>

        <q-card-section class="home-panel__footer dw-safety__footer">
          <router-link to="/settings/moderation">Moderation lists</router-link>
          <router-link :to="'/@' + targetAccount">Open @{{ targetAccount }}</router-link>
          <span>{{ checkedLabel }}</span>
        </q-card-section>
      </template>
    </template>
  </div>
</template>

<style scoped>
.dw-safety {
  display: flex;
  flex-direction: column;
  min-width: 0;
}

.dw-safety__head {
  align-items: flex-start;
}

.dw-safety__notice {
  display: flex;
  align-items: flex-start;
  gap: 0.35rem;
  margin: 0;
  padding: 0.45rem 1rem 0;
  color: var(--c-warning-soft);
  font-size: 0.7rem;
  line-height: 1.4;
}

.dw-safety__state {
  display: flex;
  align-items: flex-start;
  gap: 0.55rem;
  padding: 0.95rem 1rem;
  color: var(--c-text-subtle);
  font-size: 0.8rem;
  line-height: 1.4;
}

.dw-safety__state .q-icon {
  color: var(--c-text-faint);
  flex: none;
}

.dw-safety__state strong {
  display: block;
  color: var(--c-text);
}

.dw-safety__state span {
  display: block;
}

.dw-safety__verdict {
  display: flex;
  align-items: flex-start;
  gap: 0.6rem;
  margin: 0.7rem 1rem 0.4rem;
  padding: 0.6rem 0.7rem;
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-sm);
  background: color-mix(in srgb, var(--c-text) 3%, transparent);
}

.dw-safety__verdict--listed {
  border-color: color-mix(in srgb, var(--c-warning-soft) 45%, var(--border-subtle));
  background: color-mix(in srgb, var(--c-warning-soft) 10%, transparent);
}

.dw-safety__verdict--clear {
  border-color: color-mix(in srgb, var(--c-positive) 40%, var(--border-subtle));
  background: color-mix(in srgb, var(--c-positive) 8%, transparent);
}

.dw-safety__verdict .q-icon {
  flex: none;
  color: var(--c-text-subtle);
}

.dw-safety__verdict--listed .q-icon {
  color: var(--c-warning-soft);
}

.dw-safety__verdict--clear .q-icon {
  color: var(--c-positive);
}

.dw-safety__verdict-copy {
  display: flex;
  flex-direction: column;
  gap: 0.1rem;
  color: var(--c-text-subtle);
  font-size: 0.76rem;
  line-height: 1.4;
}

.dw-safety__verdict-copy strong {
  color: var(--c-text);
  font-size: 0.86rem;
}

.dw-safety__matches {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
  margin: 0;
  padding: 0 1rem 0.4rem;
  list-style: none;
}

.dw-safety__matches li {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 0.5rem;
  padding: 0.45rem 0.55rem;
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-sm);
}

.dw-safety__match-main {
  display: flex;
  flex-direction: column;
  gap: 0.1rem;
  min-width: 0;
}

.dw-safety__match-title {
  color: var(--c-text);
  font-size: 0.78rem;
  font-weight: 600;
}

.dw-safety__match-meta,
.dw-safety__match-caution {
  color: var(--c-text-faint);
  font-size: 0.67rem;
  line-height: 1.35;
}

.dw-safety__link {
  color: var(--c-link);
  font-size: 0.68rem;
  font-weight: 600;
  text-decoration: none;
  white-space: nowrap;
}

.dw-safety__link:hover {
  text-decoration: underline;
}

.dw-safety__failures {
  display: flex;
  flex-direction: column;
  gap: 0.2rem;
  margin: 0;
  padding: 0 1rem 0.35rem;
  list-style: none;
  color: var(--c-warning-soft);
  font-size: 0.7rem;
}

.dw-safety__failures li {
  display: flex;
  align-items: flex-start;
  gap: 0.3rem;
}

.dw-safety__limitation {
  display: flex;
  align-items: flex-start;
  gap: 0.35rem;
  margin: 0;
  padding: 0 1rem 0.45rem;
  color: var(--c-text-faint);
  font-size: 0.67rem;
  line-height: 1.4;
}

.dw-safety__limitation .q-icon,
.dw-safety__failures .q-icon {
  flex: none;
  margin-top: 0.05rem;
}

.dw-safety__footer {
  align-items: center;
  flex-wrap: wrap;
  gap: 0.6rem;
}

@media (max-width: 599px) {
  .dw-safety__verdict,
  .dw-safety__matches,
  .dw-safety__failures,
  .dw-safety__limitation {
    margin-left: 0.7rem;
    margin-right: 0.7rem;
    padding-left: 0;
    padding-right: 0;
  }
}
</style>

<script>
import DashboardWidgetState from 'components/dashboard/DashboardWidgetState.vue'
import {
  MAX_SAFETY_SOURCES,
  normaliseSafetySources,
  safetySourceById,
  safetySummary
} from 'src/services/accountSafety'
import { fetchModerationListNames } from 'src/services/moderationData'

export default {
  name: 'WidgetAccountSafety',
  components: { DashboardWidgetState },
  props: {
    account: { type: String, default: '' },
    sources: { type: Array, default: () => [] },
    showCaution: { type: Boolean, default: true }
  },
  data () {
    return {
      reads: [],
      loading: false,
      loaded: false,
      error: '',
      checkedAt: 0,
      checkedAccount: ''
    }
  },
  computed: {
    targetAccount () {
      const explicit = String(this.account || '').replace(/^@/, '').trim()
      return explicit || String(this.$hiveStore?.user?.username || '').replace(/^@/, '').trim()
    },
    selectedSources () {
      return normaliseSafetySources(this.sources)
    },
    summary () {
      return safetySummary({ account: this.targetAccount, reads: this.reads })
    },
    verdictIcon () {
      if (this.summary.level === 'listed') return 'warning'
      if (this.summary.level === 'clear') return 'verified_user'
      if (this.summary.level === 'partial') return 'help'
      return 'search'
    },
    checkedLabel () {
      if (!this.checkedAt) return 'Not checked'
      return 'Checked ' + new Date(this.checkedAt).toLocaleTimeString([], {
        hour: '2-digit',
        minute: '2-digit'
      })
    }
  },
  watch: {
    targetAccount (value) {
      if (!value || (this.checkedAccount && value !== this.checkedAccount)) this.reset()
      if (value) this.load(false)
    },
    selectedSources () {
      this.load(false)
    }
  },
  mounted () {
    if (this.targetAccount) this.load(false)
    else this.loaded = true
  },
  methods: {
    reset () {
      this.reads = []
      this.loaded = false
      this.loading = false
      this.error = ''
      this.checkedAt = 0
      this.checkedAccount = ''
    },
    async load (force = false) {
      const name = this.targetAccount
      if (!name) {
        this.loaded = true
        return
      }
      const ids = this.selectedSources.slice(0, MAX_SAFETY_SOURCES)
      if (!ids.length) {
        this.reads = []
        this.loaded = true
        this.error = ''
        return
      }

      this.loading = true
      this.error = ''
      const results = await Promise.allSettled(
        ids.map(async id => {
          const source = safetySourceById(id)
          if (!source) return null
          const names = await fetchModerationListNames(source.owner, source.type, { force })
          return { id, names }
        })
      )
      if (this.targetAccount !== name) return

      this.reads = results.map((result, index) => {
        if (result.status === 'fulfilled' && result.value) return result.value
        return {
          id: ids[index],
          error: result.status === 'rejected'
            ? (result.reason?.message || 'List read failed')
            : 'List unavailable'
        }
      })
      const allFailed = this.reads.length > 0 && this.reads.every(read => read.error)
      if (allFailed) this.error = 'The warning lists could not be read. Nothing was checked.'
      this.loaded = true
      this.checkedAccount = name
      this.checkedAt = Date.now()
      this.loading = false
    }
  }
}
</script>
