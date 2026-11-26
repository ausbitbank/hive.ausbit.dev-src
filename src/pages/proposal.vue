<template>
  <q-page class="proposal-detail-page">
    <div class="proposal-detail-wrap">
      <div class="proposal-detail-back">
        <q-btn flat dense no-caps icon="arrow_back" label="All proposals" to="/proposals" />
      </div>

      <q-card v-if="loading" flat bordered class="proposal-detail-state">
        <q-spinner-puff color="primary" size="2.4em" aria-label="Loading proposal" />
        <div class="q-mt-sm text-caption">Loading proposal…</div>
      </q-card>

      <q-card v-else-if="loadError" flat bordered class="proposal-detail-state proposal-detail-state--error">
        <q-icon name="error_outline" size="2em" color="orange" aria-hidden="true" />
        <div class="q-mt-sm">{{ loadError }}</div>
        <q-btn flat dense no-caps color="primary" icon="refresh" label="Retry" class="q-mt-sm" @click="load" />
      </q-card>

      <q-card v-else-if="notFound" flat bordered class="proposal-detail-state">
        <q-icon name="search_off" size="2em" color="grey" aria-hidden="true" />
        <h1 class="proposal-detail-state__title">Proposal not found</h1>
        <p>
          There is no DHF proposal with id <code>{{ requestedId }}</code>. It may have been removed,
          or the link may be wrong.
        </p>
        <q-btn flat no-caps color="primary" icon="arrow_back" label="Back to proposals" to="/proposals" />
      </q-card>

      <template v-else-if="proposal">
        <header class="proposal-detail-header">
          <div class="proposal-detail-header__meta">
            <q-badge :color="statusBadge.color" :label="statusBadge.label" />
            <span class="proposal-detail-header__id">Proposal #{{ proposal.id }}</span>
            <share-menu :title="'Hive proposal #' + proposal.id" :path="'/proposals/' + proposal.id" />
          </div>

          <h1 class="page-title proposal-detail-title">{{ proposal.subject }}</h1>

          <div class="proposal-detail-people">
            <div class="proposal-detail-person">
              <q-avatar size="34px">
                <q-img :src="avatarUrl(proposal.creator)" :alt="'Avatar of @' + proposal.creator" />
              </q-avatar>
              <div>
                <div class="proposal-detail-person__label">Created by</div>
                <router-link :to="'/@' + proposal.creator">@{{ proposal.creator }}</router-link>
              </div>
            </div>
            <div v-if="proposal.receiver !== proposal.creator" class="proposal-detail-person">
              <q-avatar size="34px">
                <q-img :src="avatarUrl(proposal.receiver)" :alt="'Avatar of @' + proposal.receiver" />
              </q-avatar>
              <div>
                <div class="proposal-detail-person__label">Paid to</div>
                <router-link :to="'/@' + proposal.receiver">@{{ proposal.receiver }}</router-link>
              </div>
            </div>
          </div>

          <div class="proposal-detail-dates">
            <span>
              <q-icon name="date_range" size="16px" aria-hidden="true" />
              {{ formatDate(proposal.start_date) }} – {{ formatDate(proposal.end_date) }}
              <span class="proposal-detail-muted">({{ totalDays }} days)</span>
            </span>
            <span v-if="phase === 'upcoming'">
              <q-icon name="schedule" size="16px" aria-hidden="true" />
              Starts in {{ remainingDays }} days
            </span>
            <span v-else-if="phase === 'active'">
              <q-icon name="hourglass_bottom" size="16px" aria-hidden="true" />
              {{ remainingDays }} days remaining
            </span>
            <span v-else>
              <q-icon name="event_busy" size="16px" aria-hidden="true" />
              Payment window ended
            </span>
          </div>

          <div class="proposal-detail-actions">
            <template v-if="loggedInUser">
              <q-btn
                v-if="voted"
                no-caps
                color="red"
                outline
                icon="thumb_down_off_alt"
                label="Unvote"
                :aria-label="'Remove your vote from proposal ' + proposal.id"
                @click="vote(false)"
              />
              <q-btn
                v-else
                no-caps
                color="green"
                outline
                icon="thumb_up_alt"
                label="Support"
                :aria-label="'Vote for proposal ' + proposal.id"
                @click="vote(true)"
              />
            </template>
            <div v-else class="proposal-detail-login">
              <q-icon name="login" size="16px" aria-hidden="true" />
              <span>Log in via the account menu to vote</span>
            </div>
            <span class="proposal-detail-keyhint">Requires your active key.</span>

            <q-space />

            <q-btn no-caps flat icon="open_in_new" label="Open post" :to="postLink" />
            <q-btn
              no-caps
              flat
              icon="launch"
              label="PeakD"
              type="a"
              :href="peakdLink"
              target="_blank"
              rel="noopener noreferrer"
              :aria-label="'View proposal ' + proposal.id + ' on PeakD (opens in a new tab)'"
            />
          </div>
        </header>

        <div class="proposal-detail-layout">
          <section class="proposal-detail-main" aria-label="Proposal details">
            <q-card flat bordered class="proposal-detail-post">
              <q-card-section>
                <div v-if="postLoading" class="text-center q-pa-md">
                  <q-spinner-puff color="primary" size="2em" aria-label="Loading proposal post" />
                </div>
                <render v-else-if="postBody" :input="postBody" class="postbody" />
                <div v-else class="proposal-detail-muted">
                  The proposal post could not be loaded.
                  <router-link :to="postLink">Open it directly</router-link>.
                </div>
              </q-card-section>
            </q-card>

            <q-card flat bordered class="proposal-detail-faq">
              <q-card-section>
                <h2 class="proposal-detail-faq__title">Frequently asked questions</h2>
              </q-card-section>
              <q-expansion-item
                icon="help_outline"
                label="What is the Decentralized Hive Fund?"
                header-class="proposal-detail-faq__header"
              >
                <q-card-section class="proposal-detail-faq__body">
                  The DHF (also called the DAO) is a fund held by <router-link to="/@hive.fund">@hive.fund</router-link>.
                  The community votes on proposals, and the most supported proposals are paid from the fund every day.
                </q-card-section>
              </q-expansion-item>
              <q-expansion-item
                icon="how_to_vote"
                label="Who can vote on proposals?"
                header-class="proposal-detail-faq__header"
              >
                <q-card-section class="proposal-detail-faq__body">
                  Any Hive account can vote. Your vote weight comes from your staked Hive (HP),
                  including HP delegated to you. Voting or unvoting a proposal requires your active key.
                </q-card-section>
              </q-expansion-item>
              <q-expansion-item
                icon="balance"
                label="How much is my vote worth?"
                header-class="proposal-detail-faq__header"
              >
                <q-card-section class="proposal-detail-faq__body">
                  A proposal's vote value is the total stake supporting it, shown in HP. It is not a
                  separate token: it is the combined Hive Power of every account that voted for the proposal.
                </q-card-section>
              </q-expansion-item>
              <q-expansion-item
                icon="undo"
                label="What is the return proposal?"
                header-class="proposal-detail-faq__header"
              >
                <q-card-section class="proposal-detail-faq__body">
                  Proposal #0 is the return proposal. It acts as a funding threshold: a normal proposal is
                  funded only while it has at least as much vote weight as the return proposal. Voting for the
                  return proposal sends unallocated DHF back to the DAO.
                </q-card-section>
              </q-expansion-item>
              <q-expansion-item
                icon="supervisor_account"
                label="Can I vote through a proxy?"
                header-class="proposal-detail-faq__header"
              >
                <q-card-section class="proposal-detail-faq__body">
                  Yes. Hive accounts can set a proxy with <code>account_update</code> operations, and the proxy
                  account can vote on proposals on their behalf. This explorer shows the votes recorded on chain;
                  proxied votes are attributed to the proxy account.
                </q-card-section>
              </q-expansion-item>
            </q-card>
          </section>

          <aside class="proposal-detail-sidebar" aria-label="Proposal details and voters">
            <q-card flat bordered>
              <q-card-section>
                <h2 class="proposal-detail-sidebar__title">Payment details</h2>
              </q-card-section>
              <q-list dense separator>
                <q-item>
                  <q-item-section avatar><q-icon name="person" color="blue-grey" /></q-item-section>
                  <q-item-section>
                    <q-item-label caption>Created by</q-item-label>
                    <router-link :to="'/@' + proposal.creator">@{{ proposal.creator }}</router-link>
                  </q-item-section>
                </q-item>
                <q-item>
                  <q-item-section avatar><q-icon name="payments" color="blue-grey" /></q-item-section>
                  <q-item-section>
                    <q-item-label caption>Receiver</q-item-label>
                    <router-link :to="'/@' + proposal.receiver">@{{ proposal.receiver }}</router-link>
                  </q-item-section>
                </q-item>
                <q-item v-if="isReturnProposal">
                  <q-item-section avatar><q-icon name="undo" color="purple" /></q-item-section>
                  <q-item-section>
                    <q-item-label caption>Role</q-item-label>
                    Funding threshold — unallocated DHF returns to the DAO
                  </q-item-section>
                </q-item>
                <template v-else>
                  <q-item>
                    <q-item-section avatar><q-icon name="monetization_on" color="green" /></q-item-section>
                    <q-item-section>
                      <q-item-label caption>Daily pay</q-item-label>
                      {{ formatHbd(dailyPay) }} HBD
                    </q-item-section>
                  </q-item>
                  <q-item>
                    <q-item-section avatar><q-icon name="date_range" color="blue-grey" /></q-item-section>
                    <q-item-section>
                      <q-item-label caption>Payment window</q-item-label>
                      {{ totalDays }} days ({{ elapsedDays }} elapsed)
                    </q-item-section>
                  </q-item>
                  <q-item>
                    <q-item-section avatar><q-icon name="hourglass_bottom" color="orange" /></q-item-section>
                    <q-item-section>
                      <q-item-label caption>Remaining</q-item-label>
                      {{ remainingDays }} days
                    </q-item-section>
                  </q-item>
                  <q-item>
                    <q-item-section avatar><q-icon name="check_circle" color="green" /></q-item-section>
                    <q-item-section>
                      <q-item-label caption>Paid so far</q-item-label>
                      {{ formatHbd(paidAmount) }} HBD
                    </q-item-section>
                  </q-item>
                  <q-item>
                    <q-item-section avatar><q-icon name="pending" color="orange" /></q-item-section>
                    <q-item-section>
                      <q-item-label caption>Still to pay</q-item-label>
                      {{ formatHbd(toPayAmount) }} HBD
                    </q-item-section>
                  </q-item>
                </template>
                <q-item>
                  <q-item-section avatar><q-icon name="favorite" color="red" /></q-item-section>
                  <q-item-section>
                    <q-item-label caption>Vote value</q-item-label>
                    {{ hpReady ? formatHp(voteHp) + ' HP' : '—' }}
                  </q-item-section>
                </q-item>
              </q-list>

              <q-separator />

              <q-card-section>
                <div class="proposal-detail-support__head">
                  <span>Support level</span>
                  <span>{{ hpReady ? formatNumber(supportPercent, 1) + '%' : '—' }}</span>
                </div>
                <q-linear-progress
                  :value="supportProgress"
                  color="primary"
                  rounded
                  size="10px"
                  :aria-label="'Support relative to the return proposal: ' + formatNumber(supportPercent, 1) + ' percent'"
                />
                <div class="proposal-detail-support__target">
                  <span>{{ hpReady ? formatHp(voteHp) : '—' }} HP</span>
                  <span class="proposal-detail-muted">Target {{ hpReady ? formatHp(returnVotesHp) : '—' }} HP</span>
                </div>
                <div class="proposal-detail-muted">
                  Target is the return proposal's vote weight.
                </div>
              </q-card-section>
            </q-card>

            <q-card flat bordered class="proposal-detail-voters">
              <q-card-section>
                <div class="proposal-detail-voters__head">
                  <h2 class="proposal-detail-sidebar__title">Voters</h2>
                  <q-badge color="blue-grey-9">{{ votes.length }}</q-badge>
                </div>

                <div v-if="votes.length === 0" class="proposal-detail-muted">
                  No votes recorded yet.
                </div>

                <template v-else>
                  <div class="proposal-detail-avatars" aria-label="Voters">
                    <router-link
                      v-for="vote in topVoters"
                      :key="vote.voter"
                      :to="'/@' + vote.voter"
                      :title="'@' + vote.voter"
                      :aria-label="'View voter @' + vote.voter"
                    >
                      <q-avatar size="32px">
                        <q-img :src="avatarUrl(vote.voter)" :alt="'Avatar of @' + vote.voter" />
                      </q-avatar>
                    </router-link>
                    <span v-if="votes.length > 24" class="proposal-detail-muted">+{{ votes.length - 24 }} more</span>
                  </div>

                  <q-expansion-item
                    v-if="votes.length > 24"
                    icon="group"
                    :label="'View all ' + votes.length + ' votes'"
                    header-class="proposal-detail-faq__header"
                  >
                    <q-list dense class="proposal-detail-voter-list">
                      <q-item v-for="vote in votes" :key="vote.voter" clickable :to="'/@' + vote.voter">
                        <q-item-section avatar>
                          <q-avatar size="24px">
                            <q-img :src="avatarUrl(vote.voter)" :alt="'Avatar of @' + vote.voter" />
                          </q-avatar>
                        </q-item-section>
                        <q-item-section>@{{ vote.voter }}</q-item-section>
                      </q-item>
                    </q-list>
                  </q-expansion-item>

                  <div v-if="votesCapped" class="proposal-detail-muted">
                    Showing the first 1,000 votes.
                  </div>
                </template>
              </q-card-section>
            </q-card>

            <voter-overlap-card :proposal-id="Number(proposal.id)" :votes="votes" />
          </aside>
        </div>
      </template>
    </div>
  </q-page>
</template>

<script>
import render from 'components/render.vue'
import { setPageMeta } from 'src/utils/pageMeta'
import moment from 'src/utils/time'
import {
  findProposal,
  listProposalVotes,
  getVoterVoteIds,
  getProposalPost,
  dailyPayHbd,
  voteValueHp,
  daysTotal,
  daysElapsed,
  daysRemaining,
  paidHbd,
  toPayHbd,
  proposalPhase,
  proposalStatus,
  proposalVoteQueueItem,
  formatNumber,
  formatHbd,
  formatHp
} from 'src/services/proposals'
import ShareMenu from 'components/ui/ShareMenu.vue'
import VoterOverlapCard from 'components/proposal/VoterOverlapCard.vue'
import { hiveAvatarUrl } from 'src/utils/avatar'

export default {
  name: 'ProposalDetail',
  components: { render, ShareMenu, VoterOverlapCard },
  data () {
    return {
      proposalId: null,
      proposal: null,
      returnProposal: null,
      post: null,
      votes: [],
      voted: false,
      loading: true,
      postLoading: false,
      loadError: null,
      notFound: false
    }
  },
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
    requestedId () {
      return this.$route?.params?.proposalId
    },
    phase () {
      return this.proposal ? proposalPhase(this.proposal) : 'expired'
    },
    statusBadge () {
      return proposalStatus(this.proposal, this.returnProposalVotes)
    },
    isReturnProposal () {
      return Number(this.proposal?.id) === 0
    },
    dailyPay () {
      return dailyPayHbd(this.proposal)
    },
    totalDays () {
      return daysTotal(this.proposal)
    },
    elapsedDays () {
      return daysElapsed(this.proposal)
    },
    remainingDays () {
      return daysRemaining(this.proposal)
    },
    paidAmount () {
      return paidHbd(this.proposal)
    },
    toPayAmount () {
      return toPayHbd(this.proposal)
    },
    voteHp () {
      return voteValueHp(this.proposal, this.globalProps)
    },
    returnProposalVotes () {
      const target = this.returnProposal || this.proposal
      return Number(target?.total_votes) || 0
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
    postBody () {
      return this.post?.body || ''
    },
    topVoters () {
      return this.votes.slice(0, 24)
    },
    votesCapped () {
      return this.votes.length >= 1000
    },
    postLink () {
      if (!this.proposal) return '/proposals'
      return '/@' + this.proposal.creator + '/' + this.proposal.permlink
    },
    peakdLink () {
      return 'https://peakd.com/me/proposals/' + (this.proposal?.id ?? this.requestedId)
    }
  },
  watch: {
    '$route.params.proposalId' () {
      this.load()
    },
    loggedInUser (username) {
      if (!this.proposal) return
      if (!username) {
        this.voted = false
        return
      }
      getVoterVoteIds(username)
        .then(ids => {
          if (this.loggedInUser === username && this.proposal) {
            this.voted = ids.has(Number(this.proposal.id))
          }
        })
        .catch(() => {})
    },
    globalProps () {
      if (this.proposal) this.setLoadedMeta()
    }
  },
  mounted () {
    if (this.globalProps.empty) this.$hiveStore.getGlobalProps()
    this.load()
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
    async load () {
      const rawId = this.$route?.params?.proposalId
      const id = Number(rawId)
      this.proposalId = id
      this.proposal = null
      this.returnProposal = null
      this.post = null
      this.votes = []
      this.voted = false
      this.loadError = null
      this.notFound = false

      if (!Number.isInteger(id) || id < 0) {
        this.loading = false
        this.notFound = true
        this.setNotFoundMeta()
        return
      }

      this.loading = true
      const username = this.loggedInUser

      try {
        const [proposal, returnProposal, votes, voteIds] = await Promise.all([
          findProposal(id),
          id === 0 ? Promise.resolve(null) : findProposal(0).catch(() => null),
          listProposalVotes(id).catch(() => []),
          username ? getVoterVoteIds(username).catch(() => null) : Promise.resolve(null)
        ])

        if (!proposal) {
          this.notFound = true
          this.setNotFoundMeta()
          return
        }

        this.proposal = proposal
        this.returnProposal = id === 0 ? proposal : returnProposal
        this.votes = votes
        this.voted = voteIds
          ? voteIds.has(id)
          : votes.some(vote => vote.voter === username)

        this.setLoadedMeta()

        this.postLoading = true
        getProposalPost(proposal.creator, proposal.permlink, username || undefined)
          .then(post => { this.post = post })
          .catch(() => { this.post = null })
          .finally(() => { this.postLoading = false })
      } catch {
        this.loadError = 'Failed to load this proposal. Please try again.'
        this.$q.notify({ type: 'negative', message: 'Failed to load proposal' })
      } finally {
        this.loading = false
      }
    },
    setLoadedMeta () {
      if (!this.proposal) return
      const status = this.statusBadge?.label || ''
      setPageMeta({
        title: this.proposal.subject + ' — Hive proposal #' + this.proposal.id,
        description: this.proposal.subject + ' — ' + this.formatHbd(this.dailyPay) + ' HBD daily, ' +
          this.formatHp(this.voteHp) + ' HP support, ' + status + '. Decentralized Hive Fund proposal on banksia.io.',
        url: '/proposals/' + this.proposal.id
      })
    },
    setNotFoundMeta () {
      setPageMeta({
        title: 'Proposal not found — Hive proposals',
        description: 'The requested Decentralized Hive Fund proposal does not exist. Browse current and past DHF proposals on banksia.io.',
        url: '/proposals/' + (this.$route?.params?.proposalId || '')
      })
    },
    vote (approve) {
      if (!this.loggedInUser) {
        this.$q.notify({ type: 'warning', message: 'Log in via the account menu to vote on proposals.' })
        return
      }

      const id = Number(this.proposal?.id)
      if (!Number.isInteger(id) || id < 0) {
        this.$q.notify({ type: 'negative', message: 'Invalid proposal id' })
        return
      }

      // update_proposal_votes requires the active authority, not posting.
      this.$hiveStore.addToQueue(proposalVoteQueueItem(this.loggedInUser, id, approve))

      this.voted = approve
      if (approve) {
        if (!this.votes.some(vote => vote.voter === this.loggedInUser)) {
          this.votes = [{ voter: this.loggedInUser, proposal: this.proposal, optimistic: true }, ...this.votes]
        }
      } else {
        this.votes = this.votes.filter(vote => vote.voter !== this.loggedInUser)
      }

      this.$q.notify({
        type: approve ? 'positive' : 'info',
        message: (approve ? 'Vote' : 'Unvote') + ' queued for proposal ' + id + '. Requires your active key.'
      })
    }
  }
}
</script>

<style scoped>
.proposal-detail-page {
  padding: var(--space-5) var(--space-4) var(--space-6);
}

.proposal-detail-wrap {
  width: 100%;
  max-width: 1280px;
  margin: 0 auto;
}

.proposal-detail-back {
  margin-bottom: var(--space-3);
}

.proposal-detail-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: var(--space-6) var(--space-4);
  text-align: center;
  color: var(--c-text-muted);
}

.proposal-detail-state--error {
  color: var(--c-warning);
}

.proposal-detail-state__title {
  font-size: 1.25rem;
  font-weight: 600;
  margin: var(--space-2) 0 0;
}

.proposal-detail-header {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  margin-bottom: var(--space-4);
}

.proposal-detail-header__meta {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  flex-wrap: wrap;
}

.proposal-detail-header__id {
  font-size: 0.82rem;
  color: var(--c-text-subtle);
}

.proposal-detail-title {
  margin: 0;
  overflow-wrap: anywhere;
}

.proposal-detail-people {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-4);
}

.proposal-detail-person {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  min-width: 0;
}

.proposal-detail-person__label {
  font-size: 0.72rem;
  color: var(--c-text-subtle);
}

.proposal-detail-dates {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-1) var(--space-4);
  font-size: 0.84rem;
  color: var(--c-text-soft);
}

.proposal-detail-dates > span {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;
}

.proposal-detail-actions {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: var(--space-2);
  margin-top: var(--space-1);
}

.proposal-detail-keyhint,
.proposal-detail-login {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 0.76rem;
  color: var(--c-text-subtle);
}

.proposal-detail-login {
  font-size: 0.84rem;
}

.proposal-detail-muted {
  color: var(--c-text-subtle);
  font-size: 0.8rem;
}

.proposal-detail-layout {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 340px;
  gap: var(--space-4);
  align-items: start;
}

.proposal-detail-main {
  min-width: 0;
}

.proposal-detail-post {
  min-width: 0;
  overflow: hidden;
}

.proposal-detail-faq {
  margin-top: var(--space-4);
}

.proposal-detail-faq__title,
.proposal-detail-sidebar__title {
  margin: 0;
  font-size: 1rem;
  font-weight: 600;
}

.proposal-detail-faq__header {
  font-size: 0.9rem;
}

.proposal-detail-faq__body {
  color: var(--c-text-soft);
  font-size: 0.88rem;
  line-height: 1.55;
}

.proposal-detail-sidebar {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
  min-width: 0;
}

.proposal-detail-support__head,
.proposal-detail-support__target {
  display: flex;
  justify-content: space-between;
  gap: var(--space-2);
  flex-wrap: wrap;
  font-size: 0.82rem;
  margin-bottom: var(--space-1);
}

.proposal-detail-support__target {
  margin-top: var(--space-1);
  color: var(--c-text-soft);
}

.proposal-detail-voters__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-2);
  margin-bottom: var(--space-2);
}

.proposal-detail-avatars {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px;
}

.proposal-detail-voter-list {
  max-height: 320px;
  overflow: auto;
}

@media (max-width: 900px) {
  .proposal-detail-layout {
    grid-template-columns: minmax(0, 1fr);
  }
}

@media (max-width: 600px) {
  .proposal-detail-page {
    padding: var(--space-3) var(--space-2) var(--space-5);
  }
}
</style>
