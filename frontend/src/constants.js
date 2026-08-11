// Conversation languages. `name` is stored on the persona (drives Claude + TTS);
// `code` is the ISO tag used to filter the ElevenLabs Voice Library.
// This list feeds the type-to-search language dropdown in the voice picker,
// so it covers the main languages ElevenLabs supports.
export const LANGUAGES = [
  { name: 'English', code: 'en' },
  { name: 'Tamil', code: 'ta' },
  { name: 'Hindi', code: 'hi' },
  { name: 'Telugu', code: 'te' },
  { name: 'Malayalam', code: 'ml' },
  { name: 'Kannada', code: 'kn' },
  { name: 'Bengali', code: 'bn' },
  { name: 'Marathi', code: 'mr' },
  { name: 'Gujarati', code: 'gu' },
  { name: 'Punjabi', code: 'pa' },
  { name: 'Urdu', code: 'ur' },
  { name: 'Spanish', code: 'es' },
  { name: 'French', code: 'fr' },
  { name: 'German', code: 'de' },
  { name: 'Italian', code: 'it' },
  { name: 'Portuguese', code: 'pt' },
  { name: 'Dutch', code: 'nl' },
  { name: 'Polish', code: 'pl' },
  { name: 'Russian', code: 'ru' },
  { name: 'Ukrainian', code: 'uk' },
  { name: 'Turkish', code: 'tr' },
  { name: 'Arabic', code: 'ar' },
  { name: 'Persian', code: 'fa' },
  { name: 'Hebrew', code: 'he' },
  { name: 'Mandarin', code: 'zh' },
  { name: 'Japanese', code: 'ja' },
  { name: 'Korean', code: 'ko' },
  { name: 'Vietnamese', code: 'vi' },
  { name: 'Thai', code: 'th' },
  { name: 'Indonesian', code: 'id' },
  { name: 'Filipino', code: 'fil' },
  { name: 'Malay', code: 'ms' },
  { name: 'Greek', code: 'el' },
  { name: 'Swedish', code: 'sv' },
  { name: 'Norwegian', code: 'no' },
  { name: 'Danish', code: 'da' },
  { name: 'Finnish', code: 'fi' },
  { name: 'Czech', code: 'cs' },
  { name: 'Romanian', code: 'ro' },
  { name: 'Hungarian', code: 'hu' },
];

export const codeForLanguage = (name) =>
  (LANGUAGES.find((l) => l.name.toLowerCase() === (name || '').toLowerCase()) || {}).code || null;

export const nameForLanguageCode = (code) =>
  (LANGUAGES.find((l) => l.code === (code || '').toLowerCase()) || {}).name || null;
