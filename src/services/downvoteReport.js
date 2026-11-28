// Text exports for the downvote page. Kept pure so the CSV/Markdown shape can
// be tested without a browser download.

import { csvCell } from '../utils/csv'

export function formatUsd (value, { approximate = false } = {}) {
  const number = Number(value)
  if (!Number.isFinite(number) || number <= 0) return '—'
  const money = '$' + number.toFixed(2)
  return approximate ? '≈ ' + money : money
}

function rowNote (notes, row) {
  return notes?.[rowKey(row)] || null
}

function rowKey (row) {
  return row.index !== null && row.index !== undefined
    ? 'i:' + row.index
    : (row.trxId || '') + ':' + (row.voter || '')
}

function isoTime (row) {
  const time = Number(row.time)
  return Number.isFinite(time) && time > 0 ? new Date(time).toISOString() : (row.timestamp || '')
}

function weightPercent (weight) {
  const value = Number(weight)
  return Number.isFinite(value) ? (value / 100).toFixed(2) : ''
}

function ageHours (row) {
  const value = Number(row.postAgeHours)
  return Number.isFinite(value) ? value.toFixed(1) : ''
}

function sourceLabel (row) {
  if (row.impactSource === 'chain') return 'exact'
  if (row.impactSource === 'estimate') return 'estimated'
  return row.impactSource || 'none'
}

function noteForRow (notes, row) {
  return rowNote(notes, row)
}

/** CSV of the filtered rows, including local notes and impact provenance. */
export function buildDownvoteCsv (rows, { notes = {} } = {}) {
  const header = [
    'time_utc',
    'voter',
    'relationship',
    'weight_percent',
    'impact_usd',
    'impact_source',
    'impact_confidence',
    'post_age_hours',
    'payout_state',
    'after_payout',
    'target',
    'note',
    'tags'
  ]
  const lines = [header.map(csvCell).join(',')]
  for (const row of Array.isArray(rows) ? rows : []) {
    const note = noteForRow(notes, row)
    lines.push([
      isoTime(row),
      row.voter || '',
      row.relationship || '',
      weightPercent(row.weight),
      Number.isFinite(Number(row.impactUsd)) ? Number(row.impactUsd).toFixed(4) : '',
      sourceLabel(row),
      row.impactConfidence || '',
      ageHours(row),
      row.payoutState || '',
      row.afterPayout ? 'yes' : 'no',
      row.target || row.author + '/' + row.permlink,
      note?.note || '',
      (note?.tags || []).join('; ')
    ].map(csvCell).join(','))
  }
  return lines.join('\n')
}

function mdCell (value) {
  return String(value ?? '').replace(/\|/g, '\\|').replace(/\s+/g, ' ').trim()
}

function table (header, rows) {
  const lines = [
    '| ' + header.map(mdCell).join(' | ') + ' |',
    '| ' + header.map(() => '---').join(' | ') + ' |'
  ]
  for (const row of rows) lines.push('| ' + row.map(mdCell).join(' | ') + ' |')
  return lines.join('\n')
}

function patternList (title, rows, render) {
  if (!rows || !rows.length) return []
  return ['### ' + title, '', ...rows.map(render), '']
}

/**
 * Markdown case file for the selected period. Rows are capped at 500 so the
 * report stays readable; the CSV export keeps every filtered row.
 */
export function buildDownvoteReport ({
  username = '',
  direction = 'received',
  rangeLabel = '',
  generatedAt = new Date(),
  summary = {},
  impact = {},
  rows = [],
  notes = {},
  patterns = {},
  rewardsComparison = null
} = {}) {
  const list = Array.isArray(rows) ? rows : []
  const lines = []
  lines.push('# Downvote report for @' + (username || 'account'))
  lines.push('')
  lines.push('- Direction: ' + direction)
  lines.push('- Range: ' + (rangeLabel || 'loaded history'))
  lines.push('- Generated: ' + new Date(generatedAt).toISOString())
  lines.push('- Base: banksia.io/@' + (username || '') + '/downvotes')
  lines.push('')
  lines.push('## Financial summary')
  lines.push('')
  lines.push('- Downvotes: **' + (summary.count || 0) + '** · targets: **' + (summary.distinctTargets || 0) + '** · voters: **' + (summary.distinctVoters || 0) + '**')
  lines.push('- Estimated / exact deducted: **' + formatUsd(impact.totalUsd) + '**')
  lines.push('- Finalized: **' + formatUsd(impact.finalizedUsd) + '** · pending: **' + formatUsd(impact.pendingUsd) + '**')
  lines.push('- Exact coverage: **' + Math.round((impact.exactCoverage || 0) * 100) + '%** (' + (impact.exactCount || 0) + ' of ' + (impact.effectiveCount || 0) + ' effective rows)')
  lines.push('- Post-payout signal votes: **' + (impact.afterPayoutCount || 0) + '** (no payout impact)')
  lines.push('- Author share (approx): **' + formatUsd(impact.authorUsd) + '** · curators/beneficiaries: **' + formatUsd(impact.curatorUsd) + '**')
  lines.push('')
  if (rewardsComparison) {
    lines.push('### Same-period author rewards')
    lines.push('')
    lines.push('- Author rewards: **' + formatUsd(rewardsComparison.rewardsUsd) + '**')
    lines.push('- Finalized downvote loss: **' + formatUsd(rewardsComparison.lossUsd) + '**')
    lines.push('- Share of counterfactual author rewards: **' + (rewardsComparison.sharePercent === null ? '—' : rewardsComparison.sharePercent.toFixed(1) + '%') + '**')
    lines.push('')
  }
  lines.push('## Top voters')
  lines.push('')
  lines.push(table(
    ['Voter', 'Votes', 'Impact', 'Exact'],
    (impact.topVoters || []).slice(0, 8).map(group => [
      '@' + group.key,
      group.count,
      formatUsd(group.totalUsd),
      group.exactCount + '/' + group.effectiveCount
    ])
  ))
  lines.push('')
  lines.push('## Top targets')
  lines.push('')
  lines.push(table(
    ['Target', 'Votes', 'Impact'],
    (impact.topTargets || []).slice(0, 8).map(group => [
      group.key,
      group.count,
      formatUsd(group.totalUsd)
    ])
  ))
  lines.push('')
  const patternLines = [
    ...patternList('Repeat targeting', patterns.repeatTargeting, entry =>
      '- @' + entry.key + ' — ' + entry.count + ' votes (' + Math.round((entry.share || 0) * 100) + '% of loaded), ' + formatUsd(entry.totalUsd)),
    ...patternList('Bursts on one target', patterns.targetBursts, entry =>
      '- ' + entry.target + ' — ' + entry.count + ' votes from ' + entry.voters.length + ' voters in ' + Math.round((entry.end - entry.start) / 60000) + 'm'),
    ...patternList('Voter bursts', patterns.voterBursts, entry =>
      '- @' + entry.voter + ' — ' + entry.count + ' votes across ' + entry.targets.length + ' targets in ' + Math.round((entry.end - entry.start) / 60000) + 'm'),
    ...patternList('Vote changes on one target', patterns.voteChanges, entry =>
      '- @' + entry.voter + ' on ' + entry.target + ' — ' + entry.count + ' votes, ' + (entry.firstWeight / 100).toFixed(1) + '% → ' + (entry.lastWeight / 100).toFixed(1) + '%'),
    ...patternList('Weight escalation', patterns.weightEscalation, entry =>
      '- @' + entry.voter + ' — ' + (entry.firstWeight / 100).toFixed(1) + '% → ' + (entry.lastWeight / 100).toFixed(1) + '% across ' + entry.count + ' votes'),
    ...patternList('New accounts', patterns.newVoterAccounts, entry =>
      '- @' + entry.voter + ' — account was ' + entry.ageDays.toFixed(1) + ' days old at first downvote'),
    ...patternList('Post-payout signal votes', patterns.postPayoutSignals?.rows, entry =>
      '- ' + entry.target + ' — @' + entry.voter + ' at ' + isoTime(entry))
  ]
  if (patternLines.length) {
    lines.push('## Patterns')
    lines.push('')
    lines.push(...patternLines)
  }
  const noted = list.filter(row => noteForRow(notes, row))
  if (noted.length) {
    lines.push('## Your notes')
    lines.push('')
    for (const row of noted) {
      const note = noteForRow(notes, row)
      lines.push('- **' + isoTime(row) + ' · @' + row.voter + ' · ' + (row.target || '') + '** — ' + (note.note || '(no text)') + (note.tags?.length ? ' _[' + note.tags.join(', ') + ']_' : ''))
    }
    lines.push('')
  }
  lines.push('## Downvotes')
  lines.push('')
  lines.push(table(
    ['Time', 'Voter', 'Weight', 'Impact', 'Source', 'Post age', 'Payout', 'Target', 'Note'],
    list.slice(0, 500).map(row => {
      const note = noteForRow(notes, row)
      return [
        isoTime(row),
        '@' + row.voter,
        (Number(row.weight) / 100).toFixed(1) + '%',
        row.effective ? formatUsd(row.impactUsd, { approximate: row.impactConfidence !== 'exact' }) : '—',
        sourceLabel(row),
        Number.isFinite(Number(row.postAgeHours)) ? Number(row.postAgeHours).toFixed(1) + 'h' : '—',
        row.afterPayout ? 'after payout' : (row.payoutState || '—'),
        row.target || '',
        note ? (note.note || note.tags.join(', ')) : ''
      ]
    })
  ))
  if (list.length > 500) {
    lines.push('')
    lines.push('_Showing the first 500 of ' + list.length + ' filtered rows. Use the CSV export for the full set._')
  }
  lines.push('')
  lines.push('> A downvote has no on-chain reason. Comments are context, not proof. Dollar figures use the post payout share and are labelled exact only when the target post and vote rshares are available.')
  return lines.join('\n')
}

export function reportFilename (username, direction, extension = 'csv', now = new Date()) {
  const day = new Date(now).toISOString().slice(0, 10)
  return 'banksia-downvotes-' + String(username || 'account') + '-' + String(direction || 'received') + '-' + day + '.' + extension
}

export { rowKey }
