<template>
  <q-page class="account-page">
    <q-card v-if="error" flat bordered class="account-state">
      <q-icon name="error_outline" size="2.2em" color="orange" aria-hidden="true" />
      <h1 class="account-state__title">Account not found</h1>
      <p>{{ errorMessage || 'This account could not be loaded.' }}</p>
      <q-btn outline no-caps color="primary" icon="arrow_back" label="Back to browse" to="/created" />
    </q-card>

    <template v-else-if="account !== null && account !== undefined && globalProps !== null">
      <profile-skin :account="account" :author="account.name" context="profile">
      <template #default="{ theme }">
      <account-header :globalProps="globalProps" :account="account" :showBalances="false" />
      <div v-if="profileModeration.primary" class="account-moderation">
        <moderation-notice
          :decision="profileModeration"
          :show-disclosure="moderationStore && moderationStore.shouldDisclose"
          @dismiss-disclosure="moderationMarkDisclosure"
          @show="moderationShowItem(profileModeration)"
          @show-author="moderationShowAuthor(profileModeration)"
          @hide-author="moderationHideAuthor(profileModeration)"
          @ignore-voter="moderationIgnoreVoter(profileModeration)"
        />
      </div>
      <profile-shelf v-if="theme" :theme="theme" :account="account" />
      <div class="account-shell">
        <q-card flat bordered class="account-card account-overview">
          <q-card-section>
            <div class="account-card__head">
              <div>
                <div class="account-card__eyebrow">Account overview</div>
                <h2 class="account-card__title">@{{ account.name }}</h2>
              </div>
              <div class="account-overview-actions">
                <share-menu :title="'@' + account.name + ' on hive.ausbit.dev'" :path="'/@' + account.name" />
                <nav class="account-quick-links" aria-label="Account quick links">
                  <router-link :to="linkWallet(username)">Wallet</router-link>
                  <router-link :to="'/@' + username + '/lightning'">Lightning</router-link>
                  <router-link :to="'/@' + username + '/delegations'">Delegations</router-link>
                  <router-link :to="linkBlog(username)">Blog</router-link>
                  <router-link :to="linkPosts(username)">Posts</router-link>
                  <router-link :to="linkComments(username)">Comments</router-link>
                  <router-link :to="'/@' + username + '/followers'">Followers</router-link>
                  <router-link :to="'/@' + username + '/following'">Following</router-link>
                </nav>
              </div>
            </div>

            <div class="account-stat-grid">
              <div class="account-stat">
                <span class="account-stat__label">Effective HP</span>
                <strong class="account-stat__value">{{ effectiveHPTidy }}</strong>
                <small class="account-stat__hint">
                  <template v-if="accountReady">
                  {{ tidyNumber(vestToHive(parseInt(account.vesting_shares.split(' ')[0]))) }}
                  + {{ tidyNumber(vestToHive(parseInt(account.received_vesting_shares.split(' ')[0]))) }}
                  - {{ tidyNumber(vestToHive(parseInt(account.delegated_vesting_shares.split(' ')[0]))) }}
                  <template v-if="parseInt(account.vesting_withdraw_rate.split(' ')[0]) !== 0">
                    - {{ tidyNumber(vestToHive(parseInt(account.vesting_withdraw_rate.split(' ')[0]))) }}
                  </template>
                  </template>
                  <template v-else>Awaiting account data</template>
                </small>
              </div>

              <div class="account-stat">
                <span class="account-stat__label">Reputation</span>
                <strong class="account-stat__value">{{ displayReputation }}</strong>
                <small class="account-stat__hint">{{ tidyNumber(account.post_count) }} posts</small>
              </div>

              <div class="account-stat">
                <span class="account-stat__label">Account age</span>
                <strong class="account-stat__value">{{ accountAge }}</strong>
                <small class="account-stat__hint">{{ accountAgeShort }}</small>
              </div>

              <div class="account-stat">
                <span class="account-stat__label">Voting power</span>
                <strong class="account-stat__value">{{ votePower }}%</strong>
                <q-linear-progress rounded size="8px" :value="Number(votePower) / 100" color="primary" class="account-stat__bar" aria-label="Voting power" />
              </div>

              <div class="account-stat">
                <span class="account-stat__label">Downvote power</span>
                <strong class="account-stat__value">{{ downvotePowerPct }}%</strong>
                <q-linear-progress v-if="downvotePower !== null" rounded size="8px" :value="downvotePowerPct / 100" color="red" class="account-stat__bar" aria-label="Downvote power" />
                <small v-else class="account-stat__hint">Unavailable</small>
              </div>

              <div class="account-stat account-stat--rc">
                <span class="account-stat__label">Resource credits</span>
                <rc :username="account.name" compact />
              </div>
            </div>

            <div v-if="powerDownActive" class="account-powerdown">
              <q-icon name="lock_open" color="orange" aria-hidden="true" />
              <span>Powering down {{ tidyNumber(vestToHive(parseInt(account.vesting_withdraw_rate.split(' ')[0]))) }} HIVE next</span>
              <span class="account-powerdown__time">{{ timeDelta(account.next_vesting_withdrawal) }}</span>
            </div>

            <div class="account-external">
              View on
              <a :href="linkHiveBlog(username)" target="_blank" rel="noopener noreferrer">Hive.blog</a>,
              <a :href="linkPeakd(username)" target="_blank" rel="noopener noreferrer">PeakD</a>,
              <a :href="linkEcency(username)" target="_blank" rel="noopener noreferrer">Ecency</a>
            </div>
          </q-card-section>
        </q-card>

        <div class="account-grid">
          <section class="account-main" aria-label="Account activity">
            <q-card flat bordered class="account-card account-activity">
              <q-card-section class="account-card__head">
                <div>
                  <div class="account-card__eyebrow">Activity</div>
                  <h2 class="account-card__title">Recent operations</h2>
                </div>
                <div class="account-activity__actions">
                  <q-btn title="Check for new transactions" aria-label="Check for new transactions" icon="refresh" size="sm" color="green" round dense flat @click="getAccountHistoryMarker()" />
                  <q-toggle v-model="autorefresh" checked-icon="check" unchecked-icon="clear" label="Auto refresh" dense left-label @update:model-value="autoRefreshToggle()" />
                  <q-btn title="Filter operations" aria-label="Filter operations" icon="sort" dense size="sm" round color="blue-grey">
                    <q-popup-proxy>
                      <q-card class="account-filter-card">
                        <div class="account-filter-card__title">Filter operations</div>
                        <q-input v-model="filter" label="Operations separated by commas" dense outlined placeholder="vote, transfer, comment" />
                        <div class="account-filter-card__actions">
                          <q-btn flat dense no-caps color="grey" label="Clear" @click="filter = null; $router.push({ query: {} }); getAccountHistoryMarker()" />
                          <q-btn unelevated dense no-caps label="Apply filter" color="primary" icon="filter_alt" @click="$router.push({ query: { filter: filter } }); getAccountHistoryMarker()" />
                        </div>
                      </q-card>
                    </q-popup-proxy>
                  </q-btn>
                </div>
              </q-card-section>

              <div v-if="$route.query.filter" class="account-filter-note">
                Only showing: <q-badge v-for="i in $route.query.filter.split(',')" :key="i" color="blue-grey-9">{{ i }}</q-badge>
                <q-btn flat dense no-caps color="primary" icon="close" label="Clear" @click="filter = null; $router.push({ query: {} }); getAccountHistoryMarker()" />
              </div>

              <q-card-section class="account-activity__body">
                <account-operations :accountOperations="accountOperations" />
              </q-card-section>

              <q-card-section class="account-activity__pager">
                <q-btn icon="keyboard_backspace" aria-label="First page" title="First page" color="primary" dense push @click="page = 1; accountOperations = []; $router.push({ path: ('@' + username), query: { page: page, filter: $route.query.filter }}); page = getAccountHistoryFiltered()" v-if="page > 2" />
                <q-btn icon="keyboard_arrow_left" aria-label="Previous page" title="Previous page" color="primary" dense push @click="page = (parseInt(page) - 1); accountOperations = []; $router.push({ path: ('@' + username), query: { page: page, filter: $route.query.filter }}); page = getAccountHistoryFiltered()" v-if="page > 1" />
                <span class="account-activity__page">Page {{ page }}</span>
                <q-spinner-puff size="1.6em" color="primary" v-if="accountOperations.length < 1" />
                <q-btn icon="keyboard_arrow_right" aria-label="Next page" title="Next page" color="primary" dense push @click="page = (parseInt(page) + 1); accountOperations = []; $router.push({ path: ('@' + username), query: { page: page, filter: $route.query.filter }}); getAccountHistoryFiltered()" v-if="page !== (( accountOperationsMarker / accountOperationsLimit) + 1).toFixed(0)" />
                <q-btn icon="keyboard_tab" aria-label="Last page" title="Last page" color="primary" dense push @click="page = ((accountOperationsMarker / accountOperationsLimit) + 1).toFixed(0); accountOperations = []; $router.push({ path: ('@' + username), query: { page: page, filter: $route.query.filter }}); getAccountHistoryFiltered()" v-if="page !== (( accountOperationsMarker / accountOperationsLimit) + 1).toFixed(0)" />
              </q-card-section>
            </q-card>
          </section>
          <aside class="account-sidebar">
            <home-recent-posts :account="username" />

            <q-card flat bordered class="account-card">
              <q-card-section>
                <h2 class="account-card__title account-card__title--small">Account details</h2>
                <props-list :obj="account" :ignoreKeys="['owner', 'active', 'posting', 'memo_key', 'json_metadata', 'posting_json_metadata', 'voting_manabar', 'downvote_manabar', 'witness_votes']" />
              </q-card-section>
            </q-card>

            <magi-account-summary :username="username" />

            <lightning-address-card :account="username" compact :show-qr="true" />

            <q-card flat bordered class="account-card">
              <q-card-section>
                <h2 class="account-card__title account-card__title--small">Withdraw routes</h2>
                <withdrawRoutes :username="username" />
              </q-card-section>
            </q-card>

            <q-card flat bordered class="account-card" v-if="account">
              <q-card-section>
                <div class="account-card__head">
                  <h2 class="account-card__title account-card__title--small">JSON metadata</h2>
                  <q-btn flat dense round icon="edit" title="Edit JSON metadata" aria-label="Edit JSON metadata" color="orange" @click="editJsonMeta = !editJsonMeta" v-if="account.name === loggedInUser" />
                </div>
                <json-viewer v-if="account.json_metadata" :data="JSON.parse(account.json_metadata)" />
                <span v-else class="account-muted">JSON metadata is currently empty.</span>
                <props-editor v-if="editJsonMeta" :json="account.json_metadata" :username="username" :account="account" type="jsonMeta" @editedProps="refreshAccount()" />
              </q-card-section>
            </q-card>

            <q-card flat bordered class="account-card" v-if="account.posting_json_metadata">
              <q-card-section>
                <div class="account-card__head">
                  <h2 class="account-card__title account-card__title--small">Posting metadata</h2>
                  <q-btn flat dense round icon="edit" title="Edit posting JSON metadata" aria-label="Edit posting JSON metadata" color="orange" @click="editPostingJson = !editPostingJson" v-if="account.name === loggedInUser" />
                </div>
                <json-viewer v-if="account.posting_json_metadata && editPostingJson === false" :data="JSON.parse(account.posting_json_metadata)" />
                <span v-else class="account-muted">Posting JSON metadata is currently empty.</span>
                <props-editor v-if="account.posting_json_metadata && editPostingJson" :json="account.posting_json_metadata" :username="username" :account="account" type="postingMeta" @editedProps="refreshAccount()" />
              </q-card-section>
            </q-card>

            <q-card flat bordered class="account-card">
              <q-card-section>
                <account-authorities :account="account" :witness="witness" v-on:authEdited="$hiveStore.getAccount(username, { force: true })" />
              </q-card-section>
            </q-card>

            <authority-risk-card :account="account" :witness="witness" class="account-card" />

            <q-card flat bordered class="account-card" v-if="witness">
              <q-card-section>
                <div class="account-card__head">
                  <h2 class="account-card__title account-card__title--small">Witness properties</h2>
                  <q-btn flat dense round icon="edit" color="orange" title="Edit witness properties" aria-label="Edit witness properties" @click="$router.push('/witness')" v-if="loggedInUser === username" />
                </div>
                <props-list :obj="witness" :ignoreKeys="[]" />
              </q-card-section>
            </q-card>

            <q-card flat bordered class="account-card">
              <q-card-section>
                <div class="account-card__head">
                  <h2 class="account-card__title account-card__title--small">Witness votes</h2>
                  <q-btn flat dense round icon="edit" color="orange" title="Edit witness votes" aria-label="Edit witness votes" @click="$router.push('/witnesses')" v-if="loggedInUser && username === loggedInUser" />
                </div>
                <div class="account-muted account-muted--row" :title="account.governance_vote_expiration_ts" v-if="account.governance_vote_expiration_ts">
                  <q-icon name="schedule" size="14px" aria-hidden="true" />
                  <span>Expires {{ timeDelta(account.governance_vote_expiration_ts) }}</span>
                </div>
                <ul class="account-witness-votes" v-if="witnessVotes.length" aria-label="Witness votes">
                  <li v-for="w in witnessVotes" :key="w" class="account-witness-votes__item">
                    <router-link :to="accountLink(w)" :title="'@' + w">
                      <q-avatar size="18px" aria-hidden="true"><q-img :src="getHiveAvatarUrl(w)" alt="" /></q-avatar>
                      <span class="account-witness-votes__name">@{{ w }}</span>
                    </router-link>
                  </li>
                </ul>
                <div v-if="account.proxy" class="account-muted account-muted--row">
                  <q-icon name="swap_horiz" size="14px" aria-hidden="true" />
                  <span>Voting proxy set to <router-link :to="accountLink(account.proxy)">@{{ account.proxy }}</router-link></span>
                </div>
                <div v-else-if="witnessVotes.length === 0" class="account-empty">
                  <q-icon name="how_to_vote" size="20px" aria-hidden="true" />
                  <span>No witness votes or voting proxy have been set.</span>
                  <template v-if="loggedInUser && username === loggedInUser">
                    <span class="account-empty__pitch">Like this site? <router-link to="/witnesses">Vote for ausbitbank</router-link>!</span>
                    <q-btn outline dense no-caps icon="how_to_vote" color="primary" class="account-empty__btn" title="Edit witness votes" @click="$router.push('/witnesses')" label="Vote for witnesses" />
                  </template>
                </div>
              </q-card-section>
            </q-card>
          </aside>
        </div>
      </div>
      </template>
      </profile-skin>
    </template>

    <div v-else class="account-loading" aria-label="Loading account">
      <q-skeleton type="rect" height="180px" />
      <q-skeleton type="rect" height="120px" class="q-mt-md" />
      <q-skeleton type="rect" height="320px" class="q-mt-md" />
    </div>
  </q-page>
</template>
<style scoped>
.account-page {
  min-width: 0;
  padding-bottom: var(--space-6);
}

.account-moderation {
  width: 100%;
  max-width: 900px;
  margin: var(--space-3) auto 0;
  padding: 0 var(--space-3);
}

.account-shell {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
  width: 100%;
  max-width: 1280px;
  margin: 0 auto;
  padding: var(--space-4) var(--space-4) var(--space-6);
}

.account-card {
  overflow: hidden;
  border-radius: var(--radius-card);
}

.account-card__head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: var(--space-2);
  flex-wrap: wrap;
}

.account-card__eyebrow {
  color: var(--c-text-faint);
  font-size: 0.66rem;
  letter-spacing: 0.07em;
  text-transform: uppercase;
}

.account-card__title {
  margin: 0.1rem 0 0;
  color: var(--c-text);
  font-size: 1.05rem;
  font-weight: 600;
  line-height: 1.25;
}

.account-card__title--small {
  font-size: 0.9rem;
}

.account-overview-actions {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  flex-wrap: wrap;
}

.account-quick-links {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.2rem;
}

.account-quick-links a {
  padding: 0.18rem 0.5rem;
  border: 1px solid transparent;
  border-radius: var(--radius-pill);
  color: var(--c-link-soft);
  font-size: 0.76rem;
  font-weight: 500;
  text-decoration: none;
  transition: border-color 0.15s ease, background 0.15s ease, color 0.15s ease;
}

.account-quick-links a:hover {
  border-color: color-mix(in srgb, var(--c-link) 35%, transparent);
  background: color-mix(in srgb, var(--c-link) 8%, transparent);
  color: var(--c-link-soft);
  text-decoration: none;
}

.account-stat-grid {
  display: grid;
  grid-template-columns: repeat(6, minmax(0, 1fr));
  align-items: stretch;
  gap: 0.5rem;
  margin-top: 1rem;
}

.account-stat {
  display: flex;
  flex-direction: column;
  gap: 0.1rem;
  height: 100%;
  padding: 0.55rem 0.65rem;
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-sm);
  background: color-mix(in srgb, var(--c-text) 3%, transparent);
}

.account-stat__label {
  color: var(--c-text-subtle);
  font-size: 0.64rem;
  letter-spacing: 0.05em;
  text-transform: uppercase;
}

.account-stat__value {
  color: var(--c-text);
  font-size: 0.95rem;
  font-weight: 600;
}

.account-stat__hint {
  color: var(--c-text-faint);
  font-size: 0.68rem;
  line-height: 1.3;
}

.account-stat__bar {
  margin-top: 0.2rem;
}

.account-stat--rc {
  justify-content: flex-start;
}

.account-powerdown {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  flex-wrap: wrap;
  margin-top: 0.75rem;
  padding: 0.45rem 0.6rem;
  border: 1px solid color-mix(in srgb, var(--c-warning) 25%, transparent);
  border-radius: var(--radius-sm);
  background: color-mix(in srgb, var(--c-warning) 7%, transparent);
  color: var(--c-warning);
  font-size: 0.78rem;
}

.account-powerdown__time {
  color: var(--c-text-muted);
  font-size: 0.72rem;
}

.account-external {
  margin-top: 0.75rem;
  color: var(--c-text-faint);
  font-size: 0.72rem;
}

.account-external a {
  color: var(--c-link);
}

.account-grid {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 360px;
  align-items: start;
  gap: var(--space-4);
}

.account-main,
.account-sidebar {
  min-width: 0;
}

.account-sidebar {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
}

.account-activity__actions {
  display: flex;
  align-items: center;
  gap: 0.35rem;
  flex-wrap: wrap;
}

.account-activity__actions .q-toggle {
  color: var(--c-text-muted);
  font-size: 0.8rem;
}

.account-filter-card {
  display: flex;
  flex-direction: column;
  gap: 0.6rem;
  width: min(360px, 92vw);
  padding: var(--space-4);
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-card);
  background: var(--c-surface-2);
  box-shadow: var(--shadow-pop);
}

.account-filter-card__title {
  color: var(--c-text);
  font-size: 0.92rem;
  font-weight: 600;
}

.account-filter-card__actions {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 0.3rem;
}

.account-filter-note {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 0.35rem;
  padding: 0.5rem 1rem;
  border-bottom: 1px solid var(--border-subtle);
  color: var(--c-text-subtle);
  font-size: 0.75rem;
}

.account-activity__body {
  padding: 0.25rem 0;
}

.account-activity__pager {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.25rem;
  padding: 0.6rem;
  border-top: 1px solid var(--border-subtle);
}

.account-activity__page {
  color: var(--c-text-subtle);
  font-size: 0.8rem;
}

.account-muted {
  color: var(--c-text-subtle);
  font-size: 0.8rem;
}

.account-muted--row {
  display: flex;
  align-items: center;
  gap: 0.3rem;
  margin-top: 0.35rem;
  font-size: 0.74rem;
}

.account-muted--row .q-icon {
  color: var(--c-text-faint);
}

.account-muted a {
  color: var(--c-link);
  text-decoration: none;
}

.account-muted a:hover {
  text-decoration: underline;
}

.account-witness-votes {
  display: flex;
  flex-wrap: wrap;
  gap: 0.3rem;
  margin: 0.5rem 0 0;
  padding: 0;
  list-style: none;
}

.account-witness-votes__item a {
  display: inline-flex;
  align-items: center;
  gap: 0.3rem;
  max-width: 100%;
  padding: 0.15rem 0.45rem 0.15rem 0.15rem;
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-pill);
  background: color-mix(in srgb, var(--c-text) 3%, transparent);
  color: var(--c-text-soft);
  font-size: 0.72rem;
  font-weight: 500;
  text-decoration: none;
}

.account-witness-votes__item a:hover {
  border-color: color-mix(in srgb, var(--c-link) 40%, transparent);
  background: color-mix(in srgb, var(--c-link) 8%, transparent);
  color: var(--c-text-strong);
  text-decoration: none;
}

.account-witness-votes__name {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.account-empty {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 0.35rem;
  margin-top: 0.4rem;
  padding: 0.6rem 0.7rem;
  border: 1px dashed var(--border-subtle);
  border-radius: var(--radius-sm);
  color: var(--c-text-subtle);
  font-size: 0.76rem;
  line-height: 1.45;
}

.account-empty > .q-icon {
  color: var(--c-text-faint);
}

.account-empty__pitch {
  color: var(--c-text-muted);
}

.account-empty__pitch a {
  color: var(--c-link);
}

.account-empty__btn {
  margin-top: 0.15rem;
  border-radius: var(--radius-pill);
  font-size: 0.74rem;
  font-weight: 600;
}

.account-state,
.account-loading {
  width: 100%;
  max-width: 1280px;
  margin: 2rem auto;
  padding: var(--space-6);
}

.account-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.5rem;
  max-width: 620px;
  text-align: center;
}

.account-state__title {
  margin: 0;
  font-size: 1.3rem;
}

.account-loading {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

@media (max-width: 1023px) {
  .account-grid {
    grid-template-columns: minmax(0, 1fr);
  }

  .account-stat-grid {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }
}

@media (max-width: 599px) {
  .account-shell {
    padding: var(--space-3) var(--space-2) var(--space-5);
  }

  .account-stat-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .account-card__head {
    flex-direction: column;
    align-items: stretch;
  }
}
</style>
<script>
import moment from 'src/utils/time'
import { defineAsyncComponent } from 'vue'
const jsonViewer = defineAsyncComponent(() => import('components/jsonViewer.vue'))
import HomeRecentPosts from 'components/HomeRecentPosts.vue'
import propsList from 'components/propsList.vue'
import propsEditor from 'components/propsEditor.vue'
import accountOperations from 'components/accountOperations.vue'
import accountHeader from 'components/accountHeader.vue'
import moderation from 'src/mixins/moderation'
import accountAuthorities from 'components/accountAuthorities.vue'
import AuthorityRiskCard from 'components/account/AuthorityRiskCard.vue'
import MagiAccountSummary from 'components/account/MagiAccountSummary.vue'
import LightningAddressCard from 'components/lightning/LightningAddressCard.vue'
import { operations as op, makeBitMaskFilter } from 'src/services/hiveOperations'
import rc from 'components/rc.vue'
import withdrawRoutes from 'components/withdrawRoutes.vue'
import { setPageMeta, stripHtml, BASE_URL } from 'src/utils/pageMeta'
import { fetchAccount, fetchWitnessByAccount } from 'src/services/chainData'
import { vestToHive } from 'src/services/wallet'
import { formatReputation } from 'src/services/comments'
import ShareMenu from 'components/ui/ShareMenu.vue'
import ProfileSkin from 'components/theme/ProfileSkin.vue'
import ProfileShelf from 'components/theme/ProfileShelf.vue'
import { hiveAvatarUrl } from 'src/utils/avatar'
export default {
  name: 'accountPage',
  mixins: [moderation],
  components: {
    jsonViewer,
    HomeRecentPosts,
    propsList,
    propsEditor,
    accountOperations,
    accountHeader,
    ModerationNotice: defineAsyncComponent(() => import('components/moderation/ModerationNotice.vue')),
    rc,
    accountAuthorities,
    AuthorityRiskCard,
    MagiAccountSummary,
    LightningAddressCard,
    withdrawRoutes,
    ShareMenu,
    ProfileSkin,
    ProfileShelf
    // recentVotedPostsCarousel
  },
  data () {
    return {
      username: this.$route.params.username,
      votingPowerPct: 0.5,
      downvotingPowerPct: 0.5,
      resourceCreditsPct: 0.5,
      accountValue: null,
      RC: { max: null, current: null, percent: null },
      witness: null,
      accountOperations: [],
      accountOperationsLimit: 50,
      accountOperationsMarker: null,
      page: this.$route.query.page || 1,
      editPostingJson: false,
      editJsonMeta: false,
      error: false,
      errorMessage: '',
      operationsBitmask: null,
      accountHistoryPointer: -1,
      accountHistoryLimit: 1000,
      filteredOperationsArray: [],
      filter: this.$route.query.filter || null,
      failCount: 0,
      failCountMax: 10,
      autorefresh: false,
      autorefreshMinutes: 2,
      autorefreshTimer: null,
      rewardFundPost: null,
      medianPrice: null,
      profileReputation: null
    }
  },
  watch: {
    username: function () {
      this.accountOperationsMarker = null
    this.init()
    },
    $route: function () {
      this.init()
    },
    account: function () {
      this.updatePageMeta()
    }
  },
  computed: {
    profileModeration () {
      if (!this.account) return { display: 'show', primary: null, reasons: [], overrides: [] }
      return this.moderationDecision({
        author: this.account.name,
        post: { author_reputation: this.account.reputation, stats: {} },
        surface: 'profile',
        itemKey: 'profile:' + this.account.name
      })
    },
    loggedInUser: {
      get () { return this.$hiveStore.user.username }
    },
    globalProps: {
      get () {
        return this.$hiveStore.globalProps
      }
    },
    account: {
      cache: false,
      get () {
        return this.$hiveStore.accounts[this.username]
      }
    },
    /* A partially hydrated account (a node returning a trimmed payload, or a
       privacy extension stripping fields) must degrade, not throw: every
       balance field below is read through these guards. */
    accountReady: {
      get () {
        const account = this.account
        if (!account) return false
        if (this.globalProps === null || this.globalProps === undefined) return false
        return ['vesting_shares', 'received_vesting_shares', 'delegated_vesting_shares', 'vesting_withdraw_rate']
          .every(key => typeof account[key] === 'string')
      }
    },
    accountAge: function () {
      if (!this.account || !this.account.created) return '—'
      return moment(this.account.created).fromNow()
    },
    accountAgeShort: function () {
      if (!this.account || !this.account.created) return '—'
      return moment(this.account.created).format('MMMM YYYY')
    },
    displayReputation: function () {
      if (this.profileReputation !== null && this.profileReputation !== undefined) {
        const value = Number(this.profileReputation)
        return Number.isFinite(value) ? value.toFixed(1) : '—'
      }
      const raw = Number(this.account && this.account.reputation)
      if (!raw) return '—'
      return this.getReputation(raw)
    },
    votePower: function () {
      if (!this.account || !this.account.last_vote_time) return '0.00'
      var secondsago = (new Date() - new Date(this.account.last_vote_time + 'Z')) / 1000
      var vpow = (Number(this.account.voting_power) || 0) + (10000 * secondsago / 432000)
      return Math.min(vpow / 100, 100).toFixed(2)
    },
    effectiveHPTidy: function () {
      return this.tidyNumber(this.effectiveHP)
    },
    effectiveHP: function () {
      return this.vestToHive(this.effectiveVests)
    },
    effectiveVests: function () {
      if (!this.accountReady) return null
      return parseInt(this.account.vesting_shares.split(' ')[0]) + parseInt(this.account.received_vesting_shares.split(' ')[0]) - parseInt(this.account.delegated_vesting_shares.split(' ')[0]) - parseInt(this.account.vesting_withdraw_rate.split(' ')[0])
    },
    downvotePower: function () {
      if (!this.accountReady) return null
      const manabar = this.account.downvote_manabar || {}
      const current = Number(manabar.current_mana)
      const max = (this.effectiveVests / 4) * 1e4
      if (!Number.isFinite(current) || !Number.isFinite(max) || max <= 0) return null
      return (current / max) * 100
    },
    downvotePowerPct: function () {
      if (this.downvotePower === null) return '—'
      var pct = (this.downvotePower / 100).toFixed(2)
      if (pct > 100) { pct = 100.00 }
      return pct
    },
    powerDownActive: function () {
      if (!this.accountReady) return false
      return parseInt(this.account.vesting_withdraw_rate.split(' ')[0]) !== 0
    },
    witnessVotes: function () {
      const votes = this.account && this.account.witness_votes
      return Array.isArray(votes) ? votes : []
    },
    coverImage: function () {
      var defaultCover = 'https://files.peakd.com/file/peakd-hive/ausbitbank/8xq5izkP-cover-1.jpg'
      if (this.account === null) {
        return defaultCover
      } else {
        if (this.account.posting_json_metadata) {
          if (JSON.parse(this.account.posting_json_metadata).profile) {
            if (JSON.parse(this.account.posting_json_metadata).profile.cover_image) {
              return JSON.parse(this.account.posting_json_metadata).profile.cover_image
            } else {
              return defaultCover
            }
          } else {
            return defaultCover
          }
        } else {
          return defaultCover
        }
      }
    },
    coverImageStyle: function () {
      if (this.coverImage) {
        return { 'background-image': 'linear-gradient(rgba(0, 0, 0, 0.3) 0%, rgba(0, 0, 0, 0.3) 40%, rgba(10, 10, 10, 0.75) 100%), url(' + this.coverImage + ')', 'background-position': 'center-center', 'background-repeat': 'no-repeat', 'background-size': 'cover', 'background-clip': 'border-box, border-box', 'background-color': 'rgba(0, 0, 0, 0)', 'background-attachment': 'scroll, scroll' }
      } else {
        return null
      }
    },
    recentVotes: function () {
      if (this.accountOperations) {
        var last10votes = this.accountOperations.filter(this.filterOpsVotes).slice(0, 10)
        var votesArr = []
        for (var op in last10votes) {
          votesArr.push({ author: last10votes[op][1].op[1].author, permlink: last10votes[op][1].op[1].permlink })
        }
        return votesArr
      } else {
        return null
      }
    },
    resourceBudgetComments: function () {
      if (this.RC.current) {
        var cost = (0.866099987 * 1000000000)
        var available = (this.RC.current / cost)
        if (available >= 100) {
          return '100+'
        } else {
          return available.toFixed(0)
        }
      } else {
        return null
      }
    },
    resourceBudgetVotes: function () {
      if (this.RC.current) {
        var cost = (0.098893838 * 1000000000)
        var available = (this.RC.current / cost)
        if (available >= 100) {
          return '100+'
        } else {
          return available.toFixed(0)
        }
      } else {
        return null
      }
    },
    resourceBudgetTransfers: function () {
      if (this.RC.current) {
        var cost = (0.476452196 * 1000000000)
        var available = (this.RC.current / cost)
        if (available >= 100) {
          return '100+'
        } else {
          return available.toFixed(0)
        }
      } else {
        return null
      }
    },
    voteValue: function () {
      if (this.hivePrice !== 0 && this.rewardFundPost !== null && this.effectiveVests !== null) {
        var finalVest = this.effectiveVests * 1e6
        var power = (100 * 10000 / 10000) / 50
        var rshares = power * finalVest / 10000
        var estimate = rshares / parseFloat(this.rewardFundPost.recent_claims) * parseFloat(this.rewardFundPost.reward_balance.split(' ')[0]) * this.hivePrice
        return estimate
      } else {
        return 0
      }
    },
    hivePrice: function () {
      if (this.medianPrice !== null) {
        var base = parseFloat(this.medianPrice.base.split(',')[0])
        var quote = parseFloat(this.medianPrice.quote.split(',')[0])
        return base / quote
      } else {
        return 0
      }
    }
  },
  methods: {
    getProfileMeta () {
      if (!this.account || !this.account.posting_json_metadata) return null
      try {
        const metadata = JSON.parse(this.account.posting_json_metadata)
        return metadata && metadata.profile ? metadata.profile : null
      } catch {
        return null
      }
    },
    setNotFoundMeta (description) {
      setPageMeta({
        title: 'Account @' + this.username + ' not found — hive.ausbit.dev',
        description: description || 'This Hive account does not exist.',
        noindex: true
      })
    },
    updatePageMeta () {
      const name = this.username
      const profile = this.getProfileMeta() || {}
      const displayName = stripHtml(profile.name, 80)
      const about = stripHtml(profile.about, 200)
      const pageUrl = BASE_URL + '/@' + name
      const avatar = hiveAvatarUrl(name, 'medium')
      const image = [profile.profile_image, profile.cover_image]
        .find(value => typeof value === 'string' && /^(https?:\/\/|\/)/.test(value)) || avatar
      const description = about || ('Hive account @' + name + ' — profile, wallet balances, reputation, witness votes and recent activity on the Hive blockchain.')
      setPageMeta({
        title: displayName ? displayName + ' (@' + name + ') — Hive account' : '@' + name + ' — Hive account',
        description,
        image,
        url: '/@' + name,
        jsonLd: {
          '@context': 'https://schema.org',
          '@type': 'ProfilePage',
          url: pageUrl,
          mainEntity: {
            '@type': 'Person',
            identifier: '@' + name,
            name: displayName || name,
            alternateName: '@' + name,
            description,
            image,
            url: pageUrl
          }
        }
      })
    },
    autoRefreshToggle () {
      if (this.autorefresh === true) {
        this.autorefreshTimer = setTimeout(this.autoRefreshTrigger, this.autorefreshMinutes * 60 * 1000)
      } else {
        clearTimeout(this.autorefreshTimer)
      }
    },
    autoRefreshTrigger () {
      clearTimeout(this.autorefreshTimer)
      if (this.autorefreshMinutes < 0.5) { this.autorefreshMinutes = 1 }
      if (this.autorefresh === true) {
        if (typeof document !== 'undefined' && document.visibilityState === 'hidden') {
          this.autorefreshTimer = setTimeout(this.autoRefreshTrigger, this.autorefreshMinutes * 60 * 1000)
          return
        }
        this.getAccountHistoryMarker()
        this.autorefreshTimer = setTimeout(this.autoRefreshTrigger, this.autorefreshMinutes * 60 * 1000)
      }
    },
    async getRewardFundPost () {
      try {
        this.rewardFundPost = await this.$hive.api.getRewardFund('post')
      } catch (err) {
        console.log(err)
      }
    },
    async getMedianPrice () {
      try {
        const result = await this.$hive.api.getCurrentMedianHistoryPriceAsync()
        if (result) { this.medianPrice = result }
      } catch (err) {
        console.error(err)
      }
    },
    async getAccountHistoryFiltered () {
      this.accountOperations = []
      if (this.operationsBitmask === null) {
        await this.getAccountHistory()
      } else {
        var limit = this.accountOperationsLimit
        var page = this.$route.query.page || 1
        var pageReq = this.accountOperationsMarker - (limit * page)
        pageReq = pageReq + limit
        if (pageReq <= (limit - 1)) { pageReq = limit - 1 } // Catch the last (first) page results
        if (page === null || page === 1) { pageReq = -1 } // Get most recent activities on page 1
        console.log('page: ' + page + ' , accountOpsMarker: ' + this.accountOperationsMarker, ' pagReq: ' + pageReq + ' limit: ' + this.accountOperationsLimit)
        this.loading = true
        // await this.$hive.api.callAsync('call', ['condenser_api', 'get_account_history', [this.username, pageReq, this.accountOperationsLimit, ...this.operationsBitmask]])
        await this.$hive.api.callAsync('condenser_api.get_account_history', [this.username, pageReq, this.accountOperationsLimit, ...this.operationsBitmask])
          .then(res => {
            this.accountHistoryPointer = parseInt(res[0][0]) - 1
            if (this.accountOperations.length === 0) { this.accountOperations = res.reverse() } else { this.accountOperations = this.accountOperations.concat(res.reverse()) }
            this.loading = false
          })
          .catch(err => {
            this.loading = false
            console.error(err)
            const sequence = err?.data?.stack?.[0]?.data?.sequence
            const message = err?.cause?.message || err?.message || ''
            if (sequence && message.includes('Could not find filtered operation in')) {
              this.failCount++
              this.accountOperationsMarker = sequence
              if (this.failCount <= this.failCountMax) {
                setTimeout(() => this.getAccountHistoryFiltered(), 5000)
              }
            }
          })
      }
    },
    filterOpsVotes (op) { if (op[1].op[0] === 'vote') { return true } else { return false } },
    async getAccountHistory () {
      var limit = this.accountOperationsLimit
      var page = this.$route.query.page || 1
      var pageReq = this.accountOperationsMarker - (limit * page)
      pageReq = pageReq + limit
      if (pageReq <= (limit - 1)) { pageReq = limit - 1 } // Catch the last (first) page results
      if (page === null || page === 1) { pageReq = -1 } // Get most recent activities on page 1
      try {
        const response = await this.$hive.api.getAccountHistory(this.username, pageReq, this.accountOperationsLimit)
        this.accountOperations = response.reverse()
      } catch (err) {
        console.log(err)
      }
    },
    async getAccountHistoryMarker () {
      var prev = this.accountOperationsMarker
      if (prev !== null) { console.log('previous marker:' + prev) }
      if (this.$route.query.filter) {
        var filter = this.$route.query.filter.split(',')
        filter.forEach(element => this.filteredOperationsArray.push(op[element]))
        this.operationsBitmask = makeBitMaskFilter(this.filteredOperationsArray)
        // await this.$hive.api.callAsync('call', ['condenser_api', 'get_account_history', [this.username, -1, 1000, ...this.operationsBitmask]])
        await this.$hive.api.callAsync('condenser_api.get_account_history', [this.username, -1, 1000, ...this.operationsBitmask])
          .then(res => { this.accountOperationsMarker = res[0][0]; if (this.accountOperationsMarker !== prev || this.filter !== null) { this.getAccountHistoryFiltered() } })
          .catch(err => { console.error(err) })
      } else {
        // await this.$hive.api.callAsync('call', ['condenser_api', 'get_account_history', [this.username, -1, 1]])
        await this.$hive.api.callAsync('condenser_api.get_account_history', [this.username, -1, 1])
          .then(res => { if (res.length === 0) { this.errorMessage = 'Account ' + this.username + ' not found'; this.error = true } else { this.error = false; this.errorMessage = ''; this.accountOperationsMarker = res[0][0] } if (this.accountOperationsMarker !== prev || this.filter !== null) { this.getAccountHistoryFiltered() } })
          .catch(err => { console.error(err) })
      }
    },
    accountLink (username) {
      return '/@' + username
    },
    linkWallet (username) { return '/@' + username + '/wallet' },
    linkBlog (username) { return '/@' + username + '/blog' },
    linkPosts (username) { return '/@' + username + '/posts' },
    linkComments (username) { return '/@' + username + '/comments' },
    linkReplies (username) { return '/@' + username + '/replies' },
    linkFeed (username) { return '/@' + username + '/feed' },
    linkHiveBlog (username) {
      return 'https://hive.blog/@' + username
    },
    linkPeakd (username) {
      return 'https://peakd.com/@' + username
    },
    linkEcency (username) {
      return 'https://ecency.com/@' + username
    },
    linkTx (txid) {
      return '/tx/' + txid
    },
    getReputation (rep) {
      return formatReputation(rep)
    },
    async loadAccount () {
      try {
        const account = await fetchAccount(this.username, { force: true })
        if (!account || !account.name) {
          this.error = true
          this.errorMessage = 'Account @' + this.username + ' was not found.'
          this.setNotFoundMeta('Account @' + this.username + ' was not found.')
          return
        }
        this.$hiveStore.updateAccountData(account)
        this.getWitness(this.username)
        this.fetchProfileReputation()
      } catch {
        this.error = true
        this.errorMessage = 'Could not load @' + this.username + '.'
        this.setNotFoundMeta(this.errorMessage)
      }
    },
    async fetchProfileReputation () {
      try {
        const profile = await this.$hive.api.callAsync('bridge.get_profile', { account: this.username })
        this.profileReputation = profile && profile.reputation !== undefined ? Number(profile.reputation) : null
      } catch {
        this.profileReputation = null
      }
    },
    getWitness (username) {
      fetchWitnessByAccount(username)
        .then((response) => {
          this.witness = response
        })
        .catch(() => console.log('Failed to load witness data'))
    },
    getHiveAvatarUrl (user) { return hiveAvatarUrl(user) },
    getGlobalProps () {
      if (this.globalProps.empty) {
        this.$hiveStore.getGlobalProps()
      }
    },
    vestToHive (vests) {
      if (this.globalProps) {
        return vestToHive(vests, this.globalProps).toFixed(3)
      } else {
        return null
      }
    },
    timeDelta (timestamp) {
      var now = moment.utc()
      var stamp = moment.utc(timestamp)
      var diff = stamp.diff(now, 'minutes')
      return moment.duration(diff, 'minutes').humanize(true)
    },
    tidyNumber (x) {
      if (x) {
        var parts = x.toString().split('.')
        parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',')
        return parts.join('.')
      } else {
        return null
      }
    },
    returnLink (author, permlink) { return '/@' + author + '/' + permlink },
    returnBlockLink (blockNum, txId) { return '/b/' + blockNum + '#' + txId },
    refreshAccount () { this.$hiveStore.getAccount(this.username, { force: true }) },
    async init () {
      this.error = false
      this.errorMessage = ''
      this.profileReputation = null
      this.getGlobalProps()
      // this.getMedianPrice()
      // this.getRewardFundPost()
      this.page = this.$route.query.page || 1
      this.username = this.$route.params.username
      this.updatePageMeta()
      await this.loadAccount()
      if (!this.error) this.getAccountHistoryMarker()
      if (this.autorefresh === true) { setTimeout(this.autoRefreshTrigger, this.autorefreshMinutes * 60 * 1000) }
    }
  },
  created () {
    this.init()
  },
  beforeUnmount () {
    clearTimeout(this.autorefreshTimer)
  }
}
</script>
