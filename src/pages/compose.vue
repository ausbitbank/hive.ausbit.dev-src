<template>
  <q-page class="compose-page">
    <header class="compose-header">
      <div class="compose-header__intro">
        <div class="home-eyebrow">Creator workflow</div>
        <h1 class="page-title">Write a post</h1>
        <p class="page-intro">
          Draft locally, preview the rendered post, then queue it for signing with your posting key.
        </p>
      </div>
      <div class="compose-header__actions">
        <span class="compose-save" :class="'compose-save--' + saveState" role="status" aria-live="polite">
          <q-icon :name="saveState === 'error' ? 'error' : saveState === 'saved' ? 'cloud_done' : 'cloud_upload'" size="16px" aria-hidden="true" />
          {{ saveLabel }}
        </span>
        <q-btn flat no-caps icon="note_add" label="New draft" @click="startNewDraft" />
        <q-btn unelevated no-caps color="primary" icon="save" label="Save" :disable="!draft" @click="saveNow()" />
      </div>
    </header>

    <div v-if="!loggedInUser" class="compose-notice" role="status">
      <q-icon name="lock" size="18px" aria-hidden="true" />
      <span>Drafts are saved on this device. Log in from the header to publish with your posting key.</span>
    </div>

    <div class="compose-grid" v-if="draft">
      <section class="compose-main home-card home-panel" aria-labelledby="compose-editor-title">
        <div class="home-panel__head">
          <div class="compose-main__heading">
            <div class="home-eyebrow">Draft</div>
            <h2 id="compose-editor-title" class="home-panel__title">{{ activeDraftTitle }}</h2>
          </div>
          <div class="home-panel__actions">
            <q-btn-toggle
              v-model="mode"
              no-caps
              unelevated
              toggle-color="primary"
              :options="modeOptions"
              aria-label="Editor mode"
            />
          </div>
        </div>

        <div class="compose-editor">
          <q-input
            v-model="draft.title"
            class="compose-title"
            label="Title"
            maxlength="255"
            counter
            outlined
            dense
            aria-label="Post title"
            placeholder="A clear, specific title"
          />

          <div v-if="mode === 'write'" class="compose-write">
            <markdown-toolbar @action="applyAction">
              <template #end>
                <span class="compose-toolbar__count" :title="guidance.words + ' words'">{{ guidance.words }} words</span>
              </template>
            </markdown-toolbar>
            <textarea
              ref="body"
              v-model="draft.body"
              class="compose-textarea"
              rows="18"
              aria-label="Post body in Markdown"
              placeholder="Write in Markdown. Headings, lists, tables, links and images are supported."
              @keydown="onEditorKeydown"
            />
          </div>

          <div v-else class="compose-preview">
            <h3 class="compose-preview__title">{{ draft.title.trim() || 'Untitled post' }}</h3>
            <render v-if="draft.body.trim()" :input="draft.body" class="postbody" />
            <div v-else class="compose-preview__empty">
              <q-icon name="preview_off" size="22px" aria-hidden="true" />
              <span>Nothing to preview yet. Switch to Write and start the post.</span>
            </div>
          </div>
        </div>

        <footer class="compose-editor__footer">
          <span class="compose-guidance" :class="'compose-guidance--' + guidance.level">
            <q-icon :name="guidanceIcon" size="15px" aria-hidden="true" />
            {{ guidance.message }}
          </span>
          <span class="compose-meta">
            {{ guidance.words }} words · {{ guidance.characters }} chars · {{ guidance.bytes }}/{{ guidance.maxBytes }} bytes
            <template v-if="guidance.minutes"> · ~{{ guidance.minutes }} min read</template>
          </span>
        </footer>
      </section>

      <aside class="compose-side" aria-label="Publishing options">
        <section class="compose-panel home-card home-panel" aria-labelledby="compose-publish-title">
          <div class="home-panel__head">
            <div>
              <div class="home-eyebrow">Publish</div>
              <h2 id="compose-publish-title" class="home-panel__title">Publish checklist</h2>
            </div>
            <span class="compose-pill" :class="canPublish ? 'compose-pill--ok' : 'compose-pill--error'">
              {{ checklistErrors.length ? checklistErrors.length + ' to fix' : 'Ready' }}
            </span>
          </div>
          <div class="home-panel__body">
            <ul class="compose-checklist">
              <li v-for="item in checklist" :key="item.id" class="compose-checklist__item" :class="'is-' + item.status">
                <q-icon :name="checklistIcon(item.status)" size="17px" aria-hidden="true" />
                <div class="compose-checklist__body">
                  <div class="compose-checklist__label">{{ item.label }}</div>
                  <div class="compose-checklist__detail">{{ item.detail }}</div>
                </div>
              </li>
            </ul>
            <q-btn
              class="compose-publish"
              unelevated
              no-caps
              color="primary"
              icon="send"
              :label="loggedInUser ? 'Queue post for signing' : 'Log in to publish'"
              :disable="!canPublish"
              @click="publish"
            />
            <p class="compose-hint">
              Publishing adds a posting-key <code>comment</code> operation to the action queue. Nothing is broadcast until you sign it.
            </p>
          </div>
        </section>

        <section class="compose-panel home-card home-panel" aria-labelledby="compose-community-title">
          <div class="home-panel__head">
            <div>
              <div class="home-eyebrow">Destination</div>
              <h2 id="compose-community-title" class="home-panel__title">Community and tags</h2>
            </div>
          </div>
          <div class="home-panel__body compose-fields">
            <q-select
              :model-value="draft.community"
              :options="communityOptions"
              use-input
              fill-input
              hide-selected
              emit-value
              map-options
              outlined
              dense
              label="Community or category"
              aria-label="Community or category"
              hint="Becomes parent_permlink and the first tag"
              @update:model-value="setCommunity"
              @new-value="addCommunity"
            />
            <q-select
              :model-value="draft.tags"
              :options="tagSuggestions"
              multiple
              use-input
              use-chips
              outlined
              dense
              label="Tags"
              aria-label="Post tags"
              hint="Up to 5 tags. Lowercase; spaces become hyphens."
              @update:model-value="setTags"
              @new-value="addTag"
            />
            <div v-if="draft.crossPost" class="compose-source">
              <q-icon name="repeat" size="16px" aria-hidden="true" />
              <div class="compose-source__body">
                <div class="compose-source__label">Cross-post source</div>
                <router-link :to="postLink(draft.crossPost)" class="compose-source__link">
                  @{{ draft.crossPost.author }}/{{ draft.crossPost.permlink }}
                </router-link>
              </div>
              <q-btn flat dense round size="sm" icon="close" aria-label="Remove cross-post source" title="Remove cross-post" @click="clearCrossPost" />
            </div>
          </div>
        </section>

        <section class="compose-panel home-card home-panel" aria-labelledby="compose-crosspost-title">
          <div class="home-panel__head">
            <div>
              <div class="home-eyebrow">Attribution</div>
              <h2 id="compose-crosspost-title" class="home-panel__title">Cross-post from Hive</h2>
            </div>
          </div>
          <div class="home-panel__body compose-fields">
            <q-input
              v-model.trim="crossPostInput"
              outlined
              dense
              label="Hive post URL or @author/permlink"
              aria-label="Cross-post source URL"
              hint="Records the original author and permlink in json_metadata."
              :error="Boolean(crossPostError)"
              :error-message="crossPostError"
              @keyup.enter="loadCrossPost"
            />
            <div class="compose-inline-actions">
              <q-btn
                unelevated
                no-caps
                color="primary"
                icon="download"
                label="Load source"
                :loading="loadingSource"
                @click="loadCrossPost"
              />
              <span v-if="crossPostTitle" class="compose-source__label">{{ crossPostTitle }}</span>
            </div>
          </div>
        </section>

        <section class="compose-panel home-card home-panel" aria-labelledby="compose-rewards-title">
          <div class="home-panel__head">
            <div>
              <div class="home-eyebrow">Rewards</div>
              <h2 id="compose-rewards-title" class="home-panel__title">Beneficiaries and payout</h2>
            </div>
            <span class="compose-pill" :class="beneTotal > 100 ? 'compose-pill--error' : 'compose-pill--muted'">
              Author {{ Math.max(0, 100 - beneTotal) }}%
            </span>
          </div>
          <div class="home-panel__body compose-fields">
            <div v-if="draft.beneficiaries.length" class="compose-bene-list">
              <div v-for="(bene, index) in draft.beneficiaries" :key="bene.account + '-' + index" class="compose-bene-row">
                <q-input
                  v-model.trim="bene.account"
                  outlined
                  dense
                  label="Account"
                  :aria-label="'Beneficiary account ' + (index + 1)"
                />
                <q-input
                  :model-value="bene.weight / 100"
                  type="number"
                  min="0"
                  max="100"
                  suffix="%"
                  outlined
                  dense
                  :aria-label="'Beneficiary share for ' + (bene.account || 'row ' + (index + 1))"
                  @update:model-value="value => setBeneficiaryPercent(index, value)"
                  @blur="clampBeneficiary(index)"
                />
                <q-btn flat dense round icon="delete_outline" color="red-4" :aria-label="'Remove beneficiary ' + bene.account" @click="removeBeneficiary(index)" />
              </div>
            </div>
            <div v-else class="compose-empty-line">
              <q-icon name="person_off" size="17px" aria-hidden="true" />
              <span>No beneficiaries. You receive 100% of post rewards.</span>
            </div>

            <div class="compose-bene-add">
              <q-input v-model.trim="newBeneAccount" outlined dense label="Account" aria-label="New beneficiary account" maxlength="16" @keyup.enter="addBeneficiary" />
              <q-input v-model.number="newBenePercent" type="number" min="0" max="100" suffix="%" outlined dense label="Share" aria-label="New beneficiary share" @keyup.enter="addBeneficiary" />
              <q-btn unelevated no-caps color="primary" icon="add" label="Add" :disable="!canAddBeneficiary" @click="addBeneficiary" />
            </div>
            <div v-if="beneTotal > 100" class="compose-warning" role="alert">
              <q-icon name="warning" size="16px" aria-hidden="true" />
              <span>Beneficiary shares cannot total more than 100%.</span>
            </div>
            <div v-else-if="draft.beneficiaries.length" class="compose-total">
              {{ beneTotal }}% shared · {{ Math.max(0, 100 - beneTotal) }}% to you
            </div>

            <q-input
              v-model.trim="draft.rewards.maxAcceptedPayout"
              outlined
              dense
              label="Maximum accepted payout"
              aria-label="Maximum accepted payout in HBD"
              hint="HBD cap. Use 0.000 to decline payouts."
            />
            <q-select
              v-model.number="draft.rewards.percentHbd"
              :options="payoutSplitOptions"
              emit-value
              map-options
              outlined
              dense
              label="Reward split"
              aria-label="Reward split between HBD and Hive Power"
            />
            <div class="compose-toggles">
              <q-toggle v-model="draft.rewards.allowVotes" label="Allow votes" dense />
              <q-toggle v-model="draft.rewards.allowCurationRewards" label="Curation rewards" dense />
            </div>
          </div>
        </section>

        <section class="compose-panel home-card home-panel" aria-labelledby="compose-drafts-title">
          <div class="home-panel__head">
            <div>
              <div class="home-eyebrow">Local drafts</div>
              <h2 id="compose-drafts-title" class="home-panel__title">Drafts ({{ visibleDrafts.length }})</h2>
            </div>
            <div class="home-panel__actions">
              <q-btn flat dense round icon="add" aria-label="Create a new draft" title="New draft" @click="startNewDraft" />
            </div>
          </div>
          <div class="home-panel__body compose-drafts">
            <div v-if="visibleDrafts.length" class="compose-draft-list">
              <div
                v-for="item in visibleDrafts"
                :key="item.id"
                class="compose-draft"
                :class="{ 'compose-draft--active': item.id === draft.id }"
              >
                <button type="button" class="compose-draft__open" @click="selectDraft(item.id)">
                  <span class="compose-draft__title">{{ draftDisplayTitle(item) }}</span>
                  <span class="compose-draft__meta">{{ draftTime(item.updatedAt) }} · {{ wordCount(item.body) }} words</span>
                </button>
                <q-btn
                  flat
                  dense
                  round
                  size="sm"
                  icon="delete_outline"
                  color="red-4"
                  :aria-label="'Discard draft ' + draftDisplayTitle(item)"
                  title="Discard draft"
                  @click="requestDiscard(item)"
                />
              </div>
            </div>
            <div v-else class="compose-empty-line">
              <q-icon name="description" size="17px" aria-hidden="true" />
              <span>No saved drafts yet. Autosave starts when you write.</span>
            </div>

            <div class="compose-drafts__actions">
              <q-btn flat dense no-caps icon="download" label="Export draft" :disable="!draftHasContent(draft)" @click="exportCurrent" />
              <q-btn flat dense no-caps icon="archive" label="Export all" :disable="!visibleDrafts.length" @click="exportAll" />
              <q-btn flat dense no-caps icon="upload_file" label="Import" @click="triggerImport" />
              <input ref="importInput" type="file" accept="application/json,.json" class="compose-file-input" aria-label="Import drafts JSON file" @change="onImportFile" />
            </div>
            <p class="compose-hint">Drafts stay in this browser. Export a JSON backup before clearing site data.</p>
          </div>
        </section>
      </aside>
    </div>

    <q-dialog v-model="discardOpen">
      <q-card class="compose-confirm">
        <q-card-section>
          <div class="home-eyebrow">Draft</div>
          <h2 class="home-panel__title">Discard this draft?</h2>
          <p class="compose-confirm__text">
            <template v-if="discardTarget">“{{ draftDisplayTitle(discardTarget) }}”</template>
            <template v-else>This draft</template>
            will be removed from this browser. Export a copy first if you may need it.
          </p>
        </q-card-section>
        <q-card-actions align="right">
          <q-btn flat no-caps label="Cancel" @click="discardOpen = false" />
          <q-btn unelevated no-caps color="negative" icon="delete_forever" label="Discard" @click="confirmDiscard" />
        </q-card-actions>
      </q-card>
    </q-dialog>
  </q-page>
</template>

<style scoped>
.compose-page {
  width: min(1240px, 100%);
  margin: 0 auto;
  padding: var(--space-4) var(--space-3) var(--space-6);
}

.compose-header {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: var(--space-4);
  flex-wrap: wrap;
  margin-bottom: var(--space-4);
}

.compose-header__intro .page-intro {
  margin: var(--space-2) 0 0;
}

.compose-header__actions {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  flex-wrap: wrap;
}

.compose-save {
  display: inline-flex;
  align-items: center;
  gap: 0.3rem;
  padding: 0.2rem 0.55rem;
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-pill);
  color: #90a4ae;
  font-size: 0.72rem;
  white-space: nowrap;
}

.compose-save--saved {
  color: #81c784;
}

.compose-save--dirty {
  color: #ffb74d;
}

.compose-save--error {
  color: #ff8a80;
}

.compose-notice {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-bottom: var(--space-4);
  padding: 0.6rem 0.85rem;
  border: 1px solid rgba(255, 183, 77, 0.35);
  border-radius: var(--radius-sm);
  background: rgba(255, 183, 77, 0.08);
  color: #ffcc80;
  font-size: 0.78rem;
}

.compose-grid {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 350px;
  gap: var(--space-4);
  align-items: start;
}

.compose-main,
.compose-panel {
  min-width: 0;
}

.compose-main {
  position: sticky;
  top: calc(var(--space-4) + 50px);
}

.compose-main__heading {
  min-width: 0;
}

.compose-main__heading .home-panel__title {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* White on the light primary blue fails WCAG AA at button-label size. */
.compose-main :deep(.q-btn-group .bg-primary.text-white) {
  color: #07131b !important;
}

.compose-editor {
  padding: 0.8rem 1rem 0.6rem;
}

.compose-title :deep(.q-field__control) {
  font-size: 1.05rem;
  font-weight: 600;
}

.compose-write {
  margin-top: 0.65rem;
}

.compose-toolbar__count {
  flex: none;
  padding: 0 0.35rem;
  color: #78909c;
  font-size: 0.7rem;
}

.compose-textarea {
  display: block;
  width: 100%;
  min-height: 430px;
  max-height: 62vh;
  resize: vertical;
  padding: 0.8rem 0.9rem;
  border: 1px solid var(--border-subtle);
  border-top: 0;
  border-radius: 0 0 var(--radius-sm) var(--radius-sm);
  background: #0d1419;
  color: #e4eaed;
  font: inherit;
  font-size: 0.94rem;
  line-height: 1.65;
  tab-size: 2;
}

.compose-textarea:focus {
  outline: 2px solid rgba(79, 195, 247, 0.6);
  outline-offset: -1px;
}

.compose-preview {
  min-height: 430px;
  margin-top: 0.65rem;
  padding: 0.9rem 1rem;
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-sm);
  background: rgba(255, 255, 255, 0.02);
  overflow-wrap: anywhere;
}

.compose-preview__title {
  margin: 0 0 0.6rem;
  font-size: 1.35rem;
  line-height: 1.3;
}

.compose-preview__empty {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  color: #78909c;
  font-size: 0.82rem;
}

.compose-editor__footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem 1rem;
  flex-wrap: wrap;
  padding: 0.55rem 1rem 0.7rem;
  border-top: 1px solid var(--border-subtle);
  color: #78909c;
  font-size: 0.7rem;
}

.compose-guidance {
  display: inline-flex;
  align-items: center;
  gap: 0.3rem;
}

.compose-guidance--good {
  color: #81c784;
}

.compose-guidance--short,
.compose-guidance--long {
  color: #ffb74d;
}

.compose-guidance--too-long {
  color: #ff8a80;
}

.compose-meta {
  font-variant-numeric: tabular-nums;
}

.compose-side {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
  min-width: 0;
}

.compose-panel .home-panel__body {
  padding: 0.75rem 0.9rem 0.85rem;
}

.compose-pill {
  padding: 0.1rem 0.45rem;
  border-radius: var(--radius-pill);
  font-size: 0.66rem;
  font-weight: 600;
  white-space: nowrap;
}

.compose-pill--ok {
  background: rgba(76, 175, 80, 0.14);
  color: #a5d6a7;
}

.compose-pill--error {
  background: rgba(244, 67, 54, 0.14);
  color: #ef9a9a;
}

.compose-pill--muted {
  background: rgba(255, 255, 255, 0.06);
  color: #b0bec5;
}

.compose-checklist {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  margin: 0 0 0.8rem;
  padding: 0;
  list-style: none;
}

.compose-checklist__item {
  display: flex;
  align-items: flex-start;
  gap: 0.45rem;
  color: #90a4ae;
}

.compose-checklist__item.is-ok .q-icon {
  color: #66bb6a;
}

.compose-checklist__item.is-warn .q-icon {
  color: #ffb74d;
}

.compose-checklist__item.is-error .q-icon {
  color: #ef5350;
}

.compose-checklist__body {
  min-width: 0;
}

.compose-checklist__label {
  color: #cfd8dc;
  font-size: 0.77rem;
  font-weight: 600;
  line-height: 1.35;
}

.compose-checklist__detail {
  color: #78909c;
  font-size: 0.7rem;
  line-height: 1.45;
  overflow-wrap: anywhere;
}

.compose-publish {
  width: 100%;
}

.compose-hint {
  margin: 0.55rem 0 0;
  color: #78909c;
  font-size: 0.69rem;
  line-height: 1.5;
}

.compose-fields {
  display: flex;
  flex-direction: column;
  gap: 0.6rem;
}

.compose-source {
  display: flex;
  align-items: center;
  gap: 0.45rem;
  padding: 0.45rem 0.55rem;
  border: 1px solid rgba(79, 195, 247, 0.28);
  border-radius: var(--radius-sm);
  background: rgba(79, 195, 247, 0.06);
}

.compose-source__body {
  flex: 1;
  min-width: 0;
}

.compose-source__label {
  color: #90a4ae;
  font-size: 0.68rem;
}

.compose-source__link {
  display: block;
  overflow: hidden;
  color: #81d4fa;
  font-size: 0.74rem;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.compose-inline-actions {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  flex-wrap: wrap;
}

.compose-bene-list {
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
}

.compose-bene-row {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 84px auto;
  gap: 0.35rem;
  align-items: center;
}

.compose-bene-row :deep(.q-field__control) {
  min-height: 34px;
}

.compose-bene-add {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 84px auto;
  gap: 0.35rem;
  align-items: center;
}

.compose-empty-line {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  padding: 0.5rem 0.55rem;
  border: 1px dashed var(--border-subtle);
  border-radius: var(--radius-sm);
  color: #78909c;
  font-size: 0.72rem;
}

.compose-warning,
.compose-total {
  display: flex;
  align-items: center;
  gap: 0.3rem;
  font-size: 0.69rem;
}

.compose-warning {
  color: #ffb74d;
}

.compose-total {
  color: #81c784;
}

.compose-toggles {
  display: flex;
  align-items: center;
  gap: 0.5rem 1rem;
  flex-wrap: wrap;
}

.compose-drafts {
  display: flex;
  flex-direction: column;
  gap: 0.55rem;
}

.compose-draft-list {
  display: flex;
  flex-direction: column;
  gap: 0.3rem;
  max-height: 280px;
  overflow-y: auto;
}

.compose-draft {
  display: flex;
  align-items: center;
  gap: 0.2rem;
  padding: 0.2rem 0.25rem 0.2rem 0.45rem;
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-sm);
  background: rgba(255, 255, 255, 0.02);
}

.compose-draft--active {
  border-color: rgba(79, 195, 247, 0.5);
  background: rgba(79, 195, 247, 0.08);
}

.compose-draft__open {
  flex: 1;
  min-width: 0;
  padding: 0.3rem 0;
  border: 0;
  background: none;
  color: inherit;
  cursor: pointer;
  font: inherit;
  text-align: left;
}

.compose-draft__open:focus-visible {
  outline: 2px solid #4fc3f7;
  outline-offset: 2px;
  border-radius: 3px;
}

.compose-draft__title {
  display: block;
  overflow: hidden;
  color: #e4eaed;
  font-size: 0.78rem;
  font-weight: 600;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.compose-draft__meta {
  display: block;
  color: #78909c;
  font-size: 0.66rem;
}

.compose-drafts__actions {
  display: flex;
  align-items: center;
  gap: 0.15rem;
  flex-wrap: wrap;
  padding-top: 0.2rem;
  border-top: 1px solid var(--border-subtle);
}

.compose-file-input {
  position: absolute;
  width: 1px;
  height: 1px;
  overflow: hidden;
  clip: rect(0 0 0 0);
  white-space: nowrap;
}

.compose-confirm {
  width: 430px;
  max-width: 94vw;
  background: #1d1d1d;
}

.compose-confirm__text {
  margin: 0.5rem 0 0;
  color: #b0bec5;
  font-size: 0.82rem;
  line-height: 1.55;
}

@media (max-width: 1023px) {
  .compose-grid {
    grid-template-columns: minmax(0, 1fr);
  }

  .compose-main {
    position: static;
  }
}

@media (max-width: 599px) {
  .compose-page {
    padding: var(--space-3) var(--space-2) var(--space-5);
  }

  .compose-header {
    align-items: flex-start;
  }

  .compose-header__actions {
    width: 100%;
  }

  .compose-editor {
    padding: 0.7rem 0.75rem 0.55rem;
  }

  .compose-panel .home-panel__body {
    padding: 0.7rem 0.75rem 0.8rem;
  }

  .compose-textarea {
    min-height: 340px;
    max-height: none;
  }

  .compose-preview {
    min-height: 340px;
  }

  .compose-bene-row,
  .compose-bene-add {
    grid-template-columns: minmax(0, 1fr) 76px;
  }

  .compose-bene-row .q-btn,
  .compose-bene-add .q-btn {
    grid-column: 2;
    justify-self: end;
  }
}
</style>

<script>
import { LocalStorage, exportFile } from 'quasar'
import { defineAsyncComponent } from 'vue'
import moment from 'src/utils/time'
import { applyMarkdownAction, shortcutMarkdownAction, wordCount } from 'src/utils/markdownEditor'
import {
  MAX_BENEFICIARIES,
  MAX_TAGS,
  createDraft,
  defaultRewards,
  draftDisplayTitle,
  draftExportFileName,
  draftHasContent,
  draftLengthGuidance,
  mergeImportedDrafts,
  normalizeBeneficiaries,
  normalizeDraft,
  normalizeTag,
  normalizeTags,
  parseDraftExport,
  readDrafts,
  removeDraftById,
  serializeDraftExport,
  upsertDraft,
  writeDrafts
} from 'src/services/drafts'
import {
  canPublish as canPublishDraft,
  checklistErrors as collectChecklistErrors,
  createPostPermlink,
  parseHivePostUrl,
  postQueueItem,
  publishChecklist
} from 'src/services/publish'
import { isOnline } from 'src/services/connectivity'
import { setPageMeta } from 'src/utils/pageMeta'

const ACCOUNT_RE = /^[a-z][a-z0-9.-]{2,15}$/

export default {
  name: 'ComposePage',
  components: {
    render: defineAsyncComponent(() => import('components/render.vue')),
    MarkdownToolbar: defineAsyncComponent(() => import('components/MarkdownToolbar.vue'))
  },
  data () {
    return {
      drafts: [],
      draft: null,
      mode: 'write',
      saveState: 'idle',
      lastSavedAt: null,
      lastSavedSnapshot: '',
      autosaveTimer: null,
      storageErrorNotified: false,
      crossPostInput: '',
      crossPostError: '',
      crossPostTitle: '',
      loadingSource: false,
      newBeneAccount: '',
      newBenePercent: 10,
      discardOpen: false,
      discardTarget: null,
      modeOptions: [
        { label: 'Write', value: 'write', icon: 'edit' },
        { label: 'Preview', value: 'preview', icon: 'visibility' }
      ],
      tagSuggestions: ['hive', 'blog', 'writing', 'photography', 'art', 'dev', 'news', 'music'],
      payoutSplitOptions: [
        { label: '50% HBD · 50% Hive Power', value: 5000 },
        { label: '100% HBD', value: 10000 },
        { label: '100% Hive Power', value: 0 }
      ]
    }
  },
  computed: {
    loggedInUser () {
      return this.$hiveStore.user.username || null
    },
    guidance () {
      return draftLengthGuidance(this.draft && this.draft.body)
    },
    guidanceIcon () {
      switch (this.guidance.level) {
        case 'good': return 'check_circle'
        case 'short': return 'edit_note'
        case 'long': return 'schedule'
        case 'too-long': return 'error'
        default: return 'info'
      }
    },
    checklist () {
      return this.draft ? publishChecklist(this.draft, { username: this.loggedInUser }) : []
    },
    checklistErrors () {
      return collectChecklistErrors(this.checklist)
    },
    canPublish () {
      return Boolean(this.draft) && canPublishDraft(this.draft, { username: this.loggedInUser })
    },
    activeDraftTitle () {
      return this.draft ? draftDisplayTitle(this.draft) : 'New draft'
    },
    visibleDrafts () {
      if (!this.loggedInUser) return this.drafts
      return this.drafts.filter(item => !item.owner || item.owner === this.loggedInUser)
    },
    communityOptions () {
      const options = new Map()
      const add = (value, label) => {
        const tag = normalizeTag(value)
        if (!tag || options.has(tag)) return
        options.set(tag, { label: label || tag, value: tag })
      }
      for (const item of this.$hiveStore.user.communities || []) {
        if (typeof item === 'string') add(item)
        else if (item && item.name) add(item.name, item.title ? item.title + ' · ' + item.name : item.name)
      }
      for (const info of Object.values(this.$hiveStore.communityInfo || {})) {
        if (info && info.name) add(info.name, info.title ? info.title + ' · ' + info.name : info.name)
      }
      return [...options.values()]
    },
    saveLabel () {
      if (this.saveState === 'error') return 'Draft not saved — storage unavailable'
      if (this.saveState === 'saving') return 'Saving…'
      if (this.saveState === 'dirty') return 'Unsaved changes'
      if (this.lastSavedAt) return 'Saved ' + moment(this.lastSavedAt).format('HH:mm')
      return 'Not saved yet'
    },
    beneTotal () {
      return (this.draft?.beneficiaries || []).reduce((total, item) => {
        const value = Number(item.weight)
        return total + (Number.isFinite(value) ? Math.max(0, value) : 0)
      }, 0) / 100
    },
    canAddBeneficiary () {
      const account = this.newBeneAccount.trim().toLowerCase()
      const percent = Number(this.newBenePercent)
      return ACCOUNT_RE.test(account) &&
        !(this.draft?.beneficiaries || []).some(item => item.account === account) &&
        (this.draft?.beneficiaries || []).length < MAX_BENEFICIARIES &&
        Number.isFinite(percent) && percent > 0 && percent <= 100 &&
        this.beneTotal + percent <= 100
    }
  },
  watch: {
    draft: {
      deep: true,
      handler () {
        if (!this.draft) return
        this.scheduleAutosave()
      }
    }
  },
  created () {
    this.hydrate()
  },
  mounted () {
    setPageMeta({
      title: 'Write a Hive post — drafts, preview and publishing',
      description: 'Compose a Hive post with local drafts, markdown preview, community selection, beneficiaries, a publish checklist and posting-key signing.',
      url: '/compose'
    })
    window.addEventListener('keydown', this.onGlobalKeydown)
    window.addEventListener('beforeunload', this.flushAutosave)
    document.addEventListener('visibilitychange', this.onVisibilityChange)
  },
  beforeUnmount () {
    this.flushAutosave()
    window.removeEventListener('keydown', this.onGlobalKeydown)
    window.removeEventListener('beforeunload', this.flushAutosave)
    document.removeEventListener('visibilitychange', this.onVisibilityChange)
  },
  methods: {
    wordCount,
    draftDisplayTitle,
    draftHasContent,
    blankDraft () {
      return createDraft({
        owner: this.loggedInUser || null,
        beneficiaries: normalizeBeneficiaries((this.$hiveStore.user.settings.beneficiary || []).map(item => ({
          account: item.account,
          weight: item.weight
        }))),
        rewards: defaultRewards()
      })
    },
    hydrate () {
      this.drafts = readDrafts(LocalStorage)
      const requested = this.$route.params.draftId
      const found = requested ? this.drafts.find(item => item.id === requested) : null
      const initial = found || this.drafts[0] || this.blankDraft()
      this.setActiveDraft(initial)
    },
    setActiveDraft (draft) {
      this.draft = normalizeDraft(draft)
      this.crossPostInput = this.draft.crossPost ? this.postUrl(this.draft.crossPost) : ''
      this.crossPostError = ''
      this.crossPostTitle = ''
      this.mode = 'write'
      this.lastSavedSnapshot = this.snapshotDraft(this.draft)
      if (!this.drafts.some(item => item.id === this.draft.id)) {
        this.saveState = 'idle'
        this.lastSavedAt = null
      } else {
        const saved = this.drafts.find(item => item.id === this.draft.id)
        this.lastSavedAt = saved.updatedAt
        this.saveState = 'saved'
      }
    },
    snapshotDraft (draft) {
      if (!draft) return ''
      return JSON.stringify({
        title: draft.title,
        body: draft.body,
        tags: draft.tags,
        community: draft.community,
        crossPost: draft.crossPost,
        beneficiaries: draft.beneficiaries,
        rewards: draft.rewards
      })
    },
    scheduleAutosave () {
      if (this.snapshotDraft(this.draft) === this.lastSavedSnapshot) return
      if (!draftHasContent(this.draft)) {
        this.saveState = 'dirty'
        return
      }
      this.saveState = 'dirty'
      if (this.autosaveTimer) clearTimeout(this.autosaveTimer)
      this.autosaveTimer = setTimeout(() => {
        this.autosaveTimer = null
        this.saveDraft({ silent: true })
      }, 700)
    },
    saveDraft ({ silent = false } = {}) {
      if (!this.draft || !draftHasContent(this.draft)) return false
      const now = Date.now()
      const saved = normalizeDraft({
        ...this.draft,
        owner: this.loggedInUser || this.draft.owner,
        updatedAt: now
      }, now)
      this.drafts = upsertDraft(this.drafts, saved, now)
      const ok = writeDrafts(LocalStorage, this.drafts, now)
      if (!ok) {
        this.saveState = 'error'
        if (!this.storageErrorNotified) {
          this.storageErrorNotified = true
          this.$q.notify({ type: 'negative', message: 'Could not save the draft', caption: 'Browser storage is full or unavailable.' })
        }
        return false
      }
      // Keep the in-memory draft as typed. Normalisation only applies to the
      // stored copy so a half-typed beneficiary or tag is not removed mid-edit.
      this.draft.owner = saved.owner
      this.draft.updatedAt = now
      this.lastSavedAt = now
      this.saveState = 'saved'
      this.lastSavedSnapshot = this.snapshotDraft(this.draft)
      if (!silent) this.$q.notify({ type: 'positive', message: 'Draft saved', caption: 'Kept in this browser as a local draft.' })
      return true
    },
    saveNow () {
      if (this.autosaveTimer) {
        clearTimeout(this.autosaveTimer)
        this.autosaveTimer = null
      }
      if (!draftHasContent(this.draft)) {
        if (this.draft) this.saveState = 'idle'
        this.$q.notify({ message: 'Nothing to save yet' })
        return
      }
      this.saveDraft()
    },
    flushAutosave () {
      if (this.autosaveTimer) {
        clearTimeout(this.autosaveTimer)
        this.autosaveTimer = null
      }
      if (this.draft && draftHasContent(this.draft) && this.snapshotDraft(this.draft) !== this.lastSavedSnapshot) {
        this.saveDraft({ silent: true })
      }
    },
    onVisibilityChange () {
      if (document.visibilityState === 'hidden') this.flushAutosave()
    },
    startNewDraft () {
      if (this.draft && draftHasContent(this.draft) && this.snapshotDraft(this.draft) !== this.lastSavedSnapshot) {
        this.saveDraft({ silent: true })
      }
      this.setActiveDraft(this.blankDraft())
      this.$router.replace({ name: 'compose', params: {} }).catch(() => {})
    },
    selectDraft (id) {
      const found = this.drafts.find(item => item.id === id)
      if (!found) return
      if (this.draft && this.snapshotDraft(this.draft) !== this.lastSavedSnapshot) {
        this.saveDraft({ silent: true })
        const refreshed = this.drafts.find(item => item.id === id) || found
        this.setActiveDraft(refreshed)
      } else {
        this.setActiveDraft(found)
      }
      this.$router.replace({ name: 'compose', params: { draftId: id } }).catch(() => {})
    },
    requestDiscard (draft) {
      this.discardTarget = draft
      this.discardOpen = true
    },
    confirmDiscard () {
      const target = this.discardTarget
      this.discardOpen = false
      this.discardTarget = null
      if (!target) return
      this.drafts = removeDraftById(this.drafts, target.id)
      writeDrafts(LocalStorage, this.drafts)
      if (this.draft && this.draft.id === target.id) {
        this.setActiveDraft(this.drafts[0] || this.blankDraft())
        this.$router.replace({ name: 'compose', params: this.drafts[0] ? { draftId: this.drafts[0].id } : {} }).catch(() => {})
      }
      this.$q.notify({ message: 'Draft discarded' })
    },
    setCommunity (value) {
      this.draft.community = normalizeTag(value)
    },
    addCommunity (value, done) {
      const tag = normalizeTag(value)
      if (!tag) {
        this.$q.notify({ message: 'Use lowercase letters, numbers and hyphens for a community tag.' })
        return
      }
      done(tag)
    },
    setTags (value) {
      const tags = normalizeTags(value)
      if (Array.isArray(value) && value.length > MAX_TAGS) {
        this.$q.notify({ message: 'Up to ' + MAX_TAGS + ' tags are kept. Extra tags were dropped.' })
      }
      this.draft.tags = tags
    },
    addTag (value, done) {
      const tag = normalizeTag(value)
      if (!tag) {
        this.$q.notify({ message: 'Use lowercase letters, numbers and hyphens for a tag.' })
        return
      }
      if (this.draft.tags.length >= MAX_TAGS && !this.draft.tags.includes(tag)) {
        this.$q.notify({ message: 'Up to ' + MAX_TAGS + ' tags are allowed.' })
        return
      }
      done(tag)
    },
    setBeneficiaryPercent (index, value) {
      const bene = this.draft.beneficiaries[index]
      if (!bene) return
      const percent = Number(value)
      bene.weight = Number.isFinite(percent) ? Math.round(Math.max(0, Math.min(100, percent)) * 100) : 0
    },
    clampBeneficiary (index) {
      const bene = this.draft.beneficiaries[index]
      if (!bene) return
      const percent = Number(bene.weight) / 100
      bene.weight = Number.isFinite(percent) ? Math.round(Math.max(0, Math.min(100, percent)) * 100) : 0
    },
    addBeneficiary () {
      if (!this.canAddBeneficiary) return
      this.draft.beneficiaries.push({
        account: this.newBeneAccount.trim().toLowerCase(),
        weight: Math.round(Number(this.newBenePercent) * 100)
      })
      this.newBeneAccount = ''
      this.newBenePercent = 10
    },
    removeBeneficiary (index) {
      this.draft.beneficiaries.splice(index, 1)
    },
    postUrl (crossPost) {
      return 'https://hive.ausbit.dev/@' + crossPost.author + '/' + crossPost.permlink
    },
    postLink (crossPost) {
      return '/@' + crossPost.author + '/' + crossPost.permlink
    },
    clearCrossPost () {
      this.draft.crossPost = null
      this.crossPostInput = ''
      this.crossPostTitle = ''
      this.crossPostError = ''
    },
    async loadCrossPost () {
      const parsed = parseHivePostUrl(this.crossPostInput)
      if (!parsed) {
        this.crossPostError = 'Enter a Hive post URL or @author/permlink.'
        return
      }
      this.crossPostError = ''
      this.loadingSource = true
      try {
        const post = await this.$hive.api.getContentAsync(parsed.author, parsed.permlink)
        if (!post || !post.author) {
          this.crossPostError = 'That post was not found on the Hive API.'
          return
        }
        this.draft.crossPost = { author: post.author, permlink: post.permlink }
        this.crossPostTitle = 'Loaded “' + (post.title || post.permlink) + '” by @' + post.author
        if (!this.draft.title.trim()) this.draft.title = post.title || ''
        if (!this.draft.body.trim()) this.draft.body = post.body || ''
        if (!this.draft.community && post.category) this.draft.community = normalizeTag(post.category)
        this.$q.notify({ type: 'positive', message: 'Cross-post source recorded', caption: 'Original content filled when the draft was empty.' })
      } catch (error) {
        this.crossPostError = 'Could not load that post. Check the URL and try again.'
        console.error('Failed to load cross-post source', error)
      } finally {
        this.loadingSource = false
      }
    },
    applyAction (action) {
      if (!this.draft) return
      if (this.mode !== 'write') this.mode = 'write'
      const textarea = this.$refs.body
      const start = textarea ? textarea.selectionStart : this.draft.body.length
      const end = textarea ? textarea.selectionEnd : this.draft.body.length
      const next = applyMarkdownAction(this.draft.body, start, end, action)
      this.draft.body = next.text
      this.$nextTick(() => {
        const element = this.$refs.body
        if (!element) return
        element.focus()
        element.setSelectionRange(next.start, next.end)
      })
    },
    onEditorKeydown (event) {
      const action = shortcutMarkdownAction(event)
      if (action) {
        event.preventDefault()
        this.applyAction(action)
        return
      }
      if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') {
        event.preventDefault()
        this.publish()
      }
    },
    onGlobalKeydown (event) {
      if (!(event.metaKey || event.ctrlKey) || event.altKey) return
      if (String(event.key).toLowerCase() !== 's') return
      event.preventDefault()
      if (this.draft) this.saveNow()
    },
    checklistIcon (status) {
      if (status === 'ok') return 'check_circle'
      if (status === 'warn') return 'warning'
      return 'error'
    },
    publish () {
      if (!this.draft) return
      if (!this.loggedInUser) {
        this.$q.notify({ type: 'negative', message: 'Log in with Keychain or SmartLock to publish.' })
        return
      }
      const errors = collectChecklistErrors(this.checklist)
      if (errors.length) {
        this.$q.notify({ type: 'negative', message: 'Fix the publish checklist first', caption: errors[0].detail })
        return
      }

      try {
        const permlink = createPostPermlink(this.draft.title)
        const item = postQueueItem({ username: this.loggedInUser, draft: this.draft, permlink })
        this.$hiveStore.addToQueue(item)
        this.drafts = removeDraftById(this.drafts, this.draft.id)
        writeDrafts(LocalStorage, this.drafts)
        this.lastSavedSnapshot = ''
        this.setActiveDraft(this.blankDraft())
        this.$router.replace({ name: 'compose', params: {} }).catch(() => {})
        this.$q.notify({
          type: isOnline() ? 'positive' : 'warning',
          message: isOnline() ? 'Post queued for signing' : 'Queued, but you are offline',
          caption: (isOnline()
            ? 'Open the action queue to sign and broadcast it.'
            : 'Reconnect, then retry the failed queue item.') + ' @' + this.loggedInUser + '/' + permlink,
          timeout: 7000
        })
      } catch (error) {
        this.$q.notify({ type: 'negative', message: 'Could not queue the post', caption: error.message })
        console.error('Failed to queue post', error)
      }
    },
    exportCurrent () {
      if (!draftHasContent(this.draft)) {
        this.$q.notify({ message: 'There is nothing to export yet.' })
        return
      }
      const status = exportFile(draftExportFileName(this.draft), serializeDraftExport(this.draft), 'application/json')
      if (status === true) this.$q.notify({ type: 'positive', message: 'Draft exported' })
      else this.$q.notify({ type: 'negative', message: 'Could not export the draft', caption: String(status) })
    },
    exportAll () {
      if (!this.visibleDrafts.length) return
      const status = exportFile(
        'hive-drafts-' + moment().format('YYYY-MM-DD') + '.json',
        serializeDraftExport(this.visibleDrafts),
        'application/json'
      )
      if (status === true) this.$q.notify({ type: 'positive', message: 'Drafts exported', caption: this.visibleDrafts.length + ' drafts backed up.' })
      else this.$q.notify({ type: 'negative', message: 'Could not export drafts', caption: String(status) })
    },
    triggerImport () {
      this.$refs.importInput?.click()
    },
    async onImportFile (event) {
      const input = event.target
      const file = input.files && input.files[0]
      input.value = ''
      if (!file) return
      try {
        const text = await file.text()
        const parsed = parseDraftExport(text, { owner: this.loggedInUser })
        if (parsed.error) {
          this.$q.notify({ type: 'negative', message: 'Import failed', caption: parsed.error })
          return
        }
        const merged = mergeImportedDrafts(this.drafts, parsed.drafts, { owner: this.loggedInUser })
        this.drafts = merged.drafts
        if (!writeDrafts(LocalStorage, this.drafts)) {
          this.$q.notify({ type: 'negative', message: 'Could not save imported drafts', caption: 'Browser storage is full or unavailable.' })
          return
        }
        this.$q.notify({
          type: 'positive',
          message: 'Drafts imported',
          caption: merged.added + ' added · ' + merged.updated + ' updated' + (merged.skipped ? ' · ' + merged.skipped + ' skipped' : '')
        })
        const first = this.drafts.find(item => parsed.drafts.some(imported => imported.id === item.id))
        if (first) this.setActiveDraft(first)
      } catch (error) {
        this.$q.notify({ type: 'negative', message: 'Could not read that file', caption: error.message })
        console.error('Failed to import drafts', error)
      }
    },
    draftTime (value) {
      return value ? moment.utc(value).fromNow() : ''
    }
  }
}
</script>
