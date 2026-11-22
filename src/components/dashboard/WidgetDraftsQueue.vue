<template>
  <div class="dw-local">
    <q-card-section class="home-panel__head">
      <div>
        <div class="home-eyebrow">Local to this browser</div>
        <h2 class="home-panel__title">Drafts &amp; queue</h2>
      </div>
      <q-btn
        flat
        dense
        round
        size="sm"
        icon="refresh"
        aria-label="Re-read local drafts"
        title="Re-read local drafts"
        @click="refreshDrafts"
      />
    </q-card-section>

    <q-card-section v-if="storageError" class="dw-local__warn" role="status">
      <q-icon name="warning" size="15px" aria-hidden="true" />
      <span>Local drafts could not be read in this browser.</span>
    </q-card-section>

    <q-card-section v-if="!hasContent" class="home-panel__state">
      <q-icon name="check_circle" size="22px" aria-hidden="true" />
      <span>Nothing in progress. Drafts and queued actions appear here.</span>
      <router-link to="/compose" class="home-panel__link">Start a draft</router-link>
    </q-card-section>

    <q-card-section v-else class="dw-local__body">
      <section v-if="showDrafts" class="dw-local__section" aria-labelledby="dw-local-drafts">
        <div class="dw-local__section-head">
          <h3 id="dw-local-drafts" class="dw-local__section-title">Drafts</h3>
          <span class="dw-local__section-meta">
            <template v-if="summary.archivedCount">{{ summary.archivedCount }} archived</template>
            <template v-else>Active</template>
          </span>
        </div>

        <div v-if="summary.hasDrafts" class="dw-local__draft">
          <span class="dw-local__big">{{ summary.draftCount }}</span>
          <div class="dw-local__draft-copy">
            <span class="dw-local__label">{{ summary.draftCount === 1 ? 'draft waiting' : 'drafts waiting' }}</span>
            <router-link
              v-if="summary.oldestDraft"
              to="/compose"
              class="dw-local__oldest"
              :title="summary.oldestDraft.title"
            >
              Oldest: {{ summary.oldestDraft.title }}
            </router-link>
            <span v-if="summary.oldestDraft" class="dw-local__age">{{ summary.oldestDraft.ageLabel }}</span>
          </div>
        </div>
        <p v-else class="dw-local__note">No active drafts.</p>
      </section>

      <section v-if="showQueue" class="dw-local__section" aria-labelledby="dw-local-queue">
        <div class="dw-local__section-head">
          <h3 id="dw-local-queue" class="dw-local__section-title">Signing queue</h3>
          <span class="dw-local__section-meta">{{ summary.queueCount }} total</span>
        </div>

        <dl class="dw-local__counts">
          <div>
            <dt>Queued</dt>
            <dd>{{ summary.pendingCount }}</dd>
          </div>
          <div>
            <dt>Failed</dt>
            <dd :class="{ 'is-warn': summary.failedCount > 0 }">{{ summary.failedCount }}</dd>
          </div>
          <div>
            <dt>Sent</dt>
            <dd>{{ summary.sentCount }}</dd>
          </div>
        </dl>

        <p v-if="summary.nextQueueLabel" class="dw-local__next">
          <q-icon name="playlist_add_check" size="14px" aria-hidden="true" />
          <span>Next: {{ summary.nextQueueLabel }}</span>
        </p>
        <p v-else-if="!summary.hasPendingQueue" class="dw-local__note">Nothing waiting to be signed.</p>
      </section>
    </q-card-section>

    <q-card-section class="home-panel__footer">
      <router-link to="/compose">Open drafts</router-link>
      <span class="dw-local__hint">Use the queue button in the header to review queued actions. Nothing leaves this browser until you send it.</span>
    </q-card-section>
  </div>
</template>

<style scoped>
.dw-local {
  display: flex;
  flex-direction: column;
  min-width: 0;
}

.dw-local__warn {
  display: flex;
  align-items: center;
  gap: 0.35rem;
  padding: 0.35rem 1rem;
  color: var(--c-warning);
  font-size: 0.72rem;
}

.dw-local__body {
  display: flex;
  flex-direction: column;
  gap: 0.6rem;
  padding-top: 0.5rem;
}

.dw-local__section {
  display: flex;
  flex-direction: column;
  gap: 0.3rem;
}

.dw-local__section-head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 0.5rem;
}

.dw-local__section-title {
  margin: 0;
  color: var(--c-text-subtle);
  font-size: 0.64rem;
  font-weight: 600;
  letter-spacing: 0.06em;
  text-transform: uppercase;
}

.dw-local__section-meta {
  color: var(--c-text-faint);
  font-size: 0.64rem;
}

.dw-local__draft {
  display: flex;
  align-items: center;
  gap: 0.65rem;
  padding: 0.45rem 0.55rem;
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-sm);
  background: color-mix(in srgb, var(--c-text) 3%, transparent);
}

.dw-local__big {
  flex: none;
  color: var(--c-text);
  font-size: 1.35rem;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
  line-height: 1;
}

.dw-local__draft-copy {
  display: flex;
  flex: 1;
  flex-direction: column;
  gap: 0.1rem;
  min-width: 0;
}

.dw-local__label {
  color: var(--c-text-soft);
  font-size: 0.68rem;
  letter-spacing: 0.03em;
  text-transform: uppercase;
}

.dw-local__oldest {
  overflow: hidden;
  color: var(--c-text);
  font-size: 0.78rem;
  font-weight: 600;
  text-decoration: none;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.dw-local__oldest:hover {
  color: var(--c-link-hover);
  text-decoration: underline;
}

.dw-local__age {
  color: var(--c-text-faint);
  font-size: 0.64rem;
}

.dw-local__counts {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 0.3rem;
  margin: 0;
}

.dw-local__counts > div {
  display: flex;
  flex-direction: column;
  gap: 0.1rem;
  min-width: 0;
  padding: 0.35rem 0.45rem;
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-sm);
  background: color-mix(in srgb, var(--c-text) 3%, transparent);
}

.dw-local__counts dt {
  color: var(--c-text-subtle);
  font-size: 0.58rem;
  letter-spacing: 0.04em;
  text-transform: uppercase;
}

.dw-local__counts dd {
  margin: 0;
  color: var(--c-text);
  font-size: 0.95rem;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
}

.dw-local__counts dd.is-warn {
  color: var(--c-warning);
}

.dw-local__next {
  display: flex;
  align-items: flex-start;
  gap: 0.3rem;
  margin: 0;
  padding: 0.35rem 0.45rem;
  border-radius: var(--radius-sm);
  background: color-mix(in srgb, var(--c-link) 7%, transparent);
  color: var(--c-text-soft);
  font-size: 0.7rem;
  line-height: 1.35;
}

.dw-local__note {
  margin: 0;
  color: var(--c-text-faint);
  font-size: 0.7rem;
}

.dw-local__hint {
  color: var(--c-text-faint);
  font-size: 0.64rem;
}

@media (max-width: 479px) {
  .dw-local__hint {
    display: none;
  }
}
</style>

<script>
import { readDraftState } from 'src/services/drafts'
import { draftsQueueSummary } from 'src/services/draftsQueueSummary'

export default {
  name: 'WidgetDraftsQueue',
  props: {
    showDrafts: { type: Boolean, default: true },
    showQueue: { type: Boolean, default: true }
  },
  data () {
    return {
      drafts: [],
      storageError: false,
      nowTick: Date.now()
    }
  },
  computed: {
    queue () {
      return Array.isArray(this.$hiveStore?.queue) ? this.$hiveStore.queue : []
    },
    queueMeta () {
      return Array.isArray(this.$hiveStore?.queueMeta) ? this.$hiveStore.queueMeta : []
    },
    summary () {
      return draftsQueueSummary({
        drafts: this.drafts,
        queue: this.queue,
        queueMeta: this.queueMeta,
        now: this.nowTick
      })
    },
    hasContent () {
      const drafts = this.showDrafts && (this.summary.hasDrafts || this.summary.archivedCount > 0)
      const queue = this.showQueue && this.summary.hasPendingQueue
      return drafts || queue
    }
  },
  watch: {
    queue: {
      handler () {
        this.nowTick = Date.now()
      },
      deep: true
    },
    queueMeta: {
      handler () {
        this.nowTick = Date.now()
      },
      deep: true
    }
  },
  mounted () {
    this.refreshDrafts()
  },
  methods: {
    refreshDrafts () {
      this.storageError = false
      this.nowTick = Date.now()
      try {
        const storage = typeof window !== 'undefined' ? window.localStorage : null
        if (!storage) {
          this.drafts = []
          this.storageError = true
          return
        }
        this.drafts = readDraftState(storage).drafts
      } catch (error) {
        console.error('Failed to read local drafts', error)
        this.drafts = []
        this.storageError = true
      }
    }
  }
}
</script>
