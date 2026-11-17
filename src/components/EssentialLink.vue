<template>
  <q-item
    clickable
    :to="to || undefined"
    :href="to ? undefined : link"
    :target="to ? undefined : '_blank'"
    :rel="to ? undefined : 'noopener noreferrer'"
  >
    <q-item-section
      v-if="icon"
      avatar
    >
      <q-icon :name="icon" color="secondary" aria-hidden="true" />
    </q-item-section>

    <q-item-section>
      <q-item-label>{{ title }}</q-item-label>
      <q-item-label caption>
        {{ caption }}
      </q-item-label>
    </q-item-section>
  </q-item>
</template>
<script>
export default {
  name: 'EssentialLink',
  props: {
    title: {
      type: String,
      required: true
    },

    caption: {
      type: String,
      default: ''
    },

    link: {
      type: String,
      default: '#'
    },

    to: {
      type: String,
      default: null
    },

    icon: {
      type: String,
      default: ''
    }
  }
}
</script>
