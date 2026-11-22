<template>
  <q-page class="flex q-pa-md flex-center">
    <h1 class="sr-only">Latest Hive blocks</h1>
    <q-card flat bordered class="blocks-card">
      <q-card-section class="row items-center q-gutter-sm">
        <div class="text-h5"><q-icon name="view_list" color="primary" /> Latest Hive Blocks</div>
        <q-space />
        <q-btn
          dense
          flat
          :icon="autoRefresh ? 'pause_circle' : 'play_circle'"
          :color="autoRefresh ? 'orange' : 'green'"
          :label="autoRefresh ? 'Pause' : 'Resume'"
          :title="autoRefresh ? 'Pause auto-refresh' : 'Resume auto-refresh every 8 seconds'"
          @click="toggleAutoRefresh"
        />
        <q-btn dense flat icon="refresh" label="Refresh" :loading="refreshing" @click="loadBlocks()" />
      </q-card-section>
      <q-separator />

      <q-banner v-if="error" dense class="bg-red-1 text-red-9">
        <q-icon name="error" class="q-mr-sm" />
        Could not load blocks: {{ error }}
        <template v-slot:action>
          <q-btn flat dense color="red" label="Retry" @click="loadBlocks({ initial: true })" />
        </template>
      </q-banner>

      <q-linear-progress v-if="refreshing && blocks.length > 0" indeterminate color="primary" />

      <div v-if="staleAt" class="q-px-md q-pb-sm">
        <data-notice
          variant="stale"
          :message="offline ? 'Offline — showing saved blocks.' : 'Block refresh failed — showing saved blocks.'"
          :updated-at="staleAt"
          action-label="Retry"
          @action="loadBlocks({ initial: true })"
        />
      </div>

      <q-list separator v-if="blocks.length > 0">
        <q-item v-for="block in blocks" :key="block.number">
          <q-item-section avatar>
            <q-icon name="tag" color="primary" />
          </q-item-section>
          <q-item-section>
            <q-item-label>
              <router-link :to="blockLink(block.number)" class="text-primary text-bold">Block #{{ tidyNumber(block.number) }}</router-link>
              <span class="text-faint text-caption q-ml-sm">{{ blockAge(block.timestamp) }}</span>
            </q-item-label>
            <q-item-label caption>
              <span :title="block.timestamp">{{ blockTime(block.timestamp) }}</span>
              <template v-if="block.witness"> · witness <router-link :to="accountLink(block.witness)">{{ block.witness }}</router-link></template>
            </q-item-label>
          </q-item-section>
          <q-item-section side>
            <div class="text-caption">{{ block.transactionCount }} tx</div>
          </q-item-section>
        </q-item>
      </q-list>

      <div v-else-if="loading" class="q-pa-md">
        <q-item v-for="n in 10" :key="n">
          <q-item-section avatar>
            <q-skeleton type="QAvatar" />
          </q-item-section>
          <q-item-section>
            <q-skeleton type="text" width="55%" />
            <q-skeleton type="text" width="35%" />
          </q-item-section>
          <q-item-section side>
            <q-skeleton type="text" width="40px" />
          </q-item-section>
        </q-item>
      </div>

      <q-card-section v-else-if="!error" class="text-center text-faint">
        No blocks to show.
      </q-card-section>

      <q-card-actions v-if="blocks.length > 0" class="text-caption text-faint">
        {{ rangeLabel }} · {{ autoRefresh ? 'auto-refresh every 8s' : 'auto-refresh paused' }}
      </q-card-actions>
    </q-card>
  </q-page>
</template>

<script>
import moment from 'src/utils/time'
import { setPageMeta } from 'src/utils/pageMeta'
import { pollWhileVisible } from 'src/services/polling'
import { fetchGlobalProps } from 'src/services/chainData'
import DataNotice from 'components/ui/DataNotice.vue'
import { loadSnapshot, saveSnapshot } from 'src/services/snapshots'

const BLOCK_COUNT = 10
const REFRESH_INTERVAL_MS = 8000
const SNAPSHOT_KEY = 'blocks:latest'

export default {
  name: 'blocksPage',
  components: { DataNotice },
  data () {
    return {
      blocks: [],
      loading: true,
      refreshing: false,
      autoRefresh: true,
      error: null,
      staleAt: null,
      refreshPoller: null
    }
  },
  computed: {
    offline () {
      return this.$online ? !this.$online.online : (typeof navigator !== 'undefined' && navigator.onLine === false)
    },
    rangeLabel () {
      if (this.blocks.length === 0) return ''
      const newest = this.blocks[0].number
      const oldest = this.blocks[this.blocks.length - 1].number
      return 'Showing blocks ' + this.tidyNumber(oldest) + '–' + this.tidyNumber(newest)
    }
  },
  methods: {
    blockLink (number) { return '/b/' + number },
    accountLink (account) { return '/@' + account },
    tidyNumber (x) {
      return String(x).replace(/\B(?=(\d{3})+(?!\d))/g, ',')
    },
    blockAge (timestamp) {
      if (!timestamp) return ''
      return moment.utc(timestamp).fromNow()
    },
    blockTime (timestamp) {
      if (!timestamp) return 'Unknown time'
      return moment(timestamp).format('YYYY-MM-DD HH:mm:ss')
    },
    async loadBlocks ({ initial = false } = {}) {
      if (this.refreshing) return
      this.refreshing = true
      if (initial || this.blocks.length === 0) this.loading = true

      try {
        const props = await fetchGlobalProps({ force: true })
        const head = parseInt(props?.head_block_number, 10)
        if (!Number.isFinite(head) || head <= 0) throw new Error('Invalid chain head')

        const numbers = []
        for (let i = 0; i < BLOCK_COUNT && head - i > 0; i++) {
          numbers.push(head - i)
        }

        const loaded = await Promise.all(numbers.map(async number => {
          try {
            const block = await this.$hive.api.getBlockAsync(number)
            if (!block) return null
            return {
              number,
              timestamp: block.timestamp || null,
              witness: block.witness || null,
              transactionCount: Array.isArray(block.transactions) ? block.transactions.length : 0
            }
          } catch {
            return null
          }
        }))

        const blocks = loaded.filter(Boolean)
        if (blocks.length === 0) throw new Error('No blocks returned by the node')

        this.blocks = blocks
        this.error = null
        this.staleAt = null
        saveSnapshot(SNAPSHOT_KEY, { blocks })
      } catch (error) {
        if (this.blocks.length) {
          this.error = error?.message || 'Unknown error'
          this.staleAt = this.staleAt || Date.now()
        } else if (this.restoreSnapshot()) {
          this.error = null
        } else {
          this.error = error?.message || 'Unknown error'
        }
      } finally {
        this.loading = false
        this.refreshing = false
      }
    },
    restoreSnapshot () {
      const snapshot = loadSnapshot(SNAPSHOT_KEY)
      const blocks = snapshot?.data?.blocks
      if (!Array.isArray(blocks) || !blocks.length) return false
      this.blocks = blocks
      this.staleAt = snapshot.savedAt
      return true
    },
    startAutoRefresh () {
      this.stopAutoRefresh()
      this.refreshPoller = pollWhileVisible(() => { this.loadBlocks() }, REFRESH_INTERVAL_MS, { immediate: false })
      this.refreshPoller.start()
    },
    stopAutoRefresh () {
      if (this.refreshPoller) {
        this.refreshPoller.stop()
        this.refreshPoller = null
      }
    },
    toggleAutoRefresh () {
      this.autoRefresh = !this.autoRefresh
      if (this.autoRefresh) {
        this.startAutoRefresh()
      } else {
        this.stopAutoRefresh()
      }
    }
  },
  mounted () {
    setPageMeta({
      title: 'Latest Hive blocks',
      description: 'Live list of the newest Hive blocks with witness, timestamp and transaction counts, refreshed automatically.',
      url: '/blocks'
    })
    this.loadBlocks({ initial: true })
    this.startAutoRefresh()
  },
  beforeUnmount () {
    this.stopAutoRefresh()
  }
}
</script>

<style scoped>
.blocks-card {
  width: 100%;
  max-width: 760px;
}
</style>
