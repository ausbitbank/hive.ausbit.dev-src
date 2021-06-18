<template>
  <q-card>
    <q-tabs v-model="card3PostsTab" dense align="justify" narrow-indicator indicator-color="secondary">
      <q-tab name="summary" label="Summary" />
      <q-tab name="content" label="Content" />
      <q-tab name="votes" label="Votes" />
      <q-tab name="images" label="Images" />
      <q-tab name="replies" label="Replies" />
      <q-tab name="resteems" label="Reblogs" />
      <q-tab name="transfers" label="Transfers" />
    </q-tabs>
    <q-separator />
    <q-tab-panels v-model="card3PostsTab" animated>
      <q-tab-panel name="summary">
        <card3-posts-summary :post="post" />
      </q-tab-panel>
      <q-tab-panel name="content">
        <card3-posts-content :post="post" />
      </q-tab-panel>
      <q-tab-panel name="votes">
        <card3-posts-votes :post="post" />
      </q-tab-panel>
      <q-tab-panel name="images">
        <card3-posts-images :post="post" />
      </q-tab-panel>
      <q-tab-panel name="replies">
      </q-tab-panel>
      <q-tab-panel name="resteems">
      </q-tab-panel>
      <q-tab-panel name="transfers">
      </q-tab-panel>
    </q-tab-panels>
  </q-card>
</template>

<script>
import Card3PostsSummary from 'src/components/hiveworld/Card3PostsSummary.vue'
import Card3PostsContent from 'src/components/hiveworld/Card3PostsContent.vue'
import Card3PostsVotes from 'src/components/hiveworld/Card3PostsVotes.vue'
import Card3PostsImages from 'src/components/hiveworld/Card3PostsImages.vue'
export default {
  name: 'Card3PostsTab',
  props: ['post'],
  components: {
    Card3PostsSummary: Card3PostsSummary,
    Card3PostsContent: Card3PostsContent,
    Card3PostsVotes: Card3PostsVotes,
    Card3PostsImages: Card3PostsImages
  },
  data () {
    return {
      card3PostsTab: 'summary'
    }
  },
  methods: {
  }
}
</script>
