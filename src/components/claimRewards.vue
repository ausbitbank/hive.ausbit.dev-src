<template>
  <q-btn push label="Claim" color="primary" :disable="queued" @click="dialog = true; claimRewards()">
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
      queued: false,
      username: this.A.name
    }
  },
  methods: {
    claimRewards () {
      if (this.queued) return
      this.queued = true
      var claimjson = { account: this.username, reward_hive: this.A.reward_hive_balance, reward_hbd: this.A.reward_hbd_balance, reward_vests: this.A.reward_vesting_balance }
      this.$hiveStore.addToQueue([this.username, 'posting', ['claim_reward_balance', claimjson]])
      this.loading = false
      this.dialog = false
      setTimeout(() => { this.queued = false }, 1500)
    }
  }
}
</script>
