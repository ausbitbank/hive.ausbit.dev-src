<template>
  <q-page class="dv-page">
    <profile-skin :account="account" :author="username" context="profile">
    <account-header
      v-if="account !== undefined && globalProps !== null"
      :globalProps="globalProps"
      :account="account"
      :showBalances="false"
    />

    <div class="dv-shell">
      <header class="dv-head">
        <div>
          <div class="dv-eyebrow">Downvote transparency</div>
          <h1 class="dv-title">@{{ username }} downvotes</h1>
          <p class="dv-intro">
            Public chain activity, grouped for review. A downvote is a signal,
            not a verdict; a local ignored voter changes the view, not the chain.
          </p>
        </div>
        <div class="dv-actions">
          <q-btn flat dense no-caps icon="refresh" label="Refresh" :loading="loading" @click="load({ force: true })" />
          <q-btn v-if="isOwn" flat dense no-caps :icon="direction === 'received' ? 'south' : 'north'" :label="direction === 'received' ? 'Received' : 'Given'" @click="toggleDirection" />
          <q-btn flat dense no-caps icon="person" label="Account" :to="'/@' + username" />
        </div>
      </header>

      <div v-if="error" class="dv-state dv-state--error" role="alert">
        <q-icon name="error_outline" size="1.4em" aria-hidden="true" />
        <span>{{ error }}</span>
        <q-btn flat dense no-caps color="primary" icon="refresh" label="Retry" @click="load({ force: true })" />
      </div>

      <div v-else-if="loading && !rows.length" class="dv-skeletons" aria-label="Loading downvotes">
        <q-skeleton type="rect" height="86px" />
        <q-skeleton type="rect" height="260px" />
      </div>

      <template v-else>
        <section class="dv-summary" aria-label="Downvote summary">
          <div class="dv-stat">
            <span>Downvotes {{ direction }}</span>
            <strong>{{ summary.count }}</strong>
            <small>{{ summary.distinctTargets }} target{{ summary.distinctTargets === 1 ? '' : 's' }}</small>
          </div>
          <div class="dv-stat">
            <span>Distinct voters</span>
            <strong>{{ summary.distinctVoters }}</strong>
            <small>Raw chain impact</small>
          </div>
          <div class="dv-stat">
            <span>Total deducted</span>
            <strong>{{ moneyLabel(impactSummary.totalUsd, { approximate: impactSummary.exactCount < impactSummary.effectiveCount }) }}</strong>
            <small v-if="impactSummary.effectiveCount">
              {{ impactSummary.exactCount }} exact of {{ impactSummary.effectiveCount }} · finalized {{ moneyLabel(impactSummary.finalizedUsd) }}
            </small>
            <small v-else>Estimate unavailable</small>
          </div>
          <div class="dv-stat">
            <span>Largest deduction</span>
            <strong>{{ moneyLabel(impactSummary.largestUsd, { approximate: true }) }}</strong>
            <small>{{ impactSummary.pendingUsd ? moneyLabel(impactSummary.pendingUsd) + ' still pending' : 'Finalized payouts' }}</small>
          </div>
          <div class="dv-stat">
            <span>After payout</span>
            <strong>{{ impactSummary.afterPayoutCount }}</strong>
            <small>signal-only votes · no reward impact</small>
          </div>
        </section>

        <p v-if="valuationLoading" class="dv-note">Estimating dollar impact from voter stake…</p>
        <p v-else-if="allDownvotes.length && !impactSummary.totalUsd" class="dv-note">
          {{ valuationError || 'Dollar estimates need each voter\'s Hive Power, downvote mana, the post reward fund and a price feed. The weight column is exact chain data; the dollar estimate is unavailable right now.' }}
        </p>

        <section class="dv-controls" aria-label="Downvote filters">
          <q-select v-model="range" :options="rangeOptions" dense outlined emit-value map-options label="Time range" class="dv-control" />
          <q-select v-model="relationshipFilter" :options="relationshipOptions" dense outlined emit-value map-options label="Voter relationship" class="dv-control" />
          <q-select v-model="minWeight" :options="weightOptions" dense outlined emit-value map-options label="Minimum weight" class="dv-control" />
          <q-select v-model="impactFilter" :options="impactFilterOptions" dense outlined emit-value map-options label="Impact" class="dv-control" />
          <q-select v-model="groupBy" :options="groupOptions" dense outlined emit-value map-options label="Group by" class="dv-control" />
          <q-input v-model="voterFilter" dense outlined clearable label="Voter" class="dv-control" />
          <q-input v-model="targetFilter" dense outlined clearable label="Target" class="dv-control" />
          <q-toggle v-model="showIgnored" label="Show locally ignored voters" dense class="dv-control" />
          <q-toggle v-model="noteFilter" :label="'With notes' + (noteCount ? ' (' + noteCount + ')' : '')" dense class="dv-control" />
          <q-btn flat dense no-caps icon="filter_alt_off" label="Clear filters" @click="clearFilters" />
          <q-btn flat dense no-caps icon="download" label="Export CSV" @click="exportCsv" />
          <q-btn flat dense no-caps icon="content_copy" label="Copy report" @click="copyReport" />
          <span class="dv-controls__count">{{ filtered.length }} of {{ allDownvotes.length }} loaded</span>
        </section>
        <div v-if="voterFilter || targetFilter" class="dv-focus">
          <span>
            Focused on
            <strong v-if="voterFilter">@{{ voterFilter }}</strong>
            <strong v-if="targetFilter">{{ targetFilter }}</strong>
          </span>
          <q-btn flat dense no-caps label="Clear focus" @click="clearFocus" />
        </div>

        <section class="dv-panel" aria-labelledby="dv-financial-title">
          <div class="dv-panel__head">
            <div>
              <div class="dv-eyebrow">Financial impact</div>
              <h2 id="dv-financial-title" class="dv-subtitle">What the downvotes actually cost</h2>
            </div>
            <q-badge color="blue-grey-8">{{ exactCoveragePercent }}% exact</q-badge>
          </div>
          <div class="dv-metrics">
            <div class="dv-metric">
              <span>Finalized</span>
              <strong>{{ moneyLabel(filteredImpactSummary.finalizedUsd) }}</strong>
            </div>
            <div class="dv-metric">
              <span>Still pending</span>
              <strong>{{ moneyLabel(filteredImpactSummary.pendingUsd) }}</strong>
            </div>
            <div class="dv-metric">
              <span>Author share (approx)</span>
              <strong>{{ moneyLabel(filteredImpactSummary.authorUsd) }}</strong>
            </div>
            <div class="dv-metric">
              <span>Curators / beneficiaries</span>
              <strong>{{ moneyLabel(filteredImpactSummary.curatorUsd) }}</strong>
            </div>
            <div class="dv-metric">
              <span>Exact rows</span>
              <strong>{{ filteredImpactSummary.exactCount }} / {{ filteredImpactSummary.effectiveCount }}</strong>
            </div>
            <div class="dv-metric">
              <span>Signal votes</span>
              <strong>{{ filteredImpactSummary.afterPayoutCount }}</strong>
            </div>
          </div>
          <div class="dv-panel__actions">
            <q-btn
              outline
              no-caps
              color="primary"
              icon="calculate"
              label="Calculate exact impact"
              :loading="impactLoading"
              :disable="!missingTargetCount && !impactError"
              @click="hydrateAllImpact"
            />
            <span v-if="impactProgress.total" class="dv-note">{{ impactProgress.done }} of {{ impactProgress.total }} target posts read</span>
            <span v-else-if="hydratedTargetCount" class="dv-note">{{ hydratedTargetCount }} target posts read</span>
            <q-btn flat no-caps color="primary" icon="compare_arrows" label="Compare with earnings" :loading="rewardsLoading" @click="loadRewardsComparison" />
          </div>
          <p v-if="impactError" class="dv-note">{{ impactError }}</p>
          <div v-if="rewardsComparison" class="dv-rewards">
            <div class="dv-metric">
              <span>Author rewards in period</span>
              <strong>{{ moneyLabel(rewardsComparison.rewardsUsd) }}</strong>
            </div>
            <div class="dv-metric">
              <span>Finalized downvote loss</span>
              <strong>{{ moneyLabel(rewardsComparison.lossUsd) }}</strong>
            </div>
            <div class="dv-metric">
              <span>Reduction vs counterfactual</span>
              <strong>{{ rewardsComparison.sharePercent === null ? '—' : rewardsComparison.sharePercent.toFixed(1) + '%' }}</strong>
            </div>
            <p class="dv-note">
              Reward history{{ rewards?.truncated ? ' is a sample' : '' }} for {{ rewards?.days }} days.
              The comparison uses finalized post payouts; pending posts are shown separately above.
            </p>
          </div>
          <p v-else-if="rewardsError" class="dv-note">{{ rewardsError }}</p>
        </section>

        <section class="dv-panel" aria-labelledby="dv-timeline-title">
          <div class="dv-panel__head">
            <div>
              <div class="dv-eyebrow">Timing</div>
              <h2 id="dv-timeline-title" class="dv-subtitle">When the downvotes arrive</h2>
            </div>
            <span class="dv-note">{{ timeline.totalCount }} votes · {{ moneyLabel(timeline.totalUsd, { approximate: true }) }}</span>
          </div>
          <div
            v-if="timeline.buckets.length"
            class="dv-chart"
            role="img"
            :aria-label="'Downvotes per UTC day over ' + timeline.buckets.length + ' days'"
          >
            <div
              v-for="(bucket, index) in timeline.buckets"
              :key="bucket.date"
              class="dv-chart__bar"
              :title="bucket.date + ': ' + bucket.count + ' votes, ' + moneyLabel(bucket.usd, { approximate: true })"
            >
              <div class="dv-chart__track">
                <div class="dv-chart__fill" :style="{ height: barHeight(bucket.count, timeline.maxCount) }" />
              </div>
              <span v-if="showDayLabel(index, timeline.buckets.length)" class="dv-chart__label">{{ shortDay(bucket.date) }}</span>
            </div>
          </div>
          <p v-else class="dv-note">No downvotes in this range.</p>
          <div v-if="timeline.cumulative.length > 1" class="dv-spark">
            <span class="dv-note">Cumulative deducted</span>
            <sparkline :data="timeline.cumulative" :width="680" :height="54" stroke="var(--c-primary)" fill="none" />
          </div>
          <div class="dv-two-col">
            <div>
              <h3 class="dv-mini-title">Post age at vote</h3>
              <ul class="dv-rank">
                <li v-for="bucket in ageBuckets" :key="bucket.key">
                  <div class="dv-rank__head">
                    <span class="dv-rank__key">{{ bucket.label }}</span>
                    <span class="dv-rank__meta">{{ bucket.count }} votes · {{ moneyLabel(bucket.usd, { approximate: true }) }}</span>
                  </div>
                  <div class="dv-rank__bar"><div :style="{ width: barWidth(bucket.count, maxAgeCount) }" /></div>
                </li>
              </ul>
            </div>
            <div>
              <h3 class="dv-mini-title">UTC hour</h3>
              <div class="dv-hour-chart" role="img" aria-label="Downvotes by UTC hour">
                <div
                  v-for="(bucket, index) in hourBucketsList"
                  :key="bucket.hour"
                  class="dv-chart__bar"
                  :title="bucket.label + ': ' + bucket.count + ' votes'"
                >
                  <div class="dv-chart__track">
                    <div class="dv-chart__fill" :style="{ height: barHeight(bucket.count, maxHourCount) }" />
                  </div>
                  <span v-if="index % 6 === 0" class="dv-chart__label">{{ bucket.hour }}</span>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section v-if="coordination" class="dv-evidence" aria-labelledby="dv-evidence-title">
          <div class="dv-evidence__head">
            <div>
              <div class="dv-evidence__eyebrow">Possible pattern</div>
              <h3 id="dv-evidence-title" class="dv-evidence__title">{{ coordination.label }}</h3>
            </div>
            <q-badge color="orange-9">not a verdict</q-badge>
          </div>
          <p class="dv-evidence__text">
            {{ coordination.voterCount }} voters share {{ coordination.targetCount }} targets inside
            {{ coordination.windowHours }}h; pairwise target overlap is {{ Math.round(coordination.overlap * 100) }}%.
            This is evidence for human review, never an automatic hide or punishment.
          </p>
          <div class="dv-evidence__lists">
            <div>
              <span class="dv-evidence__label">Voters</span>
              <router-link v-for="voter in coordination.voters" :key="'ev-voter-' + voter" :to="'/@' + voter" class="dv-chip">@{{ voter }}</router-link>
            </div>
            <div>
              <span class="dv-evidence__label">Targets</span>
              <router-link v-for="target in coordination.targets.slice(0, 6)" :key="'ev-target-' + target" :to="targetLink(target)" class="dv-chip">{{ target }}</router-link>
            </div>
          </div>
        </section>

        <section class="dv-panel" aria-labelledby="dv-patterns-title">
          <div class="dv-panel__head">
            <div>
              <div class="dv-eyebrow">Patterns</div>
              <h2 id="dv-patterns-title" class="dv-subtitle">Signals worth a closer look</h2>
            </div>
            <q-badge color="orange-9">evidence, not a verdict</q-badge>
          </div>
          <div class="dv-pattern-grid">
            <article v-if="repeatVoters.length" class="dv-pattern">
              <h3 class="dv-mini-title">Repeat targeting</h3>
              <button v-for="entry in repeatVoters.slice(0, 3)" :key="'repeat-' + entry.key" type="button" class="dv-pattern__row" @click="focusVoter(entry.key)">
                <span>@{{ entry.key }}</span>
                <span>{{ entry.count }} votes · {{ Math.round(entry.share * 100) }}% of loaded</span>
                <strong>{{ moneyLabel(entry.totalUsd, { approximate: entry.exactCount < entry.effectiveCount }) }}</strong>
              </button>
            </article>
            <article v-if="bursts.targetBursts.length || bursts.voterBursts.length" class="dv-pattern">
              <h3 class="dv-mini-title">Bursts</h3>
              <button v-for="entry in bursts.targetBursts.slice(0, 2)" :key="'tb-' + entry.target + entry.start" type="button" class="dv-pattern__row" @click="focusTarget(entry.target)">
                <span>{{ entry.target }}</span>
                <span>{{ entry.count }} voters in {{ Math.max(1, Math.round((entry.end - entry.start) / 60000)) }}m</span>
                <strong>{{ moneyLabel(entry.usd, { approximate: true }) }}</strong>
              </button>
              <button v-for="entry in bursts.voterBursts.slice(0, 2)" :key="'vb-' + entry.voter + entry.start" type="button" class="dv-pattern__row" @click="focusVoter(entry.voter)">
                <span>@{{ entry.voter }}</span>
                <span>{{ entry.count }} votes in {{ Math.max(1, Math.round((entry.end - entry.start) / 60000)) }}m</span>
                <strong>{{ moneyLabel(entry.usd, { approximate: true }) }}</strong>
              </button>
            </article>
            <article v-if="voteChangeRows.length" class="dv-pattern">
              <h3 class="dv-mini-title">Vote changes</h3>
              <button v-for="entry in voteChangeRows.slice(0, 3)" :key="'vc-' + entry.voter + entry.target" type="button" class="dv-pattern__row" @click="focusTarget(entry.target)">
                <span>@{{ entry.voter }} → {{ entry.target }}</span>
                <span>{{ entry.count }} votes · {{ (entry.firstWeight / 100).toFixed(1) }}% → {{ (entry.lastWeight / 100).toFixed(1) }}%</span>
              </button>
            </article>
            <article v-if="escalationRows.length" class="dv-pattern">
              <h3 class="dv-mini-title">Weight escalation</h3>
              <button v-for="entry in escalationRows.slice(0, 3)" :key="'we-' + entry.voter" type="button" class="dv-pattern__row" @click="focusVoter(entry.voter)">
                <span>@{{ entry.voter }}</span>
                <span>{{ (entry.firstWeight / 100).toFixed(1) }}% → {{ (entry.lastWeight / 100).toFixed(1) }}% across {{ entry.count }}</span>
              </button>
            </article>
            <article v-if="newVoterRows.length" class="dv-pattern">
              <h3 class="dv-mini-title">New accounts</h3>
              <button v-for="entry in newVoterRows.slice(0, 3)" :key="'na-' + entry.voter" type="button" class="dv-pattern__row" @click="focusVoter(entry.voter)">
                <span>@{{ entry.voter }}</span>
                <span>{{ entry.ageDays.toFixed(1) }} days old at first downvote</span>
                <strong>{{ moneyLabel(entry.usd, { approximate: true }) }}</strong>
              </button>
            </article>
            <article v-if="payoutSignalRows.count" class="dv-pattern">
              <h3 class="dv-mini-title">After-payout signals</h3>
              <button type="button" class="dv-pattern__row" @click="impactFilter = 'after-payout'">
                <span>{{ payoutSignalRows.count }} votes by {{ payoutSignalRows.voterCount }} voters</span>
                <span>No payout impact; show only these</span>
              </button>
            </article>
          </div>
          <p v-if="noPatterns" class="dv-note">No strong repeat or burst signals in this filter. Coordination cards are deliberately conservative.</p>
        </section>

        <section class="dv-two-col">
          <div class="dv-panel">
            <h2 class="dv-subtitle">Top voters</h2>
            <ol v-if="topVoters.length" class="dv-rank">
              <li v-for="entry in topVoters" :key="'tv-' + entry.key">
                <div class="dv-rank__head">
                  <button type="button" class="dv-link" @click="focusVoter(entry.key)">@{{ entry.key }}</button>
                  <span class="dv-rank__meta">{{ entry.count }} votes · {{ entry.exactCount }}/{{ entry.effectiveCount }} exact</span>
                </div>
                <div class="dv-rank__bar"><div :style="{ width: barWidth(entry.totalUsd, topVoters[0]?.totalUsd) }" /></div>
                <strong>{{ moneyLabel(entry.totalUsd, { approximate: entry.exactCount < entry.effectiveCount }) }}</strong>
              </li>
            </ol>
            <p v-else class="dv-note">No effective downvotes in this filter.</p>
          </div>
          <div class="dv-panel">
            <h2 class="dv-subtitle">Top targets</h2>
            <ol v-if="topTargets.length" class="dv-rank">
              <li v-for="entry in topTargets" :key="'tt-' + entry.key">
                <div class="dv-rank__head">
                  <button type="button" class="dv-link" @click="focusTarget(entry.key)">{{ entry.key }}</button>
                  <span class="dv-rank__meta">{{ entry.count }} votes · {{ entry.voters }} voters</span>
                </div>
                <div class="dv-rank__bar"><div :style="{ width: barWidth(entry.totalUsd, topTargets[0]?.totalUsd) }" /></div>
                <strong>{{ moneyLabel(entry.totalUsd, { approximate: entry.exactCount < entry.effectiveCount }) }}</strong>
              </li>
            </ol>
            <p v-else class="dv-note">No effective targets in this filter.</p>
          </div>
        </section>

        <details class="dv-help">
          <summary>How pattern hints work</summary>
          <p>
            A hint appears only when at least <strong>3 distinct voters</strong> each downvote at least
            <strong>3 shared targets</strong> inside a <strong>72-hour</strong> window, with
            <strong>60% or more pairwise target overlap</strong>. The card lists the voters, targets,
            count, window and overlap. It is evidence for human review, never an automatic hide,
            downvote or punishment.
          </p>
        </details>

        <details class="dv-help">
          <summary>How dollar impact is calculated</summary>
          <p>
            When the target post and the voter's chain vote are available, the impact is
            <strong>exact</strong>: the post's own HBD payout is split by the downvote's share
            of net rshares. Votes cast after the payout window are counted as signals with no
            payout impact. Otherwise the row falls back to an estimate from the voter's current
            Hive Power and downvote mana. The <em>exact</em>/<em>est.</em> label and the coverage
            badge show which is which.
          </p>
        </details>

        <details class="dv-help">
          <summary>How context and notes work</summary>
          <p>
            A vote has no on-chain reason. “Context” reads the target discussion and the voter's
            recent comment feed, then shows comments by the voter and the author’s replies as excerpts
            with before/after timing. Comments are context, not proof. Your notes and tags stay
            on this device and are included in the CSV and Markdown exports.
          </p>
        </details>

        <div v-if="groupBy !== 'none' && grouped.length" class="dv-groups">
          <article v-for="group in grouped" :key="group.key" class="dv-group">
            <div>
              <router-link v-if="groupBy === 'voter'" :to="'/@' + group.key" class="dv-group__key">@{{ group.key }}</router-link>
              <router-link v-else-if="groupBy === 'target'" :to="targetLink(group.key)" class="dv-group__key">{{ group.key }}</router-link>
              <span v-else class="dv-group__key">{{ group.key }}</span>
              <div class="dv-group__meta">
                {{ group.count }} votes · {{ group.voters }} voters<span v-if="groupValueLabel(group)"> · {{ groupValueLabel(group) }}</span>
              </div>
            </div>
            <div class="dv-group__actions">
              <q-btn v-if="groupBy === 'voter'" flat dense no-caps :label="isIgnored(group.key) ? 'Unignore voter' : 'Ignore voter'" @click="toggleIgnored(group.key)" />
            </div>
          </article>
        </div>

        <div v-else-if="!filtered.length" class="dv-state">
          <q-icon name="shield" size="1.6em" aria-hidden="true" />
          <span>{{ allDownvotes.length ? 'No downvotes match these filters.' : 'No ' + direction + ' downvotes in the loaded history.' }}</span>
        </div>

        <div v-else class="dv-table-wrap">
          <table class="dv-table">
            <caption class="sr-only">Downvotes with time, voter, relationship, weight, exact or estimated impact, target age and payout state, context and local actions</caption>
            <thead>
              <tr>
                <th scope="col">Time</th>
                <th scope="col">Voter</th>
                <th scope="col">Relationship</th>
                <th scope="col" class="dv-num">Weight</th>
                <th scope="col" class="dv-num">Impact</th>
                <th scope="col">Target</th>
                <th scope="col"><span class="sr-only">Actions</span></th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="row in pagedRows" :key="rowKey(row)">
                <td><time :datetime="row.timestamp">{{ timeLabel(row.timestamp) }}</time></td>
                <td>
                  <router-link :to="'/@' + row.voter">@{{ row.voter }}</router-link>
                  <span v-if="noteForRow(row)" class="dv-note-dot" title="You have a private note" aria-hidden="true">●</span>
                </td>
                <td><q-badge :color="relationshipColor(row.voter)">{{ relationship(row.voter) }}</q-badge></td>
                <td class="dv-num">{{ weightLabel(row.weight) }}</td>
                <td class="dv-num">
                  <span :class="impactClass(row)" :title="impactTitle(row)">{{ impactLabel(row) }}</span>
                  <small v-if="row.effective" class="dv-source">{{ row.impactConfidence === 'exact' ? 'exact' : 'est.' }}</small>
                </td>
                <td>
                  <router-link :to="targetLink(row.target)">{{ row.target }}</router-link>
                  <div class="dv-row-meta">
                    <span>{{ postAgeLabel(row) }} after posting</span>
                    <q-badge :color="payoutColor(row)">{{ payoutLabel(row) }}</q-badge>
                  </div>
                </td>
                <td class="dv-row-action">
                  <button type="button" class="dv-link" @click="openContext(row)">Context</button>
                  <button type="button" class="dv-link" @click="toggleIgnored(row.voter)">
                    {{ isIgnored(row.voter) ? 'Unignore' : 'Ignore voter' }}
                  </button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <div v-if="groupBy === 'none' && filtered.length > visibleCount" class="dv-more">
          <q-btn flat no-caps color="primary" icon="expand_more" label="Show more rows" @click="showMoreRows" />
          <span>Showing {{ visibleRowCount }} of {{ filtered.length }} matching rows.</span>
        </div>
        <div v-if="hasMore || loadingOlder" class="dv-more">
          <template v-if="!loadAll">
            <q-btn outline no-caps color="primary" icon="expand_more" label="Load older" :loading="loadingOlder" :disable="loading" @click="loadMore()" />
            <q-btn flat no-caps color="primary" label="Load all older" :disable="loading || loadingOlder" @click="loadMore({ all: true })" />
          </template>
          <q-btn v-else flat no-caps color="negative" icon="stop" :label="stopLoading ? 'Stopping…' : 'Stop'" :disable="stopLoading" @click="stopLoading = true" />
          <span v-if="loadingOlder && loadAll">Scanned {{ scannedLabel }} operations · {{ allDownvotes.length }} downvotes…</span>
          <span v-else-if="loadingOlder">Loading older operations…</span>
          <span v-else>Scanned {{ scannedLabel }} operations · {{ allDownvotes.length }} downvotes</span>
        </div>
        <p v-else-if="scanned" class="dv-more__end">End of the filtered vote history reached · {{ scannedLabel }} operations scanned.</p>
        <p v-if="olderError" class="dv-more__error" role="alert">
          <span>{{ olderError }}</span>
          <q-btn v-if="hasMore" flat dense no-caps color="primary" icon="refresh" label="Retry" @click="loadMore()" />
        </p>

        <section v-if="ignoredVoters.length" class="dv-ignored" aria-labelledby="dv-ignored-title">
          <h3 id="dv-ignored-title" class="dv-subtitle">Ignored voters</h3>
          <p>Their rows are marked in this local view. The summary above still includes the raw chain impact.</p>
          <button v-for="voter in ignoredVoters" :key="'ignored-' + voter" type="button" class="dv-chip" @click="toggleIgnored(voter)">
            @{{ voter }} ×
          </button>
        </section>
      </template>
    </div>

    <q-dialog v-model="contextOpen" position="right" full-height @hide="closeContext">
      <q-card class="dv-context">
        <q-card-section v-if="contextRow" class="dv-context__head">
          <div>
            <div class="dv-eyebrow">Vote context</div>
            <h2 class="dv-context__title">@{{ contextRow.voter }} → {{ contextRow.target }}</h2>
            <p class="dv-note">{{ weightLabel(contextRow.weight) }} · {{ timeLabel(contextRow.timestamp) }} · {{ impactLabel(contextRow) }}</p>
          </div>
          <q-btn flat round icon="close" aria-label="Close vote context" v-close-popup />
        </q-card-section>
        <q-card-section v-if="contextRow" class="dv-context__body">
          <div v-if="contextLoading" class="dv-state">
            <q-spinner-dots size="24px" />
            <span>Reading comments…</span>
          </div>
          <template v-else>
            <p v-if="contextError" class="dv-note dv-note--error">{{ contextError }}</p>
            <div class="dv-context__actions">
              <q-btn outline no-caps color="primary" icon="travel_explore" label="Check voter’s recent downvotes" :loading="voterHistoryLoading" @click="loadVoterHistory" />
              <q-btn flat no-caps :to="voterLink(contextRow.voter)" label="Voter profile" />
              <q-btn flat no-caps :to="postLink(contextRow)" label="Open post" />
            </div>
            <div v-if="voterHistory" class="dv-note">
              <strong>{{ voterHistory.total }}</strong> recent downvotes in {{ voterHistory.scanned }} scanned operations ·
              <strong>{{ Math.round(voterHistory.share * 100) }}%</strong> on @{{ username }}.
              <span v-if="voterHistory.hasMore">Sample only.</span>
              <ul v-if="voterHistory.targets.length" class="dv-context__targets">
                <li v-for="entry in voterHistory.targets" :key="'vt-' + entry.target">{{ entry.target }} × {{ entry.count }}</li>
              </ul>
            </div>
            <p v-if="voterHistoryError" class="dv-note dv-note--error">{{ voterHistoryError }}</p>
            <section v-if="contextData?.voterComments.length" aria-labelledby="dv-context-voter">
              <h3 id="dv-context-voter" class="dv-mini-title">Voter comments on this post</h3>
              <article v-for="comment in contextData.voterComments" :key="comment.link" class="dv-comment">
                <div class="dv-comment__meta">
                  <span class="dv-relative" :class="comment.relativeToVote === 'before' ? 'dv-relative--before' : 'dv-relative--after'">{{ comment.relativeToVote }} the vote</span>
                  <time>{{ timeLabel(comment.created) }}</time>
                  <router-link :to="comment.link">Open comment</router-link>
                </div>
                <p>{{ comment.excerpt }}</p>
                <div v-if="comment.keywords.length" class="dv-keywords">
                  <span v-for="word in comment.keywords" :key="'kw-' + comment.link + word">{{ word }}</span>
                </div>
              </article>
            </section>
            <p v-else class="dv-note">No comment by @{{ contextRow.voter }} in this post’s current discussion.</p>
            <section v-if="contextData?.authorReplies.length" aria-labelledby="dv-context-replies">
              <h3 id="dv-context-replies" class="dv-mini-title">Author replies to the voter</h3>
              <article v-for="comment in contextData.authorReplies" :key="comment.link" class="dv-comment">
                <div class="dv-comment__meta">
                  <span class="dv-relative" :class="comment.relativeToVote === 'before' ? 'dv-relative--before' : 'dv-relative--after'">{{ comment.relativeToVote }} the vote</span>
                  <time>{{ timeLabel(comment.created) }}</time>
                  <router-link :to="comment.link">Open comment</router-link>
                </div>
                <p>{{ comment.excerpt }}</p>
              </article>
            </section>
            <section v-if="contextData?.otherComments.length" aria-labelledby="dv-context-other">
              <h3 id="dv-context-other" class="dv-mini-title">Voter comments on the author’s other posts</h3>
              <article v-for="comment in contextData.otherComments" :key="comment.link" class="dv-comment">
                <div class="dv-comment__meta">
                  <span class="dv-relative" :class="comment.relativeToVote === 'before' ? 'dv-relative--before' : 'dv-relative--after'">{{ comment.relativeToVote }} the vote</span>
                  <time>{{ timeLabel(comment.created) }}</time>
                  <router-link :to="comment.parentLink">Open post</router-link>
                </div>
                <p>{{ comment.excerpt }}</p>
                <div v-if="comment.keywords.length" class="dv-keywords">
                  <span v-for="word in comment.keywords" :key="'okw-' + comment.link + word">{{ word }}</span>
                </div>
              </article>
            </section>
            <h3 class="dv-mini-title">Your note</h3>
            <q-input v-model="noteDraft.note" type="textarea" outlined dense autogrow maxlength="4000" label="Private note (stored on this device)" />
            <div class="dv-tag-row">
              <q-btn
                v-for="tag in noteTags"
                :key="'tag-' + tag"
                size="sm"
                no-caps
                :outline="!isTagSelected(tag)"
                color="primary"
                :label="tag"
                :aria-pressed="isTagSelected(tag)"
                @click="toggleTag(tag)"
              />
            </div>
            <div class="dv-context__actions">
              <q-btn unelevated no-caps color="primary" label="Save note" @click="saveContextNote" />
              <q-btn flat no-caps label="Remove" :disable="!noteForRow(contextRow)" @click="removeContextNote" />
            </div>
            <p class="dv-note">A downvote has no on-chain reason. Comments are context, not proof. Notes stay on this device.</p>
          </template>
        </q-card-section>
      </q-card>
    </q-dialog>
    </profile-skin>
  </q-page>
</template>

<style scoped>
.dv-page { min-width: 0; }
.dv-shell { width: 100%; max-width: 1120px; margin: 0 auto; padding: var(--space-4) var(--space-4) var(--space-6); }
.dv-head { display: flex; justify-content: space-between; align-items: flex-start; gap: var(--space-3); flex-wrap: wrap; }
.dv-eyebrow { color: var(--c-primary); font-size: 0.72rem; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase; }
.dv-title { margin: 0.2rem 0 0.35rem; font-size: clamp(1.4rem, 3vw, 1.9rem); overflow-wrap: anywhere; }
.dv-intro { max-width: 760px; margin: 0; color: var(--c-text-muted); line-height: 1.55; }
.dv-actions { display: flex; gap: var(--space-2); flex-wrap: wrap; }
.dv-state { display: flex; align-items: center; gap: var(--space-2); padding: var(--space-4); color: var(--c-text-muted); }
.dv-state--error { color: var(--c-negative); }
.dv-skeletons { display: grid; gap: var(--space-2); margin-top: var(--space-4); }
.dv-summary { display: grid; grid-template-columns: repeat(auto-fit, minmax(160px, 1fr)); gap: var(--space-2); margin-top: var(--space-4); }
.dv-stat { display: flex; flex-direction: column; gap: 0.1rem; padding: var(--space-3); border: 1px solid var(--c-border); border-radius: var(--radius-card); background: var(--c-surface-2); color: var(--c-text-muted); font-size: 0.74rem; }
.dv-stat strong { color: var(--c-text); font-size: 1.25rem; }
.dv-note { margin: var(--space-2) 0 0; color: var(--c-text-muted); font-size: 0.76rem; line-height: 1.5; }
.dv-note--error { color: var(--c-negative); }
.dv-panel { margin-top: var(--space-4); padding: var(--space-3); border: 1px solid var(--c-border); border-radius: var(--radius-card); background: var(--c-surface-2); }
.dv-panel__head { display: flex; justify-content: space-between; align-items: flex-start; gap: var(--space-2); flex-wrap: wrap; }
.dv-panel__actions { display: flex; align-items: center; gap: var(--space-2); flex-wrap: wrap; margin-top: var(--space-2); }
.dv-metrics { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: var(--space-2); margin-top: var(--space-2); }
.dv-metric { display: flex; flex-direction: column; gap: 0.1rem; padding: var(--space-2); border: 1px solid var(--c-border); border-radius: var(--radius-card); background: color-mix(in srgb, var(--c-text) 3%, transparent); color: var(--c-text-muted); font-size: 0.7rem; }
.dv-metric strong { color: var(--c-text); font-size: 1rem; }
.dv-rewards { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: var(--space-2); margin-top: var(--space-2); padding-top: var(--space-2); border-top: 1px solid var(--c-border); }
.dv-rewards .dv-note { grid-column: 1 / -1; margin-top: 0; }
.dv-chart { display: flex; align-items: flex-end; gap: 2px; min-height: 124px; margin-top: var(--space-2); overflow-x: auto; }
.dv-chart__bar { flex: 1 1 0; min-width: 4px; display: flex; flex-direction: column; align-items: center; gap: 2px; }
.dv-chart__track { width: 100%; height: 100px; display: flex; align-items: flex-end; border-radius: 3px; background: color-mix(in srgb, var(--c-text) 6%, transparent); overflow: hidden; }
.dv-chart__fill { width: 100%; border-radius: 3px 3px 0 0; background: var(--c-primary); }
.dv-chart__label { color: var(--c-text-muted); font-size: 0.58rem; white-space: nowrap; }
.dv-hour-chart { display: flex; align-items: flex-end; gap: 2px; min-height: 96px; margin-top: var(--space-2); }
.dv-hour-chart .dv-chart__track { height: 72px; }
.dv-spark { display: flex; align-items: center; gap: var(--space-2); margin-top: var(--space-2); min-width: 0; }
.dv-spark svg { flex: 1; min-width: 0; }
.dv-two-col { display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: var(--space-2); margin-top: var(--space-2); }
.dv-two-col .dv-panel { margin-top: 0; }
.dv-mini-title { margin: 0 0 var(--space-2); color: var(--c-text); font-size: 0.82rem; font-weight: 700; }
.dv-rank { display: grid; gap: 0.5rem; margin: 0; padding: 0; list-style: none; }
.dv-rank li { display: grid; gap: 0.15rem; }
.dv-rank__head { display: flex; justify-content: space-between; align-items: baseline; gap: var(--space-2); flex-wrap: wrap; }
.dv-rank__key { color: var(--c-text); font-weight: 600; overflow-wrap: anywhere; }
.dv-rank__meta { color: var(--c-text-muted); font-size: 0.7rem; }
.dv-rank__bar { height: 6px; border-radius: var(--radius-pill); background: color-mix(in srgb, var(--c-text) 8%, transparent); overflow: hidden; }
.dv-rank__bar > div { height: 100%; border-radius: inherit; background: var(--c-primary); }
.dv-pattern-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: var(--space-2); margin-top: var(--space-2); }
.dv-pattern { display: flex; flex-direction: column; gap: 0.15rem; padding: var(--space-2); border: 1px solid var(--c-border); border-radius: var(--radius-card); background: color-mix(in srgb, var(--c-text) 3%, transparent); }
.dv-pattern__row { display: grid; gap: 0.1rem; padding: 0.35rem 0; border: 0; border-bottom: 1px solid var(--c-border); background: none; color: var(--c-text-muted); font: inherit; font-size: 0.72rem; text-align: left; cursor: pointer; }
.dv-pattern__row:last-child { border-bottom: 0; }
.dv-pattern__row span:first-child { color: var(--c-text); font-weight: 600; overflow-wrap: anywhere; }
.dv-pattern__row strong { color: var(--c-text); }
.dv-focus { display: flex; align-items: center; gap: var(--space-2); flex-wrap: wrap; margin-top: var(--space-2); color: var(--c-text-muted); font-size: 0.76rem; }
.dv-row-meta { display: flex; align-items: center; gap: 0.35rem; flex-wrap: wrap; margin-top: 0.15rem; color: var(--c-text-muted); font-size: 0.66rem; }
.dv-source { display: block; color: var(--c-text-muted); font-size: 0.6rem; letter-spacing: 0.03em; text-transform: uppercase; }
.dv-note-dot { margin-left: 0.2rem; color: var(--c-warning); font-size: 0.6rem; }
.dv-impact--exact { color: var(--c-positive); font-weight: 600; }
.dv-impact--estimated { color: var(--c-warning); }
.dv-impact--muted { color: var(--c-text-muted); }
.dv-context { width: min(560px, 100vw); max-width: 560px; height: 100%; display: flex; flex-direction: column; }
.dv-context__head { display: flex; justify-content: space-between; align-items: flex-start; gap: var(--space-2); border-bottom: 1px solid var(--c-border); }
.dv-context__title { margin: 0.1rem 0 0; font-size: 1rem; overflow-wrap: anywhere; }
.dv-context__body { flex: 1; overflow-y: auto; }
.dv-context__actions { display: flex; align-items: center; gap: var(--space-2); flex-wrap: wrap; margin: var(--space-2) 0; }
.dv-context__targets { margin: 0.25rem 0 0; padding-left: 1.1rem; }
.dv-comment { padding: var(--space-2) 0; border-bottom: 1px solid var(--c-border); }
.dv-comment:last-child { border-bottom: 0; }
.dv-comment__meta { display: flex; align-items: center; gap: 0.4rem; flex-wrap: wrap; color: var(--c-text-muted); font-size: 0.7rem; }
.dv-relative { font-weight: 600; font-size: 0.68rem; }
.dv-relative--before { color: var(--c-text-muted); }
.dv-relative--after { color: var(--c-link); }
.dv-comment p { margin: 0.3rem 0 0; line-height: 1.5; }
.dv-keywords { display: flex; gap: 0.25rem; flex-wrap: wrap; margin-top: 0.3rem; }
.dv-keywords span { padding: 0.02rem 0.35rem; border-radius: var(--radius-pill); background: color-mix(in srgb, var(--c-warning) 14%, transparent); color: var(--c-warning); font-size: 0.66rem; }
.dv-tag-row { display: flex; gap: 0.35rem; flex-wrap: wrap; margin-top: var(--space-2); }
.dv-evidence { margin-top: var(--space-4); padding: var(--space-3); border: 1px solid color-mix(in srgb, var(--c-warning) 35%, var(--c-border)); border-radius: var(--radius-card); background: color-mix(in srgb, var(--c-warning) 7%, var(--c-surface-2)); }
.dv-evidence__head { display: flex; justify-content: space-between; gap: var(--space-2); align-items: flex-start; }
.dv-evidence__eyebrow { color: var(--c-warning); font-size: 0.7rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; }
.dv-evidence__title { margin: 0.1rem 0 0.35rem; font-size: 1rem; }
.dv-evidence__text { margin: 0; color: var(--c-text-muted); font-size: 0.8rem; line-height: 1.5; }
.dv-evidence__lists { display: grid; gap: 0.35rem; margin-top: var(--space-2); font-size: 0.78rem; }
.dv-evidence__label { display: block; color: var(--c-text-muted); font-size: 0.7rem; font-weight: 700; text-transform: uppercase; }
.dv-chip { display: inline-block; margin: 0.1rem 0.25rem 0 0; padding: 0.05rem 0.45rem; border: 0; border-radius: var(--radius-pill); background: color-mix(in srgb, var(--c-text) 7%, transparent); color: var(--c-link); font: inherit; text-decoration: none; cursor: pointer; }
.dv-controls { display: flex; align-items: center; gap: var(--space-2); flex-wrap: wrap; margin-top: var(--space-4); }
.dv-control { min-width: 150px; }
.dv-controls__count { color: var(--c-text-muted); font-size: 0.76rem; margin-left: auto; }
.dv-help { margin-top: var(--space-2); color: var(--c-text-muted); font-size: 0.78rem; }
.dv-help summary { color: var(--c-link); font-weight: 600; cursor: pointer; }
.dv-help p { max-width: 820px; margin: 0.35rem 0 0; line-height: 1.55; }
.dv-groups { display: grid; gap: var(--space-2); margin-top: var(--space-3); }
.dv-group { display: flex; justify-content: space-between; align-items: center; gap: var(--space-2); padding: var(--space-3); border: 1px solid var(--c-border); border-radius: var(--radius-card); background: var(--c-surface-2); }
.dv-group__key { color: var(--c-text); font-weight: 600; text-decoration: none; overflow-wrap: anywhere; }
.dv-group__meta { color: var(--c-text-muted); font-size: 0.74rem; }
.dv-table-wrap { margin-top: var(--space-3); overflow-x: auto; }
.dv-table { width: 100%; border-collapse: collapse; min-width: 960px; }
.dv-table th, .dv-table td { padding: 0.45rem 0.5rem; border-bottom: 1px solid var(--c-border); text-align: left; font-size: 0.78rem; vertical-align: top; }
.dv-table thead th { color: var(--c-text-muted); font-size: 0.7rem; text-transform: uppercase; letter-spacing: 0.04em; }
.dv-num { text-align: right !important; white-space: nowrap; }
.dv-row-action { text-align: right !important; }
.dv-link { border: 0; background: none; color: var(--c-link); font: inherit; cursor: pointer; text-decoration: underline; }
.dv-more { display: flex; align-items: center; gap: var(--space-2); flex-wrap: wrap; margin-top: var(--space-3); color: var(--c-text-muted); font-size: 0.76rem; }
.dv-more__end { margin-top: var(--space-3); color: var(--c-text-muted); font-size: 0.76rem; }
.dv-more__error { display: flex; align-items: center; gap: var(--space-2); flex-wrap: wrap; margin-top: var(--space-2); color: var(--c-negative); font-size: 0.76rem; }
.dv-ignored { margin-top: var(--space-4); padding: var(--space-3); border: 1px solid var(--c-border); border-radius: var(--radius-card); background: var(--c-surface-2); color: var(--c-text-muted); font-size: 0.8rem; }
.dv-subtitle { margin: 0 0 0.25rem; color: var(--c-text); font-size: 0.9rem; }
</style>

<script>
import moment from 'src/utils/time'
import { markRaw } from 'vue'
import accountHeader from 'components/accountHeader.vue'
import ProfileSkin from 'components/theme/ProfileSkin.vue'
import Sparkline from 'components/Sparkline.vue'
import { medianPrice } from 'src/services/network'
import { fetchAccountRewardHistory } from 'src/services/chainData'
import {
  annotateDownvoteImpact,
  buildTimeline,
  compareLossToRewards,
  detectBursts,
  hourBuckets,
  newVoterAccounts,
  postAgeBuckets,
  postPayoutSignals,
  repeatTargeting,
  sumAccountRewards,
  summarizeImpact,
  voteChanges,
  weightEscalation
} from 'src/services/downvoteImpact'
import { extractVoteContext, extractVoterComments, mergeVoteContext } from 'src/services/downvoteContext'
import {
  NOTE_TAGS,
  loadNotes,
  noteFor,
  removeNote as removeDownvoteNote,
  saveNote
} from 'src/services/downvoteNotes'
import { buildDownvoteCsv, buildDownvoteReport, reportFilename } from 'src/services/downvoteReport'
import {
  fetchDownvoteDiscussion,
  fetchDownvoteTargetPosts,
  fetchVoterComments,
  fetchVoterRecentVotes
} from 'src/services/downvoteSources'
import {
  coordinationEvidence,
  downvotesFor,
  filterIgnoredVoters,
  groupDownvotes,
  relationshipFor,
  summarizeDownvotes,
  withDownvoteValues
} from 'src/services/downvotes'
import { VOTE_HISTORY_PAGES, fetchAccountVoteHistoryPage } from 'src/services/accountDownvotes'
import { fetchDownvoteValuation } from 'src/services/downvoteValuation'
import { setPageMeta } from 'src/utils/pageMeta'
import { useModerationStore } from 'src/stores/moderation'

const PAGE_ROWS = 40
const DAY_MS = 24 * 60 * 60 * 1000

export default {
  name: 'DownvotesPage',
  components: { accountHeader, ProfileSkin, Sparkline },
  data () {
    return {
      rows: [],
      cursor: -1,
      hasMore: true,
      scanned: 0,
      loading: false,
      loadingOlder: false,
      loadAll: false,
      stopLoading: false,
      error: '',
      olderError: '',
      historyRequest: 0,
      rowKeys: markRaw(new Set()),
      direction: 'received',
      range: '30',
      relationshipFilter: 'all',
      minWeight: '0',
      groupBy: 'none',
      showIgnored: false,
      visibleCount: PAGE_ROWS,
      voterAccounts: {},
      rewardFund: null,
      medianHistory: null,
      valuationLoading: false,
      valuationError: '',
      valuationRequest: 0,
      targetPosts: {},
      impactLoading: false,
      impactProgress: { done: 0, total: 0 },
      impactError: '',
      impactRequest: 0,
      hydratedTargets: markRaw(new Set()),
      failedTargets: markRaw(new Set()),
      pendingTargets: markRaw(new Set()),
      hydrationTimer: null,
      voterFilter: '',
      targetFilter: '',
      impactFilter: 'all',
      noteFilter: false,
      impactFilterOptions: [
        { label: 'All impacts', value: 'all' },
        { label: 'Effective only', value: 'effective' },
        { label: 'Exact only', value: 'exact' },
        { label: 'Estimated only', value: 'estimated' },
        { label: 'After payout (signal)', value: 'after-payout' }
      ],
      notes: {},
      noteTags: NOTE_TAGS,
      noteDraft: { note: '', tags: [] },
      contextOpen: false,
      contextLoading: false,
      contextError: '',
      contextRow: null,
      contextData: null,
      contextRequest: 0,
      voterHistory: null,
      voterHistoryLoading: false,
      voterHistoryError: '',
      rewards: null,
      rewardsLoading: false,
      rewardsError: '',
      rewardsComparison: null,
      rangeOptions: [
        { label: 'Last 7 days', value: '7' },
        { label: 'Last 30 days', value: '30' },
        { label: 'Last 90 days', value: '90' },
        { label: 'All loaded', value: 'all' }
      ],
      relationshipOptions: [
        { label: 'Any relationship', value: 'all' },
        { label: 'Accounts I follow', value: 'follows' },
        { label: 'Accounts I mute', value: 'muted' },
        { label: 'My blacklist', value: 'blacklist' },
        { label: 'Followed mute list', value: 'followed list' },
        { label: 'Followed blacklist', value: 'followed blacklist' },
        { label: 'Unknown', value: 'unknown' }
      ],
      weightOptions: [
        { label: 'Any weight', value: '0' },
        { label: 'At least 1%', value: '1' },
        { label: 'At least 5%', value: '5' },
        { label: 'At least 10%', value: '10' },
        { label: 'At least 25%', value: '25' },
        { label: 'At least 50%', value: '50' }
      ],
      groupOptions: [
        { label: 'No grouping', value: 'none' },
        { label: 'By voter', value: 'voter' },
        { label: 'By target', value: 'target' },
        { label: 'By day', value: 'day' }
      ]
    }
  },
  computed: {
    username () {
      return String(this.$route.params.username || '').toLowerCase()
    },
    loggedInUser () {
      return this.$hiveStore.user.username || ''
    },
    isOwn () {
      return Boolean(this.loggedInUser) && this.loggedInUser === this.username
    },
    account () {
      return this.$hiveStore.accounts[this.username]
    },
    globalProps () {
      return this.$hiveStore.globalProps
    },
    moderation () {
      return useModerationStore()
    },
    allDownvotes () {
      return downvotesFor(this.rows, this.username, this.direction)
    },
    valuedDownvotes () {
      return withDownvoteValues(this.allDownvotes, {
        accounts: this.voterAccounts,
        rewardFund: this.rewardFund,
        medianHistory: this.medianHistory
      })
    },
    impactedDownvotes () {
      return annotateDownvoteImpact(this.valuedDownvotes, this.targetPosts, { now: Date.now() })
    },
    summary () {
      return summarizeDownvotes(this.valuedDownvotes)
    },
    impactSummary () {
      return summarizeImpact(this.impactedDownvotes)
    },
    filteredImpactSummary () {
      return summarizeImpact(this.filtered)
    },
    filteredSummary () {
      return summarizeDownvotes(this.filtered)
    },
    scopeKey () {
      return this.loggedInUser || 'guest'
    },
    rangeDays () {
      const value = Number(this.range)
      return Number.isFinite(value) && value > 0 ? value : 0
    },
    rangeLabel () {
      const match = this.rangeOptions.find(option => option.value === this.range)
      return match ? match.label : 'Loaded history'
    },
    effectiveRangeDays () {
      if (this.rangeDays) return this.rangeDays
      const times = this.filtered.map(row => Number(row.time) || 0).filter(Boolean)
      if (!times.length) return 30
      const span = Math.ceil((Math.max(...times) - Math.min(...times)) / DAY_MS) + 1
      return Math.min(365, Math.max(1, span))
    },
    timeline () {
      return buildTimeline(this.filtered, { days: this.rangeDays, now: Date.now() })
    },
    ageBuckets () {
      return postAgeBuckets(this.filtered)
    },
    hourBucketsList () {
      return hourBuckets(this.filtered)
    },
    maxHourCount () {
      return this.hourBucketsList.reduce((max, bucket) => Math.max(max, bucket.count), 0)
    },
    maxAgeCount () {
      return this.ageBuckets.reduce((max, bucket) => Math.max(max, bucket.count), 0)
    },
    noPatterns () {
      return !this.repeatVoters.length &&
        !this.bursts.targetBursts.length &&
        !this.bursts.voterBursts.length &&
        !this.voteChangeRows.length &&
        !this.escalationRows.length &&
        !this.newVoterRows.length &&
        !this.payoutSignalRows.count &&
        !this.coordination
    },
    bursts () {
      return detectBursts(this.filtered, { windowMinutes: 60, minVotes: 2 })
    },
    repeatVoters () {
      return repeatTargeting(this.filtered, { minVotes: 3 })
    },
    voteChangeRows () {
      return voteChanges(this.filtered)
    },
    escalationRows () {
      return weightEscalation(this.filtered)
    },
    payoutSignalRows () {
      return postPayoutSignals(this.filtered)
    },
    newVoterRows () {
      return newVoterAccounts(this.filtered, this.voterAccounts, { maxAgeDays: 30 })
    },
    topVoters () {
      return this.filteredImpactSummary.topVoters.slice(0, 5)
    },
    topTargets () {
      return this.filteredImpactSummary.topTargets.slice(0, 5)
    },
    hydratedTargetCount () {
      return Object.keys(this.targetPosts).length
    },
    missingTargetCount () {
      const all = this.uniqueTargets(this.filtered)
      return all.filter(target => !this.targetPosts[target]).length
    },
    exactCoveragePercent () {
      const value = Number(this.filteredImpactSummary.exactCoverage) || 0
      return Math.round(value * 100)
    },
    noteCount () {
      return this.allDownvotes.reduce((count, row) => count + (this.noteForRow(row) ? 1 : 0), 0)
    },
    scannedLabel () {
      return Math.max(0, Number(this.scanned) || 0).toLocaleString('en-US')
    },
    coordination () {
      return coordinationEvidence(this.allDownvotes)
    },
    ignoredVoters () {
      return this.moderation.ignoredVoters
    },
    filtered () {
      let list = this.impactedDownvotes
      if (this.voterFilter) {
        const needle = this.voterFilter.trim().toLowerCase().replace(/^@/, '')
        if (needle) list = list.filter(row => String(row.voter || '').includes(needle))
      }
      if (this.targetFilter) {
        const needle = this.targetFilter.trim().toLowerCase()
        if (needle) list = list.filter(row => String(row.target || '').toLowerCase().includes(needle))
      }
      if (this.impactFilter !== 'all') {
        list = list.filter(row => {
          if (this.impactFilter === 'effective') return row.effective
          if (this.impactFilter === 'exact') return row.impactConfidence === 'exact'
          if (this.impactFilter === 'estimated') return row.impactConfidence === 'estimated'
          if (this.impactFilter === 'after-payout') return row.afterPayout
          return true
        })
      }
      if (this.noteFilter) {
        list = list.filter(row => Boolean(this.noteForRow(row)))
      }
      if (this.range !== 'all') {
        const cutoff = Date.now() - Number(this.range) * 24 * 60 * 60 * 1000
        list = list.filter(row => (Number(row.time) || 0) >= cutoff)
      }
      if (this.relationshipFilter !== 'all') {
        list = list.filter(row => relationshipFor(row.voter, this.moderation.context) === this.relationshipFilter)
      }
      const minWeight = Number(this.minWeight) * 100
      if (Number.isFinite(minWeight) && minWeight > 0) {
        list = list.filter(row => Math.abs(Number(row.weight) || 0) >= minWeight)
      }
      if (!this.showIgnored && this.ignoredVoters.length) {
        list = filterIgnoredVoters(list, this.ignoredVoters)
      }
      return list
    },
    grouped () {
      if (this.groupBy === 'none') return []
      return groupDownvotes(this.filtered, this.groupBy)
    },
    pagedRows () {
      return this.filtered.slice(0, this.visibleCount)
    },
    visibleRowCount () {
      return Math.min(this.visibleCount, this.filtered.length)
    }
  },
  watch: {
    '$route.params.username' () {
      this.load({ force: true })
    },
    direction () {
      this.visibleCount = PAGE_ROWS
      this.loadValuation()
      this.scheduleHydration()
    },
    range () {
      this.visibleCount = PAGE_ROWS
      this.rewards = null
      this.rewardsComparison = null
      this.scheduleHydration()
    },
    relationshipFilter () {
      this.visibleCount = PAGE_ROWS
      this.scheduleHydration()
    },
    minWeight () {
      this.visibleCount = PAGE_ROWS
      this.scheduleHydration()
    },
    voterFilter () {
      this.visibleCount = PAGE_ROWS
      this.scheduleHydration()
    },
    targetFilter () {
      this.visibleCount = PAGE_ROWS
      this.scheduleHydration()
    },
    impactFilter () {
      this.visibleCount = PAGE_ROWS
      this.scheduleHydration()
    },
    noteFilter () {
      this.visibleCount = PAGE_ROWS
      this.scheduleHydration()
    },
    showIgnored () {
      this.visibleCount = PAGE_ROWS
      this.scheduleHydration()
    },
    groupBy () {
      this.visibleCount = PAGE_ROWS
    }
  },
  mounted () {
    setPageMeta({
      title: '@' + this.username + ' downvotes — voter and target transparency — banksia.io',
      description: 'Public downvote activity for @' + this.username + ' on banksia.io, with voter, weight, exact or estimated dollar impact, timing, comment context, target payout state and local notes.',
      url: '/@' + this.username + '/downvotes'
    })
    this.moderation.setScope(this.loggedInUser || 'guest')
    this.moderation.ensureContext()
    this.notes = loadNotes(this.scopeKey)
    if (!this.account) this.$hiveStore.getAccount(this.username)
    this.load()
  },
  beforeUnmount () {
    // Stop any in-flight initial/older-history, hydration, valuation or context loop.
    this.historyRequest += 1
    this.valuationRequest += 1
    this.impactRequest += 1
    this.contextRequest += 1
    if (this.hydrationTimer) clearTimeout(this.hydrationTimer)
  },
  methods: {
    resetHistory () {
      this.rows = []
      this.rowKeys = markRaw(new Set())
      this.cursor = -1
      this.hasMore = true
      this.scanned = 0
    },
    async appendHistoryPage ({ force = false, requestId = this.historyRequest } = {}) {
      const result = await fetchAccountVoteHistoryPage(this.username, { cursor: this.cursor, force })
      if (requestId !== this.historyRequest) return null
      this.applyHistoryPage(result)
      return result
    },
    applyHistoryPage (result) {
      if (!result) return
      for (const row of Array.isArray(result.rows) ? result.rows : []) {
        if (!row || Number(row.weight) >= 0) continue
        const key = this.rowKey(row)
        if (this.rowKeys.has(key)) continue
        this.rowKeys.add(key)
        this.rows.push(row)
      }
      this.scanned += Math.max(0, Number(result.scanned) || 0)
      const next = result.nextCursor === null || result.nextCursor === undefined
        ? null
        : Number(result.nextCursor)
      if (this.cursor >= 0 && result.hasMore && (next === null || !Number.isFinite(next) || next >= this.cursor)) {
        this.hasMore = false
        this.olderError = 'History stopped advancing; older loading was stopped to avoid a loop.'
        return
      }
      this.cursor = Number.isFinite(next) ? next : null
      this.hasMore = Boolean(result.hasMore && this.cursor !== null)
    },
    async load ({ force = false } = {}) {
      if (!this.username) return
      const requestId = ++this.historyRequest
      this.loading = true
      this.error = ''
      this.olderError = ''
      this.loadingOlder = false
      this.loadAll = false
      this.stopLoading = false
      this.resetHistory()
      this.resetTargetPosts()
      try {
        for (let page = 0; page < VOTE_HISTORY_PAGES && this.hasMore; page++) {
          if (requestId !== this.historyRequest) return
          await this.appendHistoryPage({ force, requestId })
        }
      } catch (error) {
        if (requestId === this.historyRequest) this.error = error?.message || 'Could not load downvote history.'
      } finally {
        if (requestId === this.historyRequest) this.loading = false
      }
      if (requestId === this.historyRequest) {
        this.loadValuation({ force })
        this.scheduleHydration()
      }
    },
    async loadMore ({ all = false } = {}) {
      if (!this.username || !this.hasMore || this.loading || this.loadingOlder) return
      const requestId = this.historyRequest
      this.loadingOlder = true
      this.loadAll = all
      this.stopLoading = false
      this.olderError = ''
      let loaded = 0
      try {
        while (this.hasMore && !this.stopLoading && requestId === this.historyRequest && (all || loaded < 1)) {
          const before = this.cursor
          const result = await this.appendHistoryPage({ requestId })
          if (!result || requestId !== this.historyRequest) break
          loaded++
          if (all && this.hasMore && this.cursor === before) break
          if (all) await this.$nextTick()
        }
      } catch (error) {
        if (requestId === this.historyRequest) this.olderError = error?.message || 'Could not load older downvote history.'
      } finally {
        if (requestId === this.historyRequest) {
          this.loadingOlder = false
          this.loadAll = false
          this.stopLoading = false
        }
      }
      if (loaded && requestId === this.historyRequest) {
        this.loadValuation()
        this.scheduleHydration()
      }
    },
    showMoreRows () {
      this.visibleCount += PAGE_ROWS
      this.scheduleHydration()
    },
    resetTargetPosts () {
      this.impactRequest += 1
      this.targetPosts = {}
      this.hydratedTargets = markRaw(new Set())
      this.failedTargets = markRaw(new Set())
      this.pendingTargets = markRaw(new Set())
      this.impactLoading = false
      this.impactProgress = { done: 0, total: 0 }
      this.impactError = ''
      if (this.hydrationTimer) {
        clearTimeout(this.hydrationTimer)
        this.hydrationTimer = null
      }
    },
    uniqueTargets (rows) {
      const targets = new Set()
      for (const row of Array.isArray(rows) ? rows : []) {
        const target = row.target || (row.author && row.permlink ? row.author + '/' + row.permlink : '')
        if (target) targets.add(target)
      }
      return [...targets]
    },
    scheduleHydration ({ all = false, force = false } = {}) {
      if (this.rewardsComparison || this.rewards) {
        this.rewards = null
        this.rewardsComparison = null
        this.rewardsError = ''
      }
      if (this.hydrationTimer) clearTimeout(this.hydrationTimer)
      this.hydrationTimer = setTimeout(() => {
        this.hydrationTimer = null
        const rows = all || this.uniqueTargets(this.filtered).length <= PAGE_ROWS ? this.filtered : this.pagedRows
        this.hydrateTargetsFor(rows, { force })
      }, 120)
    },
    async hydrateTargetsFor (rows, { force = false } = {}) {
      const all = this.uniqueTargets(rows)
      const targets = all.filter(target => {
        if (this.pendingTargets.has(target)) return false
        if (this.hydratedTargets.has(target)) return false
        if (!force && this.failedTargets.has(target)) return false
        return true
      })
      if (!targets.length) return
      const requestId = this.impactRequest
      for (const target of targets) this.pendingTargets.add(target)
      this.impactLoading = true
      this.impactError = ''
      this.impactProgress = { done: 0, total: targets.length }
      try {
        const result = await fetchDownvoteTargetPosts(targets, {
          force,
          onProgress: progress => {
            if (requestId === this.impactRequest) this.impactProgress = { done: progress.done, total: progress.total }
          }
        })
        if (requestId !== this.impactRequest) return
        for (const [target, post] of Object.entries(result.posts)) {
          this.targetPosts[target] = post
          this.hydratedTargets.add(target)
          this.failedTargets.delete(target)
        }
        for (const target of targets) this.pendingTargets.delete(target)
        for (const target of result.failed) this.failedTargets.add(target)
        if (result.failed.length) {
          this.impactError = result.failed.length + ' target post' + (result.failed.length === 1 ? '' : 's') + ' could not be read. Retry to improve exact coverage.'
        }
      } catch (error) {
        if (requestId === this.impactRequest) this.impactError = error?.message || 'Could not read target posts.'
        for (const target of targets) this.pendingTargets.delete(target)
      } finally {
        if (requestId === this.impactRequest) this.impactLoading = false
      }
    },
    hydrateAllImpact () {
      this.failedTargets = markRaw(new Set())
      this.hydrateTargetsFor(this.filtered)
    },
    moneyLabel (value, { approximate = false } = {}) {
      const number = Number(value)
      if (!Number.isFinite(number) || number <= 0) return '—'
      if (number < 0.01) return approximate ? '≈ <$0.01' : '<$0.01'
      const money = number.toLocaleString('en-US', {
        style: 'currency',
        currency: 'USD',
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
      })
      return approximate ? '≈ ' + money : money
    },
    impactLabel (row) {
      if (row.effective) return this.moneyLabel(row.impactUsd, { approximate: row.impactConfidence !== 'exact' })
      if (row.afterPayout) return 'Signal'
      if (row.superseded) return 'Superseded'
      if (row.offset) return 'Offset'
      if (row.inactive) return 'Inactive'
      return '—'
    },
    impactClass (row) {
      if (row.impactConfidence === 'exact') return 'dv-impact dv-impact--exact'
      if (row.impactConfidence === 'estimated') return 'dv-impact dv-impact--estimated'
      return 'dv-impact dv-impact--muted'
    },
    impactTitle (row) {
      const parts = []
      if (row.impactReason) parts.push(row.impactReason)
      if (row.voteRshares) parts.push(this.compactNumber(row.voteRshares) + ' rshares')
      if (row.afterPayout) parts.push('No payout impact')
      return parts.join(' · ') || 'No impact data'
    },
    postAgeLabel (row) {
      const hours = Number(row.postAgeHours)
      if (!Number.isFinite(hours) || hours < 0) return '—'
      if (hours < 1) return '<1h'
      if (hours < 48) return Math.round(hours) + 'h'
      return (hours / 24).toFixed(1) + 'd'
    },
    payoutLabel (row) {
      if (row.afterPayout) return 'after payout'
      if (row.payoutState === 'paid') return 'paid'
      if (row.payoutState === 'pending') return 'pending'
      return 'unknown'
    },
    payoutColor (row) {
      if (row.afterPayout) return 'orange-9'
      if (row.payoutState === 'paid') return 'blue-grey-7'
      if (row.payoutState === 'pending') return 'green-9'
      return 'grey-7'
    },
    barHeight (value, max) {
      const number = Number(value) || 0
      const peak = Number(max) || 0
      if (number <= 0) return '0%'
      return peak > 0 ? Math.max(2, Math.round((number / peak) * 100)) + '%' : '2%'
    },
    barWidth (value, max) {
      const number = Number(value) || 0
      const peak = Number(max) || 0
      if (number <= 0) return '0%'
      return peak > 0 ? Math.max(1, Math.round((number / peak) * 100)) + '%' : '1%'
    },
    shortDay (date) {
      return String(date || '').slice(5)
    },
    showDayLabel (index, length) {
      if (length <= 14) return true
      const step = Math.ceil(length / 8)
      return index % step === 0
    },
    noteForRow (row) {
      return noteFor(this.notes, this.rowKey(row))
    },
    isTagSelected (tag) {
      return this.noteDraft.tags.includes(tag)
    },
    toggleTag (tag) {
      if (this.noteDraft.tags.includes(tag)) {
        this.noteDraft.tags = this.noteDraft.tags.filter(item => item !== tag)
      } else {
        this.noteDraft.tags = [...this.noteDraft.tags, tag].slice(0, 6)
      }
    },
    async openContext (row) {
      this.contextRow = row
      this.contextData = null
      this.contextError = ''
      this.voterHistory = null
      this.voterHistoryError = ''
      const note = this.noteForRow(row)
      this.noteDraft = { note: note?.note || '', tags: [...(note?.tags || [])] }
      this.contextOpen = true
      await this.loadContext()
    },
    async loadContext () {
      const row = this.contextRow
      if (!row) return
      const requestId = ++this.contextRequest
      this.contextLoading = true
      this.contextError = ''
      try {
        const [discussionResult, commentsResult] = await Promise.allSettled([
          fetchDownvoteDiscussion(row.author, row.permlink),
          fetchVoterComments(row.voter, { limit: 20 })
        ])
        if (requestId !== this.contextRequest) return
        const target = discussionResult.status === 'fulfilled'
          ? extractVoteContext(discussionResult.value, {
            author: row.author,
            permlink: row.permlink,
            voter: row.voter,
            voteTime: row.time
          })
          : { voterComments: [], authorReplies: [], count: 0, hasVoterComment: false, keywords: [] }
        const elsewhere = commentsResult.status === 'fulfilled'
          ? extractVoterComments(commentsResult.value, {
            voter: row.voter,
            author: row.author,
            voteTime: row.time,
            windowDays: 14
          })
          : { comments: [], count: 0, windowDays: 14 }
        this.contextData = mergeVoteContext(target, elsewhere)
        if (discussionResult.status === 'rejected' && commentsResult.status === 'rejected') {
          this.contextError = 'Could not read the discussion or the voter’s comment feed.'
        } else if (discussionResult.status === 'rejected') {
          this.contextError = 'The target discussion could not be read; showing the voter’s other comments.'
        } else if (commentsResult.status === 'rejected') {
          this.contextError = 'The voter’s other comments could not be read; the target discussion is shown.'
        }
      } catch (error) {
        if (requestId === this.contextRequest) this.contextError = error?.message || 'Could not load comment context.'
      } finally {
        if (requestId === this.contextRequest) this.contextLoading = false
      }
    },
    async loadVoterHistory () {
      const row = this.contextRow
      if (!row || this.voterHistoryLoading) return
      const voter = row.voter
      this.voterHistoryLoading = true
      this.voterHistoryError = ''
      try {
        const result = await fetchVoterRecentVotes(voter, { pages: 2 })
        if (!this.contextOpen || this.contextRow?.voter !== voter) return
        const total = result.rows.length
        const onProfile = result.rows.filter(item => item.author === this.username).length
        const targets = {}
        for (const item of result.rows) {
          const target = item.target || (item.author + '/' + item.permlink)
          targets[target] = (targets[target] || 0) + 1
        }
        this.voterHistory = {
          total,
          scanned: result.scanned,
          onProfile,
          share: total ? onProfile / total : 0,
          hasMore: result.hasMore,
          targets: Object.entries(targets)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 5)
            .map(([target, count]) => ({ target, count }))
        }
      } catch (error) {
        this.voterHistoryError = error?.message || 'Could not read the voter’s recent votes.'
      } finally {
        this.voterHistoryLoading = false
      }
    },
    saveContextNote () {
      if (!this.contextRow) return
      const hasContent = Boolean(this.noteDraft.note.trim() || this.noteDraft.tags.length)
      this.notes = saveNote(this.scopeKey, this.rowKey(this.contextRow), this.noteDraft)
      this.$q.notify({ type: 'positive', message: hasContent ? 'Note saved locally.' : 'Note cleared.', position: 'top' })
    },
    removeContextNote () {
      if (!this.contextRow) return
      this.notes = removeDownvoteNote(this.scopeKey, this.rowKey(this.contextRow))
      this.noteDraft = { note: '', tags: [] }
      this.$q.notify({ type: 'info', message: 'Note removed.', position: 'top' })
    },
    closeContext () {
      this.contextOpen = false
      this.contextRequest += 1
    },
    async loadRewardsComparison () {
      if (this.rewardsLoading) return
      this.rewardsLoading = true
      this.rewardsError = ''
      try {
        const days = this.effectiveRangeDays
        const result = await fetchAccountRewardHistory(this.username, { windowDays: days, maxPages: 6 })
        const hiveUsd = medianPrice(this.medianHistory).hiveUsd || 0
        const rewards = sumAccountRewards(result.rows, { globalProps: this.globalProps, hiveUsd })
        this.rewards = { ...rewards, days, truncated: result.truncated, failed: result.failed || '' }
        this.rewardsComparison = compareLossToRewards(this.filteredImpactSummary, rewards, { finalOnly: true })
        const notices = []
        if (!hiveUsd) notices.push('Price feed unavailable; HIVE and HP rewards are excluded from the comparison.')
        if (result.truncated) notices.push('Reward history is a sample; the comparison is approximate.')
        this.rewardsError = notices.join(' ')
      } catch (error) {
        this.rewardsError = error?.message || 'Could not read the reward history.'
      } finally {
        this.rewardsLoading = false
      }
    },
    exportCsv () {
      const rows = this.filtered.map(row => ({ ...row, relationship: this.relationship(row.voter) }))
      const csv = buildDownvoteCsv(rows, {
        notes: this.notes,
        username: this.username,
        direction: this.direction,
        rangeLabel: this.rangeLabel
      })
      this.download(reportFilename(this.username, this.direction, 'csv'), csv, 'text/csv')
      this.$q.notify({ type: 'positive', message: 'CSV exported.', position: 'top' })
    },
    async copyReport () {
      const markdown = buildDownvoteReport({
        username: this.username,
        direction: this.direction,
        rangeLabel: this.rangeLabel,
        summary: this.filteredSummary,
        impact: this.filteredImpactSummary,
        rows: this.filtered,
        notes: this.notes,
        patterns: {
          repeatTargeting: this.repeatVoters,
          targetBursts: this.bursts.targetBursts,
          voterBursts: this.bursts.voterBursts,
          voteChanges: this.voteChangeRows,
          weightEscalation: this.escalationRows,
          newVoterAccounts: this.newVoterRows,
          postPayoutSignals: this.payoutSignalRows
        },
        rewardsComparison: this.rewardsComparison
      })
      try {
        await navigator.clipboard.writeText(markdown)
        this.$q.notify({ type: 'positive', message: 'Report copied to the clipboard.', position: 'top' })
      } catch {
        this.$q.notify({ type: 'negative', message: 'Could not copy the report. Use Export CSV instead.', position: 'top' })
      }
    },
    download (filename, text, type) {
      const blob = new Blob([text], { type })
      const url = URL.createObjectURL(blob)
      const anchor = document.createElement('a')
      anchor.href = url
      anchor.download = filename
      document.body.appendChild(anchor)
      anchor.click()
      anchor.remove()
      URL.revokeObjectURL(url)
    },
    focusVoter (voter) {
      this.voterFilter = String(voter || '')
      this.targetFilter = ''
    },
    focusTarget (target) {
      this.targetFilter = String(target || '')
      this.voterFilter = ''
    },
    clearFocus () {
      this.voterFilter = ''
      this.targetFilter = ''
    },
    clearFilters () {
      this.visibleCount = PAGE_ROWS
      this.range = '30'
      this.relationshipFilter = 'all'
      this.minWeight = '0'
      this.showIgnored = false
      this.groupBy = 'none'
      this.voterFilter = ''
      this.targetFilter = ''
      this.impactFilter = 'all'
      this.noteFilter = false
    },
    async loadValuation ({ force = false } = {}) {
      const voters = this.direction === 'given'
        ? [this.username]
        : [...new Set(this.allDownvotes.map(row => row.voter).filter(Boolean))]
      const requestId = ++this.valuationRequest
      if (!voters.length) {
        this.voterAccounts = {}
        this.valuationError = ''
        this.valuationLoading = false
        return
      }
      this.valuationLoading = true
      try {
        const valuation = await fetchDownvoteValuation(voters, { force })
        if (requestId !== this.valuationRequest) return
        this.voterAccounts = valuation.accounts
        this.rewardFund = valuation.rewardFund
        this.medianHistory = valuation.medianHistory
        this.valuationError = valuation.rewardFundUnavailable || valuation.priceUnavailable
          ? 'Dollar estimates are unavailable: the reward fund or price feed could not be read.'
          : ''
      } catch (error) {
        if (requestId !== this.valuationRequest) return
        this.valuationError = error?.message || 'Could not estimate the dollar impact.'
      } finally {
        if (requestId === this.valuationRequest) this.valuationLoading = false
      }
    },
    toggleDirection () {
      this.direction = this.direction === 'received' ? 'given' : 'received'
    },
    relationship (voter) {
      return relationshipFor(voter, this.moderation.context)
    },
    relationshipColor (voter) {
      const value = this.relationship(voter)
      if (value === 'muted') return 'red-9'
      if (value === 'follows') return 'green-9'
      if (value === 'blacklist') return 'orange-9'
      if (value === 'followed list' || value === 'followed blacklist') return 'blue-grey-9'
      return 'grey-8'
    },
    isIgnored (voter) {
      return this.ignoredVoters.includes(String(voter || '').toLowerCase())
    },
    toggleIgnored (voter) {
      if (this.isIgnored(voter)) this.moderation.unignoreVoter(voter)
      else this.moderation.ignoreVoter(voter)
    },
    targetLink (target) {
      return '/@' + String(target || '')
    },
    postLink (row) {
      return row ? '/@' + row.author + '/' + row.permlink : '/'
    },
    voterLink (voter) {
      return '/@' + String(voter || '')
    },
    rowKey (row) {
      return row.index !== null ? 'i:' + row.index : row.trxId + ':' + row.voter
    },
    weightLabel (weight) {
      const percent = Number(weight) / 100
      if (!Number.isFinite(percent)) return '—'
      return (percent > 0 ? '+' : '') + percent.toFixed(1) + '%'
    },
    groupValueLabel (group) {
      const value = Number(group.totalValueUsd)
      if (!(value > 0)) return ''
      return this.moneyLabel(value, { approximate: group.exactCount < group.effectiveCount })
    },
    compactNumber (value) {
      const number = Math.abs(Number(value) || 0)
      if (number >= 1e12) return (number / 1e12).toFixed(1) + 'T'
      if (number >= 1e9) return (number / 1e9).toFixed(1) + 'B'
      if (number >= 1e6) return (number / 1e6).toFixed(1) + 'M'
      if (number >= 1e3) return (number / 1e3).toFixed(1) + 'K'
      return number.toFixed(0)
    },
    timeLabel (value) {
      if (!value) return '—'
      const time = moment.utc(value)
      return time.isValid() ? time.fromNow() : value
    }
  }
}
</script>
