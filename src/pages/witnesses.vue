<template>
  <q-page class="flex q-pa-md flex-center">
    <h1 class="sr-only">Hive witnesses</h1>
    <div>
        <witnesses />
   </div>
  </q-page>
</template>
<script>
import witnesses from 'components/witnesses.vue'
import { setPageMeta } from 'src/utils/pageMeta'
export default {
  name: 'witnessPage',
  components: { witnesses },
  mounted () {
    setPageMeta({
      title: 'Hive witnesses — ranks, votes and missed blocks',
      description: 'Hive witness rankings, vote counts, missed blocks and version information on hive.ausbit.dev.',
      url: '/witnesses'
    })
  }
}
</script>
