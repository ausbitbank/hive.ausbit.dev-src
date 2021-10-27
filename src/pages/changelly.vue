<template>
  <q-page class="flex q-pa-md flex-center">
    <changelly :fromDefault="fromDefault" :toDefault="toDefault" :from="from" :to="to" :memo="memo" :address="address"/>
  </q-page>
</template>
<style>
</style>
<script>
import changelly from 'components/changelly.vue'
export default {
  name: 'changellyPage',
  components: {
    changelly
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
