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

    <div v-if="dueReminders.length" class="compose-reminder" role="status">
      <q-icon name="alarm" size="18px" aria-hidden="true" />
      <div class="compose-reminder__body">
        <strong>{{ dueReminders.length === 1 ? 'Draft reminder' : dueReminders.length + ' draft reminders' }}</strong>
        <span>
          {{ dueReminders.length === 1 ? draftDisplayTitle(dueReminders[0]) : 'Several drafts are due for a reminder.' }}
        </span>
      </div>
      <div class="compose-reminder__actions">
        <q-btn flat dense no-caps color="primary" label="Open" @click="openReminder(dueReminders[0])" />
        <q-btn flat dense no-caps label="Dismiss" @click="dismissReminders" />
      </div>
    </div>

    <div class="compose-grid" v-if="draft">
      <section class="compose-main home-card home-panel" aria-labelledby="compose-editor-title">
        <div class="home-panel__head">
          <div class="compose-main__heading">
            <div class="home-eyebrow">Draft</div>
            <h2 id="compose-editor-title" class="home-panel__title">{{ activeDraftTitle }}</h2>
          </div>
          <div class="home-panel__actions">
            <q-btn flat dense round icon="history" aria-label="Draft history" title="Draft history" @click="openDraftHistory" />
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
                  <q-btn
                    flat
                    dense
                    round
                    size="sm"
                    icon="toc"
                    aria-label="Heading outline"
                    :title="headings.length ? 'Jump to a heading' : 'No headings yet'"
                    :disable="!headings.length"
                    @click="openOutline"
                  />
                  <q-btn
                    flat
                    dense
                    round
                    size="sm"
                    icon="mood"
                    aria-label="Insert emoji"
                    title="Insert emoji"
                    @click="openEmojiPicker"
                  />
                  <q-btn
                    flat
                    dense
                    round
                    size="sm"
                    icon="content_paste"
                    aria-label="Insert snippet"
                    title="Insert snippet"
                    @click="openSnippets"
                  />
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
                  <q-btn
                    v-if="item.status === 'warn' && item.dismissKey"
                    flat
                    dense
                    no-caps
                    class="compose-checklist__dismiss"
                    label="Don't warn again"
                    :aria-label="'Hide the ' + item.label + ' warning'"
                    @click="dismissChecklistItem(item)"
                  />
                </div>
              </li>
            </ul>
            <div v-if="dismissedWarningCount" class="compose-checklist__restore">
              <span>{{ dismissedWarningCount }} hidden warning{{ dismissedWarningCount === 1 ? '' : 's' }}</span>
              <q-btn flat dense no-caps label="Restore warnings" @click="restoreChecklistWarnings" />
            </div>
            <div class="compose-reminder-action">
              <q-btn
                outline
                no-caps
                color="primary"
                icon="alarm"
                :label="draft.scheduledAt ? 'Reminder set' : 'Schedule reminder'"
                class="compose-reminder-action__btn"
                @click="openReminderDialog"
              />
              <span v-if="draft.scheduledAt" class="compose-hint">{{ scheduledLabel }} · local only</span>
            </div>
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
              ref="communitySelect"
              :model-value="draft.community"
              :options="communityOptionsShown"
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
              hint="Search by title or name. Your subscribed communities appear first and become the parent category."
              @filter="onCommunityFilter"
              @popup-show="onCommunityPopupShow"
              @update:model-value="setCommunity"
              @new-value="addCommunity"
            >
              <template #option="scope">
                <q-item v-bind="scope.itemProps">
                  <q-item-section avatar>
                    <q-avatar size="30px">
                      <img :src="scope.opt.avatar" alt="" loading="lazy" />
                    </q-avatar>
                  </q-item-section>
                  <q-item-section>
                    <q-item-label>{{ scope.opt.title }}</q-item-label>
                    <q-item-label caption>
                      <template v-if="scope.opt.isBlog">Personal blog</template>
                      <template v-else>
                        #{{ scope.opt.value }}
                        <template v-if="scope.opt.subscribers">
                          · {{ formatCommunitySubscribers(scope.opt.subscribers) }} subscribers
                        </template>
                      </template>
                    </q-item-label>
                  </q-item-section>
                  <q-item-section v-if="scope.opt.subscribed" side>
                    <q-badge color="primary" label="Subscribed" />
                  </q-item-section>
                  <q-item-section v-else-if="scope.opt.recent" side>
                    <q-badge color="grey-8" text-color="white" label="Recent" />
                  </q-item-section>
                </q-item>
              </template>
              <template #selected>
                <div class="compose-community-selected">
                  <img
                    v-if="selectedCommunity && selectedCommunity.avatar"
                    :src="selectedCommunity.avatar"
                    alt=""
                    class="compose-community-selected__avatar"
                  />
                  <span>{{ selectedCommunity ? selectedCommunity.title : 'My blog' }}</span>
                  <span v-if="draft.community" class="compose-community-selected__name">#{{ draft.community }}</span>
                </div>
              </template>
            </q-select>

            <div v-if="selectedCommunity" class="compose-community-card">
              <img
                v-if="selectedCommunity.avatar"
                :src="selectedCommunity.avatar"
                alt=""
                class="compose-community-card__avatar"
                loading="lazy"
              />
              <div class="compose-community-card__body">
                <div class="compose-community-card__head">
                  <span class="compose-community-card__title">{{ selectedCommunity.title }}</span>
                  <span v-if="!selectedCommunity.isBlog" class="compose-community-card__name">#{{ selectedCommunity.value }}</span>
                </div>
                <div class="compose-community-card__meta">
                  <span v-if="selectedCommunity.isBlog">Personal blog · no community</span>
                  <span v-else-if="selectedCommunity.subscribers">
                    {{ formatCommunitySubscribers(selectedCommunity.subscribers) }} subscribers
                  </span>
                  <span v-else>Community</span>
                  <span v-if="selectedCommunity.subscribed" class="compose-community-card__tag">Subscribed</span>
                  <span v-else-if="selectedCommunity.recent" class="compose-community-card__tag">Recent</span>
                </div>
                <p v-if="selectedCommunity.about" class="compose-community-card__about">{{ selectedCommunity.about }}</p>
              </div>
              <router-link
                v-if="selectedCommunity.rulesLink"
                :to="selectedCommunity.rulesLink"
                class="compose-community-card__rules"
              >
                <q-icon name="policy" size="15px" aria-hidden="true" />
                Rules
              </router-link>
            </div>
            <div v-if="communityWarning" class="compose-warning" role="status">
              <q-icon name="info" size="16px" aria-hidden="true" />
              <span>
                {{ communityWarning }}
                <router-link v-if="selectedCommunity && selectedCommunity.rulesLink" :to="selectedCommunity.rulesLink">
                  Read the rules
                </router-link>
              </span>
            </div>

            <div v-if="postingToCommunity && !isEditing" class="compose-toggle-row">
              <q-toggle
                v-model="draft.alsoReblog"
                label="Also reblog to my blog"
                aria-label="Also reblog to my blog"
                dense
              />
              <span class="compose-hint">
                After signing, the post stays in #{{ draft.community }} and is reblogged to your blog and followers' feeds.
              </span>
            </div>

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
            <div v-if="draft.tags.length > 1" class="compose-topic-order">
              <q-btn flat dense no-caps icon="swap_vert" label="Order topics" @click="topicsOrderOpen = true" />
              <span class="compose-hint">The first 5 are the primary discovery tags.</span>
            </div>
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
                <q-select
                  v-model.trim="newBeneAccount"
                  :options="beneficiaryOptions"
                  :loading="beneficiarySearching"
                  use-input
                  fill-input
                  hide-selected
                  outlined
                  dense
                  label="Account"
                  aria-label="New beneficiary account"
                  maxlength="16"
                  new-value-mode="add-unique"
                  @filter="onBeneficiaryFilter"
                  @new-value="onNewBeneficiaryValue"
                  @keyup.enter="addBeneficiary"
                />
                <q-input v-model.number="newBenePercent" type="number" min="0" max="100" suffix="%" outlined dense label="Share" aria-label="New beneficiary share" @keyup.enter="addBeneficiary" />
                <q-btn unelevated no-caps color="primary" icon="add" label="Add" :disable="!canAddBeneficiary" @click="addBeneficiary" />
              </div>
              <div class="compose-bene-actions">
                <q-btn flat dense no-caps icon="group" label="Use defaults" @click="applyDefaultBeneficiaries" />
                <q-btn v-if="draft.beneficiaries.length" flat dense no-caps color="red-4" icon="person_remove" label="Remove all" @click="removeAllBeneficiaries" />
                <q-btn v-if="draft.beneficiaries.length" flat dense no-caps icon="bookmark_add" label="Save as defaults" @click="saveBeneficiariesAsDefaults" />
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
              <h2 id="compose-drafts-title" class="home-panel__title">
                {{ draftView === 'archived' ? 'Archived' : 'Drafts' }} ({{ filteredDrafts.length }})
              </h2>
            </div>
            <div class="home-panel__actions">
              <q-btn flat dense round icon="dashboard_customize" aria-label="Post templates" title="Templates" @click="openTemplates" />
              <q-btn flat dense round icon="add" aria-label="Create a new draft" title="New draft" @click="startNewDraft" />
            </div>
          </div>
          <div class="home-panel__body compose-drafts">
            <div class="compose-draft-view">
              <q-btn-toggle
                v-model="draftView"
                no-caps
                unelevated
                toggle-color="primary"
                :options="draftViewOptions"
                aria-label="Draft view"
              />
              <span class="compose-hint">{{ archivedDraftCount }} archived</span>
            </div>
            <div class="compose-draft-filters">
              <q-input
                v-model="draftSearch"
                dense
                outlined
                clearable
                label="Search drafts"
                aria-label="Search drafts"
              >
                <template #prepend>
                  <q-icon name="search" aria-hidden="true" />
                </template>
              </q-input>
              <q-select
                v-model="draftSort"
                :options="draftSortOptions"
                emit-value
                map-options
                dense
                outlined
                label="Sort"
                aria-label="Sort drafts"
              />
            </div>
            <div v-if="filteredDrafts.length" class="compose-draft-list">
              <div
                v-for="item in filteredDrafts"
                :key="item.id"
                class="compose-draft"
                :class="{ 'compose-draft--active': item.id === draft.id }"
              >
                <button type="button" class="compose-draft__open" @click="selectDraft(item.id)">
                  <span class="compose-draft__title">{{ draftDisplayTitle(item) }}</span>
                  <span class="compose-draft__meta">
                    <q-icon v-if="isPinnedDraft(item.id)" name="push_pin" size="11px" aria-hidden="true" />
                    <q-icon v-if="item.scheduledAt" name="alarm" size="11px" aria-hidden="true" />
                    {{ draftTime(item.updatedAt) }} · {{ wordCount(item.body) }} words
                  </span>
                </button>
                <q-btn
                  flat
                  dense
                  round
                  size="sm"
                  icon="push_pin"
                  :color="isPinnedDraft(item.id) ? 'primary' : undefined"
                  :aria-label="(isPinnedDraft(item.id) ? 'Unpin' : 'Pin') + ' draft ' + draftDisplayTitle(item)"
                  :title="isPinnedDraft(item.id) ? 'Unpin draft' : 'Pin draft'"
                  @click="toggleDraftPin(item)"
                />
                <q-btn
                  flat
                  dense
                  round
                  size="sm"
                  :icon="draftView === 'archived' ? 'unarchive' : 'archive'"
                  :aria-label="(draftView === 'archived' ? 'Restore' : 'Archive') + ' draft ' + draftDisplayTitle(item)"
                  :title="draftView === 'archived' ? 'Restore draft' : 'Archive draft'"
                  @click="draftView === 'archived' ? unarchiveDraft(item) : archiveDraft(item)"
                />
                <q-btn
                  flat
                  dense
                  round
                  size="sm"
                  icon="content_copy"
                  :aria-label="'Duplicate draft ' + draftDisplayTitle(item)"
                  title="Duplicate draft"
                  @click="duplicateDraft(item)"
                />
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
            <div v-else-if="draftSearch" class="compose-empty-line">
              <q-icon name="search_off" size="17px" aria-hidden="true" />
              <span>No drafts match “{{ draftSearch }}”.</span>
            </div>
            <div v-else class="compose-empty-line">
              <q-icon name="description" size="17px" aria-hidden="true" />
              <span>No saved drafts yet. Autosave starts when you write.</span>
            </div>

            <div class="compose-drafts__actions">
              <q-btn flat dense no-caps icon="download" label="Export draft" :disable="!draftHasContent(draft)" @click="exportCurrent" />
              <q-btn flat dense no-caps icon="archive" label="Export all" :disable="!visibleDrafts.length" @click="exportAll" />
              <q-btn flat dense no-caps icon="upload_file" label="Import" @click="triggerImport" />
              <q-btn flat dense no-caps color="red-4" icon="delete_sweep" label="Clear all" :disable="!visibleDrafts.length" @click="clearAllDrafts" />
              <input ref="importInput" type="file" accept="application/json,.json" class="compose-file-input" aria-label="Import drafts JSON file" @change="onImportFile" />
            </div>
            <p class="compose-hint">
              Local storage: {{ storageUsageLabel }} · {{ visibleDrafts.length }} drafts.
              Export a JSON backup before clearing site data.
            </p>
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
          <q-btn
            flat
            dense
            round
            icon="close"
            aria-label="Close upload dialog"
            title="Close"
            :disable="uploadBusy"
            @click="uploadDialogOpen = false"
          />
        </q-card-section>
        <q-separator />
        <q-card-section class="compose-media-dialog__body">
          <div v-if="!canUpload" class="compose-warning" role="alert">
            <q-icon name="lock" size="16px" aria-hidden="true" />
            <span>Log in with Keychain, SmartLock or HiveAuth to upload images.</span>
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
          <div v-if="uploadItems.length" class="compose-upload-queue">
            <div
              v-for="item in uploadItems"
              :key="item.id"
              class="compose-upload-item"
              :class="'is-' + item.status"
            >
              <div class="compose-upload-item__row">
                <q-icon :name="uploadStatusIcon(item)" size="18px" aria-hidden="true" />
                <div class="compose-upload-item__body">
                  <div class="compose-upload-item__name" :title="item.name">{{ item.name }}</div>
                  <div class="compose-upload-item__meta">
                    <span v-if="item.size">{{ uploadSizeLabel(item.size) }}</span>
                    <span>{{ uploadStatusLabel(item) }}</span>
                  </div>
                  <q-linear-progress
                    v-if="item.status === 'signing' || item.status === 'uploading'"
                    :value="item.progress / 100"
                    :indeterminate="item.status === 'signing'"
                    size="5px"
                    color="primary"
                    class="compose-upload-item__progress"
                    :aria-label="'Upload progress for ' + item.name"
                  />
                </div>
                <q-btn
                  v-if="canRetryUpload(item)"
                  flat
                  dense
                  no-caps
                  icon="refresh"
                  label="Retry"
                  @click="retryUploadItem(item)"
                />
                <q-btn
                  v-if="item.status === 'queued'"
                  flat
                  dense
                  round
                  icon="close"
                  :aria-label="'Remove ' + item.name + ' from the upload queue'"
                  title="Remove"
                  @click="removeUploadItem(item)"
                />
              </div>
              <div v-if="item.error" class="compose-upload-error" role="alert">
                <q-icon name="error_outline" size="16px" aria-hidden="true" />
                <span>{{ item.error }}</span>
              </div>
            </div>
          </div>
          <div v-if="uploadSummaryLabel" class="compose-upload-status" role="status">{{ uploadSummaryLabel }}</div>
          <div v-if="uploadError" class="compose-upload-error" role="alert">
            <q-icon name="error_outline" size="16px" aria-hidden="true" />
            <span>{{ uploadError }}</span>
          </div>

          <div class="compose-upload-actions">
            <q-btn
              flat
              no-caps
              :label="uploadBusy ? 'Cancel upload' : 'Cancel'"
              @click="uploadBusy ? cancelUploadRun() : (uploadDialogOpen = false)"
            />
            <q-btn
              v-if="uploadSummary.failed || uploadSummary.cancelled"
              flat
              no-caps
              icon="refresh"
              label="Retry failed"
              :disable="uploadBusy"
              @click="retryFailedUploads"
            />
            <q-btn
              unelevated
              no-caps
              color="primary"
              icon="cloud_upload"
              label="Upload"
              :loading="uploadBusy"
              :disable="!canUpload || !uploadFiles.length || uploadBusy"
              @click="uploadSelectedImages"
            />
          </div>

          <div v-if="recentUploads.length" class="compose-upload-recent">
            <div class="compose-upload-recent__head">
              <span>Recent uploads</span>
              <q-btn flat dense no-caps icon="delete_sweep" label="Clear" @click="clearUploads" />
            </div>
            <ul class="compose-upload-recent__list">
              <li v-for="entry in recentUploads" :key="entry.url" class="compose-upload-recent__item">
                <button
                  type="button"
                  class="compose-media-tile compose-upload-recent__tile"
                  @click="useRecentUpload(entry)"
                >
                  <img :src="entry.url" :alt="entry.alt || 'Uploaded image'" loading="lazy" />
                  <span class="compose-upload-recent__name">{{ entry.name || entry.alt || 'Uploaded image' }}</span>
                  <span class="compose-upload-recent__meta">{{ uploadRecentMeta(entry) }}</span>
                  <span class="compose-upload-recent__action">{{ uploadTarget === 'cover' ? 'Use as cover' : 'Insert' }}</span>
                </button>
                <q-btn
                  flat
                  dense
                  round
                  icon="content_copy"
                  :aria-label="'Copy URL for ' + (entry.name || 'uploaded image')"
                  title="Copy image URL"
                  @click="copyUploadUrl(entry)"
                />
              </li>
            </ul>
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
            <q-btn flat no-caps icon="content_paste" label="Snippets" @click="settingsOpen = false; openSnippets()" />
            <q-btn flat no-caps icon="dashboard_customize" label="Templates" @click="settingsOpen = false; openTemplates()" />
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

    <q-dialog v-model="topicsOrderOpen">
      <q-card class="compose-topics-order">
        <q-card-section class="compose-media-dialog__head">
          <div>
            <div class="home-eyebrow">Discovery</div>
            <h2 class="home-panel__title">Topic order</h2>
          </div>
          <q-btn flat dense round icon="close" aria-label="Close topic order" title="Close" @click="topicsOrderOpen = false" />
        </q-card-section>
        <q-separator />
        <q-card-section class="compose-topics-order__body">
          <p class="compose-hint compose-hint--top">
            The first five topics are the primary discovery tags. Drag a row or use the arrows to reorder.
          </p>
          <div class="compose-topics-order__list">
            <div
              v-for="(tag, index) in draft.tags"
              :key="tag"
              class="compose-topics-order__row"
              :class="{
                'is-dragging': dragTagIndex === index,
                'is-drop-target': dragTagOver === index && dragTagIndex !== null && dragTagIndex !== index
              }"
              draggable="true"
              @dragstart="startTagDrag(index, $event)"
              @dragover.prevent="overTagDrag(index)"
              @drop.prevent="dropTag(index)"
              @dragend="endTagDrag"
            >
              <q-icon name="drag_indicator" size="16px" class="compose-topics-order__grip" aria-hidden="true" />
              <span class="compose-topics-order__index">{{ index + 1 }}</span>
              <span class="compose-topics-order__tag">#{{ tag }}</span>
              <span v-if="index < 5" class="compose-pill compose-pill--ok">Primary</span>
              <q-space />
              <q-btn flat dense round size="sm" icon="arrow_upward" :disable="index === 0" :aria-label="'Move ' + tag + ' up'" title="Move up" @click="moveTag(index, -1)" />
              <q-btn flat dense round size="sm" icon="arrow_downward" :disable="index === draft.tags.length - 1" :aria-label="'Move ' + tag + ' down'" title="Move down" @click="moveTag(index, 1)" />
            </div>
          </div>
        </q-card-section>
      </q-card>
    </q-dialog>

    <q-dialog v-model="outlineOpen">
      <q-card class="compose-outline">
        <q-card-section class="compose-media-dialog__head">
          <div>
            <div class="home-eyebrow">Editor</div>
            <h2 class="home-panel__title">Heading outline</h2>
          </div>
          <q-btn flat dense round icon="close" aria-label="Close heading outline" title="Close" @click="outlineOpen = false" />
        </q-card-section>
        <q-separator />
        <q-card-section class="compose-outline__body">
          <p class="compose-hint compose-hint--top">Jump to a heading in the post body.</p>
          <div class="compose-outline__list">
            <button
              v-for="heading in headings"
              :key="heading.index"
              type="button"
              class="compose-outline__item"
              :style="{ paddingLeft: (0.55 + (heading.level - 1) * 0.7) + 'rem' }"
              @click="jumpToHeading(heading)"
            >
              <span class="compose-outline__level">H{{ heading.level }}</span>
              <span class="compose-outline__text">{{ heading.text }}</span>
            </button>
          </div>
        </q-card-section>
      </q-card>
    </q-dialog>

    <q-dialog v-model="emojiOpen">
      <q-card class="compose-emoji">
        <q-card-section class="compose-media-dialog__head">
          <div>
            <div class="home-eyebrow">Editor</div>
            <h2 class="home-panel__title">Insert emoji</h2>
          </div>
          <q-btn flat dense round icon="close" aria-label="Close emoji picker" title="Close" @click="emojiOpen = false" />
        </q-card-section>
        <q-separator />
        <q-card-section class="compose-emoji__body">
          <div v-if="emojiLoading" class="compose-emoji__loading">
            <q-spinner size="22px" aria-label="Loading emoji" />
          </div>
          <template v-else>
            <div v-for="group in emojiGroups" :key="group.id" class="compose-emoji__group">
              <div class="compose-emoji__label">{{ group.label }}</div>
              <div class="compose-emoji__grid">
                <button
                  v-for="item in group.emoji"
                  :key="item.char"
                  type="button"
                  class="compose-emoji__btn"
                  :aria-label="'Insert ' + item.label"
                  :title="item.label"
                  @click="insertEmoji(item.char)"
                >{{ item.char }}</button>
              </div>
            </div>
          </template>
        </q-card-section>
      </q-card>
    </q-dialog>

    <q-dialog v-model="reminderDialogOpen">
      <q-card class="compose-reminder-dialog">
        <q-card-section class="compose-media-dialog__head">
          <div>
            <div class="home-eyebrow">Local reminder</div>
            <h2 class="home-panel__title">Schedule reminder</h2>
          </div>
          <q-btn flat dense round icon="close" aria-label="Close reminder dialog" title="Close" @click="reminderDialogOpen = false" />
        </q-card-section>
        <q-separator />
        <q-card-section class="compose-reminder-dialog__body">
          <q-input
            v-model="reminderValue"
            type="datetime-local"
            outlined
            dense
            label="Remind me at"
            aria-label="Reminder date and time"
            hint="A local reminder only. This does not schedule or publish the post."
          />
          <p class="compose-hint">
            When the time passes, the composer shows a reminder banner with an Open action.
          </p>
          <div class="compose-reminder-dialog__actions">
            <q-btn flat no-caps label="Cancel" @click="reminderDialogOpen = false" />
            <q-btn v-if="draft.scheduledAt" flat no-caps color="red-4" label="Clear reminder" @click="clearReminderDialog" />
            <q-btn unelevated no-caps color="primary" icon="alarm_add" label="Save reminder" @click="saveReminder" />
          </div>
        </q-card-section>
      </q-card>
    </q-dialog>

    <q-dialog v-model="historyOpen">
      <q-card class="compose-history">
        <q-card-section class="compose-media-dialog__head">
          <div>
            <div class="home-eyebrow">Recovery</div>
            <h2 class="home-panel__title">Draft history</h2>
          </div>
          <q-btn flat dense round icon="close" aria-label="Close draft history" title="Close" @click="historyOpen = false" />
        </q-card-section>
        <q-separator />
        <q-card-section class="compose-history__body">
          <p class="compose-hint compose-hint--top">
            Snapshots are kept when the draft changes and on explicit saves. The last two versions are retained per draft.
          </p>
          <div class="compose-history__actions">
            <q-btn flat no-caps icon="save" label="Save version now" @click="saveVersionNow" />
            <q-btn v-if="draftHistory.length" flat no-caps color="red-4" icon="delete_sweep" label="Clear history" @click="clearCurrentDraftHistory" />
          </div>
          <div v-if="draftHistory.length" class="compose-history__list">
            <div v-for="snapshot in draftHistory" :key="snapshot.id" class="compose-history__item">
              <div class="compose-snippet__body">
                <div class="compose-snippet__name">{{ draftDisplayTitle(snapshot) }}</div>
                <div class="compose-snippet__preview">{{ snapshot.body }}</div>
                <div class="compose-history__time">{{ formatHistoryTime(snapshot.capturedAt) }}</div>
              </div>
              <q-btn flat dense no-caps color="primary" label="Restore" @click="restoreHistory(snapshot)" />
            </div>
          </div>
          <div v-else class="compose-empty-line">
            <q-icon name="history" size="17px" aria-hidden="true" />
            <span>No saved versions yet. Save a version now, or keep editing; one will appear after the next change.</span>
          </div>
        </q-card-section>
      </q-card>
    </q-dialog>

    <q-dialog v-model="snippetsOpen">
      <q-card class="compose-snippets">
        <q-card-section class="compose-media-dialog__head">
          <div>
            <div class="home-eyebrow">Reusable text</div>
            <h2 class="home-panel__title">{{ snippetId ? 'Edit snippet' : 'Snippets' }}</h2>
          </div>
          <q-btn flat dense round icon="close" aria-label="Close snippets" title="Close" @click="snippetsOpen = false" />
        </q-card-section>
        <q-separator />
        <q-card-section class="compose-snippets__body">
          <div class="compose-snippets__form">
            <q-input
              v-model="snippetName"
              outlined
              dense
              label="Snippet name"
              aria-label="Snippet name"
              :maxlength="snippetNameMax"
            />
            <q-input
              v-model="snippetBody"
              type="textarea"
              outlined
              dense
              rows="4"
              label="Snippet text"
              aria-label="Snippet text"
            />
            <div v-if="snippetError" class="compose-upload-error" role="alert">
              <q-icon name="error_outline" size="16px" aria-hidden="true" />
              <span>{{ snippetError }}</span>
            </div>
            <div class="compose-snippets__form-actions">
              <q-btn v-if="snippetId" flat no-caps label="Cancel edit" @click="resetSnippetForm" />
              <q-btn unelevated no-caps color="primary" :icon="snippetId ? 'save' : 'add'" :label="snippetId ? 'Save changes' : 'Save snippet'" @click="saveSnippet" />
            </div>
            <div class="compose-snippets__io">
              <q-btn flat dense no-caps icon="download" label="Export snippets" @click="exportSnippets" />
              <q-btn flat dense no-caps icon="upload_file" label="Import snippets" @click="triggerSnippetImport" />
              <input ref="snippetImportInput" type="file" accept="application/json,.json" class="compose-file-input" aria-label="Import snippets JSON file" @change="onSnippetImportFile" />
            </div>
          </div>

          <div class="compose-snippets__list">
            <div v-if="!snippets.length" class="compose-empty-line">
              <q-icon name="content_paste" size="17px" aria-hidden="true" />
              <span>No snippets yet. Save a signature, a series footer or a reusable intro.</span>
            </div>
            <div v-for="snippet in snippets" :key="snippet.id" class="compose-snippet">
              <div class="compose-snippet__body">
                <div class="compose-snippet__name">{{ snippet.name }}</div>
                <div class="compose-snippet__preview">{{ snippet.body }}</div>
              </div>
              <div class="compose-snippet__actions">
                <q-btn flat dense no-caps color="primary" label="Insert" @click="insertSnippet(snippet)" />
                <q-btn flat dense round icon="edit" :aria-label="'Edit snippet ' + snippet.name" title="Edit snippet" @click="editSnippet(snippet)" />
                <q-btn flat dense round icon="delete_outline" color="red-4" :aria-label="'Delete snippet ' + snippet.name" title="Delete snippet" @click="deleteSnippet(snippet)" />
              </div>
            </div>
          </div>
        </q-card-section>
      </q-card>
    </q-dialog>

    <q-dialog v-model="templatesOpen">
      <q-card class="compose-templates">
        <q-card-section class="compose-media-dialog__head">
          <div>
            <div class="home-eyebrow">Reusable posts</div>
            <h2 class="home-panel__title">Post templates</h2>
          </div>
          <q-btn flat dense round icon="close" aria-label="Close templates" title="Close" @click="templatesOpen = false" />
        </q-card-section>
        <q-separator />
        <q-card-section class="compose-templates__body">
          <div class="compose-template-save">
            <div class="compose-setting__label">Save this draft as a template</div>
            <q-input v-model="templateName" outlined dense label="Template name" aria-label="Template name" :maxlength="templateNameMax" />
            <q-input v-model="templateSummary" outlined dense label="Short summary (optional)" aria-label="Template summary" :maxlength="200" />
            <div v-if="templateError" class="compose-upload-error" role="alert">
              <q-icon name="error_outline" size="16px" aria-hidden="true" />
              <span>{{ templateError }}</span>
            </div>
            <q-btn unelevated no-caps color="primary" icon="bookmark_add" label="Save current draft" @click="saveCurrentAsTemplate" />
            <div class="compose-snippets__io">
              <q-btn flat dense no-caps icon="download" label="Export templates" @click="exportTemplates" />
              <q-btn flat dense no-caps icon="upload_file" label="Import templates" @click="triggerTemplateImport" />
              <input ref="templateImportInput" type="file" accept="application/json,.json" class="compose-file-input" aria-label="Import templates JSON file" @change="onTemplateImportFile" />
            </div>
          </div>

          <div v-if="templates.length" class="compose-template-group">
            <div class="compose-template-group__title">Your templates</div>
            <div v-for="template in templates" :key="template.id" class="compose-template">
              <div class="compose-snippet__body">
                <div class="compose-snippet__name">{{ template.name }}</div>
                <div class="compose-snippet__preview">{{ template.summary || template.draft.title || 'Saved template' }}</div>
              </div>
              <div class="compose-snippet__actions">
                <q-btn flat dense no-caps color="primary" label="Apply" @click="applyTemplate(template)" />
                <q-btn flat dense round icon="delete_outline" color="red-4" :aria-label="'Delete template ' + template.name" title="Delete template" @click="deleteTemplate(template)" />
              </div>
            </div>
          </div>

          <div class="compose-template-group">
            <div class="compose-template-group__title">Starter templates</div>
            <div v-for="template in starterTemplates" :key="template.id" class="compose-template">
              <div class="compose-snippet__body">
                <div class="compose-snippet__name">{{ template.name }}</div>
                <div class="compose-snippet__preview">{{ template.summary }}</div>
              </div>
              <div class="compose-snippet__actions">
                <q-btn flat dense no-caps color="primary" label="Apply" @click="applyTemplate(template)" />
              </div>
            </div>
          </div>
        </q-card-section>
      </q-card>
    </q-dialog>

    <q-dialog v-model="publishedOpen">
      <q-card class="compose-published">
        <q-card-section class="compose-media-dialog__head">
          <div>
            <div class="home-eyebrow">Action queue</div>
            <h2 class="home-panel__title">{{ publishedInfo?.editing ? 'Edit queued' : 'Post queued' }}</h2>
          </div>
          <q-btn flat dense round icon="close" aria-label="Close queued post panel" title="Close" @click="publishedOpen = false" />
        </q-card-section>
        <q-separator />
        <q-card-section class="compose-published__body">
          <p class="compose-published__text">
            The action is in the signing queue. Nothing is published until you sign it with your posting key.
          </p>
          <p v-if="publishedInfo" class="compose-published__link">
            <a :href="publishedInfo.url" target="_blank" rel="noopener noreferrer">{{ publishedInfo.url }}</a>
          </p>
          <p v-if="publishedInfo?.alsoReblog" class="compose-hint">
            The same signed transaction also reblogs the post to your blog.
          </p>
          <p class="compose-hint">
            The link starts working after the queued action is signed and broadcast.
          </p>
          <div class="compose-published__actions">
            <q-btn flat no-caps icon="content_copy" label="Copy link" @click="copyPublishedLink" />
            <q-btn unelevated no-caps color="primary" icon="edit_note" label="Write another" @click="publishedOpen = false" />
          </div>
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
          <q-expansion-item
            icon="data_object"
            label="Raw json_metadata"
            caption="Exactly what the queue item will carry"
            dense-toggle
            class="compose-review__metadata"
          >
            <pre class="compose-review__json" tabindex="0">{{ metadataPreview }}</pre>
            <div class="compose-review__metadata-actions">
              <span class="compose-hint">
                Keys written by another client are preserved on edit.
              </span>
              <q-btn flat dense no-caps icon="content_copy" label="Copy JSON" @click="copyMetadataPreview" />
            </div>
          </q-expansion-item>
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
  color: var(--c-text-subtle);
  font-size: 0.72rem;
  white-space: nowrap;
}

.compose-save--saved {
  color: var(--c-positive);
}

.compose-save--dirty {
  color: var(--c-warning);
}

.compose-save--error {
  color: var(--c-negative);
}

.compose-notice {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-bottom: var(--space-4);
  padding: 0.6rem 0.85rem;
  border: 1px solid color-mix(in srgb, var(--c-warning) 35%, transparent);
  border-radius: var(--radius-sm);
  background: color-mix(in srgb, var(--c-warning) 8%, transparent);
  color: var(--c-warning-soft);
  font-size: 0.78rem;
}

.compose-reminder {
  display: flex;
  align-items: center;
  gap: 0.55rem;
  flex-wrap: wrap;
  margin-bottom: var(--space-4);
  padding: 0.55rem 0.85rem;
  border: 1px solid color-mix(in srgb, var(--c-link) 35%, transparent);
  border-radius: var(--radius-sm);
  background: color-mix(in srgb, var(--c-link) 8%, transparent);
  color: var(--c-link-hover);
  font-size: 0.78rem;
}

.compose-reminder__body {
  display: flex;
  flex-direction: column;
  gap: 0.1rem;
  flex: 1;
  min-width: 180px;
}

.compose-reminder__body strong {
  color: var(--c-text);
  font-size: 0.78rem;
}

.compose-reminder__body span {
  color: var(--c-text-muted);
  font-size: 0.72rem;
}

.compose-reminder__actions {
  display: flex;
  align-items: center;
  gap: 0.15rem;
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
.compose-main :deep(.q-btn-group .bg-primary.text-white),
.compose-main :deep(.q-btn-group .bg-primary.text-white .q-btn__content),
.compose-main :deep(.q-btn-group .bg-primary.text-white .block) {
  background: var(--c-mode-toggle-bg) !important;
  color: var(--c-mode-toggle-text) !important;
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
  border: 1px solid color-mix(in srgb, var(--c-link) 28%, transparent);
  border-radius: var(--radius-sm);
  background: color-mix(in srgb, var(--c-link) 6%, transparent);
  color: var(--c-text-subtle);
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
  border: 1px solid color-mix(in srgb, var(--c-link) 28%, transparent);
  border-radius: var(--radius-sm);
  background: color-mix(in srgb, var(--c-link) 6%, transparent);
  color: var(--c-text-subtle);
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
  border: 1px solid color-mix(in srgb, var(--c-warning) 28%, transparent);
  border-radius: var(--radius-sm);
  background: color-mix(in srgb, var(--c-warning) 6%, transparent);
  color: var(--c-warning-soft);
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
  border: 2px dashed color-mix(in srgb, var(--c-link) 70%, transparent);
  border-radius: var(--radius-sm);
  background: color-mix(in srgb, var(--c-bg-deep) 88%, transparent);
  color: var(--c-link-hover);
  font-size: 0.85rem;
  font-weight: 600;
  pointer-events: none;
}

.compose-textarea--drag {
  border-color: color-mix(in srgb, var(--c-link) 70%, transparent);
}

.compose-toolbar__count {
  flex: none;
  padding: 0 0.35rem;
  color: var(--c-text-faint);
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
  background: var(--c-drawer);
  color: var(--c-text);
  font: inherit;
  font-size: 0.94rem;
  line-height: 1.65;
  tab-size: 2;
}

.compose-textarea:focus {
  outline: 2px solid color-mix(in srgb, var(--c-link) 60%, transparent);
  outline-offset: -1px;
}

.compose-preview {
  min-height: 430px;
  margin-top: 0.65rem;
  padding: 0.9rem 1rem;
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-sm);
  background: color-mix(in srgb, var(--c-text) 2%, transparent);
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
  color: var(--c-text-faint);
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
  color: var(--c-text-faint);
  font-size: 0.7rem;
}

.compose-guidance {
  display: inline-flex;
  align-items: center;
  gap: 0.3rem;
}

.compose-guidance--good {
  color: var(--c-positive);
}

.compose-guidance--short,
.compose-guidance--long {
  color: var(--c-warning);
}

.compose-guidance--too-long {
  color: var(--c-negative);
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
  background: color-mix(in srgb, var(--c-positive) 14%, transparent);
  color: var(--c-positive);
}

.compose-pill--error {
  background: color-mix(in srgb, var(--c-negative) 14%, transparent);
  color: var(--c-negative);
}

.compose-pill--muted {
  background: color-mix(in srgb, var(--c-text) 6%, transparent);
  color: var(--c-text-muted);
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
  color: var(--c-text-subtle);
}

.compose-checklist__item.is-ok .q-icon {
  color: var(--c-positive);
}

.compose-checklist__item.is-warn .q-icon {
  color: var(--c-warning);
}

.compose-checklist__item.is-error .q-icon {
  color: var(--c-negative);
}

.compose-checklist__body {
  min-width: 0;
}

.compose-checklist__label {
  color: var(--c-text-soft);
  font-size: 0.77rem;
  font-weight: 600;
  line-height: 1.35;
}

.compose-checklist__detail {
  color: var(--c-text-faint);
  font-size: 0.7rem;
  line-height: 1.45;
  overflow-wrap: anywhere;
}

.compose-checklist__dismiss {
  min-height: 20px;
  margin: 0.15rem 0 0 -0.35rem;
  padding: 0 0.35rem;
  color: var(--c-text-faint);
  font-size: 0.68rem;
}

.compose-checklist__dismiss:hover,
.compose-checklist__dismiss:focus-visible {
  color: var(--c-link-hover);
}

.compose-checklist__restore {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.4rem;
  margin: -0.35rem 0 0.7rem;
  color: var(--c-text-faint);
  font-size: 0.68rem;
}

.compose-publish {
  width: 100%;
}

.compose-reminder-action {
  display: flex;
  flex-direction: column;
  gap: 0.2rem;
  margin-bottom: 0.55rem;
}

.compose-reminder-action__btn {
  width: 100%;
}

.compose-reminder-action .compose-hint {
  margin: 0;
}

.compose-hint {
  margin: 0.55rem 0 0;
  color: var(--c-text-faint);
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

.compose-community-selected {
  display: flex;
  align-items: center;
  gap: 0.35rem;
  min-width: 0;
}

.compose-community-selected__avatar {
  width: 20px;
  height: 20px;
  border-radius: 50%;
  object-fit: cover;
}

.compose-community-selected__name {
  color: var(--c-text-faint);
  font-size: 0.72rem;
}

.compose-community-card {
  display: flex;
  align-items: flex-start;
  gap: 0.5rem;
  padding: 0.5rem 0.55rem;
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-sm);
  background: color-mix(in srgb, var(--c-text) 2%, transparent);
}

.compose-community-card__avatar {
  flex: none;
  width: 38px;
  height: 38px;
  border-radius: 50%;
  object-fit: cover;
  background: var(--c-drawer);
}

.compose-community-card__body {
  flex: 1;
  min-width: 0;
}

.compose-community-card__head {
  display: flex;
  align-items: baseline;
  gap: 0.35rem;
  flex-wrap: wrap;
}

.compose-community-card__title {
  color: var(--c-text);
  font-size: 0.8rem;
  font-weight: 600;
}

.compose-community-card__name {
  color: var(--c-text-faint);
  font-size: 0.7rem;
}

.compose-community-card__meta {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  flex-wrap: wrap;
  color: var(--c-text-subtle);
  font-size: 0.68rem;
}

.compose-community-card__tag {
  padding: 0 0.3rem;
  border: 1px solid color-mix(in srgb, var(--c-link) 35%, transparent);
  border-radius: 999px;
  color: var(--c-link-hover);
  font-size: 0.62rem;
}

.compose-community-card__about {
  display: -webkit-box;
  margin: 0.15rem 0 0;
  overflow: hidden;
  color: var(--c-text-faint);
  font-size: 0.68rem;
  line-height: 1.4;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
}

.compose-community-card__rules {
  display: inline-flex;
  align-items: center;
  gap: 0.2rem;
  flex: none;
  color: var(--c-link-hover);
  font-size: 0.68rem;
  text-decoration: none;
}

.compose-community-card__rules:hover,
.compose-community-card__rules:focus-visible {
  text-decoration: underline;
}

.compose-warning a {
  color: var(--c-link-hover);
}

.compose-cover {
  display: flex;
  gap: 0.6rem;
  align-items: flex-start;
  padding: 0.5rem;
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-sm);
  background: color-mix(in srgb, var(--c-text) 2%, transparent);
}

.compose-cover__preview {
  flex: none;
  width: 92px;
  height: 68px;
  overflow: hidden;
  border-radius: 4px;
  background: var(--c-drawer);
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
  color: var(--c-text-faint);
  font-size: 0.62rem;
  text-align: center;
}

.compose-cover__body {
  flex: 1;
  min-width: 0;
}

.compose-cover__label {
  color: var(--c-text-soft);
  font-size: 0.75rem;
  font-weight: 600;
}

.compose-cover__meta {
  margin: 0.1rem 0 0.35rem;
  color: var(--c-text-faint);
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
  border: 1px solid color-mix(in srgb, var(--c-warning) 30%, transparent);
  border-radius: var(--radius-sm);
  background: color-mix(in srgb, var(--c-warning) 7%, transparent);
  color: var(--c-warning-soft);
  font-size: 0.72rem;
  line-height: 1.45;
}

.compose-disclosure {
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-sm);
  background: color-mix(in srgb, var(--c-text) 2%, transparent);
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
  background: var(--c-surface-1);
}

.compose-review {
  width: 600px;
  max-width: 94vw;
  max-height: 88vh;
  overflow: auto;
  background: var(--c-surface-1);
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
  border-bottom: 1px solid color-mix(in srgb, var(--c-text) 5%, transparent);
}

.compose-review__row dt {
  color: var(--c-text-faint);
  font-size: 0.7rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.04em;
}

.compose-review__row dd {
  margin: 0;
  color: var(--c-text-soft);
  font-size: 0.78rem;
  line-height: 1.45;
  overflow-wrap: anywhere;
}

.compose-review__actions {
  padding: 0.6rem 0.9rem 0.8rem;
  border-top: 1px solid var(--border-subtle);
  background: color-mix(in srgb, var(--c-text) 2%, transparent);
}

.compose-review__metadata {
  margin-top: 0.4rem;
  border-top: 1px solid var(--border-subtle);
}

.compose-review__json {
  margin: 0.4rem 0 0;
  max-height: 260px;
  overflow: auto;
  padding: 0.65rem 0.75rem;
  border: 1px solid var(--c-code-border);
  border-radius: var(--radius-sm);
  background: var(--c-code-bg);
  color: var(--c-text-soft);
  font-family: var(--font-mono, monospace);
  font-size: 0.72rem;
  line-height: 1.5;
  white-space: pre-wrap;
  overflow-wrap: anywhere;
}

.compose-review__metadata-actions {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
  flex-wrap: wrap;
  margin-top: 0.25rem;
}

.compose-settings {
  width: 560px;
  max-width: 94vw;
  max-height: 88vh;
  overflow: auto;
  background: var(--c-surface-1);
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
  border-bottom: 1px solid color-mix(in srgb, var(--c-text) 5%, transparent);
}

.compose-setting__label {
  color: var(--c-text);
  font-size: 0.78rem;
  font-weight: 600;
}

.compose-setting__hint {
  margin-top: 0.1rem;
  color: var(--c-text-faint);
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
  border-bottom: 1px solid color-mix(in srgb, var(--c-text) 5%, transparent);
}

.compose-help__list dt {
  color: var(--c-link-hover);
  font-size: 0.72rem;
}

.compose-help__list dt code {
  color: var(--c-link-hover);
}

.compose-help__list dd {
  margin: 0;
  color: var(--c-text-muted);
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

.compose-snippets,
.compose-templates,
.compose-published {
  width: 620px;
  max-width: 94vw;
  max-height: 88vh;
  overflow: auto;
  background: var(--c-surface-1);
}

.compose-snippets__body,
.compose-templates__body,
.compose-published__body {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  padding: 0.9rem 1rem 1rem;
}

.compose-snippets__form,
.compose-template-save {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  padding-bottom: 0.7rem;
  border-bottom: 1px solid var(--border-subtle);
}

.compose-snippets__form-actions {
  display: flex;
  justify-content: flex-end;
  gap: 0.3rem;
}

.compose-snippets__io {
  display: flex;
  align-items: center;
  gap: 0.15rem;
  flex-wrap: wrap;
}

.compose-history {
  width: 620px;
  max-width: 94vw;
  max-height: 88vh;
  overflow: auto;
  background: var(--c-surface-1);
}

.compose-reminder-dialog {
  width: 460px;
  max-width: 94vw;
  background: var(--c-surface-1);
}

.compose-topics-order {
  width: 480px;
  max-width: 94vw;
  background: var(--c-surface-1);
}

.compose-topics-order__body {
  display: flex;
  flex-direction: column;
  gap: 0.6rem;
  padding: 0.9rem 1rem 1rem;
}

.compose-topics-order__list {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.compose-topics-order__row {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  padding: 0.3rem 0.4rem;
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-sm);
  background: color-mix(in srgb, var(--c-text) 2%, transparent);
}

.compose-topics-order__index {
  width: 1.2rem;
  color: var(--c-text-faint);
  font-size: 0.68rem;
  text-align: right;
}

.compose-topics-order__tag {
  color: var(--c-text);
  font-size: 0.76rem;
  font-weight: 600;
}

.compose-topics-order__grip {
  color: var(--c-text-faint);
  cursor: grab;
}

.compose-topics-order__row.is-dragging {
  opacity: 0.45;
}

.compose-topics-order__row.is-drop-target {
  border-color: var(--c-link);
  background: color-mix(in srgb, var(--c-link) 9%, transparent);
}

.compose-outline {
  width: 460px;
  max-width: 94vw;
  max-height: 80vh;
  overflow: auto;
  background: var(--c-surface-1);
}

.compose-outline__body {
  padding: 0.9rem 1rem 1rem;
}

.compose-outline__list {
  display: flex;
  flex-direction: column;
  gap: 0.12rem;
}

.compose-outline__item {
  display: flex;
  align-items: baseline;
  gap: 0.5rem;
  width: 100%;
  padding: 0.4rem 0.55rem;
  border: 0;
  border-radius: var(--radius-sm);
  background: transparent;
  color: var(--c-text-soft);
  font: inherit;
  font-size: 0.78rem;
  text-align: left;
  cursor: pointer;
}

.compose-outline__item:hover,
.compose-outline__item:focus-visible {
  background: color-mix(in srgb, var(--c-text) 6%, transparent);
  color: var(--c-text);
}

.compose-outline__level {
  flex: none;
  color: var(--c-text-faint);
  font-size: 0.62rem;
  font-weight: 700;
}

.compose-outline__text {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.compose-emoji {
  width: 520px;
  max-width: 94vw;
  max-height: 80vh;
  overflow: auto;
  background: var(--c-surface-1);
}

.compose-emoji__body {
  display: flex;
  flex-direction: column;
  gap: 0.7rem;
  padding: 0.9rem 1rem 1rem;
}

.compose-emoji__loading {
  display: flex;
  justify-content: center;
  padding: 1.2rem 0;
}

.compose-emoji__label {
  margin-bottom: 0.25rem;
  color: var(--c-text-faint);
  font-size: 0.64rem;
  font-weight: 600;
  letter-spacing: 0.05em;
  text-transform: uppercase;
}

.compose-emoji__grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(36px, 1fr));
  gap: 0.2rem;
}

.compose-emoji__btn {
  aspect-ratio: 1;
  border: 1px solid transparent;
  border-radius: var(--radius-sm);
  background: color-mix(in srgb, var(--c-text) 2%, transparent);
  font-size: 1.1rem;
  line-height: 1;
  cursor: pointer;
}

.compose-emoji__btn:hover,
.compose-emoji__btn:focus-visible {
  border-color: var(--border-subtle);
  background: color-mix(in srgb, var(--c-text) 8%, transparent);
}

.compose-reminder-dialog__body {
  display: flex;
  flex-direction: column;
  gap: 0.6rem;
  padding: 0.9rem 1rem 1rem;
}

.compose-reminder-dialog__actions {
  display: flex;
  justify-content: flex-end;
  gap: 0.3rem;
  flex-wrap: wrap;
  padding-top: 0.2rem;
  border-top: 1px solid var(--border-subtle);
}

.compose-history__body {
  display: flex;
  flex-direction: column;
  gap: 0.6rem;
  padding: 0.9rem 1rem 1rem;
}

.compose-history__actions {
  display: flex;
  align-items: center;
  gap: 0.2rem;
  flex-wrap: wrap;
}

.compose-history__list {
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
}

.compose-history__item {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 0.5rem;
  padding: 0.45rem 0.55rem;
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-sm);
  background: color-mix(in srgb, var(--c-text) 3%, transparent);
}

.compose-history__time {
  margin-top: 0.15rem;
  color: var(--c-text-faint);
  font-size: 0.66rem;
}

.compose-snippets__list,
.compose-template-group {
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
}

.compose-snippet,
.compose-template {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 0.5rem;
  padding: 0.45rem 0.55rem;
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-sm);
  background: color-mix(in srgb, var(--c-text) 3%, transparent);
}

.compose-snippet__body {
  flex: 1;
  min-width: 0;
}

.compose-snippet__name {
  color: var(--c-text);
  font-size: 0.78rem;
  font-weight: 600;
}

.compose-snippet__preview {
  display: -webkit-box;
  overflow: hidden;
  margin-top: 0.1rem;
  color: var(--c-text-subtle);
  font-size: 0.69rem;
  line-height: 1.4;
  white-space: pre-wrap;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
}

.compose-snippet__actions {
  display: flex;
  align-items: center;
  gap: 0.1rem;
  flex: none;
}

.compose-template-group__title {
  color: var(--c-text-subtle);
  font-size: 0.7rem;
  font-weight: 600;
  letter-spacing: 0.05em;
  text-transform: uppercase;
}

.compose-published__text {
  margin: 0;
  color: var(--c-text-soft);
  font-size: 0.82rem;
  line-height: 1.55;
}

.compose-published__link {
  margin: 0;
  padding: 0.5rem 0.6rem;
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-sm);
  background: color-mix(in srgb, var(--c-text) 3%, transparent);
  overflow-wrap: anywhere;
  font-size: 0.75rem;
}

.compose-published__link a {
  color: var(--c-link-hover);
}

.compose-published__actions {
  display: flex;
  justify-content: flex-end;
  gap: 0.3rem;
  flex-wrap: wrap;
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
  color: var(--c-link);
  font-size: 0.74rem;
}

.compose-upload-error {
  display: flex;
  align-items: flex-start;
  gap: 0.35rem;
  color: var(--c-negative);
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
  color: var(--c-text-muted);
  font-size: 0.74rem;
  font-weight: 600;
}

.compose-upload-queue {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
}

.compose-upload-item {
  padding: 0.4rem 0.5rem;
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-sm);
  background: color-mix(in srgb, var(--c-text) 3%, transparent);
}

.compose-upload-item.is-done {
  border-color: color-mix(in srgb, var(--c-positive) 40%, transparent);
}

.compose-upload-item.is-error {
  border-color: color-mix(in srgb, var(--c-negative) 50%, transparent);
}

.compose-upload-item.is-cancelled {
  opacity: 0.82;
}

.compose-upload-item__row {
  display: flex;
  align-items: flex-start;
  gap: 0.45rem;
}

.compose-upload-item__row > .q-icon {
  margin-top: 0.1rem;
  color: var(--c-text-subtle);
}

.compose-upload-item.is-done .compose-upload-item__row > .q-icon {
  color: var(--c-positive);
}

.compose-upload-item.is-error .compose-upload-item__row > .q-icon {
  color: var(--c-negative);
}

.compose-upload-item__body {
  flex: 1;
  min-width: 0;
}

.compose-upload-item__name {
  overflow: hidden;
  color: var(--c-text);
  font-size: 0.75rem;
  font-weight: 600;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.compose-upload-item__meta {
  display: flex;
  flex-wrap: wrap;
  gap: 0.15rem 0.45rem;
  color: var(--c-text-subtle);
  font-size: 0.68rem;
}

.compose-upload-item__progress {
  width: 100%;
  margin-top: 0.3rem;
  border-radius: 3px;
  overflow: hidden;
}

.compose-upload-recent__list {
  display: flex;
  flex-direction: column;
  gap: 0.3rem;
  max-height: 230px;
  margin: 0.45rem 0 0;
  padding: 0;
  overflow-y: auto;
  list-style: none;
}

.compose-upload-recent__item {
  display: flex;
  align-items: center;
  gap: 0.25rem;
}

.compose-media-tile.compose-upload-recent__tile {
  flex: 1;
  flex-direction: row;
  align-items: center;
  gap: 0.5rem;
  min-width: 0;
  padding: 0.3rem;
}

.compose-media-tile.compose-upload-recent__tile img {
  flex: none;
  width: 48px;
  height: 48px;
}

.compose-upload-recent__name {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  color: var(--c-text);
  font-size: 0.72rem;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.compose-upload-recent__meta {
  flex: none;
  color: var(--c-text-subtle);
  font-size: 0.7rem;
  white-space: nowrap;
}

.compose-upload-recent__action {
  flex: none;
  color: var(--c-link);
  font-size: 0.66rem;
  white-space: nowrap;
}

@media (max-width: 599px) {
  .compose-upload-recent__meta {
    display: none;
  }
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
  background: color-mix(in srgb, var(--c-text) 3%, transparent);
  color: var(--c-text-subtle);
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
  border-color: color-mix(in srgb, var(--c-link) 55%, transparent);
  color: var(--c-text);
}

.compose-media-tile:focus-visible {
  outline: 2px solid var(--c-link);
  outline-offset: 2px;
}

.compose-media-tile.is-selected {
  border-color: var(--c-link);
  background: color-mix(in srgb, var(--c-link) 10%, transparent);
  color: var(--c-text);
}

.compose-source {
  display: flex;
  align-items: center;
  gap: 0.45rem;
  padding: 0.45rem 0.55rem;
  border: 1px solid color-mix(in srgb, var(--c-link) 28%, transparent);
  border-radius: var(--radius-sm);
  background: color-mix(in srgb, var(--c-link) 6%, transparent);
}

.compose-source__body {
  flex: 1;
  min-width: 0;
}

.compose-source__label {
  color: var(--c-text-subtle);
  font-size: 0.68rem;
}

.compose-source__label--wrap {
  overflow-wrap: anywhere;
}

.compose-source__link {
  display: block;
  overflow: hidden;
  color: var(--c-link-hover);
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

.compose-bene-actions {
  display: flex;
  align-items: center;
  gap: 0.1rem;
  flex-wrap: wrap;
}

.compose-topic-order {
  display: flex;
  align-items: center;
  gap: 0.25rem;
  flex-wrap: wrap;
}

.compose-topic-order .compose-hint {
  margin: 0;
}

.compose-empty-line {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  padding: 0.5rem 0.55rem;
  border: 1px dashed var(--border-subtle);
  border-radius: var(--radius-sm);
  color: var(--c-text-faint);
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
  color: var(--c-warning);
}

.compose-total {
  color: var(--c-positive);
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

.compose-draft-view {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
  flex-wrap: wrap;
}

.compose-draft-view .compose-hint {
  margin: 0;
}

.compose-draft-filters {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 128px;
  gap: 0.35rem;
  align-items: center;
}

.compose-draft-filters :deep(.q-field__control) {
  min-height: 34px;
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
  background: color-mix(in srgb, var(--c-text) 2%, transparent);
}

.compose-draft--active {
  border-color: color-mix(in srgb, var(--c-link) 50%, transparent);
  background: color-mix(in srgb, var(--c-link) 8%, transparent);
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
  outline: 2px solid var(--c-link);
  outline-offset: 2px;
  border-radius: 3px;
}

.compose-draft__title {
  display: block;
  overflow: hidden;
  color: var(--c-text);
  font-size: 0.78rem;
  font-weight: 600;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.compose-draft__meta {
  display: block;
  color: var(--c-text-faint);
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
  background: var(--c-surface-1);
}

.compose-confirm__text {
  margin: 0.5rem 0 0;
  color: var(--c-text-muted);
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

  .compose-draft-filters {
    grid-template-columns: minmax(0, 1fr);
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
import moment from 'src/utils/time'
import { signImageUploadChallenge } from 'src/services/imageSigning'
import { applyMarkdownAction, continueMarkdownList, markdownHeadings, shortcutMarkdownAction, wordCount } from 'src/utils/markdownEditor'
import { altFromFileName, deriveDescription, extractBodyImages, imageFilesFromTransfer, markdownImage } from 'src/utils/media'
import { detectEmbed } from 'src/services/embeds'
import { fetchAccountNameSearch, fetchCommunityInfoBatch } from 'src/services/chainData'
import {
  buildCommunityPickerOptions,
  communitySubscriptionWarning,
  filterCommunityOptions,
  normalizeSubscriptionRows
} from 'src/services/communityPicker'
import { readRecentValues, rememberRecentValue } from 'src/services/composerPrefs'
import { suggestTopics } from 'src/services/composerSuggestions'
import {
  AI_TOOL_KEYS,
  COLLECTION_TAG,
  DESCRIPTION_MAX,
  MAX_BENEFICIARIES,
  MAX_TAGS,
  appendDraftHistory,
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
  readDraftHistory,
  readDrafts,
  readPinnedDraftIds,
  removeDraftById,
  removeDraftHistory,
  restoreDraftSnapshot,
  serializeDraftExport,
  togglePinnedDraftId,
  upsertDraft,
  writePinnedDraftIds,
  writeDrafts
} from 'src/services/drafts'
import {
  appendUploadHistory,
  buildImageChecksumSigningPayload,
  buildImageSigningPayload,
  clearUploadHistory,
  createUploadQueue,
  formatUploadAge,
  formatUploadBytes,
  imageHostErrorMessage,
  isUploadAborted,
  MAX_IMAGE_BYTES,
  readImageBytes,
  readUploadHistory,
  RECOMMENDED_IMAGE_BYTES,
  uploadImage,
  uploadQueueSummary,
  validateImageFile
} from 'src/services/imageHost'
import {
  createSnippet,
  MAX_SNIPPET_NAME,
  mergeSnippets,
  parseSnippetExport,
  readSnippets,
  removeSnippetById,
  serializeSnippetExport,
  upsertSnippet,
  writeSnippets
} from 'src/services/snippets'
import {
  applyTemplateToDraft,
  MAX_TEMPLATE_NAME,
  mergeTemplates,
  parseTemplateExport,
  readTemplates,
  removeTemplateById,
  serializeTemplateExport,
  STARTER_TEMPLATES,
  templateFromDraft,
  upsertTemplate,
  writeTemplates
} from 'src/services/templates'
import {
  dismissWarning,
  readDismissedWarnings,
  restoreDismissedWarnings
} from 'src/services/checklistPrefs'
import {
  probeImageHealth
} from 'src/services/imageHealth'
import {
  AI_TOOL_LABELS,
  buildPostMetadata,
  canPublish as canPublishDraft,
  checklistErrors as collectChecklistErrors,
  createPostPermlink,
  parseHivePostUrl,
  postQueueItem,
  publishChecklist,
  readCrossPostMetadata,
  resolvedTags,
  stripManagedMetadata
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
      draftSearch: '',
      draftSort: 'updated',
      draftSortOptions: [
        { label: 'Recently updated', value: 'updated' },
        { label: 'Title', value: 'title' }
      ],
      draftView: 'active',
      draftViewOptions: [
        { label: 'Active', value: 'active' },
        { label: 'Archived', value: 'archived' }
      ],
      storageBytes: 0,
      pinnedDraftIds: [],
      snippets: [],
      snippetsOpen: false,
      snippetId: null,
      snippetName: '',
      snippetBody: '',
      snippetError: '',
      snippetNameMax: MAX_SNIPPET_NAME,
      templates: [],
      templatesOpen: false,
      templateName: '',
      templateSummary: '',
      templateError: '',
      templateNameMax: MAX_TEMPLATE_NAME,
      starterTemplates: STARTER_TEMPLATES,
      publishedOpen: false,
      publishedInfo: null,
      historyOpen: false,
      draftHistory: [],
      reminderDialogOpen: false,
      reminderValue: '',
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
      beneficiaryOptions: [],
      beneficiarySearching: false,
      beneficiarySearchTimer: null,
      recentCommunities: [],
      recentTags: [],
      topicsOrderOpen: false,
      dragTagIndex: null,
      dragTagOver: null,
      outlineOpen: false,
      emojiOpen: false,
      emojiLoading: false,
      emojiGroups: [],
      discardOpen: false,
      discardTarget: null,
      communityLoading: false,
      communityLoadedFor: null,
      communityStats: {},
      communityStatsLoadedFor: null,
      communityFilter: '',
      communityOptionsShown: [],
      uploadDialogOpen: false,
      uploadFiles: [],
      uploadAlt: '',
      uploadError: '',
      uploadTarget: 'body',
      uploadItems: [],
      uploadAbort: null,
      uploadRunCancelled: false,
      recentUploads: [],
      imageHealth: null,
      imageProbeTimer: null,
      imageProbeRun: 0,
      dismissedChecklistWarnings: [],
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
    imageProbeKey () {
      if (!this.draft) return ''
      return [this.coverImage, ...this.bodyImages.map(image => image.url)]
        .filter(Boolean)
        .join('\n')
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
    uploadBusy () {
      return this.uploadItems.some(item =>
        item.status === 'queued' || item.status === 'signing' || item.status === 'uploading'
      )
    },
    uploadSummary () {
      return uploadQueueSummary(this.uploadItems)
    },
    uploadSummaryLabel () {
      const summary = this.uploadSummary
      if (!summary.total) return ''
      const parts = []
      if (summary.done) parts.push(summary.done + ' uploaded')
      if (summary.failed) parts.push(summary.failed + ' failed')
      if (summary.cancelled) parts.push(summary.cancelled + ' cancelled')
      if (summary.active) parts.push(summary.active + ' remaining')
      return parts.join(' · ')
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
      if (!this.draft) return []
      const items = publishChecklist(this.draft, {
        username: this.loggedInUser,
        imageHealth: this.imageHealth
      })
      return items.filter(item => {
        if (!item.dismissKey || item.status !== 'warn') return true
        return !this.dismissedChecklistWarnings.includes(item.dismissKey)
      })
    },
    checklistErrors () {
      return collectChecklistErrors(this.checklist)
    },
    dismissedWarningCount () {
      return this.dismissedChecklistWarnings.length
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
      if (draft.alsoReblog && this.postingToCommunity && !this.isEditing) {
        rows.push({ label: 'Blog', value: 'Also reblogged to your blog' })
      }
      return rows
    },
    /** The exact json_metadata the queue item will carry, merged like publish.js. */
    metadataPreview () {
      if (!this.draft) return '{}'
      const editing = this.draft.editing || null
      const previousMetadata = editing && editing.previousMetadata && typeof editing.previousMetadata === 'object'
        ? editing.previousMetadata
        : null
      const previous = previousMetadata ? stripManagedMetadata(previousMetadata) : {}
      // Comment edits keep only the app/format marker over preserved keys.
      if (editing && editing.parentAuthor) {
        return JSON.stringify({ ...previous, app: 'hive.ausbit.dev', format: 'markdown' }, null, 2)
      }
      const next = buildPostMetadata(this.draft)
      // Edits keep an existing cover when the draft has no images of its own.
      if (!next.image && Array.isArray(previousMetadata?.image) && previousMetadata.image.length) {
        next.image = previousMetadata.image
      }
      return JSON.stringify({ ...previous, ...next }, null, 2)
    },
    canPublish () {
      return Boolean(this.draft) && canPublishDraft(this.draft, { username: this.loggedInUser })
    },
    activeDraftTitle () {
      return this.draft ? draftDisplayTitle(this.draft) : 'New draft'
    },
    headings () {
      return this.draft ? markdownHeadings(this.draft.body) : []
    },
    isEditing () {
      return Boolean(this.draft && this.draft.editing)
    },
    /** Editing a reply: no title, no category, no reward settings. */
    isEditingComment () {
      return Boolean(this.draft && this.draft.editing && this.draft.editing.parentAuthor)
    },
    /** Only real community destinations offer the companion blog reblog. */
    postingToCommunity () {
      return Boolean(this.draft && /^hive-\d+$/.test(String(this.draft.community || '')))
    },
    visibleDrafts () {
      if (!this.loggedInUser) return this.drafts
      return this.drafts.filter(item => !item.owner || item.owner === this.loggedInUser)
    },
    filteredDrafts () {
      const query = this.draftSearch.trim().toLowerCase()
      const archived = this.draftView === 'archived'
      let source = this.visibleDrafts.filter(item => archived ? Boolean(item.archivedAt) : !item.archivedAt)
      if (query) {
        source = source.filter(item =>
          (item.title || '').toLowerCase().includes(query) ||
          (item.body || '').toLowerCase().includes(query)
        )
      } else {
        source = [...source]
      }
      const pinned = new Set(this.pinnedDraftIds)
      source.sort((a, b) => {
        const pinDiff = Number(pinned.has(b.id)) - Number(pinned.has(a.id))
        if (pinDiff) return pinDiff
        if (this.draftSort === 'title') {
          return draftDisplayTitle(a).localeCompare(draftDisplayTitle(b))
        }
        return Number(b.updatedAt) - Number(a.updatedAt)
      })
      return source
    },
    archivedDraftCount () {
      return this.visibleDrafts.filter(item => Boolean(item.archivedAt)).length
    },
    dueReminders () {
      const now = Date.now()
      return this.visibleDrafts
        .filter(item => !item.archivedAt && item.scheduledAt && Date.parse(item.scheduledAt) <= now)
        .sort((a, b) => Date.parse(a.scheduledAt) - Date.parse(b.scheduledAt))
    },
    scheduledLabel () {
      if (!this.draft?.scheduledAt) return ''
      return moment(this.draft.scheduledAt).format('D MMM YYYY, HH:mm')
    },
    storageUsageLabel () {
      if (!this.storageBytes) return '0 KB'
      return (this.storageBytes / 1024).toFixed(this.storageBytes > 100 * 1024 ? 0 : 1) + ' KB'
    },
    tagSuggestions () {
      const base = ['hive', 'blog', 'writing', 'photography', 'art', 'dev', 'news', 'music']
      const suggested = suggestTopics({
        title: this.draft?.title || '',
        body: this.draft?.body || '',
        tags: this.draft?.tags || [],
        community: this.draft?.community || ''
      })
      const tags = new Map()
      for (const list of [this.recentTags, suggested, base]) {
        for (const tag of list) {
          const value = normalizeTag(tag)
          if (value && !tags.has(value)) tags.set(value, value)
        }
      }
      return [...tags.values()]
    },
    allCommunityOptions () {
      return buildCommunityPickerOptions({
        subscriptions: this.$hiveStore.user.communities || [],
        recent: this.recentCommunities,
        info: { ...this.communityStats, ...(this.$hiveStore.communityInfo || {}) },
        selected: this.draft?.community || '',
        owner: this.loggedInUser
      })
    },
    selectedCommunity () {
      const selected = normalizeTag(this.draft?.community)
      return this.allCommunityOptions.find(option => option.value === selected) ||
        this.allCommunityOptions[0] ||
        null
    },
    communityWarning () {
      return communitySubscriptionWarning(this.draft?.community, {
        subscriptions: this.$hiveStore.user.communities || [],
        owner: this.loggedInUser,
        loaded: this.communityLoadedFor === this.loggedInUser
      })
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
      this.loadSnippets()
      this.loadTemplates()
      this.loadPinnedDrafts()
      this.loadRecentValues()
      this.loadChecklistWarnings()
      this.communityStats = {}
      this.communityStatsLoadedFor = null
      this.communityFilter = ''
      this.communityOptionsShown = this.allCommunityOptions
    },
    imageProbeKey: {
      immediate: true,
      handler () {
        this.scheduleImageProbe()
      }
    },
    allCommunityOptions: {
      deep: true,
      handler (list) {
        this.communityOptionsShown = this.communityFilter
          ? filterCommunityOptions(list, this.communityFilter)
          : list
      }
    },
    'draft.body' () {
      this.schedulePreview()
    },
    'draft.community' (value) {
      const tag = normalizeTag(value)
      if (!tag) return
      if (this.communityStats[tag] || this.$hiveStore.communityInfo[tag]) return
      this.$hiveStore.getCommunityInfo(tag)
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
    this.loadSnippets()
    this.loadTemplates()
    this.loadPinnedDrafts()
    this.loadRecentValues()
    this.loadChecklistWarnings()
    this.refreshStorageUsage()
    window.addEventListener('keydown', this.onGlobalKeydown)
    window.addEventListener('beforeunload', this.flushAutosave)
    window.addEventListener('storage', this.onStorageChange)
    document.addEventListener('visibilitychange', this.onVisibilityChange)
  },
  beforeUnmount () {
    this.flushAutosave()
    if (this.previewTimer) clearTimeout(this.previewTimer)
    if (this.imageProbeTimer) clearTimeout(this.imageProbeTimer)
    window.removeEventListener('keydown', this.onGlobalKeydown)
    window.removeEventListener('beforeunload', this.flushAutosave)
    window.removeEventListener('storage', this.onStorageChange)
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
        this.ensureCommunityStats()
      } catch (error) {
        console.error('Failed to load community subscriptions', error)
      } finally {
        this.communityLoading = false
      }
    },
    onCommunityPopupShow () {
      this.communityFilter = ''
      this.communityOptionsShown = this.allCommunityOptions
      this.ensureCommunityStats()
    },
    onCommunityFilter (value, update) {
      this.communityFilter = String(value || '')
      update(() => {
        this.communityOptionsShown = this.communityFilter
          ? filterCommunityOptions(this.allCommunityOptions, this.communityFilter)
          : this.allCommunityOptions
      })
    },
    async ensureCommunityStats () {
      const user = this.loggedInUser
      if (!user || this.communityStatsLoadedFor === user) return
      const rows = normalizeSubscriptionRows(this.$hiveStore.user.communities)
      if (!rows.length) return
      this.communityStatsLoadedFor = user
      try {
        const stats = await fetchCommunityInfoBatch(rows.map(row => row.name), {
          limit: 40,
          maxPages: 4,
          fallback: false,
          titleFor: name => rows.find(row => row.name === name)?.title || name
        })
        if (this.loggedInUser === user) this.communityStats = stats || {}
      } catch {
        if (this.loggedInUser === user) this.communityStats = {}
      }
    },
    formatCommunitySubscribers (value) {
      const number = Number(value)
      if (!Number.isFinite(number) || number <= 0) return ''
      return number.toLocaleString('en-US')
    },
    loadUploadHistory () {
      this.recentUploads = readUploadHistory(LocalStorage, this.loggedInUser)
    },
    loadSnippets () {
      this.snippets = readSnippets(LocalStorage, this.loggedInUser)
    },
    loadTemplates () {
      this.templates = readTemplates(LocalStorage, this.loggedInUser)
    },
    loadPinnedDrafts () {
      this.pinnedDraftIds = readPinnedDraftIds(LocalStorage, this.loggedInUser)
    },
    loadRecentValues () {
      this.recentCommunities = readRecentValues(LocalStorage, 'communities', this.loggedInUser, 8)
      this.recentTags = readRecentValues(LocalStorage, 'tags', this.loggedInUser, 12)
    },
    loadChecklistWarnings () {
      this.dismissedChecklistWarnings = readDismissedWarnings(LocalStorage, this.loggedInUser)
    },
    scheduleImageProbe () {
      if (this.imageProbeTimer) clearTimeout(this.imageProbeTimer)
      if (!this.imageProbeKey) {
        this.imageProbeRun += 1
        this.imageProbeTimer = null
        this.imageHealth = null
        return
      }
      this.imageProbeTimer = setTimeout(() => {
        this.imageProbeTimer = null
        this.runImageProbe()
      }, 500)
    },
    async runImageProbe () {
      const key = this.imageProbeKey
      if (!key) {
        this.imageHealth = null
        return
      }
      const run = ++this.imageProbeRun
      const health = await probeImageHealth(key.split('\n'), { coverUrl: this.coverImage })
      if (run !== this.imageProbeRun || key !== this.imageProbeKey) return
      this.imageHealth = health
    },
    dismissChecklistItem (item) {
      const key = item && item.dismissKey
      if (!key) return
      this.dismissedChecklistWarnings = dismissWarning(LocalStorage, this.loggedInUser, key)
      this.$q.notify({
        type: 'info',
        message: 'Warning hidden',
        caption: 'Use Restore hidden warnings in the checklist to show it again.'
      })
    },
    restoreChecklistWarnings () {
      this.dismissedChecklistWarnings = restoreDismissedWarnings(LocalStorage, this.loggedInUser)
      this.$q.notify({ type: 'positive', message: 'Checklist warnings restored' })
    },
    rememberCommunity (value) {
      const tag = normalizeTag(value)
      if (!tag) return
      this.recentCommunities = rememberRecentValue(LocalStorage, 'communities', this.loggedInUser, tag, 8)
    },
    rememberTags (tags = this.draft?.tags) {
      for (const tag of Array.isArray(tags) ? tags : []) {
        this.recentTags = rememberRecentValue(LocalStorage, 'tags', this.loggedInUser, tag, 12)
      }
    },
    onBeneficiaryFilter (value, update) {
      const query = String(value || '').trim().toLowerCase()
      if (this.beneficiarySearchTimer) clearTimeout(this.beneficiarySearchTimer)
      if (!query) {
        update([])
        this.beneficiarySearching = false
        return
      }
      this.beneficiarySearching = true
      this.beneficiarySearchTimer = setTimeout(async () => {
        try {
          const accounts = await fetchAccountNameSearch(query, 6)
          update((Array.isArray(accounts) ? accounts : [])
            .map(account => account.name)
            .filter(Boolean))
        } catch {
          update([])
        } finally {
          this.beneficiarySearching = false
        }
      }, 250)
    },
    onNewBeneficiaryValue (value, done) {
      done(value, 'add-unique')
    },
    applyDefaultBeneficiaries () {
      if (!this.draft) return
      const defaults = normalizeBeneficiaries((this.$hiveStore.user.settings.beneficiary || []).map(item => ({
        account: item.account,
        weight: item.weight
      })))
      this.draft.beneficiaries = defaults
      this.$q.notify({
        message: defaults.length ? 'Default beneficiaries applied' : 'No default beneficiaries are configured'
      })
    },
    removeAllBeneficiaries () {
      if (!this.draft) return
      this.draft.beneficiaries = []
      this.$q.notify({ message: 'Beneficiaries removed for this draft' })
    },
    saveBeneficiariesAsDefaults () {
      if (!this.draft) return
      const beneficiary = this.draft.beneficiaries.map(item => ({
        account: item.account,
        weight: item.weight
      }))
      this.$hiveStore.updateSettings({
        ...this.$hiveStore.user.settings,
        beneficiary
      })
      this.$q.notify({
        type: 'positive',
        message: 'Beneficiary defaults saved',
        caption: beneficiary.length ? 'New drafts will start with these beneficiaries.' : 'New drafts will start with no beneficiaries.'
      })
    },
    moveTag (index, delta) {
      if (!this.draft) return
      const next = index + delta
      if (index < 0 || next < 0 || next >= this.draft.tags.length) return
      const tags = [...this.draft.tags]
      const [tag] = tags.splice(index, 1)
      tags.splice(next, 0, tag)
      this.draft.tags = tags
    },
    reorderTag (from, to) {
      if (!this.draft) return
      const tags = [...this.draft.tags]
      if (from < 0 || to < 0 || from >= tags.length || to >= tags.length || from === to) return
      const [tag] = tags.splice(from, 1)
      tags.splice(to, 0, tag)
      this.draft.tags = tags
    },
    startTagDrag (index, event) {
      this.dragTagIndex = index
      this.dragTagOver = index
      if (event?.dataTransfer) {
        event.dataTransfer.effectAllowed = 'move'
        try {
          event.dataTransfer.setData('text/plain', String(index))
        } catch {
          // Some browsers restrict DataTransfer writes; the index is in state.
        }
      }
    },
    overTagDrag (index) {
      if (this.dragTagIndex !== null) this.dragTagOver = index
    },
    dropTag (index) {
      const from = this.dragTagIndex
      this.endTagDrag()
      if (from !== null) this.reorderTag(from, index)
    },
    endTagDrag () {
      this.dragTagIndex = null
      this.dragTagOver = null
    },
    openOutline () {
      if (!this.draft || !this.headings.length) return
      if (this.mode === 'preview') this.mode = 'write'
      this.outlineOpen = true
    },
    jumpToHeading (heading) {
      this.outlineOpen = false
      const element = this.$refs.body
      if (!element || !heading) return
      this.$nextTick(() => {
        element.focus()
        element.setSelectionRange(heading.index, heading.index)
        const lineHeight = parseFloat(getComputedStyle(element).lineHeight) || 24
        element.scrollTop = Math.max(0, (heading.line - 2) * lineHeight)
      })
    },
    openEmojiPicker () {
      if (!this.draft) return
      if (this.mode === 'preview') this.mode = 'write'
      this.captureSelection()
      this.emojiOpen = true
      if (this.emojiGroups.length) return
      this.emojiLoading = true
      import('src/utils/emoji')
        .then(({ EMOJI_GROUPS }) => {
          this.emojiGroups = EMOJI_GROUPS
        })
        .catch(error => {
          console.error('Failed to load the emoji picker', error)
        })
        .finally(() => {
          this.emojiLoading = false
        })
    },
    insertEmoji (char) {
      if (!this.draft || !char) return
      const body = this.draft.body
      const selection = this.savedSelection || { start: body.length, end: body.length }
      const start = Math.max(0, Math.min(selection.start, body.length))
      const end = Math.max(start, Math.min(selection.end, body.length))
      const text = body.slice(0, start) + char + body.slice(end)
      this.emojiOpen = false
      this.replaceBody({ text, start: start + char.length, end: start + char.length })
    },
    refreshStorageUsage () {
      if (typeof localStorage === 'undefined') return
      let bytes = 0
      try {
        for (let index = 0; index < localStorage.length; index++) {
          const key = localStorage.key(index) || ''
          if (!key.startsWith('compose')) continue
          bytes += String(localStorage.getItem(key) || '').length
        }
      } catch {
        bytes = 0
      }
      this.storageBytes = bytes
    },
    archiveDraft (draft) {
      if (!draft) return
      const archivedAt = Date.now()
      this.drafts = upsertDraft(this.drafts, { ...draft, archivedAt })
      writeDrafts(LocalStorage, this.drafts)
      if (this.draft && this.draft.id === draft.id) this.draft.archivedAt = archivedAt
      this.refreshStorageUsage()
      this.$q.notify({ message: 'Draft archived', caption: 'Switch to Archived to restore it.' })
    },
    unarchiveDraft (draft) {
      if (!draft) return
      this.drafts = upsertDraft(this.drafts, { ...draft, archivedAt: null })
      writeDrafts(LocalStorage, this.drafts)
      if (this.draft && this.draft.id === draft.id) this.draft.archivedAt = null
      this.refreshStorageUsage()
      this.$q.notify({ message: 'Draft restored' })
    },
    clearAllDrafts () {
      this.$q.dialog({
        title: 'Clear every local draft?',
        message: 'This removes all drafts and their history from this browser. Snippets and templates are kept. Export a backup first if you may need them.',
        cancel: { label: 'Cancel', flat: true },
        ok: { label: 'Clear all drafts', color: 'negative', unelevated: true },
        persistent: true
      }).onOk(() => {
        for (const draft of this.drafts) removeDraftHistory(LocalStorage, draft.id)
        this.drafts = []
        writeDrafts(LocalStorage, [])
        this.pinnedDraftIds = []
        writePinnedDraftIds(LocalStorage, this.loggedInUser, [])
        this.setActiveDraft(this.blankDraft())
        this.$router.replace({ name: 'compose', params: {} }).catch(() => {})
        this.refreshStorageUsage()
        this.$q.notify({ message: 'All local drafts cleared' })
      })
    },
    openReminder (draft) {
      if (!draft) return
      this.draftView = 'active'
      this.selectDraft(draft.id)
    },
    dismissReminders () {
      const due = this.dueReminders.map(item => item.id)
      if (!due.length) return
      const set = new Set(due)
      this.drafts = this.drafts.map(item => set.has(item.id) ? normalizeDraft({ ...item, scheduledAt: '' }) : item)
      if (this.draft && set.has(this.draft.id)) this.draft.scheduledAt = ''
      writeDrafts(LocalStorage, this.drafts)
      this.refreshStorageUsage()
      this.$q.notify({ message: 'Draft reminders dismissed' })
    },
    openReminderDialog () {
      if (!this.draft) return
      this.reminderValue = toLocalDateTimeInput(this.draft.scheduledAt)
      this.reminderDialogOpen = true
    },
    saveReminder () {
      if (!this.draft) return
      const scheduledAt = this.reminderValue ? fromLocalDateTimeInput(this.reminderValue) : ''
      if (this.reminderValue && !scheduledAt) {
        this.$q.notify({ type: 'negative', message: 'Enter a valid reminder date and time.' })
        return
      }
      this.draft.scheduledAt = scheduledAt
      this.reminderDialogOpen = false
      this.$q.notify({
        type: 'positive',
        message: scheduledAt ? 'Reminder set' : 'Reminder cleared',
        caption: scheduledAt ? 'This is a local reminder only. Nothing publishes automatically.' : ''
      })
    },
    clearReminderDialog () {
      if (this.draft) this.draft.scheduledAt = ''
      this.reminderValue = ''
      this.reminderDialogOpen = false
      this.$q.notify({ message: 'Reminder cleared' })
    },
    onStorageChange (event) {
      const key = String(event.key || '')
      if (!key.startsWith('compose')) return
      if (key === 'composeDrafts') {
        const next = readDrafts(LocalStorage)
        this.drafts = next
        const active = this.draft ? next.find(item => item.id === this.draft.id) : null
        if (this.draft && !active) {
          this.setActiveDraft(next[0] || this.blankDraft())
        } else if (active && this.snapshotDraft(this.draft) === this.lastSavedSnapshot) {
          this.setActiveDraft(active)
        } else if (active) {
          this.$q.notify({ message: 'Drafts changed in another tab', caption: 'Your unsaved edits were kept.' })
        }
        this.refreshStorageUsage()
        return
      }
      if (key.startsWith('composeSnippets:')) {
        this.loadSnippets()
        return
      }
      if (key.startsWith('composeTemplates:')) {
        this.loadTemplates()
        return
      }
      if (key.startsWith('composePinned:')) {
        this.loadPinnedDrafts()
        return
      }
      if (key === 'composeDraftHistory' && this.historyOpen) {
        this.openDraftHistory()
      }
    },
    openSnippets () {
      this.loadSnippets()
      this.resetSnippetForm()
      this.snippetsOpen = true
    },
    resetSnippetForm () {
      this.snippetId = null
      this.snippetName = ''
      this.snippetBody = ''
      this.snippetError = ''
    },
    editSnippet (snippet) {
      if (!snippet) return
      this.snippetId = snippet.id
      this.snippetName = snippet.name
      this.snippetBody = snippet.body
      this.snippetError = ''
    },
    saveSnippet () {
      const name = this.snippetName.trim()
      const body = this.snippetBody.trim()
      if (!name) {
        this.snippetError = 'Give the snippet a name.'
        return
      }
      if (!body) {
        this.snippetError = 'Write the snippet text.'
        return
      }
      const existing = this.snippetId ? this.snippets.find(item => item.id === this.snippetId) : null
      const snippet = existing
        ? { ...existing, name, body }
        : createSnippet({ owner: this.loggedInUser || null, name, body })
      this.snippets = upsertSnippet(this.snippets, snippet)
      if (!writeSnippets(LocalStorage, this.loggedInUser, this.snippets)) {
        this.snippetError = 'Could not save the snippet. Browser storage is unavailable.'
        return
      }
      this.refreshStorageUsage()
      this.resetSnippetForm()
      this.$q.notify({ type: 'positive', message: existing ? 'Snippet updated' : 'Snippet saved' })
    },
    deleteSnippet (snippet) {
      if (!snippet) return
      this.$q.dialog({
        title: 'Delete this snippet?',
        message: '“' + snippet.name + '” will be removed from this browser.',
        cancel: { label: 'Cancel', flat: true },
        ok: { label: 'Delete snippet', color: 'negative', unelevated: true },
        persistent: true
      }).onOk(() => {
        this.snippets = removeSnippetById(this.snippets, snippet.id)
        writeSnippets(LocalStorage, this.loggedInUser, this.snippets)
        this.refreshStorageUsage()
        if (this.snippetId === snippet.id) this.resetSnippetForm()
        this.$q.notify({ message: 'Snippet deleted' })
      })
    },
    insertSnippet (snippet) {
      if (!snippet) return
      this.snippetsOpen = false
      this.insertTextAtSelection(snippet.body)
    },
    insertTextAtSelection (text) {
      if (!this.draft || !text) return
      const element = this.$refs.body
      const start = element ? element.selectionStart : this.draft.body.length
      const end = element ? element.selectionEnd : this.draft.body.length
      const before = this.draft.body.slice(0, start)
      const after = this.draft.body.slice(end)
      const lead = before && !before.endsWith('\n\n') ? (before.endsWith('\n') ? '\n' : '\n\n') : ''
      const trail = after && !after.startsWith('\n\n') ? (after.startsWith('\n') ? '\n' : '\n\n') : ''
      const inserted = lead + text + trail
      if (this.mode === 'preview') this.mode = 'write'
      this.replaceBody({
        text: before + inserted + after,
        start: start + inserted.length,
        end: start + inserted.length
      })
    },
    openTemplates () {
      this.loadTemplates()
      this.templateName = ''
      this.templateSummary = ''
      this.templateError = ''
      this.templatesOpen = true
    },
    saveCurrentAsTemplate () {
      if (!this.draft) return
      const name = this.templateName.trim()
      if (!name) {
        this.templateError = 'Give the template a name.'
        return
      }
      if (!this.draft.title.trim() && !this.draft.body.trim()) {
        this.templateError = 'Write a title or body before saving a template.'
        return
      }
      const template = templateFromDraft(this.draft, {
        name,
        summary: this.templateSummary,
        owner: this.loggedInUser || null
      })
      this.templates = upsertTemplate(this.templates, template)
      if (!writeTemplates(LocalStorage, this.loggedInUser, this.templates)) {
        this.templateError = 'Could not save the template. Browser storage is unavailable.'
        return
      }
      this.refreshStorageUsage()
      this.templateName = ''
      this.templateSummary = ''
      this.templateError = ''
      this.$q.notify({ type: 'positive', message: 'Template saved' })
    },
    applyTemplate (template) {
      if (!template || !this.draft) return
      const apply = () => {
        this.draft = applyTemplateToDraft(template, this.draft)
        this.previewBody = this.draft.body
        this.mode = 'write'
        this.templatesOpen = false
        this.$q.notify({ type: 'positive', message: 'Template applied', caption: template.name })
      }
      if (this.draft.title.trim() || this.draft.body.trim()) {
        this.$q.dialog({
          title: 'Replace this draft?',
          message: 'Applying “' + template.name + '” replaces the current title, body and publishing options.',
          cancel: { label: 'Cancel', flat: true },
          ok: { label: 'Apply template', color: 'primary', unelevated: true },
          persistent: true
        }).onOk(apply)
        return
      }
      apply()
    },
    deleteTemplate (template) {
      if (!template) return
      this.$q.dialog({
        title: 'Delete this template?',
        message: '“' + template.name + '” will be removed from this browser.',
        cancel: { label: 'Cancel', flat: true },
        ok: { label: 'Delete template', color: 'negative', unelevated: true },
        persistent: true
      }).onOk(() => {
        this.templates = removeTemplateById(this.templates, template.id)
        writeTemplates(LocalStorage, this.loggedInUser, this.templates)
        this.refreshStorageUsage()
        this.$q.notify({ message: 'Template deleted' })
      })
    },
    isPinnedDraft (id) {
      return this.pinnedDraftIds.includes(id)
    },
    toggleDraftPin (draft) {
      if (!draft) return
      this.pinnedDraftIds = togglePinnedDraftId(LocalStorage, this.loggedInUser, draft.id)
      writePinnedDraftIds(LocalStorage, this.loggedInUser, this.pinnedDraftIds)
    },
    duplicateDraft (draft) {
      if (!draft) return
      const copy = createDraft({
        ...draft,
        id: null,
        owner: this.loggedInUser || draft.owner || null,
        title: (draft.title || draftDisplayTitle(draft)) + ' (copy)',
        createdAt: Date.now(),
        updatedAt: Date.now(),
        editing: null
      })
      this.drafts = upsertDraft(this.drafts, copy)
      writeDrafts(LocalStorage, this.drafts)
      this.refreshStorageUsage()
      this.draftView = 'active'
      this.selectDraft(copy.id)
      this.$q.notify({ type: 'positive', message: 'Draft duplicated' })
    },
    copyPublishedLink () {
      if (!this.publishedInfo) return
      copyToClipboard(this.publishedInfo.url)
        .then(() => this.$q.notify({ type: 'positive', message: 'Post link copied' }))
        .catch(() => this.$q.notify({ type: 'negative', message: 'Could not copy the link' }))
    },
    openDraftHistory () {
      if (!this.draft) return
      const history = readDraftHistory(LocalStorage)
      this.draftHistory = history[this.draft.id] || []
      this.historyOpen = true
    },
    saveVersionNow () {
      if (!this.draft) return
      const history = appendDraftHistory(LocalStorage, this.draft, { force: true })
      this.draftHistory = history[this.draft.id] || []
      this.refreshStorageUsage()
      this.$q.notify({ type: 'positive', message: 'Version saved', caption: 'You can restore it from Draft history.' })
    },
    restoreHistory (snapshot) {
      if (!snapshot || !this.draft) return
      this.$q.dialog({
        title: 'Restore this version?',
        message: 'The current title, body and publishing options will be replaced by the saved version.',
        cancel: { label: 'Cancel', flat: true },
        ok: { label: 'Restore version', color: 'primary', unelevated: true },
        persistent: true
      }).onOk(() => {
        this.draft = restoreDraftSnapshot(snapshot, this.draft)
        this.previewBody = this.draft.body
        this.mode = 'write'
        this.historyOpen = false
        this.$q.notify({ type: 'positive', message: 'Version restored' })
      })
    },
    clearCurrentDraftHistory () {
      if (!this.draft) return
      this.$q.dialog({
        title: 'Clear draft history?',
        message: 'Saved versions for this draft will be removed. The current draft is not affected.',
        cancel: { label: 'Cancel', flat: true },
        ok: { label: 'Clear history', color: 'negative', unelevated: true },
        persistent: true
      }).onOk(() => {
        removeDraftHistory(LocalStorage, this.draft.id)
        this.draftHistory = []
        this.refreshStorageUsage()
        this.$q.notify({ message: 'Draft history cleared' })
      })
    },
    formatHistoryTime (value) {
      return value ? moment.utc(value).fromNow() : ''
    },
    exportSnippets () {
      if (!this.snippets.length) {
        this.$q.notify({ message: 'There are no snippets to export yet.' })
        return
      }
      const status = exportFile(
        'hive-snippets-' + moment().format('YYYY-MM-DD') + '.json',
        serializeSnippetExport(this.snippets),
        'application/json'
      )
      if (status === true) this.$q.notify({ type: 'positive', message: 'Snippets exported' })
      else this.$q.notify({ type: 'negative', message: 'Could not export snippets', caption: String(status) })
    },
    triggerSnippetImport () {
      this.$refs.snippetImportInput?.click()
    },
    async onSnippetImportFile (event) {
      const input = event.target
      const file = input.files && input.files[0]
      input.value = ''
      if (!file) return
      try {
        const parsed = parseSnippetExport(await file.text(), { owner: this.loggedInUser })
        if (parsed.error) {
          this.$q.notify({ type: 'negative', message: 'Snippet import failed', caption: parsed.error })
          return
        }
        const merged = mergeSnippets(this.snippets, parsed.snippets, { owner: this.loggedInUser })
        this.snippets = merged.snippets
        if (!writeSnippets(LocalStorage, this.loggedInUser, this.snippets)) {
          this.$q.notify({ type: 'negative', message: 'Could not save imported snippets' })
          return
        }
        this.refreshStorageUsage()
        this.$q.notify({
          type: 'positive',
          message: 'Snippets imported',
          caption: merged.added + ' added · ' + merged.updated + ' updated' + (merged.skipped ? ' · ' + merged.skipped + ' skipped' : '')
        })
      } catch (error) {
        this.$q.notify({ type: 'negative', message: 'Could not read that file', caption: error.message })
      }
    },
    exportTemplates () {
      if (!this.templates.length) {
        this.$q.notify({ message: 'There are no saved templates to export yet.' })
        return
      }
      const status = exportFile(
        'hive-templates-' + moment().format('YYYY-MM-DD') + '.json',
        serializeTemplateExport(this.templates),
        'application/json'
      )
      if (status === true) this.$q.notify({ type: 'positive', message: 'Templates exported' })
      else this.$q.notify({ type: 'negative', message: 'Could not export templates', caption: String(status) })
    },
    triggerTemplateImport () {
      this.$refs.templateImportInput?.click()
    },
    async onTemplateImportFile (event) {
      const input = event.target
      const file = input.files && input.files[0]
      input.value = ''
      if (!file) return
      try {
        const parsed = parseTemplateExport(await file.text(), { owner: this.loggedInUser })
        if (parsed.error) {
          this.$q.notify({ type: 'negative', message: 'Template import failed', caption: parsed.error })
          return
        }
        const merged = mergeTemplates(this.templates, parsed.templates, { owner: this.loggedInUser })
        this.templates = merged.templates
        if (!writeTemplates(LocalStorage, this.loggedInUser, this.templates)) {
          this.$q.notify({ type: 'negative', message: 'Could not save imported templates' })
          return
        }
        this.refreshStorageUsage()
        this.$q.notify({
          type: 'positive',
          message: 'Templates imported',
          caption: merged.added + ' added · ' + merged.updated + ' updated' + (merged.skipped ? ' · ' + merged.skipped + ' skipped' : '')
        })
      } catch (error) {
        this.$q.notify({ type: 'negative', message: 'Could not read that file', caption: error.message })
      }
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
    copyMetadataPreview () {
      copyToClipboard(this.metadataPreview)
        .then(() => this.$q.notify({ type: 'positive', message: 'json_metadata copied' }))
        .catch(() => this.$q.notify({ type: 'negative', message: 'Could not copy the metadata' }))
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
      this.uploadItems = []
      this.uploadAbort = null
      this.uploadRunCancelled = false
      this.uploadError = ''
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
      this.uploadItems = []
      this.uploadError = ''
    },
    uploadSizeLabel (size) {
      return formatUploadBytes(size)
    },
    uploadRecentMeta (entry) {
      return [formatUploadBytes(entry?.size), formatUploadAge(entry?.uploadedAt)].filter(Boolean).join(' · ')
    },
    uploadStatusLabel (item) {
      switch (item?.status) {
        case 'queued': return 'Ready'
        case 'signing': return 'Waiting for signature…'
        case 'uploading': return item.progress ? 'Uploading · ' + item.progress + '%' : 'Uploading…'
        case 'done': return 'Uploaded'
        case 'cancelled': return 'Cancelled'
        case 'error': return 'Failed'
        default: return ''
      }
    },
    uploadStatusIcon (item) {
      switch (item?.status) {
        case 'queued': return 'schedule'
        case 'signing': return 'draw'
        case 'uploading': return 'cloud_upload'
        case 'done': return 'check_circle'
        case 'cancelled': return 'block'
        case 'error': return 'error_outline'
        default: return 'image'
      }
    },
    canRetryUpload (item) {
      return !this.uploadBusy && (item?.status === 'error' || item?.status === 'cancelled')
    },
    cancelUploadItem (item) {
      item.status = 'cancelled'
      item.error = ''
      item.progress = 0
    },
    removeUploadItem (item) {
      this.uploadItems = this.uploadItems.filter(entry => entry.id !== item.id)
    },
    async copyUploadUrl (entry) {
      const url = String(entry?.url || '')
      if (!url) return
      try {
        if (navigator.clipboard?.writeText) {
          await navigator.clipboard.writeText(url)
        } else {
          const field = document.createElement('textarea')
          field.value = url
          field.setAttribute('readonly', 'readonly')
          field.style.position = 'fixed'
          field.style.opacity = '0'
          document.body.appendChild(field)
          field.select()
          const copied = document.execCommand?.('copy')
          document.body.removeChild(field)
          if (!copied) throw new Error('Clipboard is unavailable.')
        }
        this.$q.notify({ type: 'positive', message: 'Image URL copied', caption: url })
      } catch {
        this.$q.notify({ type: 'negative', message: 'Could not copy the image URL' })
      }
    },
    promptSmartlockPassword () {
      return new Promise(resolve => {
        this.$q.dialog({
          title: 'Unlock SmartLock',
          message: 'Enter the SmartLock password to sign the image upload.',
          prompt: { model: '', type: 'password', outlined: true, label: 'Password' },
          cancel: true,
          persistent: true
        }).onOk(resolve).onCancel(() => resolve(''))
      })
    },
    async signImagePayload (payload) {
      const minutes = Number(this.$hiveStore.user.settings.smartlockSessionMinutes) || 15
      return signImageUploadChallenge({
        username: this.loggedInUser,
        loginType: this.loginType,
        payload,
        smartlockSessionMs: minutes * 60 * 1000,
        promptPassword: () => this.promptSmartlockPassword()
      })
    },
    async uploadSelectedImages () {
      if (this.uploadBusy) return
      if (!this.uploadFiles.length) {
        this.uploadError = 'Choose at least one image.'
        return
      }
      if (!this.canUpload) {
        this.uploadError = 'Log in with Keychain, SmartLock or HiveAuth to upload images.'
        return
      }
      const items = createUploadQueue(this.uploadFiles, { target: this.uploadTarget })
      const single = items.length === 1
      for (const item of items) {
        item.alt = single
          ? (this.uploadAlt.trim() || altFromFileName(item.name))
          : altFromFileName(item.name)
      }
      this.uploadItems = items
      this.uploadFiles = []
      this.uploadAlt = ''
      this.uploadError = ''
      // Work with the reactive proxies so per-file status, progress and errors
      // update the dialog while the queue runs.
      await this.runUploadQueue(this.uploadItems)
    },
    cancelUploadRun () {
      if (!this.uploadBusy) return
      this.uploadRunCancelled = true
      try {
        this.uploadAbort?.abort()
      } catch {
        // The run's loop still observes the cancel flag.
      }
      for (const item of this.uploadItems) {
        if (item.status === 'queued') this.cancelUploadItem(item)
      }
    },
    async retryUploadItem (item) {
      if (this.uploadBusy || !this.canUpload) return
      item.status = 'queued'
      item.error = ''
      item.progress = 0
      item.url = ''
      await this.runUploadQueue([item])
    },
    async retryFailedUploads () {
      if (this.uploadBusy) return
      const targets = this.uploadItems.filter(item => item.status === 'error' || item.status === 'cancelled')
      if (!targets.length) return
      for (const item of targets) {
        item.status = 'queued'
        item.error = ''
        item.progress = 0
        item.url = ''
      }
      await this.runUploadQueue(targets)
    },
    async runUploadQueue (items) {
      if (!items.length) return
      const controller = typeof AbortController === 'function' ? new AbortController() : null
      this.uploadAbort = controller
      this.uploadRunCancelled = false
      this.uploadError = ''
      try {
        for (const item of items) {
          if (this.uploadRunCancelled) {
            this.cancelUploadItem(item)
            continue
          }
          item.status = 'signing'
          item.progress = 0
          item.error = ''
          try {
            const validation = validateImageFile(item.file)
            if (!validation.ok) throw new Error(validation.error)
            const bytes = await readImageBytes(item.file)
            if (this.uploadRunCancelled) {
              this.cancelUploadItem(item)
              continue
            }
            // HiveAuth cannot send the full image through the HAS relay (the
            // relay closes messages around 250 KB). Use the image host's
            // checksum endpoint instead, which signs only a 47-byte challenge.
            const checksum = this.loginType === 'hiveauth'
            const payload = checksum
              ? await buildImageChecksumSigningPayload(bytes)
              : buildImageSigningPayload(bytes)
            const signature = await this.signImagePayload(payload)
            if (this.uploadRunCancelled) {
              this.cancelUploadItem(item)
              continue
            }
            item.status = 'uploading'
            const url = await uploadImage({
              username: this.loggedInUser,
              signature,
              file: item.file,
              checksum,
              signal: controller ? controller.signal : null,
              onProgress: value => { item.progress = value }
            })
            if (this.uploadRunCancelled) {
              this.cancelUploadItem(item)
              continue
            }
            item.url = url
            item.progress = 100
            item.status = 'done'
            const alt = item.alt || altFromFileName(item.name)
            item.alt = alt
            this.recentUploads = appendUploadHistory(LocalStorage, this.loggedInUser, {
              url,
              alt,
              name: item.name,
              size: item.size,
              type: item.type
            })
          } catch (error) {
            if (this.uploadRunCancelled || isUploadAborted(error)) {
              this.cancelUploadItem(item)
              continue
            }
            if (/cancelled|canceled/i.test(String(error?.message || ''))) {
              this.cancelUploadItem(item)
              this.uploadRunCancelled = true
              continue
            }
            item.status = 'error'
            item.progress = 0
            item.error = imageHostErrorMessage(error)
          }
        }
      } finally {
        this.uploadAbort = null
      }
      this.finishUploadRun(items)
    },
    finishUploadRun (items) {
      const done = items.filter(item => item.status === 'done')
      if (this.uploadTarget === 'cover') {
        if (done[0]) {
          this.draft.coverImage = done[0].url
          this.$q.notify({ type: 'positive', message: 'Cover image uploaded' })
        }
      } else if (done.length) {
        this.insertUploadedImages(done.map(item => ({
          url: item.url,
          alt: item.alt || altFromFileName(item.name)
        })))
        this.$q.notify({
          type: 'positive',
          message: done.length > 1 ? done.length + ' images uploaded' : 'Image uploaded',
          caption: 'Inserted into the post.'
        })
      }
      const summary = uploadQueueSummary(this.uploadItems)
      if (summary.failed) {
        this.uploadError = summary.failed +
          (summary.failed === 1 ? ' image failed to upload. Retry it below.' : ' images failed to upload. Retry them below.')
        return
      }
      if (summary.cancelled) return
      if (summary.total && summary.done === summary.total) {
        this.uploadDialogOpen = false
        this.uploadItems = []
        this.uploadFiles = []
        this.uploadAlt = ''
        this.uploadError = ''
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
      const files = imageFilesFromTransfer(event.clipboardData)
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
      const files = imageFilesFromTransfer(event.dataTransfer)
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
      this.uploadItems = []
      this.uploadAbort = null
      this.uploadRunCancelled = false
      this.uploadError = ''
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
        alsoReblog: draft.alsoReblog,
        crossPost: draft.crossPost,
        beneficiaries: draft.beneficiaries,
        rewards: draft.rewards,
        aiTools: draft.aiTools,
        countdown: draft.countdown,
        portfolio: draft.portfolio,
        collection: draft.collection,
        authorDisplay: draft.authorDisplay,
        scheduledAt: draft.scheduledAt
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
      const existing = this.drafts.find(item => item.id === this.draft.id)
      if (existing) {
        appendDraftHistory(LocalStorage, existing, {
          now,
          force: !silent,
          current: saved
        })
      }
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
      this.refreshStorageUsage()
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
      this.draftView = 'active'
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
      removeDraftHistory(LocalStorage, target.id)
      this.pinnedDraftIds = this.pinnedDraftIds.filter(id => id !== target.id)
      writePinnedDraftIds(LocalStorage, this.loggedInUser, this.pinnedDraftIds)
      this.refreshStorageUsage()
      if (this.draft && this.draft.id === target.id) {
        this.setActiveDraft(this.drafts[0] || this.blankDraft())
        this.$router.replace({ name: 'compose', params: this.drafts[0] ? { draftId: this.drafts[0].id } : {} }).catch(() => {})
      }
      this.$q.notify({ message: 'Draft discarded' })
    },
    setCommunity (value) {
      const tag = normalizeTag(value)
      this.draft.community = tag
      if (tag) this.rememberCommunity(tag)
    },
    addCommunity (value, done) {
      const tag = normalizeTag(value)
      if (!tag) {
        this.$q.notify({ message: 'Use lowercase letters, numbers and hyphens for a community tag.' })
        return
      }
      this.rememberCommunity(tag)
      done(tag)
    },
    setTags (value) {
      const tags = normalizeTags(value)
      if (Array.isArray(value) && value.length > MAX_TAGS) {
        this.$q.notify({ message: 'Up to ' + MAX_TAGS + ' tags are kept. Extra tags were dropped.' })
      }
      this.draft.tags = tags
      this.rememberTags(tags)
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
      this.rememberTags([tag])
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
        this.$q.notify({ type: 'negative', message: 'Log in with Keychain, SmartLock or HiveAuth to publish.' })
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
        this.$q.notify({ type: 'negative', message: 'Log in with Keychain, SmartLock or HiveAuth to publish.' })
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
        const alsoReblog = Boolean(!editing && this.postingToCommunity && this.draft.alsoReblog)
        const item = postQueueItem({
          username: this.loggedInUser,
          draft: this.draft,
          permlink,
          // An edit keeps the original parent and does not resend comment options.
          parentPermlink: editing ? editing.parentPermlink : null,
          parentAuthor: editing ? editing.parentAuthor : '',
          commentOptions: !editing,
          previousMetadata: editing ? editing.previousMetadata : null,
          alsoReblog
        })
        this.$hiveStore.addToQueue(item)
        this.rememberTags(this.draft.tags)
        this.rememberCommunity(this.draft.community)
        this.publishedInfo = {
          author: this.loggedInUser,
          permlink,
          editing: Boolean(editing),
          alsoReblog,
          url: 'https://hive.ausbit.dev/@' + this.loggedInUser + '/' + permlink
        }
        this.publishedOpen = true

        if (editing) {
          // Keep the local draft around so a failed edit can be retried, but
          // stop autosaving it as a fresh draft.
          this.lastSavedSnapshot = this.snapshotDraft(this.draft)
        } else {
          this.drafts = removeDraftById(this.drafts, this.draft.id)
          writeDrafts(LocalStorage, this.drafts)
          removeDraftHistory(LocalStorage, this.draft.id)
          this.pinnedDraftIds = this.pinnedDraftIds.filter(id => id !== this.draft.id)
          writePinnedDraftIds(LocalStorage, this.loggedInUser, this.pinnedDraftIds)
          this.refreshStorageUsage()
          this.lastSavedSnapshot = ''
          this.setActiveDraft(this.blankDraft())
          this.$router.replace({ name: 'compose', params: {} }).catch(() => {})
        }

        this.$q.notify({
          type: isOnline() ? 'positive' : 'warning',
          message: isOnline()
            ? (editing
                ? 'Edit queued for signing'
                : (alsoReblog ? 'Post and blog reblog queued for signing' : 'Post queued for signing'))
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
        this.refreshStorageUsage()
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
