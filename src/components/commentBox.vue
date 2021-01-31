<template>
    <div flat bordered v-if="this.loggedInUser" style="margin:auto; min-width: 500px; max-width: 95%" class="q-ma-md q-pa-md rounded-borders">
        <q-card v-if="!commentSent">
        <vue-simplemde v-model="commentText" ref="markdownEditor" :configs="editorConfig" class="q-pa-sm" />
        <q-btn @click="comment()" push color="primary" style="margin:auto">Reply to {{ parent_author }}</q-btn>
        <q-icon name="info" color="primary" title="10% comment beneficiary to ausbitbank" class="q-ma-sm"/>
        </q-card>
        <span v-if="commentSent">Comment Sent</span>
    </div>
</template>
<style>
  @import '~simplemde/dist/simplemde.min.css';
</style>
<script>
import { keychain } from '@hiveio/keychain'
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
      editorConfig: {
        autosave: {
          enabled: false,
          uniqueId: 'ausbitCommentForm',
          delay: 1000
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
    }
  },
  methods: {
    async comment () {
      var newpermlink = this.$hive.formatter.commentPermlink(this.parent_author, this.parent_permlink)
      var metadata = { app: 'ausbit/2021.02.01' }
      var commentOptions = { author: this.loggedInUser, permlink: newpermlink, max_accepted_payout: '10000.000 HBD', percent_hbd: 10000, allow_votes: true, allow_curation_rewards: true, extensions: [[0, { beneficiaries: this.$store.state.hive.user.settings.beneficiary }]] }
      const { success, msg, cancel, notInstalled, notActive } = await keychain(window, 'requestPost', this.loggedInUser, this.title, this.commentText, this.parent_permlink, this.parent_author, JSON.stringify(metadata), newpermlink, JSON.stringify(commentOptions))
      if (success) { this.$q.notify('Comment Sent'); this.commentSent = true }
      if (!cancel) {
        if (notActive) {
          console.error('Please allow Keychain to access this website')
        } else if (notInstalled) { // alert('Please install Keychain')
          console.error('Keychain not available')
        } else {
          console.info(msg)
        }
      }
    }
  }
}
</script>
