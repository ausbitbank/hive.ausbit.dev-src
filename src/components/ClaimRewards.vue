<template>
  <q-btn label="Claim Rewards" dense rounded color="secondary" @click="dialog = true; claimRewardsKeychain()">
    <q-dialog v-model="dialog">
      <q-card class="q-pa-md justify">
        <div class="text-h5">Claiming Rewards</div>
        <q-spinner-pie color="secondary" v-if="loading" size="lg" />
      </q-card>
    </q-dialog>
  </q-btn>
</template>

<script>
export default {
  name: 'ClaimRewards',
  props: ['A'],
  data () {
    return {
      dialog: false,
      loading: true,
      username: this.A.name
    }
  },
  methods: {
    claimRewardsKeychain () {
      this.loading = true
      var claimjson = { account: this.username, reward_steem: this.A.reward_steem_balance, reward_sbd: this.A.reward_sbd_balance, reward_vests: this.A.reward_vesting_balance }
      window.hive_keychain.requestCustomJson(this.username, 'claim_reward_balance', 'Posting', claimjson, 'Claim rewards', function (err, response) {
        if (err) { this.ClaimRewardsFail(err) }
        this.loading = false
        this.dialog = false
      }.bind(this))
    }
  }
}
</script>
