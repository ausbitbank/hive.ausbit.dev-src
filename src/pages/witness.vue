<template>
  <q-page class="flex q-pa-md flex">
    <div class="column" style="margin-left: auto; margin-right: auto;">
      <q-card class="q-pa-md q-ma-md">
        <q-card-section v-if="!loggedInUser">
          Login (top right) to update witness properties
        </q-card-section>
        <q-card-section v-if="loggedInUser && !witness">
          The currently logged in user ({{ loggedInUser }}) is not a witness.<br />
          Login to a witness account to update or <br />
          <q-btn color="primary" icon="refresh" label="Click to refresh witness properties" @click="getAccount(loggedInUser); getWitness(loggedInUser)" />
        </q-card-section>
        <q-card-section v-if="loggedInUser && witness">
          <div class="text-center text-title text-h6">Update Witness Properties for {{ loggedInUser }}</div>
          <q-list dense>
            <q-item v-for="prop in ['account_creation_fee']" :key="prop.index">
              <q-item-section side class="text-bold">{{ prop }}</q-item-section>
              <q-item-section class="text-right wrap"><q-input outlined v-model="witness.props[prop]" /></q-item-section>
            </q-item>
            <q-item v-for="prop in ['maximum_block_size', 'hbd_interest_rate', 'account_subsidy_budget', 'account_subsidy_decay']" :key="prop.index">
              <q-item-section side class="text-bold">{{ prop }}</q-item-section>
              <q-item-section class="text-right wrap"><q-input outlined v-model.number="witness.props[prop]" /></q-item-section>
            </q-item>
            <q-item v-for="prop in ['signing_key', 'url']" :key="prop.index">
              <q-item-section side class="text-bold">{{ prop }}</q-item-section>
              <q-item-section class="text-right wrap"><q-input outlined v-model="witness[prop]" /></q-item-section>
            </q-item>
          </q-list>
          <div class="text-center q-ma-md"><q-btn icon="refresh" label="refresh witness properties" color="primary" /></div>
          <q-separator />
          <div>
            <div class="text-h6 text-center">Update properties with cli_wallet:</div>
            <p>You can update your witness properties using cli_wallet with the following command</p>
            <q-input readonly outlined autogrow type="text" v-model="cliWalletLine" />
            <div class="text-center q-ma-md"><q-btn dense class="hvr" label="Copy cli_wallet command to clipboard" icon="content_copy" color="blue-grey" glossy @click="copy(cliWalletLine)"/></div>
          </div>
          <q-separator />
          <div>
            <div class="text-h6 text-center">Broadcast update with this site:</div>
            <p>You'll need your active key to send this transaction. Be sure you have the right settings below - especially your signing key</p>
            <jsonViewer :data="witnessUpdateJson"/>
            <div class="text-center q-ma-md"><q-btn label="Update witness properties" color="red" @click="witnessUpdate()" icon="dangerous" /></div>
          </div>
        </q-card-section>
      </q-card>
    </div>
    <witnesses />
  </q-page>
</template>
<script>
import witnesses from 'components/witnesses.vue'
import { copyToClipboard } from 'quasar'
import jsonViewer from 'components/jsonViewer.vue'
export default {
  name: 'witness',
  components: { witnesses, jsonViewer },
  data () {
    return {
      witness: null
    }
  },
  computed: {
    loggedInUser: {
      get () { return this.$store.state.hive.user.username }
    },
    account: {
      cache: false,
      get () {
        if (this.loggedInUser) {
          return this.$store.state.hive.accounts[this.loggedInUser]
        } else {
          return null
        }
      }
    },
    cliWalletLine: {
      get () {
        var cli = 'update_witness "' + this.loggedInUser + '" "' + this.witness.url + '" "' + this.witness.signing_key + '" {"account_creation_fee": "' + this.witness.props.account_creation_fee + '","maximum_block_size":' + this.witness.props.maximum_block_size + ', "hbd_interest_rate":' + this.witness.props.hbd_interest_rate + ',"account_subsidy_budget":' + this.witness.props.account_subsidy_budget + ',"account_subsidy_decay":' + this.witness.props.account_subsidy_decay + '} true'
        return cli
      }
    },
    witnessUpdateJson: {
      get () {
        var json = {
          owner: this.loggedInUser,
          url: this.witness.url,
          block_signing_key: this.witness.signing_key,
          props: {
            account_creation_fee: this.witness.props.account_creation_fee,
            maximum_block_size: this.witness.props.maximum_block_size,
            hbd_interest_rate: this.witness.props.hbd_interest_rate,
            account_subsidy_budget: this.witness.props.account_subsidy_budget,
            account_subsidy_decay: this.witness.props.account_subsidy_decay
          },
          fee: '0.000 HIVE'
        }
        return json
      }
    }
  },
  methods: {
    getAccount (username) {
      if (this.$store.state.hive.accounts[username] === undefined) {
        this.$store.dispatch('hive/getAccount', this.username)
      }
    },
    getWitness (username) {
      this.$hive.api.getWitnessByAccountAsync(username)
        .then((response) => {
          this.witness = response
        })
        .catch(() => console.log('Failed to load witness data'))
    },
    copy (input) {
      copyToClipboard(input)
      this.$q.notify('Copied to clipboard: ' + input)
    },
    witnessUpdate () {
      this.$store.commit('hive/addToQueue', [this.loggedInUser, 'active', ['witness_update', this.witnessUpdateJson]])
    }
  },
  mounted () {
    document.title = 'Witness Tools'
    if (this.loggedInUser) {
      this.getAccount(this.loggedInUser)
      this.getWitness(this.loggedInUser)
    }
  }
}
</script>
