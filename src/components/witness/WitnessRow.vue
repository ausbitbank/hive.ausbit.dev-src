<template>
  <li class="witness-row" :class="'witness-row--' + status">
    <div class="witness-row__rank" :title="rank ? 'Vote rank #' + rank : 'Not in the loaded ranked list'">
      <span aria-hidden="true">#</span><span class="sr-only">Rank </span>{{ rank || '—' }}
    </div>

    <router-link :to="'/@' + witness.owner" class="witness-row__avatar" :aria-label="'View @' + witness.owner + ' profile'">
      <q-avatar size="38px">
        <q-img :src="avatarUrl" :alt="'Avatar of @' + witness.owner" />
      </q-avatar>
    </router-link>

    <div class="witness-row__body">
      <div class="witness-row__title">
        <router-link :to="'/@' + witness.owner" class="witness-row__name">@{{ witness.owner }}</router-link>
        <q-badge v-if="rank && rank <= 21" color="green-9" text-color="white" class="witness-row__badge">Consensus</q-badge>
        <q-badge v-else class="witness-row__badge" color="blue-grey-8" text-color="white">Backup</q-badge>
        <q-badge
          class="witness-row__badge"
          :color="versionMismatch ? 'orange-9' : 'green-9'"
          :text-color="versionMismatch ? 'black' : 'white'"
          :title="versionMismatch ? 'Running version differs from the network consensus major/minor version' : 'Running version matches the network consensus major/minor version'"
        >
          v{{ witness.running_version || '?' }}
        </q-badge>
        <q-icon
          v-if="status !== 'ok'"
          :name="status === 'critical' ? 'error' : 'warning'"
          :color="status === 'critical' ? 'red' : 'orange'"
          size="18px"
          :aria-label="status === 'critical' ? 'Critical witness health warning' : 'Witness health warning'"
        />
      </div>

      <div class="witness-row__meta">
        <span :title="'Witness approval: ' + Number(witness.votes || 0).toLocaleString('en-US') + ' micro-VESTS'">
          <q-icon name="how_to_vote" size="14px" aria-hidden="true" />
          {{ votesHp }} votes
        </span>
        <span :title="'Total blocks missed since registration'">
          <q-icon name="block" size="14px" aria-hidden="true" />
          Missed {{ missedLabel }}
        </span>
        <span :title="'Last HBD price feed update'">
          <q-icon name="price_change" size="14px" aria-hidden="true" />
          Feed {{ feedAge }}
        </span>
        <span v-if="interestRate > 0">
          <q-icon name="savings" size="14px" aria-hidden="true" />
          HBD {{ interestRate.toFixed(2) }}%
        </span>
      </div>

      <ul v-if="warnings.length" class="witness-row__warnings">
        <li
          v-for="warning in warnings"
          :key="warning.id"
          class="witness-row__warning"
          :class="'witness-row__warning--' + warning.severity"
        >
          <q-icon :name="warning.icon" size="15px" aria-hidden="true" />
          <span><strong>{{ warning.label }}:</strong> {{ warning.detail }}</span>
        </li>
      </ul>

      <div v-if="votingBlocked" class="witness-row__proxy-note">
        <q-icon name="account_tree" size="15px" aria-hidden="true" />
        <span>Your votes are controlled by proxy @{{ proxy }}. Clear the proxy to vote directly.</span>
      </div>
    </div>

    <div class="witness-row__actions">
      <q-btn
        v-if="loggedIn"
        dense
        no-caps
        :flat="voted"
        :outline="!voted"
        :color="voted ? 'red' : 'green'"
        :icon="voted ? 'remove_circle_outline' : 'how_to_vote'"
        :label="voted ? 'Unvote' : 'Vote'"
        :disable="votingBlocked"
        :title="votingBlocked ? 'Clear your voting proxy first' : (voted ? 'Remove your witness vote' : 'Vote for this witness') + ' (active key required)'"
        :aria-label="(voted ? 'Unvote witness @' : 'Vote for witness @') + witness.owner + ' using active authority'"
        @click="$emit(voted ? 'unvote' : 'vote', witness)"
      >
        <q-badge class="witness-row__authority" color="orange-9" text-color="black">active</q-badge>
      </q-btn>
      <span v-else class="witness-row__login-hint">Log in to vote</span>
      <q-btn
        dense
        flat
        round
        :icon="expanded ? 'expand_less' : 'expand_more'"
        :aria-expanded="expanded"
        :aria-controls="detailsId"
        :aria-label="(expanded ? 'Hide' : 'Show') + ' details for witness @' + witness.owner"
        :title="expanded ? 'Hide witness details' : 'Show witness details'"
        @click="$emit('toggle', witness)"
      />
    </div>

    <div v-show="expanded" :id="detailsId" class="witness-row__details">
      <dl class="witness-row__facts">
        <div>
          <dt>Witness URL</dt>
          <dd>
            <a v-if="safeUrl" :href="safeUrl" target="_blank" rel="noopener noreferrer">{{ prettyUrl }}</a>
            <span v-else>{{ witness.url || 'Not set' }}</span>
          </dd>
        </div>
        <div>
          <dt>Registered</dt>
          <dd>{{ registeredLabel }}</dd>
        </div>
        <div>
          <dt>Last confirmed block</dt>
          <dd>{{ Number(witness.last_confirmed_block_num || 0).toLocaleString('en-US') }}</dd>
        </div>
        <div>
          <dt>Price feed</dt>
          <dd>{{ feedRateLabel }}</dd>
        </div>
        <div>
          <dt>Hardfork vote</dt>
          <dd>v{{ witness.hardfork_version_vote || '—' }}</dd>
        </div>
        <div>
          <dt>HBD APR</dt>
          <dd>{{ interestRate.toFixed(2) }}%</dd>
        </div>
      </dl>

      <div class="witness-row__links">
        <router-link :to="'/@' + witness.owner">Profile</router-link>
        <router-link :to="'/@' + witness.owner + '/blog'">Blog</router-link>
        <router-link :to="'/@' + witness.owner + '/posts'">Posts</router-link>
        <router-link :to="'/@' + witness.owner + '/wallet'">Wallet</router-link>
        <router-link :to="'/witnesses?search=' + encodeURIComponent(witness.owner)">Share this witness</router-link>
      </div>

      <json-viewer :data="witness" class="witness-row__json" tabindex="0" role="region" :aria-label="'Raw witness data for @' + witness.owner" />
    </div>
  </li>
</template>

<style scoped>
.witness-row {
  display: grid;
  grid-template-columns: 2.4rem 40px minmax(0, 1fr) auto;
  align-items: start;
  gap: 0.65rem;
  padding: var(--space-3) var(--space-4);
  border-top: 1px solid var(--border-subtle);
  background: rgba(255, 255, 255, 0.012);
}

.witness-row:first-child {
  border-top: 0;
}

.witness-row--critical {
  box-shadow: inset 3px 0 0 rgba(239, 83, 80, 0.8);
}

.witness-row--warning {
  box-shadow: inset 3px 0 0 rgba(255, 183, 77, 0.7);
}

.witness-row__rank {
  padding-top: 0.45rem;
  color: #90a4ae;
  font-size: 0.78rem;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
  text-align: right;
}

.witness-row__avatar {
  display: inline-flex;
  padding-top: 0.1rem;
}

.witness-row__body {
  min-width: 0;
}

.witness-row__title {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 0.35rem;
  min-width: 0;
}

.witness-row__name {
  color: #e4eaed;
  font-size: 0.93rem;
  font-weight: 600;
  overflow-wrap: anywhere;
}

.witness-row__name:hover {
  color: #81d4fa;
}

.witness-row__badge {
  font-size: 0.6rem;
}

.witness-row__meta {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 0.3rem 0.75rem;
  margin-top: 0.15rem;
  color: #90a4ae;
  font-size: 0.72rem;
}

.witness-row__meta span {
  display: inline-flex;
  align-items: center;
  gap: 0.22rem;
}

.witness-row__warnings {
  display: flex;
  flex-direction: column;
  gap: 0.2rem;
  margin: 0.4rem 0 0;
  padding: 0;
  list-style: none;
}

.witness-row__warning {
  display: flex;
  align-items: flex-start;
  gap: 0.3rem;
  color: #b0bec5;
  font-size: 0.72rem;
  line-height: 1.4;
}

.witness-row__warning--critical {
  color: #ef9a9a;
}

.witness-row__warning--warning {
  color: #ffcc80;
}

.witness-row__warning--info {
  color: #90a4ae;
}

.witness-row__proxy-note {
  display: flex;
  align-items: flex-start;
  gap: 0.3rem;
  margin-top: 0.4rem;
  color: #ffcc80;
  font-size: 0.72rem;
  line-height: 1.4;
}

.witness-row__actions {
  display: flex;
  align-items: center;
  gap: 0.2rem;
  padding-top: 0.05rem;
}

.witness-row__authority {
  margin-left: 0.3rem;
  font-size: 0.55rem;
}

.witness-row__login-hint {
  color: #78909c;
  font-size: 0.7rem;
  white-space: nowrap;
}

.witness-row__details {
  grid-column: 1 / -1;
  min-width: 0;
  padding-top: 0.55rem;
  border-top: 1px dashed var(--border-subtle);
}

.witness-row__facts {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(min(100%, 165px), 1fr));
  gap: 0.4rem 0.75rem;
  margin: 0 0 0.5rem;
}

.witness-row__facts div {
  min-width: 0;
}

.witness-row__facts dt {
  color: #78909c;
  font-size: 0.64rem;
  letter-spacing: 0.04em;
  text-transform: uppercase;
}

.witness-row__facts dd {
  margin: 0;
  color: #cfd8dc;
  font-size: 0.76rem;
  overflow-wrap: anywhere;
}

.witness-row__links {
  display: flex;
  flex-wrap: wrap;
  gap: 0.35rem 0.85rem;
  margin-bottom: 0.45rem;
  font-size: 0.74rem;
  font-weight: 600;
}

.witness-row__json {
  max-height: 260px;
  overflow: auto;
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-sm);
  padding: 0.35rem;
}

@media (max-width: 699px) {
  .witness-row {
    grid-template-columns: 1.7rem 34px minmax(0, 1fr);
    gap: 0.5rem;
    padding: 0.7rem 0.75rem;
  }

  .witness-row__actions {
    grid-column: 2 / -1;
    justify-content: flex-start;
    padding-top: 0.15rem;
  }

  .witness-row__rank {
    padding-top: 0.35rem;
    font-size: 0.72rem;
  }
}
</style>

<script>
import { defineAsyncComponent } from 'vue'
const jsonViewer = defineAsyncComponent(() => import('components/jsonViewer.vue'))
import {
  formatHp,
  relativeTime,
  versionMatches,
  witnessVotesHp
} from 'src/services/witnesses'
import { hiveAvatarUrl } from 'src/utils/avatar'

export default {
  name: 'WitnessRow',
  components: { jsonViewer },
  props: {
    witness: { type: Object, required: true },
    rank: { type: Number, default: null },
    globalProps: { type: Object, default: null },
    hardforkVersion: { type: String, default: '' },
    warnings: { type: Array, default: () => [] },
    status: { type: String, default: 'ok' },
    voted: { type: Boolean, default: false },
    loggedIn: { type: Boolean, default: false },
    votingBlocked: { type: Boolean, default: false },
    proxy: { type: String, default: '' },
    expanded: { type: Boolean, default: false }
  },
  emits: ['vote', 'unvote', 'toggle'],
  computed: {
    avatarUrl () {
      return hiveAvatarUrl(this.witness.owner)
    },
    detailsId () {
      return 'witness-details-' + String(this.witness.owner || '').replace(/[^a-z0-9-]/gi, '-')
    },
    votesHp () {
      return formatHp(witnessVotesHp(this.witness.votes, this.globalProps))
    },
    missedLabel () {
      return Number(this.witness.total_missed || 0).toLocaleString('en-US')
    },
    feedAge () {
      return relativeTime(this.witness.last_hbd_exchange_update)
    },
    interestRate () {
      return (Number(this.witness.props?.hbd_interest_rate) || 0) / 100
    },
    versionMismatch () {
      return !versionMatches(this.witness.running_version, this.hardforkVersion)
    },
    safeUrl () {
      const value = String(this.witness.url || '').trim()
      return /^https?:\/\//i.test(value) ? value : ''
    },
    prettyUrl () {
      return String(this.witness.url || '').replace(/^https?:\/\//, '').replace(/\/+$/, '')
    },
    registeredLabel () {
      if (!this.witness.created || this.witness.created === '1970-01-01T00:00:00') {
        return 'At least five years'
      }
      return relativeTime(this.witness.created)
    },
    feedRateLabel () {
      const rate = this.witness.hbd_exchange_rate
      if (!rate) return '—'
      return rate.base + ' per ' + rate.quote
    }
  }
}
</script>
