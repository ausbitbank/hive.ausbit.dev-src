<template>
  <q-card flat bordered class="home-card ui-skeleton-card" :aria-label="label" role="status" aria-live="polite" aria-busy="true">
    <div class="ui-skeleton">
      <div v-for="i in rows" :key="i" class="ui-skeleton__row">
        <q-skeleton v-if="avatar" type="circle" :size="avatarSize" />
        <div class="ui-skeleton__body">
          <q-skeleton type="text" :width="titleWidth" />
          <q-skeleton type="text" :width="lineWidth" />
        </div>
        <q-skeleton v-if="side" type="text" width="60px" />
      </div>
    </div>
  </q-card>
</template>

<script>
export default {
  name: 'Skeleton',
  props: {
    rows: { type: Number, default: 4 },
    avatar: { type: Boolean, default: true },
    avatarSize: { type: String, default: '34px' },
    side: { type: Boolean, default: true },
    titleWidth: { type: String, default: '52%' },
    lineWidth: { type: String, default: '34%' },
    label: { type: String, default: 'Loading content' }
  }
}
</script>

<style scoped>
.ui-skeleton-card {
  overflow: hidden;
}

.ui-skeleton {
  display: flex;
  flex-direction: column;
  gap: 0.65rem;
  padding: var(--space-4);
}

.ui-skeleton__row {
  display: flex;
  align-items: center;
  gap: 0.6rem;
}

.ui-skeleton__body {
  flex: 1;
  min-width: 0;
}
</style>
