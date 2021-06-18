<template>
  <q-btn label="Stop Power Down" dense rounded color="secondary" @click="dialog = true">
    <q-dialog v-model="dialog">
      <q-card class="q-pa-md justify">
        <div class="text-h5">Stop Power Down</div>
        <div>This will cancel your current powerdown</div>
        <q-btn label="Stop Power Down" icon="warning" color="red" @click="stopPowerDownKeychain()" />
        <q-spinner-pie color="secondary" v-if="loading" size="lg" />
      </q-card>
    </q-dialog>
  </q-btn>
</template>

<script>
export default {
  name: 'StopPowerDown',
  props: ['A', 'globalPropsHive'],
  data () {
    return {
      dialog: false,
      loading: false,
      username: this.A.name,
      transferAmount: 0.000
    }
  },
  computed: {
  },
  methods: {
    stopPowerDownKeychain () {
      this.loading = true
      window.hive_keychain.requestPowerDown(this.username, 0.000, function (err, response) {
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
