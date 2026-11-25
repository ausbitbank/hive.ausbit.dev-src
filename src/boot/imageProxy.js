import { defineBoot } from '#q-app'
import { LocalStorage } from 'quasar'
import { setImageProxyMode } from 'src/services/imageProxy'

// Apply the reader's image-proxy choice before the first post body renders.
// The service falls back to the default when the setting is absent or invalid.
export default defineBoot(() => {
  let settings
  try {
    settings = LocalStorage.getItem('settings')
  } catch {
    settings = null
  }
  setImageProxyMode(settings?.imageProxy)
})
