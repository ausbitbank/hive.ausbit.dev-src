<template>
  <q-page class="flex q-pa-md flex-center">
    <div>
        <witnesses />
   </div>
  </q-page>
</template>
<script>
import witnesses from 'components/witnesses.vue'
export default {
  name: 'witnessPage',
  components: { witnesses },
  mounted () {
    document.title = 'Witnesses'
  }
}
</script>
