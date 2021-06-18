<template>
  <div>
    <q-list bordered>
      <q-expansion-item popup v-for="post in posts" :key="post.index" :label="postHeading(post)" icon="mode_comment" group="posts" dense dense-toggle>
        <card3-posts-tabs :post="post" />
      </q-expansion-item>
    </q-list>
  </div>
</template>

<script>
import card3PostsTabs from 'src/components/hiveworld/Card3PostsTabs.vue'
export default {
  name: 'Card3ActivePosts',
  props: ['username', 'posts'],
  components: {
    card3PostsTabs: card3PostsTabs
  },
  data () {
    return {
    }
  },
  methods: {
    postHeading (post) {
      var rewards = ''
      if (parseFloat(post.total_payout_value.split(' ')[0]) > 0) {
        rewards = post.total_payout_value
      } else if (parseFloat(post.pending_payout_value.split(' ')[0]) > 0) {
        rewards = post.pending_payout_value
      } else {
        rewards = '0.000 HBD'
      }
      return post.title + ' | ' + rewards
    }
  }
}
</script>
