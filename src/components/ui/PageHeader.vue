<template>
  <header class="ui-page-head">
    <div class="ui-page-head__text">
      <div v-if="eyebrow || live" class="ui-eyebrow">
        <span v-if="live" class="home-live-dot is-live" aria-hidden="true"></span>
        <slot name="eyebrow">{{ eyebrow }}</slot>
      </div>
      <h1 class="ui-page-title">
        <slot name="title">{{ title }}</slot>
      </h1>
      <p v-if="intro || $slots.intro" class="ui-page-intro">
        <slot name="intro">{{ intro }}</slot>
      </p>
      <slot name="meta" />
    </div>
    <div v-if="$slots.actions" class="ui-page-actions">
      <slot name="actions" />
    </div>
  </header>
</template>

<script>
export default {
  name: 'PageHeader',
  props: {
    title: { type: String, required: true },
    eyebrow: { type: String, default: '' },
    intro: { type: String, default: '' },
    live: { type: Boolean, default: false }
  }
}
</script>

<style scoped>
.ui-page-head {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: var(--space-4);
  flex-wrap: wrap;
  margin-bottom: var(--space-4);
}

.ui-page-head__text {
  min-width: 0;
}

.ui-eyebrow {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  color: #78909c;
  font-size: 0.68rem;
  letter-spacing: 0.07em;
  text-transform: uppercase;
}

.ui-page-title {
  margin: 0.25rem 0 0.3rem;
  font-size: clamp(1.55rem, 3vw, 2.05rem);
  font-weight: 600;
  line-height: 1.15;
  letter-spacing: -0.02em;
}

.ui-page-intro {
  max-width: 720px;
  margin: 0;
  color: #90a4ae;
  font-size: 0.9rem;
  line-height: 1.5;
}

.ui-page-actions {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  flex-wrap: wrap;
}

@media (max-width: 599px) {
  .ui-page-head {
    margin-bottom: var(--space-3);
  }

  .ui-page-title {
    font-size: 1.5rem;
  }
}
</style>
