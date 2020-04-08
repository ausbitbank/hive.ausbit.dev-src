<template>
  <q-page class="flex flex-center">
    <div class="q-pa-md row items-start q-gutter-md">
      <q-card class="row">
        <a href="/exodus" title="Escape from STEEM to HIVE"><img src="https://i.imgflip.com/3u458s.jpg" /></a>
      </q-card>
      <q-card class="row">
        <form @submit.prevent.stop="$router.replace({ path: '@' + username })" @reset.prevent.stop="onReset" class="q-gutter-md">
          <q-input clearable filled v-model="username" label="Username" />
          <q-btn color="secondary" label="View User" type="submit" />
        </form>
      </q-card>
    </div>
  </q-page>
</template>

<script>
// import UsernameSelect from 'components/UsernameSelect.vue'
// import HiveQuery from 'components/HiveQuery.vue'
// import PriceFeed from 'components/PriceFeed.vue'
export default {
  name: 'Home',
  // components: { UsernameSelect, HiveQuery, PriceFeed }
  // components: { UsernameSelect },
  data () {
    return {
      username: ''
    }
  },
  methods: {
  }
}
</script>
