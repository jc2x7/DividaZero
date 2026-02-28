export const COLORS = {
  primary: '#1A1A2E',
  secondary: '#16213E',
  accent: '#0F3460',
  highlight: '#E94560',
  success: '#00B894',
  warning: '#FDCB6E',
  error: '#D63031',
  info: '#0984E3',
  background: '#F0F2F5',
  surface: '#FFFFFF',
  text: '#2D3436',
  textSecondary: '#636E72',
  textLight: '#B2BEC3',
  border: '#DFE6E9',
  card: '#FFFFFF',
  drawerBg: '#1A1A2E',
  drawerText: '#FFFFFF',
  drawerTextSecondary: '#B2BEC3',
  drawerActive: '#E94560',

  // Charts
  chart: [
    '#FF6B6B',
    '#4ECDC4',
    '#45B7D1',
    '#96CEB4',
    '#FFEAA7',
    '#A29BFE',
    '#FD79A8',
    '#FDCB6E',
    '#74B9FF',
    '#B2BEC3',
  ],

  // Gradient
  gradientStart: '#1A1A2E',
  gradientEnd: '#E94560',
};

export const CHART_CONFIG = {
  backgroundColor: COLORS.card,
  backgroundGradientFrom: COLORS.secondary,
  backgroundGradientTo: COLORS.accent,
  decimalPlaces: 2,
  color: (opacity = 1) => `rgba(233, 69, 96, ${opacity})`,
  labelColor: (opacity = 1) => `rgba(255, 255, 255, ${opacity})`,
  style: { borderRadius: 16 },
  propsForDots: {
    r: '6',
    strokeWidth: '2',
    stroke: COLORS.highlight,
  },
};
