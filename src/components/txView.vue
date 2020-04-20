<template>
  <q-item v-if="tx" dense>
    <q-item-section class="row">
      <q-expansion-item dense dense-toggle>
        <template v-slot:header>
          <q-item-section avatar>
            <q-avatar :color="opColor" text-color="white" class="text-subtitle">
              {{ opType.substr(0,1) }}{{ opType.substr(opType.length - 1, opType.length)}}
            </q-avatar>
          </q-item-section>
          <div v-if="opType === 'producer_reward'">
            <q-item-section>
              <q-item-label>
                Producer Reward
              </q-item-label>
            </q-item-section>
            <q-item-label caption lines="1">{{  mvestsToHP(parseFloat(op.vesting_shares.split(' ')[0])) }} HP</q-item-label>
          </div>
          <div v-else-if="opType === 'curation_reward'">
            <q-item-section>
              <q-item-label>
                Curation Reward
              </q-item-label>
            </q-item-section>
            <q-item-label caption lines="1">{{ mvestsToHP(parseFloat(op.reward.split(' ')[0]))}} Hp</q-item-label>
            <q-item-label caption lines="1">{{ op.comment_author }}\{{ op.comment_permlink.substring(0,70) }}...</q-item-label>
          </div>
          <div v-else-if="opType === 'author_reward'">
            <q-item-section>
              <q-item-label>
                Author Reward
              </q-item-label>
            </q-item-section>
            <q-item-label caption>
              {{ op.sbd_payout }} {{ op.steem_payout }} {{ mvestsToHP(parseFloat(op.vesting_payout.split(' ')[0])) }} HP
            </q-item-label>
            <q-item-label caption>
              {{ op.permlink.substring(0,70) }}...
            </q-item-label>
          </div>
          <div v-else-if="opType === 'comment_benefactor_reward'">
            <q-item-section>
              <q-item-label>
                Benefactor Reward
              </q-item-label>
            </q-item-section>
            <q-item-label caption>
              {{ op.sbd_payout }} {{ op.steem_payout }} {{ mvestsToHP(parseFloat(op.vesting_payout.split(' ')[0])) }} HP
            </q-item-label>
            <q-item-label caption>
              @{{ op.author }} / {{ op.permlink.substring(0,70) }}...
            </q-item-label>
          </div>
          <div v-else-if="opType === 'vote' && op.author === username">
            <q-item-section>
              <q-item-label>
                Incoming Vote from {{ op.voter }} ({{ op.weight / 100 }}%)
              </q-item-label>
            </q-item-section>
            <q-item-label caption lines="1">{{ op.permlink }}</q-item-label>
          </div>
          <div v-else-if="opType === 'vote'">
            <q-item-section>
              <q-item-label>
                Outgoing Vote to {{ op.author }} ({{ op.weight / 100}}%)
              </q-item-label>
            </q-item-section>
            <q-item-label caption lines="1">{{ op.permlink.substr(0,70) }}</q-item-label>
          </div>
          <div v-else-if="opType === 'create_claimed_account'">
            <q-item-section>
              <q-item-label>
                Create Claimed Account
              </q-item-label>
            </q-item-section>
            <q-item-label caption lines="1">@{{ op.new_account_name }}</q-item-label>
          </div>
          <div v-else-if="opType === 'delegate_vesting_shares'">
            <q-item-section>
              <q-item-label>
                Delegation to {{ op.delegatee }}
              </q-item-label>
            </q-item-section>
            <q-item-label caption lines="1" v-if="op.vesting_shares === '0.000000 VESTS'">Removed by {{ op.delegator }}</q-item-label>
            <q-item-label caption lines="1" v-else>{{ op.vesting_shares }} from {{ op.delegator }}</q-item-label>
          </div>
          <div v-else-if="opType === 'feed_publish'">
            <q-item-section>
              <q-item-label>
                Feed Publish
              </q-item-label>
            </q-item-section>
            <q-item-label caption lines="1">{{ op.exchange_rate.base }}:{{ op.exchange_rate.quote }}</q-item-label>
          </div>
          <div v-else-if="opType === 'account_update2'">
            <q-item-section>
              <q-item-label>
                Account Profile Update
              </q-item-label>
            </q-item-section>
            <q-item-label caption>{{ op.posting_json_metadata.substring(0,70) }}...</q-item-label>
          </div>
          <div v-else-if="opType === 'claim_account'">
            <q-item-section>
              <q-item-label>
                Claim Account Credit
              </q-item-label>
            </q-item-section>
            <q-item-label caption>Fee {{ op.fee }}</q-item-label>
          </div>
          <div v-else-if="opType === 'fill_transfer_from_savings'">
            <q-item-section>
              <q-item-label>
                Fill Transfer From Savings : {{ op.amount }}
              </q-item-label>
            </q-item-section>
            <q-item-label caption>from {{ op.from }} <span v-if="op.memo">with memo {{ op.memo }}</span></q-item-label>
          </div>
          <div v-else-if="opType === 'comment' && op.parent_author === ''">
            <q-item-section>
              <q-item-label>
                Post
              </q-item-label>
            </q-item-section>
            <q-item-label caption>Title: {{ op.title.substring(0,70) }}...</q-item-label>
            <q-item-label caption>Body: {{ op.body.substring(0,70) }}...</q-item-label>
          </div>
          <div v-else-if="opType === 'comment'">
            <q-item-section>
              <q-item-label>
                Comment to {{ op.parent_author }}
              </q-item-label>
            </q-item-section>
            <q-item-label caption>{{ op.body.substring(0,70) }}...</q-item-label>
            <q-item-label caption>{{ op.parent_permlink.substring(0,70) }}...</q-item-label>
          </div>
          <div v-else-if="opType === 'fill_vesting_withdraw'">
            <q-item-section>
              <q-item-label>
                Fill Vesting Withdraw
              </q-item-label>
            </q-item-section>
            <q-item-label caption lines="1">{{ op.deposited }} from {{ op.from_account }} to {{ op.to_account }}</q-item-label>
          </div>
          <div v-else-if="opType === 'custom_json'">
            <q-item-section>
              <q-item-label>
                Custom JSON
              </q-item-label>
            </q-item-section>
            <q-item-label caption lines="1" v-if="op.id === 'notify' && JSON.parse(op.json)[0] === 'setLastRead'">Marked notifications as read</q-item-label>
            <q-item-label caption lines="1" v-if="op.id === 'follow' && JSON.parse(op.json)[0] === 'reblog'">Reblogged {{ JSON.parse(op.json)[1].author }} / {{ JSON.parse(op.json)[1].permlink.substr(0,70) }}</q-item-label>
            <q-item-label caption lines="1" v-else>ID: {{ op.id }}</q-item-label>
          </div>
          <div v-else-if="opType === 'transfer'">
            <q-item-section>
              <q-item-label>
                Transfer {{ op.amount }} from {{ op.from }} to {{ op.to }}
              </q-item-label>
            </q-item-section>
            <q-item-label caption v-if="op.memo">Memo : {{ op.memo }}</q-item-label>
          </div>
          <div v-else-if="opType === 'transfer_to_vesting'">
            <q-item-section>
              <q-item-label>
                Powered up {{ op.amount }} from {{ op.from }} to {{ op.to }}
              </q-item-label>
            </q-item-section>
            <q-item-label caption lines="1" v-if="op.memo">Memo : {{ op.memo }}</q-item-label>
          </div>
          <div v-else-if="opType === 'claim_reward_balance'">
            <q-item-section>
              <q-item-label>
                Claim Rewards
              </q-item-label>
            </q-item-section>
            <q-item-label caption lines="1">
              <span v-if="op.reward_sbd.split(' ')[0] !== '0.000'">{{ op.reward_sbd }}</span>
              <span v-if="op.reward_steem.split(' ')[0] !== '0.000'">{{ op.reward_steem }}</span>
              <span v-if="op.reward_vests.split(' ')[0] !== '0.000'">{{  mvestsToHP(parseFloat(op.reward_vests.split(' ')[0])) }} HP</span>
            </q-item-label>
          </div>
          <div v-else-if="opType === 'account_witness_vote'">
            <q-item-section>
              <q-item-label v-if="op.approve === true">
                Witness Vote
              </q-item-label>
              <q-item-label v-if="op.approve === false">
                Witness Unvote
              </q-item-label>
            </q-item-section>
            <q-item-label caption lines="1" v-if="op.witness === username">From {{ op.account }}</q-item-label>
            <q-item-label caption lines="1" v-if="op.witness !== username">For {{ op.witness }}</q-item-label>
          </div>
          <div v-else-if="opType === 'update_proposal_votes'">
            <q-item-section>
              <q-item-label v-if="op.approve === true">
                Proposal Vote
              </q-item-label>
              <q-item-label v-if="op.approve === false">
                Proposal Unvote
              </q-item-label>
            </q-item-section>
            <q-item-label caption lines="1">For ID {{ op.proposal_ids.join(',') }}</q-item-label>
          </div>
          <div v-else-if="opType === 'witness_update'">
            <q-item-section>
              <q-item-label>
                Witness Update
              </q-item-label>
            </q-item-section>
            <q-item-label caption>Key {{ op.block_signing_key }}</q-item-label>
            <q-item-label caption>Fee {{ op.fee }}</q-item-label>
            <q-item-label caption>Account Creation Fee {{ op.props.account_creation_fee }}</q-item-label>
            <q-item-label caption>Account Subsidy Budget {{ op.props.account_subsidy_budget }}</q-item-label>
            <q-item-label caption>Account Subsidy Decay {{ op.props.account_subsidy_decay }}</q-item-label>
            <q-item-label caption>Maximum Block Size {{ op.props.maximum_block_size }}</q-item-label>
            <q-item-label caption>HBD Interest Rate {{ op.props.sbd_interest_rate }}</q-item-label>
            <q-item-label caption>Url {{ op.url }}</q-item-label>
          </div>
          <div v-else>
            <q-item-section>
              <q-item-label>
                <q-card>
                  {{ opType }}
                </q-card>
              </q-item-label>
            </q-item-section>
          </div>
          <q-space />
          <q-separator vertical spaced inset />
          <q-item-section side>
            {{ time }}
          </q-item-section>
        </template>
        <q-card bordered dense class="shadow-1">
          <pre>
            {{ syntaxHighlight }}
          </pre>
          <q-card-actions vertical>
            <a :href='hiveBlocks' target="_blank">
              <q-btn label="View on Hiveblocks" color="secondary" />
            </a>
          </q-card-actions>
        </q-card>
      </q-expansion-item>
    </q-item-section>
  </q-item>
</template>
<script>
import moment from 'moment'
export default {
  name: 'txView',
  props: ['tx', 'username', 'globalPropsHive', 'filter'],
  data () {
    return {
    }
  },
  computed: {
    time: function () {
      return moment.utc(this.tx[1].timestamp).format('h:mm:ss a')
    },
    op: function () {
      return this.tx[1].op[1]
    },
    opType: function () {
      return this.tx[1].op[0]
    },
    opColor: function () {
      switch (this.opType) {
        case 'producer_reward':
          return 'green'
        case 'curation_reward':
          return 'green-10'
        case 'author_reward':
          return 'green-13'
        case 'vote':
          return 'blue'
        case 'transfer':
          return 'red-10'
        case 'transfer_to_vesting':
          return 'red-8'
        case 'delegate_vesting_shares':
          return 'red-9'
        case 'claim_reward_balance':
          return 'deep-purple-6'
        case 'account_witness_vote':
          return 'brown'
        case 'account_update2':
          return 'red'
        case 'comment':
          return 'blue-grey-6'
        case 'feed_publish':
          return 'orange'
        case 'return_vesting_delegation':
          return 'red-14'
        case 'fill_vesting_withdraw':
          return 'red-7'
        case 'custom_json':
          return 'indigo-8'
        case 'update_proposal_votes':
          return 'orange-10'
        case 'witness_update':
          return 'pink-9'
        case 'claim_account':
          return 'purple-6'
        case 'fill_transfer_from_savings':
          return 'green-5'
        case 'comment_benefactor_reward':
          return 'pink-8'
        case 'create_claimed_account':
          return 'deep-purple-5'
        default:
          return 'primary'
      }
    },
    hivePerMvests: function () {
      if (this.globalPropsHive !== null) {
        if (this.globalPropsHive.total_vesting_shares) { return (this.globalPropsHive.total_vesting_fund_steem.split(' ')[0] / (this.globalPropsHive.total_vesting_shares.split(' ')[0] / 1e6)) } else { return 509.6451627091090586 }
      } else {
        return 509.6451627091090586
      }
    },
    hiveBlocks: function () {
      return 'https://hiveblocks.com/b/' + this.tx[1].block + '#' + this.tx[1].trx_id
    },
    syntaxHighlight: function () {
      return JSON.stringify(this.tx[1], null, 2)
    }
  },
  methods: {
    mvestsToHP (v) {
      return ((v * this.hivePerMvests) / 1000000).toFixed(3)
    }
  }
}
</script>
