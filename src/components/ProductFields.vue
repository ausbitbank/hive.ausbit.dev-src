<template>
  <section class="product-fields home-card home-panel" aria-labelledby="compose-product-title">
    <div class="home-panel__head">
      <div>
        <div class="home-eyebrow">Hive Open Market</div>
        <h2 id="compose-product-title" class="home-panel__title">Product</h2>
      </div>
      <span class="product-fields__pill" :class="fields.enabled ? 'is-on' : 'is-off'">
        {{ fields.enabled ? 'On' : 'Off' }}
      </span>
    </div>
    <div class="home-panel__body product-fields__body">
      <q-toggle
        :model-value="fields.enabled"
        label="Sell as a Hive Open Market product"
        aria-label="Sell this post as a Hive Open Market product"
        :disable="disabled"
        dense
        @update:model-value="setEnabled"
      />
      <p class="product-fields__hint">
        The post title and body become the product name and description.
        Price, currency, status, subscription and product tags are written to
        <code>json_metadata</code>; buying stays a normal Hive transfer on Banksia.
      </p>

      <template v-if="fields.enabled">
        <div class="product-fields__row">
          <q-input
            :model-value="fields.price"
            class="product-fields__price"
            outlined
            dense
            label="Price"
            aria-label="Product price"
            inputmode="decimal"
            placeholder="0.001"
            :suffix="ticker"
            :disable="disabled"
            @update:model-value="setPrice"
          />
          <q-select
            :model-value="fields.currency"
            :options="currencyOptions"
            outlined
            dense
            emit-value
            map-options
            label="Currency"
            aria-label="Product currency"
            :disable="disabled"
            @update:model-value="setCurrency"
          />
        </div>

        <div class="product-fields__toggle">
          <q-toggle
            :model-value="fields.subscription"
            label="Recurring subscription"
            aria-label="Recurring subscription product"
            :disable="disabled"
            dense
            @update:model-value="setSubscription"
          />
          <span class="product-fields__hint">Buyers pay the same amount on a schedule.</span>
        </div>

        <q-input
          v-if="fields.subscription"
          :model-value="fields.recurrenceHours"
          outlined
          dense
          type="number"
          min="24"
          step="1"
          label="Repeat every (hours)"
          aria-label="Subscription recurrence in hours"
          hint="Minimum 24 hours. 730 hours is about 30 days."
          :disable="disabled"
          @update:model-value="setRecurrence"
        />

        <q-select
          :model-value="fields.status"
          :options="statusOptions"
          outlined
          dense
          emit-value
          map-options
          label="Status"
          aria-label="Product status"
          :disable="disabled"
          @update:model-value="setStatus"
        />

        <q-select
          :model-value="fields.tags"
          :options="tagOptions"
          multiple
          use-input
          use-chips
          fill-input
          hide-selected
          outlined
          dense
          label="Product tags"
          aria-label="Product tags"
          :hint="'Up to ' + maxTags + ' tags. They become the discovery tags in the product metadata; leave empty to use the normal post tags.'"
          :disable="disabled"
          @update:model-value="setTags"
          @new-value="addTag"
        />

        <div class="product-fields__validation" role="status" aria-live="polite">
          <ul v-if="validation.errors.length" class="product-fields__errors">
            <li v-for="error in validation.errors" :key="error">
              <q-icon name="error" size="16px" aria-hidden="true" />
              <span>{{ error }}</span>
            </li>
          </ul>
          <ul v-else class="product-fields__ok">
            <li>
              <q-icon name="check_circle" size="16px" aria-hidden="true" />
              <span>Product details are ready.</span>
            </li>
          </ul>
          <ul v-if="validation.warnings.length" class="product-fields__warnings">
            <li v-for="warning in validation.warnings" :key="warning">
              <q-icon name="warning" size="16px" aria-hidden="true" />
              <span>{{ warning }}</span>
            </li>
          </ul>
        </div>

        <div class="product-fields__preview" aria-label="Product preview">
          <div class="product-fields__preview-label">Shop card preview</div>
          <article class="product-preview">
            <div class="product-preview__media">
              <img v-if="preview.image" :src="preview.image" alt="" loading="lazy" />
              <span v-else class="product-preview__placeholder" aria-hidden="true">
                {{ (preview.title || 'Product').slice(0, 1) }}
              </span>
            </div>
            <div class="product-preview__body">
              <div class="product-preview__price">{{ preview.priceLabel || 'Set a price' }}</div>
              <h3 class="product-preview__title">{{ preview.title || 'Product title' }}</h3>
              <p class="product-preview__meta">
                <span class="product-preview__status">{{ preview.statusLabel }}</span>
                <template v-if="preview.subscription">
                  <span aria-hidden="true">·</span>
                  <span>Every {{ preview.recurrenceHours }} hours</span>
                </template>
              </p>
              <ul v-if="preview.tags.length" class="product-preview__tags" aria-label="Preview product tags">
                <li v-for="tag in preview.tags" :key="tag">#{{ tag }}</li>
              </ul>
            </div>
          </article>
          <p class="product-fields__hint">
            The cover image is used when the product has no image of its own.
            There is no escrow or buyer protection; payment is a direct Hive transfer.
          </p>
        </div>
      </template>
    </div>
  </section>
</template>

<style scoped>
.product-fields {
  min-width: 0;
}

.product-fields__pill {
  padding: 0.15rem 0.55rem;
  border-radius: var(--radius-pill);
  font-size: 0.7rem;
  font-weight: 600;
  letter-spacing: 0.02em;
  text-transform: uppercase;
}

.product-fields__pill.is-on {
  color: var(--c-positive);
  background: color-mix(in srgb, var(--c-positive) 12%, transparent);
}

.product-fields__pill.is-off {
  color: var(--c-text-subtle);
  background: color-mix(in srgb, var(--c-text) 8%, transparent);
}

.product-fields__body {
  display: flex;
  flex-direction: column;
  gap: 0.7rem;
}

.product-fields__hint {
  margin: 0;
  color: var(--c-text-muted);
  font-size: 0.74rem;
  line-height: 1.5;
}

.product-fields__row {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
  gap: 0.5rem;
}

.product-fields__toggle {
  display: flex;
  flex-direction: column;
  gap: 0.15rem;
}

.product-fields__validation ul {
  margin: 0;
  padding: 0;
  list-style: none;
}

.product-fields__validation li {
  display: flex;
  align-items: flex-start;
  gap: 0.35rem;
  font-size: 0.74rem;
  line-height: 1.45;
}

.product-fields__errors {
  color: var(--c-negative);
}

.product-fields__ok {
  color: var(--c-positive);
}

.product-fields__warnings {
  margin-top: 0.25rem !important;
  color: var(--c-warning);
}

.product-fields__preview {
  display: flex;
  flex-direction: column;
  gap: 0.45rem;
  padding-top: 0.7rem;
  border-top: 1px solid var(--border-subtle);
}

.product-fields__preview-label {
  color: var(--c-text-subtle);
  font-size: 0.68rem;
  font-weight: 600;
  letter-spacing: 0.05em;
  text-transform: uppercase;
}

.product-preview {
  display: flex;
  flex-direction: column;
  overflow: hidden;
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-card);
  background: var(--c-surface-2);
}

.product-preview__media {
  aspect-ratio: 4 / 3;
  overflow: hidden;
  background: var(--c-surface);
}

.product-preview__media img {
  display: block;
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.product-preview__placeholder {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  height: 100%;
  color: var(--c-text-faint);
  font-family: var(--font-display);
  font-size: 2.4rem;
}

.product-preview__body {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  padding: 0.7rem 0.8rem 0.8rem;
}

.product-preview__price {
  color: var(--c-primary);
  font-size: 0.8rem;
  font-weight: 700;
  letter-spacing: 0.02em;
}

.product-preview__title {
  margin: 0;
  color: var(--c-text);
  font-family: var(--font-display);
  font-size: 1.05rem;
  line-height: 1.3;
}

.product-preview__meta {
  display: flex;
  flex-wrap: wrap;
  gap: 0.3rem;
  margin: 0;
  color: var(--c-text-muted);
  font-size: 0.74rem;
}

.product-preview__status {
  color: var(--c-text);
}

.product-preview__tags {
  display: flex;
  flex-wrap: wrap;
  gap: 0.3rem;
  margin: 0.15rem 0 0;
  padding: 0;
  list-style: none;
}

.product-preview__tags li {
  color: var(--c-text-subtle);
  font-size: 0.7rem;
}

@media (max-width: 599px) {
  .product-fields__row {
    grid-template-columns: minmax(0, 1fr);
  }
}
</style>

<script>
import {
  PRODUCT_CURRENCIES,
  PRODUCT_MAX_TAGS,
  PRODUCT_STATUS_LABELS,
  normalizeProductFields,
  normalizeProductTags,
  productPreview,
  validateProductFields
} from 'src/services/productDraft'

function tickerFor (currency) {
  return String(currency || '').split(':')[1] || ''
}

export default {
  name: 'ProductFields',
  props: {
    modelValue: { type: Object, default: null },
    title: { type: String, default: '' },
    description: { type: String, default: '' },
    coverImage: { type: String, default: '' },
    disabled: { type: Boolean, default: false }
  },
  emits: ['update:modelValue', 'validation'],
  data () {
    return {
      maxTags: PRODUCT_MAX_TAGS,
      currencyOptions: [
        { label: 'HBD (HIVE:HBD)', value: 'HIVE:HBD' },
        { label: 'HIVE (HIVE:HIVE)', value: 'HIVE:HIVE' }
      ],
      statusOptions: Object.keys(PRODUCT_STATUS_LABELS).map(key => ({
        label: PRODUCT_STATUS_LABELS[key],
        value: Number(key)
      }))
    }
  },
  computed: {
    fields () {
      return normalizeProductFields(this.modelValue)
    },
    ticker () {
      return tickerFor(this.fields.currency)
    },
    tagOptions () {
      return this.fields.tags
    },
    preview () {
      const ownImages = this.fields.image.length
        ? this.fields.image
        : (this.coverImage ? [this.coverImage] : [])
      return productPreview({
        ...this.fields,
        title: this.title,
        image: ownImages
      })
    },
    validation () {
      return validateProductFields(this.fields, {
        title: this.title,
        description: this.description
      })
    }
  },
  watch: {
    validation: {
      deep: true,
      immediate: true,
      handler (value) {
        this.$emit('validation', value)
      }
    }
  },
  methods: {
    emitFields (patch) {
      const next = normalizeProductFields({ ...this.fields, ...patch })
      this.$emit('update:modelValue', next)
      return next
    },
    setEnabled (value) {
      this.emitFields({ enabled: value === true })
    },
    setPrice (value) {
      this.emitFields({ price: value })
    },
    setCurrency (value) {
      const currency = PRODUCT_CURRENCIES.includes(value) ? value : this.fields.currency
      this.emitFields({ currency })
    },
    setSubscription (value) {
      this.emitFields({ subscription: value === true })
    },
    setRecurrence (value) {
      this.emitFields({ recurrenceHours: value })
    },
    setStatus (value) {
      const status = PRODUCT_STATUS_LABELS[Number(value)] ? Number(value) : this.fields.status
      this.emitFields({ status })
    },
    setTags (value) {
      this.emitFields({ tags: normalizeProductTags(value) })
    },
    addTag (value, done) {
      done(value, 'add-unique')
    }
  }
}
</script>
