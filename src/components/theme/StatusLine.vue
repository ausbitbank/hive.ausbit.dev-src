<template>
  <p v-if="text" class="skin-status">
    <q-icon v-if="iconName" :name="iconName" size="15px" aria-hidden="true" />
    <span class="skin-status__text">{{ text }}</span>
  </p>
</template>

<style scoped>
.skin-status {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.35rem;
  max-width: 70ch;
  margin: 0 auto;
  padding: 0.35rem 1rem 0;
  color: var(--skin-muted, var(--c-text-muted));
  font-size: 0.82rem;
  line-height: 1.4;
  text-align: center;
}

.skin-status__text {
  overflow: hidden;
  display: -webkit-box;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 1;
  line-clamp: 1;
}

@media (max-width: 599px) {
  .skin-status__text {
    -webkit-line-clamp: 2;
    line-clamp: 2;
  }
}
</style>

<script>
const ICONS = {
  none: '',
  spark: 'auto_awesome',
  hammer: 'construction',
  coffee: 'local_cafe',
  moon: 'dark_mode',
  leaf: 'eco',
  antenna: 'settings_input_antenna',
  heart: 'favorite'
}

export default {
  name: 'StatusLine',
  props: {
    status: { type: Object, default: null }
  },
  computed: {
    text () {
      return String(this.status?.text || '').slice(0, 80)
    },
    iconName () {
      return ICONS[this.status?.icon] || ''
    }
  }
}
</script>
