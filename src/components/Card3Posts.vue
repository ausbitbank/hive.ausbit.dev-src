<template>
  <div style="max-height:90vh; max-width: 90vw">
    <q-card>
      <q-tabs v-model="card3PostsTab" dense align="justify" narrow-indicator indicator-color="secondary">
        <q-tab name="active" label="Active" />
        <q-tab name="finished" label="Finished" />
      </q-tabs>
      <q-separator />
      <q-tab-panels v-model="card3PostsTab" animated>
        <q-tab-panel name="active">
          <card3ActivePosts :username="username" />
        </q-tab-panel>
        <q-tab-panel name="finished">
          Paid out posts
        </q-tab-panel>
      </q-tab-panels>
    </q-card>
  </div>
</template>

<script>
import card3ActivePosts from 'components/Card3ActivePosts.vue'
export default {
  name: 'Card3Posts',
  props: ['username'],
  components: {
    card3ActivePosts: card3ActivePosts
  },
  data () {
    return {
      card3PostsTab: 'active'
    }
  },
  methods: {
  }
}
</script>
