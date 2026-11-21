<template>
  <q-page class="net-page">
    <div class="net-shell">
      <header class="net-head">
        <div class="net-head__text">
          <div class="net-eyebrow">
            <span class="home-live-dot" :class="{ 'is-live': !loading && propsReady }" aria-hidden="true"></span>
            Hive network
          </div>
          <h1 class="net-head__title">Network health</h1>
          <p class="net-intro">
            Witness participation, HBD backing, chain version, median price, resource pool
            and API latency in one live view.
          </p>
        </div>
        <div class="net-actions">
          <q-btn no-caps outline color="primary" icon="how_to_vote" label="Witnesses" to="/witnesses" />
          <q-btn no-caps outline color="primary" icon="dns" label="API nodes" to="/nodes" />
          <q-btn flat round dense icon="refresh" aria-label="Refresh network health" title="Refresh network health" :loading="loading" @click="refresh" />
        </div>
      </header>

      <div v-if="staleAt" class="health-notice">
        <data-notice
          variant="stale"
          :message="offline ? 'Offline — showing the saved network snapshot.' : 'Some health checks failed — showing saved values.'"
          :updated-at="staleAt"
          action-label="Retry"
          @action="load"
        />
      </div>

      <q-card v-if="loading && !propsReady" flat bordered class="health-loading">
        <q-skeleton type="rect" height="90px" />
        <q-skeleton type="rect" height="140px" class="q-mt-md" />
        <q-skeleton type="rect" height="280px" class="q-mt-md" />
      </q-card>

      <q-card v-else-if="loadError && !propsReady" flat bordered class="net-state net-state--error">
        <q-icon name="error_outline" size="2em" aria-hidden="true" />
        <div>{{ loadError }}</div>
        <q-btn flat dense no-caps color="primary" icon="refresh" label="Retry" @click="load" />
      </q-card>

      <template v-else>
        <q-card flat bordered class="health-banner" :class="'health-banner--' + overall">
          <div class="health-banner__body">
            <q-icon
              :name="overall === 'healthy' ? 'check_circle' : 'warning'"
              :color="overallStatusColor(overall)"
              size="26px"
              :aria-label="overallStatusLabel(overall)"
            />
            <div class="health-banner__text">
              <h2 class="health-banner__title">{{ overallStatusLabel(overall) }}</h2>
              <p v-if="alerts.length">{{ alerts.join(' · ') }}</p>
              <p v-else>All tracked network health checks are inside their normal ranges.</p>
            </div>
            <span class="health-banner__time">
              <q-icon name="schedule" size="14px" aria-hidden="true" />
              {{ lastUpdatedLabel }}
            </span>
          </div>
        </q-card>

        <section class="net-section" aria-labelledby="network-overview-title">
          <div class="net-section__head">
            <div>
              <h2 id="network-overview-title" class="net-section__title">Network overview</h2>
              <span class="net-section__hint">Consensus, HBD backing, price and chain software</span>
            </div>
          </div>

          <div class="net-stat-grid">
            <health-stat-card
              label="Witness participation"
              :value="formatPercent(participation, 1)"
              icon="how_to_vote"
              :status-label="participationStat.label"
              :status-color="participationStat.color"
              :progress="participation / 100"
              :aria-label="'Witness participation ' + formatPercent(participation, 1)"
              :hint="participationHint"
            />
            <health-stat-card
              label="HBD debt ratio"
              :value="debt.ratio === null ? '—' : formatPercent(debt.ratio, 2)"
              icon="account_balance"
              :status-label="debt.status.label"
              :status-color="debt.status.color"
              :progress="debt.ratio === null ? null : debt.ratio / debt.hardLimit"
              :aria-label="'HBD debt ratio ' + (debt.ratio === null ? 'unavailable' : formatPercent(debt.ratio, 2))"
              :hint="debtHint"
            />
            <health-stat-card
              label="HIVE median price"
              :value="median.label"
              icon="price_change"
              :status-label="priceStatus.label"
              :status-color="priceStatus.color"
              :hint="medianHint"
            />
            <health-stat-card
              label="Resource pool"
              :value="formatCount(pool.vestingFundHive, 0)"
              unit="HIVE"
              icon="savings"
              :hint="poolHint"
            />
            <health-stat-card
              label="Hardfork status"
              :value="'v' + (versions.consensusVersion || '—')"
              icon="upgrade"
              :status-label="versions.requiredWitnesses ? versions.requiredWitnesses + ' required' : ''"
              status-color="green"
              :hint="'Consensus version · blockchain HF ' + (versions.hardforkVersion || '—')"
            />
            <health-stat-card
              label="Chain version"
              :value="'v' + (versions.blockchainVersion || '—')"
              icon="memory"
              :status-label="versionDriftLabel"
              :status-color="versionDrift ? 'orange' : 'green'"
              :hint="'Node API reports this build · median props v' + (versions.consensusVersion || '—')"
            />
          </div>
        </section>

        <section class="net-section" aria-labelledby="witness-participation-title">
          <div class="net-section__head">
            <div>
              <h2 id="witness-participation-title" class="net-section__title">Witness participation</h2>
              <span class="net-section__hint">
                Scheduled round of {{ scheduledWitnesses.length }} witnesses · {{ witnessSummary.warning + witnessSummary.critical }} health warnings
              </span>
            </div>
            <router-link to="/witnesses" class="health-link">Open full witness directory</router-link>
          </div>

          <witness-health-list :rows="witnessRows" :global-props="globalProps" />
        </section>

        <section class="net-section" aria-labelledby="chain-state-title">
          <div class="net-section__head">
            <div>
              <h2 id="chain-state-title" class="net-section__title">Chain state</h2>
              <span class="net-section__hint">Live values from condenser global properties and chain config</span>
            </div>
            <span v-if="headBlock" class="health-link health-link--plain">Head {{ formatCount(headBlock) }}</span>
          </div>

          <q-card flat bordered class="health-chain">
            <dl class="health-chain__facts">
              <div>
                <dt>Head block</dt>
                <dd>
                  <router-link :to="'/b/' + headBlock">{{ formatCount(headBlock) }}</router-link>
                </dd>
              </div>
              <div>
                <dt>Last irreversible</dt>
                <dd>
                  <router-link :to="'/b/' + irreversible">{{ formatCount(irreversible) }}</router-link>
                  <small v-if="headBehind">{{ headBehind }} behind head</small>
                </dd>
              </div>
              <div>
                <dt>Accounts</dt>
                <dd>{{ formatCount(accountCount) }}</dd>
              </div>
              <div>
                <dt>HBD print rate</dt>
                <dd>{{ formatPercent(printRate, 2) }}</dd>
              </div>
              <div>
                <dt>HBD savings APR</dt>
                <dd>{{ formatPercent(interestRate, 2) }}</dd>
              </div>
              <div>
                <dt>Block interval</dt>
                <dd>{{ versions.blockInterval }} s</dd>
              </div>
              <div>
                <dt>Median range</dt>
                <dd>{{ medianRange }}</dd>
              </div>
              <div>
                <dt>Witness votes</dt>
                <dd>{{ witnessSummary.ok }} healthy · {{ witnessSummary.critical }} critical</dd>
              </div>
            </dl>

            <div class="health-chain__blocks">
              <span class="net-eyebrow">Latest irreversible blocks</span>
              <nav class="health-chain__block-links" aria-label="Latest irreversible blocks">
                <router-link v-for="block in latestBlocks" :key="block" :to="'/b/' + block">{{ formatCount(block) }}</router-link>
              </nav>
            </div>
          </q-card>
        </section>

        <section class="net-section" aria-labelledby="api-latency-title">
          <div class="net-section__head">
            <div>
              <h2 id="api-latency-title" class="net-section__title">API latency</h2>
              <span class="net-section__hint">Healthy node count, fastest response and head lag</span>
            </div>
          </div>
          <health-node-summary ref="nodeSummary" @summary="nodeSummary = $event" />
        </section>

        <section class="net-section" aria-labelledby="lightning-bridge-title">
          <div class="net-section__head">
            <div>
              <h2 id="lightning-bridge-title" class="net-section__title">Lightning bridge</h2>
              <span class="net-section__hint">
                Advisory third-party status from api.v4v.app · not part of the Hive consensus checks
              </span>
            </div>
            <q-btn
              flat
              dense
              no-caps
              color="primary"
              icon="refresh"
              label="Check bridge"
              :loading="bridgeLoading"
              @click="loadBridge(true)"
            />
          </div>

          <q-card flat bordered class="health-bridge">
            <div class="health-bridge__head">
              <q-icon :name="bridgeIcon" size="22px" :color="bridgeColor" aria-hidden="true" />
              <div class="health-bridge__text">
                <div class="health-bridge__state">{{ bridgeStateLabel }}</div>
                <p class="health-bridge__note">{{ bridgeStateNote }}</p>
              </div>
              <span v-if="bridgeCheckedAt" class="health-bridge__time">
                <q-icon name="schedule" size="13px" aria-hidden="true" />
                {{ bridgeCheckedLabel }}
              </span>
            </div>

            <dl v-if="bridge" class="health-bridge__facts">
              <div>
                <dt>API version</dt>
                <dd>{{ bridge.version || '—' }}</dd>
              </div>
              <div>
                <dt>Bridge message</dt>
                <dd>{{ bridge.message || '—' }}</dd>
              </div>
              <div>
                <dt>LND</dt>
                <dd>{{ bridgeLndLabel }}</dd>
              </div>
              <div>
                <dt>Conversion fee</dt>
                <dd>{{ bridgeFeeLabel }}</dd>
              </div>
              <div>
                <dt>Invoice range</dt>
                <dd>{{ bridgeRangeLabel }}</dd>
              </div>
              <div>
                <dt>Price quote</dt>
                <dd>{{ bridgeQuoteLabel }}</dd>
              </div>
            </dl>
            <div v-else class="health-bridge__empty">
              {{ bridgeEmptyLabel }}
            </div>
          </q-card>
        </section>
      </template>
    </div>
  </q-page>
</template>

<style scoped>
.health-loading {
  padding: var(--space-4);
  background: rgba(255, 255, 255, 0.028);
}

.health-notice {
  margin-bottom: var(--space-3);
}

.health-banner {
  overflow: hidden;
  border-radius: var(--radius-card);
  background: rgba(76, 175, 80, 0.07);
}

.health-banner--warning {
  border-color: rgba(255, 183, 77, 0.35);
  background: rgba(255, 183, 77, 0.07);
}

.health-banner--critical {
  border-color: rgba(239, 83, 80, 0.4);
  background: rgba(239, 83, 80, 0.07);
}

.health-banner--watch {
  border-color: rgba(255, 213, 79, 0.35);
  background: rgba(255, 213, 79, 0.06);
}

.health-banner__body {
  display: flex;
  align-items: flex-start;
  gap: var(--space-3);
  padding: 0.85rem 1rem;
}

.health-banner__text {
  flex: 1;
  min-width: 0;
}

.health-banner__title {
  margin: 0;
  color: #e4eaed;
  font-size: 1rem;
  font-weight: 600;
}

.health-banner__text p {
  margin: 0.15rem 0 0;
  color: #b0bec5;
  font-size: 0.8rem;
  line-height: 1.45;
}

.health-banner__time {
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
  color: #78909c;
  font-size: 0.7rem;
  white-space: nowrap;
}

.health-link {
  color: #4fc3f7;
  font-size: 0.78rem;
  font-weight: 600;
  text-decoration: none;
}

.health-link:hover {
  color: #81d4fa;
  text-decoration: underline;
}

.health-link--plain {
  color: #90a4ae;
  font-weight: 500;
}

.health-chain {
  overflow: hidden;
  background: rgba(255, 255, 255, 0.028);
}

.health-chain__facts {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(min(100%, 190px), 1fr));
  gap: 0;
  margin: 0;
}

.health-chain__facts > div {
  min-width: 0;
  padding: 0.7rem 0.85rem;
  border-left: 1px solid var(--border-subtle);
  border-top: 1px solid var(--border-subtle);
}

.health-chain__facts > div:nth-child(-n + 4) {
  border-top: 0;
}

.health-chain__facts > div:nth-child(4n + 1) {
  border-left: 0;
}

.health-chain__facts dt {
  color: #78909c;
  font-size: 0.64rem;
  letter-spacing: 0.04em;
  text-transform: uppercase;
}

.health-chain__facts dd {
  display: flex;
  flex-direction: column;
  margin: 0.1rem 0 0;
  color: #e4eaed;
  font-size: 0.92rem;
  font-weight: 600;
  overflow-wrap: anywhere;
}

.health-chain__facts dd a {
  color: #4fc3f7;
  text-decoration: none;
}

.health-chain__facts dd a:hover {
  color: #81d4fa;
  text-decoration: underline;
}

.health-chain__facts dd small {
  color: #78909c;
  font-size: 0.66rem;
  font-weight: 400;
}

.health-chain__blocks {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
  padding: 0.75rem 0.85rem;
  border-top: 1px solid var(--border-subtle);
}

.health-chain__block-links {
  display: flex;
  flex-wrap: wrap;
  gap: 0.3rem 0.7rem;
  font-size: 0.76rem;
  font-weight: 600;
}

.health-chain__block-links a {
  color: #b0bec5;
  text-decoration: none;
}

.health-chain__block-links a:hover {
  color: #81d4fa;
  text-decoration: underline;
}

.health-bridge {
  overflow: hidden;
  background: rgba(255, 255, 255, 0.028);
}

.health-bridge__head {
  display: flex;
  align-items: flex-start;
  gap: 0.6rem;
  padding: 0.8rem 0.9rem;
}

.health-bridge__text {
  flex: 1;
  min-width: 0;
}

.health-bridge__state {
  color: #e4eaed;
  font-size: 0.9rem;
  font-weight: 600;
}

.health-bridge__note {
  margin: 0.15rem 0 0;
  color: #90a4ae;
  font-size: 0.74rem;
  line-height: 1.4;
}

.health-bridge__time {
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
  color: #78909c;
  font-size: 0.68rem;
  white-space: nowrap;
}

.health-bridge__facts {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(min(100%, 160px), 1fr));
  gap: 0;
  margin: 0;
  border-top: 1px solid var(--border-subtle);
}

.health-bridge__facts > div {
  min-width: 0;
  padding: 0.6rem 0.85rem;
  border-left: 1px solid var(--border-subtle);
}

.health-bridge__facts > div:first-child {
  border-left: 0;
}

.health-bridge__facts dt {
  color: #78909c;
  font-size: 0.62rem;
  letter-spacing: 0.04em;
  text-transform: uppercase;
}

.health-bridge__facts dd {
  margin: 0.1rem 0 0;
  color: #e4eaed;
  font-size: 0.82rem;
  font-weight: 600;
  overflow-wrap: anywhere;
}

.health-bridge__empty {
  padding: 0.7rem 0.9rem;
  border-top: 1px solid var(--border-subtle);
  color: #90a4ae;
  font-size: 0.74rem;
}

@media (max-width: 1023px) {
  .health-chain__facts > div:nth-child(-n + 4) {
    border-top: 1px solid var(--border-subtle);
  }

  .health-chain__facts > div:nth-child(3n + 1) {
    border-left: 0;
  }

  .health-chain__facts > div:nth-child(-n + 3) {
    border-top: 0;
  }
}

@media (max-width: 699px) {
  .health-banner__body {
    flex-wrap: wrap;
  }

  .health-banner__time {
    width: 100%;
  }

  .health-bridge__head {
    flex-wrap: wrap;
  }

  .health-bridge__time {
    width: 100%;
  }

  .health-chain__facts > div {
    border-left: 0 !important;
    border-top: 1px solid var(--border-subtle) !important;
  }

  .health-chain__facts > div:first-child {
    border-top: 0 !important;
  }
}
</style>

<script>
import HealthStatCard from 'components/health/HealthStatCard.vue'
import WitnessHealthList from 'components/health/WitnessHealthList.vue'
import HealthNodeSummary from 'components/health/HealthNodeSummary.vue'
import DataNotice from 'components/ui/DataNotice.vue'
import { setPageMeta } from 'src/utils/pageMeta'
import { fetchAccounts, fetchGlobalProps, fetchWitnessesByVote } from 'src/services/chainData'
import { loadSnapshot, saveSnapshot } from 'src/services/snapshots'
import { BRIDGE_STATES, bridgeFeePolicy, probeBridge } from 'src/services/v4vapp'
import {
  chainVersions,
  formatCount,
  hbdDebtRatio,
  medianPrice,
  overallStatus,
  overallStatusColor,
  overallStatusLabel,
  participationRate,
  participationStatus,
  resourcePool,
  versionStatus
} from 'src/services/network'
import {
  SCHEDULED_WITNESSES,
  aggregateWitnessHealth,
  formatHp,
  formatPercent,
  relativeTime,
  witnessHealth,
  witnessStatus,
  witnessVotesHp
} from 'src/services/witnesses'

function settledValue (result, fallback = null) {
  return result.status === 'fulfilled' ? result.value : fallback
}

const SNAPSHOT_KEY = 'health:summary'

export default {
  name: 'Health',
  components: { HealthStatCard, WitnessHealthList, HealthNodeSummary, DataNotice },
  data () {
    return {
      props: null,
      medianHistory: null,
      feedHistory: null,
      config: {},
      schedule: null,
      hardforkVersion: '',
      daoAccount: null,
      accountCount: null,
      rankedWitnesses: [],
      nodeSummary: null,
      bridge: null,
      bridgeState: BRIDGE_STATES.UNKNOWN,
      bridgeError: '',
      bridgeLoading: false,
      bridgeCheckedAt: 0,
      loading: true,
      loadError: '',
      lastUpdated: null,
      staleAt: null
    }
  },
  computed: {
    offline () {
      return this.$online ? !this.$online.online : (typeof navigator !== 'undefined' && navigator.onLine === false)
    },
    globalProps () {
      return this.props && !this.props.empty ? this.props : this.$hiveStore.globalProps
    },
    propsReady () {
      const props = this.globalProps
      return Boolean(props && props.current_supply && props.current_hbd_supply && props.participation_count !== undefined)
    },
    headBlock () {
      return Number(this.globalProps?.head_block_number) || 0
    },
    irreversible () {
      return Number(this.globalProps?.last_irreversible_block_num) || 0
    },
    headBehind () {
      return this.headBlock && this.irreversible ? Math.max(0, this.headBlock - this.irreversible) : 0
    },
    participation () {
      return participationRate(this.globalProps?.participation_count)
    },
    participationStat () {
      return participationStatus(this.participation)
    },
    participationHint () {
      const count = Number(this.globalProps?.participation_count) || 0
      return count.toLocaleString('en-US') + ' of the last 128 blocks carry witness signatures · 21 scheduled seats'
    },
    median () {
      return medianPrice(this.medianHistory)
    },
    medianHint () {
      const rate = this.medianHistory?.base && this.medianHistory?.quote
        ? this.medianHistory.base + ' per ' + this.medianHistory.quote
        : 'Median price feed unavailable'
      return rate + ' · HBD peg uses this 3.5-day median'
    },
    medianRange () {
      const history = this.feedHistory
      if (!history?.current_min_history || !history?.current_max_history) return '—'
      const min = medianPrice({ current_median_history: history.current_min_history }).hiveUsd
      const max = medianPrice({ current_median_history: history.current_max_history }).hiveUsd
      return '$' + min.toFixed(4) + '–$' + max.toFixed(4)
    },
    debt () {
      return hbdDebtRatio({
        hbdSupply: this.globalProps?.current_hbd_supply,
        hiveSupply: this.globalProps?.current_supply,
        hiveUsd: this.median.hiveUsd,
        treasuryHbd: this.daoAccount?.hbd_balance
      })
    },
    debtHint () {
      return 'Treasury-excluded HBD ' + formatCount(this.debt.hbd, 0) + ' against ' +
        formatCount(this.debt.hiveAsHbd, 0) + ' HBD of HIVE value · 20% soft / 30% hard limit'
    },
    priceStatus () {
      if (!this.median.hiveUsd) return { label: 'Unavailable', color: 'grey' }
      return this.debt.ratio !== null && this.debt.ratio >= 20
        ? { label: 'Debt pressure', color: 'orange' }
        : { label: 'Peg feed live', color: 'green' }
    },
    pool () {
      return resourcePool(this.globalProps, this.schedule)
    },
    poolHint () {
      return formatCount(this.pool.vestingShares / 1e9, 1) + 'B VESTS · ' +
        formatCount(this.pool.hpPerMvest, 0) + ' HP per 1M VESTS' +
        (this.pool.subsidyPool ? ' · subsidy pool ' + formatCount(this.pool.subsidyPool.pool, 0) : '')
    },
    versions () {
      return chainVersions(this.config, this.schedule?.majority_version, this.hardforkVersion)
    },
    versionDrift () {
      return versionStatus(this.versions.blockchainVersion, this.versions.consensusVersion) === 'mismatch'
    },
    versionDriftLabel () {
      if (!this.versions.blockchainVersion || !this.versions.consensusVersion) return 'Unknown'
      return this.versionDrift ? 'Drift' : 'Matches'
    },
    scheduledWitnesses () {
      return Array.isArray(this.schedule?.current_shuffled_witnesses) ? this.schedule.current_shuffled_witnesses : []
    },
    witnessRows () {
      return this.scheduledWitnesses.map((owner, index) => {
        const witness = this.rankedWitnesses.find(item => item.owner === owner)
        if (!witness) {
          return {
            owner,
            rank: index + 1,
            scheduled: true,
            running_version: '',
            votesHp: '—',
            missed: '—',
            feedAge: '—',
            health: [],
            status: 'ok',
            primaryWarnings: []
          }
        }
        const rank = this.rankedWitnesses.findIndex(item => item.owner === owner) + 1
        const health = witnessHealth(witness, {
          globalProps: this.globalProps,
          hardforkVersion: this.versions.consensusVersion,
          headBlock: this.headBlock,
          scheduled: rank > 0 && rank <= SCHEDULED_WITNESSES
        })
        return {
          ...witness,
          rank,
          scheduled: true,
          votesHp: formatHp(witnessVotesHp(witness.votes, this.globalProps)),
          missed: Number(witness.total_missed || 0).toLocaleString('en-US'),
          feedAge: relativeTime(witness.last_hbd_exchange_update),
          health,
          status: witnessStatus(health),
          primaryWarnings: health.filter(item => item.severity !== 'info')
        }
      })
    },
    witnessSummary () {
      return aggregateWitnessHealth(this.witnessRows, {
        globalProps: this.globalProps,
        hardforkVersion: this.versions.consensusVersion,
        headBlock: this.headBlock
      })
    },
    printRate () {
      return (Number(this.globalProps?.hbd_print_rate) || 0) / 100
    },
    interestRate () {
      return (Number(this.globalProps?.hbd_interest_rate) || 0) / 100
    },
    latestBlocks () {
      const start = this.irreversible
      return start > 0 && start < 10 ** 15
        ? Array.from({ length: 10 }, (_, index) => start - index).filter(block => block > 0)
        : []
    },
    overall () {
      const levels = [
        this.participationStat.key === 'unknown' ? null : this.participationStat.key,
        this.debt.ratio === null ? null : this.debt.status.key,
        this.witnessSummary.critical ? 'critical' : (this.witnessSummary.warning ? 'warning' : null),
        this.nodeSummary?.unreachableCount ? 'warning' : null,
        this.versionDrift ? 'watch' : null
      ]
      return overallStatus(levels)
    },
    alerts () {
      const list = []
      if (this.participationStat.key === 'warning' || this.participationStat.key === 'critical') {
        list.push('Witness participation is ' + formatPercent(this.participation, 1))
      }
      if (this.debt.ratio !== null && this.debt.status.key !== 'ok') {
        list.push('HBD debt ratio is ' + formatPercent(this.debt.ratio, 2) + ' (' + this.debt.status.label.toLowerCase() + ')')
      }
      if (this.witnessSummary.critical) {
        list.push(this.witnessSummary.critical + ' witness' + (this.witnessSummary.critical === 1 ? '' : 'es') + ' with critical health warnings')
      } else if (this.witnessSummary.warning) {
        list.push(this.witnessSummary.warning + ' witness' + (this.witnessSummary.warning === 1 ? '' : 'es') + ' with health warnings')
      }
      if (this.nodeSummary?.unreachableCount) {
        list.push(this.nodeSummary.unreachableCount + ' API node' + (this.nodeSummary.unreachableCount === 1 ? '' : 's') + ' unreachable')
      }
      if (this.versionDrift) {
        list.push('Node build v' + this.versions.blockchainVersion + ' differs from consensus v' + this.versions.consensusVersion)
      }
      return list
    },
    lastUpdatedLabel () {
      if (!this.lastUpdated) return 'Not updated yet'
      return 'Updated ' + new Date(this.lastUpdated).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    },
    bridgeStateLabel () {
      if (this.bridgeState === BRIDGE_STATES.AVAILABLE) return 'Bridge reachable'
      if (this.bridgeState === BRIDGE_STATES.DEGRADED) return 'Bridge degraded'
      if (this.bridgeState === BRIDGE_STATES.OFFLINE) return 'You are offline'
      if (this.bridgeState === BRIDGE_STATES.TIMEOUT) return 'Bridge not responding'
      if (this.bridgeState === BRIDGE_STATES.BLOCKED) return 'Blocked by the browser'
      if (this.bridgeState === BRIDGE_STATES.UNAUTHORIZED) return 'Sign-in required'
      return 'Not checked yet'
    },
    bridgeStateNote () {
      if (this.bridgeState === BRIDGE_STATES.AVAILABLE) {
        return 'The browser can read the bridge API and the live fee configuration.'
      }
      if (this.bridgeState === BRIDGE_STATES.DEGRADED) {
        return 'The bridge answered with a rate limit or server error. Existing invoices and on-chain transfers are unaffected.'
      }
      if (this.bridgeState === BRIDGE_STATES.OFFLINE) {
        return 'This browser is offline. Bridge status will refresh when the connection returns.'
      }
      if (this.bridgeState === BRIDGE_STATES.TIMEOUT) {
        return 'The bridge did not answer within eight seconds. This is advisory only; Lightning payments may still settle.'
      }
      if (this.bridgeState === BRIDGE_STATES.BLOCKED) {
        return 'The API was blocked before it answered, usually by an extension, VPN or intermediary. It is not a Hive consensus problem.'
      }
      if (this.bridgeState === BRIDGE_STATES.UNAUTHORIZED) {
        return 'The bridge is reachable but requires a signed-in session for that request.'
      }
      return 'Run a check to read the bridge version, LND state and live fee limits.'
    },
    bridgeIcon () {
      if (this.bridgeState === BRIDGE_STATES.AVAILABLE) return 'check_circle'
      if (this.bridgeState === BRIDGE_STATES.OFFLINE) return 'wifi_off'
      if (this.bridgeState === BRIDGE_STATES.BLOCKED) return 'shield'
      if (this.bridgeState === BRIDGE_STATES.UNAUTHORIZED) return 'lock'
      if (this.bridgeState === BRIDGE_STATES.UNKNOWN) return 'schedule'
      return 'warning'
    },
    bridgeColor () {
      if (this.bridgeState === BRIDGE_STATES.AVAILABLE) return 'green'
      if (this.bridgeState === BRIDGE_STATES.UNKNOWN) return 'grey'
      return 'orange'
    },
    bridgeCheckedLabel () {
      if (!this.bridgeCheckedAt) return ''
      return 'Checked ' + new Date(this.bridgeCheckedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    },
    bridgeEmptyLabel () {
      if (this.bridgeState === BRIDGE_STATES.UNKNOWN) {
        return this.bridgeError || 'The bridge has not been checked yet.'
      }
      return 'Live version, LND and fee values will appear when the bridge answers.'
    },
    bridgeFeeLabel () {
      const policy = this.bridge ? bridgeFeePolicy(this.bridge) : null
      if (!policy) return '—'
      const percentLabel = (Math.round(policy.percent * 1000) / 10) + '%'
      const fixedLabel = Number(policy.fixed).toLocaleString('en-US') + ' sats'
      return percentLabel + ' + ' + fixedLabel
    },
    bridgeRangeLabel () {
      const policy = this.bridge ? bridgeFeePolicy(this.bridge) : null
      if (!policy) return '—'
      return Number(policy.minSats).toLocaleString('en-US') + ' – ' +
        Number(policy.maxSats).toLocaleString('en-US') + ' sats'
    },
    bridgeLndLabel () {
      const connection = this.bridge?.lnd_connection
      const onward = this.bridge?.onward_response?.state
      if (!connection && !onward) return '—'
      return [connection, onward].filter(Boolean).join(' · ')
    },
    bridgeQuoteLabel () {
      const config = this.bridge?.config?.min_max
      if (!config) return '—'
      const age = Number(config.quote_age_s)
      const stale = config.stale === true
      if (!Number.isFinite(age)) return stale ? 'Stale' : '—'
      return Math.round(age) + 's old' + (stale ? ' · stale' : ' · fresh')
    }
  },
  mounted () {
    setPageMeta({
      title: 'Hive network health — participation, HBD debt and API latency',
      description: 'Live Hive network health: witness participation, HBD debt ratio, resource pool, median price, hardfork and chain version plus API node latency.',
      url: '/health'
    })
    this.load()
    this.loadBridge(false)
  },
  methods: {
    formatCount,
    formatPercent,
    overallStatusColor,
    overallStatusLabel,
    async loadBridge (force = true) {
      this.bridgeLoading = true
      try {
        const result = await probeBridge({ force })
        this.bridge = result.status
        this.bridgeState = result.state
        this.bridgeError = result.status ? '' : result.error
        this.bridgeCheckedAt = result.at
      } finally {
        this.bridgeLoading = false
      }
    },
    async load () {
      this.loading = true
      this.loadError = ''
      try {
        const [props, median, feed, config, schedule, hardfork, accounts, count, witnesses] = await Promise.allSettled([
          fetchGlobalProps(),
          this.$hive.api.getCurrentMedianHistoryPriceAsync(),
          this.$hive.api.callAsync('condenser_api.get_feed_history', []),
          this.$hive.api.callAsync('condenser_api.get_config', []),
          this.$hive.api.callAsync('condenser_api.get_witness_schedule', []),
          this.$hive.api.callAsync('condenser_api.get_hardfork_version', []),
          fetchAccounts(['hive.fund']),
          this.$hive.api.getAccountCountAsync(),
          fetchWitnessesByVote(200)
        ])

        this.props = settledValue(props, this.globalProps)
        if (this.props && !this.props.empty) this.$hiveStore.updateGlobalProps(this.props)
        this.medianHistory = settledValue(median)
        this.feedHistory = settledValue(feed)
        this.config = settledValue(config, {}) || {}
        this.schedule = settledValue(schedule)
        this.hardforkVersion = settledValue(hardfork, '') || ''
        const dao = settledValue(accounts, [])
        this.daoAccount = Array.isArray(dao) ? dao[0] || null : null
        this.accountCount = settledValue(count)
        this.rankedWitnesses = settledValue(witnesses, []) || []

        const failedChecks = [props, median, feed, config, schedule, hardfork, accounts, count, witnesses]
          .filter(result => result.status === 'rejected').length

        if (this.propsReady) {
          if (failedChecks > 0) {
            this.staleAt = this.lastUpdated || Date.now()
          } else {
            this.staleAt = null
          }
          this.lastUpdated = Date.now()
          this.saveSnapshot()
        } else if (this.restoreSnapshot()) {
          this.loadError = ''
        } else {
          this.loadError = 'The chain did not return global properties. Please retry.'
        }
      } catch {
        if (!this.restoreSnapshot()) {
          this.loadError = 'Could not load network health. Please retry.'
          this.$q.notify({ type: 'negative', message: 'Failed to load network health' })
        }
      } finally {
        this.loading = false
      }
    },
    saveSnapshot () {
      saveSnapshot(SNAPSHOT_KEY, {
        props: this.props,
        medianHistory: this.medianHistory,
        feedHistory: this.feedHistory,
        config: this.config,
        schedule: this.schedule,
        hardforkVersion: this.hardforkVersion,
        daoAccount: this.daoAccount,
        accountCount: this.accountCount,
        rankedWitnesses: this.rankedWitnesses,
        lastUpdated: this.lastUpdated
      })
    },
    restoreSnapshot () {
      const snapshot = loadSnapshot(SNAPSHOT_KEY)
      const data = snapshot?.data
      if (!data?.props) return false
      this.props = data.props
      this.medianHistory = data.medianHistory || null
      this.feedHistory = data.feedHistory || null
      this.config = data.config || {}
      this.schedule = data.schedule || null
      this.hardforkVersion = data.hardforkVersion || ''
      this.daoAccount = data.daoAccount || null
      this.accountCount = data.accountCount ?? null
      this.rankedWitnesses = Array.isArray(data.rankedWitnesses) ? data.rankedWitnesses : []
      this.lastUpdated = Number(data.lastUpdated) || snapshot.savedAt
      this.staleAt = this.lastUpdated
      return true
    },
    refresh () {
      this.load()
      this.loadBridge(true)
      this.$refs.nodeSummary?.load()
    }
  }
}
</script>
