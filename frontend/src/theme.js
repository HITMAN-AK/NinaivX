// NinaivX — premium dark theme tokens
export const theme = {
  colors: {
    bg: '#08080C',            // near-black app background
    bgHeader: 'rgba(10,10,15,0.92)', // sticky header (semi-opaque for depth)
    bgElevated: '#131320',    // cards / surfaces
    bgElevated2: '#1A1A2A',   // raised surfaces (inputs on cards, chips)
    bgInput: '#17171F',
    overlay: 'rgba(0,0,0,0.55)',

    border: 'rgba(255,255,255,0.08)',
    borderStrong: 'rgba(255,255,255,0.16)',
    hairline: 'rgba(255,255,255,0.06)',

    text: '#F6F6F9',          // primary text
    textDim: '#AEAEBA',       // secondary text
    textFaint: '#71717F',     // hints / captions

    // Brand accents
    violet: '#8B6DFF',
    violetSoft: '#A78BFA',
    indigo: '#4F46E5',
    teal: '#2DD4BF',
    tealDeep: '#0D9488',

    // Persona-mode colors
    legacy: '#8B6DFF',        // deceased / legacy
    companion: '#2DD4BF',     // companion

    danger: '#FB7185',
    success: '#34D399',
    warning: '#FBBF24',

    // gradients (use with expo-linear-gradient)
    gradViolet: ['#8B6DFF', '#5B45E0'],
    gradTeal: ['#2DD4BF', '#0891B2'],
    gradDark: ['#16161F', '#08080C'],
    gradSheen: ['rgba(255,255,255,0.10)', 'rgba(255,255,255,0)'],
  },
  radius: { sm: 10, md: 14, lg: 20, xl: 28, pill: 999 },
  space: (n) => n * 4,
  font: {
    display: 34, h1: 30, h2: 22, h3: 18, body: 15, small: 13, tiny: 11,
  },
  shadow: {
    // subtle glow for elevated cards
    card: {
      shadowColor: '#000',
      shadowOpacity: 0.45,
      shadowRadius: 18,
      shadowOffset: { width: 0, height: 10 },
      elevation: 8,
    },
    // coloured glow for primary buttons / accents
    glowViolet: {
      shadowColor: '#8B6DFF',
      shadowOpacity: 0.45,
      shadowRadius: 20,
      shadowOffset: { width: 0, height: 8 },
      elevation: 10,
    },
    glowTeal: {
      shadowColor: '#2DD4BF',
      shadowOpacity: 0.4,
      shadowRadius: 20,
      shadowOffset: { width: 0, height: 8 },
      elevation: 10,
    },
  },
};
