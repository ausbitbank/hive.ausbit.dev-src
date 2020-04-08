<template>
  <q-card>
    <div class="row">
      <div>Link</div>
      <div><q-input label="permlink" v-model="permlink" /></div>
    </div>
    <div class="row">
      <div>Author</div>
      <div><q-input label="author" v-model="author" /></div>
    </div>
    <div class="row">
      <div>Type</div>
      <div><q-select v-model="voteType" :options="voteTypes" filled /></div>
    </div>
    <div class="row">
      <div>Weight : {{ weight }} %</div>
      <div style="width: 50%"><q-slider v-model="weight" :min="0" :max="100" color="secondary" /></div>
    </div>
    <div class="row">
      <q-btn label="Vote" color="secondary" @click="voteKeychain(author, permlink, voteType, weight)" />
    </div>
  </q-card>
</template>

<script>
export default {
  name: 'Card5ToolsManualVote',
  props: ['username'],
  components: {
  },
  data () {
    return {
      permlink: '',
      author: '',
      voteType: 'upvote',
      voteTypes: ['upvote', 'downvote'],
      weight: 100
    }
  },
  methods: {
    voteKeychain (author, permlink, type, weight) {
      console.log('called hive keychain')
      if (type === 'upvote') {
        weight = weight * 100
      } else {
        weight = (-Math.abs(weight) * 100)
      }
      window.hive_keychain.requestVote(this.username, permlink, author, weight, function (response) {
        console.log(response)
      })
    }
  }
}
</script>
