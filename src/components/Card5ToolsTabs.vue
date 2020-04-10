<template>
  <q-card>
    <q-splitter v-model="card5Split" separator-class="bg-indigo-9">
      <template v-slot:before>
        <q-tabs v-model="card5Tab" vertical indicator-color="secondary">
          <q-tab name="accountCreator" label="Account Creator" />
          <q-tab name="accountRecovery" label="Account Recovery" />
          <q-tab name="changePassword" label="Change Password" />
          <q-tab name="delegationHistory" label="Delegation History" />
          <q-tab name="keyGenerator" label="Key Generator" />
          <q-tab name="manualVote" label="Manual Vote" />
          <q-tab name="proxyInfo" label="Proxy Info" />
          <q-tab name="transferSearch" label="Transfer Search" />
          <q-tab name="votesOverview" label="Votes Overview" />
          <q-tab name="witnessOverview" label="Witness Overview" />
        </q-tabs>
      </template>
      <template v-slot:after>
        <q-tab-panels v-model="card5Tab" animated vertical transition-prev="jump-up" transition-next="jump-down">
          <q-tab-panel name="accountCreator">
            <div class="text-h5">Account Creator coming soon.</div>
            <div>In the meantime you can use your account creation credits via your <a href="https://peakd.com/me/wallet">peakd wallet</a>, and see other signup options at <a href="https://signup.hive.io">signup.hive.io</a></div>
          </q-tab-panel>
          <q-tab-panel name="accountRecovery">
            <div class="text-h5">Account Recovery tool coming soon.</div>
            <div>In the meantime you can recover accounts using <a href="https://reazuliqbal.com/HiveAccountRecovery/">Hive Account Recovery</a> by @reazuliqbal</div>
          </q-tab-panel>
          <q-tab-panel name="changePassword">
            <div class="text-h5">Change Password tool coming soon</div>
            <div>In the meantime you can change your password via your wallet on <a href="https://peakd.com">peakd</a> or <a href="https://hive.blog">Hive.blog</a></div>
          </q-tab-panel>
          <q-tab-panel name="delegationHistory">
            <div class="text-h5">Delegation History tool coming soon</div>
            <div></div>
          </q-tab-panel>
          <q-tab-panel name="keyGenerator">
            <div class="text-h5">Key Generator tool coming soon</div>
            <div></div>
          </q-tab-panel>
          <q-tab-panel name="manualVote">
            <card5-tools-manual-vote :username="username" />
          </q-tab-panel>
          <q-tab-panel name="proxyInfo">
            <div class="text-h5">Proxy Info tool coming soon</div>
            <div></div>
          </q-tab-panel>
          <q-tab-panel name="transferSearch">
            <div class="text-h5">Transfer Search tool coming soon</div>
            <div></div>
          </q-tab-panel>
          <q-tab-panel name="votesOverview">
            <div class="text-h5">Votes Overview</div>
            <div></div>
          </q-tab-panel>
          <q-tab-panel name="witnessOverview">
            <card5-tools-witness-overview :globalPropsHive="globalPropsHive" />
          </q-tab-panel>
        </q-tab-panels>
      </template>
    </q-splitter>
  </q-card>
</template>

<script>
import Card5ToolsManualVote from 'components/Card5ToolsManualVote.vue'
import Card5ToolsWitnessOverview from 'components/Card5ToolsWitnessOverview'
export default {
  name: 'Card5ToolsTab',
  props: ['username', 'globalPropsHive'],
  components: {
    Card5ToolsManualVote: Card5ToolsManualVote,
    Card5ToolsWitnessOverview: Card5ToolsWitnessOverview
  },
  data () {
    return {
      card5Split: 25,
      card5Tab: 'accountCreator'
    }
  },
  methods: {
  }
}
</script>
