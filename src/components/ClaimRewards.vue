<template>
  <q-btn flat label="Claim Rewards" icon="redeem" color="primary" @click="dialog = true; claimRewards()">
    <q-dialog v-model="dialog">
      <q-card class="justify">
        Claiming Rewards
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
      username: this.A.name
    }
  },
  methods: {
    claimRewards () {
      var claimjson = { account: this.username, reward_hive: this.A.reward_hive_balance, reward_hbd: this.A.reward_hbd_balance, reward_vests: this.A.reward_vesting_balance }
      this.$store.commit('hive/addToQueue', [this.username, 'posting', ['claim_reward_balance', claimjson]])
      this.loading = false
      this.dialog = false
    }
  }
}
</script>
