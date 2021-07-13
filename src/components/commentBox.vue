<template>
    <div flat bordered v-if="this.loggedInUser && !commentSent">
        <q-card flat bordered class="q-ma-none q-pa-sm rounded-borders">
        <div class="text-center">Reply to <router-link :to="returnUserLink(parent_author)">{{ parent_author }}</router-link> / <router-link :to="returnPostLink(parent_author, parent_permlink)">{{ parent_permlink.substr(0, 20) }}...</router-link></div>
        <vue-simplemde v-model="commentText" ref="markdownEditor" :configs="editorConfig" class="q-pa-sm" />
        <q-expansion-item v-model="advanced" label="Advanced Options" icon="settings" color="grey">
          <q-input label="Post Title (optional for comments)" v-model="title" />
          <q-input label="JSON Metadata" v-model="defaultMeta" />
          <q-input label="Percent HBD (0-10000)" v-model.number="percent_hbd" />
          <q-input label="Max Accepted Payout" v-model="max_accepted_payout" />
          <q-checkbox label="Allow Votes" v-model="allow_votes" :disable="true" />
          <q-checkbox label="Allow Curation Rewards" v-model="allow_curation_rewards" :disable="true" />
        </q-expansion-item>
        <q-btn v-close-popup icon="comment" @click="comment()" push color="primary" style="margin:auto">Reply to {{ parent_author }}</q-btn>
        <q-btn v-close-popup icon="close" label="Cancel" color="red" />
        </q-card>
    </div>
</template>
<style>
  @import '../statics/simplemde-theme-dark.min.css';
</style>
<script>
import VueSimplemde from 'vue-simplemde'
export default {
  name: 'commentBox',
  props: ['parent_author', 'parent_permlink', 'tags'],
  components: { VueSimplemde },
  data () {
    return {
      commentText: '',
      commentSent: false,
      title: '',
      advanced: false,
      defaultMeta: '{ "app": "ausbit/2021.06.07", "format": "markdown" }',
      max_accepted_payout: '100000.000 HBD',
      percent_hbd: 10000,
      allow_votes: true,
      allow_curation_rewards: true,
      editorConfig: {
        autosave: {
          enabled: false,
          uniqueId: 'ausbitCommentForm',
          delay: 0
        },
        autofocus: true,
        hideIcons: ['guide', 'side-by-side'],
        spellChecker: true
      }
    }
  },
  computed: {
    loggedInUser: {
      get () { return this.$store.state.hive.user.username }
    },
    loginType: { get () { return this.$store.state.hive.user.loginType } }
  },
  methods: {
    async comment () {
      var newpermlink = this.$hive.formatter.commentPermlink(this.parent_author, this.parent_permlink)
      var commentOptions = []
      if (this.$store.state.hive.user.settings.beneficiary.length !== 0) {
        commentOptions = { author: this.loggedInUser, permlink: newpermlink, max_accepted_payout: this.max_accepted_payout, percent_hbd: this.percent_hbd, allow_votes: this.allow_votes, allow_curation_rewards: this.allow_curation_rewards, extensions: [[0, { beneficiaries: this.$store.state.hive.user.settings.beneficiary }]] }
      } else {
        commentOptions = { author: this.loggedInUser, permlink: newpermlink, max_accepted_payout: this.max_accepted_payout, percent_hbd: this.percent_hbd, allow_votes: this.allow_votes, allow_curation_rewards: this.allow_curation_rewards }
      }
      var op = ['comment', {
        parent_author: this.parent_author,
        parent_permlink: this.parent_permlink,
        author: this.loggedInUser,
        permlink: newpermlink,
        title: this.title,
        body: this.commentText,
        json_metadata: this.defaultMeta,
        comment_options: commentOptions
      }]
      this.$store.commit('hive/addToQueue', [this.loggedInUser, 'posting', op])
    },
    returnUserLink (user) { return '/@' + user },
    returnPostLink (author, permlink) { return '/@' + author + '/' + permlink }
  }
}
</script>
