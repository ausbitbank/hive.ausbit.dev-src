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
        <q-btn flat dense round icon="refresh" aria-label="Refresh latest block" title="Refresh latest block" :loading="refreshing" @click="loadLatest" />
        <router-link to="/blocks" class="home-panel__link">All blocks</router-link>
      </div>
    </q-card-section>

    <div v-if="staleAt" class="home-panel__notice">
      <data-notice
        variant="stale"
        :message="offline ? 'Offline — showing the saved block.' : 'Live refresh failed — showing the saved block.'"
        :updated-at="staleAt"
        action-label="Retry"
        @action="loadLatest"
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
      <q-btn flat dense no-caps color="primary" icon="refresh" label="Retry" @click="loadLatest" />
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
  color: #b0bec5;
  font-size: 0.8rem;
}

.home-block__witness-text a {
  color: #e4eaed;
  font-weight: 600;
}

.home-block__witness-sub {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 0.3rem;
  margin-top: 0.1rem;
  color: #78909c;
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
  background: rgba(255, 255, 255, 0.025);
}

.home-block__metric-label {
  color: #90a4ae;
  font-size: 0.64rem;
  letter-spacing: 0.05em;
  text-transform: uppercase;
}

.home-block__metric-value {
  color: #e4eaed;
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
  color: #78909c;
  font-size: 0.66rem;
  letter-spacing: 0.05em;
  text-transform: uppercase;
}

.home-block__mix-chip {
  padding: 0.08rem 0.42rem;
  border-radius: var(--radius-pill);
  background: rgba(255, 255, 255, 0.055);
  color: #b0bec5;
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
      headBlock: null,
      followHead: true,
      poller: null,
      loading: true,
      refreshing: false,
      error: '',
      staleAt: null,
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
    transactions () {
      return blockTransactionCount(this.block)
    },
    virtualCount () {
      return this.virtualOps.length
    },
    operations () {
      // "Operations" excludes virtual operations everywhere. Virtual ops are
      // reported separately so the home card and the block page agree.
      return blockOperationCount(this.block)
    },
    sizeKb () {
      return blockSizeKb(this.block).toFixed(1)
    },
    mix () {
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
    async loadLatest () {
      this.followHead = true
      this.refreshing = Boolean(this.block)
      try {
        const props = await fetchGlobalProps({ force: true })
        const head = Number(props && props.head_block_number)
        if (!Number.isFinite(head) || head <= 0) throw new Error('Head block unavailable')
        this.headBlock = head
        await this.loadBlock(head)
      } catch (error) {
        console.error('Failed to load latest block', error)
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
      this.staleAt = snapshot.savedAt
      this.error = ''
      return true
    },
    async loadBlock (number) {
      if (!Number.isFinite(number) || number < 1) return
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

        const virtualOps = await this.$hive.api.getOpsInBlockAsync(loadedNumber, true).catch(() => [])
        this.block = block
        this.blockNum = loadedNumber
        this.virtualOps = Array.isArray(virtualOps) ? virtualOps : []
        this.staleAt = null
        if (loadedNumber >= (this.headBlock || 0)) this.followHead = true
        this.saveSnapshot()
      } catch (error) {
        console.error('Failed to load home block', error)
        if (!this.restoreSnapshot(number)) this.error = 'Could not load block ' + number + '.'
      } finally {
        this.loading = false
        this.refreshing = false
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
