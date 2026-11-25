import { defineBoot } from '#q-app'

// The phishing safety floor is on by default and applies to guests too. Start
// the cached list read early so the first feed render is protected, but keep it
// out of the initial bundle and never block first paint.
export default defineBoot(() => {
  if (typeof window === 'undefined') return
  import('src/services/safetyFloor')
    .then(({ ensureSafetyFloor }) => ensureSafetyFloor())
    .catch(() => {})
})
