<template>
  <q-page class="vault-page">
    <div class="vault-shell">
      <nav class="vault-crumb" aria-label="Breadcrumb">
        <router-link to="/settings/blog">Blog settings</router-link>
        <span aria-hidden="true">/</span>
        <span>Vault</span>
      </nav>

      <header class="vault-head">
        <p class="vault-kicker">Banksia Vault</p>
        <h1 class="vault-title">Creator dashboard{{ accountName ? ' — @' + accountName : '' }}</h1>
        <p class="vault-muted">
          See who supports your blog, give members access, and share your
          membership page. Payments go straight to you; Banksia never holds your
          funds, plaintext or private keys.
        </p>
      </header>

      <div v-if="!loggedInUser" class="vault-state">
        <q-icon name="login" size="28px" />
        <h2>Sign in to open your dashboard</h2>
        <p>Use the sign-in button in the top bar. The dashboard needs your session to sign bulletins.</p>
      </div>

      <div v-else-if="loading" class="vault-grid" aria-busy="true" aria-label="Loading Vault dashboard">
        <q-card v-for="n in 4" :key="n" flat bordered class="vault-card">
          <q-card-section>
            <q-skeleton type="rect" height="18px" width="45%" />
            <q-skeleton type="rect" height="12px" width="70%" class="q-mt-md" />
          </q-card-section>
        </q-card>
      </div>

      <div v-else-if="error" class="vault-state" role="alert">
        <h2>Dashboard unavailable</h2>
        <p>{{ error }}</p>
        <q-btn outline no-caps color="primary" label="Try again" @click="load" />
      </div>

      <div v-else-if="!configured" class="vault-state">
        <q-icon name="lock_open" size="28px" />
        <h2>Vault is not configured for this blog</h2>
        <p>Enable Vault, publish the membership product and the grant container, then come back.</p>
        <q-btn unelevated no-caps color="primary" label="Open blog settings" :to="setupPath" />
      </div>

      <template v-else>
        <q-banner v-if="!isOwner" rounded class="vault-banner">
          <template #avatar><q-icon name="visibility" /></template>
          You are viewing @{{ accountName }} read-only. Sign in as that account to unlock the vault or issue grants.
        </q-banner>

        <q-card v-if="isOwner" flat bordered class="vault-card vault-auto">
          <q-card-section>
            <div class="vault-auto__head">
              <div>
                <h2 class="vault-section-title vault-section-title--flush">Give access automatically</h2>
                <p class="vault-muted">
                  While this dashboard tab is open, check payments every
                  {{ autoIssueBatch }} seconds and queue access for new members
                  automatically. Your vault must stay unlocked. Background tabs may
                  be slowed down by the browser.
                </p>
              </div>
              <q-toggle
                v-model="autoIssue"
                color="primary"
                label="Give access while this tab is open"
              />
            </div>
            <q-select
              v-if="autoIssue"
              v-model="autoIssueBatch"
              :options="autoIssueBatchOptions"
              emit-value
              map-options
              dense
              outlined
              label="Batch window"
              class="vault-auto__batch"
            />
            <p v-if="!vault" class="vault-muted vault-muted--small">
              Unlock the vault below to start auto-issuing.
            </p>
            <p v-else-if="autoIssue" class="vault-muted vault-muted--small">
              Watching for new payments. Keychain may still ask you to approve each
              bulletin; SmartLock can sign without a prompt while unlocked.
            </p>
            <p v-if="autoIssueNotice" class="vault-muted vault-auto__ok" role="status">{{ autoIssueNotice }}</p>
            <p v-if="autoIssueError" class="vault-error" role="alert">{{ autoIssueError }}</p>
          </q-card-section>
        </q-card>

        <q-banner v-if="actionNotice" rounded class="vault-banner vault-banner--ok" aria-live="polite">
          <template #avatar><q-icon name="check_circle" /></template>
          {{ actionNotice }}
        </q-banner>
        <q-banner v-if="actionError" rounded class="vault-banner vault-banner--warning" role="alert">
          <template #avatar><q-icon name="error_outline" /></template>
          {{ actionError }}
        </q-banner>

        <section aria-labelledby="vault-overview-title">
          <h2 id="vault-overview-title" class="vault-section-title">Overview</h2>
          <div class="vault-grid">
            <q-card flat bordered class="vault-card">
              <q-card-section>
                <p class="vault-metric-label">Active members</p>
                <p class="vault-metric">{{ summary.active }}</p>
              </q-card-section>
            </q-card>
            <q-card flat bordered class="vault-card">
              <q-card-section>
                <p class="vault-metric-label">Monthly recurring</p>
                <p class="vault-metric">{{ summary.mrr.toFixed(3) }} HBD</p>
              </q-card-section>
            </q-card>
            <q-card flat bordered class="vault-card">
              <q-card-section>
                <p class="vault-metric-label">New this period</p>
                <p class="vault-metric">{{ newThisPeriod }}</p>
              </q-card-section>
            </q-card>
            <q-card flat bordered class="vault-card">
              <q-card-section>
                <p class="vault-metric-label">Renewals due in 7 days</p>
                <p class="vault-metric">{{ summary.expiring }}</p>
              </q-card-section>
            </q-card>
            <q-card flat bordered class="vault-card">
              <q-card-section>
                <p class="vault-metric-label">Failed / expired</p>
                <p class="vault-metric">{{ summary.expired }}</p>
              </q-card-section>
            </q-card>
            <q-card flat bordered class="vault-card">
              <q-card-section>
                <p class="vault-metric-label">Last bulletin</p>
                <p class="vault-metric vault-metric--small">{{ lastBulletinLabel }}</p>
              </q-card-section>
            </q-card>
          </div>
          <p v-if="planError" class="vault-error" role="alert">{{ planError }}</p>
          <p v-else-if="plan" class="vault-muted">
            Plan @{{ plan.author }} · {{ plan.priceLabel }} {{ recurrencePhrase }} · {{ plan.executions }} payments.
          </p>
        </section>

        <section v-if="!vault" aria-labelledby="vault-unlock-title">
          <h2 id="vault-unlock-title" class="vault-section-title">Unlock the vault</h2>
          <q-card flat bordered class="vault-card vault-card--pad">
            <q-card-section>
              <p class="vault-muted">
                The vault is encrypted on this device. Enter the passphrase to
                decrypt it into memory for this session. It is never stored by
                this page.
              </p>
              <form class="vault-inline-form" @submit.prevent="unlock">
                <q-input
                  v-model="passphrase"
                  type="password"
                  outlined
                  dense
                  label="Vault passphrase"
                  autocomplete="current-password"
                  class="vault-input"
                />
                <q-btn type="submit" unelevated no-caps color="primary" label="Unlock vault" :loading="busy === 'unlock'" />
              </form>
              <p v-if="unlockError" class="vault-error" role="alert">{{ unlockError }}</p>
              <p class="vault-muted vault-muted--small">
                No local vault? Generate one in <router-link :to="setupPath">blog settings</router-link>.
              </p>
            </q-card-section>
          </q-card>
        </section>

        <q-banner v-if="pendingCount" rounded class="vault-banner vault-banner--pending">
          <template #avatar><q-icon name="notifications_active" /></template>
          <strong>{{ pendingCount }}</strong>
          {{ pendingCount === 1 ? 'new member needs' : 'new members need' }} access.
          <q-btn
            flat
            no-caps
            color="primary"
            label="Give access now"
            :disable="!vault || !isOwner || !plan || busy === 'issue'"
            :loading="busy === 'issue'"
            @click="issuePending"
          />
        </q-banner>

        <section aria-labelledby="vault-share-title">
          <h2 id="vault-share-title" class="vault-section-title">Share your membership</h2>
          <q-card flat bordered class="vault-card vault-share">
            <q-card-section>
              <p class="vault-muted">
                Send readers to your membership page, or share the subscribe link
                directly. Both open the page that collects the payment and issues access.
              </p>
              <div class="vault-share__row">
                <code>{{ membershipPageUrl }}</code>
                <q-btn dense no-caps outline color="primary" label="Copy page link" @click="copyText(membershipPageUrl)" />
                <q-btn dense no-caps flat color="primary" label="Open page" :to="membershipPagePath" />
              </div>
              <div v-if="subscribeShareUrl" class="vault-share__row">
                <code>{{ subscribeShareUrl }}</code>
                <q-btn dense no-caps outline color="primary" label="Copy subscribe link" @click="copyText(subscribeShareUrl)" />
              </div>
            </q-card-section>
          </q-card>
        </section>

        <section aria-labelledby="vault-subscribers-title">
          <h2 id="vault-subscribers-title" class="vault-section-title">Subscribers</h2>
          <q-card flat bordered class="vault-card">
            <q-card-section>
              <div class="vault-toolbar">
                <div>
                  <p class="vault-muted vault-muted--flush">
                    {{ rows.length }} subscriber{{ rows.length === 1 ? '' : 's' }} · {{ selected.length }} selected
                  </p>
                  <p v-if="historyTruncated" class="vault-error" role="alert">
                    Scanned {{ historyScanned }} history rows and hit the page cap. Older payments may be missing; use a HAF index for very high-volume accounts.
                  </p>
                </div>
                <q-btn
                  flat
                  dense
                  no-caps
                  icon="refresh"
                  label="Refresh"
                  :loading="busy === 'refresh'"
                  @click="load"
                />
              </div>
              <div class="vault-table-wrap">
                <table class="vault-table">
                  <caption class="vault-visually-hidden">Subscribers derived from verified payments</caption>
                  <thead>
                    <tr>
                      <th scope="col"><span class="vault-visually-hidden">Select</span></th>
                      <th scope="col">Account</th>
                      <th scope="col">Reader key</th>
                      <th scope="col">Plan</th>
                      <th scope="col">Last payment</th>
                      <th scope="col">Next payment</th>
                      <th scope="col">Grant</th>
                      <th scope="col">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr v-for="row in rows" :key="row.readerKey + ':' + row.account">
                      <td>
                        <q-checkbox
                          v-model="selected"
                          :val="row.readerKey"
                          color="primary"
                          :aria-label="'Select @' + row.account"
                        />
                      </td>
                      <td>@{{ row.account }}</td>
                      <td>
                        <code>{{ shortKey(row.rkt) }}</code>
                        <span v-if="row.devices && row.devices.length > 1" class="vault-muted">
                          +{{ row.devices.length - 1 }} device{{ row.devices.length > 2 ? 's' : '' }}
                        </span>
                      </td>
                      <td>{{ row.plan }}</td>
                      <td>{{ shortDate(row.lastPayment) }}</td>
                      <td>{{ row.nextPayment ? shortDate(row.nextPayment) : 'one-off' }}</td>
                      <td>
                        <span class="vault-pill" :class="'vault-pill--' + row.grantStatus">{{ grantLabel(row) }}</span>
                      </td>
                      <td>
                        <div class="vault-row-actions">
                          <q-btn flat dense no-caps size="sm" label="Re-issue" @click="selectForReissue(row)" />
                          <q-btn flat dense no-caps size="sm" label="Copy cancel link" @click="copyCancelLink(row)" />
                          <q-btn flat dense no-caps size="sm" label="Copy reader key" @click="copyText(row.readerKey)" />
                        </div>
                      </td>
                    </tr>
                    <tr v-if="!rows.length">
                      <td colspan="8" class="vault-empty">
                        No members yet. Share your membership page above; a row
                        appears here after a reader’s first verified payment.
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </q-card-section>
          </q-card>
        </section>

        <section aria-labelledby="vault-bulletins-title">
          <h2 id="vault-bulletins-title" class="vault-section-title">Bulletins</h2>
          <q-card flat bordered class="vault-card">
            <q-card-section>
              <dl class="vault-facts">
                <div><dt>Current period</dt><dd>{{ period || '—' }}</dd></div>
                <div><dt>Current sequence</dt><dd>{{ currentSequence }}</dd></div>
                <div><dt>Next sequence</dt><dd>{{ nextSequence }}</dd></div>
                <div><dt>Entries</dt><dd>{{ bulletinEntries.length }}</dd></div>
                <div><dt>Strategy</dt><dd>{{ bulletinStrategy }}</dd></div>
                <div v-if="bulletinShardCount"><dt>Shards</dt><dd>{{ bulletinShardCount }}</dd></div>
                <div><dt>Est. per change</dt><dd>{{ estimatedIssueLabel }}</dd></div>
                <div><dt>Size</dt><dd>{{ bulletinBytes }} bytes</dd></div>
                <div><dt>Pending grants</dt><dd>{{ pendingCount }}</dd></div>
                <div><dt>Signer</dt><dd>@{{ accountName }}</dd></div>
              </dl>
              <p v-if="bulletinWarning" class="vault-error" role="alert">{{ bulletinWarning }}</p>
              <p v-if="!bulletinShardCount && grantTargetCount > 250" class="vault-error" role="alert">
                This issue targets {{ grantTargetCount }} entries. A single bulletin is capped at
                300 entries and about 60 KB; larger issuances switch to signed shards automatically.
              </p>
              <p v-if="bulletinTooLarge" class="vault-error" role="alert">This bulletin is too large for one comment. Split it into parts before publishing.</p>
              <p v-if="!vault" class="vault-muted">Unlock the vault to wrap the ring key and issue grants.</p>
              <div class="vault-actions">
                <q-btn
                  unelevated
                  no-caps
                  color="primary"
                  label="Issue grants"
                  :disable="!vault || !isOwner || !plan || busy === 'issue'"
                  :loading="busy === 'issue'"
                  @click="issueGrants"
                />
                <q-btn flat no-caps label="Refresh bulletins" :loading="busy === 'refresh'" @click="load" />
              </div>
              <p class="vault-muted vault-muted--small">
                Issuing writes one signed <code>comment</code> under
                <code>@{{ accountName }}/{{ vaultSettings.container }}</code> and queues an
                <code>account_update2</code> for the bulletin pointer. Both use the posting key.
              </p>
            </q-card-section>
          </q-card>
        </section>

        <details class="vault-advanced-tools">
          <summary>Advanced tools</summary>
          <p class="vault-muted vault-muted--small">
            Relay uptime, key rotation and encrypted backups. You do not need any of
            these to start selling memberships.
          </p>

        <section aria-labelledby="vault-relay-title">
          <h2 id="vault-relay-title" class="vault-section-title">Relay (optional)</h2>
          <q-card flat bordered class="vault-card">
            <q-card-section>
              <p class="vault-muted">
                A relay posts signed grants from its own Hive account while this
                dashboard is offline. It never receives your posting or active key
                and cannot move funds. Readers still work without it, and revoking
                it leaves the normal paywall.
              </p>
              <dl class="vault-facts">
                <div><dt>Status</dt><dd>{{ relayCertStatus.state }}</dd></div>
                <div><dt>Relay account</dt><dd>{{ relayAccount ? '@' + relayAccount : 'not configured' }}</dd></div>
                <div><dt>Posting key</dt><dd><code>{{ relayPublicKey || '—' }}</code></dd></div>
                <div><dt>Expires</dt><dd>{{ relayCertStatus.expiresAt ? shortDate(relayCertStatus.expiresAt) : '—' }}</dd></div>
                <div><dt>Latest delegated bulletin</dt><dd>{{ relayLatestLabel }}</dd></div>
              </dl>
              <p v-if="relayCertStatus.reason" class="vault-muted vault-muted--small">
                Certificate state: {{ relayCertStatus.reason }}. Delegated bulletins are ignored in this state.
              </p>

              <div v-if="!relaySettings" class="vault-subsection">
                <h3 class="vault-subtitle">Authorise a relay</h3>
                <form class="vault-inline-form" @submit.prevent="generateRelayCertificate">
                  <q-input
                    v-model="relayAccount"
                    outlined
                    dense
                    label="Dedicated relay Hive account"
                    hint="The relay's posting key is read from its on-chain authority; never enter a private key here."
                    class="vault-input"
                  />
                  <q-btn type="submit" unelevated no-caps color="primary" label="Create certificate" :disable="!isOwner" :loading="busy === 'relay'" />
                </form>
              </div>

              <div v-else class="vault-subsection">
                <h3 class="vault-subtitle">Relay bundle</h3>
                <p class="vault-muted">
                  Export one encrypted file containing this period's keyring and ring key.
                  The operator imports it with the passphrase below. Anyone with both can
                  read the archive and issue free grants, so treat the file and passphrase
                  as creator-level secrets.
                </p>
                <form class="vault-inline-form" @submit.prevent="exportRelayBundle">
                  <q-input
                    v-model="relayPassphrase"
                    type="password"
                    outlined
                    dense
                    label="Relay-bundle passphrase (12+ characters)"
                    autocomplete="new-password"
                    class="vault-input"
                  />
                  <q-btn type="submit" outline no-caps color="primary" label="Export relay bundle" :disable="!vault || !isOwner" :loading="busy === 'relay'" />
                </form>
                <div class="vault-actions">
                  <q-btn flat no-caps label="Re-issue certificate" :disable="!isOwner || busy === 'relay'" @click="generateRelayCertificate" />
                  <q-btn flat no-caps color="negative" label="Revoke relay" :disable="!isOwner || busy === 'relay'" @click="revokeRelayCertificate" />
                </div>
              </div>
              <p v-if="relayNotice" class="vault-muted vault-auto__ok" role="status">{{ relayNotice }}</p>
              <p v-if="relayError" class="vault-error" role="alert">{{ relayError }}</p>
            </q-card-section>
          </q-card>
        </section>

        <section aria-labelledby="vault-keys-title">
          <h2 id="vault-keys-title" class="vault-section-title">Keys</h2>
          <q-card flat bordered class="vault-card">
            <q-card-section>
              <dl class="vault-facts">
                <div><dt>Ring key</dt><dd><code>{{ maskedRingKey }}</code></dd></div>
                <div><dt>Ring period</dt><dd>{{ vault ? vault.ringKid : 'locked' }}</dd></div>
                <div><dt>Content keys</dt><dd>{{ kids.length ? kids.join(', ') : 'locked' }}</dd></div>
              </dl>

              <div class="vault-subsection">
                <h3 class="vault-subtitle">Rotate period</h3>
                <p class="vault-muted">A new content key and ring key for the next period. Old keys stay in the keyring for the archive.</p>
                <form class="vault-inline-form" @submit.prevent="rotate">
                  <q-input
                    v-model="rotatePassphrase"
                    type="password"
                    outlined
                    dense
                    label="Passphrase to save the rotated vault"
                    autocomplete="current-password"
                    class="vault-input"
                  />
                  <q-btn type="submit" unelevated no-caps color="primary" label="Rotate period" :disable="!vault || !isOwner" :loading="busy === 'rotate'" />
                </form>
              </div>

              <div class="vault-subsection">
                <h3 class="vault-subtitle">Backup</h3>
                <form class="vault-inline-form" @submit.prevent="exportVault">
                  <q-input
                    v-model="exportPassphrase"
                    type="password"
                    outlined
                    dense
                    label="Passphrase for the export"
                    autocomplete="current-password"
                    class="vault-input"
                  />
                  <q-btn type="submit" outline no-caps color="primary" label="Export encrypted vault" :disable="!vault || !isOwner" :loading="busy === 'export'" />
                </form>
                <div class="vault-import">
                  <label class="vault-import-label" for="vault-import-file">Import vault</label>
                  <input id="vault-import-file" type="file" accept="application/json,.json" @change="pickImportFile" />
                  <q-input
                    v-model="importPassphrase"
                    type="password"
                    outlined
                    dense
                    label="Passphrase for the import"
                    autocomplete="current-password"
                    class="vault-input"
                  />
                  <q-btn outline no-caps color="primary" label="Import vault" :disable="!importFile || !isOwner" :loading="busy === 'import'" @click="importVault" />
                </div>
                <p v-if="keyError" class="vault-error" role="alert">{{ keyError }}</p>
              </div>
            </q-card-section>
          </q-card>
        </section>

        </details>

        <section aria-labelledby="vault-content-title">
          <h2 id="vault-content-title" class="vault-section-title">Premium content</h2>
          <q-card flat bordered class="vault-card">
            <q-card-section>
              <div v-if="contentError" class="vault-error" role="alert">{{ contentError }}</div>
              <div v-else-if="contentLoading" class="vault-muted">Loading premium posts…</div>
              <div v-else-if="!premiumPosts.length" class="vault-muted">No premium posts found in the latest posts.</div>
              <div v-else class="vault-table-wrap">
                <table class="vault-table">
                  <caption class="vault-visually-hidden">Premium posts and their content key</caption>
                  <thead>
                    <tr>
                      <th scope="col">Post</th>
                      <th scope="col">Mode</th>
                      <th scope="col">Key</th>
                      <th scope="col">Size</th>
                      <th scope="col">Re-encrypt</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr v-for="post in premiumPosts" :key="post.permlink">
                      <td><router-link :to="'/@' + accountName + '/' + post.permlink">{{ post.title || post.permlink }}</router-link></td>
                      <td>{{ post.meta.mode }}</td>
                      <td><code>{{ post.meta.kid }}</code></td>
                      <td>{{ post.meta.bytes }} bytes</td>
                      <td><q-btn flat dense no-caps size="sm" label="Re-encrypt" disable aria-describedby="vault-reencrypt-note" /></td>
                    </tr>
                  </tbody>
                </table>
              </div>
              <p id="vault-reencrypt-note" class="vault-muted vault-muted--small">
                Re-encrypting published posts is post-MVP. Rotate the period and publish new posts instead.
              </p>
            </q-card-section>
          </q-card>
        </section>

        <section aria-labelledby="vault-revenue-title">
          <h2 id="vault-revenue-title" class="vault-section-title">Revenue</h2>
          <q-card flat bordered class="vault-card">
            <q-card-section>
              <p class="vault-muted">
                {{ payments.length }} verified {{ payments.length === 1 ? 'payment' : 'payments' }}
                in the last 1,000 account-history rows. The CSV is built in this browser.
              </p>
              <q-btn outline no-caps color="primary" label="Download payments CSV" :disable="!payments.length" @click="downloadCsv" />
            </q-card-section>
          </q-card>
        </section>

        <section aria-labelledby="vault-settings-title">
          <h2 id="vault-settings-title" class="vault-section-title">Settings</h2>
          <q-card flat bordered class="vault-card">
            <q-card-section>
              <dl class="vault-facts">
                <div><dt>Product</dt><dd>{{ vaultSettings.product }}</dd></div>
                <div><dt>Container</dt><dd>@{{ accountName }}/{{ vaultSettings.container }}</dd></div>
                <div><dt>Price</dt><dd>{{ plan ? plan.priceLabel : vaultSettings.price }}</dd></div>
                <div><dt>Recurrence</dt><dd>{{ plan ? plan.recurrence + ' hours' : vaultSettings.recurrence + ' hours' }}</dd></div>
              </dl>
              <p class="vault-muted">
                A new price applies to new subscriptions. Existing recurrent
                transfers keep their original amount until the reader cancels and
                creates a new one.
              </p>
              <q-btn outline no-caps color="primary" label="Edit blog and Vault settings" :to="setupPath" />
            </q-card-section>
          </q-card>
        </section>
      </template>
    </div>
  </q-page>
</template>

<style scoped>
.vault-page {
  background: var(--c-bg);
}

.vault-shell {
  max-width: 1100px;
  margin: 0 auto;
  padding: 1.5rem 1rem 4rem;
}

.vault-crumb {
  display: flex;
  gap: 0.4rem;
  align-items: center;
  margin-bottom: 1rem;
  color: var(--c-text-muted);
  font-size: 0.8rem;
}

.vault-crumb a {
  color: var(--c-link);
  text-decoration: none;
}

.vault-head {
  margin-bottom: 1.2rem;
}

.vault-kicker {
  margin: 0 0 0.25rem;
  color: var(--c-primary);
  font-size: 0.72rem;
  font-weight: 700;
  letter-spacing: 0.12em;
  text-transform: uppercase;
}

.vault-title {
  margin: 0;
  font-size: clamp(1.4rem, 3vw, 2rem);
  line-height: 1.2;
}

.vault-muted {
  margin: 0.4rem 0 0;
  color: var(--c-text-muted);
  font-size: 0.86rem;
  line-height: 1.5;
}

.vault-muted--small {
  font-size: 0.78rem;
}

.vault-muted--flush {
  margin: 0;
}

.vault-muted a {
  color: var(--c-link);
}

.vault-state {
  display: grid;
  justify-items: start;
  gap: 0.5rem;
  padding: 1.2rem;
  border: 1px solid var(--c-border);
  border-radius: 12px;
  background: var(--c-surface);
}

.vault-state h2 {
  margin: 0;
  font-size: 1.1rem;
}

.vault-state p {
  margin: 0;
  color: var(--c-text-muted);
  font-size: 0.88rem;
}

.vault-banner {
  margin-bottom: 1rem;
  background: var(--c-surface-2);
  color: var(--c-text);
  border: 1px solid var(--c-border);
  font-size: 0.84rem;
}

.vault-banner--ok {
  border-color: var(--c-positive);
}

.vault-banner--warning {
  border-color: var(--c-warning);
}

.vault-banner--pending {
  border-color: var(--c-primary);
}

.vault-auto {
  margin-bottom: 1rem;
}

.vault-auto__head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 1rem;
  flex-wrap: wrap;
}

.vault-section-title--flush {
  margin-top: 0;
}

.vault-auto__ok {
  color: var(--c-positive);
}

.vault-auto__batch {
  max-width: 220px;
  margin-top: 0.8rem;
}

.vault-section-title {
  margin: 1.6rem 0 0.6rem;
  font-size: 1.1rem;
}

.vault-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
  gap: 0.7rem;
}

.vault-card {
  background: var(--c-surface);
  border-color: var(--c-border);
}

.vault-card--pad {
  margin-top: 0.6rem;
}

.vault-metric-label {
  margin: 0;
  color: var(--c-text-muted);
  font-size: 0.74rem;
  text-transform: uppercase;
  letter-spacing: 0.08em;
}

.vault-metric {
  margin: 0.3rem 0 0;
  font-size: 1.5rem;
  font-weight: 700;
  overflow-wrap: anywhere;
}

.vault-metric--small {
  font-size: 0.95rem;
  font-weight: 600;
}

.vault-share__row {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  flex-wrap: wrap;
  margin-top: 0.65rem;
}

.vault-share__row code {
  flex: 1 1 320px;
  min-width: 0;
  padding: 0.4rem 0.55rem;
  border: 1px solid var(--c-border);
  border-radius: 7px;
  background: var(--c-surface-2);
  font-size: 0.76rem;
  overflow-wrap: anywhere;
}

.vault-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.6rem;
  flex-wrap: wrap;
  margin-bottom: 0.6rem;
}

.vault-table-wrap {
  width: 100%;
  overflow-x: auto;
}

.vault-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.82rem;
}

.vault-table th,
.vault-table td {
  padding: 0.5rem 0.55rem;
  border-bottom: 1px solid var(--c-border-subtle);
  text-align: left;
  vertical-align: middle;
  white-space: nowrap;
}

.vault-table th {
  color: var(--c-text-muted);
  font-size: 0.72rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.06em;
}

.vault-table code {
  padding: 0.05rem 0.2rem;
  border-radius: 4px;
  background: var(--c-surface-2);
}

.vault-empty {
  padding: 1rem 0.5rem;
  color: var(--c-text-muted);
  white-space: normal;
}

.vault-row-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 0.15rem;
}

.vault-pill {
  padding: 0.1rem 0.45rem;
  border-radius: 999px;
  border: 1px solid var(--c-border);
  font-size: 0.72rem;
}

.vault-pill--valid {
  border-color: var(--c-positive);
  color: var(--c-positive);
}

.vault-pill--expired,
.vault-pill--missing {
  border-color: var(--c-warning);
  color: var(--c-warning);
}

.vault-facts {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
  gap: 0.7rem;
  margin: 0;
}

.vault-facts dt {
  color: var(--c-text-muted);
  font-size: 0.72rem;
  text-transform: uppercase;
  letter-spacing: 0.06em;
}

.vault-facts dd {
  margin: 0.2rem 0 0;
  font-size: 0.9rem;
  overflow-wrap: anywhere;
}

.vault-facts code {
  padding: 0.05rem 0.2rem;
  border-radius: 4px;
  background: var(--c-surface-2);
}

.vault-subsection {
  margin-top: 1.1rem;
  padding-top: 0.9rem;
  border-top: 1px solid var(--c-border-subtle);
}

.vault-subtitle {
  margin: 0 0 0.35rem;
  font-size: 0.95rem;
}

.vault-inline-form {
  display: flex;
  gap: 0.5rem;
  align-items: flex-end;
  flex-wrap: wrap;
  margin-top: 0.6rem;
}

.vault-input {
  flex: 1 1 220px;
  max-width: 340px;
}

.vault-import {
  display: flex;
  gap: 0.5rem;
  align-items: flex-end;
  flex-wrap: wrap;
  margin-top: 0.7rem;
}

.vault-import-label {
  color: var(--c-text-muted);
  font-size: 0.8rem;
  align-self: center;
}

.vault-import input[type='file'] {
  max-width: 230px;
  color: var(--c-text-muted);
  font-size: 0.78rem;
}

.vault-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  margin-top: 0.9rem;
}

.vault-advanced-tools {
  margin-top: 1.6rem;
  padding-top: 0.8rem;
  border-top: 1px solid var(--c-border-subtle);
}

.vault-advanced-tools > summary {
  cursor: pointer;
  color: var(--c-link);
  font-size: 0.9rem;
  font-weight: 600;
}

.vault-error {
  margin: 0.6rem 0 0;
  color: var(--c-warning);
  font-size: 0.82rem;
}

.vault-visually-hidden {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
}

@media (max-width: 599px) {
  .vault-shell {
    padding: 1rem 0.75rem 3rem;
  }

  .vault-input {
    max-width: none;
  }
}
</style>

<script>
import { setPageMeta } from 'src/utils/pageMeta'
import { csvCell } from 'src/utils/csv'
import { fetchAccount, fetchAccountHistoryFiltered, fetchAccountPosts, fetchAccounts, fetchPostContent } from 'src/services/chainData'
import { hive } from 'src/services/hive'
import { readBlogSettings, updateBlog } from 'src/services/blogSettings'
import { readVaultSettings, vaultIsConfigured } from 'src/services/vaultSettings'
import { isValidHiveAccountName } from 'src/services/blogHost'
import { formatOrderDate, parseProductRef } from 'src/services/shopOrders'
import { deriveVaultPlan, parseVaultProduct } from 'src/services/vaultProduct'
import { collectVaultPayments, periodFor, summarizeSubscribers, vaultRecurrencePhrase } from 'src/services/vaultPayments'
import { collectAccountHistory, VAULT_HISTORY_FILTER, vaultHistorySince } from 'src/services/accountHistory'
import {
  AUTO_ISSUE_BATCH_OPTIONS,
  hasQueuedVaultBulletin,
  readAutoIssueBatch,
  readAutoIssuePreference,
  shouldAutoIssue,
  writeAutoIssueBatch,
  writeAutoIssuePreference
} from 'src/services/vaultAutoIssue'
import {
  BULLETIN_MAX_BYTES,
  BULLETIN_MAX_ENTRIES,
  buildBulletinEntries,
  buildVaultBulletinBundle,
  buildVaultBulletinOperation,
  buildVaultBulletinPartOperation,
  buildVaultShardedBulletin,
  buildVaultShardOperation,
  bulletinFromReplies,
  isBulletinTooLarge,
  nextSeq,
  planShardUpdates,
  shardCountForEntries,
  subscriberRows
} from 'src/services/vaultBulletin'
import { buildBulletinSigningPayload, bulletinPermlink, parseBulletin } from 'src/services/vaultGrant'
import { readerKeyThumbprint, sha256Hex } from 'src/services/vaultCrypto'
import { readReaderDevices } from 'src/services/vaultDevices'
import { loadBulletinEntries, verifyBulletin } from 'src/services/vaultUnlock'
import { postingPublicKeys, signVaultPayload, verifyVaultPayloadForAccount } from 'src/services/vaultSigning'
import { getCreatorVault, setCreatorVaultSession, unlockCreatorVault } from 'src/services/vaultSession'
import { exportCreatorVault, importCreatorVault, rotatePeriod, saveCreatorVault } from 'src/services/vaultKeys'
import { parseVaultMetadata } from 'src/services/vaultPayload'
import {
  buildRelayCertificate,
  createRelayBundle,
  latestDelegatedBulletin,
  relayCertificateFromAccount,
  relayCertificateStatus,
  signRelayCertificate,
  verifyRelayCertificate
} from 'src/services/vaultRelay'

const PENDING_WINDOW_MS = 24 * 60 * 60 * 1000

function normalizeAccount (value) {
  return String(value || '').trim().replace(/^@/, '').toLowerCase()
}

function download (filename, text, type = 'application/json') {
  const blob = new Blob([text], { type })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
  setTimeout(() => URL.revokeObjectURL(url), 0)
}


export default {
  name: 'BlogVaultDashboard',
  data () {
    return {
      accountName: '',
      account: null,
      blogSettings: null,
      vaultSettings: null,
      configured: false,
      loading: true,
      error: '',
      plan: null,
      planError: '',
      history: [],
      historyScanned: 0,
      historyTruncated: false,
      rows: [],
      summary: { active: 0, expiring: 0, expired: 0, mrr: 0, currency: 'HBD' },
      payments: [],
      period: '',
      nextSequence: 1,
      latestBulletin: null,
      currentBulletin: null,
      currentShards: [],
      currentBulletinRingId: '',
      bulletinError: '',
      premiumPosts: [],
      contentLoading: false,
      contentError: '',
      vault: null,
      passphrase: '',
      unlockError: '',
      rotatePassphrase: '',
      exportPassphrase: '',
      importPassphrase: '',
      importFile: null,
      keyError: '',
      selected: [],
      busy: '',
      refreshingDevices: false,
      deviceRefreshAt: 0,
      actionNotice: '',
      actionError: '',
      autoIssue: true,
      autoIssueBatch: 30,
      autoIssueTimer: null,
      autoIssueLastAt: 0,
      autoIssueNotice: '',
      autoIssueError: '',
      relayAccount: '',
      relayPublicKey: '',
      relayPassphrase: '',
      relayCertificate: null,
      relayLatest: null,
      relayNotice: '',
      relayError: ''
    }
  },
  computed: {
    loggedInUser () {
      return this.$hiveStore.user.username || ''
    },
    isOwner () {
      return Boolean(this.loggedInUser && this.loggedInUser === this.accountName)
    },
    setupPath () {
      return '/settings/blog' + (this.accountName ? '?account=' + this.accountName : '')
    },
    membershipPagePath () {
      const product = this.vaultSettings && this.vaultSettings.product
      return product ? '/@' + product : '/@' + this.accountName
    },
    membershipPageUrl () {
      const origin = typeof window !== 'undefined' ? window.location.origin : 'https://banksia.io'
      return origin + this.membershipPagePath
    },
    subscribeShareUrl () {
      const product = this.vaultSettings && this.vaultSettings.product
      if (!product) return ''
      const origin = typeof window !== 'undefined' ? window.location.origin : 'https://banksia.io'
      return origin + '/subscribe?blog=' + encodeURIComponent(this.accountName) +
        '&product=' + encodeURIComponent(product)
    },
    kids () {
      if (!this.vault || !this.vault.keyring) return []
      return Object.keys(this.vault.keyring)
    },
    maskedRingKey () {
      const key = this.vault && this.vault.ringKey
      if (typeof key !== 'string' || key.length < 8) return 'locked'
      return key.slice(0, 4) + '…' + key.slice(-4)
    },
    bulletinEntries () {
      const bulletin = this.currentBulletin || this.latestBulletin
      return bulletin && Array.isArray(bulletin.entries) ? bulletin.entries : []
    },
    currentSequence () {
      const bulletin = this.currentBulletin || this.latestBulletin
      return bulletin ? bulletin.seq : 'none'
    },
    autoIssueBatchOptions () {
      return AUTO_ISSUE_BATCH_OPTIONS.map(seconds => ({
        label: seconds + ' seconds',
        value: seconds
      }))
    },
    bulletinStrategy () {
      const bulletin = this.currentBulletin || this.latestBulletin
      if (!bulletin) return 'none'
      if (bulletin.v === 2) return 'sharded (v2)'
      if (Array.isArray(bulletin.parts) && bulletin.parts.length) return 'split parts (v1)'
      return 'single comment (v1)'
    },
    bulletinShardCount () {
      const bulletin = this.currentBulletin || this.latestBulletin
      return bulletin && bulletin.v === 2 ? Number(bulletin.shardCount) || 0 : 0
    },
    estimatedIssueBytes () {
      const count = this.grantTargetCount
      if (!count) return 0
      const bulletin = this.currentBulletin
      const willShard = (bulletin && bulletin.v === 2) || count > BULLETIN_MAX_ENTRIES
      if (willShard) {
        const shards = bulletin && bulletin.v === 2
          ? Number(bulletin.shardCount) || shardCountForEntries(count)
          : shardCountForEntries(count)
        const perShard = Math.ceil(count / shards)
        return perShard * 220 + shards * 50
      }
      return count * 240 + 300
    },
    estimatedIssueLabel () {
      const bytes = this.estimatedIssueBytes
      if (!bytes) return '—'
      return '~' + (bytes / 1024).toFixed(1) + ' KB'
    },
    bulletinBytes () {
      const bulletin = this.currentBulletin || this.latestBulletin
      if (!bulletin) return 0
      const raw = bulletin.v === 2 && this.latestBulletin ? this.latestBulletin : bulletin
      return new TextEncoder().encode(JSON.stringify({ app: 'banksia.io', banksia_vault_bulletin: raw })).length
    },
    bulletinTooLarge () {
      const bulletin = this.currentBulletin || this.latestBulletin
      if (!bulletin) return false
      const raw = bulletin.v === 2 && this.latestBulletin ? this.latestBulletin : bulletin
      if (raw && Array.isArray(raw.parts) && raw.parts.length) return false
      return isBulletinTooLarge(raw).tooLarge
    },
    bulletinWarning () {
      const bulletin = this.currentBulletin || this.latestBulletin
      if (!bulletin) return ''
      const raw = bulletin.v === 2 && this.latestBulletin ? this.latestBulletin : bulletin
      return isBulletinTooLarge(raw).reason
    },
    pendingCount () {
      return this.rows.filter(row => row.pending).length
    },
    recurrencePhrase () {
      return this.plan ? vaultRecurrencePhrase(this.plan.recurrence) : 'each period'
    },
    grantTargetCount () {
      const selected = new Set(this.selected)
      const rows = new Map()
      for (const row of this.rows.filter(row => row.active)) {
        const account = normalizeAccount(row.account)
        if (!rows.has(account)) rows.set(account, row)
      }
      for (const row of this.rows.filter(row => selected.has(row.readerKey))) {
        rows.set(normalizeAccount(row.account), row)
      }
      const keys = new Set()
      for (const row of rows.values()) {
        const devices = Array.isArray(row.devices) && row.devices.length
          ? row.devices
          : [{ readerKey: row.readerKey }]
        for (const device of devices) {
          const readerKey = typeof device === 'string' ? device : device.readerKey
          if (readerKey) keys.add(readerKey)
        }
      }
      return keys.size
    },
    newThisPeriod () {
      if (!this.period) return 0
      return this.rows.filter(row => periodFor(row.lastPayment) === this.period).length
    },
    lastBulletinLabel () {
      if (this.latestBulletin) return 'vault-' + this.latestBulletin.period + '-' + this.latestBulletin.seq
      if (this.vaultSettings && this.vaultSettings.bulletin && this.vaultSettings.bulletin.permlink) {
        return this.vaultSettings.bulletin.permlink
      }
      return 'none yet'
    },
    relaySettings () {
      return this.vaultSettings && this.vaultSettings.relay ? this.vaultSettings.relay : null
    },
    relayCertStatus () {
      if (!this.relaySettings) return { state: 'none', valid: false, expiresAt: '', reason: 'not-configured' }
      return relayCertificateStatus(this.relaySettings, { now: Date.now(), relayAccount: this.relayAccount })
    },
    relayLatestLabel () {
      const bulletin = this.relayLatest
      if (!bulletin) return 'none seen'
      return 'vault-' + bulletin.period + '-' + bulletin.seq
    }
  },
  created () {
    this.accountName = this.resolveAccount()
    this.autoIssue = readAutoIssuePreference(this.accountName)
    this.autoIssueBatch = readAutoIssueBatch(this.accountName)
    this.updateMeta()
    if (typeof document !== 'undefined') document.addEventListener('visibilitychange', this.onVaultVisibility)
    if (!this.loggedInUser) {
      this.loading = false
      return
    }
    this.load()
  },
  beforeUnmount () {
    this.stopAutoIssue()
    if (typeof document !== 'undefined') document.removeEventListener('visibilitychange', this.onVaultVisibility)
  },
  watch: {
    autoIssue (value) {
      writeAutoIssuePreference(this.accountName, value)
      if (value) this.startAutoIssue()
      else {
        this.stopAutoIssue()
        this.autoIssueNotice = ''
      }
    },
    autoIssueBatch (value) {
      writeAutoIssueBatch(this.accountName, value)
      this.startAutoIssue()
    },
    vault () {
      this.startAutoIssue()
    },
    isOwner () {
      this.startAutoIssue()
    },
    plan () {
      this.startAutoIssue()
    },
    pendingCount (value) {
      if (value > 0) this.autoIssueTick()
    }
  },
  methods: {
    resolveAccount () {
      const requested = normalizeAccount(this.$route.query.account)
      if (requested && isValidHiveAccountName(requested)) return requested
      return normalizeAccount(this.loggedInUser)
    },
    async load () {
      if (!this.accountName) {
        this.error = 'A Hive account is required.'
        this.loading = false
        return
      }
      this.loading = true
      this.error = ''
      this.actionError = ''
      try {
        const account = await fetchAccount(this.accountName, { force: true })
        if (!account) throw new Error('@' + this.accountName + ' could not be loaded.')
        this.account = account
        const blog = readBlogSettings(account)
        const vault = readVaultSettings(account)
        this.blogSettings = blog.settings
        this.vaultSettings = vault.settings
        this.configured = vaultIsConfigured(vault.settings)
        this.vault = getCreatorVault(this.accountName)
        if (!this.configured) return
        await this.loadPlan()
        await this.loadBulletins()
        await this.loadSubscribers()
        this.loadContent()
      } catch (error) {
        this.error = error && error.message ? error.message : 'The dashboard could not be loaded.'
      } finally {
        this.loading = false
        this.startAutoIssue()
      }
    },
    async loadPlan () {
      this.plan = null
      this.planError = ''
      const ref = parseProductRef(this.vaultSettings.product)
      if (!ref) {
        this.planError = 'The Vault product pointer is missing or invalid.'
        return
      }
      try {
        const post = await fetchPostContent(ref.author, ref.permlink)
        const product = parseVaultProduct(post)
        if (!product || product.status !== 1 || product.author !== this.accountName) {
          this.planError = 'The product post is missing, inactive or does not belong to this blog.'
          return
        }
        const derived = deriveVaultPlan(post, {
          fallback: {
            executions: this.vaultSettings.executions,
            container: this.vaultSettings.container,
            archive: this.vaultSettings.archive
          }
        })
        if (!derived || derived.author !== this.accountName) {
          this.planError = 'The product post is missing, inactive or does not belong to this blog.'
          return
        }
        this.plan = { ...derived, product: derived.author + '/' + derived.permlink }
      } catch {
        this.planError = 'The product post could not be loaded.'
      }
    },
    async loadBulletins () {
      this.bulletinError = ''
      this.period = periodFor(new Date())
      try {
        const replies = await hive.api.callAsync('condenser_api.get_content_replies', [
          this.accountName,
          this.vaultSettings.container
        ])
        const list = Array.isArray(replies) ? replies : []
        this.nextSequence = nextSeq(list, this.period)
        this.latestBulletin = bulletinFromReplies(list)
        const parsed = list
          .map(reply => parseBulletin(reply && reply.json_metadata))
          .filter(Boolean)
        let current = parsed
          .filter(bulletin => bulletin.period === this.period)
          .sort((a, b) => b.seq - a.seq)[0] || null
        if (current && (current.v === 2 || (Array.isArray(current.parts) && current.parts.length))) {
          // The manifest carries the signed part/shard hashes; merge them so the
          // dashboard sees every grant rather than treating a split bulletin as
          // empty.
          const verified = await verifyBulletin({ bulletin: current, allowDelegation: true })
          if (verified.ok) {
            const merged = await loadBulletinEntries({ bulletin: current, all: true })
            if (merged) current = merged
            else this.bulletinError = 'The bulletin parts or shards could not be verified.'
          } else {
            this.bulletinError = 'The current bulletin could not be verified.'
          }
        }
        this.currentShards = Array.isArray(current && current.shards) ? current.shards : []
        this.currentBulletinRingId = current && typeof current.ringId === 'string' ? current.ringId : ''
        this.currentBulletin = current
        const certificate = relayCertificateFromAccount(this.account)
        this.relayCertificate = certificate
        this.relayAccount = certificate ? certificate.delegate_account : (this.vaultSettings.relay ? this.vaultSettings.relay.delegate_account : '')
        this.relayPublicKey = certificate ? certificate.delegate : ''
        this.relayLatest = latestDelegatedBulletin(list, {
          blog: this.accountName,
          relayAccount: this.relayAccount
        })
      } catch {
        this.bulletinError = 'The bulletin container could not be loaded. Grants cannot be issued until it is available.'
      }
    },
    async loadSubscribers () {
      if (!this.plan) {
        this.rows = []
        this.summary = { active: 0, expiring: 0, expired: 0, mrr: 0, currency: 'HBD' }
        return
      }
      try {
        const collected = await collectAccountHistory({
          account: this.accountName,
          fetchPage: (name, options) => fetchAccountHistoryFiltered(name, { ...options, ...VAULT_HISTORY_FILTER }),
          pages: 10,
          since: vaultHistorySince()
        })
        const history = collected.rows
        this.history = history
        this.historyScanned = collected.scanned
        this.historyTruncated = collected.truncated
        const now = Date.now()
        const rows = subscriberRows(history, this.plan, { now })
        const withDevices = await this.attachDeviceKeys(rows)
        this.rows = await this.enrichRows(withDevices, now)
        this.summary = summarizeSubscribers(this.rows, { now })
        const payments = collectVaultPayments(history, this.plan, { now })
        this.payments = payments.payments
      } catch {
        this.actionError = 'Subscriber history could not be loaded.'
      }
    },
    async attachDeviceKeys (rows) {
      const list = Array.isArray(rows) ? rows : []
      const names = [...new Set(list.map(row => normalizeAccount(row.account)).filter(Boolean))]
      const accounts = new Map()
      for (let index = 0; index < names.length; index += 1000) {
        try {
          const batch = await fetchAccounts(names.slice(index, index + 1000), { force: true })
          for (const account of Array.isArray(batch) ? batch : []) {
            if (account && account.name) accounts.set(normalizeAccount(account.name), account)
          }
        } catch {
          // Fall back to the payment key when account metadata is unavailable.
        }
      }
      return list.map(row => {
        const account = accounts.get(normalizeAccount(row.account))
        const registered = readReaderDevices(account && account.posting_json_metadata, this.accountName)
        const keys = []
        const seen = new Set()
        for (const key of [row.readerKey, ...registered]) {
          if (typeof key !== 'string' || !key || seen.has(key)) continue
          seen.add(key)
          keys.push(key)
        }
        return { ...row, devices: keys.length ? keys : [row.readerKey].filter(Boolean) }
      })
    },
    async refreshDeviceKeys () {
      if (this.refreshingDevices || !this.rows.length) return
      const now = Date.now()
      // Metadata reads are bulk, but still a network cost. Refresh at most once
      // a minute; a manual dashboard refresh bypasses this path.
      if (this.deviceRefreshAt && now - this.deviceRefreshAt < 60000) return
      this.refreshingDevices = true
      this.deviceRefreshAt = now
      try {
        const withDevices = await this.attachDeviceKeys(this.rows)
        this.rows = await this.enrichRows(withDevices, now)
      } finally {
        this.refreshingDevices = false
      }
    },
    async enrichRows (rows, now) {
      const entries = this.bulletinEntries
      return Promise.all(rows.map(async row => {
        const keys = Array.isArray(row.devices) && row.devices.length
          ? row.devices
          : [row.readerKey].filter(Boolean)
        const devices = []
        for (const readerKey of keys) {
          let rkt = ''
          try {
            rkt = await readerKeyThumbprint(readerKey)
          } catch {
            rkt = ''
          }
          const entry = rkt ? entries.find(item => item.rkt === rkt) : null
          const expires = entry ? entry.expires : ''
          const expiryMs = Date.parse(expires)
          let grantStatus = 'missing'
          if (entry) grantStatus = Number.isFinite(expiryMs) && expiryMs > now ? 'valid' : 'expired'
          devices.push({
            readerKey,
            rkt,
            grantExpires: expires,
            grantStatus,
            pending: !entry || !Number.isFinite(expiryMs) || expiryMs <= now + PENDING_WINDOW_MS
          })
        }
        const primary = devices.find(device => device.readerKey === row.readerKey) || devices[0] || {}
        const grantStatus = devices.some(device => device.grantStatus === 'missing')
          ? 'missing'
          : devices.some(device => device.grantStatus === 'expired')
              ? 'expired'
              : 'valid'
        return {
          ...row,
          devices,
          rkt: primary.rkt || '',
          grantExpires: primary.grantExpires || '',
          grantStatus,
          pending: devices.some(device => device.pending)
        }
      }))
    },
    async loadContent () {
      this.contentLoading = true
      this.contentError = ''
      try {
        const posts = await fetchAccountPosts({ account: this.accountName, sort: 'posts', limit: 50 })
        this.premiumPosts = (Array.isArray(posts) ? posts : [])
          .map(post => {
            const meta = parseVaultMetadata(post && post.json_metadata)
            if (!meta) return null
            return {
              permlink: post.permlink,
              title: post.title,
              meta
            }
          })
          .filter(Boolean)
      } catch {
        this.contentError = 'Premium posts could not be loaded.'
      } finally {
        this.contentLoading = false
      }
    },
    async unlock () {
      this.unlockError = ''
      if (!this.passphrase) {
        this.unlockError = 'Enter the vault passphrase.'
        return
      }
      this.busy = 'unlock'
      try {
        this.vault = await unlockCreatorVault(this.accountName, this.passphrase)
        this.passphrase = ''
        this.actionNotice = 'Vault unlocked for this session.'
        this.startAutoIssue()
      } catch (error) {
        this.unlockError = error && error.message ? error.message : 'The vault could not be unlocked.'
      } finally {
        this.busy = ''
      }
    },
    autoIssueInterval () {
      // Background tabs are usually throttled by the browser; poll less often
      // but keep issuing while the tab is left open.
      const base = Math.max(1, Number(this.autoIssueBatch) || 30) * 1000
      return typeof document !== 'undefined' && document.visibilityState === 'hidden'
        ? base * 2
        : base
    },
    onVaultVisibility () {
      this.startAutoIssue()
      if (typeof document !== 'undefined' && document.visibilityState === 'visible') this.autoIssueTick()
    },
    startAutoIssue () {
      this.stopAutoIssue()
      if (!this.autoIssue || !this.isOwner || !this.vault || !this.plan) return
      this.autoIssueTick()
      if (typeof window !== 'undefined') {
        this.autoIssueTimer = window.setInterval(() => this.autoIssueTick(), this.autoIssueInterval())
      }
    },
    stopAutoIssue () {
      if (this.autoIssueTimer && typeof window !== 'undefined') window.clearInterval(this.autoIssueTimer)
      this.autoIssueTimer = null
    },
    async autoIssueTick () {
      if (!this.autoIssue || !this.isOwner || !this.vault || !this.plan) return
      // Device requests live in reader account metadata, not the creator's
      // payment history. Refresh those keys each tick so a phone that just
      // authorized itself does not wait for a full dashboard reload.
      if (!this.busy) await this.refreshDeviceKeys()
      const queuedBulletin = hasQueuedVaultBulletin(
        this.$hiveStore.queue,
        this.$hiveStore.queueMeta,
        this.accountName
      )
      if (!shouldAutoIssue({
        enabled: this.autoIssue,
        visible: true,
        hasVault: Boolean(this.vault),
        isOwner: this.isOwner,
        hasPlan: Boolean(this.plan),
        busy: Boolean(this.busy),
        pendingCount: this.pendingCount,
        queuedBulletin,
        lastAttemptAt: this.autoIssueLastAt,
        intervalMs: this.autoIssueInterval()
      })) return
      this.autoIssueLastAt = Date.now()
      this.autoIssueError = ''
      const count = this.pendingCount
      const ok = await this.issuePending({ auto: true })
      if (ok) this.autoIssueNotice = 'Queued grants for ' + count + ' pending reader' + (count === 1 ? '' : 's') + '.'
      else this.autoIssueError = this.actionError || 'Auto-issue could not queue the grants.'
    },
    async issuePending (options = {}) {
      this.selected = this.rows.filter(row => row.pending).map(row => row.readerKey)
      return this.issueGrants(options)
    },
    selectForReissue (row) {
      if (!this.selected.includes(row.readerKey)) this.selected.push(row.readerKey)
      this.actionNotice = 'Selected @' + row.account + ' for the next bulletin.'
    },
    copyCancelLink (row) {
      const origin = typeof location !== 'undefined' ? location.origin : ''
      return this.copyText(origin + '/subscriptions?account=' + row.account)
    },
    async copyText (text) {
      try {
        await navigator.clipboard.writeText(text)
        this.actionNotice = 'Copied to the clipboard.'
      } catch {
        this.actionNotice = 'Copy failed; select the value and copy it manually.'
      }
    },
    async vaultRingId () {
      if (!this.vault) return ''
      if (typeof this.vault.ringId === 'string' && this.vault.ringId) return this.vault.ringId
      // Older vaults have no stored id. A hash of the 256-bit random ring key is
      // a safe, stable identifier and rotates with the key.
      return sha256Hex(this.vault.ringKey)
    },
    async buildShardedBulletin ({ entries, shardCount, seq } = {}) {
      const existingCount = this.currentBulletin && this.currentBulletin.v === 2
        ? Number(this.currentBulletin.shardCount)
        : 0
      const ringId = await this.vaultRingId()
      const canReuse = existingCount === Number(shardCount) &&
        Boolean(this.currentBulletinRingId) &&
        this.currentBulletinRingId === ringId
      const plan = await planShardUpdates({
        blog: this.accountName,
        period: this.period,
        shardCount,
        entries,
        existingShards: canReuse ? this.currentShards : []
      })
      const operations = []
      for (const shard of plan.shards) {
        if (!shard.changed) continue
        const wrapper = { app: 'banksia.io', banksia_vault_shard: shard.object }
        const bytes = new TextEncoder().encode(JSON.stringify(wrapper)).length
        if (bytes > BULLETIN_MAX_BYTES) {
          throw new Error('Shard ' + shard.index + ' is ' + bytes + ' bytes; the limit is ' + BULLETIN_MAX_BYTES + '.')
        }
        const operation = buildVaultShardOperation({
          shard: shard.object,
          author: this.accountName,
          containerAuthor: this.accountName,
          containerPermlink: this.vaultSettings.container
        })
        if (!operation) throw new Error('A shard operation could not be built.')
        operations.push(operation)
      }
      const signAdapter = {
        sign: payload => signVaultPayload({
          username: this.accountName,
          loginType: this.$hiveStore.user.loginType,
          payload,
          smartlockSessionMs: this.$hiveStore.user.settings && this.$hiveStore.user.settings.smartlockSessionMinutes
            ? this.$hiveStore.user.settings.smartlockSessionMinutes * 60 * 1000
            : undefined,
          promptPassword: this.promptSmartlockPassword
        })
      }
      const bulletin = await buildVaultShardedBulletin({
        blog: this.accountName,
        period: this.period,
        seq,
        keyring: this.vault.keyring,
        ringKey: this.vault.ringKey,
        shardCount,
        shards: plan.descriptors,
        signer: this.accountName,
        issued: new Date().toISOString(),
        ringId,
        signAdapter
      })
      return { bulletin, operations, shards: plan.shards }
    },
    async issueGrants ({ auto = false } = {}) {
      this.actionError = ''
      this.actionNotice = ''
      if (!this.vault) {
        this.actionError = 'Unlock the vault before issuing grants.'
        return false
      }
      if (!this.isOwner) {
        this.actionError = 'Sign in as @' + this.accountName + ' to issue grants.'
        return false
      }
      if (!this.plan) {
        this.actionError = this.planError || 'The product plan is not available.'
        return false
      }
      const selected = new Set(this.selected)
      const chosen = selected.size
        ? this.rows.filter(row => selected.has(row.readerKey))
        : []
      // A bulletin is cumulative: readers look up this period's newest manifest.
      // Always include every active subscriber key, plus any explicitly selected
      // rows, so issuing for a new device cannot drop an existing member.
      const targetsByAccount = new Map()
      for (const row of this.rows.filter(row => row.active)) {
        const account = normalizeAccount(row.account)
        if (!targetsByAccount.has(account)) targetsByAccount.set(account, row)
      }
      for (const row of chosen) targetsByAccount.set(normalizeAccount(row.account), row)
      const targets = [...targetsByAccount.values()]
      if (!targets.length) {
        this.actionError = 'No active subscribers or selected readers to grant.'
        return false
      }
      const readers = []
      const seenReaders = new Set()
      for (const row of targets) {
        const devices = Array.isArray(row.devices) && row.devices.length
          ? row.devices
          : [{ readerKey: row.readerKey }]
        for (const device of devices) {
          const readerKey = typeof device === 'string' ? device : device.readerKey
          if (!readerKey || seenReaders.has(readerKey)) continue
          seenReaders.add(readerKey)
          readers.push({ readerKey, expires: row.expires })
        }
      }

      this.busy = 'issue'
      try {
        const currentIsV2 = Boolean(this.currentBulletin && this.currentBulletin.v === 2)
        const useShards = currentIsV2 || readers.length > BULLETIN_MAX_ENTRIES
        const ringId = await this.vaultRingId()
        const sameRing = Boolean(this.currentBulletinRingId) && this.currentBulletinRingId === ringId
        const canReuseEntries = sameRing && (
          currentIsV2 ||
          (!useShards && this.currentBulletin && this.currentBulletin.period === this.period)
        )
        const entries = await buildBulletinEntries({
          blog: this.accountName,
          period: this.period,
          ringKey: this.vault.ringKey,
          readers,
          now: Date.now(),
          compact: true,
          // Reuse wrapped keys only for the same ring key. A v1 -> v2 migration
          // re-wraps once so every tuple has the canonical expiry string.
          existingEntries: canReuseEntries ? this.bulletinEntries : []
        })
        const seq = this.nextSequence
        let bulletin
        let partOperations = []
        let shardOperations = []
        let currentShards = []
        if (useShards) {
          const shardCount = shardCountForEntries(entries.length)
          const sharded = await this.buildShardedBulletin({ entries, shardCount, seq })
          bulletin = sharded.bulletin
          shardOperations = sharded.operations
          currentShards = sharded.shards
        } else {
          const bundle = await buildVaultBulletinBundle({
            blog: this.accountName,
            period: this.period,
            seq,
            keyring: this.vault.keyring,
            ringKey: this.vault.ringKey,
            entries,
            signer: this.accountName,
            issued: new Date().toISOString(),
            compact: true,
            ringId,
            signAdapter: {
              sign: payload => signVaultPayload({
                username: this.accountName,
                loginType: this.$hiveStore.user.loginType,
                payload,
                smartlockSessionMs: this.$hiveStore.user.settings && this.$hiveStore.user.settings.smartlockSessionMinutes
                  ? this.$hiveStore.user.settings.smartlockSessionMinutes * 60 * 1000
                  : undefined,
                promptPassword: this.promptSmartlockPassword
              })
            }
          })
          bulletin = bundle.bulletin
          partOperations = bundle.parts
        }
        const payload = await buildBulletinSigningPayload(bulletin)
        const verified = await verifyVaultPayloadForAccount({
          payload,
          signature: bulletin.sig,
          account: this.account
        })
        if (!verified) throw new Error('The bulletin signature could not be verified against the posting key.')

        const size = isBulletinTooLarge(bulletin)
        if (size.tooLarge) throw new Error(size.reason)

        // Publish the shards/parts before the manifest. A reader must never see
        // a signed manifest that points at a comment which is not on chain yet.
        for (const part of partOperations) {
          const partOperation = buildVaultBulletinPartOperation({
            part: part.part,
            author: this.accountName,
            containerAuthor: this.accountName,
            containerPermlink: this.vaultSettings.container
          })
          if (!partOperation) throw new Error('A bulletin part operation could not be built.')
          this.$hiveStore.addToQueue([this.accountName, 'posting', partOperation])
        }
        for (const shardOperation of shardOperations) {
          this.$hiveStore.addToQueue([this.accountName, 'posting', shardOperation])
        }
        const operation = buildVaultBulletinOperation({
          bulletin,
          containerAuthor: this.accountName,
          containerPermlink: this.vaultSettings.container
        })
        if (!operation) throw new Error('The bulletin operation could not be built.')
        this.$hiveStore.addToQueue([this.accountName, 'posting', operation])

        const permlink = bulletinPermlink(this.period, seq)
        const update = updateBlog(this.account, {
          ...this.blogSettings,
          vault: {
            ...this.vaultSettings,
            bulletin: { author: this.accountName, permlink }
          }
        })
        if (update.ok && update.operation) {
          this.$hiveStore.addToQueue([this.accountName, 'posting', update.operation])
        } else {
          this.actionError = update.error || 'The bulletin was queued but the blog pointer could not be updated.'
        }

        this.nextSequence = seq + 1
        this.currentShards = currentShards
        this.currentBulletinRingId = ringId
        this.currentBulletin = { ...bulletin, entries }
        this.latestBulletin = bulletin
        this.selected = []
        this.rows = await this.enrichRows(this.rows, Date.now())
        const shardNote = useShards
          ? ' across ' + currentShards.length + ' shard' + (currentShards.length === 1 ? '' : 's') +
            ' (' + shardOperations.length + ' updated)'
          : (partOperations.length ? ' across ' + partOperations.length + ' parts' : '')
        this.actionNotice = 'Bulletin ' + permlink + ' queued with ' + entries.length + ' grant' +
          (entries.length === 1 ? '' : 's') + shardNote +
          '. Approve all posting operations in your signing queue.'
        return true
      } catch (error) {
        this.actionError = error && error.message ? error.message : 'The grants could not be issued.'
        if (!auto) this.autoIssueError = ''
        return false
      } finally {
        this.busy = ''
      }
    },
    promptSmartlockPassword () {
      return new Promise((resolve, reject) => {
        this.$q.dialog({
          title: 'Unlock SmartLock',
          message: 'Enter the SmartLock password to sign the Vault bulletin.',
          prompt: { model: '', type: 'password' },
          cancel: true,
          persistent: true
        }).onOk(value => resolve(value)).onCancel(() => reject(new Error('Signing was cancelled.')))
      })
    },
    async generateRelayCertificate () {
      this.relayError = ''
      this.relayNotice = ''
      if (!this.isOwner || !this.account) {
        this.relayError = 'Sign in as @' + this.accountName + ' to manage the relay certificate.'
        return
      }
      const relay = normalizeAccount(this.relayAccount)
      if (!isValidHiveAccountName(relay) || relay === this.accountName) {
        this.relayError = 'Enter a dedicated relay account, separate from the blog.'
        return
      }
      this.busy = 'relay'
      try {
        const relayAccount = await fetchAccount(relay, { force: true })
        if (!relayAccount) throw new Error('@' + relay + ' could not be loaded.')
        const keys = postingPublicKeys(relayAccount)
        if (!keys.length) throw new Error('The relay account has no posting key authority.')
        const unsigned = buildRelayCertificate({
          blog: this.accountName,
          delegateAccount: relay,
          delegatePublicKey: keys[0],
          days: 90
        })
        const signed = await signRelayCertificate(unsigned, {
          sign: payload => signVaultPayload({
            username: this.accountName,
            loginType: this.$hiveStore.user.loginType,
            payload,
            smartlockSessionMs: this.$hiveStore.user.settings && this.$hiveStore.user.settings.smartlockSessionMinutes
              ? this.$hiveStore.user.settings.smartlockSessionMinutes * 60 * 1000
              : undefined,
            promptPassword: this.promptSmartlockPassword
          })
        })
        const checked = await verifyRelayCertificate({
          cert: signed,
          blog: this.accountName,
          relayAccount: relay,
          relayPublicKey: keys[0],
          creatorAccount: this.account,
          relayAccountObject: relayAccount,
          verify: args => verifyVaultPayloadForAccount(args)
        })
        if (!checked.ok) throw new Error('The certificate could not be verified locally (' + checked.reason + ').')
        const update = updateBlog(this.account, {
          ...this.blogSettings,
          vault: { ...this.vaultSettings, relay: signed }
        })
        if (!update.ok || !update.operation) throw new Error(update.error || 'The certificate write could not be prepared.')
        this.$hiveStore.addToQueue([this.accountName, 'posting', update.operation])
        this.vaultSettings = { ...this.vaultSettings, relay: signed }
        this.relayCertificate = signed
        this.relayPublicKey = signed.delegate
        this.relayAccount = signed.delegate_account
        this.relayNotice = 'Certificate queued. Approve the posting update; the relay can start after it confirms.'
      } catch (error) {
        this.relayError = error && error.message ? error.message : 'The relay certificate could not be created.'
      } finally {
        this.busy = ''
      }
    },
    revokeRelayCertificate () {
      this.relayError = ''
      this.relayNotice = ''
      if (!this.isOwner || !this.account) {
        this.relayError = 'Sign in as @' + this.accountName + ' to revoke the relay certificate.'
        return
      }
      const { relay: _relay, ...vault } = this.vaultSettings
      const update = updateBlog(this.account, { ...this.blogSettings, vault })
      if (!update.ok || !update.operation) {
        this.relayError = update.error || 'The revocation write could not be prepared.'
        return
      }
      this.$hiveStore.addToQueue([this.accountName, 'posting', update.operation])
      this.vaultSettings = vault
      this.relayCertificate = null
      this.relayLatest = null
      this.relayNotice = 'Revocation queued. The relay stops at its next certificate check; readers hide delegated bulletins.'
    },
    async exportRelayBundle () {
      this.relayError = ''
      this.relayNotice = ''
      if (!this.vault) {
        this.relayError = 'Unlock the vault before exporting a relay bundle.'
        return
      }
      if (!this.relaySettings) {
        this.relayError = 'Create a relay certificate before exporting a bundle.'
        return
      }
      if (!this.relayPassphrase || this.relayPassphrase.length < 12) {
        this.relayError = 'Use a relay-bundle passphrase of at least 12 characters.'
        return
      }
      this.busy = 'relay'
      try {
        const bundle = await createRelayBundle({
          blog: this.accountName,
          relayAccount: this.relaySettings.delegate_account,
          keyring: this.vault.keyring,
          ringKid: this.vault.ringKid,
          ringKey: this.vault.ringKey,
          period: this.vault.ringKid,
          ringId: await this.vaultRingId(),
          passphrase: this.relayPassphrase
        })
        download('banksia-relay-' + this.accountName + '-' + this.vault.ringKid + '.json', JSON.stringify(bundle, null, 2))
        this.relayPassphrase = ''
        this.relayNotice = 'Encrypted relay bundle downloaded. Hand it and its passphrase to the operator over a secure channel.'
      } catch (error) {
        this.relayError = error && error.message ? error.message : 'The relay bundle could not be exported.'
      } finally {
        this.busy = ''
      }
    },
    async rotate () {
      this.keyError = ''
      if (!this.vault) return
      if (!this.rotatePassphrase) {
        this.keyError = 'Enter the passphrase to save the rotated vault.'
        return
      }
      this.busy = 'rotate'
      try {
        const next = rotatePeriod(this.vault)
        await saveCreatorVault(this.accountName, next, this.rotatePassphrase)
        setCreatorVaultSession(this.accountName, next)
        this.vault = next
        this.rotatePassphrase = ''
        this.actionNotice = 'Rotated to ' + next.ringKid + '. Export a new backup and issue grants for the new period.'
      } catch (error) {
        this.keyError = error && error.message ? error.message : 'The vault could not be rotated.'
      } finally {
        this.busy = ''
      }
    },
    async exportVault () {
      this.keyError = ''
      if (!this.vault) return
      if (!this.exportPassphrase) {
        this.keyError = 'Enter the passphrase for the export.'
        return
      }
      this.busy = 'export'
      try {
        const data = await exportCreatorVault(this.vault, this.exportPassphrase)
        download('banksia-vault-' + this.accountName + '.json', JSON.stringify(data, null, 2))
        this.exportPassphrase = ''
        this.actionNotice = 'Encrypted vault export downloaded.'
      } catch (error) {
        this.keyError = error && error.message ? error.message : 'The vault could not be exported.'
      } finally {
        this.busy = ''
      }
    },
    pickImportFile (event) {
      const files = event && event.target && event.target.files
      this.importFile = files && files[0] ? files[0] : null
    },
    async importVault () {
      this.keyError = ''
      if (!this.importFile) return
      if (!this.importPassphrase) {
        this.keyError = 'Enter the passphrase for the import.'
        return
      }
      this.busy = 'import'
      try {
        const text = await this.importFile.text()
        const vault = await importCreatorVault(text, this.importPassphrase)
        if (vault.account !== this.accountName) {
          throw new Error('That backup belongs to @' + vault.account + ', not @' + this.accountName + '.')
        }
        await saveCreatorVault(this.accountName, vault, this.importPassphrase)
        setCreatorVaultSession(this.accountName, vault)
        this.vault = vault
        this.importFile = null
        this.importPassphrase = ''
        this.actionNotice = 'Encrypted vault imported and unlocked.'
      } catch (error) {
        this.keyError = error && error.message ? error.message : 'The vault could not be imported.'
      } finally {
        this.busy = ''
      }
    },
    downloadCsv () {
      if (!this.payments.length) return
      const header = ['timestamp', 'from', 'amount', 'txid', 'reader_key', 'period']
      const lines = [header.map(csvCell).join(',')]
      for (const payment of this.payments) {
        lines.push([
          payment.timestamp,
          payment.from,
          payment.amount,
          payment.txid,
          payment.readerKey,
          periodFor(payment.timestamp)
        ].map(csvCell).join(','))
      }
      download('banksia-vault-payments-' + this.accountName + '.csv', lines.join('\n'), 'text/csv')
    },
    shortKey (value) {
      if (!value) return 'unknown'
      return value.length > 10 ? value.slice(0, 6) + '…' + value.slice(-4) : value
    },
    shortDate (value) {
      const text = formatOrderDate(value)
      return text || '—'
    },
    grantLabel (row) {
      if (row.grantStatus === 'valid') {
        return 'expires ' + this.shortDate(row.grantExpires)
      }
      if (row.grantStatus === 'expired') return 'expired'
      return 'not granted'
    },
    updateMeta () {
      setPageMeta({
        title: 'Vault dashboard — Banksia',
        description: 'Manage Banksia Vault subscribers, grants, keys and revenue.',
        url: '/settings/blog/vault',
        type: 'website',
        noindex: true
      })
    }
  }
}
</script>
