<template>
  <q-item
    clickable
    :to="to || undefined"
    :href="to ? undefined : link"
    :target="to ? undefined : '_blank'"
    :rel="to ? undefined : 'noopener noreferrer'"
    class="site-link"
  >
    <q-item-section
      v-if="icon"
      avatar
    >
      <q-icon :name="icon" color="primary" aria-hidden="true" />
    </q-item-section>

    <q-item-section>
      <q-item-label>{{ title }}</q-item-label>
      <q-item-label caption :title="caption">
        {{ caption }}
      </q-item-label>
    </q-item-section>

    <q-item-section v-if="!to" side>
      <q-icon name="open_in_new" size="14px" class="site-link__external" aria-hidden="true" />
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

<style scoped>
.site-link__external {
  color: var(--c-text-faint);
  opacity: 0;
  transition: opacity 0.15s ease;
}

.site-link:hover .site-link__external {
  opacity: 1;
}
</style>
