<template>
  <q-page class="flex q-pa-sm flex-center">
    <q-card flat bordered style="max-width:95%" v-if="loggedInUser">
      <q-card-section header class="text-h5 text-center">Submit New Post</q-card-section>
      <q-card-section>
        <q-select v-model="postTo" :options="postToOptions" label="Where should we post this ?" />
        <q-input label="Post Title" v-model="postTitle" required />
        <vue-simplemde v-model="postBody" ref="markdownEditor" :configs="editorConfig" />
        <q-input label="Post summary (for posts list & SEO, max 140 chars)" v-model="postSummary" />
        <q-input label="Post author (if different from current account)" v-model="postAuthor" />
        <q-input label="JSON Metadata" v-model="defaultMeta" />
        <q-input label="Percent HBD (0-10000)" v-model.number="percent_hbd" />
        <q-input label="Max Accepted Payout" v-model="max_accepted_payout" />
        <q-checkbox label="Allow Votes" v-model="allow_votes" :disable="true" />
        <q-checkbox label="Allow Curation Rewards" v-model="allow_curation_rewards" :disable="true" />
        <q-checkbox label="Auto Reblog" v-model="autoReblog" />
      </q-card-section>
    </q-card>
    <q-card flat bordered v-else class="q-pa-lg">
      <q-icon name="warning" color="orange" size="md" />
      You must login before you can submit a post
    </q-card>
  </q-page>
</template>
<style>
a:link { color: #1d8ce0; font-weight: bold; text-decoration: none; }
a:visited { color: #884488; }
:target { background-color: #ffa; }
</style>
<style>
  @import '../statics/simplemde-theme-dark.min.css';
</style>
<script>
export default {
  name: 'submit',
  components: {
    VueSimplemde: () => import('vue-simplemde')
  },
  data () {
    return {
      postBody: '',
      postTitle: '',
      postSummary: '',
      postTags: [],
      postTo: 'My Blog (Top level post)',
      postAuthor: '',
      defaultMeta: '{ "app": "ausbit/2021.06.22", "format": "markdown" }',
      max_accepted_payout: '100000.000 HBD',
      percent_hbd: 10000,
      allow_votes: true,
      allow_curation_rewards: true,
      autoReblog: false,
      editorConfig: {
        autosave: {
          enabled: false,
          uniqueId: 'ausbitSubmitForm',
          delay: 0
        },
        autofocus: true,
        hideIcons: ['guide', 'side-by-side'],
        spellChecker: true
      }
    }
  },
  watch: {
  },
  computed: {
    loggedInUser: function () { return this.$store.state.hive.user.username },
    postToOptions: function () {
      var o = ['My Blog (Top level post)']
      if (this.$store.state.hive.user.communities.length > 0) {
        console.log(this.$store.state.hive.user)
        this.$store.state.hive.user.communities.forEach(c => {
          o.push(c[1] + ' (' + c[0] + ')')
        })
      }
      return o
    }
  },
  methods: {
  },
  mounted () {
    document.title = 'Submit new post'
    if (this.loggedInUser) { this.$store.dispatch('hive/getCommunitySubscriptions', this.loggedInUser) }
  }
}
</script>
