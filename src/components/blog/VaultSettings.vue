<template>
  <q-card flat bordered class="blog-settings__card vault-settings">
    <q-card-section>
      <div class="vault-settings__head">
        <div>
          <h2 class="blog-settings__section-title">Membership (Banksia Vault)</h2>
          <p class="blog-settings__hint">
            Sell members-only sections or whole posts for HBD. Content is encrypted
            in your browser; Banksia never holds your keys or plaintext. Payments go
            directly to @{{ accountName }}.
          </p>
        </div>
        <q-badge :color="modelValue.enabled ? 'positive' : 'grey-7'" class="vault-settings__badge">
          {{ modelValue.enabled ? 'Enabled' : 'Off' }}
        </q-badge>
      </div>

      <q-banner v-if="!canEdit" rounded class="vault-settings__banner">
        <template #avatar><q-icon name="lock" /></template>
        Sign in as <strong>@{{ accountName || 'the blog owner' }}</strong> from the
        top-right login control to edit these settings. You can still preview the
        current configuration and open the dashboard read-only.
      </q-banner>

      <q-banner v-if="!modelValue.enabled" rounded class="vault-settings__banner">
        <template #avatar><q-icon name="lock" /></template>
        Enabling Vault publishes a Hive Open Market membership product and a hidden
        grant container. Both are signed with your posting key and can be removed
        later by disabling Vault.
      </q-banner>

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
        <q-input
          :model-value="modelValue.recurrence"
          type="number"
          outlined
          dense
          label="Renewal (hours)"
          min="24"
          max="8760"
          :disable="!canEdit || Boolean(busy)"
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

      <div class="vault-settings__grid vault-settings__grid--copy">
        <q-input
          :model-value="modelValue.productTitle"
          outlined
          dense
          label="Product title"
          maxlength="80"
          counter
          :disable="!canEdit || Boolean(busy)"
          hint="Shown on the product and subscribe page."
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
          hint="A short description of the content people are paying for."
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
          @blur="commitBenefits"
        />
      </div>

      <p class="blog-settings__hint">
        The Hive Open Market product is the payment source of truth. The price and
        copy here are used when you publish or update the product post; changing
        them later requires <strong>Update membership product</strong>.
      </p>

      <div v-if="modelValue.product" class="vault-settings__refs">
        <p><strong>Product</strong> <code>{{ modelValue.product }}</code></p>
        <p><strong>Container</strong> <code>{{ modelValue.container }}</code></p>
        <p v-if="modelValue.bulletin.permlink">
          <strong>Latest bulletin</strong>
          <code>{{ modelValue.bulletin.author }}/{{ modelValue.bulletin.permlink }}</code>
        </p>
      </div>

      <q-separator class="q-my-md" />

      <h3 class="vault-settings__subtitle">Creator vault</h3>
      <p class="blog-settings__hint">
        The vault holds your content keys and ring key, encrypted with a passphrase
        you choose. There is no recovery if you lose both the passphrase and your
        export. Never reuse a Hive key as the passphrase.
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

      <div class="vault-settings__actions">
        <q-btn
          unelevated
          no-caps
          color="primary"
          icon="enhanced_encryption"
          label="Generate vault"
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

      <q-separator class="q-my-md" />

      <h3 class="vault-settings__subtitle">On-chain setup</h3>
      <p class="blog-settings__hint">
        Publish the product, then the hidden container. Both are ordinary Hive
        comments signed with your posting key; the queue shows every operation
        before it is broadcast.
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
        <q-btn
          flat
          no-caps
          icon="dashboard"
          label="Open dashboard"
          :to="dashboardPath"
        />
      </div>

      <p v-if="message" class="blog-settings__hint q-mt-sm" role="status">{{ message }}</p>
      <p v-if="error" class="vault-settings__error" role="alert">{{ error }}</p>

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

.vault-settings__grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(190px, 1fr));
  gap: 0.75rem;
  align-items: center;
  margin-top: 0.75rem;
}

.vault-settings__refs {
  margin-top: 0.75rem;
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

.vault-settings__subtitle {
  margin: 0 0 0.35rem;
  font-size: 1rem;
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
</style>

<script>
import { BLOG_MAX_BYTES, VAULT_MAX_BYTES } from 'src/config/blog'
import { defaultVaultSettings, normalizeVaultSettings, formatVaultPrice } from 'src/services/vaultSettings'
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
    },    dashboardPath () {
      return '/settings/blog/vault' + (this.accountName ? '?account=' + encodeURIComponent(this.accountName) : '')
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
    commitBenefits () {
      const benefits = this.benefitsFromText()
      this.benefitsText = benefits.join('\n')
      this.patch({ benefits })
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
        this.message = 'Vault generated and encrypted on this device. Export a backup now.'
        this.patch({ enabled: true })
        this.$emit('save')
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
        const price = formatVaultPrice(this.priceInput) || this.modelValue.price
        const settings = normalizeVaultSettings({
          ...this.modelValue,
          price,
          benefits: this.benefitsFromText()
        }, { account: this.account }).settings
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
          price,
          benefits: this.benefitsFromText()
        })
        this.message = (this.modelValue.product ? 'Product update' : 'Membership product') +
          ' queued. Sign it, then save the Vault settings.'
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
        const price = formatVaultPrice(this.priceInput) || this.modelValue.price
        const settings = normalizeVaultSettings({
          ...this.modelValue,
          price,
          benefits: this.benefitsFromText()
        }, { account: this.account }).settings
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
          price,
          benefits: this.benefitsFromText()
        })
        this.message = 'Product and container queued. Approve both, then save the Vault settings.'
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
        this.message = 'Grant container queued as a reply to the product. Sign it, then save the Vault settings.'
      } catch (err) {
        this.error = err?.message || 'The grant container could not be built.'
      } finally {
        this.busy = ''
      }
    }
  }
}
</script>
