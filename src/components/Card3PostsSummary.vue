<template>
  <div>
    <q-card>
      <div>
        <span class="text-bold q-pa-md">
          Created
        </span>
        <span>
          {{ timeDiff(post.created) }} | {{ post.created }}
        </span>
        <span>
        </span>
      </div>
      <div>
        <span class="text-bold q-pa-md">
          Payout Time
        </span>
        <span>
          {{ timeDiff(post.cashout_time) }} | {{ post.cashout_time }}
        </span>
      </div>
      <div>
        <span class="text-bold q-pa-md">
          Payout Total
        </span>
        <span v-if="post.cashout_time.startsWith('1969')">
          {{ post.total_payout_value }}
        </span>
        <span v-else>
          {{ post.pending_payout_value }}
        </span>
      </div>
      <div>
        <span class="text-bold q-pa-md">
          Payout Author
        </span>
        <span>
        </span>
      </div>
      <div>
        <span class="text-bold q-pa-md">
          Payout Returned
        </span>
        <span>
        </span>
      </div>
      <div>
        <span class="text-bold q-pa-md">
          Payout Percent SBD
        </span>
        <span>
          {{ post.percent_steem_dollars / 100 }} %
        </span>
      </div>
      <div>
        <span class="text-bold q-pa-md">
          Transfer Amount
        </span>
        <span>
        </span>
      </div>
      <div>
        <span class="text-bold q-pa-md">
          Link
        </span>
        <span>
          <a :href="postLink" target="_blank">{{ post.url }}</a>
        </span>
      </div>
      <div v-if="postMeta.tags.length > 0">
        <span class="text-bold q-pa-md">
          Tags
        </span>
        <span>
          <q-chip v-for="tag in postMeta.tags" :label="tag" :key="tag.index" />
        </span>
      </div>
      <div v-if="postMeta.users">
        <span class="text-bold q-pa-md">
          Users
        </span>
        <span>
          <q-chip v-for="user in postMeta.users" :label="user" :key="user.index" />
        </span>
      </div>
      <div v-if="postMeta.app">
        <span class="text-bold q-pa-md">
          App
        </span>
        <span>
          {{ postMeta.app }}
        </span>
      </div>
    </q-card>
  </div>
</template>

<script>
import moment from 'moment'
export default {
  name: 'Card3PostsSummary',
  props: ['post'],
  data () {
    return {
    }
  },
  computed: {
    postMeta: function () {
      if (this.post === null) {
        return null
      } else {
        return JSON.parse(this.post.json_metadata)
      }
    },
    postLink: function () {
      return 'https://peakd.com/@' + this.post.author + '/' + this.post.permlink
    }
  },
  methods: {
    timeDiff (when) {
      return moment(when).fromNow()
    }
  }
}
</script>
