<template>
  <q-page class="mod-page">
    <div class="mod-shell">
      <header class="mod-head">
        <div class="mod-eyebrow">
          <q-icon name="shield" size="16px" aria-hidden="true" />
          Settings
        </div>
        <h1 class="mod-title">Moderation</h1>
        <p class="mod-intro">
          How this device labels, collapses or hides content. These are local
          choices: nothing here changes the blockchain, your rewards or what
          other people see. Hive reputation, votes and mute lists are shown as
          facts; the policy decides what to do with them.
        </p>
      </header>

      <section class="mod-section" aria-labelledby="mod-preset-title">
        <div class="mod-section__head">
          <div>
            <h2 id="mod-preset-title" class="mod-section__title">Preset</h2>
            <p class="mod-section__hint">Start from a preset. Every rule stays visible and can be customised.</p>
          </div>
        </div>
        <div class="mod-presets">
          <button
            v-for="preset in presetOptions"
            :key="preset.value"
            type="button"
            class="mod-preset"
            :class="{ 'is-active': moderation.contentPreset === preset.value }"
            :aria-pressed="moderation.contentPreset === preset.value"
            @click="selectPreset(preset.value)"
          >
            <strong>{{ preset.label }}</strong>
            <span>{{ preset.detail }}</span>
          </button>
        </div>
      </section>

      <section class="mod-section" aria-labelledby="mod-matrix-title">
        <div class="mod-section__head">
          <div>
            <h2 id="mod-matrix-title" class="mod-section__title">Per-surface rules</h2>
            <p class="mod-section__hint">
              Custom mode uses this table. Label keeps the content and adds a note; collapse hides the body and keeps
              an explanation; hide removes the item from the list.
            </p>
          </div>
          <q-btn
            v-if="moderation.contentPreset !== 'custom'"
            outline
            no-caps
            color="primary"
            icon="tune"
            label="Switch to Custom"
            @click="selectPreset('custom')"
          />
        </div>

        <div class="mod-table-wrap" tabindex="0" role="region" aria-label="Moderation rules table">
          <table class="mod-table">
            <caption class="sr-only">Moderation display rule per surface and signal</caption>
            <thead>
              <tr>
                <th scope="col">Signal</th>
                <th v-for="surface in customSurfaces" :key="surface" scope="col">{{ surfaceLabel(surface) }}</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="signal in contentSignals" :key="signal">
                <th scope="row">{{ signalLabel(signal) }}</th>
                <td v-for="surface in customSurfaces" :key="surface">
                  <q-select
                    :model-value="ruleFor(surface, signal)"
                    :options="displayOptions"
                    dense
                    borderless
                    emit-value
                    map-options
                    :disable="moderation.contentPreset !== 'custom'"
                    :aria-label="signalLabel(signal) + ' on ' + surfaceLabel(surface)"
                    @update:model-value="setRule(surface, signal, $event)"
                  />
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      <section class="mod-section" aria-labelledby="mod-lists-title">
        <div class="mod-section__head">
          <div>
            <h2 id="mod-lists-title" class="mod-section__title">Your lists</h2>
            <p class="mod-section__hint">Chain facts, read from your account. Mute and blacklist are different layers.</p>
          </div>
          <q-btn flat dense no-caps icon="refresh" label="Refresh" :loading="refreshing" @click="refreshLists" />
        </div>

        <div class="mod-list-grid">
          <div class="mod-list-card">
            <span class="mod-list-card__label">Direct mutes</span>
            <strong>{{ moderation.context.muted.length }}</strong>
            <span>Accounts you ignore in Hive.</span>
          </div>
          <div class="mod-list-card">
            <span class="mod-list-card__label">Your blacklist</span>
            <strong>{{ moderation.context.blacklisted.length }}</strong>
            <span>Warnings, not mutes.</span>
          </div>
          <div class="mod-list-card">
            <span class="mod-list-card__label">Mute lists you follow</span>
            <strong>{{ moderation.context.followedMuteOwners.length }}</strong>
            <span>Opt-in lists; follows beat them by default.</span>
          </div>
          <div class="mod-list-card">
            <span class="mod-list-card__label">Blacklist lists you follow</span>
            <strong>{{ moderation.context.followedBlacklistOwners.length }}</strong>
            <span>Warning lists, shown as labels.</span>
          </div>
        </div>

        <div v-if="followedLists.length" class="mod-list-owner">
          <h3 class="mod-subtitle">Lists you subscribe to</h3>
          <ul class="mod-list">
            <li v-for="list in followedLists" :key="list.type + ':' + list.owner">
              <router-link :to="'/@' + list.owner">@{{ list.owner }}</router-link>
              <q-badge color="blue-grey-9">{{ list.type }}</q-badge>
              <span v-if="list.description">{{ list.description }}</span>
              <span v-if="list.members !== null" class="mod-list__count">{{ list.members }} member{{ list.members === 1 ? '' : 's' }}</span>
              <button type="button" class="mod-link" @click="subscribeList(list.owner, list.type, false)">Unsubscribe</button>
            </li>
          </ul>
        </div>

        <div class="mod-subscribe">
          <h3 class="mod-subtitle">Subscribe to a list</h3>
          <p class="mod-section__hint">
            Explicit and opt-in. The action is queued with your posting key and preserves
            your existing follow, mute and blacklist flags. Provenance is the list owner's profile.
          </p>
          <div class="mod-subscribe__row">
            <q-input v-model="newListOwner" dense outlined label="List owner account" aria-label="List owner account" />
            <q-select v-model="newListType" :options="listTypeOptions" dense outlined emit-value map-options label="List type" aria-label="List type" />
            <q-btn unelevated no-caps color="primary" icon="add" label="Subscribe" :disable="!newListOwner.trim()" @click="subscribeList(newListOwner, newListType, true)" />
          </div>
          <p v-if="!$hiveStore.user.username" class="mod-section__hint">Sign in to subscribe; the action uses posting authority.</p>
        </div>

        <div class="mod-discovery">
          <div class="mod-section__head">
            <div>
              <h3 class="mod-subtitle">Discover lists</h3>
              <p class="mod-section__hint">
                Hive has no global list directory. These are curated seeds verified against the chain;
                none is subscribed by default. Counts refresh from the live lists where practical.
              </p>
            </div>
            <q-btn flat dense no-caps icon="refresh" label="Refresh counts" :loading="discoveryLoading" @click="loadDiscoveryCounts" />
          </div>

          <div v-for="group in discoveryGroups" :key="'discover-' + group.key" class="mod-discovery__group">
            <h4 class="mod-discovery__group-title">{{ group.label }}</h4>
            <div class="mod-discovery__grid">
              <article v-for="item in group.items" :key="item.id" class="mod-discovery__card">
                <div class="mod-discovery__head">
                  <div>
                    <div class="mod-discovery__title">{{ item.title }}</div>
                    <router-link :to="'/@' + item.owner" class="mod-discovery__owner">@{{ item.owner }}</router-link>
                  </div>
                  <div class="mod-discovery__badges">
                    <q-badge color="blue-grey-9">{{ item.type }}</q-badge>
                    <q-badge :color="item.status === 'legacy' ? 'grey-8' : item.status === 'large' ? 'orange-9' : 'green-9'" :text-color="item.status === 'large' ? 'black' : undefined">{{ item.statusLabel }}</q-badge>
                  </div>
                </div>
                <p class="mod-discovery__text">{{ item.description }}</p>
                <p class="mod-discovery__count">
                  {{ item.count.toLocaleString() }} names
                  <span v-if="!item.live">· approx. as of {{ item.asOf }}</span>
                  <span v-else>· live</span>
                </p>
                <p class="mod-discovery__caution">{{ item.caution }}</p>
                <div class="mod-discovery__actions">
                  <q-btn v-if="!item.subscribed" flat dense no-caps color="primary" icon="add" label="Subscribe" @click="subscribeList(item.owner, item.type, true)" />
                  <span v-else class="mod-discovery__subscribed">Subscribed</span>
                  <router-link :to="'/@' + item.owner" class="mod-link">Owner profile</router-link>
                </div>
              </article>
            </div>
          </div>
        </div>

        <div v-if="suggestedLists.length" class="mod-list-owner">
          <h3 class="mod-subtitle">Referenced by an imported profile</h3>
          <ul class="mod-list">
            <li v-for="list in suggestedLists" :key="'suggested-' + list.type + ':' + list.owner">
              <router-link :to="'/@' + list.owner">@{{ list.owner }}</router-link>
              <q-badge color="blue-grey-9">{{ list.type }}</q-badge>
              <button type="button" class="mod-link" @click="subscribeList(list.owner, list.type, true)">Subscribe</button>
            </li>
          </ul>
        </div>

        <div class="mod-option">
          <div>
            <div class="mod-option__label">Let subscribed mute lists override follows</div>
            <div class="mod-option__hint">Off by default: follows beat mute lists with a visible conflict badge.</div>
          </div>
          <q-toggle
            :model-value="moderation.listsOverrideFollows"
            color="primary"
            aria-label="Let subscribed mute lists override follows"
            @update:model-value="moderation.setListsOverrideFollows($event)"
          />
        </div>

        <p v-if="contextNote" class="mod-section__hint" role="status">{{ contextNote }}</p>
      </section>

      <section class="mod-section" aria-labelledby="mod-overrides-title">
        <div class="mod-section__head">
          <div>
            <h2 id="mod-overrides-title" class="mod-section__title">Local overrides</h2>
            <p class="mod-section__hint">“Show anyway” and “Always show/hide” are remembered on this device.</p>
          </div>
          <q-btn v-if="hasOverrides" flat dense no-caps color="primary" icon="restart_alt" label="Clear all" @click="clearOverrides" />
        </div>

        <div v-if="!hasOverrides" class="mod-empty">No local overrides yet.</div>
        <div v-else class="mod-overrides">
          <div v-if="moderation.skinShowAuthors.length" class="mod-override-group">
            <h3 class="mod-subtitle">Always show</h3>
            <ul class="mod-list">
              <li v-for="author in moderation.skinShowAuthors" :key="'show-' + author">
                <router-link :to="'/@' + author">@{{ author }}</router-link>
                <button type="button" class="mod-link" @click="moderation.clearSkinOverride(author)">Remove</button>
              </li>
            </ul>
          </div>
          <div v-if="moderation.skinHideAuthors.length" class="mod-override-group">
            <h3 class="mod-subtitle">Always hide</h3>
            <ul class="mod-list">
              <li v-for="author in moderation.skinHideAuthors" :key="'hide-' + author">
                <router-link :to="'/@' + author">@{{ author }}</router-link>
                <button type="button" class="mod-link" @click="moderation.clearSkinOverride(author)">Remove</button>
              </li>
            </ul>
          </div>
          <div v-if="moderation.showItems.length" class="mod-override-group">
            <h3 class="mod-subtitle">Shown items</h3>
            <ul class="mod-list">
              <li v-for="item in moderation.showItems" :key="'item-' + item">
                <span>{{ item }}</span>
                <button type="button" class="mod-link" @click="moderation.clearItemOverride(item)">Remove</button>
              </li>
            </ul>
          </div>
          <div v-if="moderation.hideItems.length" class="mod-override-group">
            <h3 class="mod-subtitle">Hidden items</h3>
            <ul class="mod-list">
              <li v-for="item in moderation.hideItems" :key="'hidden-' + item">
                <span>{{ item }}</span>
                <button type="button" class="mod-link" @click="moderation.clearItemOverride(item)">Remove</button>
              </li>
            </ul>
          </div>
          <div v-if="moderation.ignoredVoters.length" class="mod-override-group">
            <h3 class="mod-subtitle">Ignored voters</h3>
            <ul class="mod-list">
              <li v-for="voter in moderation.ignoredVoters" :key="'voter-' + voter">
                <router-link :to="'/@' + voter">@{{ voter }}</router-link>
                <button type="button" class="mod-link" @click="moderation.unignoreVoter(voter)">Remove</button>
              </li>
            </ul>
          </div>
        </div>
      </section>

      <section class="mod-section" aria-labelledby="mod-skins-title">
        <div class="mod-section__head">
          <div>
            <h2 id="mod-skins-title" class="mod-section__title">Profile skins</h2>
            <p class="mod-section__hint">Skins use the same local safety floor. Manage the followed-account choices in Appearance.</p>
          </div>
          <q-btn outline no-caps color="primary" icon="palette" label="Skin safety" to="/appearance#skin-safety" />
        </div>
        <p class="mod-section__hint">
          Muted accounts and negative reputation are blocked by default. A direct “Show this skin anyway” lives on the
          profile notice.
        </p>
      </section>

      <section class="mod-section" aria-labelledby="mod-export-title">
        <div class="mod-section__head">
          <div>
            <h2 id="mod-export-title" class="mod-section__title">Export and import</h2>
            <p class="mod-section__hint">Versioned JSON. Local only; no server sync. Export list owners, not other people's member lists.</p>
          </div>
        </div>
        <div class="mod-export-actions">
          <q-btn unelevated no-caps color="primary" icon="download" label="Download policy" @click="downloadPolicy" />
          <q-btn outline no-caps color="primary" icon="content_copy" label="Copy JSON" @click="copyPolicy" />
          <q-btn outline no-caps color="primary" icon="upload" label="Import file" @click="$refs.fileInput.click()" />
          <input ref="fileInput" type="file" accept="application/json,.json" class="mod-file" @change="readFile" />
        </div>
        <q-input
          v-model="importText"
          type="textarea"
          outlined
          autogrow
          label="Paste a moderation policy JSON"
          class="mod-import"
        />
        <q-btn unelevated no-caps color="primary" label="Apply pasted policy" :disable="!importText.trim()" @click="applyImport" />
      </section>

      <section class="mod-section mod-section--danger" aria-labelledby="mod-reset-title">
        <div class="mod-section__head">
          <div>
            <h2 id="mod-reset-title" class="mod-section__title">Reset</h2>
            <p class="mod-section__hint">These actions only affect this account on this device.</p>
          </div>
        </div>
        <div class="mod-export-actions">
          <q-btn outline no-caps color="primary" icon="help_outline" label="Show the Balanced explanation again" @click="resetDisclosure" />
          <q-btn outline no-caps color="negative" icon="restart_alt" label="Reset policy" @click="resetPolicy" />
        </div>
      </section>
    </div>
  </q-page>
</template>

<style scoped>
.mod-page {
  min-width: 0;
}

.mod-shell {
  width: 100%;
  max-width: 1080px;
  margin: 0 auto;
  padding: var(--space-4) var(--space-4) var(--space-6);
}

.mod-eyebrow {
  display: inline-flex;
  align-items: center;
  gap: 0.3rem;
  color: var(--c-primary);
  font-size: 0.72rem;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.mod-title {
  margin: 0.25rem 0 0.4rem;
  font-size: clamp(1.6rem, 3vw, 2.1rem);
  line-height: 1.15;
}

.mod-intro {
  max-width: 780px;
  margin: 0;
  color: var(--c-text-muted);
  line-height: 1.6;
}

.mod-section {
  margin-top: var(--space-5);
  padding: var(--space-4);
  border: 1px solid var(--c-border);
  border-radius: var(--radius-card);
  background: var(--c-surface-2);
}

.mod-section__head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: var(--space-3);
  flex-wrap: wrap;
}

.mod-section__title {
  margin: 0;
  font-size: 1.05rem;
}

.mod-section__hint {
  margin: 0.25rem 0 0;
  color: var(--c-text-muted);
  font-size: 0.82rem;
  line-height: 1.55;
}

.mod-presets {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  gap: var(--space-2);
  margin-top: var(--space-3);
}

.mod-preset {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  padding: 0.7rem;
  border: 1px solid var(--c-border);
  border-radius: var(--radius-card);
  background: var(--c-surface);
  color: var(--c-text);
  font: inherit;
  text-align: left;
  cursor: pointer;
}

.mod-preset span {
  color: var(--c-text-muted);
  font-size: 0.76rem;
  line-height: 1.45;
}

.mod-preset.is-active {
  border-color: var(--c-primary);
  box-shadow: 0 0 0 2px color-mix(in srgb, var(--c-primary) 18%, transparent);
}

.mod-table-wrap {
  margin-top: var(--space-3);
  overflow-x: auto;
}

.mod-table {
  width: 100%;
  border-collapse: collapse;
  min-width: 620px;
}

.mod-table th,
.mod-table td {
  padding: 0.3rem 0.4rem;
  border-bottom: 1px solid var(--c-border);
  text-align: left;
  font-size: 0.78rem;
  vertical-align: middle;
}

.mod-table thead th {
  color: var(--c-text-muted);
  font-size: 0.7rem;
  text-transform: uppercase;
  letter-spacing: 0.04em;
}

.mod-table tbody th {
  font-weight: 600;
}

.mod-list-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(170px, 1fr));
  gap: var(--space-2);
  margin-top: var(--space-3);
}

.mod-list-card {
  display: flex;
  flex-direction: column;
  gap: 0.1rem;
  padding: 0.6rem;
  border: 1px solid var(--c-border);
  border-radius: var(--radius-card);
  background: var(--c-surface);
  color: var(--c-text-muted);
  font-size: 0.74rem;
}

.mod-list-card strong {
  color: var(--c-text);
  font-size: 1.1rem;
}

.mod-list-card__label {
  color: var(--c-text);
  font-weight: 600;
  font-size: 0.78rem;
}

.mod-list-owner {
  margin-top: var(--space-3);
}

.mod-discovery {
  margin-top: var(--space-4);
  padding-top: var(--space-3);
  border-top: 1px solid var(--c-border);
}

.mod-discovery__group {
  margin-top: var(--space-3);
}

.mod-discovery__group-title {
  margin: 0 0 var(--space-2);
  color: var(--c-text-muted);
  font-size: 0.74rem;
  font-weight: 700;
  letter-spacing: 0.04em;
  text-transform: uppercase;
}

.mod-discovery__grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
  gap: var(--space-2);
}

.mod-discovery__card {
  display: flex;
  flex-direction: column;
  gap: 0.3rem;
  padding: var(--space-3);
  border: 1px solid var(--c-border);
  border-radius: var(--radius-card);
  background: var(--c-surface);
}

.mod-discovery__head {
  display: flex;
  justify-content: space-between;
  gap: var(--space-2);
  align-items: flex-start;
}

.mod-discovery__title {
  color: var(--c-text);
  font-size: 0.86rem;
  font-weight: 700;
}

.mod-discovery__owner {
  color: var(--c-link);
  font-size: 0.74rem;
  text-decoration: none;
}

.mod-discovery__badges {
  display: flex;
  flex-direction: column;
  gap: 0.15rem;
  align-items: flex-end;
}

.mod-discovery__text,
.mod-discovery__count,
.mod-discovery__caution {
  margin: 0;
  color: var(--c-text-muted);
  font-size: 0.76rem;
  line-height: 1.5;
}

.mod-discovery__count {
  color: var(--c-text);
  font-weight: 600;
}

.mod-discovery__caution {
  color: var(--c-warning);
  font-size: 0.72rem;
}

.mod-discovery__actions {
  display: flex;
  align-items: center;
  gap: 0.6rem;
  margin-top: auto;
  padding-top: 0.3rem;
}

.mod-discovery__subscribed {
  color: var(--c-positive);
  font-size: 0.76rem;
  font-weight: 600;
}

.mod-subscribe {
  margin-top: var(--space-3);
  padding-top: var(--space-3);
  border-top: 1px solid var(--c-border);
}

.mod-subscribe__row {
  display: flex;
  gap: var(--space-2);
  flex-wrap: wrap;
  align-items: center;
  margin-top: var(--space-2);
}

.mod-subscribe__row .q-field {
  min-width: 190px;
}

.mod-list__count {
  color: var(--c-text-faint);
  font-size: 0.72rem;
}

.mod-subtitle {
  margin: 0 0 0.35rem;
  font-size: 0.82rem;
}

.mod-list {
  display: flex;
  flex-direction: column;
  gap: 0.3rem;
  margin: 0;
  padding: 0;
  list-style: none;
  font-size: 0.8rem;
}

.mod-list li {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  flex-wrap: wrap;
}

.mod-option {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-3);
  margin-top: var(--space-3);
  padding-top: var(--space-3);
  border-top: 1px solid var(--c-border);
}

.mod-option__label {
  font-size: 0.86rem;
  font-weight: 600;
}

.mod-option__hint {
  color: var(--c-text-muted);
  font-size: 0.76rem;
}

.mod-link {
  border: 0;
  background: none;
  color: var(--c-link);
  font: inherit;
  cursor: pointer;
  text-decoration: underline;
}

.mod-empty {
  margin-top: var(--space-3);
  color: var(--c-text-muted);
  font-size: 0.82rem;
}

.mod-overrides {
  display: grid;
  gap: var(--space-3);
  margin-top: var(--space-3);
}

.mod-export-actions {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-2);
  margin-top: var(--space-3);
}

.mod-file {
  display: none;
}

.mod-import {
  margin-top: var(--space-3);
}

.mod-section--danger {
  border-color: color-mix(in srgb, var(--c-negative) 30%, var(--c-border));
}
</style>

<script>
import { CONTENT_CUSTOM_SURFACES, CONTENT_DISPLAY, CONTENT_SIGNALS } from 'src/services/moderationContent'
import { exportFile } from 'quasar'
import { setPageMeta } from 'src/utils/pageMeta'
import { useModerationStore } from 'src/stores/moderation'
import {
  buildListSubscription,
  isSubscribed,
  isValidListOwner,
  listMemberCount
} from 'src/services/followLists'
import { DISCOVERY_GROUP_LABELS, DISCOVERY_LISTS } from 'src/services/moderationLists'
import { fetchModerationListEntries } from 'src/services/moderationData'

const PRESETS = [
  { value: 'open', label: 'Open', detail: 'Show everything. Label downvotes, reputation and NSFW; hide only a safety floor.' },
  { value: 'balanced', label: 'Balanced', detail: 'Collapse muted, low-reputation and community-muted content. Label downvotes and blacklists.' },
  { value: 'strict', label: 'Strict', detail: 'Collapse muted, low-reputation, heavily downvoted and NSFW content. Blacklists stay labels.' },
  { value: 'follow-only', label: 'Follow-only', detail: 'Collapse content from accounts you do not follow in feeds, comments and search.' },
  { value: 'custom', label: 'Custom', detail: 'Use the per-surface table below. Every rule is editable.' }
]

const SIGNAL_LABELS = {
  mute: 'Direct mute',
  listMute: 'Followed mute list',
  blacklist: 'Blacklist',
  community: 'Community mute',
  reputation: 'Negative reputation',
  downvotes: 'Downvotes',
  nsfw: 'NSFW',
  followOnly: 'Not followed'
}

const SURFACE_LABELS = {
  feed: 'Feeds',
  comment: 'Comments',
  community: 'Community',
  search: 'Search'
}

export default {
  name: 'ModerationPage',
  data () {
    return {
      presetOptions: PRESETS,
      contentSignals: CONTENT_SIGNALS,
      customSurfaces: CONTENT_CUSTOM_SURFACES,
      displayOptions: CONTENT_DISPLAY.map(value => ({ label: value, value })),
      importText: '',
      refreshing: false,
      newListOwner: '',
      newListType: 'mute',
      discoveryCounts: {},
      discoveryLoading: false,
      listTypeOptions: [
        { label: 'Mute list', value: 'mute' },
        { label: 'Blacklist / warning list', value: 'blacklist' }
      ]
    }
  },
  computed: {
    moderation () {
      return useModerationStore()
    },
    followedLists () {
      const rows = []
      for (const owner of this.moderation.context.followedMuteOwners || []) {
        rows.push({
          type: 'mute',
          owner: owner.name,
          description: owner.description,
          members: listMemberCount(owner.name, 'mute', this.moderation.context)
        })
      }
      for (const owner of this.moderation.context.followedBlacklistOwners || []) {
        rows.push({
          type: 'blacklist',
          owner: owner.name,
          description: owner.description,
          members: listMemberCount(owner.name, 'blacklist', this.moderation.context)
        })
      }
      return rows
    },
    discoveryGroups () {
      const context = this.moderation.context
      const groups = []
      for (const [key, label] of Object.entries(DISCOVERY_GROUP_LABELS)) {
        const items = DISCOVERY_LISTS
          .filter(item => item.group === key)
          .map(item => ({
            ...item,
            count: this.discoveryCounts[item.id] ?? item.knownCount,
            live: Object.prototype.hasOwnProperty.call(this.discoveryCounts, item.id),
            subscribed: isSubscribed(item.owner, item.type, context)
          }))
        if (items.length) groups.push({ key, label, items })
      }
      return groups
    },
    suggestedLists () {
      const context = this.moderation.context
      const refs = this.moderation.policy.lists || {}
      const rows = []
      for (const owner of refs.muteOwners || []) {
        if (!isSubscribed(owner, 'mute', context)) rows.push({ owner, type: 'mute' })
      }
      for (const owner of refs.blacklistOwners || []) {
        if (!isSubscribed(owner, 'blacklist', context)) rows.push({ owner, type: 'blacklist' })
      }
      return rows
    },
    hasOverrides () {
      const overrides = this.moderation.policy.overrides || {}
      return ['showAuthors', 'hideAuthors', 'showItems', 'hideItems', 'ignoredVoters']
        .some(key => Array.isArray(overrides[key]) && overrides[key].length > 0)
    },
    contextNote () {
      if (!this.$hiveStore.user.username) return 'Sign in to read your Hive mute and blacklist lists.'
      const status = this.moderation.context.status
      if (status === 'loading' || status === 'idle') return 'Reading your Hive lists…'
      if (status === 'error') return 'Your lists could not be loaded. Content is shown with the signals available in the payload.'
      const errors = Number(this.moderation.context.listErrors) || 0
      return errors ? errors + ' subscribed list(s) could not be read.' : ''
    }
  },
  mounted () {
    setPageMeta({
      title: 'Moderation — local policy and list context — hive.ausbit.dev',
      description: 'Choose how hive.ausbit.dev labels, collapses or hides content. Local-first presets, mute and blacklist layers, skin safety and versioned export/import.',
      url: '/settings/moderation'
    })
    this.sync()
    this.loadDiscoveryCounts()
  },
  watch: {
    '$hiveStore.user.username' () {
      this.sync()
    }
  },
  methods: {
    sync () {
      this.moderation.setScope(this.$hiveStore.user.username || 'guest')
      this.moderation.ensureContext()
    },
    async loadDiscoveryCounts () {
      if (this.discoveryLoading) return
      this.discoveryLoading = true
      try {
        const targets = DISCOVERY_LISTS.filter(item => item.fetchCount)
        const results = await Promise.allSettled(targets.map(async item => {
          const entries = await fetchModerationListEntries(
            item.owner,
            item.type === 'mute' ? 'muted' : 'blacklisted'
          )
          return [item.id, entries.length]
        }))
        const next = { ...this.discoveryCounts }
        for (const result of results) {
          if (result.status === 'fulfilled') next[result.value[0]] = result.value[1]
        }
        this.discoveryCounts = next
      } finally {
        this.discoveryLoading = false
      }
    },
    refreshLists () {
      this.refreshing = true
      this.moderation.refreshContext().finally(() => { this.refreshing = false })
    },
    selectPreset (preset) {
      this.moderation.setPreset(preset)
    },
    subscribeList (owner, type, subscribe) {
      const username = this.$hiveStore.user.username
      if (!username) {
        this.$q.notify({ type: 'negative', message: 'Sign in to manage list subscriptions.' })
        return
      }
      const name = String(owner || '').trim()
      if (!isValidListOwner(name)) {
        this.$q.notify({ type: 'negative', message: 'Enter a valid Hive account name.' })
        return
      }
      if (subscribe && isSubscribed(name, type, this.moderation.context)) {
        this.$q.notify({ message: 'You already follow that list.', color: 'primary', timeout: 1800 })
        return
      }
      const op = buildListSubscription(username, name, type, {
        subscribe,
        context: this.moderation.context
      })
      if (!op) {
        this.$q.notify({ type: 'negative', message: 'That list subscription cannot be built.' })
        return
      }
      this.$hiveStore.addToQueue(op)
      this.moderation.noteListSubscription(name, type, subscribe)
      this.newListOwner = ''
      this.$q.notify({
        message: (subscribe ? 'Subscription' : 'Unsubscribe') + ' queued with your posting key.',
        caption: 'Review it in the signing queue before broadcast.',
        color: 'primary',
        timeout: 3200
      })
    },
    ruleFor (surface, signal) {
      return this.moderation.contentCustom?.[surface]?.[signal] || 'collapse'
    },
    setRule (surface, signal, value) {
      this.moderation.setCustomRule(surface, signal, value)
    },
    signalLabel (signal) {
      return SIGNAL_LABELS[signal] || signal
    },
    surfaceLabel (surface) {
      return SURFACE_LABELS[surface] || surface
    },
    clearOverrides () {
      this.$q.dialog({
        title: 'Clear local overrides?',
        message: 'This removes every “show anyway”, “always show/hide” and ignored-voter choice for this account.',
        cancel: true,
        ok: 'Clear overrides'
      }).onOk(() => this.moderation.resetOverrides())
    },
    resetDisclosure () {
      this.moderation.resetDisclosure()
      this.$q.notify({ message: 'The Balanced explanation will appear again.', color: 'primary', timeout: 2200 })
    },
    resetPolicy () {
      this.$q.dialog({
        title: 'Reset the moderation policy?',
        message: 'Presets, custom rules, list choices and overrides for this account return to the defaults.',
        cancel: true,
        ok: 'Reset policy'
      }).onOk(() => {
        this.moderation.resetPolicy()
        this.$q.notify({ message: 'Moderation policy reset.', color: 'primary', timeout: 2200 })
      })
    },
    downloadPolicy () {
      const text = this.moderation.exportPolicyText()
      const ok = exportFile('hive-moderation-policy.json', text, 'application/json')
      if (ok !== true) this.$q.notify({ type: 'negative', message: 'Could not download the policy.' })
    },
    async copyPolicy () {
      const text = this.moderation.exportPolicyText()
      try {
        await navigator.clipboard.writeText(text)
        this.$q.notify({ message: 'Policy copied as JSON.', color: 'primary', timeout: 1800 })
      } catch {
        this.importText = text
        this.$q.notify({ message: 'Clipboard unavailable. The JSON is in the import box.', color: 'orange', timeout: 2600 })
      }
    },
    async readFile (event) {
      const file = event.target.files?.[0]
      event.target.value = ''
      if (!file) return
      this.importText = await file.text()
      this.$q.notify({ message: 'File loaded. Review it, then apply.', color: 'primary', timeout: 2200 })
    },
    applyImport () {
      this.$q.dialog({
        title: 'Apply this moderation policy?',
        message: 'This replaces the presets, custom rules, lists and overrides for this account on this device.',
        cancel: true,
        ok: 'Apply policy'
      }).onOk(() => {
        const result = this.moderation.importPolicyText(this.importText)
        if (result.error) {
          this.$q.notify({ type: 'negative', message: result.error })
          return
        }
        this.importText = ''
        this.$q.notify({ message: 'Moderation policy imported.', color: 'primary', timeout: 2200 })
      })
    }
  }
}
</script>
