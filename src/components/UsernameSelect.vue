<template>
  <form @submit.prevent.stop="submitUsername" @reset.prevent.stop="onReset" class="q-gutter-md">
    <q-input clearable filled v-model="username" label="Username" />
    <q-btn color="secondary" label="Load User" type="submit" />
  </form>
</template>

<script>
export default {
  name: 'UsernameSelect',
  data () {
    return {
      username: ''
    }
  },
  methods: {
    submitUsername () {
      this.$store.commit('hive/setUsername', this.username)
      console.log(this.username)
    }
  }
}
</script>
