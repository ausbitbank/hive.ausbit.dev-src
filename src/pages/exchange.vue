<template>
  <q-page class="flex q-pa-md flex-center">
    <exchange />
  </q-page>
</template>
<style>
</style>
<script>
import exchange from 'components/exchange.vue'
export default {
  name: 'exchangePage',
  components: {
    exchange
  },
  data () {
    return {
      fromDefault: this.$route.query.fromDefault,
      toDefault: this.$route.query.toDefault,
      from: this.$route.query.from,
      memo: this.$route.query.memo,
      to: this.$route.query.to,
      defaultAmount: this.$route.query.defaultAmount,
      address: this.$route.query.address
    }
  },
  watch: {
  },
  computed: {
  },
  methods: {
  },
  mounted () {
  }
}
</script>
