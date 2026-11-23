// Curated emoji for the composer picker.
//
// A small, predictable set avoids a new dependency and keeps the dialog fast.
// Each entry carries an accessible label; the character is what gets inserted.

export const EMOJI_GROUPS = [
  {
    id: 'smileys',
    label: 'Smileys',
    emoji: [
      { char: '😀', label: 'grinning face' },
      { char: '😄', label: 'smiling face' },
      { char: '😁', label: 'beaming face' },
      { char: '😊', label: 'smiling face with smiling eyes' },
      { char: '🙂', label: 'slightly smiling face' },
      { char: '😉', label: 'winking face' },
      { char: '😎', label: 'smiling face with sunglasses' },
      { char: '🤔', label: 'thinking face' },
      { char: '😅', label: 'grinning face with sweat' },
      { char: '😂', label: 'face with tears of joy' },
      { char: '🥳', label: 'partying face' },
      { char: '😴', label: 'sleeping face' }
    ]
  },
  {
    id: 'gestures',
    label: 'Gestures',
    emoji: [
      { char: '👍', label: 'thumbs up' },
      { char: '👎', label: 'thumbs down' },
      { char: '👏', label: 'clapping hands' },
      { char: '🙌', label: 'raising hands' },
      { char: '🤝', label: 'shaking hands' },
      { char: '🙏', label: 'folded hands' },
      { char: '👋', label: 'waving hand' },
      { char: '✌️', label: 'victory hand' },
      { char: '💪', label: 'flexed biceps' },
      { char: '👉', label: 'pointing right' },
      { char: '👀', label: 'eyes' },
      { char: '🫶', label: 'heart hands' }
    ]
  },
  {
    id: 'hive',
    label: 'Hive and work',
    emoji: [
      { char: '🐝', label: 'honeybee' },
      { char: '🍯', label: 'honey pot' },
      { char: '⚡', label: 'lightning' },
      { char: '🚀', label: 'rocket' },
      { char: '🛠️', label: 'tools' },
      { char: '💻', label: 'portable computer' },
      { char: '🧠', label: 'brain' },
      { char: '💡', label: 'light bulb' },
      { char: '📈', label: 'chart increasing' },
      { char: '📉', label: 'chart decreasing' },
      { char: '🗳️', label: 'ballot box' },
      { char: '⛓️', label: 'chains' }
    ]
  },
  {
    id: 'signals',
    label: 'Signals',
    emoji: [
      { char: '✅', label: 'check mark' },
      { char: '❌', label: 'cross mark' },
      { char: '⚠️', label: 'warning' },
      { char: 'ℹ️', label: 'information' },
      { char: '❓', label: 'question mark' },
      { char: '❗', label: 'exclamation mark' },
      { char: '🔥', label: 'fire' },
      { char: '⭐', label: 'star' },
      { char: '✨', label: 'sparkles' },
      { char: '🎉', label: 'party popper' },
      { char: '🏆', label: 'trophy' },
      { char: '🎯', label: 'direct hit' }
    ]
  },
  {
    id: 'life',
    label: 'Life',
    emoji: [
      { char: '❤️', label: 'red heart' },
      { char: '🧡', label: 'orange heart' },
      { char: '💚', label: 'green heart' },
      { char: '💙', label: 'blue heart' },
      { char: '☕', label: 'hot beverage' },
      { char: '🍺', label: 'beer mug' },
      { char: '🌱', label: 'seedling' },
      { char: '🌻', label: 'sunflower' },
      { char: '🌙', label: 'crescent moon' },
      { char: '☀️', label: 'sun' },
      { char: '🎵', label: 'musical note' },
      { char: '📷', label: 'photo camera' }
    ]
  },
  {
    id: 'objects',
    label: 'Objects',
    emoji: [
      { char: '📚', label: 'books' },
      { char: '📝', label: 'memo' },
      { char: '📅', label: 'calendar' },
      { char: '⏰', label: 'alarm clock' },
      { char: '🔗', label: 'link' },
      { char: '🔒', label: 'locked' },
      { char: '🔑', label: 'key' },
      { char: '🛡️', label: 'shield' },
      { char: '🧪', label: 'test tube' },
      { char: '🧩', label: 'puzzle piece' },
      { char: '📣', label: 'megaphone' },
      { char: '💬', label: 'speech balloon' }
    ]
  }
]

export const EMOJI_CHOICES = EMOJI_GROUPS.flatMap(group => group.emoji)
