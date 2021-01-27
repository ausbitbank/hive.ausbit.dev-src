<template>
    <div flat bordered v-if="this.loggedInUser" style="margin:auto; min-width: 400px; max-width: 95%" class="q-ma-md q-pa-md rounded-borders">
        <q-card v-if="!commentSent">
        <q-input v-model="commentText" type="textarea" autogrow label="Write a reply" class="text-center bg-blue-grey-10 q-pa-sm" />
        <q-btn @click="comment()" push color="primary" style="margin:auto">Reply to {{ parent_author }}</q-btn>
        <q-icon name="info" color="primary" title="10% comment beneficiary to ausbitbank" class="q-ma-sm"/>
        </q-card>
        <span v-if="commentSent">Comment Sent</span>
    </div>
</template>
<script>
import { keychain } from '@hiveio/keychain'
export default {
  name: 'commentBox',
  props: ['parent_author', 'parent_permlink', 'tags'],
  data () {
    return {
      commentText: '',
      commentSent: false,
      title: ''
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
      var metadata = {
        app: 'ausbit/2021.01.27'
      }
      var commentOptions = { author: this.loggedInUser, permlink: newpermlink, max_accepted_payout: '10000.000 HBD', percent_hbd: 10000, allow_votes: true, allow_curation_rewards: true, extensions: [[0, { beneficiaries: [{ account: 'ausbitbank', weight: 1000 }] }]] }
      const { success, msg, cancel, notInstalled, notActive } = await keychain(window, 'requestPost', this.loggedInUser, this.title, this.commentText, this.parent_permlink, this.parent_author, JSON.stringify(metadata), newpermlink, JSON.stringify(commentOptions))
      console.log(success)
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
