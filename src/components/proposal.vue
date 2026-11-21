<template>
  <q-card flat bordered class="proposal-card">
    <q-card-section class="proposal-card__main">
      <div class="proposal-card__top">
        <div class="proposal-people">
          <q-avatar size="34px">
            <q-img :src="avatarUrl(p.creator)" :alt="'Avatar of @' + p.creator" />
          </q-avatar>
          <div class="proposal-people__names">
            <router-link :to="'/@' + p.creator" class="proposal-people__creator">@{{ p.creator }}</router-link>
            <span v-if="p.creator !== p.receiver" class="proposal-people__receiver">
              pays <router-link :to="'/@' + p.receiver">@{{ p.receiver }}</router-link>
            </span>
          </div>
        </div>
        <q-badge :color="statusBadge.color" class="proposal-badge" :label="statusBadge.label" />
      </div>

      <h3 class="proposal-card__title">
        <router-link :to="'/proposals/' + p.id">{{ p.subject }}</router-link>
        <span class="proposal-card__id">#{{ p.id }}</span>
      </h3>

      <div class="proposal-card__meta">
        <span class="proposal-card__meta-item">
          <q-icon name="date_range" size="16px" aria-hidden="true" />
          {{ formatDate(p.start_date) }} – {{ formatDate(p.end_date) }}
          <span class="proposal-card__muted">({{ totalDays }} days)</span>
        </span>
        <span class="proposal-card__meta-item proposal-card__permlink">
          <q-icon name="link" size="16px" aria-hidden="true" />
          <router-link :to="postLink">@{{ p.creator }}/{{ p.permlink }}</router-link>
        </span>
      </div>

      <div v-if="isReturnProposal" class="proposal-card__note">
        <q-icon name="undo" size="16px" aria-hidden="true" />
        <span>This is the return proposal. It sets the funding threshold — proposals below its vote level are not funded, and unallocated DHF returns to the DAO.</span>
      </div>

      <div class="proposal-card__stats">
        <template v-if="!isReturnProposal">
          <div class="proposal-stat">
            <span class="proposal-stat__label">Daily pay</span>
            <span class="proposal-stat__value">{{ formatHbd(dailyPay) }} HBD</span>
          </div>
          <div class="proposal-stat">
            <span class="proposal-stat__label">Remaining</span>
            <span class="proposal-stat__value">{{ remainingDays }} days</span>
          </div>
          <div class="proposal-stat">
            <span class="proposal-stat__label">Paid so far</span>
            <span class="proposal-stat__value">{{ formatHbd(paidAmount) }} HBD</span>
          </div>
          <div class="proposal-stat">
            <span class="proposal-stat__label">Still to pay</span>
            <span class="proposal-stat__value">{{ formatHbd(toPayAmount) }} HBD</span>
          </div>
        </template>
        <div v-else class="proposal-stat">
          <span class="proposal-stat__label">Role</span>
          <span class="proposal-stat__value">Funding threshold</span>
        </div>
        <div class="proposal-stat">
          <span class="proposal-stat__label">Vote value</span>
          <span class="proposal-stat__value">{{ hpReady ? formatHp(voteHp) + ' HP' : '—' }}</span>
        </div>
      </div>

      <div class="proposal-support">
        <div class="proposal-support__head">
          <span>Support vs return proposal</span>
          <span>{{ hpReady ? formatNumber(supportPercent, 1) + '%' : '—' }}</span>
        </div>
        <q-linear-progress
          :value="supportProgress"
          :color="statusBadge.color === 'grey' ? 'grey' : 'primary'"
          rounded
          size="8px"
          :aria-label="'Support relative to the return proposal: ' + formatNumber(supportPercent, 1) + ' percent'"
        />
        <div class="proposal-support__target">
          <span>{{ hpReady ? formatHp(voteHp) : '—' }} / {{ hpReady ? formatHp(returnVotesHp) : '—' }} HP</span>
          <span class="proposal-card__muted">Return threshold</span>
        </div>
      </div>
    </q-card-section>

    <q-separator />

    <q-card-actions class="proposal-card__actions">
      <template v-if="loggedInUser">
        <q-btn
          v-if="voted"
          dense
          flat
          no-caps
          color="red"
          icon="thumb_down_off_alt"
          label="Unvote"
          :aria-label="'Remove your vote from proposal ' + p.id"
          @click="vote(false)"
        />
        <q-btn
          v-else
          dense
          flat
          no-caps
          color="green"
          icon="thumb_up_alt"
          label="Support"
          :aria-label="'Vote for proposal ' + p.id"
          @click="vote(true)"
        />
      </template>
      <div v-else class="proposal-card__login">
        <q-icon name="login" size="16px" aria-hidden="true" />
        <span>Log in via the account menu to vote</span>
      </div>
      <span class="proposal-card__keyhint">Requires your active key.</span>

      <q-space />

      <q-btn dense flat no-caps icon="open_in_new" label="Open post" :to="postLink" />
      <q-btn
        dense
        flat
        no-caps
        icon="launch"
        label="PeakD"
        type="a"
        :href="peakdLink"
        target="_blank"
        rel="noopener noreferrer"
        :aria-label="'View proposal ' + p.id + ' on PeakD (opens in a new tab)'"
      />
    </q-card-actions>
  </q-card>
</template>

<script>
import moment from 'src/utils/time'
import {
  dailyPayHbd,
  voteValueHp,
  daysTotal,
  daysRemaining,
  paidHbd,
  toPayHbd,
  proposalStatus,
  proposalVoteQueueItem,
  formatNumber,
  formatHbd,
  formatHp
} from 'src/services/proposals'
import { hiveAvatarUrl } from 'src/utils/avatar'

export default {
  name: 'proposal-card',
  props: {
    p: { type: Object, required: true },
    returnProposalVotes: { type: Number, default: 0 },
    voted: { type: Boolean, default: false }
  },
  emits: ['vote'],
  computed: {
    loggedInUser () {
      return this.$hiveStore.user.username
    },
    globalProps () {
      return this.$hiveStore.globalProps
    },
    hpReady () {
      const props = this.globalProps
      return Boolean(props && props.total_vesting_shares && props.total_vesting_fund_hive)
    },
    dailyPay () {
      return dailyPayHbd(this.p)
    },
    totalDays () {
      return daysTotal(this.p)
    },
    remainingDays () {
      return daysRemaining(this.p)
    },
    paidAmount () {
      return paidHbd(this.p)
    },
    toPayAmount () {
      return toPayHbd(this.p)
    },
    voteHp () {
      return voteValueHp(this.p, this.globalProps)
    },
    returnVotesHp () {
      return voteValueHp({ total_votes: this.returnProposalVotes }, this.globalProps)
    },
    supportPercent () {
      if (!this.returnVotesHp) return 0
      return (this.voteHp / this.returnVotesHp) * 100
    },
    supportProgress () {
      if (!this.returnVotesHp) return 0
      return Math.min(1, this.voteHp / this.returnVotesHp)
    },
    statusBadge () {
      return proposalStatus(this.p, this.returnProposalVotes)
    },
    isReturnProposal () {
      return Number(this.p.id) === 0
    },
    postLink () {
      return '/@' + this.p.creator + '/' + this.p.permlink
    },
    peakdLink () {
      return 'https://peakd.com/me/proposals/' + this.p.id
    }
  },
  methods: {
    formatNumber,
    formatHbd,
    formatHp,
    avatarUrl (user) {
      return hiveAvatarUrl(user)
    },
    formatDate (timestamp) {
      return moment(timestamp).format('D MMM YYYY')
    },
    vote (approve) {
      if (!this.loggedInUser) {
        this.$q.notify({ type: 'warning', message: 'Log in via the account menu to vote on proposals.' })
        return
      }

      const proposalId = Number(this.p.id)
      if (!Number.isInteger(proposalId) || proposalId < 0) {
        this.$q.notify({ type: 'negative', message: 'Invalid proposal id' })
        return
      }

      // update_proposal_votes requires the active authority, not posting.
      this.$hiveStore.addToQueue(proposalVoteQueueItem(this.loggedInUser, proposalId, approve))

      this.$emit('vote', { proposal: this.p, approve })
      this.$q.notify({
        type: approve ? 'positive' : 'info',
        message: (approve ? 'Vote' : 'Unvote') + ' queued for proposal ' + proposalId + '. Requires your active key.'
      })
    }
  }
}
</script>

<style scoped>
.proposal-card {
  display: flex;
  flex-direction: column;
  height: 100%;
  overflow: hidden;
}

.proposal-card__main {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
  flex: 1;
}

.proposal-card__top {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: var(--space-2);
  flex-wrap: wrap;
}

.proposal-people {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  min-width: 0;
}

.proposal-people__names {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
  overflow-wrap: anywhere;
}

.proposal-people__creator {
  font-weight: 600;
}

.proposal-people__receiver {
  font-size: 0.8rem;
  color: #b0bec5;
}

.proposal-badge {
  flex: none;
}

.proposal-card__title {
  margin: 0;
  font-size: 1.06rem;
  line-height: 1.35;
  overflow-wrap: anywhere;
}

.proposal-card__id {
  display: inline-block;
  margin-left: var(--space-2);
  color: #90a4ae;
  font-size: 0.85rem;
  font-weight: 400;
  white-space: nowrap;
}

.proposal-card__meta {
  display: flex;
  flex-direction: column;
  gap: 4px;
  font-size: 0.84rem;
  color: #cfd8dc;
}

.proposal-card__meta-item {
  display: flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
  flex-wrap: wrap;
  overflow-wrap: anywhere;
}

.proposal-card__permlink {
  color: #90a4ae;
}

.proposal-card__permlink a {
  font-weight: 400;
  overflow-wrap: anywhere;
}

.proposal-card__muted {
  color: #78909c;
}

.proposal-card__note {
  display: flex;
  gap: var(--space-2);
  align-items: flex-start;
  padding: var(--space-2) var(--space-3);
  border: 1px solid rgba(186, 104, 200, 0.35);
  border-radius: var(--radius-sm);
  background: rgba(186, 104, 200, 0.08);
  color: #e1bee7;
  font-size: 0.82rem;
  line-height: 1.45;
}

.proposal-card__stats {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: var(--space-2);
}

.proposal-stat {
  display: flex;
  flex-direction: column;
  gap: 1px;
  min-width: 0;
  padding: var(--space-2);
  border-radius: var(--radius-sm);
  background: rgba(255, 255, 255, 0.035);
}

.proposal-stat__label {
  font-size: 0.7rem;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: #90a4ae;
}

.proposal-stat__value {
  font-size: 0.92rem;
  font-weight: 600;
  overflow-wrap: anywhere;
}

.proposal-support {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.proposal-support__head,
.proposal-support__target {
  display: flex;
  justify-content: space-between;
  gap: var(--space-2);
  flex-wrap: wrap;
  font-size: 0.78rem;
  color: #cfd8dc;
}

.proposal-support__target {
  color: #90a4ae;
}

.proposal-card__actions {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: var(--space-1);
}

.proposal-card__keyhint,
.proposal-card__login {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 0.72rem;
  color: #90a4ae;
}

.proposal-card__login {
  font-size: 0.8rem;
}

@media (max-width: 420px) {
  .proposal-card__stats {
    grid-template-columns: minmax(0, 1fr);
  }
}
</style>
