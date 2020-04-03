<template>
  <div>
    <q-card>
      <q-tabs v-model="card1SettingsTab" dense align="justify" narrow-indicator indicator-color="secondary">
        <q-tab name="general" label="General" />
        <q-tab name="view" label="View" />
        <q-tab name="layout" label="Layout" />
        <q-tab name="postEditor" label="Post Editor" />
        <q-tab name="security" label="Security" />
      </q-tabs>
      <q-separator />
      <q-tab-panels v-model="card1SettingsTab" animated>
        <q-tab-panel name="general">
        </q-tab-panel>
        <q-tab-panel name="view">
        </q-tab-panel>
        <q-tab-panel name="layout">
          <q-toggle v-model="darkmode" label="Night Mode" @input="darkToggle" color="secondary" />
        </q-tab-panel>
        <q-tab-panel name="postEditor">
        </q-tab-panel>
        <q-tab-panel name="security">
        </q-tab-panel>
      </q-tab-panels>
    </q-card>
  </div>
</template>

<script>
export default {
  name: 'Card1Settings',
  props: ['A'],
  data () {
    return {
      card1SettingsTab: 'general',
      darkmode: true
    }
  },
  methods: {
    darkToggle () {
      console.log(this.darkmode)
      this.$q.dark.set(this.darkmode)
    }
  }
}
</script>
