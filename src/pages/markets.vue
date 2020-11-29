<template>
  <q-page class="flex q-pa-md flex-center">
    <div>
        <coingecko />
   </div>
  </q-page>
</template>
<script>
import coingecko from 'components/coingecko.vue'
export default {
  name: 'markets',
  components: { coingecko },
  mounted () {
    document.title = 'Markets'
  }
}
</script>
