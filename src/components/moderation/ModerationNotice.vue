<template>
  <aside v-if="decision && decision.primary" class="mod-notice" :class="{ 'mod-notice--compact': compact }">
    <div class="mod-notice__row">
      <q-icon name="shield" size="14px" aria-hidden="true" />
      <span class="mod-notice__label">{{ decision.primary.label }}</span>
      <span v-if="decision.conflict" class="mod-notice__conflict">Follow beats a subscribed mute list</span>
      <button
        type="button"
        class="mod-notice__link"
        :aria-expanded="expanded ? 'true' : 'false'"
        @click="expanded = !expanded"
      >
        Why?
      </button>
      <button
        v-if="canShowAnyway"
        type="button"
        class="mod-notice__action"
        @click="$emit('show')"
      >
        Show anyway
      </button>
    </div>

    <div v-if="showDisclosure" class="mod-notice__disclosure">
      <p>
        Balanced mode labels or collapses some content instead of deleting it.
        Nothing was removed from the blockchain.
      </p>
      <div class="mod-notice__actions">
        <button type="button" @click="$emit('dismiss-disclosure')">Got it</button>
        <router-link to="/settings/moderation">Review settings</router-link>
      </div>
    </div>

    <div v-if="expanded" class="mod-notice__details">
      <p v-for="reason in decision.reasons" :key="reason.layer + '|' + reason.label" class="mod-notice__reason">
        <strong>{{ reason.label }}</strong>
        <span v-if="reason.detail"> {{ reason.detail }}</span>
        <span v-if="evidenceLabel(reason)" class="mod-notice__evidence">{{ evidenceLabel(reason) }}</span>
      </p>
      <div v-if="downvoters.length" class="mod-notice__voters">
        <span class="mod-notice__evidence">Downvoters (local exclusion only):</span>
        <button
          v-for="voter in downvoters"
          :key="'voter-' + voter.voter"
          type="button"
          class="mod-notice__voter"
          @click="$emit('ignore-voter', voter.voter)"
        >
          {{ voter.ignored ? 'Unignore' : 'Ignore' }} @{{ voter.voter }}
        </button>
      </div>
      <div class="mod-notice__actions">
        <button v-if="canShowAnyway" type="button" @click="$emit('show')">Show this item</button>
        <button v-if="decision.overrides.includes('always-show-author')" type="button" @click="$emit('show-author')">
          Always show @{{ decision.author }}
        </button>
        <button v-if="decision.overrides.includes('always-hide-author')" type="button" @click="$emit('hide-author')">
          Always hide @{{ decision.author }}
        </button>
        <router-link v-if="decision.community" :to="'/c/' + decision.community">Community context</router-link>
        <router-link to="/settings/moderation">Manage moderation</router-link>
      </div>
    </div>
  </aside>
</template>

<style scoped>
.mod-notice {
  margin: 0.35rem 0;
  padding: 0.4rem 0.55rem;
  border: 1px solid color-mix(in srgb, var(--c-warning) 32%, var(--c-border));
  border-radius: var(--radius-card);
  background: color-mix(in srgb, var(--c-warning) 7%, var(--c-surface-2));
  color: var(--c-text-muted);
  font-size: 0.74rem;
  line-height: 1.45;
}

.mod-notice--compact {
  margin: 0.2rem 0 0;
  padding: 0.3rem 0.45rem;
}

.mod-notice__row {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 0.35rem;
}

.mod-notice__label {
  color: var(--c-text);
  font-weight: 600;
}

.mod-notice__conflict {
  color: var(--c-warning);
}

.mod-notice__link,
.mod-notice__action,
.mod-notice__actions button {
  border: 0;
  background: none;
  color: var(--c-link);
  font: inherit;
  font-weight: 600;
  cursor: pointer;
  padding: 0;
  text-decoration: underline;
  text-underline-offset: 2px;
}

.mod-notice__action {
  margin-left: auto;
}

.mod-notice__disclosure {
  margin-top: 0.35rem;
  padding-top: 0.35rem;
  border-top: 1px solid color-mix(in srgb, var(--c-warning) 20%, transparent);
}

.mod-notice__disclosure p {
  margin: 0 0 0.3rem;
}

.mod-notice__details {
  margin-top: 0.35rem;
  padding-top: 0.35rem;
  border-top: 1px solid color-mix(in srgb, var(--c-warning) 20%, transparent);
}

.mod-notice__reason {
  margin: 0.15rem 0;
}

.mod-notice__evidence {
  display: block;
  color: var(--c-text-faint);
  font-size: 0.7rem;
}

.mod-notice__actions {
  display: flex;
  flex-wrap: wrap;
  gap: 0.6rem;
  margin-top: 0.4rem;
}

.mod-notice__voters {
  display: flex;
  flex-wrap: wrap;
  gap: 0.35rem 0.6rem;
  margin-top: 0.35rem;
}

.mod-notice__voter {
  border: 0;
  background: none;
  color: var(--c-link);
  font: inherit;
  font-weight: 600;
  cursor: pointer;
  padding: 0;
  text-decoration: underline;
  text-underline-offset: 2px;
}
</style>

<script>
export default {
  name: 'ModerationNotice',
  props: {
    decision: { type: Object, required: true },
    compact: { type: Boolean, default: false },
    showDisclosure: { type: Boolean, default: false }
  },
  emits: ['show', 'show-author', 'hide-author', 'ignore-voter', 'dismiss-disclosure'],
  data () {
    return {
      expanded: false
    }
  },
  computed: {
    canShowAnyway () {
      return this.decision.display === 'collapse' || this.decision.display === 'hide'
    },
    downvoters () {
      return Array.isArray(this.decision.downvoters) ? this.decision.downvoters : []
    }
  },
  methods: {
    evidenceLabel (reason) {
      const evidence = reason && reason.evidence
      if (!evidence) return ''
      if (Array.isArray(evidence.owners) && evidence.owners.length) {
        return 'Lists: ' + evidence.owners.map(owner => '@' + owner).join(', ')
      }
      if (Number.isFinite(Number(evidence.listErrors)) && Number(evidence.listErrors) > 0) {
        return Number(evidence.listErrors) + ' list(s) unavailable'
      }
      if (Number.isFinite(Number(evidence.listTruncated)) && Number(evidence.listTruncated) > 0) {
        return Number(evidence.listTruncated) + ' list index(es) partial'
      }
      if (evidence.sourceOwner) {
        return 'Source: @' + evidence.sourceOwner +
          (evidence.sourceAsOf ? ' · as of ' + evidence.sourceAsOf : '')
      }
      if (Number.isFinite(Number(evidence.reputation))) return 'Reputation: ' + evidence.reputation
      if (Number.isFinite(Number(evidence.ignoredDownvotes)) && Number(evidence.ignoredDownvotes) > 0) {
        return Number(evidence.ignoredDownvotes) + ' ignored downvote(s) excluded locally; raw chain weight unchanged'
      }
      if (Number.isFinite(Number(evidence.netRshares)) && Number(evidence.netRshares) < 0) {
        return 'Net vote weight is negative'
      }
      return ''
    }
  }
}
</script>
