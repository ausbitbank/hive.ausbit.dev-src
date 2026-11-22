<template>
  <span>
  <q-btn flat dense round no-caps :aria-label="loggedInUser ? 'Account menu for ' + loggedInUser : 'Login'" :title="loggedInUser ? 'Account menu for ' + loggedInUser : 'Login'" class="account-trigger">
    <q-avatar class="account-trigger__avatar">
      <q-img :src="userAvatar" :alt="loggedInUser ? 'Avatar of @' + loggedInUser : 'Login'" v-if="loggedInUser !== '' && loggedInUser !== null" />
      <q-icon name="login" color="primary" title="Login" v-else />
    </q-avatar>
    <span class="account-trigger__name gt-xs">{{ loggedInUser }}</span>
    <q-icon name="expand_more" size="16px" class="account-trigger__chevron gt-xs" aria-hidden="true" />
    <q-popup-proxy ref="menu" @before-show="onMenuOpen" class="account-menu-popup">
      <q-card flat class="login-card">
      <div v-if="loggedInUser">
        <div class="account-menu__head">
          <q-avatar size="44px" class="account-menu__avatar">
            <q-img :src="userAvatar" :alt="'Avatar of @' + loggedInUser" />
          </q-avatar>
          <div class="account-menu__ident">
            <router-link :to="getAccountLink(loggedInUser)" class="account-menu__name" @click="closeMenu">@{{ loggedInUser }}</router-link>
            <span class="account-menu__meta">
              {{ loginTypeLabel }}
              <q-icon v-if="loginType === 'keychain'" name="info_outline" size="13px" class="account-menu__meta-info" aria-label="How Hive Keychain signing works">
                <q-tooltip class="account-menu__tooltip">Keys stay in the extension. Approve each posting or active action in Keychain.</q-tooltip>
              </q-icon>
              <q-icon v-else-if="loginType === 'hiveauth'" name="info_outline" size="13px" class="account-menu__meta-info" aria-label="How HiveAuth signing works">
                <q-tooltip class="account-menu__tooltip">Keys stay in your phone wallet. Approve each posting or active action there.</q-tooltip>
              </q-icon>
            </span>
          </div>
        </div>

        <div class="account-menu__voting" v-if="votePower !== null">
          <div class="account-menu__voting-row">
            <span class="account-menu__voting-label"><q-icon name="bolt" size="14px" aria-hidden="true" /> Voting power</span>
            <span class="account-menu__voting-value">{{ votePower }}%</span>
          </div>
          <q-linear-progress rounded size="6px" :value="votePower / 100" color="primary" class="account-menu__voting-bar" aria-label="Voting power" />
          <div class="account-menu__voting-meta">
            <span title="Estimated value of a 100% vote at your current voting power">
              <q-icon name="paid" size="13px" aria-hidden="true" /> {{ fullVoteLabel }} full vote
            </span>
            <span title="Voting power regenerates 20% per day">
              <q-icon name="schedule" size="13px" aria-hidden="true" /> Full in {{ rechargeLabel }}
            </span>
          </div>
        </div>

        <q-list dense class="account-menu" role="navigation" aria-label="Account menu">
          <q-item v-if="loginType === 'smartlock'" class="login-smartlock-status">
            <q-item-section avatar>
              <q-icon :name="smartlockUnlocked ? 'lock_open' : 'lock'" :color="smartlockUnlocked ? 'green' : 'orange'" />
            </q-item-section>
            <q-item-section>
              <q-item-label>{{ smartlockUnlocked ? 'SmartLock unlocked' : 'SmartLock locked' }}</q-item-label>
              <q-item-label caption>
                Posting key {{ smartlockUnlocked ? 'in memory' : 'not available' }} · auto-locks after {{ smartlockTimeout }} min idle
              </q-item-label>
            </q-item-section>
            <q-item-section side>
              <q-btn
                v-if="smartlockUnlocked"
                dense
                flat
                no-caps
                color="orange"
                label="Lock"
                aria-label="Lock SmartLock now"
                @click.stop="lockSmartlock"
              />
              <q-btn
                v-else
                dense
                flat
                no-caps
                color="green"
                label="Unlock"
                aria-label="Unlock SmartLock"
                @click.stop="unlockSmartlock"
              />
            </q-item-section>
          </q-item>
          <q-item v-else-if="loginType === 'keychain'" class="account-menu__provider account-menu__provider--compact">
            <q-item-section avatar><q-icon name="key" color="primary" /></q-item-section>
            <q-item-section>Hive Keychain</q-item-section>
          </q-item>
          <q-item v-else-if="loginType === 'hiveauth'" class="account-menu__provider account-menu__provider--compact">
            <q-item-section avatar><q-icon name="smartphone" color="primary" /></q-item-section>
            <q-item-section>
              <q-item-label>HiveAuth</q-item-label>
              <q-item-label caption>Approved in your mobile wallet</q-item-label>
            </q-item-section>
          </q-item>

          <q-item-label header class="account-menu__heading">Your Hive</q-item-label>
          <q-item v-for="link in menuLinks" :key="link.title" clickable :to="link.to" class="account-menu__item" @click="closeMenu">
            <q-item-section avatar><q-icon :name="link.icon" /></q-item-section>
            <q-item-section>{{ link.title }}</q-item-section>
          </q-item>
          <q-item v-if="account !== undefined && account.witness_votes && account.witness_votes.includes(loggedInUser)" clickable to="/witness" class="account-menu__item" @click="closeMenu">
            <q-item-section avatar><q-icon name="admin_panel_settings" /></q-item-section>
            <q-item-section>Witness</q-item-section>
          </q-item>

          <q-item-label header class="account-menu__heading">Account</q-item-label>
          <q-item clickable class="account-menu__item" @click="openSettings">
            <q-item-section avatar><q-icon name="settings" /></q-item-section>
            <q-item-section>Settings</q-item-section>
          </q-item>
          <q-item clickable class="account-menu__item account-menu__item--danger" @click="logout()">
            <q-item-section avatar><q-icon name="logout" /></q-item-section>
            <q-item-section>Log out</q-item-section>
          </q-item>
        </q-list>
      </div>
      <q-list dense v-else>
        <div class="account-menu__head account-menu__head--guest">
          <div class="account-menu__ident">
            <span class="account-menu__name">Log in to Hive</span>
            <span class="account-menu__meta">Use Keychain, SmartLock or HiveAuth</span>
          </div>
        </div>
        <q-item class="login-key-guide">
          <q-item-section>
            <div class="login-key-guide__title">Which key do you need?</div>
            <div class="login-key-guide__row">
              <q-icon name="lock" color="green" size="16px" aria-hidden="true" />
              <span><strong>Posting key</strong> — votes, comments, follows and notification read markers. It cannot move funds.</span>
            </div>
            <div class="login-key-guide__row">
              <q-icon name="lock" color="orange" size="16px" aria-hidden="true" />
              <span><strong>Active key</strong> — transfers, power, savings, market orders and witness/authority changes.</span>
            </div>
            <div class="login-key-guide__row">
              <q-icon name="key" color="primary" size="16px" aria-hidden="true" />
              <span><strong>Keychain</strong> keeps keys in the browser extension and asks for approval on each action.</span>
            </div>
            <div class="login-key-guide__row">
              <q-icon name="smartphone" color="primary" size="16px" aria-hidden="true" />
              <span><strong>HiveAuth</strong> keeps keys in your phone wallet and asks you to approve each action there.</span>
            </div>
          </q-item-section>
        </q-item>
        <q-item>
          <userSearchBox @selectUsername="setUsername" label="Username" class="login-username text-center" />
        </q-item>
        <q-item dense v-if="username !== '' && username !== null" class="login-method">
          <q-btn flat no-caps class="login-method__btn" label="Hive-Keychain" icon="img:/statics/hive-keychain.svg" @click="checkLoginKeychain(username)" />
        </q-item>
        <q-item dense v-if="username !== '' && username !== null" class="login-method">
          <q-btn flat no-caps class="login-method__btn" label="SmartLock" icon="lock">
            <q-popup-proxy>
              <q-card class="q-pa-lg rounded-borders login-smartlock-card">
                <div class="login-smartlock-card__title">Import keys into SmartLock</div>
                <p class="login-smartlock-card__hint">
                  Keys are encrypted locally with your unlock password. The posting key stays in memory while unlocked; the active key asks for the password each time it is used.
                </p>
                <q-input v-model="username" label="Username" />
                <q-input v-model="postkey" label="Posting key (required)" filled type="password" :rules="[val => !!val || 'Field is required']"/>
                <q-input v-model="activekey" label="Active key (optional)" filled type="password" />
                <q-input v-model="memokey" label="Memo key (optional)" filled type="password" />
                <q-input v-model="password" label="Unlock password (8+ characters)" filled type="password" :rules="[val => !!val && val.length >= 8 || 'At least 8 characters']"/>
                <q-btn flat glossy dense no-caps label="Save and log in" icon="save" color="primary" @click="smartLockImportAccount()"/>
              </q-card>
            </q-popup-proxy>
          </q-btn>
        </q-item>
        <q-item dense v-if="username !== '' && username !== null" class="login-method">
          <q-btn flat no-caps class="login-method__btn" label="HiveAuth" icon="smartphone" @click="checkLoginHiveAuth(username)">
            <q-tooltip>Approve in Hive Keychain Mobile. Keys stay on your phone.</q-tooltip>
          </q-btn>
        </q-item>
        <q-item dense v-if="username !== '' && username !== null" class="login-timeout-item">
          <q-item-section>
            <div class="login-timeout">
              <q-icon name="lock_clock" size="15px" aria-hidden="true" />
              SmartLock auto-locks after {{ smartlockTimeout }} minutes idle. Change this in Settings.
            </div>
          </q-item-section>
        </q-item>
        <q-item v-if="username !== '' && username !== null">
          <q-item-section>
            <q-btn icon="img:/statics/member.webp" flat label="Remember me" title="Save your username to local storage for faster future logins" @click="rememberLogin = !rememberLogin">
              <q-checkbox v-model="rememberLogin" />
            </q-btn>
            <div class="text-caption text-faint">Saves only your username on this device. It never stores your posting, active or memo keys; SmartLock needs your password again after a reload.</div>
          </q-item-section>
        </q-item>
        <div class="account-menu__saved">
          <template v-if="savedUsers.length > 0">
            <div class="account-menu__heading">Keychain logins</div>
            <div class="account-menu__chips">
              <q-chip v-for="user in savedUsers" :key="user" outline removable @remove="removeSavedUser(user)" clickable class="account-menu__chip" @click="rememberLogin = true; checkLoginKeychain(user)"><q-avatar><q-img :src="getHiveAvatarUrl(user)" :alt="'Avatar of @' + user" /></q-avatar> {{ user }}</q-chip>
            </div>
          </template>
          <template v-if="savedUsersSmartLock.length > 0">
            <div class="account-menu__heading">SmartLock logins</div>
            <div class="account-menu__chips">
              <q-chip v-for="user in savedUsersSmartLock" :key="user" outline removable @remove="smartLockRemoveAccount(user)" clickable class="account-menu__chip" @click="rememberLogin = true; checkLoginSmartLock(user)"><q-avatar><q-img :src="getHiveAvatarUrl(user)" :alt="'Avatar of @' + user" /></q-avatar> {{ user }}</q-chip>
            </div>
          </template>
        </div>
      </q-list>
      </q-card>
    </q-popup-proxy>
    <q-dialog v-model="settingsDialog">
      <settings />
    </q-dialog>
  </q-btn>
  <q-dialog v-model="hiveauthDialog" persistent @before-hide="cancelHiveAuth">
    <q-card class="login-hiveauth-card">
      <q-card-section>
        <div class="login-hiveauth-title">HiveAuth</div>
        <div class="login-hiveauth-subtitle">
          Approve with Hive Keychain Mobile. Your keys never leave your phone.
        </div>
      </q-card-section>
      <q-card-section class="login-hiveauth-body">
        <div v-if="hiveauthError" class="login-hiveauth-error" role="alert">{{ hiveauthError }}</div>
        <template v-else-if="!hiveauthQr && !hiveauthQrError">
          <div class="login-hiveauth-wait">
            <q-spinner color="primary" size="32px" />
            <span>Connecting to the HiveAuth relay…</span>
          </div>
        </template>
        <template v-else>
          <img v-if="hiveauthQr" :src="hiveauthQr" :alt="'HiveAuth QR code for @' + hiveauthAccount" class="login-hiveauth-qr" />
          <p class="login-hiveauth-copy">
            {{ hiveauthQr ? 'Scan this QR code with Hive Keychain Mobile, or open the link on this phone.' : 'Open the link on this phone with Hive Keychain Mobile.' }}
          </p>
          <p class="login-hiveauth-expiry" aria-live="polite">Request expires in {{ hiveauthSecondsLeft }}s.</p>
          <p v-if="hiveauthQrError" class="login-hiveauth-hint">{{ hiveauthQrError }}</p>
          <div class="login-hiveauth-actions">
            <a class="login-hiveauth-link" :href="hiveauthUri">Open Hive Keychain</a>
            <q-btn flat dense no-caps icon="content_copy" label="Copy link" @click="copyHiveAuthLink" />
          </div>
        </template>
      </q-card-section>
      <q-card-actions align="right">
        <q-btn v-if="hiveauthError" flat no-caps color="primary" label="Try again" @click="checkLoginHiveAuth(hiveauthAccount)" />
        <q-btn flat no-caps label="Cancel" @click="cancelHiveAuth" />
      </q-card-actions>
    </q-card>
  </q-dialog>
  </span>
</template>
<style scoped>
.account-trigger {
  gap: 0.4rem;
  min-height: 36px;
  padding: 0 0.5rem 0 0.25rem;
  border-radius: var(--radius-pill);
  color: var(--c-text);
}

.account-trigger:hover {
  background: color-mix(in srgb, var(--c-text) 6%, transparent);
}

.account-trigger__avatar {
  border: 1px solid color-mix(in srgb, var(--c-text) 14%, transparent);
}

.account-trigger__name {
  max-width: 140px;
  overflow: hidden;
  font-size: 0.84rem;
  font-weight: 600;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.account-trigger__chevron {
  color: var(--c-text-subtle);
}

.login-card {
  width: 320px;
  max-width: 94vw;
  overflow: hidden;
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-card);
  background: var(--c-surface-2);
  box-shadow: var(--shadow-pop);
}

.account-menu__head {
  display: flex;
  align-items: center;
  gap: 0.6rem;
  padding: 0.85rem 0.85rem 0.75rem;
  border-bottom: 1px solid var(--border-subtle);
}

.account-menu__head--guest {
  border-bottom: 0;
  padding-bottom: 0;
}

.account-menu__avatar {
  flex: none;
  border: 1px solid color-mix(in srgb, var(--c-text) 12%, transparent);
}

.account-menu__ident {
  display: flex;
  flex-direction: column;
  gap: 1px;
  min-width: 0;
}

.account-menu__name {
  overflow: hidden;
  color: var(--c-text);
  font-size: 0.92rem;
  font-weight: 600;
  line-height: 1.3;
  text-decoration: none;
  text-overflow: ellipsis;
  white-space: nowrap;
}

a.account-menu__name:hover {
  color: var(--c-link-hover);
  text-decoration: underline;
}

.account-menu__meta {
  display: inline-flex;
  align-items: center;
  gap: 0.2rem;
  overflow: hidden;
  color: var(--c-text-faint);
  font-size: 0.72rem;
  line-height: 1.35;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.account-menu__meta-info {
  flex: none;
  color: var(--c-text-faint);
  cursor: help;
}

.account-menu__provider--compact {
  min-height: 34px;
  color: var(--c-text-subtle);
  font-size: 0.76rem;
}

.account-menu__voting {
  padding: 0.6rem 0.85rem 0.7rem;
  border-bottom: 1px solid var(--border-subtle);
  background: color-mix(in srgb, var(--c-text) 2%, transparent);
}

.account-menu__voting-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
  margin-bottom: 0.3rem;
}

.account-menu__voting-label {
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
  color: var(--c-text-subtle);
  font-size: 0.68rem;
  letter-spacing: 0.05em;
  text-transform: uppercase;
}

.account-menu__voting-value {
  color: var(--c-text);
  font-size: 0.78rem;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
}

.account-menu__voting-meta {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
  margin-top: 0.35rem;
  color: var(--c-text-subtle);
  font-size: 0.68rem;
  font-variant-numeric: tabular-nums;
}

.account-menu__voting-meta span {
  display: inline-flex;
  align-items: center;
  gap: 0.2rem;
  white-space: nowrap;
}

.account-menu {
  padding: 0.25rem 0;
}

.account-menu__heading {
  padding: 0.55rem 0.85rem 0.2rem;
  min-height: 0;
  color: var(--c-text-faint);
  font-size: 0.66rem;
  font-weight: 600;
  letter-spacing: 0.07em;
  line-height: 1.3;
  text-transform: uppercase;
}

.account-menu .q-item {
  min-height: 38px;
  padding-top: 4px;
  padding-bottom: 4px;
  color: var(--c-text-soft);
  font-size: 0.84rem;
}

.account-menu .q-item__section--avatar {
  min-width: 36px;
  padding-right: 0.5rem;
}

.account-menu .q-item__section--avatar .q-icon {
  color: var(--c-text-faint);
  font-size: 19px;
}

.account-menu .q-item:hover,
.account-menu .q-item:focus-visible {
  background: color-mix(in srgb, var(--c-link) 8%, transparent);
  color: var(--c-text-strong);
}

.account-menu .q-item:hover .q-icon,
.account-menu .q-item:focus-visible .q-icon,
.account-menu .q-item.q-router-link--active .q-icon {
  color: var(--c-link);
}

.account-menu__item--danger,
.account-menu__item--danger .q-item__section--avatar .q-icon {
  color: var(--c-negative);
}

.account-menu .q-item.account-menu__item--danger:hover {
  background: color-mix(in srgb, var(--c-negative) 10%, transparent);
  color: var(--c-negative);
}

.login-method {
  justify-content: center;
}

.login-method__btn {
  width: 100%;
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-sm);
  color: var(--c-text);
  font-size: 0.82rem;
  font-weight: 600;
}

.login-method__btn:hover {
  border-color: color-mix(in srgb, var(--c-link) 40%, transparent);
  background: color-mix(in srgb, var(--c-link) 8%, transparent);
}

.login-key-guide {
  margin: 0.15rem 0.35rem 0.35rem;
  padding: 0.55rem 0.65rem;
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-sm);
  background: color-mix(in srgb, var(--c-text) 3%, transparent);
  text-align: left;
}

.login-key-guide__title {
  margin-bottom: 0.35rem;
  color: var(--c-text-soft);
  font-size: 0.76rem;
  font-weight: 600;
}

.login-key-guide__row {
  display: flex;
  align-items: flex-start;
  gap: 0.35rem;
  color: var(--c-text-subtle);
  font-size: 0.7rem;
  line-height: 1.4;
}

.login-key-guide__row + .login-key-guide__row {
  margin-top: 0.28rem;
}

.login-key-guide__row strong {
  color: var(--c-text-soft);
  font-weight: 600;
}

.login-smartlock-status {
  text-align: left;
  background: color-mix(in srgb, var(--c-text) 3%, transparent);
}

.login-smartlock-status :deep(.q-item__label) {
  text-align: left;
}

.login-smartlock-card {
  width: 360px;
  max-width: 92vw;
}

.login-smartlock-card__title {
  color: var(--c-text);
  font-size: 0.95rem;
  font-weight: 600;
  text-align: center;
}

.login-smartlock-card__hint {
  margin: 0.35rem 0 0.6rem;
  color: var(--c-text-subtle);
  font-size: 0.72rem;
  line-height: 1.4;
  text-align: center;
}

.login-timeout {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.3rem;
  padding: 0.15rem 0.3rem;
  color: var(--c-text-faint);
  font-size: 0.68rem;
  text-align: center;
}

.account-menu__saved {
  padding: 0.2rem 0.5rem 0.6rem;
  text-align: center;
}

.account-menu__chips {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 0.3rem;
}

.account-menu__chip {
  color: var(--c-text-soft);
  font-size: 0.76rem;
}

.login-hiveauth-card {
  width: 380px;
  max-width: 92vw;
}

.login-hiveauth-title {
  color: var(--c-text);
  font-size: 1.05rem;
  font-weight: 600;
  text-align: center;
}

.login-hiveauth-subtitle {
  margin-top: 0.2rem;
  color: var(--c-text-subtle);
  font-size: 0.76rem;
  line-height: 1.4;
  text-align: center;
}

.login-hiveauth-body {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.45rem;
  text-align: center;
}

.login-hiveauth-wait {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.6rem;
  padding: 1.2rem 0;
  color: var(--c-text-muted);
  font-size: 0.8rem;
}

.login-hiveauth-qr {
  width: 240px;
  height: 240px;
  padding: 8px;
  border-radius: 8px;
  background: #fff;
}

.login-hiveauth-copy,
.login-hiveauth-expiry,
.login-hiveauth-hint {
  margin: 0;
  color: var(--c-text-muted);
  font-size: 0.76rem;
  line-height: 1.4;
}

.login-hiveauth-expiry {
  color: var(--c-text-subtle);
  font-variant-numeric: tabular-nums;
}

.login-hiveauth-hint {
  color: var(--c-warning);
}

.login-hiveauth-error {
  padding: 0.5rem 0.65rem;
  border-radius: 6px;
  background: color-mix(in srgb, var(--c-negative) 12%, transparent);
  color: var(--c-negative);
  font-size: 0.78rem;
  line-height: 1.4;
}

.login-hiveauth-actions {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: center;
  gap: 0.4rem;
}

.login-hiveauth-link {
  display: inline-flex;
  align-items: center;
  min-height: 32px;
  padding: 0 0.6rem;
  border: 1px solid color-mix(in srgb, var(--c-text) 18%, transparent);
  border-radius: var(--radius-pill);
  color: var(--c-text);
  font-size: 0.76rem;
  text-decoration: none;
}

.login-hiveauth-link:hover {
  background: color-mix(in srgb, var(--c-text) 6%, transparent);
}

@media (max-width: 599px) {
  .account-trigger {
    padding: 0;
  }

  .login-key-guide {
    margin: 0.15rem 0.1rem 0.3rem;
  }
}
</style>
<script>
import { copyToClipboard } from 'quasar'
import { keychain } from '@hiveio/keychain'
import settings from 'components/settings.vue'
import userSearchBox from 'components/userSearchBox.vue'
import { apiGetMedianHistoryPrice, apiGetRewardFund } from 'src/services/api'
import { clearSession as clearHiveAuthSession, loadSession as loadHiveAuthSession } from 'src/services/hiveauth/session'
import { estimateVoteValueUsd, formatRecharge, formatVoteValue, vpRechargeSeconds } from 'src/services/voteValue'
import { hiveAvatarUrl } from 'src/utils/avatar'

// SmartLock pulls in sjcl and the signing stack. Keep it out of the initial
// shell; the account menu is the first surface that needs it.
let smartlockPromise = null
function loadSmartlock () {
  return (smartlockPromise ||= import('components/smartlock/index.js').then(module => module.default))
}

// HiveAuth pulls in the Web Crypto/MD5 signing adapter. Load it only when the
// user actually chooses HiveAuth.
let hiveauthPromise = null
function loadHiveAuth () {
  return (hiveauthPromise ||= import('src/services/hiveauth').then(module => module.default))
}

export default {
  name: 'userLogin',
  props: [],
  components: { settings, userSearchBox },
  data () {
    return {
      username: '',
      savedUsers: this.$q.localStorage.getItem('savedUsers') || [],
      savedUsersSmartLock: [],
      rememberLogin: false,
      settingsDialog: false,
      smartlockUnlocked: false,
      rewardFund: null,
      medianHistory: null,
      votingStatsLoaded: false,
      postkey: '',
      activekey: '',
      memokey: '',
      password: '',
      hiveauthDialog: false,
      hiveauthAccount: '',
      hiveauthBusy: false,
      hiveauthError: '',
      hiveauthQr: '',
      hiveauthQrError: '',
      hiveauthUri: '',
      hiveauthExpiresAt: 0,
      hiveauthClock: Date.now(),
      hiveauthTimer: null,
      hiveauthController: null
    }
  },
  computed: {
    loggedInUser: {
      get () { return this.$hiveStore.user.username },
      set (val) {
        this.$hiveStore.updateLoggedInUser(val)
        if (this.rememberLogin) { this.$q.sessionStorage.set('loggedInUser', val) }
      }
    },
    loginType: {
      get () { return this.$hiveStore.user.loginType },
      set (val) {
        this.$hiveStore.updateLoginType(val)
      }
    },
    smartlockTimeout () {
      const minutes = Number(this.$hiveStore.user?.settings?.smartlockSessionMinutes)
      return Number.isFinite(minutes) && minutes > 0 ? minutes : 15
    },
    smartlockTimeoutMs () {
      return this.smartlockTimeout * 60 * 1000
    },
    userAvatar: function () {
      if (this.loggedInUser !== '') {
        return hiveAvatarUrl(this.loggedInUser)
      } else {
        return hiveAvatarUrl('null')
      }
    },
    votePower: function () {
      if (this.account !== undefined) {
        var secondsago = (new Date() - new Date(this.account.last_vote_time + 'Z')) / 1000
        var vpow = this.account.voting_power + (10000 * secondsago / 432000)
        return parseFloat(Math.min(vpow / 100, 100).toFixed(2))
      } else {
        return null
      }
    },
    fullVoteValue () {
      return estimateVoteValueUsd({
        account: this.account,
        rewardFund: this.rewardFund,
        medianHistory: this.medianHistory,
        votingPower: this.votePower
      })
    },
    fullVoteLabel () {
      if (!this.votingStatsLoaded) return '…'
      return formatVoteValue(this.fullVoteValue)
    },
    rechargeLabel () {
      if (this.votePower === null) return '—'
      return formatRecharge(vpRechargeSeconds(this.votePower))
    },
    loginTypeLabel () {
      if (this.loginType === 'smartlock') return 'Signed in with SmartLock'
      if (this.loginType === 'keychain') return 'Signed in with Hive Keychain'
      if (this.loginType === 'hiveauth') return 'Signed in with HiveAuth'
      return 'Hive account'
    },
    hiveauthSecondsLeft () {
      if (!this.hiveauthExpiresAt) return 0
      return Math.max(0, Math.ceil((this.hiveauthExpiresAt - this.hiveauthClock) / 1000))
    },
    menuLinks () {
      const user = this.loggedInUser
      if (!user) return []
      return [
        { title: 'Feed', icon: 'rss_feed', to: this.linkFeed(user) },
        { title: 'Blog', icon: 'menu_book', to: this.linkBlog(user) },
        { title: 'Posts', icon: 'library_books', to: this.linkPosts(user) },
        { title: 'Communities', icon: 'forum', to: this.linkCommunities(user) },
        { title: 'Replies', icon: 'comment', to: this.linkReplies(user) },
        { title: 'Profile', icon: 'perm_identity', to: this.getAccountLink(user) },
        { title: 'Wallet', icon: 'account_balance', to: this.getWalletLink(user) },
        { title: 'Market', icon: 'store', to: '/market' }
      ]
    },
    account: {
      cache: false,
      get () {
        return this.$hiveStore.accounts[this.loggedInUser]
      }
    }
  },
  methods: {
    async onMenuOpen () {
      await this.loadSmartlockUsers()
      this.refreshSmartlockStatus()
      this.refreshVotingStats()
    },
    async loadSmartlockUsers () {
      try {
        const smartlock = await loadSmartlock()
        this.savedUsersSmartLock = smartlock.allAccounts()
      } catch (error) {
        console.error('Failed to load SmartLock accounts', error)
      }
    },
    async refreshVotingStats () {
      if (!this.loggedInUser) return
      try {
        const [fund, median] = await Promise.all([
          this.rewardFund || apiGetRewardFund('post'),
          this.medianHistory || apiGetMedianHistoryPrice()
        ])
        if (fund) this.rewardFund = fund
        if (median) this.medianHistory = median
      } catch (error) {
        console.error('Failed to load vote value data', error)
      } finally {
        this.votingStatsLoaded = true
      }
    },
    setUsername (user) { this.username = user },
    openSettings () {
      this.$refs.menu?.hide?.()
      this.settingsDialog = true
    },
    async smartLockRemoveAccount (user) {
      const smartlock = await loadSmartlock()
      await smartlock.removeAccount(user)
      this.savedUsersSmartLock = smartlock.allAccounts()
      if (this.loggedInUser === user) this.smartlockUnlocked = false
    },
    async smartLockImportAccount () {
      try {
        const smartlock = await loadSmartlock()
        await smartlock.importAccount(this.username, this.password, this.postkey, this.activekey, this.memokey)
        this.savedUsersSmartLock = smartlock.allAccounts()
        this.checkLoginSmartLock(this.username)
      } catch (error) {
        this.$q.notify({ type: 'negative', message: error?.message || 'Could not import the SmartLock account' })
      }
    },
    async refreshSmartlockStatus () {
      if (!this.loggedInUser || this.loginType !== 'smartlock') {
        this.smartlockUnlocked = false
        return
      }
      try {
        const smartlock = await loadSmartlock()
        this.smartlockUnlocked = smartlock.isAccountUnlocked(this.loggedInUser, this.smartlockTimeoutMs)
      } catch {
        this.smartlockUnlocked = false
      }
    },
    async lockSmartlock () {
      if (!this.loggedInUser) return
      const smartlock = await loadSmartlock()
      smartlock.lockAccount(this.loggedInUser)
      this.smartlockUnlocked = false
      this.$q.notify({
        message: 'SmartLock locked. The posting key was removed from memory.',
        color: 'orange',
        icon: 'lock',
        position: 'top'
      })
    },
    async unlockSmartlock () {
      if (!this.loggedInUser) return
      await this.getPasswordPrompt(this.loggedInUser)
    },
    async smartLockLockAccount (user) {
      if (!user) return
      try {
        const smartlock = await loadSmartlock()
        smartlock.lockAccount(user)
      } catch {}
    },
    getHiveAvatarUrl (user) { return hiveAvatarUrl(user) },
    getAccountLink (user) { return '/@' + user },
    getWalletLink (user) { return '/@' + user + '/wallet' },
    removeSavedUser (user) {
      this.savedUsers.splice(this.savedUsers.indexOf(user), 1)
      this.$q.localStorage.set('savedUsers', this.savedUsers)
    },
    async checkLoginSmartLock (user) {
      const smartlock = await loadSmartlock()
      if (smartlock.isAccountUnlocked(user, this.smartlockTimeoutMs)) {
        this.loggedInUser = user
        this.$q.sessionStorage.set('loggedInUser', user)
        this.loginType = 'smartlock'
        this.smartlockUnlocked = true
      } else {
        this.smartlockUnlocked = false
        this.getPasswordPrompt(user)
      }
    },
    async getPasswordPrompt (user) {
      const smartlock = await loadSmartlock()
      this.$q.dialog({
        title: 'Account ' + user + ' is locked',
        message: 'Enter your password to unlock account ' + user + '. Unlocked keys are kept in memory only, so you will need your password again after a page reload.',
        prompt: {
          model: '',
          type: 'password'
        },
        cancel: true,
        persistent: true
      }).onOk(async data => {
        try {
          await smartlock.unlockAccount(user, data, false)
          this.smartlockUnlocked = true
          this.checkLoginSmartLock(user)
        } catch {
          this.$q.notify({ type: 'negative', message: 'Could not unlock ' + user })
        }
      }).onCancel(() => {
        // cancel
      }).onDismiss(() => {
        // triggered by both ok and cancel
      })
    },
    async checkLoginKeychain (user) {
      const { success, msg, cancel, notInstalled, notActive } = await keychain(window, 'requestSignBuffer', user, 'hive.ausbit.dev login for ' + user, 'Posting')
      if (success) {
        this.loggedInUser = user
        this.$q.sessionStorage.set('loggedInUser', user)
        this.loginType = 'keychain'
        if (this.rememberLogin) {
          if (!this.savedUsers.includes(this.loggedInUser)) {
            this.$q.localStorage.set('savedUsers', this.savedUsers.concat([this.loggedInUser]))
            this.savedUsers = this.$q.localStorage.getItem('savedUsers')
          }
        }
      }
      if (!cancel) {
        if (notActive) {
          console.error('Please allow Keychain to access this website')
        } else if (notInstalled) {
          this.openKeychainInstallPage()
        } else {
          console.info(msg)
        }
      }
    },
    async checkLoginHiveAuth (user) {
      if (!user || this.hiveauthBusy) return
      this.hiveauthAccount = user
      this.hiveauthError = ''
      this.hiveauthQr = ''
      this.hiveauthQrError = ''
      this.hiveauthUri = ''
      this.hiveauthExpiresAt = 0
      this.hiveauthDialog = true
      this.hiveauthBusy = true
      this.startHiveAuthClock()
      const controller = new AbortController()
      this.hiveauthController = controller
      try {
        const hiveauth = await loadHiveAuth()
        if (!hiveauth.isAvailable()) {
          throw new Error('HiveAuth needs WebSocket and Web Crypto support in this browser.')
        }
        // HAS already validates key ownership during registration. The signed
        // challenge is kept in the response for future local verification
        // without adding another approval step.
        const challenge = 'hive.ausbit.dev login for ' + user + ' at ' + new Date().toISOString()
        await hiveauth.authenticate(user, {
          signal: controller.signal,
          challenge,
          onPayload: payload => this.prepareHiveAuthPayload(payload)
        })
        this.loggedInUser = user
        this.loginType = 'hiveauth'
        this.hiveauthDialog = false
        this.$q.notify({
          type: 'positive',
          message: 'Signed in with HiveAuth. Approve each action in your mobile wallet.',
          icon: 'smartphone',
          position: 'top',
          timeout: 6000
        })
      } catch (error) {
        if (error?.code === 'cancelled') return
        this.hiveauthError = error?.message || 'HiveAuth login failed.'
        this.$q.notify({
          type: 'negative',
          message: this.hiveauthError,
          position: 'top'
        })
      } finally {
        this.hiveauthBusy = false
        if (this.hiveauthController === controller) this.hiveauthController = null
        this.stopHiveAuthClock()
      }
    },
    prepareHiveAuthPayload (payload) {
      this.hiveauthExpiresAt = Number(payload.expire) || Date.now() + 60000
      this.hiveauthUri = payload.uri || ''
      this.hiveauthQrError = ''
      import('uqr').then(({ renderSVG }) => {
        if (!this.hiveauthDialog || this.hiveauthUri !== payload.uri) return
        this.hiveauthQr = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(
          renderSVG(payload.uri, { ecc: 'M', pixelSize: 6, border: 2 })
        )
      }).catch(() => {
        if (this.hiveauthDialog) {
          this.hiveauthQrError = 'Could not render the QR code. Use the link below.'
        }
      })
    },
    startHiveAuthClock () {
      this.stopHiveAuthClock()
      this.hiveauthClock = Date.now()
      this.hiveauthTimer = setInterval(() => {
        this.hiveauthClock = Date.now()
      }, 1000)
    },
    stopHiveAuthClock () {
      if (this.hiveauthTimer) clearInterval(this.hiveauthTimer)
      this.hiveauthTimer = null
    },
    async copyHiveAuthLink () {
      try {
        await copyToClipboard(this.hiveauthUri)
        this.$q.notify({
          message: 'Copied HiveAuth link',
          color: 'primary',
          icon: 'content_copy',
          position: 'top',
          timeout: 2000
        })
      } catch {
        this.$q.notify({
          type: 'negative',
          message: 'Could not copy the HiveAuth link.',
          position: 'top'
        })
      }
    },
    cancelHiveAuth () {
      this.hiveauthController?.abort()
      this.hiveauthController = null
      this.hiveauthDialog = false
      this.hiveauthQr = ''
      this.hiveauthQrError = ''
      this.hiveauthUri = ''
      this.hiveauthError = ''
      this.hiveauthExpiresAt = 0
      this.stopHiveAuthClock()
    },
    restoreHiveAuthSession () {
      if (this.loginType !== 'hiveauth' || !this.loggedInUser) return
      if (loadHiveAuthSession(this.loggedInUser)) return
      this.loggedInUser = ''
      this.loginType = ''
      this.$q.notify({
        type: 'warning',
        message: 'HiveAuth session expired. Sign in again.',
        position: 'top',
        timeout: 6000
      })
    },
    openKeychainInstallPage () {
      const installUrl = 'https://hive-keychain.com/'
      const openInstallPage = () => window.open(installUrl, '_blank', 'noopener,noreferrer')
      openInstallPage()
      this.$q.notify({
        type: 'info',
        message: 'Hive Keychain is not installed. Install the extension, then try again.',
        position: 'top',
        timeout: 8000,
        actions: [{ label: 'Open install page', color: 'white', handler: openInstallPage }]
      })
    },
    linkBlog (username) { return '/@' + username + '/blog' },
    linkPosts (username) { return '/@' + username + '/posts' },
    linkComments (username) { return '/@' + username + '/comments' },
    linkReplies (username) { return '/@' + username + '/replies' },
    linkFeed (username) { return '/@' + username + '/feed' },
    linkCommunities (username) { return '/@' + username + '/communities' },
    login (username) {
      this.loggedInUser = username
      this.$hiveStore.getAccount(this.loggedInUser, { force: true })
    },
    logout () {
      const account = this.loggedInUser
      this.cancelHiveAuth()
      if (account) clearHiveAuthSession(account)
      this.smartLockLockAccount(account)
      this.smartlockUnlocked = false
      this.loggedInUser = ''
      this.loginType = ''
      this.$hiveStore.clearNotificationsState()
      // The read-only v4v.app session lives in an async chunk; clear it if that
      // chunk is loaded without pulling it into the main bundle.
      window.dispatchEvent(new CustomEvent('hive:auth-logout'))
    }
  },
  mounted () {
    const savedUser = this.$q.sessionStorage.getItem('loggedInUser')
    if (savedUser) {
      this.login(savedUser)
      this.refreshSmartlockStatus()
      this.restoreHiveAuthSession()
    }
  },
  beforeUnmount () {
    this.stopHiveAuthClock()
    this.hiveauthController?.abort()
    this.hiveauthController = null
  }
}
</script>
