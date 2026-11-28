import { defineBoot } from '#q-app'
import { setImageProxyMode } from 'src/services/imageProxy'
import { readStoredSettings } from 'src/services/userSettings'

// Apply the reader's image-proxy choice before the first post body renders.
// The service falls back to the default when the setting is absent or invalid.
export default defineBoot(() => {
  setImageProxyMode(readStoredSettings()?.imageProxy)
})
