<template>
  <div>
    <q-card>
      <div>
        Followers: {{ followCounts.follower_count }}, Following: {{ followCounts.following_count }}
      </div>
      <div><q-input label="Search followers" /></div>
      <q-btn label="Load followers" />
    </q-card>
  </div>
</template>

<script>
export default {
  name: 'Card1Followers',
  props: ['username', 'followCounts'],
  data () {
    return {
    }
  },
  methods: {
  }
}
</script>
