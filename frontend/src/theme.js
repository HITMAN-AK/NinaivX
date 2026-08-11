// NinaivX — premium dark theme tokens
export const theme = {
  colors: {
    bg: '#0A0A0F',            // near-black app background
    bgElevated: '#121219',    // cards / surfaces
    bgInput: '#16161F',
    border: 'rgba(255,255,255,0.08)',
    borderStrong: 'rgba(255,255,255,0.14)',

    text: '#F5F5F7',          // primary text
    textDim: '#A1A1AA',       // secondary text
    textFaint: '#6B6B76',     // hints / captions

    // Brand accents
    violet: '#7C5CFC',
    indigo: '#4F46E5',
    teal: '#14B8A6',
    tealDeep: '#0D9488',

    // Persona-mode colors
    legacy: '#7C5CFC',        // deceased / legacy
    companion: '#14B8A6',     // companion

    danger: '#F87171',
    success: '#34D399',

    // gradients (use with expo-linear-gradient)
    gradViolet: ['#7C5CFC', '#4F46E5'],
    gradTeal: ['#14B8A6', '#0891B2'],
    gradDark: ['#15151F', '#0A0A0F'],
  },
  radius: { sm: 10, md: 14, lg: 20, xl: 28, pill: 999 },
  space: (n) => n * 4,
  font: {
    h1: 30, h2: 22, h3: 18, body: 15, small: 13, tiny: 11,
  },
  shadow: {
    // subtle glow for elevated cards
    card: {
      shadowColor: '#000',
      shadowOpacity: 0.4,
      shadowRadius: 16,
      shadowOffset: { width: 0, height: 8 },
      elevation: 8,
    },
  },
};
