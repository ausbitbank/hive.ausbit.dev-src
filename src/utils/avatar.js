// Hive avatar URLs.
//
// The image service serves 64px (`small`), 128px (`medium`) and 512px
// (`large`) variants. Most avatars in the app render at 16–46px, so the small
// variant cuts roughly 22 KB per avatar versus the default 128px image.

const AVATAR_ROOT = 'https://images.hive.blog/u/'

export const FALLBACK_AVATAR = '/statics/member.webp'

/**
 * @param {string} user Hive account or community name.
 * @param {'small'|'medium'|'large'|''} size Image variant; `small` by default.
 */
export function hiveAvatarUrl (user, size = 'small') {
  if (!user) return FALLBACK_AVATAR
  const name = encodeURIComponent(String(user))
  return AVATAR_ROOT + name + '/avatar' + (size ? '/' + size : '')
}
