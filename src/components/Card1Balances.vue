<template>
  <div>
    <div>
      <span class="text-bold q-pa-md">
        Reward Balance
      </span>
      <span class="q-pa-md">
        {{ A.reward_hive_balance }}
      </span>
      <span class="q-pa-md">
        {{ A.reward_hbd_balance }}
      </span>
      <span class="q-pa-md">
        {{ A.reward_vesting_hive }}
      </span>
      <claim-rewards :A="A" />
    </div>
    <div>
      <span class="text-bold q-pa-md">
        Account Balance
      </span>
      <span class="q-pa-md">
        {{ A.balance }}
      </span>
      <span class="q-pa-md">
        {{ A.sbd_balance }}
      </span>
      <transfer :A="A" />
    </div>
    <div>
      <span class="text-bold q-pa-md">
        Savings Balance
      </span>
      <span class="q-pa-md">
        {{ A.savings_balance }}
      </span>
      <span class="q-pa-md">
        {{ A.savings_sbd_balance }}
      </span>
      <move-to-savings :A="A" />
    </div>
    <div>
      <span class="text-bold q-pa-md">
        Vesting Balance
      </span>
      <span class="q-pa-md">
        {{ A.vesting_balance }}
      </span>
      <q-btn label="Withdraw Savings" dense rounded disable color="secondary" />
    </div>
    <div>
      <span class="text-bold q-pa-md">
        Vesting Shares
      </span>
      <span class="q-pa-md">
        {{ mvestsToHP(A.vesting_shares.split(' ')[0]) }} HIVE
      </span>
      <span class="q-pa-md">
        {{ A.vesting_shares }}
      </span>
      <power-up :A="A" />
    </div>
    <div>
      <span class="text-bold q-pa-md">
        Received Vesting Shares
      </span>
      <span class="q-pa-md">
        {{ mvestsToHP(A.received_vesting_shares.split(' ')[0]) }} HIVE
      </span>
      <span class="q-pa-md">
        {{ A.received_vesting_shares.split(' ')[0] / 1e6 }} MVests
      </span>
      <power-down :A="A" :globalPropsHive="globalPropsHive" />
    </div>
    <div>
      <span class="text-bold q-pa-md">
        Delegated Vesting Shares
      </span>
      <span class="q-pa-md">
        {{ mvestsToHP(A.delegated_vesting_shares.split(' ')[0])}} HIVE
      </span>
      <span class="q-pa-md">
        {{ A.delegated_vesting_shares }}
      </span>
      <stop-power-down :A="A" :globalPropsHive="globalPropsHive" />
    </div>
    <div>
      <span class="text-bold q-pa-md">
        To Withdraw
      </span>
      <span class="q-pa-md">
        {{ vestsToHP(A.to_withdraw) }} HIVE
      </span>
      <span class="q-pa-md">
        {{ A.to_withdraw }} VESTS
      </span>
      <outgoing-routes :A="A" :globalPropsHive="globalPropsHive" />
    </div>
    <div>
      <span class="text-bold q-pa-md">
        Withdrawn
      </span>
      <span class="q-pa-md">
        {{ vestsToHP(A.withdrawn) }} HIVE
      </span>
      <span class="q-pa-md">
        {{ A.withdrawn }} VESTS
      </span>
      <q-btn label="Incoming Routes" disable />
    </div>
    <div>
      <span class="text-bold q-pa-md">
        Vesting Withdraw Rate
      </span>
      <span class="q-pa-md">
        {{ mvestsToHP(A.vesting_withdraw_rate.split(' ')[0]) }} HIVE per week
      </span>
      <span class="q-pa-md">
        {{ A.vesting_withdraw_rate }}
      </span>
      <q-btn label="Convert SBD" disable />
    </div>
    <div>
      <span class="text-bold q-pa-md">
        Next Vesting Withdrawal
      </span>
      <span class="q-pa-md">
        {{ A.next_vesting_withdrawal }}
      </span>
      <span class="q-pa-md">
        {{ timeDelta(A.next_vesting_withdrawal) }}
      </span>
    </div>
  </div>
</template>

<script>
import moment from 'moment'
import claimRewards from 'components/claimRewards.vue'
import transfer from 'components/Transfer.vue'
import moveToSavings from 'components/MoveToSavings.vue'
import powerUp from 'components/PowerUp.vue'
import powerDown from 'components/PowerDown.vue'
import stopPowerDown from 'components/StopPowerDown.vue'
import outgoingRoutes from 'components/outgoingRoutes.vue'
export default {
  name: 'Card1Balances',
  props: ['A', 'globalPropsHive'],
  data () {
    return {
    }
  },
  components: {
    claimRewards: claimRewards,
    transfer: transfer,
    moveToSavings: moveToSavings,
    powerUp: powerUp,
    powerDown: powerDown,
    stopPowerDown: stopPowerDown,
    outgoingRoutes: outgoingRoutes
  },
  computed: {
    hivePerMvests: function () {
      if (this.globalPropsHive !== null) {
        if (this.globalPropsHive.total_vesting_shares) { return (this.globalPropsHive.total_vesting_fund_hive.split(' ')[0] / (this.globalPropsHive.total_vesting_shares.split(' ')[0] / 1e6)) } else { return 509.6451627091090586 }
      } else {
        return 509.6451627091090586
      }
    }
  },
  methods: {
    vestsToHP (v) {
      return ((v * this.hivePerMvests) / 1000000000000).toFixed(3)
    },
    mvestsToHP (v) {
      return ((v * this.hivePerMvests) / 1000000).toFixed(3)
    },
    timeDelta (timestamp) {
      var now = moment.utc()
      var stamp = moment.utc(timestamp)
      var diff = stamp.diff(now, 'minutes')
      return moment.duration(diff, 'minutes').humanize(true)
    }
  }
}
</script>
