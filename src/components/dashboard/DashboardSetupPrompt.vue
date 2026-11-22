<template>
  <section class="dw-setup" aria-labelledby="dw-setup-title">
    <div class="dw-setup__icon" aria-hidden="true">
      <q-icon name="dashboard_customize" size="22px" />
    </div>
    <div class="dw-setup__text">
      <h2 id="dw-setup-title" class="dw-setup__title">Make this dashboard yours</h2>
      <p class="dw-setup__body">
        Add your wallet, witness and notifications to the front page, then drag
        the cards into the order you want. Or open Customise → Layouts to start
        from a Creator, Witness, Trader or Community template.
      </p>
    </div>
    <div class="dw-setup__actions">
      <q-btn flat no-caps dense label="Not now" @click="$emit('dismiss')" />
      <q-btn
        no-caps
        dense
        unelevated
        color="primary"
        icon="auto_awesome"
        label="Use my starter layout"
        @click="$emit('apply')"
      />
    </div>
  </section>
</template>

<style scoped>
.dw-setup {
  display: flex;
  align-items: center;
  gap: 0.7rem;
  flex-wrap: wrap;
  margin-bottom: var(--space-4);
  padding: 0.7rem 0.85rem;
  border: 1px solid color-mix(in srgb, var(--c-link) 30%, transparent);
  border-radius: var(--radius-card);
  background: linear-gradient(135deg, color-mix(in srgb, var(--c-link) 9%, transparent), color-mix(in srgb, var(--c-link) 2%, transparent));
}

.dw-setup__icon {
  display: inline-flex;
  flex: none;
  align-items: center;
  justify-content: center;
  width: 38px;
  height: 38px;
  border-radius: 50%;
  background: color-mix(in srgb, var(--c-link) 14%, transparent);
  color: var(--c-link-hover);
}

.dw-setup__text {
  flex: 1 1 260px;
  min-width: 0;
}

.dw-setup__title {
  margin: 0;
  color: var(--c-text);
  font-size: 0.92rem;
  font-weight: 600;
}

.dw-setup__body {
  margin: 0.15rem 0 0;
  color: var(--c-text-subtle);
  font-size: 0.78rem;
  line-height: 1.45;
}

.dw-setup__actions {
  display: flex;
  align-items: center;
  gap: 0.35rem;
  flex-wrap: wrap;
}

@media (max-width: 599px) {
  .dw-setup__actions {
    width: 100%;
    justify-content: flex-end;
  }
}
</style>

<script>
export default {
  name: 'DashboardSetupPrompt',
  emits: ['apply', 'dismiss']
}
</script>
