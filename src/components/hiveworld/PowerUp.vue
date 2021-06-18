<template>
  <q-btn label="Power Up" dense rounded color="secondary" @click="dialog = true">
    <q-dialog v-model="dialog">
      <q-card class="q-pa-md justify">
        <div class="text-h5">Power Up</div>
        <div class="row">
          <div>
            <q-input v-model="transferTo" label="Receiving Account" />
            <q-input v-model.number="transferAmount" type="number" filled label="Amount" />
            <div><span class="text-bold" @click="transferAmount = availableHive">{{ availableHive }}</span> HIVE available</div>
          </div>
        </div>
        <q-btn label="Power Up" color="secondary" @click="powerUpKeychain()" />
        <q-spinner-pie color="secondary" v-if="loading" size="lg" />
      </q-card>
    </q-dialog>
  </q-btn>
</template>

<script>
export default {
  name: 'PowerUp',
  props: ['A'],
  data () {
    return {
      dialog: false,
      loading: false,
      username: this.A.name,
      transferTo: this.A.name,
      transferAmount: 0.000
    }
  },
  computed: {
    availableHive: function () {
      return this.A.balance.split(' ')[0]
    }
  },
  methods: {
    powerUpKeychain () {
      this.loading = true
      window.hive_keychain.requestPowerUp(this.username, this.transferTo, parseFloat(this.transferAmount).toFixed(3), function (err, response) {
        this.loading = false; this.dialog = false
        if (err) { console.log(err) }
      }.bind(this))
    }
  }
}
</script>
