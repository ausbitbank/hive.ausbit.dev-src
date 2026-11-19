<template>
  <q-page class="short-form-page">
    <short-form-timeline v-if="formatId" :format-id="formatId" />
    <div v-else class="short-form-page__missing">
      <q-icon name="error_outline" size="26px" aria-hidden="true" />
      <p>Unknown microblog format.</p>
      <q-btn flat no-caps color="primary" label="Browse Snaps" :to="{ name: 'short-form', params: { format: 'snaps' } }" />
    </div>
  </q-page>
</template>

<script>
import ShortFormTimeline from 'components/shortForm/ShortFormTimeline.vue'

export default {
  name: 'ShortFormPage',
  components: { ShortFormTimeline },
  props: {
    formatId: { type: String, default: '' }
  }
}
</script>

<style scoped>
.short-form-page {
  padding-bottom: var(--space-6);
}

.short-form-page__missing {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-2);
  padding: var(--space-6);
  color: #90a4ae;
  text-align: center;
}
</style>
