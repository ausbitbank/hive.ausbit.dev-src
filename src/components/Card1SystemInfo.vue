<template>
  <q-card>
    <div>
      <span class="text-bold q-pa-md">
        Total Vesting Fund
      </span>
      <span class="q-pa-md">
        {{ globalPropsHive.total_vesting_fund_steem }}
      </span>
    </div>
    <div>
      <span class="text-bold q-pa-md">
        Total Reward Fund
      </span>
      <span class="q-pa-md">
        {{ globalPropsHive.total_reward_fund_steem }}
      </span>
    </div>
    <div>
      <span class="text-bold q-pa-md">
        Pending Rewards
      </span>
      <span class="q-pa-md">
        {{ globalPropsHive.pending_rewarded_vesting_steem }}
      </span>
      <span class="q-pa-md">
        {{ (globalPropsHive.pending_rewarded_vesting_shares.split(' ')[0] / 1e6).toFixed(2) }} MVests
      </span>
    </div>
    <div>
      <span class="text-bold q-pa-md">
        Total HPS Fund
      </span>
      <span class="q-pa-md">
        HBD
      </span>
      <span class="q-pa-md">
        HBD Daily
      </span>
      <q-btn label="> >" />
    </div>
    <q-separator />
    <div>
      <span class="text-bold q-pa-md">
        Head Block
      </span>
      <span class="q-pa-md">
        {{ globalPropsHive.head_block_number }}
      </span>
      <span class="q-pa-md">
        {{ globalPropsHive.time }}
      </span>
      <span class="q-pa-md">
        {{ globalPropsHive.current_witness }}
      </span>
    </div>
    <div>
      <span class="text-bold q-pa-md">
        Last Irreversible Block
      </span>
      <span class="q-pa-md">
        {{ globalPropsHive.last_irreversible_block_num }}
      </span>
    </div>
    <div>
      <span class="text-bold q-pa-md">
        Maximum Block Size
      </span>
      <span class="q-pa-md">
        {{ globalPropsHive.maximum_block_size }}
      </span>
    </div>
    <q-separator />
    <div>
      <span class="text-bold q-pa-md">
        Account Count
      </span>
      <span class="q-pa-md">
        x
      </span>
      <span class="q-pa-md">
        x
      </span>
    </div>
    <div>
      <span class="text-bold q-pa-md">
        Claimable Per Day
      </span>
      <span class="q-pa-md">
        x
      </span>
    </div>
    <div>
      <span class="text-bold q-pa-md">
        Account Creation Fee
      </span>
      <span>
        x
      </span>
    </div>
    <div>
      <span class="text-bold q-pa-md">
        Reverse Auction Time
      </span>
      <span class="q-pa-md">
        {{ globalPropsHive.reverse_auction_seconds / 60 }} minutes
      </span>
    </div>
    <div>
      <span class="text-bold q-pa-md">
        Delegation Return Time
      </span>
      <span class="q-pa-md">
        {{ globalPropsHive.delegation_return_period / 86400 }} days
      </span>
    </div>
    <div>
      <span class="text-bold q-pa-md">
        Current / Next HF <!-- database api get_hardfork_version , get_next_scheduled_hardfork calls , -->
      </span>
      <span class="q-pa-md">
      </span>
    </div>
  </q-card>
</template>

<script>
export default {
  name: 'Card1SystemInfo',
  props: ['A', 'globalPropsHive', 'hivePerMvests', 'rewardFundPost'],
  data () {
    return {
    }
  },
  methods: {
    vestsToHP (v) {
      return ((v * this.hivePerMvests) / 1000000000000).toFixed(3)
    },
    mvestsToHP (v) {
      return ((v * this.hivePerMvests) / 1000000).toFixed(3)
    }
  }
}
</script>
