// Apply the last chosen appearance before first paint so a light theme never
// flashes the dark boot splash. The full theme is applied in the theme boot
// file; this only needs the base colours.
//
// Kept as an external file so the CSP can forbid inline script entirely.
;(function () {
  try {
    var raw = localStorage.getItem('ausbit:appearance:boot')
    if (!raw) return
    var theme = JSON.parse(raw)
    if (!theme || !theme.bg || !theme.text) return
    var root = document.documentElement
    root.dataset.theme = theme.id || 'hive-dark'
    root.dataset.mode = theme.mode === 'light' ? 'light' : 'dark'
    root.style.colorScheme = theme.mode === 'light' ? 'light' : 'dark'
    root.style.setProperty('--c-bg', theme.bg)
    root.style.setProperty('--c-text', theme.text)
    if (theme.primary) root.style.setProperty('--c-primary', theme.primary)
    var meta = document.querySelector('meta[name="theme-color"]')
    if (meta) meta.setAttribute('content', theme.bg)
  } catch (error) {
    // Storage can be unavailable in private mode; keep the dark default.
  }
})()
