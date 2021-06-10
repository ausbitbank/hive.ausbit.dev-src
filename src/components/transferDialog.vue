<template>
  <q-card flat bordered style="min-width: 100px; max-width: 95%" v-if="this.$store.state.hive.accounts[this.username] !== undefined">
    <q-card-section header>
      <h4 class="text-center text-bold q-ma-none">Transfer {{ tokenName }}</h4>
    </q-card-section>
    <q-card-section>
      <user-search-box :username="toAccount" @selectUsername="setUsername" label="To account" />
      <div v-if="false"><q-input label="To account" v-model="toAccount" /></div>
      <q-btn dense flat label="To Exchange" color="primary" icon="shortcut" v-if="toAccount === '' && network === 'hive'">
        <q-popup-proxy>
          <q-card flat bordered>
            <q-card-section header class="text-bold text-center">
              Common Exchange Accounts
            </q-card-section>
            <q-btn flat v-for="ea in exchanges" :key="ea.index" :label="ea" color="primary" @click="setUsername(ea)" v-close-popup />
          </q-card>
        </q-popup-proxy>
      </q-btn>
      <div><q-input label="Amount" v-model="amount" /></div>
      <div class="text-center text-caption" v-if="balance">Available: <span class="cursor-pointer text-bold" @click="amount = parseFloat(balance)">{{ balance }}</span> {{ tokenName }}</div>
      <div class="text-center text-caption" v-else-if="availableBalance">Available: <span class="cursor-pointer text-bold" @click="amount = parseFloat(availableBalance)">{{ availableBalance }}</span> {{ tokenName }}</div>
      <div><q-input label="Memo" autogrow v-model="memo" debounce="400" @input="checkEncryption()" /><q-checkbox v-model="encrypted" @input="toggleEncryption()" label="Encrypt Memo" /></div>
      <div class="text-center q-ma-md">
        <div v-if="log !== ''"><q-icon name="error" color="red" v-if="err" />{{ this.log }}</div>
        <q-btn dense label="Send" icon="send" color="primary" @click="transfer()" v-if="!sent" />
      </div>
    </q-card-section>
  </q-card>
</template>
<script>
import userSearchBox from 'components/userSearchBox.vue'
export default {
  name: 'transferDialog',
  data () {
    return {
      toAccount: this.to,
      amount: 0.000,
      memo: '',
      err: false,
      log: '',
      sent: false,
      encrypted: false,
      exchanges: ['deepcrypto8', 'bittrex', 'ionomy', 'huobi-pro']
    }
  },
  props: {
    tokenName: {
      type: String,
      required: true
    },
    network: {
      type: String,
      required: false,
      default: 'hive'
    },
    balance: {
      type: Number,
      required: false,
      default: null
    },
    username: {
      type: String,
      required: true
    },
    precision: {
      type: Number,
      required: false,
      default: 3
    },
    to: {
      type: String,
      required: false,
      default: ''
    }
  },
  components: { userSearchBox },
  computed: {
    availableBalance: function () {
      if (this.network === 'hive' && this.tokenName === 'HIVE') {
        return this.$store.state.hive.accounts[this.username].balance.split(' ')[0]
      } else if (this.network === 'hive' && this.tokenName === 'HBD') {
        return this.$store.state.hive.accounts[this.username].hbd_balance.split(' ')[0]
      } else {
        return null
      }
    }
  },
  methods: {
    setUsername (u) {
      this.toAccount = u
    },
    checkEncryption () {
      if (this.memo.startsWith('#')) {
        this.encrypted = true
      } else {
        this.encrypted = false
      }
    },
    toggleEncryption () {
      if (this.memo.startsWith('#')) {
        this.memo = this.memo.slice(1)
      } else {
        this.memo = '#' + this.memo
      }
    },
    transfer () {
      if (this.network === 'hive') {
        this.transferHive()
      } else if (this.network === 'hiveEngine') {
        this.transferHiveEngineKeychain()
      }
    },
    transferHive () {
      this.$store.commit('hive/addToQueue', [this.username, 'active', ['transfer', { to: this.toAccount, from: this.username, amount: parseFloat(this.amount).toFixed(this.precision) + ' ' + this.tokenName, memo: this.memo }]])
    },
    transferHiveKeychain () {
      console.log(this.username, this.toAccount, this.toAccount, parseFloat(this.amount).toFixed(this.precision), this.memo, this.tokenName)
      window.hive_keychain.requestTransfer(this.username, this.toAccount, parseFloat(this.amount).toFixed(this.precision), this.memo, this.tokenName, function (response, err) {
        if (response.success === true) {
          this.err = false
          this.sent = true
          this.log = response.message
        }
        if (response.success === false) {
          this.err = true
          this.log = response.message
        }
      }.bind(this))
    },
    transferHiveEngineKeychain () {
      var json = '{ "contractName": "tokens", "contractAction": "transfer", "contractPayload": { "symbol": "' + this.tokenName + '", "to": "' + this.toAccount + '", "quantity": "' + this.amount + '", "memo": "' + this.memo + '" } }'
      window.hive_keychain.requestCustomJson(this.username, 'ssc-mainnet-hive', 'Active', json, 'Transfer ' + this.amount + ' ' + this.tokenName + ' to ' + this.toAccount, function (response) {
        if (response.success === true) {
          this.err = false
          this.sent = true
          this.log = response.message
        } else {
          this.err = true
          this.log = response.message
        }
      }.bind(this))
    }
  },
  mounted () {
    if (this.$store.state.hive.accounts[this.username] === undefined) {
      this.$store.dispatch('hive/getAccount', this.username)
    }
  }
}
</script>
