// Pure geometry for the dashboard grid's edit mode.
//
// The component measures the rendered cards and feeds plain rectangles here;
// everything below is deterministic so the drop maths can be unit tested
// without mounting Vue. Coordinates are CSS pixels from `getBoundingClientRect`.

/** Normalise a DOMRect-like or `{ x, y, width, height }` into `{ x, y, width, height }`. */
export function toRect (rect) {
  if (!rect) return { x: 0, y: 0, width: 0, height: 0 }
  if (typeof rect.left === 'number' && typeof rect.width === 'number') {
    return { x: rect.left, y: rect.top, width: rect.width, height: rect.height }
  }
  return {
    x: Number(rect.x) || 0,
    y: Number(rect.y) || 0,
    width: Number(rect.width) || 0,
    height: Number(rect.height) || 0
  }
}

export function centreX (rect) {
  const r = toRect(rect)
  return r.x + r.width / 2
}

/**
 * Group card rectangles into visual rows. Widgets pack left to right, so a
 * card that starts below the previous row's bottom edge begins a new row.
 * Returns arrays of indices into `rects`.
 */
export function groupIntoRows (rects) {
  const rows = []
  let current = []
  let bottom = -Infinity
  ;(Array.isArray(rects) ? rects : []).forEach((raw, index) => {
    const rect = toRect(raw)
    if (current.length && rect.y >= bottom - 1) {
      rows.push(current)
      current = []
    }
    current.push(index)
    bottom = current.length === 1 ? rect.y + rect.height : Math.max(bottom, rect.y + rect.height)
  })
  if (current.length) rows.push(current)
  return rows
}

/**
 * Resolve a pointer position to the card it is over and which side to insert
 * on: `{ index, edge: 'before' | 'after' }`, where `index` indexes `rects`.
 *
 * The row is the one whose vertical band is nearest the pointer (later rows win
 * ties, so a pointer just under a row inserts after it). Within the row, the
 * card whose centre is nearest horizontally is the target; the left half
 * inserts before it, the right half after.
 */
export function dropTargetFor ({ rects, x, y }) {
  const list = (Array.isArray(rects) ? rects : []).map(toRect)
  if (!list.length) return null

  const rows = groupIntoRows(list)
  let row = rows[0]
  let best = Infinity
  for (const candidate of rows) {
    const top = Math.min(...candidate.map(i => list[i].y))
    const bottomRow = Math.max(...candidate.map(i => list[i].y + list[i].height))
    const distance = y < top ? top - y : y > bottomRow ? y - bottomRow : 0
    if (distance <= best) {
      best = distance
      row = candidate
    }
  }

  let target = row[0]
  let nearest = Infinity
  for (const index of row) {
    const dx = Math.abs(centreX(list[index]) - x)
    if (dx < nearest) {
      nearest = dx
      target = index
    }
  }

  return { index: target, edge: x < centreX(list[target]) ? 'before' : 'after' }
}

/** Insertion position among `rects` for a drop target ('' when no target). */
export function insertIndexFor (target) {
  if (!target) return -1
  return target.edge === 'before' ? target.index : target.index + 1
}

/**
 * Whether a pointer has moved far enough to count as a drag. A small slop
 * keeps a click on the drag handle from starting a zero-distance drag.
 */
export function isDragGesture (dx, dy, slop = 5) {
  return Math.abs(Number(dx) || 0) + Math.abs(Number(dy) || 0) >= slop
}

/**
 * The index `moveWidget(layout, id, toIndex)` needs so a widget dragged from
 * `from` lands at visual insertion position `insert` among the widgets that
 * stay put. `moveWidget` removes the dragged widget first, then splices, so
 * the visual insertion position is the target index directly.
 */
export function moveTargetFor (insert, count) {
  const total = Math.max(0, Number(count) || 0)
  return Math.max(0, Math.min(total, Math.round(Number(insert) || 0)))
}
