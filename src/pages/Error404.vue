<template>
  <div class="fixed-center text-center">
    <p>
      <img
        src="assets/sad.svg"
        style="width:30vw;max-width:150px;"
      >
    </p>
    <p class="text-faded">
      Sorry, nothing here...<strong>(404)</strong>
    </p>
    <q-btn
      color="secondary"
      style="width:200px;"
      to="/"
      label="Go back"
    />
  </div>
</template>

<script>
import { setPageMeta } from 'src/utils/pageMeta'
export default {
  name: 'Error404',
  mounted () {
    setPageMeta({
      title: 'Page not found (404) — hive.ausbit.dev',
      description: 'The requested page could not be found on hive.ausbit.dev, a block explorer and toolkit for the Hive blockchain.',
      url: '/404'
    })
  }
}
</script>
