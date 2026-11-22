<template>
  <q-card flat bordered class="home-card home-panel home-block">
    <q-card-section class="home-panel__head">
      <div>
        <div class="home-eyebrow">
          <span class="home-live-dot" :class="{ 'is-live': followingHead }" aria-hidden="true"></span>
          {{ followingHead ? 'Live block' : 'Block explorer' }}
        </div>
        <div class="home-block__title-row">
          <h2 class="home-panel__title">
            <router-link v-if="blockNumber" :to="blockLink">Block {{ blockNumberLabel }}</router-link>
            <span v-else>Latest block</span>
          </h2>
          <q-btn
            flat
            dense
            round
            size="sm"
            icon="navigate_before"
            aria-label="Previous block"
            title="Previous block"
            :disable="!blockNumber || blockNumber <= 1"
            @click="goToBlock(blockNumber - 1)"
          />
          <q-btn
            flat
            dense
            round
            size="sm"
            icon="navigate_next"
            aria-label="Next block"
            title="Next block"
            :disable="!blockNumber || isHead"
            @click="goToBlock(blockNumber + 1)"
          />
        </div>
      </div>
      <div class="home-panel__actions">
        <q-btn flat dense round icon="refresh" aria-label="Refresh latest block" title="Refresh latest block" :loading="refreshing" @click="loadLatest({ force: true })" />
        <router-link to="/blocks" class="home-panel__link">All blocks</router-link>
      </div>
    </q-card-section>

    <div v-if="staleAt" class="home-panel__notice">
      <data-notice
        variant="stale"
        :message="offline ? 'Offline — showing the saved block.' : 'Live refresh failed — showing the saved block.'"
        :updated-at="staleAt"
        action-label="Retry"
        @action="loadLatest({ force: true })"
      />
    </div>
    <div v-else-if="cachedAt && snapshotAged" class="home-panel__notice">
      <data-notice
        variant="info"
        message="Showing the last published snapshot while the live block loads."
        :updated-at="cachedAt"
      />
    </div>

    <q-card-section v-if="loading && !block" class="home-panel__body">
      <div class="home-block-skeleton">
        <q-skeleton type="circle" size="28px" />
        <div class="home-block-skeleton__body">
          <q-skeleton type="text" width="45%" />
          <q-skeleton type="text" width="30%" />
        </div>
      </div>
      <div class="home-block__metrics">
        <q-skeleton v-for="i in 4" :key="i" type="rect" height="58px" />
      </div>
    </q-card-section>

    <q-card-section v-else-if="error && !block" class="home-panel__state">
      <q-icon name="error_outline" size="24px" color="orange" aria-hidden="true" />
      <span>{{ error }}</span>
      <q-btn flat dense no-caps color="primary" icon="refresh" label="Retry" @click="loadLatest({ force: true })" />
    </q-card-section>

    <template v-else-if="block">
      <q-card-section class="home-block__witness">
        <q-avatar size="28px">
          <q-img :src="avatarUrl(block.witness)" :alt="'Avatar of witness @' + block.witness" />
        </q-avatar>
        <div class="home-block__witness-text">
          <div>
            Produced by <router-link :to="'/@' + block.witness">@{{ block.witness }}</router-link>
          </div>
          <div class="home-block__witness-sub">
            <span :title="formattedTimestamp">{{ relativeTimestamp }}</span>
            <span aria-hidden="true">·</span>
            <span>{{ transactions }} transaction{{ transactions === 1 ? '' : 's' }}</span>
          </div>
        </div>
      </q-card-section>

      <div class="home-block__metrics">
        <div class="home-block__metric">
          <span class="home-block__metric-label">Transactions</span>
          <span class="home-block__metric-value">{{ transactions }}</span>
        </div>
        <div class="home-block__metric">
          <span class="home-block__metric-label">Operations</span>
          <span class="home-block__metric-value">{{ operations }}</span>
        </div>
        <div class="home-block__metric">
          <span class="home-block__metric-label">Virtual ops</span>
          <span class="home-block__metric-value">{{ virtualCount }}</span>
        </div>
        <div class="home-block__metric">
          <span class="home-block__metric-label">Size</span>
          <span class="home-block__metric-value">{{ sizeKb }} KB</span>
        </div>
      </div>

      <div v-if="!compact && mix.length" class="home-block__mix">
        <span class="home-block__mix-label">Activity</span>
        <span v-for="item in mix" :key="item.type" class="home-block__mix-chip">{{ item.count }}× {{ item.label }}</span>
      </div>

      <q-card-section class="home-panel__footer">
        <span>{{ formattedTimestamp }}</span>
        <router-link :to="blockLink">View block details</router-link>
      </q-card-section>
    </template>
  </q-card>
</template>

<style scoped>
.home-block__title-row {
  display: flex;
  align-items: center;
  gap: 0.15rem;
  flex-wrap: wrap;
}

.home-block__witness {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding-top: 0.65rem;
  padding-bottom: 0.65rem;
  border-top: 1px solid var(--border-subtle);
}

.home-block__witness-text {
  min-width: 0;
  color: var(--c-text-muted);
  font-size: 0.8rem;
}

.home-block__witness-text a {
  color: var(--c-text);
  font-weight: 600;
}

.home-block__witness-sub {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 0.3rem;
  margin-top: 0.1rem;
  color: var(--c-text-faint);
  font-size: 0.7rem;
}

.home-block__metrics {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0.45rem;
  padding: 0 1rem;
}

.home-block__metric {
  display: flex;
  flex-direction: column;
  gap: 0.1rem;
  padding: 0.5rem 0.6rem;
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-sm);
  background: color-mix(in srgb, var(--c-text) 3%, transparent);
}

.home-block__metric-label {
  color: var(--c-text-subtle);
  font-size: 0.64rem;
  letter-spacing: 0.05em;
  text-transform: uppercase;
}

.home-block__metric-value {
  color: var(--c-text);
  font-size: 0.95rem;
  font-weight: 600;
}

.home-block__mix {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 0.3rem;
  padding: 0.7rem 1rem 0;
}

.home-block__mix-label {
  margin-right: 0.1rem;
  color: var(--c-text-faint);
  font-size: 0.66rem;
  letter-spacing: 0.05em;
  text-transform: uppercase;
}

.home-block__mix-chip {
  padding: 0.08rem 0.42rem;
  border-radius: var(--radius-pill);
  background: color-mix(in srgb, var(--c-text) 6%, transparent);
  color: var(--c-text-muted);
  font-size: 0.68rem;
}

.home-block-skeleton {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding-bottom: 0.65rem;
}

.home-block-skeleton__body {
  flex: 1;
}
</style>

<script>
import moment from 'src/utils/time'
import { pollWhileVisible } from 'src/services/polling'
import { fetchGlobalProps } from 'src/services/chainData'
import {
  blockOperationCount,
  blockOperationMix,
  blockSizeKb,
  blockTransactionCount
} from 'src/services/home'
import DataNotice from 'components/ui/DataNotice.vue'
import { loadSnapshot, saveSnapshot } from 'src/services/snapshots'
import { getHomeSnapshot, whenHomeSnapshot } from 'src/services/homeSnapshot'
import { hiveAvatarUrl } from 'src/utils/avatar'

const POLL_INTERVAL = 15000
const SNAPSHOT_KEY = 'home:block'

export default {
  name: 'homeBlockCard',
  components: { DataNotice },
  props: {
    // Drop the operation-mix chips to keep the card short in a narrow slot.
    compact: { type: Boolean, default: false }
  },
  data () {
    return {
      block: null,
      blockNum: 0,
      virtualOps: [],
      // Compact counters from the published home snapshot. Kept separate from
      // the block because the snapshot never carries the full transaction list.
      summary: null,
      headBlock: null,
      followHead: true,
      poller: null,
      loading: true,
      refreshing: false,
      error: '',
      staleAt: null,
      cachedAt: null,
      loadToken: 0,
      timer: null
    }
  },
  computed: {
    offline () {
      return this.$online ? !this.$online.online : (typeof navigator !== 'undefined' && navigator.onLine === false)
    },
    blockNumber () {
      return this.blockNum || 0
    },
    blockNumberLabel () {
      return this.blockNumber ? this.blockNumber.toLocaleString('en-US') : ''
    },
    blockLink () {
      return this.blockNumber ? '/b/' + this.blockNumber : '/blocks'
    },
    isHead () {
      return Boolean(this.headBlock && this.blockNumber >= this.headBlock)
    },
    followingHead () {
      return this.followHead
    },
    /** Only call out a snapshot that was published more than five minutes ago. */
    snapshotAged () {
      return Boolean(this.cachedAt) && Date.now() - this.cachedAt > 5 * 60 * 1000
    },
    transactions () {
      return this.summary ? this.summary.transactions : blockTransactionCount(this.block)
    },
    virtualCount () {
      return this.summary ? this.summary.virtualOps : this.virtualOps.length
    },
    operations () {
      // "Operations" excludes virtual operations everywhere. Virtual ops are
      // reported separately so the home card and the block page agree.
      return this.summary ? this.summary.operations : blockOperationCount(this.block)
    },
    sizeKb () {
      return this.summary ? this.summary.sizeKb : blockSizeKb(this.block).toFixed(1)
    },
    mix () {
      if (this.summary) return this.summary.mix || []
      if (!this.block) return []
      const regular = (this.block.transactions || []).flatMap(tx => tx.operations || [])
      return blockOperationMix([...regular, ...this.virtualOps], 4)
    },
    formattedTimestamp () {
      if (!this.block || !this.block.timestamp) return ''
      return moment.utc(this.block.timestamp).format('D MMM YYYY, HH:mm:ss') + ' UTC'
    },
    relativeTimestamp () {
      if (!this.block || !this.block.timestamp) return ''
      return moment.utc(this.block.timestamp).fromNow()
    }
  },
  created () {
    // Paint the published snapshot before the first network read. The live
    // load still runs from `mounted` and replaces this as soon as it lands.
    const snapshot = getHomeSnapshot()
    if (snapshot?.block) {
      this.applySnapshot(snapshot.block, snapshot.generatedAt)
      return
    }
    // Non-home shells do not carry the inline copy; the published JSON still
    // lets a client-side visit paint before the chain read lands.
    whenHomeSnapshot({ timeoutMs: 400 }).then(snapshot => {
      if (snapshot?.block && this.loading) this.applySnapshot(snapshot.block, snapshot.generatedAt)
    })
  },
  mounted () {
    this.loadLatest()
    this.poller = pollWhileVisible(this.refreshIfNewBlock, POLL_INTERVAL, { immediate: false })
    this.poller.start()
  },
  beforeUnmount () {
    if (this.poller) this.poller.stop()
  },
  methods: {
    avatarUrl (user) {
      return hiveAvatarUrl(user)
    },
    applySnapshot (section, generatedAt) {
      if (!section?.block) return false
      this.block = section.block
      this.blockNum = Number(section.blockNum) || 0
      this.headBlock = Number(section.headBlock) || null
      this.summary = section.summary || null
      this.virtualOps = []
      this.followHead = false
      this.loading = false
      this.error = ''
      this.cachedAt = Number(generatedAt) || Date.now()
      return true
    },
    async loadLatest ({ force = false } = {}) {
      this.followHead = true
      this.refreshing = Boolean(this.block)
      try {
        // Cache-first on the first paint: a warm `globalProps` entry is shared
        // with the witness and network cards, so this is often free.
        const props = await fetchGlobalProps({ force })
        const head = Number(props && props.head_block_number)
        if (!Number.isFinite(head) || head <= 0) throw new Error('Head block unavailable')
        this.headBlock = head
        await this.loadBlock(head)
      } catch (error) {
        console.error('Failed to load latest block', error)
        this.followHead = false
        if (!this.restoreSnapshot()) this.error = 'Could not load the latest block.'
        this.loading = false
        this.refreshing = false
      }
    },
    saveSnapshot () {
      if (!this.block) return
      saveSnapshot(SNAPSHOT_KEY, {
        block: this.block,
        blockNum: this.blockNum,
        headBlock: this.headBlock,
        virtualOps: this.virtualOps
      })
    },
    restoreSnapshot (number = null) {
      const snapshot = loadSnapshot(SNAPSHOT_KEY)
      const data = snapshot?.data
      if (!data?.block) return false
      if (number && Number(data.blockNum) !== Number(number) && Number(data.headBlock) !== Number(number)) return false
      this.block = data.block
      this.blockNum = Number(data.blockNum) || 0
      this.headBlock = Number(data.headBlock) || null
      this.virtualOps = Array.isArray(data.virtualOps) ? data.virtualOps : []
      this.summary = null
      this.cachedAt = null
      this.staleAt = snapshot.savedAt
      this.error = ''
      return true
    },
    async loadBlock (number) {
      if (!Number.isFinite(number) || number < 1) return
      const token = ++this.loadToken
      const hasBlock = Boolean(this.block)
      if (hasBlock) this.refreshing = true
      else this.loading = true
      this.error = ''

      try {
        let block = null
        let loadedNumber = number
        try {
          block = await this.$hive.api.getBlockAsync(number)
        } catch {
          loadedNumber = number - 1
          block = await this.$hive.api.getBlockAsync(loadedNumber)
        }
        if (!block) throw new Error('Block not found')
        if (token !== this.loadToken) return

        // Render the block as soon as the block read lands. Virtual operations
        // are a separate call and only feed the "Virtual ops" counter, so they
        // must never delay the first paint.
        this.block = block
        this.blockNum = loadedNumber
        this.summary = null
        this.virtualOps = []
        this.staleAt = null
        this.cachedAt = null
        if (loadedNumber >= (this.headBlock || 0)) this.followHead = true
        this.loading = false
        this.refreshing = false
        this.saveSnapshot()

        this.$hive.api.getOpsInBlockAsync(loadedNumber, true)
          .then(virtualOps => {
            if (token !== this.loadToken) return
            this.virtualOps = Array.isArray(virtualOps) ? virtualOps : []
            this.saveSnapshot()
          })
          .catch(() => {})
      } catch (error) {
        if (token !== this.loadToken) return
        console.error('Failed to load home block', error)
        if (!this.restoreSnapshot(number)) this.error = 'Could not load block ' + number + '.'
      } finally {
        if (token === this.loadToken) {
          this.loading = false
          this.refreshing = false
        }
      }
    },
    goToBlock (number) {
      if (!Number.isFinite(number) || number < 1) return
      this.followHead = Boolean(this.headBlock && number >= this.headBlock)
      this.loadBlock(number)
    },
    async refreshIfNewBlock () {
      if (!this.followHead) return
      try {
        const props = await fetchGlobalProps({ force: true })
        const head = Number(props && props.head_block_number)
        if (Number.isFinite(head) && head > this.blockNumber) {
          this.headBlock = head
          await this.loadBlock(head)
        }
      } catch {
        // Silent background refresh; the manual button reports errors.
      }
    }
  }
}
</script>
