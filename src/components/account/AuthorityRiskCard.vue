<template>
  <q-card flat bordered class="authority-risk">
    <q-card-section>
      <div class="authority-risk__head">
        <div>
          <div class="authority-risk__eyebrow">Authority review</div>
          <h2 class="authority-risk__title">Authority risk</h2>
        </div>
        <q-badge :color="badgeColor" :text-color="badgeTextColor" :label="badgeLabel" />
      </div>

      <p class="authority-risk__summary">
        <template v-if="risk.findings.length">
          {{ risk.findings.length }} observable signal{{ risk.findings.length === 1 ? '' : 's' }} across owner, active and posting permissions.
        </template>
        <template v-else>
          No authority warnings were found in the current permissions.
        </template>
      </p>

      <ul v-if="risk.findings.length" class="authority-risk__findings">
        <li v-for="item in risk.findings" :key="item.id" :class="'authority-risk__finding authority-risk__finding--' + item.severity">
          <q-icon :name="item.icon" size="17px" aria-hidden="true" />
          <div>
            <div class="authority-risk__finding-label">{{ item.label }}</div>
            <div class="authority-risk__finding-detail">{{ item.detail }}</div>
          </div>
        </li>
      </ul>

      <div class="authority-risk__permissions">
        <div class="authority-risk__permissions-title">Permission summary</div>
        <table>
          <caption class="sr-only">Keys, account authorities and thresholds per permission</caption>
          <thead>
            <tr>
              <th scope="col">Permission</th>
              <th scope="col" class="authority-risk__num">Keys</th>
              <th scope="col" class="authority-risk__num">Accounts</th>
              <th scope="col" class="authority-risk__num">Threshold</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="permission in permissions" :key="permission">
              <th scope="row">{{ permission }}</th>
              <td class="authority-risk__num">{{ risk.permissions[permission]?.keyCount ?? 0 }}</td>
              <td class="authority-risk__num">{{ risk.permissions[permission]?.accountCount ?? 0 }}</td>
              <td class="authority-risk__num">{{ risk.permissions[permission]?.weight_threshold ?? 0 }}</td>
            </tr>
          </tbody>
        </table>
      </div>

      <div v-if="risk.ownerAgeDays !== null" class="authority-risk__age">
        <q-icon name="history" size="15px" aria-hidden="true" />
        <span>Owner authority last updated {{ ownerAgeLabel }}.</span>
      </div>

      <div v-if="risk.queuedChanges.length" class="authority-risk__queued">
        <div class="authority-risk__queued-title">Queued permission change</div>
        <ul>
          <li v-for="change in risk.queuedChanges" :key="change.index">
            <div class="authority-risk__queued-op">{{ change.operation }} · {{ change.diff?.changed || 0 }} change{{ change.diff?.changed === 1 ? '' : 's' }}</div>
            <ul class="authority-risk__diff">
              <li v-for="(line, index) in diffLines(change.diff)" :key="index">{{ line }}</li>
              <li v-if="diffLines(change.diff).length === 0">No readable permission changes were found.</li>
            </ul>
          </li>
        </ul>
      </div>

      <p class="authority-risk__note">
        Signals are descriptive, not proof of compromise. Keys are never displayed here; review the authority card below before changing them.
      </p>
    </q-card-section>
  </q-card>
</template>

<script>
import { authorityRisk } from 'src/services/authority'

const PERMISSIONS = ['owner', 'active', 'posting']

export default {
  name: 'AuthorityRiskCard',
  props: {
    account: { type: Object, required: true },
    witness: { type: Object, default: null }
  },
  computed: {
    risk () {
      return authorityRisk(this.account, { queue: this.$hiveStore.queue })
    },
    permissions () {
      return PERMISSIONS
    },
    badgeColor () {
      if (this.risk.level === 'high') return 'red-9'
      if (this.risk.level === 'medium') return 'orange-9'
      return 'green-9'
    },
    badgeLabel () {
      if (this.risk.level === 'high') return 'High risk signals'
      if (this.risk.level === 'medium') return 'Review suggested'
      return 'Low risk'
    },
    badgeTextColor () {
      return this.risk.level === 'medium' ? 'black' : 'white'
    },
    ownerAgeLabel () {
      const days = this.risk.ownerAgeDays
      if (days === null) return 'unknown'
      if (days < 1) return 'today'
      if (days < 60) return Math.round(days) + ' days ago'
      if (days < 730) return Math.round(days / 30) + ' months ago'
      return (Math.round(days / 36.5) / 10).toFixed(1) + ' years ago'
    }
  },
  methods: {
    diffLines (diff) {
      if (!diff) return []
      const lines = []
      for (const permission of PERMISSIONS) {
        const row = diff.permissions[permission]
        for (const entry of row.keys.added) lines.push(permission + ': key added at weight ' + entry.weight)
        for (const entry of row.keys.removed) lines.push(permission + ': key removed at weight ' + entry.weight)
        for (const entry of row.keys.changed) lines.push(permission + ': key weight ' + entry.before + ' → ' + entry.after)
        for (const entry of row.accounts.added) lines.push(permission + ': @' + entry.account + ' added at weight ' + entry.weight)
        for (const entry of row.accounts.removed) lines.push(permission + ': @' + entry.account + ' removed')
        for (const entry of row.accounts.changed) lines.push(permission + ': @' + entry.account + ' weight ' + entry.before + ' → ' + entry.after)
        if (row.threshold.changed) lines.push(permission + ': threshold ' + row.threshold.before + ' → ' + row.threshold.after)
      }
      return lines
    }
  }
}
</script>

<style scoped>
.authority-risk {
  overflow: hidden;
  border-radius: var(--radius-card);
}

.authority-risk__head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: var(--space-2);
  flex-wrap: wrap;
}

.authority-risk__eyebrow {
  color: var(--c-text-faint);
  font-size: 0.64rem;
  letter-spacing: 0.06em;
  text-transform: uppercase;
}

.authority-risk__title {
  margin: 0.1rem 0 0;
  color: var(--c-text);
  font-size: 0.9rem;
  font-weight: 600;
}

.authority-risk__summary {
  margin: 0.35rem 0 0.6rem;
  color: var(--c-text-subtle);
  font-size: 0.76rem;
  line-height: 1.45;
}

.authority-risk__findings {
  display: flex;
  flex-direction: column;
  gap: 0.45rem;
  margin: 0;
  padding: 0;
  list-style: none;
}

.authority-risk__finding {
  display: flex;
  align-items: flex-start;
  gap: 0.45rem;
  padding: 0.45rem 0.5rem;
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-sm);
  background: color-mix(in srgb, var(--c-text) 2%, transparent);
}

.authority-risk__finding--critical {
  border-color: color-mix(in srgb, var(--c-negative) 40%, transparent);
  background: color-mix(in srgb, var(--c-negative) 6%, transparent);
  color: var(--c-negative);
}

.authority-risk__finding--warning {
  border-color: color-mix(in srgb, var(--c-warning) 32%, transparent);
  background: color-mix(in srgb, var(--c-warning) 5%, transparent);
  color: var(--c-warning-soft);
}

.authority-risk__finding--info {
  color: var(--c-link-hover);
}

.authority-risk__finding-label {
  color: var(--c-text);
  font-size: 0.78rem;
  font-weight: 600;
}

.authority-risk__finding-detail {
  color: var(--c-text-muted);
  font-size: 0.72rem;
  line-height: 1.4;
}

.authority-risk__permissions {
  margin-top: 0.7rem;
  padding-top: 0.6rem;
  border-top: 1px solid var(--border-subtle);
}

.authority-risk__permissions-title {
  color: var(--c-text-faint);
  font-size: 0.64rem;
  letter-spacing: 0.05em;
  text-transform: uppercase;
}

.authority-risk__permissions table {
  width: 100%;
  margin-top: 0.25rem;
  border-collapse: collapse;
  font-size: 0.74rem;
}

.authority-risk__permissions th,
.authority-risk__permissions td {
  padding: 0.25rem 0.15rem;
  border-top: 1px solid var(--border-subtle);
  text-align: left;
  text-transform: capitalize;
}

.authority-risk__permissions thead th {
  border-top: 0;
  color: var(--c-text-faint);
  font-size: 0.62rem;
  font-weight: 500;
  letter-spacing: 0.04em;
  text-transform: uppercase;
}

.authority-risk__permissions tbody th {
  color: var(--c-text-soft);
  font-weight: 500;
}

.authority-risk__num {
  text-align: right !important;
  font-variant-numeric: tabular-nums;
}

.authority-risk__age {
  display: flex;
  align-items: center;
  gap: 0.35rem;
  margin-top: 0.55rem;
  color: var(--c-text-subtle);
  font-size: 0.72rem;
}

.authority-risk__queued {
  margin-top: 0.65rem;
  padding: 0.5rem;
  border: 1px solid color-mix(in srgb, var(--c-link) 30%, transparent);
  border-radius: var(--radius-sm);
  background: color-mix(in srgb, var(--c-link) 5%, transparent);
}

.authority-risk__queued-title {
  color: var(--c-link-hover);
  font-size: 0.66rem;
  letter-spacing: 0.05em;
  text-transform: uppercase;
}

.authority-risk__queued-op {
  margin-top: 0.2rem;
  color: var(--c-text);
  font-size: 0.74rem;
  font-family: monospace;
}

.authority-risk__diff {
  margin: 0.25rem 0 0;
  padding-left: 1rem;
  color: var(--c-text-muted);
  font-size: 0.7rem;
  line-height: 1.4;
}

.authority-risk__note {
  margin: 0.65rem 0 0;
  color: var(--c-text-faint);
  font-size: 0.68rem;
  line-height: 1.4;
}
</style>
