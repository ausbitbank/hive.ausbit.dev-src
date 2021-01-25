<template>
  <q-btn label="Transfer" dense rounded color="secondary" @click="dialog = true">
    <q-dialog v-model="dialog">
      <q-card class="q-pa-md justify">
        <div class="text-h5">Transfer Funds</div>
        <div class="row">
          <div>
            <q-btn-toggle v-model="transferType" :options="[{label: 'Hive', value: 'HIVE'}, {label: 'HBD', value: 'HBD'}]" rounded unelevated glossy toggle-color="secondary" />
            <q-input v-model="transferTo" label="Receiving Account" :rules="[val => !!val || 'Account is required']" />
            <q-input v-model.number="transferAmount" type="number" filled label="Amount" :rules="[val => !!val || 'Amount is required']" />
            <div><span class="text-bold" @click="transferAmount = available">{{ available }}</span> {{ transferType }} available</div>
            <q-input v-model="transferMemo" label="Memo" />
          </div>
        </div>
        <q-btn label="Transfer" color="secondary" @click="transferKeychain()" />
      </q-card>
    </q-dialog>
  </q-btn>
</template>

<script>
export default {
  name: 'Transfer',
  props: ['A'],
  data () {
    return {
      dialog: false,
      loading: false,
      username: this.A.name,
      transferTo: '',
      transferAmount: 0,
      transferMemo: '',
      transferType: 'HIVE',
      transferTypeOptions: ['HIVE', 'HBD']
    }
  },
  computed: {
    availableHive: function () {
      return this.A.balance.split(' ')[0]
    },
    availableHbd: function () {
      return this.A.hbd_balance.split(' ')[0]
    },
    available: function () {
      if (this.transferType === 'HIVE') {
        return this.availableHive
      } else {
        return this.availableHbd
      }
    }
  },
  methods: {
    transferKeychain () {
      this.loading = true
      window.hive_keychain.requestTransfer(this.username, this.transferTo, this.transferAmount.toFixed(3), this.transferMemo, this.transferType, function (err, response) {
        this.loading = false; this.dialog = false
        if (err) { console.log(err) }
      }.bind(this))
    }
  }
}
</script>
