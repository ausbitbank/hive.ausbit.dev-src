<template>
  <div class="block-op" :class="{ 'block-op--virtual': virtual }">
    <div class="block-op__row">
      <q-badge :color="opColor" class="block-op__type">{{ type }}</q-badge>

      <div class="block-op__summary">
        <template v-if="type === 'vote'">
          <q-avatar size="20px"><q-img :src="avatarUrl(opData.voter)" :alt="'Avatar of @' + opData.voter" /></q-avatar>
          <router-link :to="'/@' + opData.voter" class="text-bold">@{{ opData.voter }}</router-link>
          voted <q-badge :color="opData.weight < 0 ? 'red' : 'green'" class="block-op__weight">{{ (opData.weight || 0) / 100 }}%</q-badge>
          on <router-link :to="postLink(opData.author, opData.permlink)">@{{ opData.author }}/{{ opData.permlink }}</router-link>
        </template>

        <template v-else-if="type === 'comment'">
          <q-avatar size="20px"><q-img :src="avatarUrl(opData.author)" :alt="'Avatar of @' + opData.author" /></q-avatar>
          <router-link :to="'/@' + opData.author" class="text-bold">@{{ opData.author }}</router-link>
          <template v-if="!opData.parent_author">
            published <router-link :to="postLink(opData.author, opData.permlink)">{{ opData.title || opData.permlink }}</router-link>
          </template>
          <template v-else>
            replied to <router-link :to="postLink(opData.parent_author, opData.parent_permlink)">@{{ opData.parent_author }}/{{ opData.parent_permlink }}</router-link>
          </template>
        </template>

        <template v-else-if="type === 'transfer'">
          <router-link :to="'/@' + opData.from" class="text-bold">@{{ opData.from }}</router-link>
          sent <q-badge color="teal" class="block-op__amount">{{ opData.amount }}</q-badge>
          to <router-link :to="'/@' + opData.to" class="text-bold">@{{ opData.to }}</router-link>
          <span v-if="opData.memo" class="block-op__muted">· memo: {{ opData.memo }}</span>
        </template>

        <template v-else-if="type === 'transfer_to_vesting'">
          <router-link :to="'/@' + opData.from" class="text-bold">@{{ opData.from }}</router-link>
          powered up <q-badge color="teal" class="block-op__amount">{{ opData.amount }}</q-badge>
          <span v-if="opData.to && opData.to !== opData.from">to <router-link :to="'/@' + opData.to">@{{ opData.to }}</router-link></span>
        </template>

        <template v-else-if="type === 'withdraw_vesting'">
          <router-link :to="'/@' + opData.account" class="text-bold">@{{ opData.account }}</router-link>
          started powering down <q-badge color="orange" class="block-op__amount">{{ opData.vesting_shares }}</q-badge>
        </template>

        <template v-else-if="type === 'custom_json'">
          <span class="block-op__muted">custom JSON</span>
          <q-badge color="blue-grey-9" class="block-op__amount">{{ opData.id || 'unknown id' }}</q-badge>
          <span v-if="firstAuth">by <router-link :to="'/@' + firstAuth">@{{ firstAuth }}</router-link></span>
          <span class="block-op__muted">· open JSON for payload</span>
        </template>

        <template v-else-if="type === 'claim_reward_balance'">
          <router-link :to="'/@' + opData.account" class="text-bold">@{{ opData.account }}</router-link>
          claimed rewards
          <q-badge v-if="opData.reward_hive && opData.reward_hive !== '0.000 HIVE'" color="green">{{ opData.reward_hive }}</q-badge>
          <q-badge v-if="opData.reward_hbd && opData.reward_hbd !== '0.000 HBD'" color="green">{{ opData.reward_hbd }}</q-badge>
          <q-badge v-if="opData.reward_vests && opData.reward_vests !== '0.000 VESTS'" color="teal">{{ opData.reward_vests }}</q-badge>
        </template>

        <template v-else-if="type === 'account_update' || type === 'account_update2'">
          <router-link :to="'/@' + (opData.account || opData.owner)" class="text-bold">@{{ opData.account || opData.owner }}</router-link>
          updated account metadata
        </template>

        <template v-else-if="type === 'account_create' || type === 'create_claimed_account'">
          <router-link :to="'/@' + opData.creator" class="text-bold">@{{ opData.creator }}</router-link>
          created <router-link :to="'/@' + opData.new_account_name">@{{ opData.new_account_name }}</router-link>
        </template>

        <template v-else-if="type === 'limit_order_create'">
          <router-link :to="'/@' + opData.owner" class="text-bold">@{{ opData.owner }}</router-link>
          created an order selling <q-badge color="orange">{{ opData.amount_to_sell }}</q-badge>
          for <q-badge color="orange">{{ opData.min_to_receive }}</q-badge>
        </template>

        <template v-else-if="type === 'limit_order_cancel'">
          <router-link :to="'/@' + opData.owner" class="text-bold">@{{ opData.owner }}</router-link>
          cancelled order <q-badge color="orange">#{{ opData.orderid }}</q-badge>
        </template>

        <template v-else-if="type === 'fill_order'">
          <router-link :to="'/@' + opData.current_owner" class="text-bold">@{{ opData.current_owner }}</router-link>
          filled an order from <router-link :to="'/@' + opData.open_owner">@{{ opData.open_owner }}</router-link>
          · paid <q-badge color="orange">{{ opData.current_pays }}</q-badge> for <q-badge color="orange">{{ opData.open_pays }}</q-badge>
        </template>

        <template v-else-if="type === 'convert'">
          <router-link :to="'/@' + opData.owner" class="text-bold">@{{ opData.owner }}</router-link>
          started a conversion of <q-badge color="orange">{{ opData.amount }}</q-badge>
        </template>

        <template v-else-if="type === 'collateralized_convert'">
          <router-link :to="'/@' + opData.owner" class="text-bold">@{{ opData.owner }}</router-link>
          started a collateralized conversion of <q-badge color="orange">{{ opData.amount }}</q-badge>
        </template>

        <template v-else-if="type === 'feed_publish'">
          <router-link :to="'/@' + opData.publisher" class="text-bold">@{{ opData.publisher }}</router-link>
          published a price feed: <q-badge color="purple">{{ opData.exchange_rate?.base }} / {{ opData.exchange_rate?.quote }}</q-badge>
        </template>

        <template v-else-if="type === 'comment_options'">
          <router-link :to="'/@' + opData.author" class="text-bold">@{{ opData.author }}</router-link>
          set options for <router-link :to="postLink(opData.author, opData.permlink)">{{ opData.permlink }}</router-link>
        </template>

        <template v-else-if="type === 'delegate_vesting_shares'">
          <router-link :to="'/@' + opData.delegator" class="text-bold">@{{ opData.delegator }}</router-link>
          delegated <q-badge color="teal">{{ opData.vesting_shares }}</q-badge>
          to <router-link :to="'/@' + opData.delegatee">@{{ opData.delegatee }}</router-link>
        </template>

        <template v-else-if="type === 'account_witness_vote'">
          <router-link :to="'/@' + opData.account" class="text-bold">@{{ opData.account }}</router-link>
          {{ opData.approve ? 'voted for' : 'removed vote for' }}
          witness <router-link :to="'/@' + opData.witness">@{{ opData.witness }}</router-link>
        </template>

        <template v-else-if="type === 'account_witness_proxy'">
          <router-link :to="'/@' + opData.account" class="text-bold">@{{ opData.account }}</router-link>
          set witness proxy to <router-link :to="'/@' + opData.proxy">@{{ opData.proxy }}</router-link>
        </template>

        <template v-else-if="type === 'transfer_to_savings' || type === 'transfer_from_savings'">
          <router-link :to="'/@' + opData.from" class="text-bold">@{{ opData.from }}</router-link>
          moved <q-badge color="teal">{{ opData.amount }}</q-badge>
          {{ type === 'transfer_to_savings' ? 'into' : 'out of' }} savings
        </template>

        <template v-else-if="type === 'interest'">
          <router-link :to="'/@' + opData.owner" class="text-bold">@{{ opData.owner }}</router-link>
          earned <q-badge color="green">{{ opData.interest }}</q-badge> savings interest
        </template>

        <template v-else-if="type === 'author_reward' || type === 'curation_reward' || type === 'comment_reward'">
          <router-link :to="'/@' + (opData.author || opData.curator || opData.account || opData.owner)" class="text-bold">@{{ opData.author || opData.curator || opData.account || opData.owner }}</router-link>
          received a {{ type.replace('_', ' ') }}
        </template>

        <template v-else-if="type === 'create_proposal'">
          <router-link :to="'/@' + opData.creator" class="text-bold">@{{ opData.creator }}</router-link>
          created proposal <router-link :to="'/proposals/' + opData.proposal_id">#{{ opData.proposal_id }}</router-link>
          for <q-badge color="purple">{{ opData.daily_pay }}</q-badge>
        </template>

        <template v-else-if="type === 'update_proposal_votes'">
          <router-link :to="'/@' + opData.voter" class="text-bold">@{{ opData.voter }}</router-link>
          {{ opData.approve ? 'supported' : 'removed support for' }}
          proposal<span v-if="(opData.proposal_ids || []).length !== 1">s</span>
          <q-badge v-for="id in opData.proposal_ids" :key="id" color="purple">#{{ id }}</q-badge>
        </template>

        <template v-else-if="type === 'proposal_pay'">
          proposal <router-link :to="'/proposals/' + opData.proposal_id">#{{ opData.proposal_id }}</router-link>
          paid <q-badge color="green">{{ opData.payment }}</q-badge>
          to <router-link :to="'/@' + opData.receiver">@{{ opData.receiver }}</router-link>
        </template>

        <template v-else-if="type === 'witness_set_properties'">
          <router-link :to="'/@' + opData.owner" class="text-bold">@{{ opData.owner }}</router-link>
          updated witness properties
        </template>

        <template v-else-if="type === 'effective_comment_vote'">
          <q-avatar size="20px"><q-img :src="avatarUrl(opData.voter)" :alt="'Avatar of @' + opData.voter" /></q-avatar>
          <router-link :to="'/@' + opData.voter" class="text-bold">@{{ opData.voter }}</router-link>
          vote counted on <router-link :to="postLink(opData.author, opData.permlink)">@{{ opData.author }}/{{ opData.permlink }}</router-link>
          <q-badge v-if="opData.pending_payout" color="green" class="block-op__amount">{{ opData.pending_payout }}</q-badge>
        </template>

        <template v-else-if="type === 'limit_order_cancelled'">
          <router-link :to="'/@' + opData.seller" class="text-bold">@{{ opData.seller }}</router-link>
          order <q-badge color="orange">#{{ opData.orderid }}</q-badge> was cancelled
          <span class="block-op__muted">· returned {{ opData.amount_back }}</span>
        </template>

        <template v-else-if="type === 'comment_payout_update'">
          <router-link :to="'/@' + opData.author" class="text-bold">@{{ opData.author }}</router-link>
          post paid out:
          <router-link :to="postLink(opData.author, opData.permlink)">{{ opData.permlink }}</router-link>
        </template>

        <template v-else-if="type === 'comment_benefactor_reward'">
          <router-link :to="'/@' + opData.benefactor" class="text-bold">@{{ opData.benefactor }}</router-link>
          earned a benefactor reward on
          <router-link :to="postLink(opData.author, opData.permlink)">@{{ opData.author }}/{{ opData.permlink }}</router-link>
          <q-badge v-if="opData.hive_payout && opData.hive_payout !== '0.000 HIVE'" color="green">{{ opData.hive_payout }}</q-badge>
          <q-badge v-if="opData.hbd_payout && opData.hbd_payout !== '0.000 HBD'" color="green">{{ opData.hbd_payout }}</q-badge>
          <q-badge v-if="opData.vests_payout && opData.vests_payout !== '0.000000 VESTS'" color="teal">{{ opData.vests_payout }}</q-badge>
        </template>

        <template v-else-if="type === 'return_vesting_delegation'">
          <router-link :to="'/@' + opData.account" class="text-bold">@{{ opData.account }}</router-link>
          received back a delegation of <q-badge color="teal">{{ opData.vesting_shares }}</q-badge>
        </template>

        <template v-else-if="type === 'producer_reward'">
          witness <router-link :to="'/@' + opData.producer" class="text-bold">@{{ opData.producer }}</router-link>
          earned <q-badge color="indigo">{{ opData.vesting_shares }}</q-badge>
        </template>

        <template v-else-if="type === 'fill_convert_request'">
          <router-link :to="'/@' + opData.owner" class="text-bold">@{{ opData.owner }}</router-link>
          converted <q-badge color="orange">{{ opData.amount_in }}</q-badge>
          into <q-badge color="orange">{{ opData.amount_out }}</q-badge>
        </template>

        <template v-else-if="type === 'fill_vesting_withdraw'">
          <router-link :to="'/@' + opData.from_account" class="text-bold">@{{ opData.from_account }}</router-link>
          powered down <q-badge color="orange">{{ opData.withdrawn }}</q-badge>
          <span v-if="opData.to_account && opData.to_account !== opData.from_account">to <router-link :to="'/@' + opData.to_account">@{{ opData.to_account }}</router-link></span>
          <span class="block-op__muted">· received {{ opData.deposited }}</span>
        </template>

        <template v-else-if="type === 'fill_transfer_from_savings'">
          <router-link :to="'/@' + opData.from" class="text-bold">@{{ opData.from }}</router-link>
          sent <q-badge color="teal">{{ opData.amount }}</q-badge>
          from savings to <router-link :to="'/@' + opData.to">@{{ opData.to }}</router-link>
        </template>

        <template v-else-if="type === 'fill_collateralized_convert_request'">
          <router-link :to="'/@' + opData.owner" class="text-bold">@{{ opData.owner }}</router-link>
          converted <q-badge color="orange">{{ opData.amount_in }}</q-badge>
          into <q-badge color="orange">{{ opData.amount_out }}</q-badge>
        </template>

        <template v-else-if="type === 'liquidity_reward'">
          <router-link :to="'/@' + opData.owner" class="text-bold">@{{ opData.owner }}</router-link>
          earned a liquidity reward of <q-badge color="green">{{ opData.payout }}</q-badge>
        </template>

        <template v-else-if="type === 'dhf_funding'">
          the DHF received <q-badge color="purple">{{ opData.additional_funds }}</q-badge>
          into <router-link :to="'/@' + opData.treasury">@{{ opData.treasury }}</router-link>
        </template>

        <template v-else>
          <span class="block-op__muted">{{ humanType }} operation</span>
          <span class="block-op__muted">· open JSON for details</span>
        </template>
      </div>

      <q-btn
        flat
        dense
        round
        size="sm"
        :icon="showJson ? 'code_off' : 'data_object'"
        :aria-label="'Toggle raw JSON for ' + type"
        title="Toggle raw JSON"
        class="block-op__json-toggle"
        @click="showJson = !showJson"
      />
    </div>

    <div v-if="showJson" class="block-op__json">
      <json-viewer :data="opData" :deep="1" :showLength="true" />
    </div>
  </div>
</template>

<script>
import { defineAsyncComponent } from 'vue'
const jsonViewer = defineAsyncComponent(() => import('components/jsonViewer.vue'))

const COLORS = {
  vote: 'green',
  effective_comment_vote: 'green',
  comment: 'cyan',
  comment_payout_update: 'green',
  comment_benefactor_reward: 'green',
  return_vesting_delegation: 'teal',
  producer_reward: 'indigo',
  fill_convert_request: 'orange',
  fill_vesting_withdraw: 'orange',
  fill_transfer_from_savings: 'teal',
  fill_collateralized_convert_request: 'orange',
  liquidity_reward: 'green',
  dhf_funding: 'purple',
  transfer: 'teal',
  transfer_to_vesting: 'teal',
  withdraw_vesting: 'orange',
  custom_json: 'blue-grey-9',
  claim_reward_balance: 'green',
  account_update: 'red',
  account_update2: 'red',
  account_create: 'light-blue',
  create_claimed_account: 'light-blue',
  limit_order_create: 'orange',
  limit_order_cancel: 'orange',
  limit_order_cancelled: 'orange',
  fill_order: 'orange',
  convert: 'orange',
  collateralized_convert: 'orange',
  feed_publish: 'purple',
  comment_options: 'blue-grey-9',
  delegate_vesting_shares: 'teal',
  account_witness_vote: 'green',
  account_witness_proxy: 'indigo',
  transfer_to_savings: 'teal',
  transfer_from_savings: 'teal',
  interest: 'green',
  author_reward: 'green',
  curation_reward: 'green',
  comment_reward: 'green',
  create_proposal: 'purple',
  update_proposal_votes: 'purple',
  proposal_pay: 'green',
  witness_set_properties: 'deep-purple'
}

export default {
  name: 'block-operation',
  components: { jsonViewer },
  props: {
    operation: { type: Object, required: true },
    virtual: { type: Boolean, default: false }
  },
  data () {
    return { showJson: false }
  },
  computed: {
    type () {
      return this.operation?.op?.[0] || 'operation'
    },
    opData () {
      return this.operation?.op?.[1] || {}
    },
    opColor () {
      return COLORS[this.type] || 'grey'
    },
    humanType () {
      return this.type.replace(/_/g, ' ')
    },
    firstAuth () {
      return this.opData?.required_posting_auths?.[0] || this.opData?.required_auths?.[0] || null
    }
  },
  methods: {
    avatarUrl (user) {
      return 'https://images.hive.blog/u/' + user + '/avatar'
    },
    postLink (author, permlink) {
      return '/@' + author + '/' + permlink
    }
  }
}
</script>

<style scoped>
.block-op {
  padding: 0.55rem 0;
  border-top: 1px solid var(--border-subtle);
}

.block-op:first-child {
  border-top: 0;
}

.block-op--virtual {
  padding-left: 0.5rem;
  border-left: 2px solid rgba(38, 166, 154, 0.35);
}

.block-op__row {
  display: flex;
  align-items: flex-start;
  gap: 0.55rem;
  min-width: 0;
}

.block-op__type {
  flex: none;
  max-width: 11rem;
  overflow: hidden;
  text-overflow: ellipsis;
  font-family: monospace;
  font-size: 0.68rem;
}

.block-op__weight,
.block-op__amount {
  font-family: monospace;
  font-size: 0.7rem;
}

.block-op__summary {
  flex: 1;
  min-width: 0;
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 0.25rem 0.35rem;
  line-height: 1.45;
  color: #cfd8dc;
  font-size: 0.86rem;
}

.block-op__summary a {
  font-weight: 500;
}

.block-op__muted {
  color: #90a4ae;
}

.block-op__json-toggle {
  flex: none;
  color: #90a4ae;
}

.block-op__json {
  margin: 0.5rem 0 0.25rem 0.5rem;
  padding: 0.5rem;
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-sm);
  background: rgba(0, 0, 0, 0.18);
  overflow-x: auto;
}

@media (max-width: 599px) {
  .block-op__row {
    gap: 0.35rem;
  }

  .block-op__type {
    max-width: 6.5rem;
    font-size: 0.62rem;
  }

  .block-op__summary {
    font-size: 0.8rem;
  }
}
</style>
