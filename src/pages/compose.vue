<template>
  <q-page class="compose-page" :class="{ 'compose-page--fullscreen': fullscreenEditor }">
    <header class="compose-header">
      <div class="compose-header__intro">
        <div class="home-eyebrow">{{ isEditing ? 'Editing a published post' : 'Creator workflow' }}</div>
        <h1 class="page-title">{{ isEditing ? 'Edit post' : 'Write a post' }}</h1>
        <p class="page-intro">
          <template v-if="isEditing">
            Changes keep the same permlink and parent. Queue the edit, then sign it with your posting key.
          </template>
          <template v-else>
            Draft locally, preview the rendered post, then queue it for signing with your posting key.
          </template>
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
            <q-btn flat dense round icon="tune" aria-label="Editor settings" title="Editor settings" @click="settingsOpen = true" />
            <q-btn
              flat
              dense
              round
              :icon="fullscreenEditor ? 'fullscreen_exit' : 'fullscreen'"
              :aria-label="fullscreenEditor ? 'Exit fullscreen editor' : 'Fullscreen editor'"
              :title="fullscreenEditor ? 'Exit fullscreen' : 'Fullscreen'"
              @click="toggleFullscreen"
            />
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
            v-if="!isEditingComment"
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
          <div v-else class="compose-comment-notice">
            <q-icon name="reply" size="16px" aria-hidden="true" />
            <span>Editing a comment. Comments have no title or category.</span>
          </div>

          <div
            class="compose-editor-panes"
            :class="{
              'compose-editor-panes--split': mode === 'split',
              'compose-editor-panes--top-down': mode === 'split' && topDownPreview
            }"
          >
            <div v-if="mode !== 'preview'" class="compose-write">
              <div v-if="isHtmlMode" class="compose-source-mode">
                <q-icon name="code" size="16px" aria-hidden="true" />
                <span>HTML source. The Markdown toolbar is hidden; the preview renders the result.</span>
              </div>
              <markdown-toolbar v-if="!isHtmlMode" @action="applyAction" @upload="openImageUpload()">
                <template #end>
                  <span class="compose-toolbar__count" :title="guidance.words + ' words'">{{ guidance.words }} words</span>
                </template>
              </markdown-toolbar>
              <div class="compose-editor-wrap" @dragover.prevent="onEditorDragOver" @dragleave="onEditorDragLeave" @drop="onEditorDrop">
                <textarea
                  ref="body"
                  v-model="draft.body"
                  class="compose-textarea"
                  :class="{ 'compose-textarea--drag': dragActive }"
                  rows="18"
                  :aria-label="isHtmlMode ? 'Post body in HTML' : 'Post body in Markdown'"
                  :placeholder="isHtmlMode ? 'Write HTML. The preview renders the sanitised result.' : 'Write in Markdown. Paste or drop images to upload them.'"
                  @keydown="onEditorKeydown"
                  @paste="onEditorPaste"
                />
                <div v-if="dragActive" class="compose-drop-hint" aria-hidden="true">
                  <q-icon name="cloud_upload" size="22px" />
                  <span>Drop images to upload</span>
                </div>
              </div>
            </div>

            <div v-if="mode !== 'write'" class="compose-preview">
              <div v-if="!autoUpdatePreview" class="compose-preview__notice">
                <span>{{ previewIsStale ? 'Preview is out of date.' : 'Preview updates when you refresh.' }}</span>
                <q-btn flat dense no-caps icon="refresh" label="Refresh preview" @click="refreshPreview" />
              </div>
              <h3 class="compose-preview__title">{{ draft.title.trim() || 'Untitled post' }}</h3>
              <render v-if="previewBody.trim()" :input="previewBody" :embeds="previewEmbeds" class="postbody" />
              <div v-else class="compose-preview__empty">
                <q-icon name="preview_off" size="22px" aria-hidden="true" />
                <span>Nothing to preview yet. Start the post in Write mode.</span>
              </div>
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
              :label="!loggedInUser ? 'Log in to publish' : isEditing ? 'Queue edit for signing' : 'Queue post for signing'"
              :disable="!canPublish"
              @click="publish"
            />
            <p class="compose-hint">
              <template v-if="isEditing">
                Saving adds a posting-key <code>comment</code> operation for the existing permlink to the action queue.
                Nothing is broadcast until you sign it.
              </template>
              <template v-else>
                Publishing adds a posting-key <code>comment</code> operation to the action queue. Nothing is broadcast until you sign it.
              </template>
            </p>
          </div>
        </section>

        <section v-if="!isEditingComment" class="compose-panel home-card home-panel" aria-labelledby="compose-community-title">
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
              :loading="communityLoading"
              use-input
              fill-input
              hide-selected
              emit-value
              map-options
              outlined
              dense
              label="Community or category"
              aria-label="Community or category"
              hint="Your subscribed communities appear first. Becomes parent_permlink and the first tag."
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
              :hint="tagCountLabel + ' tags. The first 5 are primary discovery tags.'"
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

        <section class="compose-panel home-card home-panel" aria-labelledby="compose-details-title">
          <div class="home-panel__head">
            <div>
              <div class="home-eyebrow">Presentation</div>
              <h2 id="compose-details-title" class="home-panel__title">Post details</h2>
            </div>
            <span class="compose-pill" :class="descriptionCount > descriptionMax ? 'compose-pill--error' : 'compose-pill--muted'">
              {{ descriptionCount }}/{{ descriptionMax }}
            </span>
          </div>
          <div class="home-panel__body compose-fields">
            <div class="compose-cover">
              <div class="compose-cover__preview" :class="{ 'is-empty': !coverImage }">
                <img v-if="coverImage" :src="coverImage" alt="Current cover image" />
                <div v-else class="compose-cover__empty">
                  <q-icon name="image_not_supported" size="18px" aria-hidden="true" />
                  <span>No cover image</span>
                </div>
              </div>
              <div class="compose-cover__body">
                <div class="compose-cover__label">Cover image</div>
                <div class="compose-cover__meta">
                  {{ coverIsCustom ? 'Custom cover selected' : (coverImage ? 'Using the first body image' : 'Add an image or choose one') }}
                </div>
                <div class="compose-inline-actions">
                  <q-btn outline dense no-caps color="primary" icon="photo_library" label="Choose" @click="openCoverPicker" />
                  <q-btn v-if="coverIsCustom" flat dense no-caps icon="undo" label="Reset" @click="clearCover" />
                </div>
              </div>
            </div>

            <q-input
              v-model="draft.description"
              outlined
              dense
              label="Short description"
              aria-label="Post description"
              :maxlength="descriptionMax"
              counter
              hint="Used for cards and link previews. Aim for 120 characters."
            >
              <template #append>
                <q-btn flat dense round icon="auto_fix_high" aria-label="Fill description from the opening paragraph" title="Fill from the opening paragraph" @click="fillDescription" />
              </template>
            </q-input>

            <q-input
              v-model="draft.authorDisplay"
              outlined
              dense
              label="Display author (optional)"
              aria-label="Display author name"
              maxlength="80"
              hint="Shown as the byline while @account remains the on-chain author."
            />

            <q-expansion-item
              icon="smart_toy"
              label="AI usage disclosure"
              :caption="aiToolSummary"
              dense-toggle
              class="compose-disclosure"
            >
              <div class="compose-ai-grid">
                <q-checkbox
                  v-for="option in aiToolOptions"
                  :key="option.key"
                  v-model="draft.aiTools[option.key]"
                  :label="option.label"
                  :aria-label="option.label"
                  dense
                />
              </div>
              <p class="compose-hint">
                Optional. Stored in <code>json_metadata.ai_tools</code> so readers and communities can see how AI helped.
              </p>
            </q-expansion-item>

            <q-input
              v-model="countdownLocal"
              type="datetime-local"
              outlined
              dense
              label="Countdown end (optional)"
              aria-label="Countdown end date and time"
              :error="Boolean(countdownError)"
              :error-message="countdownError"
            >
              <template #append>
                <q-btn v-if="draft.countdown" flat dense round icon="close" aria-label="Clear countdown" title="Clear countdown" @click="clearCountdown" />
              </template>
            </q-input>

            <div class="compose-toggle-row">
              <q-toggle v-model="draft.portfolio" label="Show in portfolio" aria-label="Show in portfolio" dense />
              <span class="compose-hint">Flags the cover image for a profile portfolio.</span>
            </div>
            <div class="compose-toggle-row">
              <q-toggle v-model="draft.collection" label="Collection of posts" aria-label="Collection of posts" dense />
              <span class="compose-hint">
                Adds the <code>collection</code> flag and <code>#{{ collectionTag }}</code> tag. Only use for a real collection.
              </span>
            </div>
          </div>
        </section>

        <section class="compose-panel home-card home-panel" aria-labelledby="compose-crosspost-title">
          <div class="home-panel__head">
            <div>
              <div class="home-eyebrow">Attribution (optional)</div>
              <h2 id="compose-crosspost-title" class="home-panel__title">Cross-post source</h2>
            </div>
          </div>
          <div class="home-panel__body compose-fields">
            <p class="compose-hint compose-hint--top">
              Records the original author and permlink in <code>json_metadata</code> so this post
              shows a “Cross-post of” credit. It does not copy media, rewards or the original’s payout settings.
            </p>
            <q-input
              v-model.trim="crossPostInput"
              outlined
              dense
              label="Hive post URL or @author/permlink"
              aria-label="Cross-post source URL"
              :error="Boolean(crossPostError)"
              :error-message="crossPostError"
              @keyup.enter="loadCrossPost"
            />
            <div class="compose-inline-actions">
              <q-btn
                outline
                no-caps
                color="primary"
                icon="link"
                label="Record source"
                :loading="loadingSource"
                @click="loadCrossPost"
              />
              <q-btn
                v-if="crossPostLoaded"
                flat
                dense
                no-caps
                icon="download"
                label="Copy original text"
                title="Fill the title and body from the original when they are empty"
                @click="applyCrossPostContent"
              />
            </div>
            <div v-if="crossPostTitle" class="compose-source__label compose-source__label--wrap">{{ crossPostTitle }}</div>
          </div>
        </section>

        <section v-if="!isEditingComment" class="compose-panel home-card home-panel" aria-labelledby="compose-rewards-title">
          <div class="home-panel__head">
            <div>
              <div class="home-eyebrow">Rewards</div>
              <h2 id="compose-rewards-title" class="home-panel__title">Beneficiaries and payout</h2>
            </div>
            <span class="compose-pill" :class="!allowRewards ? 'compose-pill--muted' : beneTotal > 100 ? 'compose-pill--error' : 'compose-pill--muted'">
              {{ !allowRewards ? 'Rewards declined' : 'Author ' + Math.max(0, 100 - beneTotal) + '%' }}
            </span>
          </div>
          <div class="home-panel__body compose-fields">
            <div class="compose-toggle-row">
              <q-toggle v-model="allowRewards" label="Allow rewards" aria-label="Allow rewards" dense />
              <span class="compose-hint">Turn this off to decline the Hive reward pool for this post.</span>
            </div>

            <div v-if="!allowRewards" class="compose-rewards-off">
              <q-icon name="money_off" size="17px" aria-hidden="true" />
              <span>Rewards declined. The post will use <code>0.000 HBD</code> as its maximum accepted payout.</span>
            </div>

            <template v-if="allowRewards">
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

              <q-expansion-item
                icon="tune"
                label="Advanced reward settings"
                dense-toggle
                class="compose-disclosure"
              >
                <div class="compose-fields">
                  <q-input
                    v-model.trim="draft.rewards.maxAcceptedPayout"
                    outlined
                    dense
                    label="Maximum accepted payout"
                    aria-label="Maximum accepted payout in HBD"
                    hint="HBD cap. Leave at the default unless the post should stop earning sooner."
                  />
                  <div class="compose-toggles">
                    <q-toggle v-model="draft.rewards.allowVotes" label="Allow votes" dense />
                    <q-toggle v-model="draft.rewards.allowCurationRewards" label="Curation rewards" dense />
                  </div>
                </div>
              </q-expansion-item>
            </template>
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

    <q-dialog v-model="uploadDialogOpen">
      <q-card class="compose-media-dialog">
        <q-card-section class="compose-media-dialog__head">
          <div>
            <div class="home-eyebrow">{{ uploadTarget === 'cover' ? 'Cover image' : 'Post media' }}</div>
            <h2 class="home-panel__title">{{ uploadTarget === 'cover' ? 'Upload a cover image' : 'Upload images' }}</h2>
          </div>
          <q-btn flat dense round icon="close" aria-label="Close upload dialog" title="Close" @click="uploadDialogOpen = false" />
        </q-card-section>
        <q-separator />
        <q-card-section class="compose-media-dialog__body">
          <div v-if="!canUpload" class="compose-warning" role="alert">
            <q-icon name="lock" size="16px" aria-hidden="true" />
            <span>Log in with Keychain or SmartLock to upload images.</span>
          </div>

          <q-file
            :model-value="uploadFiles"
            :multiple="uploadTarget !== 'cover'"
            outlined
            dense
            accept="image/jpeg,image/png,image/gif,image/webp,image/svg+xml,image/avif,image/bmp"
            label="Choose images"
            aria-label="Choose images to upload"
            :disable="uploadBusy"
            @update:model-value="setUploadFiles"
          >
            <template #prepend>
              <q-icon name="cloud_upload" aria-hidden="true" />
            </template>
          </q-file>

          <q-input
            v-if="uploadFiles.length === 1"
            v-model="uploadAlt"
            outlined
            dense
            label="Alt text"
            aria-label="Image alt text"
            hint="Describe the image for screen readers."
            @keyup.enter="uploadSelectedImages"
          />

          <p class="compose-hint">{{ uploadLimitLabel }}</p>
          <q-toggle v-model="centerImages" label="Center uploaded images" aria-label="Center uploaded images" dense />
          <div v-if="uploadStatus" class="compose-upload-status" role="status">{{ uploadStatus }}</div>
          <div v-if="uploadError" class="compose-upload-error" role="alert">
            <q-icon name="error_outline" size="16px" aria-hidden="true" />
            <span>{{ uploadError }}</span>
          </div>

          <div class="compose-upload-actions">
            <q-btn flat no-caps label="Cancel" @click="uploadDialogOpen = false" />
            <q-btn
              unelevated
              no-caps
              color="primary"
              icon="cloud_upload"
              label="Upload"
              :loading="uploadBusy"
              :disable="!canUpload || !uploadFiles.length"
              @click="uploadSelectedImages"
            />
          </div>

          <div v-if="recentUploads.length" class="compose-upload-recent">
            <div class="compose-upload-recent__head">
              <span>Recent uploads</span>
              <q-btn flat dense no-caps icon="delete_sweep" label="Clear" @click="clearUploads" />
            </div>
            <div class="compose-media-grid">
              <button
                v-for="entry in recentUploads"
                :key="entry.url"
                type="button"
                class="compose-media-tile"
                @click="useRecentUpload(entry)"
              >
                <img :src="entry.url" :alt="entry.alt || 'Uploaded image'" loading="lazy" />
                <span>{{ uploadTarget === 'cover' ? 'Use as cover' : 'Insert' }}</span>
              </button>
            </div>
          </div>
        </q-card-section>
      </q-card>
    </q-dialog>

    <q-dialog v-model="coverDialogOpen">
      <q-card class="compose-media-dialog">
        <q-card-section class="compose-media-dialog__head">
          <div>
            <div class="home-eyebrow">Presentation</div>
            <h2 class="home-panel__title">Choose a cover image</h2>
          </div>
          <q-btn flat dense round icon="close" aria-label="Close cover dialog" title="Close" @click="coverDialogOpen = false" />
        </q-card-section>
        <q-separator />
        <q-card-section class="compose-media-dialog__body">
          <p class="compose-hint compose-hint--top">
            The first body image is used by default. Choose another image for cards, link previews and the portfolio.
          </p>
          <div v-if="coverCandidates.length" class="compose-media-grid">
            <button
              v-for="candidate in coverCandidates"
              :key="candidate.url"
              type="button"
              class="compose-media-tile"
              :class="{ 'is-selected': coverImage === candidate.url }"
              @click="setCover(candidate)"
            >
              <img :src="candidate.url" :alt="candidate.alt || 'Cover candidate'" loading="lazy" />
              <span>{{ coverImage === candidate.url ? 'Current cover' : 'Use as cover' }}</span>
            </button>
          </div>
          <div v-else class="compose-empty-line">
            <q-icon name="image_not_supported" size="17px" aria-hidden="true" />
            <span>No images yet. Upload one first.</span>
          </div>
          <div class="compose-inline-actions">
            <q-btn outline no-caps color="primary" icon="cloud_upload" label="Upload cover" @click="openCoverUpload" />
            <q-btn v-if="coverIsCustom" flat no-caps icon="undo" label="Use first body image" @click="resetCover" />
          </div>
        </q-card-section>
      </q-card>
    </q-dialog>

    <q-dialog v-model="settingsOpen">
      <q-card class="compose-settings">
        <q-card-section class="compose-media-dialog__head">
          <div>
            <div class="home-eyebrow">Editor</div>
            <h2 class="home-panel__title">Editor settings</h2>
          </div>
          <q-btn flat dense round icon="close" aria-label="Close editor settings" title="Close" @click="settingsOpen = false" />
        </q-card-section>
        <q-separator />
        <q-card-section class="compose-settings__body">
          <div class="compose-setting-row">
            <div>
              <div class="compose-setting__label">Source mode</div>
              <div class="compose-setting__hint">Markdown is the default. HTML edits the raw source directly.</div>
            </div>
            <q-btn-toggle
              v-model="sourceMode"
              no-caps
              unelevated
              toggle-color="primary"
              :options="sourceOptions"
              aria-label="Editor source mode"
            />
          </div>
          <div class="compose-setting-row">
            <div>
              <div class="compose-setting__label">Auto-update preview</div>
              <div class="compose-setting__hint">Render the preview as you type. Turn it off for very long posts.</div>
            </div>
            <q-toggle v-model="autoUpdatePreview" aria-label="Auto-update preview" dense />
          </div>
          <div class="compose-setting-row">
            <div>
              <div class="compose-setting__label">Preview embeds</div>
              <div class="compose-setting__hint">Show click-to-load video and audio players in the preview.</div>
            </div>
            <q-toggle v-model="previewEmbeds" aria-label="Preview embeds" dense />
          </div>
          <div class="compose-setting-row">
            <div>
              <div class="compose-setting__label">Top-down preview</div>
              <div class="compose-setting__hint">In Split view, put the preview above the editor.</div>
            </div>
            <q-toggle v-model="topDownPreview" aria-label="Top-down preview" dense />
          </div>
          <div class="compose-setting-row">
            <div>
              <div class="compose-setting__label">Center uploaded images</div>
              <div class="compose-setting__hint">Wrap newly inserted images in a centered block.</div>
            </div>
            <q-toggle v-model="centerImages" aria-label="Center uploaded images" dense />
          </div>
          <div class="compose-setting-row">
            <div>
              <div class="compose-setting__label">Fullscreen editor</div>
              <div class="compose-setting__hint">Hide the publishing sidebar while you write.</div>
            </div>
            <q-toggle v-model="fullscreenEditor" aria-label="Fullscreen editor" dense />
          </div>
          <div class="compose-settings__actions">
            <q-btn flat no-caps icon="content_copy" label="Copy Markdown" @click="copyDraft" />
            <q-btn flat no-caps icon="refresh" label="Refresh preview" @click="refreshPreview" />
            <q-btn flat no-caps icon="help_outline" label="Markdown help" @click="openEditorHelp" />
          </div>
        </q-card-section>
      </q-card>
    </q-dialog>

    <q-dialog v-model="helpOpen">
      <q-card class="compose-settings compose-help">
        <q-card-section class="compose-media-dialog__head">
          <div>
            <div class="home-eyebrow">Reference</div>
            <h2 class="home-panel__title">Markdown help</h2>
          </div>
          <q-btn flat dense round icon="close" aria-label="Close markdown help" title="Close" @click="helpOpen = false" />
        </q-card-section>
        <q-separator />
        <q-card-section class="compose-help__body">
          <dl class="compose-help__list">
            <div><dt><code>**bold**</code></dt><dd>Bold text</dd></div>
            <div><dt><code>*italic*</code></dt><dd>Italic text</dd></div>
            <div><dt><code>~~struck~~</code></dt><dd>Strikethrough</dd></div>
            <div><dt><code># Heading</code></dt><dd>Heading levels 1 to 3 use one to three hashes</dd></div>
            <div><dt><code>- item</code></dt><dd>Bullet list; use <code>1.</code> for numbered lists</dd></div>
            <div><dt><code>- [ ] task</code></dt><dd>Task list item</dd></div>
            <div><dt><code>[label](url)</code></dt><dd>Link</dd></div>
            <div><dt><code>![alt](url)</code></dt><dd>Image with alternative text</dd></div>
            <div><dt><code>&gt; quote</code></dt><dd>Block quote</dd></div>
            <div><dt><code>`code`</code></dt><dd>Inline code; use three backticks for a block</dd></div>
            <div><dt><code>---</code></dt><dd>Divider</dd></div>
            <div><dt><code>&lt;center&gt;…&lt;/center&gt;</code></dt><dd>Centered image or short block</dd></div>
          </dl>
          <p class="compose-hint">
            Keyboard: Ctrl/⌘ B bold, I italic, U underline, K link, Shift+X strikethrough,
            Alt+1/2/3 headings, Tab indent, Shift+Tab outdent, Ctrl+Enter publish.
          </p>
        </q-card-section>
      </q-card>
    </q-dialog>

    <q-dialog v-model="reviewOpen">
      <q-card class="compose-review">
        <q-card-section class="compose-media-dialog__head">
          <div>
            <div class="home-eyebrow">Review</div>
            <h2 class="home-panel__title">{{ isEditing ? 'Queue this edit?' : 'Queue this post?' }}</h2>
          </div>
          <q-btn flat dense round icon="close" aria-label="Close review dialog" title="Close" @click="reviewOpen = false" />
        </q-card-section>
        <q-separator />
        <q-card-section class="compose-review__body">
          <dl class="compose-review__list">
            <div v-for="row in reviewSummary" :key="row.label" class="compose-review__row">
              <dt>{{ row.label }}</dt>
              <dd>{{ row.value }}</dd>
            </div>
          </dl>
          <p class="compose-hint">
            Queuing adds a posting-key <code>comment</code> operation to the action queue.
            Nothing is broadcast until you sign it.
          </p>
        </q-card-section>
        <q-card-actions align="right" class="compose-review__actions">
          <q-btn flat no-caps label="Back" @click="reviewOpen = false" />
          <q-btn
            unelevated
            no-caps
            color="primary"
            icon="send"
            :label="isEditing ? 'Queue edit for signing' : 'Queue for signing'"
            @click="confirmPublish"
          />
        </q-card-actions>
      </q-card>
    </q-dialog>

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

.compose-comment-notice {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  padding: 0.45rem 0.6rem;
  border: 1px solid rgba(79, 195, 247, 0.28);
  border-radius: var(--radius-sm);
  background: rgba(79, 195, 247, 0.06);
  color: #90a4ae;
  font-size: 0.75rem;
}

.compose-write {
  margin-top: 0.65rem;
}

.compose-editor-panes--split {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
  gap: 0.75rem;
}

.compose-editor-panes--split .compose-write,
.compose-editor-panes--split .compose-preview {
  min-width: 0;
}

.compose-editor-panes--split .compose-textarea,
.compose-editor-panes--split .compose-preview {
  min-height: 520px;
}

.compose-editor-panes--top-down {
  display: flex;
  flex-direction: column;
}

.compose-editor-panes--top-down .compose-preview {
  order: -1;
}

.compose-source-mode {
  display: flex;
  align-items: flex-start;
  gap: 0.4rem;
  margin-top: 0.65rem;
  padding: 0.45rem 0.6rem;
  border: 1px solid rgba(79, 195, 247, 0.28);
  border-radius: var(--radius-sm);
  background: rgba(79, 195, 247, 0.06);
  color: #90a4ae;
  font-size: 0.72rem;
  line-height: 1.45;
}

.compose-preview__notice {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
  flex-wrap: wrap;
  margin-bottom: 0.55rem;
  padding: 0.3rem 0.45rem;
  border: 1px solid rgba(255, 183, 77, 0.28);
  border-radius: var(--radius-sm);
  background: rgba(255, 183, 77, 0.06);
  color: #ffcc80;
  font-size: 0.7rem;
}

.compose-editor-wrap {
  position: relative;
}

.compose-drop-hint {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.45rem;
  border: 2px dashed rgba(79, 195, 247, 0.7);
  border-radius: var(--radius-sm);
  background: rgba(13, 20, 25, 0.88);
  color: #81d4fa;
  font-size: 0.85rem;
  font-weight: 600;
  pointer-events: none;
}

.compose-textarea--drag {
  border-color: rgba(79, 195, 247, 0.7);
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

.compose-hint--top {
  margin: 0 0 0.1rem;
}

.compose-fields {
  display: flex;
  flex-direction: column;
  gap: 0.6rem;
}

.compose-cover {
  display: flex;
  gap: 0.6rem;
  align-items: flex-start;
  padding: 0.5rem;
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-sm);
  background: rgba(255, 255, 255, 0.02);
}

.compose-cover__preview {
  flex: none;
  width: 92px;
  height: 68px;
  overflow: hidden;
  border-radius: 4px;
  background: #0d1419;
}

.compose-cover__preview img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.compose-cover__preview.is-empty {
  display: flex;
  align-items: center;
  justify-content: center;
  border: 1px dashed var(--border-subtle);
}

.compose-cover__empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.15rem;
  color: #78909c;
  font-size: 0.62rem;
  text-align: center;
}

.compose-cover__body {
  flex: 1;
  min-width: 0;
}

.compose-cover__label {
  color: #cfd8dc;
  font-size: 0.75rem;
  font-weight: 600;
}

.compose-cover__meta {
  margin: 0.1rem 0 0.35rem;
  color: #78909c;
  font-size: 0.68rem;
  line-height: 1.4;
}

.compose-toggle-row {
  display: flex;
  align-items: flex-start;
  gap: 0.5rem;
  flex-wrap: wrap;
}

.compose-toggle-row .compose-hint {
  flex: 1;
  min-width: 120px;
  margin: 0.2rem 0 0;
}

.compose-rewards-off {
  display: flex;
  align-items: flex-start;
  gap: 0.4rem;
  padding: 0.5rem 0.6rem;
  border: 1px solid rgba(255, 183, 77, 0.3);
  border-radius: var(--radius-sm);
  background: rgba(255, 183, 77, 0.07);
  color: #ffcc80;
  font-size: 0.72rem;
  line-height: 1.45;
}

.compose-disclosure {
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-sm);
  background: rgba(255, 255, 255, 0.02);
}

.compose-disclosure :deep(.q-item) {
  padding: 0.35rem 0.5rem;
}

.compose-ai-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0.15rem 0.5rem;
  padding: 0.25rem 0.55rem 0.1rem;
}

.compose-media-dialog {
  width: 560px;
  max-width: 94vw;
  max-height: 88vh;
  overflow: auto;
  background: #1d1d1d;
}

.compose-review {
  width: 600px;
  max-width: 94vw;
  max-height: 88vh;
  overflow: auto;
  background: #1d1d1d;
}

.compose-review__body {
  padding: 0.9rem 1rem 0.6rem;
}

.compose-review__list {
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
  margin: 0;
}

.compose-review__row {
  display: grid;
  grid-template-columns: 110px minmax(0, 1fr);
  gap: 0.6rem;
  padding-bottom: 0.35rem;
  border-bottom: 1px solid rgba(255, 255, 255, 0.05);
}

.compose-review__row dt {
  color: #78909c;
  font-size: 0.7rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.04em;
}

.compose-review__row dd {
  margin: 0;
  color: #cfd8dc;
  font-size: 0.78rem;
  line-height: 1.45;
  overflow-wrap: anywhere;
}

.compose-review__actions {
  padding: 0.6rem 0.9rem 0.8rem;
  border-top: 1px solid var(--border-subtle);
  background: rgba(255, 255, 255, 0.02);
}

.compose-settings {
  width: 560px;
  max-width: 94vw;
  max-height: 88vh;
  overflow: auto;
  background: #1d1d1d;
}

.compose-settings__body {
  display: flex;
  flex-direction: column;
  gap: 0.55rem;
  padding: 0.9rem 1rem 1rem;
}

.compose-setting-row {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 0.9rem;
  padding-bottom: 0.55rem;
  border-bottom: 1px solid rgba(255, 255, 255, 0.05);
}

.compose-setting__label {
  color: #e4eaed;
  font-size: 0.78rem;
  font-weight: 600;
}

.compose-setting__hint {
  margin-top: 0.1rem;
  color: #78909c;
  font-size: 0.69rem;
  line-height: 1.45;
}

.compose-settings__actions {
  display: flex;
  align-items: center;
  gap: 0.25rem;
  flex-wrap: wrap;
  padding-top: 0.35rem;
}

.compose-help__body {
  padding: 0.9rem 1rem 1rem;
}

.compose-help__list {
  display: flex;
  flex-direction: column;
  gap: 0.3rem;
  margin: 0 0 0.7rem;
}

.compose-help__list > div {
  display: grid;
  grid-template-columns: 170px minmax(0, 1fr);
  gap: 0.6rem;
  padding-bottom: 0.3rem;
  border-bottom: 1px solid rgba(255, 255, 255, 0.05);
}

.compose-help__list dt {
  color: #81d4fa;
  font-size: 0.72rem;
}

.compose-help__list dt code {
  color: #81d4fa;
}

.compose-help__list dd {
  margin: 0;
  color: #b0bec5;
  font-size: 0.72rem;
  line-height: 1.45;
}

.compose-page--fullscreen .compose-side {
  display: none;
}

.compose-page--fullscreen .compose-grid {
  grid-template-columns: minmax(0, 1fr);
}

.compose-page--fullscreen .compose-main {
  position: static;
}

.compose-media-dialog__head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: var(--space-2);
  padding: 0.8rem 1rem 0.7rem;
}

.compose-media-dialog__body {
  display: flex;
  flex-direction: column;
  gap: 0.6rem;
  padding: 0.9rem 1rem 1rem;
}

.compose-upload-actions {
  display: flex;
  justify-content: flex-end;
  gap: 0.4rem;
}

.compose-upload-status {
  color: #90caf9;
  font-size: 0.74rem;
}

.compose-upload-error {
  display: flex;
  align-items: flex-start;
  gap: 0.35rem;
  color: #ff8a80;
  font-size: 0.75rem;
  line-height: 1.45;
}

.compose-upload-recent {
  margin-top: 0.3rem;
  padding-top: 0.6rem;
  border-top: 1px solid var(--border-subtle);
}

.compose-upload-recent__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
  color: #b0bec5;
  font-size: 0.74rem;
  font-weight: 600;
}

.compose-media-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(104px, 1fr));
  gap: 0.45rem;
  margin-top: 0.45rem;
}

.compose-media-tile {
  display: flex;
  flex-direction: column;
  gap: 0.2rem;
  padding: 0.25rem;
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-sm);
  background: rgba(255, 255, 255, 0.03);
  color: #90a4ae;
  cursor: pointer;
  font: inherit;
  font-size: 0.62rem;
  text-align: left;
}

.compose-media-tile img {
  width: 100%;
  height: 72px;
  object-fit: cover;
  border-radius: 3px;
}

.compose-media-tile:hover,
.compose-media-tile:focus-visible {
  border-color: rgba(79, 195, 247, 0.55);
  color: #e4eaed;
}

.compose-media-tile:focus-visible {
  outline: 2px solid #4fc3f7;
  outline-offset: 2px;
}

.compose-media-tile.is-selected {
  border-color: #4fc3f7;
  background: rgba(79, 195, 247, 0.1);
  color: #e4eaed;
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

.compose-source__label--wrap {
  overflow-wrap: anywhere;
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

  .compose-editor-panes--split {
    grid-template-columns: minmax(0, 1fr);
  }

  .compose-editor-panes--split .compose-textarea,
  .compose-editor-panes--split .compose-preview {
    min-height: 430px;
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

  .compose-setting-row {
    flex-direction: column;
    align-items: stretch;
  }

  .compose-help__list > div {
    grid-template-columns: minmax(0, 1fr);
    gap: 0.1rem;
  }
}
</style>

<script>
import { LocalStorage, copyToClipboard, exportFile } from 'quasar'
import { defineAsyncComponent } from 'vue'
import { keychain } from '@hiveio/keychain'
import smartlock from 'components/smartlock/index.js'
import moment from 'src/utils/time'
import { applyMarkdownAction, continueMarkdownList, shortcutMarkdownAction, wordCount } from 'src/utils/markdownEditor'
import { altFromFileName, deriveDescription, extractBodyImages, markdownImage } from 'src/utils/media'
import { detectEmbed } from 'src/services/embeds'
import {
  AI_TOOL_KEYS,
  COLLECTION_TAG,
  DESCRIPTION_MAX,
  MAX_BENEFICIARIES,
  MAX_TAGS,
  createDraft,
  defaultAiTools,
  defaultRewards,
  draftDisplayTitle,
  draftExportFileName,
  draftHasContent,
  draftLengthGuidance,
  mergeImportedDrafts,
  normalizeBeneficiaries,
  normalizeCoverImage,
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
  appendUploadHistory,
  buildImageSigningPayload,
  clearUploadHistory,
  imageHostErrorMessage,
  MAX_IMAGE_BYTES,
  readImageBytes,
  readUploadHistory,
  RECOMMENDED_IMAGE_BYTES,
  uploadImage,
  validateImageFile
} from 'src/services/imageHost'
import {
  AI_TOOL_LABELS,
  canPublish as canPublishDraft,
  checklistErrors as collectChecklistErrors,
  createPostPermlink,
  parseHivePostUrl,
  postQueueItem,
  publishChecklist,
  readCrossPostMetadata,
  resolvedTags
} from 'src/services/publish'
import { isOnline } from 'src/services/connectivity'
import { setPageMeta } from 'src/utils/pageMeta'

const ACCOUNT_RE = /^[a-z][a-z0-9.-]{2,15}$/

function parseJsonMetadata (value) {
  if (!value) return null
  if (typeof value === 'object') return value
  try {
    const parsed = JSON.parse(value)
    return parsed && typeof parsed === 'object' ? parsed : null
  } catch {
    return null
  }
}

function pad2 (value) {
  return String(value).padStart(2, '0')
}

/** ISO timestamp -> the local value a datetime-local input expects. */
function toLocalDateTimeInput (value) {
  const time = Date.parse(value || '')
  if (!Number.isFinite(time)) return ''
  const date = new Date(time)
  return date.getFullYear() + '-' + pad2(date.getMonth() + 1) + '-' + pad2(date.getDate()) +
    'T' + pad2(date.getHours()) + ':' + pad2(date.getMinutes())
}

/** datetime-local value -> ISO timestamp for json_metadata.countdown. */
function fromLocalDateTimeInput (value) {
  if (!value) return ''
  const time = Date.parse(value)
  return Number.isFinite(time) ? new Date(time).toISOString() : ''
}

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
      editingLoading: false,
      lastSavedAt: null,
      lastSavedSnapshot: '',
      autosaveTimer: null,
      storageErrorNotified: false,
      crossPostInput: '',
      crossPostError: '',
      crossPostTitle: '',
      crossPostLoaded: false,
      // Original post fetched with the attribution, applied only on request.
      crossPostOriginal: null,
      loadingSource: false,
      newBeneAccount: '',
      newBenePercent: 10,
      discardOpen: false,
      discardTarget: null,
      communityLoading: false,
      communityLoadedFor: null,
      uploadDialogOpen: false,
      uploadFiles: [],
      uploadAlt: '',
      uploadError: '',
      uploadTarget: 'body',
      uploadBusy: false,
      uploadStatus: '',
      recentUploads: [],
      dragActive: false,
      savedSelection: { start: 0, end: 0 },
      coverDialogOpen: false,
      centerImages: LocalStorage.getItem('composeCenterImages') === true,
      reviewOpen: false,
      settingsOpen: false,
      helpOpen: false,
      fullscreenEditor: false,
      previewBody: '',
      previewTimer: null,
      autoUpdatePreview: LocalStorage.getItem('composeAutoPreview') !== false,
      previewEmbeds: LocalStorage.getItem('composePreviewEmbeds') !== false,
      topDownPreview: LocalStorage.getItem('composeTopDownPreview') === true,
      sourceMode: LocalStorage.getItem('composeSourceMode') === 'html' ? 'html' : 'markdown',
      sourceOptions: [
        { label: 'Markdown', value: 'markdown' },
        { label: 'HTML source', value: 'html' }
      ],
      aiToolOptions: [
        { key: 'media_generation', label: 'Generating media on the post' },
        { key: 'translation', label: 'Language translation' },
        { key: 'post_draft', label: 'Writing the text' },
        { key: 'writing_edit', label: "Editing the author's text" },
        { key: 'research', label: 'Researching' },
        { key: 'other', label: 'Other AI assistance' }
      ],
      modeOptions: [
        { label: 'Write', value: 'write', icon: 'edit' },
        { label: 'Split', value: 'split', icon: 'vertical_split' },
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
    loginType () {
      return this.$hiveStore.user.loginType || null
    },
    allowRewards: {
      get () {
        return !(this.draft && this.draft.rewards && this.draft.rewards.decline)
      },
      set (value) {
        if (!this.draft) return
        const rewards = this.draft.rewards
        rewards.decline = !value
        if (value && (!rewards.maxAcceptedPayout || /^0(?:\.0+)?\s*(?:HBD)?$/i.test(rewards.maxAcceptedPayout))) {
          rewards.maxAcceptedPayout = '100000.000 HBD'
        }
      }
    },
    bodyImages () {
      return this.draft ? extractBodyImages(this.draft.body) : []
    },
    coverImage () {
      if (!this.draft) return ''
      const custom = normalizeCoverImage(this.draft.coverImage)
      if (custom) return custom
      return this.bodyImages[0]?.url || ''
    },
    coverIsCustom () {
      return Boolean(this.draft && normalizeCoverImage(this.draft.coverImage))
    },
    coverCandidates () {
      const options = []
      const seen = new Set()
      const push = (url, alt, source) => {
        const safe = normalizeCoverImage(url)
        if (!safe || seen.has(safe)) return
        seen.add(safe)
        options.push({ url: safe, alt: String(alt || ''), source })
      }
      if (this.coverIsCustom) push(this.draft.coverImage, 'Current cover', 'cover')
      for (const image of this.bodyImages) push(image.url, image.alt, 'body')
      for (const entry of this.recentUploads) push(entry.url, entry.alt, 'upload')
      return options
    },
    aiToolSummary () {
      if (!this.draft || !this.draft.aiTools) return 'Not declared'
      const labels = AI_TOOL_KEYS
        .filter(key => this.draft.aiTools[key])
        .map(key => AI_TOOL_LABELS[key] || key)
      return labels.length ? labels.join(' · ') : 'Not declared'
    },
    descriptionCount () {
      return String(this.draft?.description || '').length
    },
    descriptionMax () {
      return DESCRIPTION_MAX
    },
    collectionTag () {
      return COLLECTION_TAG
    },
    countdownLocal: {
      get () {
        return toLocalDateTimeInput(this.draft?.countdown)
      },
      set (value) {
        if (!this.draft) return
        this.draft.countdown = value ? fromLocalDateTimeInput(value) : ''
      }
    },
    countdownError () {
      if (!this.draft?.countdown) return ''
      const time = Date.parse(this.draft.countdown)
      if (!Number.isFinite(time)) return 'Enter a valid date and time.'
      if (time <= Date.now()) return 'Choose a future date and time.'
      return ''
    },
    tagCountLabel () {
      return (this.draft?.tags?.length || 0) + ' / ' + MAX_TAGS
    },
    uploadLimitLabel () {
      return 'Up to ' + Math.round(MAX_IMAGE_BYTES / (1024 * 1024)) + ' MB per image. Files over ' +
        Math.round(RECOMMENDED_IMAGE_BYTES / (1024 * 1024)) + ' MB may be slow to upload.'
    },
    canUpload () {
      return Boolean(this.loggedInUser)
    },
    previewIsStale () {
      return Boolean(this.draft) && this.previewBody !== this.draft.body
    },
    isHtmlMode () {
      return this.sourceMode === 'html'
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
    reviewSummary () {
      if (!this.draft) return []
      const draft = this.draft
      const tags = resolvedTags(draft)
      const split = draft.rewards.decline
        ? 'Rewards declined · 0.000 HBD cap'
        : ((draft.rewards.percentHbd === 10000
            ? '100% HBD'
            : draft.rewards.percentHbd === 0
              ? '100% HP'
              : (draft.rewards.percentHbd / 100) + '% HBD / ' + ((10000 - draft.rewards.percentHbd) / 100) + '% HP') +
          ' · cap ' + draft.rewards.maxAcceptedPayout)
      const rows = [
        { label: 'Title', value: draft.title.trim() || 'Untitled' },
        { label: 'Destination', value: draft.community ? '#' + draft.community : (tags[0] ? '#' + tags[0] : 'None') },
        { label: 'Tags', value: tags.length ? tags.map(tag => '#' + tag).join(' ') : 'None' },
        { label: 'Cover', value: this.coverImage ? (this.coverIsCustom ? 'Custom image' : 'First body image') : 'No image' },
        { label: 'Description', value: draft.description || '(auto from the opening paragraph)' },
        { label: 'Rewards', value: split },
        {
          label: 'Beneficiaries',
          value: draft.beneficiaries.length
            ? draft.beneficiaries.map(item => '@' + item.account + ' ' + (item.weight / 100) + '%').join(' · ')
            : 'None'
        },
        { label: 'AI disclosure', value: this.aiToolSummary }
      ]
      if (draft.countdown) rows.push({ label: 'Countdown', value: new Date(draft.countdown).toLocaleString() })
      if (draft.portfolio) rows.push({ label: 'Portfolio', value: 'Shown' })
      if (draft.collection) rows.push({ label: 'Collection', value: 'Flagged' })
      if (draft.authorDisplay) rows.push({ label: 'Display author', value: draft.authorDisplay })
      if (draft.crossPost) rows.push({ label: 'Cross-post', value: '@' + draft.crossPost.author + '/' + draft.crossPost.permlink })
      return rows
    },
    canPublish () {
      return Boolean(this.draft) && canPublishDraft(this.draft, { username: this.loggedInUser })
    },
    activeDraftTitle () {
      return this.draft ? draftDisplayTitle(this.draft) : 'New draft'
    },
    isEditing () {
      return Boolean(this.draft && this.draft.editing)
    },
    /** Editing a reply: no title, no category, no reward settings. */
    isEditingComment () {
      return Boolean(this.draft && this.draft.editing && this.draft.editing.parentAuthor)
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
        if (typeof item === 'string') {
          add(item)
        } else if (Array.isArray(item)) {
          add(item[0], item[1] ? item[1] + ' · ' + item[0] : item[0])
        } else if (item && item.name) {
          add(item.name, item.title ? item.title + ' · ' + item.name : item.name)
        }
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
    },
    loggedInUser (value, previous) {
      if (value === previous) return
      this.communityLoadedFor = null
      this.loadCommunitySubscriptions()
      this.loadUploadHistory()
    },
    'draft.body' () {
      this.schedulePreview()
    },
    mode (value) {
      if (value !== 'write' && this.autoUpdatePreview) this.refreshPreview()
    },
    autoUpdatePreview (value) {
      LocalStorage.set('composeAutoPreview', value === true)
      if (value) this.refreshPreview()
    },
    previewEmbeds (value) {
      LocalStorage.set('composePreviewEmbeds', value === true)
    },
    topDownPreview (value) {
      LocalStorage.set('composeTopDownPreview', value === true)
    },
    sourceMode (value) {
      LocalStorage.set('composeSourceMode', value === 'html' ? 'html' : 'markdown')
    },
    centerImages (value) {
      LocalStorage.set('composeCenterImages', value === true)
    }
  },
  created () {
    this.hydrate()
  },
  mounted () {
    setPageMeta({
      title: 'Write a Hive post — drafts, preview and publishing',
      description: 'Compose a Hive post with local drafts, markdown preview, media uploads, community selection, beneficiaries, a publish checklist and posting-key signing.',
      url: '/compose'
    })
    this.loadCommunitySubscriptions()
    this.loadUploadHistory()
    window.addEventListener('keydown', this.onGlobalKeydown)
    window.addEventListener('beforeunload', this.flushAutosave)
    document.addEventListener('visibilitychange', this.onVisibilityChange)
  },
  beforeUnmount () {
    this.flushAutosave()
    if (this.previewTimer) clearTimeout(this.previewTimer)
    window.removeEventListener('keydown', this.onGlobalKeydown)
    window.removeEventListener('beforeunload', this.flushAutosave)
    document.removeEventListener('visibilitychange', this.onVisibilityChange)
  },
  methods: {
    wordCount,
    draftDisplayTitle,
    draftHasContent,
    async loadCommunitySubscriptions () {
      const user = this.loggedInUser
      if (!user || this.communityLoadedFor === user) return
      this.communityLoading = true
      try {
        await this.$hiveStore.getCommunitySubscriptions(user)
        this.communityLoadedFor = user
      } catch (error) {
        console.error('Failed to load community subscriptions', error)
      } finally {
        this.communityLoading = false
      }
    },
    loadUploadHistory () {
      this.recentUploads = readUploadHistory(LocalStorage, this.loggedInUser)
    },
    schedulePreview () {
      if (!this.draft) return
      if (!this.autoUpdatePreview) return
      if (this.previewTimer) clearTimeout(this.previewTimer)
      this.previewTimer = setTimeout(() => {
        this.previewTimer = null
        this.refreshPreview()
      }, 320)
    },
    refreshPreview () {
      if (!this.draft) return
      if (this.previewTimer) {
        clearTimeout(this.previewTimer)
        this.previewTimer = null
      }
      this.previewBody = this.draft.body
    },
    copyDraft () {
      if (!this.draft || !this.draft.body) {
        this.$q.notify({ message: 'There is nothing to copy yet.' })
        return
      }
      copyToClipboard(this.draft.body)
        .then(() => this.$q.notify({ type: 'positive', message: 'Post content copied as Markdown' }))
        .catch(() => this.$q.notify({ type: 'negative', message: 'Could not copy the post content' }))
    },
    toggleFullscreen () {
      this.fullscreenEditor = !this.fullscreenEditor
    },
    openEditorHelp () {
      this.settingsOpen = false
      this.helpOpen = true
    },
    captureSelection () {
      const element = this.$refs.body
      const fallback = this.draft ? this.draft.body.length : 0
      this.savedSelection = element
        ? { start: element.selectionStart ?? fallback, end: element.selectionEnd ?? fallback }
        : { start: fallback, end: fallback }
    },
    openImageUpload (target = 'body', files = null) {
      if (!this.canUpload) {
        this.$q.notify({
          type: 'warning',
          message: 'Log in to upload images',
          caption: 'You can still insert an image URL from the toolbar.'
        })
        return
      }
      this.uploadTarget = target
      this.uploadError = ''
      this.uploadStatus = ''
      this.uploadAlt = ''
      this.uploadFiles = files ? Array.from(files) : []
      if (this.uploadFiles.length === 1) this.uploadAlt = altFromFileName(this.uploadFiles[0].name)
      this.captureSelection()
      this.uploadDialogOpen = true
    },
    openCoverUpload () {
      this.coverDialogOpen = false
      this.openImageUpload('cover')
    },
    setUploadFiles (value) {
      this.uploadFiles = Array.isArray(value) ? value : value ? [value] : []
      this.uploadAlt = this.uploadFiles.length === 1 ? altFromFileName(this.uploadFiles[0].name) : ''
      this.uploadError = ''
    },
    async ensureSmartlockUnlocked () {
      const user = this.loggedInUser
      if (!user) throw new Error('Log in to upload images.')
      const minutes = Number(this.$hiveStore.user.settings.smartlockSessionMinutes) || 15
      if (smartlock.isAccountUnlocked(user, minutes * 60 * 1000)) return
      const password = await new Promise(resolve => {
        this.$q.dialog({
          title: 'Unlock SmartLock',
          message: 'Enter the SmartLock password to sign the image upload.',
          prompt: { model: '', type: 'password', outlined: true, label: 'Password' },
          cancel: true,
          persistent: true
        }).onOk(resolve).onCancel(() => resolve(''))
      })
      if (!password) throw new Error('SmartLock is locked. Unlock it to upload images.')
      await smartlock.unlockAccount(user, password, false)
    },
    async signImagePayload (payload) {
      const user = this.loggedInUser
      if (!user) throw new Error('Log in with Keychain or SmartLock to upload images.')
      if (this.loginType === 'keychain') {
        const result = await keychain(window, 'requestSignBuffer', user, payload, 'Posting')
        if (!result?.success) {
          throw new Error(result?.cancel ? 'Cancelled in Keychain.' : (result?.msg || 'Keychain did not sign the upload.'))
        }
        return result.msg || result.result
      }
      if (this.loginType === 'smartlock') {
        await this.ensureSmartlockUnlocked()
        try {
          return smartlock.api.signBuffer(user, payload)
        } catch (error) {
          throw new Error(error?.message || 'SmartLock could not sign the upload.', { cause: error })
        }
      }
      throw new Error('Log in with Keychain or SmartLock to upload images.')
    },
    async uploadSelectedImages () {
      if (this.uploadBusy) return
      if (!this.uploadFiles.length) {
        this.uploadError = 'Choose at least one image.'
        return
      }
      if (!this.canUpload) {
        this.uploadError = 'Log in with Keychain or SmartLock to upload images.'
        return
      }
      this.uploadBusy = true
      this.uploadError = ''
      const uploaded = []
      const files = this.uploadTarget === 'cover' ? this.uploadFiles.slice(0, 1) : this.uploadFiles
      try {
        for (const file of files) {
          const validation = validateImageFile(file)
          if (!validation.ok) throw new Error(file.name + ': ' + validation.error)
          this.uploadStatus = 'Signing ' + file.name + '…'
          const bytes = await readImageBytes(file)
          const signature = await this.signImagePayload(buildImageSigningPayload(bytes))
          this.uploadStatus = 'Uploading ' + file.name + '…'
          const url = await uploadImage({ username: this.loggedInUser, signature, file })
          const alt = files.length === 1 ? (this.uploadAlt.trim() || altFromFileName(file.name)) : altFromFileName(file.name)
          uploaded.push({ url, alt, name: file.name, size: file.size, type: file.type })
          this.recentUploads = appendUploadHistory(LocalStorage, this.loggedInUser, {
            url,
            alt,
            name: file.name,
            size: file.size,
            type: file.type
          })
        }
        if (this.uploadTarget === 'cover' && uploaded[0]) {
          this.draft.coverImage = uploaded[0].url
          this.$q.notify({ type: 'positive', message: 'Cover image uploaded' })
        } else {
          this.insertUploadedImages(uploaded)
          this.$q.notify({
            type: 'positive',
            message: uploaded.length > 1 ? uploaded.length + ' images uploaded' : 'Image uploaded',
            caption: 'Inserted into the post.'
          })
        }
        this.uploadDialogOpen = false
        this.uploadFiles = []
        this.uploadAlt = ''
        this.uploadStatus = ''
      } catch (error) {
        this.uploadError = imageHostErrorMessage(error)
        this.uploadStatus = ''
      } finally {
        this.uploadBusy = false
      }
    },
    insertUploadedImages (images) {
      if (!images.length || !this.draft) return
      const block = images
        .map(image => {
          const markdown = markdownImage({ alt: image.alt, url: image.url })
          return this.centerImages ? '<center>' + markdown + '</center>' : markdown
        })
        .join('\n\n')
      const start = Math.min(this.savedSelection.start, this.draft.body.length)
      const end = Math.min(Math.max(this.savedSelection.end, start), this.draft.body.length)
      const before = this.draft.body.slice(0, start)
      const after = this.draft.body.slice(end)
      const lead = before && !before.endsWith('\n\n') ? (before.endsWith('\n') ? '\n' : '\n\n') : ''
      const trail = after && !after.startsWith('\n\n') ? (after.startsWith('\n') ? '\n' : '\n\n') : ''
      const inserted = lead + block + trail
      if (this.mode !== 'write') this.mode = 'write'
      this.draft.body = before + inserted + after
      this.$nextTick(() => {
        const element = this.$refs.body
        if (!element) return
        const cursor = start + inserted.length
        element.focus()
        element.setSelectionRange(cursor, cursor)
      })
    },
    onEditorPaste (event) {
      const files = Array.from(event.clipboardData?.files || []).filter(file => file.type.startsWith('image/'))
      if (files.length) {
        event.preventDefault()
        this.captureSelection()
        this.openImageUpload('body', files)
        return
      }
      const text = String(event.clipboardData?.getData('text/plain') || '').trim()
      if (!text) return
      const element = this.$refs.body
      if (element && element.selectionStart !== element.selectionEnd) return
      const detected = detectEmbed(text)
      if (!detected) return
      event.preventDefault()
      this.applyAction({ type: 'embed', markdown: detected.markdown })
    },
    onEditorDragOver () {
      this.dragActive = true
    },
    onEditorDragLeave () {
      this.dragActive = false
    },
    onEditorDrop (event) {
      this.dragActive = false
      const files = Array.from(event.dataTransfer?.files || []).filter(file => file.type.startsWith('image/'))
      if (files.length) {
        event.preventDefault()
        this.captureSelection()
        this.openImageUpload('body', files)
        return
      }
      const text = String(event.dataTransfer?.getData('text/plain') || '').trim()
      const detected = text ? detectEmbed(text) : null
      if (detected) {
        event.preventDefault()
        this.applyAction({ type: 'embed', markdown: detected.markdown })
      }
    },
    useRecentUpload (entry) {
      if (!entry) return
      if (this.uploadTarget === 'cover') {
        this.draft.coverImage = entry.url
        this.uploadDialogOpen = false
      } else {
        this.captureSelection()
        this.insertUploadedImages([{ url: entry.url, alt: entry.alt || altFromFileName(entry.name) }])
        this.uploadDialogOpen = false
      }
    },
    openCoverPicker () {
      this.coverDialogOpen = true
    },
    setCover (candidate) {
      if (!this.draft || !candidate) return
      this.draft.coverImage = normalizeCoverImage(candidate.url) || ''
      this.coverDialogOpen = false
    },
    resetCover () {
      if (!this.draft) return
      this.draft.coverImage = ''
      this.coverDialogOpen = false
    },
    clearCover () {
      if (!this.draft) return
      this.draft.coverImage = ''
    },
    fillDescription () {
      if (!this.draft) return
      this.draft.description = deriveDescription(this.draft.body, DESCRIPTION_MAX)
    },
    clearCountdown () {
      if (!this.draft) return
      this.draft.countdown = ''
    },
    clearUploads () {
      this.recentUploads = clearUploadHistory(LocalStorage, this.loggedInUser)
    },
    blankDraft () {
      return createDraft({
        owner: this.loggedInUser || null,
        description: '',
        coverImage: '',
        aiTools: defaultAiTools(),
        countdown: '',
        portfolio: false,
        collection: false,
        authorDisplay: '',
        beneficiaries: normalizeBeneficiaries((this.$hiveStore.user.settings.beneficiary || []).map(item => ({
          account: item.account,
          weight: item.weight
        }))),
        rewards: defaultRewards()
      })
    },
    hydrate () {
      this.drafts = readDrafts(LocalStorage)
      if (this.$route.query.edit) {
        this.loadPostForEdit()
        return
      }
      const requested = this.$route.params.draftId
      const found = requested ? this.drafts.find(item => item.id === requested) : null
      const initial = found || this.drafts[0] || this.blankDraft()
      this.setActiveDraft(initial)
    },
    /**
     * Load an existing post into an edit draft. The draft carries the real
     * permlink and parent so publishing produces an edit, not a new post.
     */
    async loadPostForEdit () {
      const parsed = parseHivePostUrl(this.$route.query.edit)
      if (!parsed) {
        this.$q.notify({ type: 'negative', message: 'That edit link is not a Hive post.' })
        this.setActiveDraft(this.drafts[0] || this.blankDraft())
        return
      }
      if (this.loggedInUser !== parsed.author) {
        this.$q.notify({ type: 'negative', message: 'You can only edit your own posts.', caption: 'Sign in as @' + parsed.author + ' first.' })
        this.setActiveDraft(this.drafts[0] || this.blankDraft())
        return
      }

      this.editingLoading = true
      try {
        const post = await this.$hive.api.getContentAsync(parsed.author, parsed.permlink)
        if (!post || !post.author) throw new Error('That post was not found on the Hive API.')

        const metadata = parseJsonMetadata(post.json_metadata) || {}
        const tags = Array.isArray(metadata.tags) ? metadata.tags : []
        const metadataImage = Array.isArray(metadata.image) ? metadata.image[0] : metadata.image
        const draft = createDraft({
          owner: parsed.author,
          title: post.title || '',
          body: post.body || '',
          description: metadata.description || '',
          coverImage: typeof metadataImage === 'string' ? metadataImage : '',
          community: post.parent_permlink || post.category || '',
          tags: tags.filter(tag => tag !== post.parent_permlink && tag !== COLLECTION_TAG),
          crossPost: readCrossPostMetadata(metadata),
          aiTools: metadata.ai_tools || {},
          countdown: metadata.countdown || '',
          portfolio: metadata.portfolio === true,
          collection: metadata.collection === true ||
            tags.map(tag => normalizeTag(tag)).includes(COLLECTION_TAG),
          authorDisplay: metadata.author || '',
          beneficiaries: (post.beneficiaries || []).map(item => ({ account: item.account, weight: Number(item.weight) })),
          rewards: {
            maxAcceptedPayout: post.max_accepted_payout || defaultRewards().maxAcceptedPayout,
            percentHbd: Number.isFinite(Number(post.percent_hbd)) ? Number(post.percent_hbd) : 10000,
            allowVotes: post.allow_votes !== false,
            allowCurationRewards: post.allow_curation_rewards !== false
          },
          editing: {
            author: post.author,
            permlink: post.permlink,
            parentAuthor: post.parent_author || '',
            parentPermlink: post.parent_permlink || '',
            previousMetadata: metadata
          }
        })
        this.setActiveDraft(draft)
        this.mode = 'write'
      } catch (error) {
        console.error('Failed to load post for editing', error)
        this.$q.notify({ type: 'negative', message: 'Could not load that post', caption: error.message })
        this.setActiveDraft(this.drafts[0] || this.blankDraft())
      } finally {
        this.editingLoading = false
      }
    },
    setActiveDraft (draft) {
      this.draft = normalizeDraft(draft)
      this.crossPostInput = this.draft.crossPost ? this.postUrl(this.draft.crossPost) : ''
      this.crossPostError = ''
      this.crossPostTitle = ''
      this.crossPostLoaded = Boolean(this.draft.crossPost)
      this.crossPostOriginal = null
      this.uploadDialogOpen = false
      this.coverDialogOpen = false
      this.uploadFiles = []
      this.uploadError = ''
      this.uploadStatus = ''
      this.mode = 'write'
      this.previewBody = this.draft.body
      if (this.previewTimer) {
        clearTimeout(this.previewTimer)
        this.previewTimer = null
      }
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
        description: draft.description,
        coverImage: draft.coverImage,
        tags: draft.tags,
        community: draft.community,
        crossPost: draft.crossPost,
        beneficiaries: draft.beneficiaries,
        rewards: draft.rewards,
        aiTools: draft.aiTools,
        countdown: draft.countdown,
        portfolio: draft.portfolio,
        collection: draft.collection,
        authorDisplay: draft.authorDisplay
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
      this.crossPostLoaded = false
      this.crossPostOriginal = null
    },
    /** Copy the source title/body/category on explicit request, never silently. */
    applyCrossPostContent () {
      const post = this.crossPostOriginal || (this.draft && this.draft.crossPost)
      if (!post) {
        this.$q.notify({ message: 'Record a cross-post source first.' })
        return
      }
      const hasText = this.draft.title.trim() || this.draft.body.trim()
      const apply = () => {
        if (post.title) this.draft.title = post.title
        if (post.body) this.draft.body = post.body
        if (post.category) this.draft.community = normalizeTag(post.category)
        this.mode = 'write'
      }
      if (!hasText) {
        apply()
        this.$q.notify({ message: 'Original title and body copied', caption: 'Edit it before publishing.' })
        return
      }
      this.$q.dialog({
        dark: true,
        title: 'Replace this draft?',
        message: 'Copying the original text replaces the current title and body.',
        cancel: true,
        persistent: true
      }).onOk(() => {
        apply()
        this.$q.notify({ message: 'Original title and body copied' })
      })
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
        this.crossPostTitle = '“' + (post.title || post.permlink) + '” by @' + post.author
        this.crossPostLoaded = true
        this.crossPostOriginal = post
        if (this.crossPostInput !== this.postUrl(this.draft.crossPost)) {
          this.crossPostInput = this.postUrl(this.draft.crossPost)
        }
        this.$q.notify({
          type: 'positive',
          message: 'Cross-post source recorded',
          caption: this.draft.body.trim()
            ? 'Use “Copy original text” if you want the original body.'
            : 'Use “Copy original text” to start from the original.'
        })
      } catch (error) {
        this.crossPostError = 'Could not load that post. Check the URL and try again.'
        console.error('Failed to load cross-post source', error)
      } finally {
        this.loadingSource = false
      }
    },
    replaceBody (next) {
      this.draft.body = next.text
      this.$nextTick(() => {
        const element = this.$refs.body
        if (!element) return
        element.focus()
        element.setSelectionRange(next.start, next.end)
      })
    },
    applyAction (action) {
      if (!this.draft) return
      if (this.mode === 'preview') this.mode = 'write'
      const textarea = this.$refs.body
      const start = textarea ? textarea.selectionStart : this.draft.body.length
      const end = textarea ? textarea.selectionEnd : this.draft.body.length
      this.replaceBody(applyMarkdownAction(this.draft.body, start, end, action))
    },
    onEditorKeydown (event) {
      const action = shortcutMarkdownAction(event)
      if (action) {
        event.preventDefault()
        this.applyAction(action)
        return
      }
      if (event.key === 'Tab' && !event.metaKey && !event.ctrlKey && !event.altKey) {
        event.preventDefault()
        this.applyAction({ type: event.shiftKey ? 'outdent' : 'indent' })
        return
      }
      if (
        event.key === 'Enter' &&
        !event.metaKey && !event.ctrlKey && !event.altKey && !event.shiftKey
      ) {
        const textarea = this.$refs.body
        if (textarea) {
          const next = continueMarkdownList(this.draft.body, textarea.selectionStart, textarea.selectionEnd)
          if (next) {
            event.preventDefault()
            this.replaceBody(next)
            return
          }
        }
      }
      if (event.key === 'Escape' && this.fullscreenEditor) {
        event.preventDefault()
        this.fullscreenEditor = false
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
      this.reviewOpen = true
    },
    confirmPublish () {
      if (!this.draft) return
      this.reviewOpen = false
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
        const editing = this.draft.editing
        const permlink = editing ? editing.permlink : createPostPermlink(this.draft.title)
        const item = postQueueItem({
          username: this.loggedInUser,
          draft: this.draft,
          permlink,
          // An edit keeps the original parent and does not resend comment options.
          parentPermlink: editing ? editing.parentPermlink : null,
          parentAuthor: editing ? editing.parentAuthor : '',
          commentOptions: !editing,
          previousMetadata: editing ? editing.previousMetadata : null
        })
        this.$hiveStore.addToQueue(item)

        if (editing) {
          // Keep the local draft around so a failed edit can be retried, but
          // stop autosaving it as a fresh draft.
          this.lastSavedSnapshot = this.snapshotDraft(this.draft)
        } else {
          this.drafts = removeDraftById(this.drafts, this.draft.id)
          writeDrafts(LocalStorage, this.drafts)
          this.lastSavedSnapshot = ''
          this.setActiveDraft(this.blankDraft())
          this.$router.replace({ name: 'compose', params: {} }).catch(() => {})
        }

        this.$q.notify({
          type: isOnline() ? 'positive' : 'warning',
          message: isOnline()
            ? (editing ? 'Edit queued for signing' : 'Post queued for signing')
            : 'Queued, but you are offline',
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
