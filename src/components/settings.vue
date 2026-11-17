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
            <div class="text-caption text-grey-5">On keeps a plain dark background. Off shows the animated colour gradient (disabled automatically when your device asks for reduced motion).</div>
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
          <div class="text-caption text-grey-5 q-mb-sm">Beneficiaries receive a share of your post rewards. The default entry supports this site; you can edit its weight or remove it at any time.</div>
          <div v-for="bene in beneficiaries" :key="bene.index">
            {{ bene.weight / 100 }} % to {{ bene.account }}
            <q-btn title="Edit" aria-label="Edit beneficiary" icon="edit" color="orange" dense flat>
              <q-popup-proxy>
                <q-card class="q-pa-md">
                {{ bene.account }} : <q-input label="Weight (0-10000)" v-model.number="bene.weight" />
                <q-btn icon="save" color="primary" dense flat aria-label="Save beneficiary weight" title="Save beneficiary weight" @click="editBene(bene.account, bene.weight)" v-close-popup />
                </q-card>
              </q-popup-proxy>
            </q-btn>
            <q-btn title="Remove" aria-label="Remove beneficiary" icon="delete" color="red" dense flat @click="removeBene(bene.account)"/>
            <q-btn color="green" icon="person_add" dense flat title="Add beneficiary" aria-label="Add beneficiary">
              <q-popup-proxy>
                <q-card class="q-pa-md" flat bordered>
                  Add new beneficiary<br />
                  <q-input v-model="newBeneAccount" label="Account" />
                  <q-input v-model.number="newBeneWeight" label="Weight (0-10000)" />
                  <q-btn icon="save" color="primary" dense flat aria-label="Add beneficiary" title="Add beneficiary" @click="addBene(newBeneAccount, newBeneWeight)" />
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
import { setHiveNode } from 'src/services/hive'

export default {
  name: 'settings',
  data () {
    return {
      darkBackground: this.$hiveStore.user.settings.darkBackground,
      voteWeightPost: this.$hiveStore.user.settings.voteWeightPost,
      voteWeightComment: this.$hiveStore.user.settings.voteWeightComment,
      beneficiaries: [...(this.$hiveStore.user.settings.beneficiary || [])],
      newBeneAccount: '',
      newBeneWeight: 1000,
      apiNode: this.$hiveStore.user.settings.apiNode || 'https://api.hive.blog',
      heApiNode: this.$hiveStore.user.settings.heApiNode || 'https://herpc.dtools.dev',
      ahNode: this.$hiveStore.user.settings.ahNode || 'https://api.hive.blog'
    }
  },
  computed: {
    loggedInUser: { get () { return this.$hiveStore.user.username } },
    voteColor: function () { if (Math.sign(this.voteWeightPost) !== -1) { if (Math.sign(this.voteWeightPost) === 0) { return 'grey' } return 'green' } else { return 'red' } }
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
      const index = this.beneficiaries.findIndex(b => b.account === account)
      if (index !== -1) this.beneficiaries.splice(index, 1)
    },
    saveSettings () {
      const settings = {
        darkBackground: this.darkBackground,
        voteWeightPost: this.voteWeightPost,
        voteWeightComment: this.voteWeightComment,
        beneficiary: this.beneficiaries,
        apiNode: this.apiNode,
        ahNode: this.ahNode,
        heApiNode: this.heApiNode
      }
      this.$hiveStore.updateSettings(settings)
      setHiveNode(settings.apiNode)
      this.$emit('hide')
    },
    getBackgroundLabel () {
      if (this.darkBackground) {
        return 'Dark background'
      } else {
        return 'Animated background'
      }
    }
  }
}
</script>
