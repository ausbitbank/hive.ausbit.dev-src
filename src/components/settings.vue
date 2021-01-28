<template>
  <div class="q-pa-lg bg-dark rounded-corners">
    <div class="text-h5 text-center">Settings</div>
      <q-list>
        <q-item>
          <q-item-section>
            Background Style
          </q-item-section>
          <q-item-section>
            <q-toggle v-model="darkBackground" :label="getBackgroundLabel()" />
          </q-item-section>
        </q-item>
        <q-item>
          <q-item-section>
            Default vote %
          </q-item-section>
          <q-item-section>
            <q-slider v-model="voteWeightPost" :min="-100" :max="100" :color="voteColor" label label-always />
          </q-item-section>
        </q-item>
        <q-item v-if="false">
          <q-item-section>
            Comment vote weight
          </q-item-section>
          <q-item-section>
            <q-input v-model.number="voteWeightComment" type="number" />
          </q-item-section>
        </q-item>
        <q-item v-if="false">
          <q-input v-model="beneficiaries" />
        </q-item>
        <q-item>
            <q-btn label="Save Settings" color="primary" rounded push @click="saveSettings()" style="margin: auto" class="hvr" v-close-popup />
        </q-item>
      </q-list>
  </div>
</template>
<script>
export default {
  name: 'settings',
  data () {
    return {
      darkBackground: this.$store.state.hive.user.settings.darkBackground,
      voteWeightPost: this.$store.state.hive.user.settings.voteWeightPost,
      voteWeightComment: this.$store.state.hive.user.settings.voteWeightComment,
      beneficiaries: this.$store.state.hive.user.settings.beneficiary
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
    saveSettings () {
      var s = {
        darkBackground: this.darkBackground,
        voteWeightPost: this.voteWeightPost,
        voteWeightComment: this.voteWeightComment,
        beneficiary: this.beneficiaries
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
