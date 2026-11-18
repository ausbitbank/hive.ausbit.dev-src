<template>
  <span class="vote-control" :class="{ 'vote-control--open': direction !== null && !voteSent, 'vote-control--sent': voteSent }">
    <template v-if="direction === null && !voteSent">
      <q-btn
        class="vote-control__btn vote-control__btn--up"
        :class="{ 'is-active': myUpvote }"
        size="sm"
        dense
        flat
        no-caps
        :icon="upvoteIcon"
        :label="upvoteLabel"
        :style="myUpvote ? voteWeightStyle(myVote) : undefined"
        :aria-label="voteAriaLabel('up')"
        :title="loggedInUser ? 'Upvote this post' : 'Log in to vote'"
        :disable="disableVoting"
        @click="voteClicked('up')"
      />
      <q-btn v-if="downvotes && downvotes.length > 0"
        class="vote-control__btn vote-control__btn--down"
        :class="{ 'is-active': myDownvote }"
        size="sm"
        dense
        flat
        no-caps
        :icon="downvoteIcon"
        :label="downvoteLabel"
        :style="myDownvote ? voteWeightStyle(myVote) : undefined"
        :aria-label="voteAriaLabel('down')"
        :title="loggedInUser ? 'Downvote this post' : 'Log in to vote'"
        :disable="disableVoting"
        @click="voteClicked('down')"
      />
    </template>

    <span
      v-else-if="voteSent"
      class="vote-control__sent"
      :class="voteSentWeight < 0 ? 'vote-control__sent--down' : 'vote-control__sent--up'"
    >
      <q-icon :name="voteSentWeight < 0 ? 'thumb_down' : 'thumb_up'" size="16px" aria-hidden="true" />
      <span>{{ Math.abs(voteSentWeight) }}%</span>
      <q-spinner-tail size="14px" aria-label="Sending vote" />
    </span>

    <span v-else class="vote-control__composer" :class="'vote-control__composer--' + direction">
      <div class="vote-control__composer-head">
        <q-icon
          :name="direction === 'up' ? 'thumb_up' : 'thumb_down'"
          size="15px"
          class="vote-control__composer-icon"
          aria-hidden="true"
        />
        <span class="vote-control__composer-label">{{ direction === 'up' ? 'Upvote weight' : 'Downvote weight' }}</span>
        <span class="vote-control__composer-value">{{ activePercent }}%</span>
      </div>
      <input
        v-model.number="activePercent"
        type="range"
        class="vote-control__range"
        min="1"
        max="100"
        step="5"
        :aria-label="(direction === 'up' ? 'Upvote' : 'Downvote') + ' weight percent'"
      />
      <span class="vote-control__presets" role="group" aria-label="Quick weight presets">
        <button
          v-for="preset in quickWeights"
          :key="preset"
          type="button"
          class="vote-control__preset"
          :class="{ 'is-selected': activePercent === preset }"
          :aria-pressed="activePercent === preset"
          :title="'Vote at ' + preset + '%'"
          @click="activePercent = preset"
        >{{ preset }}%</button>
      </span>
      <span class="vote-control__composer-actions">
        <q-btn
          class="vote-control__confirm"
          size="sm"
          dense
          unelevated
          no-caps
          :color="direction === 'up' ? 'green' : 'red'"
          :label="direction === 'up' ? 'Vote' : 'Downvote'"
          :title="'Send a ' + activePercent + '% ' + direction + 'vote'"
          @click="voteClicked(direction)"
        />
        <q-btn
          class="vote-control__cancel"
          size="sm"
          dense
          flat
          round
          icon="close"
          aria-label="Cancel vote"
          title="Cancel"
          @click="direction = null"
        />
      </span>
    </span>
  </span>
</template>

<script>
const QUICK_WEIGHTS = [25, 50, 75, 100]

export default {
  name: 'vote',
  props: ['votes', 'active_votes', 'author', 'permlink'],
  data () {
    return {
      weight: Number(this.$hiveStore.user.settings.voteWeightPost) || 100,
      voteSent: false,
      voteSentWeight: null,
      direction: null,
      quickWeights: QUICK_WEIGHTS
    }
  },
  computed: {
    loggedInUser: {
      get () { return this.$hiveStore.user.username }
    },
    upvotes () {
      if (this.votes) {
        return this.votes.filter(v => Math.sign(v.rshares) === 1)
      } else {
        return null
      }
    },
    downvotes () {
      if (this.votes) {
        return this.votes.filter(v => Math.sign(v.rshares) === -1)
      } else {
        return null
      }
    },
    myVote () {
      if (this.voteSentWeight !== null) {
        return { voter: this.loggedInUser, weight: this.voteSentWeight, author: this.author, permlink: this.permlink, rshares: this.voteSentWeight }
      }
      if (this.votes) {
        return this.votes.find(this.filterMyVote)
      }
      return undefined
    },
    myUpvote () {
      return this.myVote !== undefined && Math.sign(this.myVote.rshares) === 1
    },
    myDownvote () {
      return this.myVote !== undefined && Math.sign(this.myVote.rshares) === -1
    },
    disableVoting () {
      if (!this.loggedInUser) return true
      if (this.myVote !== undefined) return true
      return false
    },
    activePercent: {
      get () {
        if (this.weight === 0) return 100
        return Math.min(100, Math.max(1, Math.abs(this.weight)))
      },
      set (val) {
        const percent = Math.min(100, Math.max(1, Number(val) || 1))
        this.weight = this.direction === 'down' ? -percent : percent
      }
    },
    upvoteLabel () {
      return this.upvotes ? this.compactCount(this.upvotes.length) : null
    },
    downvoteLabel () {
      return this.downvotes ? this.compactCount(this.downvotes.length) : null
    },
    upvoteIcon () {
      return this.myUpvote ? 'thumb_up' : 'thumb_up_off_alt'
    },
    downvoteIcon () {
      return this.myDownvote ? 'thumb_down' : 'thumb_down_off_alt'
    }
  },
  methods: {
    compactCount (count) {
      if (count >= 1000) return (count / 1000).toFixed(count >= 10000 ? 0 : 1).replace(/\.0$/, '') + 'k'
      return String(count)
    },
    voteAriaLabel (direction) {
      const total = direction === 'up' ? (this.upvotes || []).length : (this.downvotes || []).length
      const verb = direction === 'up' ? 'Upvote' : 'Downvote'
      if (this.myUpvote || this.myDownvote) return 'You already voted on this post'
      return verb + ' this post (' + total + ' ' + direction + 'votes so far)'
    },
    voteWeightStyle (vote) {
      // Weight is stored in basis points (10000 = 100%) on chain.
      const pct = vote && vote.percent !== undefined
        ? Number(vote.percent) / 100
        : Math.abs(Number(vote && vote.weight) || 0) / 100
      return { '--vote-weight': Math.min(100, Math.max(1, pct)) + '%' }
    },
    voteClicked (d) {
      if (this.direction === d) {
        this.submitVote()
        return
      }
      this.direction = d
      const preferred = Math.abs(Number(this.$hiveStore.user.settings.voteWeightPost) || 0) || 100
      this.weight = d === 'down' ? -preferred : preferred
    },
    submitVote () {
      const weight = this.weight
      this.direction = null
      this.vote(this.permlink, this.author, weight)
    },
    async vote (permlink, author, weight) {
      this.voteSent = true
      this.voteSentWeight = weight
      this.$hiveStore.addToQueue([this.loggedInUser, 'posting', ['vote', { voter: this.loggedInUser, weight: weight * 100, author: author, permlink: permlink }]])
      this.$emit('Voted', weight)
    },
    filterMyVote (op) { return op.voter === this.loggedInUser }
  }
}
</script>

<style>
/* Vote control: split pill buttons with a weight palette popover.
   Written unscoped because the control is rendered inside several pages
   that pass their own layout rules. */
.vote-control {
  display: inline-flex;
  align-items: center;
  gap: 4px;
}

.vote-control__btn.q-btn {
  min-height: 30px;
  padding: 0 10px;
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-pill);
  background: rgba(255, 255, 255, 0.03);
  color: #b0bec5;
  font-size: 0.78rem;
  font-weight: 600;
}

.vote-control__btn .q-btn__content .q-icon {
  font-size: 17px;
}

.vote-control__btn--up .q-icon {
  color: #81c784;
}

.vote-control__btn--down .q-icon {
  color: #e57373;
}

.vote-control__btn.q-btn:hover:not(.disabled) {
  border-color: rgba(255, 255, 255, 0.22);
  background: rgba(255, 255, 255, 0.07);
  color: #fff;
  transform: translateY(-1px);
}

.vote-control__btn.q-btn.is-active {
  border-color: rgba(129, 199, 132, 0.45) !important;
  color: #e8f5e9 !important;
  background: linear-gradient(
    90deg,
    rgba(76, 175, 80, 0.32) var(--vote-weight, 100%),
    rgba(255, 255, 255, 0.04) var(--vote-weight, 100%)
  ) !important;
}

.vote-control__btn--down.is-active {
  border-color: rgba(229, 115, 115, 0.45) !important;
  background: linear-gradient(
    90deg,
    rgba(239, 83, 80, 0.32) var(--vote-weight, 100%),
    rgba(255, 255, 255, 0.04) var(--vote-weight, 100%)
  ) !important;
}

.vote-control__btn.q-btn .q-focus-helper {
  border-radius: var(--radius-pill);
}

.vote-control__composer {
  display: inline-flex;
  align-items: center;
  flex-wrap: nowrap;
  gap: 6px;
  max-width: 100%;
  padding: 5px 8px 5px 10px;
  border: 1px solid rgba(129, 199, 132, 0.4);
  border-radius: var(--radius-pill);
  background: rgba(76, 175, 80, 0.08);
  animation: vote-control-in 0.16s ease-out;
}

.vote-control__composer--down {
  border-color: rgba(229, 115, 115, 0.4);
  background: rgba(239, 83, 80, 0.08);
}

@keyframes vote-control-in {
  from { opacity: 0; transform: scale(0.96); }
  to { opacity: 1; transform: scale(1); }
}

.vote-control__composer-head {
  display: inline-flex;
  align-items: center;
  gap: 4px;
}

.vote-control__composer-icon {
  color: #81c784;
}

.vote-control__composer--down .vote-control__composer-icon {
  color: #e57373;
}

.vote-control__composer-label {
  color: #b0bec5;
  font-size: 0.72rem;
  font-weight: 600;
  white-space: nowrap;
}

.vote-control__composer-value {
  min-width: 38px;
  color: #e4eaed;
  font-size: 0.78rem;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
}

.vote-control__range {
  width: 92px;
  flex: 0 1 auto;
  min-width: 52px;
  height: 18px;
  margin: 0;
  accent-color: #81c784;
  cursor: pointer;
}

.vote-control__composer--down .vote-control__range {
  accent-color: #e57373;
}

.vote-control__percent {
  min-width: 36px;
  color: #e4eaed;
  font-size: 0.78rem;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
  text-align: right;
}

.vote-control__presets {
  display: inline-flex;
  align-items: center;
  gap: 2px;
}

.vote-control__preset {
  padding: 0.1rem 0.32rem;
  border: 1px solid transparent;
  border-radius: var(--radius-pill);
  background: transparent;
  color: #90a4ae;
  font: inherit;
  font-size: 0.68rem;
  font-weight: 600;
  line-height: 1.3;
  cursor: pointer;
}

.vote-control__preset:hover {
  background: rgba(255, 255, 255, 0.07);
  color: #fff;
}

.vote-control__preset.is-selected {
  border-color: rgba(255, 255, 255, 0.18);
  background: rgba(255, 255, 255, 0.1);
  color: #fff;
}

.vote-control__composer-actions {
  display: inline-flex;
  align-items: center;
  gap: 2px;
}

.vote-control__confirm.q-btn {
  min-height: 26px;
  padding: 0 12px;
  border-radius: var(--radius-pill);
  font-size: 0.74rem;
  font-weight: 600;
}

.vote-control__confirm.q-btn.text-white {
  color: #0b1d2a !important;
}

.vote-control__cancel.q-btn {
  min-width: 26px;
  min-height: 26px;
  color: #90a4ae;
}

.vote-control__sent {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 4px 10px;
  border: 1px dashed rgba(255, 255, 255, 0.2);
  border-radius: var(--radius-pill);
  color: #b0bec5;
  font-size: 0.74rem;
  font-weight: 600;
}

.vote-control__sent--up .q-icon:first-child {
  color: #81c784;
}

.vote-control__sent--down .q-icon:first-child {
  color: #e57373;
}

@media (max-width: 599px) {
  .vote-control__preset {
    display: none;
  }

  .vote-control__range {
    width: 64px;
  }

  .vote-control__composer-label {
    display: none;
  }

  .vote-control__composer {
    gap: 4px;
    padding: 4px 6px 4px 8px;
  }
}

@media (prefers-reduced-motion: reduce) {
  .vote-control__composer {
    animation: none;
  }
}
</style>
