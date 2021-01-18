<template>
  <q-btn label="Claim Rewards" icon="redeem" v-if="!submitted" dense rounded color="primary" @click="dialog = true; claimRewardsKeychain()">
    <q-dialog v-model="dialog">
      <q-card class="q-pa-md justify">
        <div class="text-h5">Claiming Rewards</div>
        <q-spinner-pie color="primary" v-if="loading" size="sm" />
      </q-card>
    </q-dialog>
  </q-btn>
</template>

<script>
export default {
  name: 'claimRewards',
  props: ['A'],
  data () {
    return {
      dialog: false,
      loading: true,
      submitted: false,
      username: this.A.name
    }
  },
  methods: {
    claimRewardsKeychain () {
      this.loading = true
      var claimjson = { account: this.username, reward_hive: this.A.reward_hive_balance, reward_hbd: this.A.reward_hbd_balance, reward_vests: this.A.reward_vesting_balance }
      console.log(claimjson)
      var operations = [['claim_reward_balance', claimjson]]
      window.hive_keychain.requestBroadcast(this.username, operations, 'posting', function (response) {
        this.loading = false
        this.dialog = false
        this.submitted = true
      }.bind(this))
    }
  }
}
</script>
