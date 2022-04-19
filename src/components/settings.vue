<template>
  <q-card flat bordered class="rounded-corners q-pa-sm">
    <div class="text-h5 text-center">Settings</div>
      <q-list dense>
        <q-item>
          <q-item-label header>
            Background Style
          </q-item-label>
          <q-item-section>
            <q-toggle v-model="darkBackground" :label="getBackgroundLabel()" />
          </q-item-section>
        </q-item>
        <q-item>
          <q-item-label header>
            Default vote %
          </q-item-label>
          <q-item-section>
            <q-slider v-model="voteWeightPost" :min="-100" :max="100" :color="voteColor" label label-always />
          </q-item-section>
        </q-item>
        <q-item v-if="false">
          <q-item-label>
            Comment vote weight
          </q-item-label>
          <q-item-section>
            <q-input v-model.number="voteWeightComment" type="number" />
          </q-item-section>
        </q-item>
        <q-item v-if="true">
          <q-item-label header>
            Default beneficiary
          </q-item-label>
          <div v-for="bene in beneficiaries" :key="bene.index">
            {{ bene.weight / 100 }} % to {{ bene.account }}
            <q-btn title="Edit" icon="edit" color="orange" dense flat>
              <q-popup-proxy>
                <q-card class="q-pa-md">
                {{ bene.account }} : <q-input label="Weight (0-10000)" v-model.number="bene.weight" />
                <q-btn icon="save" color="primary" dense flat @click="editBene(bene.account, bene.weight)" v-close-popup />
                </q-card>
              </q-popup-proxy>
            </q-btn>
            <q-btn title="Remove" icon="delete" color="red" dense flat @click="removeBene(bene.account)"/>
            <q-btn color="green" icon="person_add" dense flat>
              <q-popup-proxy>
                <q-card class="q-pa-md" flat bordered>
                  Add new beneficiary<br />
                  <q-input v-model="newBeneAccount" label="Account" />
                  <q-input v-model.number="newBeneWeight" label="Weight (0-10000)" />
                  <q-btn icon="save" color="primary" dense flat @click="addBene(newBeneAccount, newBeneWeight)" />
                </q-card>
              </q-popup-proxy>
            </q-btn>
          </div>
        </q-item>
        <q-item>
          <q-item-label header>
            Hive Api Node
          </q-item-label>
          <q-input label='Hive Api Node' v-model="apiNode" />
        </q-item>
        <q-item>
          <q-item-label header>
            Hive Account History Node
          </q-item-label>
          <q-input label='Hive Account History Node' v-model="ahNode" />
        </q-item>
        <q-item>
          <q-item-label header>
            Hive-Engine Api Node
          </q-item-label>
          <q-input label='Hive-Engine Api Node' v-model="heApiNode" />
        </q-item>
        <q-item>
            <q-btn label="Save" color="primary" flat icon="save" @click="saveSettings()" style="margin: auto" class="hvr" v-close-popup />
        </q-item>
      </q-list>
  </q-card>
</template>
<script>
export default {
  name: 'settings',
  data () {
    return {
      darkBackground: this.$store.state.hive.user.settings.darkBackground,
      voteWeightPost: this.$store.state.hive.user.settings.voteWeightPost,
      voteWeightComment: this.$store.state.hive.user.settings.voteWeightComment,
      beneficiaries: this.$store.state.hive.user.settings.beneficiary,
      newBeneAccount: '',
      newBeneWeight: 1000,
      apiNode: this.$store.state.hive.user.settings.apiNode || 'https://rpc.ausbit.dev',
      heApiNode: this.$store.state.hive.user.settings.heApiNode || 'https://api.hive-engine.com/rpc',
      ahNode: this.$store.state.hive.user.settings.ahNode || 'https://api.hive.blog'
    }
  },
  computed: {
    account: {
      get () {
        return this.$store.state.hive.accounts[this.author]
      }
    },
    loggedInUser: { get () { return this.$store.state.hive.user.username } },
    voteColor: function () { if (Math.sign(this.voteWeightPost) !== -1) { if (Math.sign(this.voteWeightPost) === 0) { return 'grey' } return 'green' } else { return 'red' } }
    // settings: { get () { return this.$store.state.hive.user.settings } }
  },
  methods: {
    addBene (account, weight) {
      this.beneficiaries.push({ account: account, weight: weight })
    },
    editBene (account, weight) {
      this.removeBene(account)
      this.addBene(account, weight)
    },
    removeBene (account) {
      this.beneficiaries.splice(this.beneficiaries.findIndex(b => b.account === account), 1)
    },
    checkBene () {
    },
    saveSettings () {
      var s = {
        darkBackground: this.darkBackground,
        voteWeightPost: this.voteWeightPost,
        voteWeightComment: this.voteWeightComment,
        beneficiary: this.beneficiaries,
        apiNode: this.apiNode,
        heApiNode: this.heApiNode
      }
      this.$store.commit('hive/updateSettings', s)
      this.$emit('hide')
    },
    getBackgroundStyle () {
      if (this.darkBackgroundToggle) {
        return null
      } else {
        return 'gradientBg'
      }
    },
    getBackgroundLabel () {
      if (this.darkBackground) {
        return 'Dark'
      } else {
        return 'Fabulous'
      }
    }
  }
}
</script>
