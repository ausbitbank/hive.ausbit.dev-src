// CSV cell escaping shared by every export.
//
// Content that lands in a CSV cell is often user-controlled: a post title, an
// account name or a transfer memo. Spreadsheets treat a leading `=`, `+`, `-`,
// `@`, tab or carriage return as a formula, so quoting alone is not enough --
// Excel and Sheets still evaluate `"=1+1"` as a formula. Prefix the value with
// an apostrophe before the formula sigil so the cell stays literal text.
//
// `quote: false` keeps the historical wallet-export shape (quote only when the
// value contains a delimiter) while still neutralising formulas.

const FORMULA_LEAD = /^[=+\-@\t\r]/
const NEEDS_QUOTES = /[",\n\r]/

export function csvCell (value, { quote = true } = {}) {
  let text = value === null || value === undefined ? '' : String(value)
  if (FORMULA_LEAD.test(text)) text = "'" + text
  const quoted = quote || NEEDS_QUOTES.test(text)
  return quoted ? '"' + text.replace(/"/g, '""') + '"' : text
}
