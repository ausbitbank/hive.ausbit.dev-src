<template>
  <q-btn label="Power Down" dense rounded color="secondary" @click="dialog = true">
    <q-dialog v-model="dialog">
      <q-card class="q-pa-md justify">
        <div class="text-h5">Power Down</div>
        <div class="row">
          <div>
            <q-input v-model.number="transferAmount" type="number" filled label="Amount" />
            <div><span class="text-bold" @click="transferAmount = availableHP">{{ availableHP }}</span> HP available</div>
          </div>
        </div>
        <q-btn label="Power Down" color="secondary" @click="powerDownKeychain()" />
        <q-spinner-pie color="secondary" v-if="loading" size="lg" />
      </q-card>
    </q-dialog>
  </q-btn>
</template>

<script>
export default {
  name: 'PowerUp',
  props: ['A', 'globalPropsHive'],
  data () {
    return {
      dialog: false,
      loading: false,
      username: this.A.name,
      transferAmount: 0
    }
  },
  computed: {
    availableHP: function () {
      return this.mvestsToHP(this.A.vesting_shares.split(' ')[0])
    },
    hivePerMvests: function () {
      if (this.globalPropsHive !== null) {
        if (this.globalPropsHive.total_vesting_shares) { return (this.globalPropsHive.total_vesting_fund_steem.split(' ')[0] / (this.globalPropsHive.total_vesting_shares.split(' ')[0] / 1e6)) } else { return 509.6451627091090586 }
      } else {
        return 509.6451627091090586
      }
    }
  },
  methods: {
    powerDownKeychain () {
      this.loading = true
      window.hive_keychain.requestPowerDown(this.username, parseFloat(this.transferAmount).toFixed(3), function (err, response) {
        this.loading = false; this.dialog = false
        if (err) { console.log(err) }
      }.bind(this))
    },
    mvestsToHP (v) {
      return ((v * this.hivePerMvests) / 1000000).toFixed(3)
    }
  }
}
</script>
