<template>
  <q-card flat bordered style="min-width: 100px; max-width: 95%" v-if="this.$store.state.hive.accounts[this.username] !== undefined" class="text-center">
    <q-card-section header>
      <h4 class="text-center text-bold q-ma-none">Transfer {{ tokenName }}</h4>
    </q-card-section>
    <q-card-section >
      <user-search-box :username="toAccount" @selectUsername="setUsername" label="To account" style="margin: auto" />
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
      <div><q-input label="Amount" v-model="amount" style="margin: auto; max-width: 200px" /></div>
      <div class="text-center text-caption" v-if="balance">Available: <span class="cursor-pointer text-bold text-primary" @click="amount = parseFloat(balance)">{{ balance }}</span> {{ tokenName }}</div>
      <div class="text-center text-caption" v-else-if="availableBalance">Available: <span class="cursor-pointer text-bold text-primary" @click="amount = parseFloat(availableBalance)">{{ availableBalance }}</span> {{ tokenName }}</div>
      <q-input label="Memo" autogrow v-model="memo" debounce="400" @input="checkEncryption()" style="margin: auto; max-width: 200px" /><q-checkbox v-model="encrypted" @input="toggleEncryption()" label="Encrypt Memo" />
      <div v-if="network === 'hive'">
        <q-toggle v-model="recurrent" label="Recurring Payments" />
        <div v-if="recurrent" class="shadow-5 q-pa-sm">
          <div>
            <q-input label="Hours between payments" v-model.number="recurrentHours" style="margin: auto; max-width: 200px" />
            <q-btn-toggle no-caps rounded v-model="recurrentHours" toggle-color="primary" :options="[ { label: 'Daily', value: 24 },  {label: 'Weekly', value: 168 }, { label: 'Monthly', value: 720 }]" />
          </div>
          <q-input label="Repeat payments" v-model.number="recurrentTimes" style="margin: auto; max-width: 200px" />
          <div class="text-center">
            <q-icon name="info" color="info" size="sm" /><br />
            Will send <b class="text-primary">{{ amount }}</b> {{tokenName }} to <b class="text-primary">{{ toAccount }}</b> immediately,<br />
            repeating every <b class="text-primary">{{ recurrentHours }}</b> hours , <b class="text-primary">{{ recurrentTimes }}</b> times<br />
            For a total cost of <b class="text-primary">{{ amount * recurrentTimes }}</b> {{ tokenName }}
          </div>
          <div v-if="recurrent && exchanges.includes(toAccount)" class="text-center text-red text-bold">
            <q-icon name="warning" color="red" size="md" /><br />
            No exchanges support recurrent transfers (yet) <br />
            Don't do it !
          </div>
        </div>
      </div>
      <div v-if="exchanges.includes(toAccount) && memo === ''" class="text-center text-red shadow-5 q-pa-sm">
        <q-icon name="warning" color="red" />
        You must enter a memo to deposit to exchanges
      </div>
      <div class="text-center q-ma-md">
        <div v-if="log !== ''"><q-icon name="error" color="red" v-if="err" />{{ this.log }}</div>
        <q-btn dense label="Send" icon="send" color="primary" @click="doTheThing()" v-if="!sent" v-close-popup :disable="disableSendButton" />
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
      recurrent: false,
      recurrentHours: 24,
      recurrentTimes: 30,
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
    },
    disableSendButton: function () {
      if (this.toAccount === '') { return true }
      if (this.recurrent && this.exchanges.includes(this.toAccount)) { return true }
      if (!this.recurrent && this.amount === 0) { return true }
      if (this.exchanges.includes(this.toAccount) && this.memo === '') { return true }
      return false
    }
  },
  methods: {
    doTheThing () {
      if (this.recurrent && this.network === 'hive') {
        this.recurrentTransfer()
      } else {
        this.transfer()
      }
    },
    setUsername (u) { this.toAccount = u },
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
    recurrentTransfer () {
      this.$store.commit('hive/addToQueue', [this.username, 'active', ['recurrent_transfer', { to: this.toAccount, from: this.username, amount: parseFloat(this.amount).toFixed(this.precision) + ' ' + this.tokenName, memo: this.memo, recurrence: this.recurrentHours, executions: this.recurrentTimes }]])
    },
    transfer () {
      if (this.network === 'hive') {
        this.transferHive()
      } else if (this.network === 'hiveEngine') {
        this.transferHiveEngine()
      }
    },
    transferHive () {
      this.$store.commit('hive/addToQueue', [this.username, 'active', ['transfer', { to: this.toAccount, from: this.username, amount: parseFloat(this.amount).toFixed(this.precision) + ' ' + this.tokenName, memo: this.memo }]])
    },
    transferHiveEngine () {
      var j = '{ "contractName": "tokens", "contractAction": "transfer", "contractPayload": { "symbol": "' + this.tokenName + '", "to": "' + this.toAccount + '", "quantity": "' + this.amount + '", "memo": "' + this.memo + '" } }'
      var cj = {
        required_auths: [this.username],
        required_posting_auths: [],
        id: 'ssc-mainnet-hive',
        json: j
      }
      this.$store.commit('hive/addToQueue', [this.username, 'active', ['custom_json', cj]])
    }
  },
  mounted () {
    if (this.$store.state.hive.accounts[this.username] === undefined) {
      this.$store.dispatch('hive/getAccount', this.username)
    }
  }
}
</script>
