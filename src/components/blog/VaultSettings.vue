<template>
  <q-card flat bordered class="blog-settings__card vault-settings">
    <q-card-section>
      <div class="vault-settings__head">
        <div>
          <h2 class="blog-settings__section-title">Membership (Banksia Vault)</h2>
          <p class="blog-settings__hint">
            Sell members-only sections or whole posts for HBD. Content is encrypted
            in your browser; Banksia never holds your keys or plaintext. Payments go
            directly to @{{ accountName }} — there is no platform fee.
          </p>
        </div>
        <q-badge :color="configured ? 'positive' : 'grey-7'" class="vault-settings__badge">
          {{ configured ? 'Live' : 'Off' }}
        </q-badge>
      </div>

      <q-banner v-if="!canEdit" rounded class="vault-settings__banner">
        <template #avatar><q-icon name="lock" /></template>
        Sign in as <strong>@{{ accountName || 'the blog owner' }}</strong> from the
        top-right login control to edit these settings. You can still preview the
        current configuration and open the dashboard read-only.
      </q-banner>

      <div v-if="configured" class="vault-status" role="status">
        <div>
          <p class="vault-status__title">Memberships are live</p>
          <p class="vault-status__copy">
            {{ modelValue.price }} {{ cadenceLabel }} · readers pay you directly.
          </p>
        </div>
        <q-btn flat no-caps color="primary" icon="dashboard" label="Open dashboard" :to="dashboardPath" />
      </div>

      <section class="vault-step" aria-labelledby="vault-offer-title">
        <h3 id="vault-offer-title" class="vault-settings__subtitle">
          <span class="vault-step__number" aria-hidden="true">1</span>
          Your offer
        </h3>
        <p class="blog-settings__hint">
          This is what readers see on your membership page and at the end of a
          members-only post. You can change it later.
        </p>

        <div class="vault-settings__grid">
          <q-input
            v-model="priceInput"
            outlined
            dense
            label="Price"
            suffix="HBD"
            :disable="!canEdit || Boolean(busy)"
            :rules="[priceRule]"
            @blur="commitPrice"
            @keyup.enter="commitPrice"
          />
        </div>

        <div class="vault-settings__grid vault-settings__grid--copy">
          <q-input
            :model-value="modelValue.productTitle"
            outlined
            dense
            label="Membership name"
            maxlength="80"
            counter
            :disable="!canEdit || Boolean(busy)"
            hint="Shown as the title of your membership page."
            @update:model-value="patch({ productTitle: $event })"
          />
          <q-input
            :model-value="modelValue.productDescription"
            type="textarea"
            autogrow
            outlined
            dense
            label="What members get"
            maxlength="600"
            counter
            :disable="!canEdit || Boolean(busy)"
            hint="A short, friendly description of the content people are paying for."
            @update:model-value="patch({ productDescription: $event })"
          />
          <q-input
            v-model="benefitsText"
            type="textarea"
            autogrow
            outlined
            dense
            label="Benefits (one per line, up to 6)"
            :disable="!canEdit || Boolean(busy)"
            hint="Short bullets shown on the paywall, product page and subscribe page."
            @blur="commitBenefits"
          />
        </div>
      </section>

      <section v-if="!vaultStored && !configured" class="vault-step" aria-labelledby="vault-passphrase-title">
        <h3 id="vault-passphrase-title" class="vault-settings__subtitle">
          <span class="vault-step__number" aria-hidden="true">2</span>
          Protect your content
        </h3>
        <p class="blog-settings__hint">
          Choose a passphrase for the vault that holds your content keys. It is
          encrypted on this device and never sent anywhere. If you lose both the
          passphrase and your backup file, you cannot read your own members-only
          posts again. Never reuse a Hive key as the passphrase.
        </p>

        <div class="vault-settings__grid">
          <q-input
            v-model="passphrase"
            type="password"
            outlined
            dense
            label="Vault passphrase"
            autocomplete="new-password"
            :disable="!canEdit || Boolean(busy)"
          />
          <q-input
            v-model="passphraseConfirm"
            type="password"
            outlined
            dense
            label="Confirm passphrase"
            autocomplete="new-password"
            :disable="!canEdit || Boolean(busy)"
          />
        </div>
      </section>

      <p v-else-if="vaultStored" class="vault-status__copy vault-status__copy--ok">
        <q-icon name="check_circle" size="16px" aria-hidden="true" />
        Vault ready on this device.
      </p>
      <p v-else class="vault-status__copy">
        This device does not have your vault yet. Import your encrypted backup in
        advanced settings to publish members-only posts or give access. Updating
        your offer does not need the vault.
      </p>

      <div class="vault-primary">
        <q-btn
          v-if="!configured"
          unelevated
          no-caps
          color="primary"
          icon="rocket_launch"
          label="Turn on memberships"
          :loading="busy === 'enable'"
          :disable="!canEdit || Boolean(busy)"
          @click="enableMembership"
        />
        <template v-else>
          <q-btn
            unelevated
            no-caps
            color="primary"
            icon="save"
            label="Save offer & update membership"
            :loading="busy === 'offer'"
            :disable="!canEdit || Boolean(busy)"
            @click="saveOffer"
          />
          <q-btn flat no-caps color="primary" label="Preview membership page" :to="productPath" />
        </template>
      </div>
      <p class="blog-settings__hint">
        <template v-if="!configured">
          This creates the passphrase-protected vault, publishes your membership
          page, and saves the setting. Approve the prompts in your signing queue.
        </template>
        <template v-else>
          Price changes apply to new subscriptions. Existing recurring payments keep
          their original amount until the reader updates them.
        </template>
      </p>

      <p v-if="message" class="blog-settings__hint q-mt-sm vault-status__copy--ok" role="status">{{ message }}</p>
      <p v-if="error" class="vault-settings__error" role="alert">{{ error }}</p>

      <details class="vault-advanced">
        <summary>Advanced settings</summary>

        <div class="vault-settings__grid">
          <q-toggle
            :model-value="modelValue.enabled"
            label="Enable members-only content"
            :disable="!canEdit || Boolean(busy)"
            @update:model-value="patch({ enabled: $event })"
          />
          <q-toggle
            :model-value="modelValue.watermark"
            label="Show a reader watermark"
            :disable="!canEdit || Boolean(busy)"
            @update:model-value="patch({ watermark: $event })"
          />
        </div>

        <div class="vault-settings__grid">
          <q-input
            :model-value="modelValue.recurrence"
            type="number"
            outlined
            dense
            label="Renewal (hours)"
            min="24"
            max="8760"
            :disable="!canEdit || Boolean(busy)"
            hint="730 hours is one month."
            @update:model-value="patch({ recurrence: Number($event) || 730 })"
          />
          <q-input
            :model-value="modelValue.executions"
            type="number"
            outlined
            dense
            label="Payments"
            min="2"
            max="120"
            :disable="!canEdit || Boolean(busy)"
            hint="How many recurring payments a reader approves."
            @update:model-value="patch({ executions: Number($event) || 12 })"
          />
          <q-select
            :model-value="modelValue.archive"
            :options="archiveOptions"
            outlined
            dense
            label="Archive access"
            emit-value
            map-options
            :disable="!canEdit || Boolean(busy)"
            @update:model-value="patch({ archive: $event })"
          />
        </div>

        <div v-if="modelValue.product" class="vault-settings__refs">
          <p><strong>Product</strong> <code>{{ modelValue.product }}</code></p>
          <p><strong>Container</strong> <code>{{ modelValue.container }}</code></p>
          <p v-if="modelValue.bulletin.permlink">
            <strong>Latest access update</strong>
            <code>{{ modelValue.bulletin.author }}/{{ modelValue.bulletin.permlink }}</code>
          </p>
        </div>

        <h4 class="vault-settings__subtitle">Vault backup</h4>
        <p class="blog-settings__hint">
          Export a passphrase-encrypted backup and keep it somewhere safe. It is
          the only way to recover your content keys on a new device.
        </p>

        <div class="vault-settings__actions">
          <q-btn
            v-if="!configured && !vaultStored"
            unelevated
            no-caps
            color="primary"
            icon="enhanced_encryption"
            label="Create vault only"
            :loading="busy === 'generate'"
            :disable="!canEdit || Boolean(busy) || !passphraseValid"
            @click="generateVault"
          />
          <q-btn
            outline
            no-caps
            icon="download"
            label="Export vault"
            :loading="busy === 'export'"
            :disable="!canEdit || Boolean(busy) || !passphrase"
            @click="exportVault"
          />
          <q-btn
            outline
            no-caps
            icon="upload"
            label="Import vault"
            :disable="!canEdit || Boolean(busy) || !passphrase"
            @click="$refs.vaultFile && $refs.vaultFile.click()"
          />
          <input
            ref="vaultFile"
            type="file"
            accept="application/json,.json"
            class="vault-settings__file"
            @change="importVault"
          />
        </div>

        <h4 class="vault-settings__subtitle">Hive setup</h4>
        <p class="blog-settings__hint">
          Publish the membership product and its hidden access container. Both are
          ordinary Hive comments signed with your posting key; the queue shows
          every operation before it is broadcast.
        </p>
        <div class="vault-settings__actions">
          <q-btn
            v-if="!modelValue.product"
            unelevated
            no-caps
            color="primary"
            icon="rocket_launch"
            label="Publish product & container"
            :loading="busy === 'product'"
            :disable="!canEdit || Boolean(busy)"
            @click="publishSetup"
          />
          <template v-else>
            <q-btn
              outline
              no-caps
              icon="storefront"
              :label="productButtonLabel"
              :loading="busy === 'product'"
              :disable="!canEdit || Boolean(busy)"
              @click="publishProduct"
            />
            <q-btn
              outline
              no-caps
              icon="inventory_2"
              label="Publish grant container"
              :loading="busy === 'container'"
              :disable="!canEdit || Boolean(busy) || !modelValue.product"
              @click="publishContainer"
            />
          </template>
        </div>

        <div class="vault-settings__save">
          <q-btn
            unelevated
            no-caps
            color="primary"
            label="Save Vault settings"
            :disable="!canEdit || Boolean(busy)"
            @click="$emit('save')"
          />
          <span class="blog-settings__size">Vault object: {{ size }} bytes</span>
        </div>
      </details>
    </q-card-section>
  </q-card>
</template>

<style scoped>
.vault-settings__head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 1rem;
}

.vault-settings__badge {
  flex: none;
  margin-top: 0.2rem;
}

.vault-settings__banner {
  margin: 0.75rem 0 1rem;
  background: var(--c-surface-2);
  color: var(--c-text);
  border: 1px solid var(--c-border);
  font-size: 0.84rem;
}

.vault-status {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  flex-wrap: wrap;
  margin: 0.9rem 0 0;
  padding: 0.9rem 1rem;
  border: 1px solid color-mix(in srgb, var(--c-positive) 40%, var(--c-border));
  border-radius: 10px;
  background: color-mix(in srgb, var(--c-positive) 8%, var(--c-surface));
}

.vault-status__title {
  margin: 0;
  font-weight: 700;
}

.vault-status__copy {
  margin: 0.2rem 0 0;
  color: var(--c-text-muted);
  font-size: 0.84rem;
}

.vault-status__copy--ok {
  display: flex;
  align-items: center;
  gap: 0.35rem;
  color: var(--c-positive);
}

.vault-step {
  margin-top: 1.4rem;
}

.vault-settings__subtitle {
  display: flex;
  align-items: center;
  gap: 0.45rem;
  margin: 0 0 0.35rem;
  font-size: 1rem;
}

.vault-step__number {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 1.55rem;
  height: 1.55rem;
  border: 1px solid var(--c-primary);
  border-radius: 50%;
  color: var(--c-primary);
  font-size: 0.8rem;
  font-weight: 700;
}

.vault-settings__grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(190px, 1fr));
  gap: 0.75rem;
  align-items: start;
  margin-top: 0.75rem;
}

.vault-settings__refs {
  margin-top: 0.9rem;
  padding: 0.75rem;
  border: 1px solid var(--c-border);
  border-radius: 10px;
  background: var(--c-surface-2);
  font-size: 0.82rem;
}

.vault-settings__refs p {
  margin: 0.2rem 0;
  overflow-wrap: anywhere;
}

.vault-primary {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  margin-top: 1.1rem;
}

.vault-settings__actions {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  margin-top: 0.75rem;
}

.vault-settings__file {
  display: none;
}

.vault-settings__error {
  margin: 0.5rem 0 0;
  color: var(--c-warning);
  font-size: 0.84rem;
}

.vault-settings__save {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  flex-wrap: wrap;
  margin-top: 1rem;
}

.vault-advanced {
  margin-top: 1.4rem;
  padding-top: 0.9rem;
  border-top: 1px solid var(--c-border-subtle);
}

.vault-advanced summary {
  cursor: pointer;
  color: var(--c-link);
  font-size: 0.86rem;
  font-weight: 600;
}
</style>

<script>
import { BLOG_MAX_BYTES, VAULT_MAX_BYTES } from 'src/config/blog'
import {
  defaultVaultSettings,
  formatVaultPrice,
  normalizeVaultSettings
} from 'src/services/vaultSettings'
import { vaultRecurrencePhrase } from 'src/services/vaultPayments'
import {
  createCreatorVault,
  saveCreatorVault,
  loadCreatorVault,
  hasCreatorVault,
  exportCreatorVault,
  importCreatorVault
} from 'src/services/vaultKeys'
import {
  buildVaultContainerOperation,
  buildVaultProductOperation
} from 'src/services/vaultProduct'
import { setCreatorVaultSession } from 'src/services/vaultSession'

export default {
  name: 'VaultSettings',
  props: {
    account: { type: Object, default: null },
    modelValue: { type: Object, default: () => defaultVaultSettings() },
    canEdit: { type: Boolean, default: false }
  },
  emits: ['update:modelValue', 'save', 'queue'],
  data () {
    return {
      passphrase: '',
      passphraseConfirm: '',
      priceInput: '',
      benefitsText: '',
      vaultStored: false,
      busy: '',
      message: '',
      error: '',
      archiveOptions: [
        { label: 'Full archive', value: 'all' },
        { label: 'Current period only', value: 'current' }
      ]
    }
  },
  computed: {
    accountName () {
      return (this.account && this.account.name) || ''
    },
    dashboardPath () {
      return '/settings/blog/vault' + (this.accountName ? '?account=' + encodeURIComponent(this.accountName) : '')
    },
    productPath () {
      const product = String(this.modelValue.product || '').trim()
      if (!product.includes('/')) return this.accountName ? '/@' + this.accountName : '/'
      const [author, permlink] = product.split('/')
      return '/@' + author + '/' + permlink
    },
    configured () {
      return Boolean(this.modelValue.enabled && this.modelValue.product)
    },
    cadenceLabel () {
      return vaultRecurrencePhrase(this.modelValue.recurrence)
    },
    passphraseValid () {
      return this.passphrase.length >= 10 && this.passphrase === this.passphraseConfirm
    },
    size () {
      try {
        return new TextEncoder().encode(JSON.stringify(this.modelValue)).length
      } catch {
        return 0
      }
    },
    maxBytes () {
      return Math.min(VAULT_MAX_BYTES, BLOG_MAX_BYTES)
    },
    productButtonLabel () {
      return this.modelValue.product ? 'Update membership product' : 'Publish membership product'
    }
  },
  watch: {
    'modelValue.price' (value) {
      this.priceInput = typeof value === 'string' ? value : ''
    },
    'modelValue.benefits' (value) {
      this.benefitsText = Array.isArray(value) ? value.join('\n') : ''
    }
  },
  created () {
    this.priceInput = this.modelValue.price || ''
    this.benefitsText = Array.isArray(this.modelValue.benefits) ? this.modelValue.benefits.join('\n') : ''
    this.vaultStored = Boolean(this.accountName && hasCreatorVault(this.accountName))
  },
  methods: {
    patch (changes) {
      const next = normalizeVaultSettings({ ...this.modelValue, ...changes }, { account: this.account })
      this.$emit('update:modelValue', next.settings)
      if (!next.ok) this.error = next.errors[0] || 'The Vault settings are not valid.'
      else this.error = ''
    },
    commitPrice () {
      const formatted = formatVaultPrice(this.priceInput)
      if (!formatted) {
        this.error = 'Use a price like 5.000 HBD'
        this.priceInput = this.modelValue.price || ''
        return
      }
      this.priceInput = formatted
      this.patch({ price: formatted })
    },
    priceRule (value) {
      return Boolean(formatVaultPrice(value)) || 'Use a price like 5.000 HBD'
    },
    benefitsFromText () {
      return String(this.benefitsText || '')
        .split('\n')
        .map(item => item.trim().slice(0, 80))
        .filter(Boolean)
        .slice(0, 6)
    },
    offerSettings () {
      const price = formatVaultPrice(this.priceInput) || this.modelValue.price
      if (!formatVaultPrice(price)) throw new Error('Enter a price like 5.000 HBD.')
      return normalizeVaultSettings({
        ...this.modelValue,
        price,
        benefits: this.benefitsFromText()
      }, { account: this.account }).settings
    },
    async ensureVaultForEnable () {
      if (this.vaultStored) return
      if (!this.passphraseValid) {
        throw new Error('Choose a passphrase of at least 10 characters and confirm it.')
      }
      const vault = await createCreatorVault({
        account: this.accountName,
        passphrase: this.passphrase
      })
      await saveCreatorVault(this.accountName, vault, this.passphrase)
      setCreatorVaultSession(this.accountName, vault)
      this.vaultStored = true
    },
    async enableMembership () {
      this.error = ''
      this.message = ''
      if (!this.canEdit || this.busy) return
      this.busy = 'enable'
      try {
        await this.ensureVaultForEnable()
        const settings = this.offerSettings()
        const product = buildVaultProductOperation({
          account: this.accountName,
          settings,
          permlink: 'membership'
        })
        const container = buildVaultContainerOperation({
          account: this.accountName,
          container: settings.container,
          parentAuthor: this.accountName,
          parentPermlink: 'membership'
        })
        if (!product) throw new Error('The membership page could not be built.')
        if (!container) throw new Error('The access container could not be built.')
        this.$emit('queue', product)
        this.$emit('queue', container)
        this.patch({
          enabled: true,
          product: this.accountName + '/membership',
          price: settings.price,
          productTitle: settings.productTitle,
          productDescription: settings.productDescription,
          benefits: settings.benefits
        })
        this.message = 'Membership created. Approve the membership page, access setup and settings in your signing queue.'
        await this.$nextTick()
        this.$emit('save')
      } catch (err) {
        this.error = err?.message || 'The membership could not be turned on.'
      } finally {
        this.busy = ''
      }
    },
    async saveOffer () {
      this.error = ''
      this.message = ''
      if (!this.canEdit || this.busy) return
      this.busy = 'offer'
      try {
        this.publishProduct()
        if (this.error) return
        await this.$nextTick()
        this.$emit('save')
      } finally {
        this.busy = ''
      }
    },
    async generateVault () {
      this.error = ''
      this.message = ''
      if (!this.passphraseValid) {
        this.error = 'Use a passphrase of at least 10 characters and confirm it.'
        return
      }
      this.busy = 'generate'
      try {
        const vault = await createCreatorVault({
          account: this.accountName,
          passphrase: this.passphrase
        })
        await saveCreatorVault(this.accountName, vault, this.passphrase)
        setCreatorVaultSession(this.accountName, vault)
        this.vaultStored = true
        this.message = 'Vault created and encrypted on this device. Export a backup now.'
        this.error = ''
      } catch (err) {
        this.error = err?.message || 'The vault could not be generated.'
      } finally {
        this.busy = ''
      }
    },
    async exportVault () {
      this.error = ''
      this.message = ''
      this.busy = 'export'
      try {
        if (!hasCreatorVault(this.accountName)) {
          this.error = 'No vault is stored on this device for @' + this.accountName + '.'
          return
        }
        const vault = await loadCreatorVault(this.accountName, this.passphrase)
        if (!vault) {
          this.error = 'No vault is stored on this device.'
          return
        }
        const envelope = await exportCreatorVault(vault, this.passphrase)
        const blob = new Blob([JSON.stringify(envelope, null, 2)], { type: 'application/json' })
        const url = URL.createObjectURL(blob)
        const link = document.createElement('a')
        link.href = url
        link.download = 'banksia-vault-' + this.accountName + '.json'
        link.click()
        URL.revokeObjectURL(url)
        this.message = 'Encrypted vault exported. Store it somewhere safe.'
      } catch (err) {
        this.error = err?.message || 'The vault could not be exported. Check the passphrase.'
      } finally {
        this.busy = ''
      }
    },
    async importVault (event) {
      this.error = ''
      this.message = ''
      const file = event?.target?.files?.[0]
      if (!file) return
      this.busy = 'import'
      try {
        if (!this.passphrase) {
          this.error = 'Enter the passphrase that protects the vault file first.'
          return
        }
        const text = await file.text()
        const vault = await importCreatorVault(text, this.passphrase)
        await saveCreatorVault(this.accountName, vault, this.passphrase)
        setCreatorVaultSession(this.accountName, vault)
        this.vaultStored = true
        this.message = 'Vault imported and re-encrypted on this device.'
      } catch (err) {
        this.error = err?.message || 'That vault file could not be imported.'
      } finally {
        if (event?.target) event.target.value = ''
        this.busy = ''
      }
    },
    publishProduct () {
      this.error = ''
      this.message = ''
      this.busy = 'product'
      try {
        const settings = this.offerSettings()
        const operation = buildVaultProductOperation({
          account: this.accountName,
          settings,
          permlink: 'membership'
        })
        if (!operation) throw new Error('Set a valid price before publishing the product.')
        this.$emit('queue', operation)
        this.patch({
          enabled: true,
          product: this.accountName + '/membership',
          price: settings.price,
          productTitle: settings.productTitle,
          productDescription: settings.productDescription,
          benefits: settings.benefits
        })
        this.message = (this.modelValue.product ? 'Membership update' : 'Membership page') +
          ' queued. Approve it in your signing queue.'
      } catch (err) {
        this.error = err?.message || 'The membership product could not be built.'
      } finally {
        this.busy = ''
      }
    },
    async publishSetup () {
      this.error = ''
      this.message = ''
      this.busy = 'product'
      try {
        const settings = this.offerSettings()
        const product = buildVaultProductOperation({
          account: this.accountName,
          settings,
          permlink: 'membership'
        })
        if (!product) throw new Error('Set a valid price before publishing the product.')
        const container = buildVaultContainerOperation({
          account: this.accountName,
          container: settings.container,
          parentAuthor: this.accountName,
          parentPermlink: 'membership'
        })
        if (!container) throw new Error('The container permlink is not valid.')
        this.$emit('queue', product)
        this.$emit('queue', container)
        this.patch({
          enabled: true,
          product: this.accountName + '/membership',
          price: settings.price,
          productTitle: settings.productTitle,
          productDescription: settings.productDescription,
          benefits: settings.benefits
        })
        this.message = 'Product and access container queued. Approve both, then save the Vault settings.'
      } catch (err) {
        this.error = err?.message || 'The Vault setup could not be prepared.'
      } finally {
        this.busy = ''
      }
    },
    publishContainer () {
      this.error = ''
      this.message = ''
      this.busy = 'container'
      try {
        const product = String(this.modelValue.product || '').trim().toLowerCase()
        const [productAuthor, productPermlink] = product.split('/')
        if (!productAuthor || !productPermlink) {
          throw new Error('Publish the membership product first; the container is a reply under it.')
        }
        if (productAuthor !== this.accountName) {
          throw new Error('The membership product must be authored by @' + this.accountName + '.')
        }
        const operation = buildVaultContainerOperation({
          account: this.accountName,
          container: this.modelValue.container,
          parentAuthor: this.accountName,
          parentPermlink: productPermlink
        })
        if (!operation) throw new Error('The container permlink is not valid.')
        this.$emit('queue', operation)
        this.message = 'Access container queued as a reply to the product. Approve it, then save the Vault settings.'
      } catch (err) {
        this.error = err?.message || 'The grant container could not be built.'
      } finally {
        this.busy = ''
      }
    }
  }
}
</script>
