// Hosts the app is willing to render inside an iframe. Keep this list shared
// between the post renderer and the HTML sanitizer so they cannot drift.
export const EMBED_HOSTS = [
  'youtube.com',
  'www.youtube.com',
  'www.youtube-nocookie.com',
  'youtu.be',
  'player.vimeo.com',
  'vimeo.com',
  '3speak.tv',
  'www.3speak.tv',
  'play.3speak.tv',
  'odysee.com',
  'rumble.com',
  'www.bitchute.com',
  'd.tube',
  'ipfs.io',
  'gateway.ipfs.io',
  'open.spotify.com',
  'w.soundcloud.com',
  'platform.twitter.com',
  'player.twitch.tv'
]
