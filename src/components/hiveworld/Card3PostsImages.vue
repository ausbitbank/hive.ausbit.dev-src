<template>
  <div v-if="postMeta.image" class="q-pa-md">
    <div class="text-h5">{{ postMeta.image.length }} image<span v-if="postMeta.image.length > 1">s</span></div>
    <div class="row" style="max-height: 600px; overflow:auto">
      <div v-for="image in postMeta.image" :key="image.index" class="q-pa-sm">
        <a :href="image" :title="image" target="_blank"><img :src="image" style="max-width: 300px; max-height: 300px" /></a>
      </div>
    </div>
    <!-- <q-carousel animated v-model="slide" arrows infinite thumbnails vertical>
      <q-carousel-slide v-for="(image, index) in postMeta.image" :key="image.index" :name="index" :img-src="image" />
    </q-carousel> -->
  </div>
</template>

<script>
export default {
  name: 'Card3Images',
  props: ['post'],
  data () {
    return {
      slide: 0
    }
  },
  computed: {
    postMeta: function () {
      if (this.post === null) {
        return null
      } else {
        return JSON.parse(this.post.json_metadata)
      }
    }
  },
  methods: {
  }
}
</script>
