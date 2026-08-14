/**
 * Sistema de temas do Dívida Zero.
 *
 * Paleta clara: minimalista, arejada, com pouco contraste bruto e cor usada
 * apenas onde carrega significado (positivo / negativo / atenção).
 * Paleta escura: mesma semântica, superfícies neutras frias.
 *
 * Regra: nenhuma tela deve usar cor literal (`'#fff'`, `'rgba(...)'`) para algo
 * que exista aqui. Use `useTheme()` / `useThemedStyles()`.
 */

export type ThemeMode = 'light' | 'dark' | 'system';
export type ThemeName = 'light' | 'dark';

export interface ThemePalette {
  name: ThemeName;

  // Superfícies
  background: string;
  surface: string;
  surfaceAlt: string;
  surfaceSunken: string;
  elevated: string;

  // Traços
  border: string;
  borderStrong: string;
  divider: string;

  // Texto
  text: string;
  textSecondary: string;
  textLight: string;
  textInverse: string;

  // Semântica.
  // `x`      → cor de conteúdo (texto, ícone, borda) sobre `background`/`surface`
  // `xFill`  → cor de fundo preenchido, sempre legível com `onFill`
  // `xSoft`  → tinta suave para chips e faixas
  primary: string;
  primaryFill: string;
  primarySoft: string;
  success: string;
  successFill: string;
  successSoft: string;
  danger: string;
  dangerFill: string;
  dangerSoft: string;
  warning: string;
  warningFill: string;
  warningSoft: string;
  info: string;
  infoFill: string;
  infoSoft: string;
  /** Texto/ícone sobre qualquer `*Fill`. */
  onFill: string;

  // Navegação
  headerBg: string;
  headerText: string;
  drawerBg: string;
  drawerText: string;
  drawerTextSecondary: string;
  drawerActiveBg: string;

  // Diversos
  overlay: string;
  shadow: string;
  skeleton: string;

  chart: string[];
}

const chartLight = [
  '#4F46E5',
  '#0EA5E9',
  '#10B981',
  '#F59E0B',
  '#EF4444',
  '#8B5CF6',
  '#EC4899',
  '#14B8A6',
  '#F97316',
  '#64748B',
];

const chartDark = [
  '#818CF8',
  '#38BDF8',
  '#34D399',
  '#FBBF24',
  '#F87171',
  '#A78BFA',
  '#F472B6',
  '#2DD4BF',
  '#FB923C',
  '#94A3B8',
];

export const lightTheme: ThemePalette = {
  name: 'light',

  background: '#F7F8FA',
  surface: '#FFFFFF',
  surfaceAlt: '#F2F4F7',
  surfaceSunken: '#EDEFF3',
  elevated: '#FFFFFF',

  border: '#E7EAF0',
  borderStrong: '#D5DAE3',
  divider: '#EEF1F5',

  text: '#111827',
  textSecondary: '#5B6577',
  textLight: '#98A2B3',
  textInverse: '#FFFFFF',

  primary: '#4F46E5',
  primaryFill: '#4F46E5',
  primarySoft: '#EEF0FE',
  success: '#0F9D6E',
  successFill: '#0F9D6E',
  successSoft: '#E6F6F0',
  danger: '#DC2F35',
  dangerFill: '#DC2F35',
  dangerSoft: '#FDECEC',
  warning: '#B26A00',
  warningFill: '#B26A00',
  warningSoft: '#FDF3E2',
  info: '#0A7EA4',
  infoFill: '#0A7EA4',
  infoSoft: '#E5F4FA',
  onFill: '#FFFFFF',

  headerBg: '#FFFFFF',
  headerText: '#111827',
  drawerBg: '#FFFFFF',
  drawerText: '#111827',
  drawerTextSecondary: '#5B6577',
  drawerActiveBg: '#EEF0FE',

  overlay: 'rgba(17, 24, 39, 0.45)',
  shadow: '#0B1220',
  skeleton: '#EDEFF3',

  chart: chartLight,
};

export const darkTheme: ThemePalette = {
  name: 'dark',

  background: '#0C0E13',
  surface: '#151922',
  surfaceAlt: '#1C212C',
  surfaceSunken: '#11141B',
  elevated: '#1C212C',

  border: '#252B38',
  borderStrong: '#333B4B',
  divider: '#1F2530',

  text: '#E9EDF5',
  textSecondary: '#98A2B3',
  textLight: '#697586',
  textInverse: '#0C0E13',

  primary: '#A5A8FF',
  primaryFill: '#4F46E5',
  primarySoft: '#1E2044',
  success: '#3DD9A0',
  successFill: '#0F8F65',
  successSoft: '#0F2A22',
  danger: '#FF7B80',
  dangerFill: '#C7373C',
  dangerSoft: '#2E1618',
  warning: '#F5B544',
  warningFill: '#9A5B00',
  warningSoft: '#2A2011',
  info: '#5CC9E8',
  infoFill: '#0A6C8C',
  infoSoft: '#0F2630',
  onFill: '#FFFFFF',

  headerBg: '#151922',
  headerText: '#E9EDF5',
  drawerBg: '#11141B',
  drawerText: '#E9EDF5',
  drawerTextSecondary: '#98A2B3',
  drawerActiveBg: '#1F2140',

  overlay: 'rgba(0, 0, 0, 0.6)',
  shadow: '#000000',
  skeleton: '#1C212C',

  chart: chartDark,
};

export const THEMES: Record<ThemeName, ThemePalette> = {
  light: lightTheme,
  dark: darkTheme,
};

/** Escala de espaçamento — múltiplos de 4. */
export const SPACING = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
};

export const RADIUS = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  pill: 999,
};

/**
 * Sombras discretas — o visual minimalista depende mais de borda que de sombra.
 * `soft` é o padrão de cards; `none` para superfícies encostadas no fundo.
 */
export function cardShadow(palette: ThemePalette) {
  // No escuro, sombra some contra o fundo — a borda carrega a separação.
  if (palette.name === 'dark') {
    return {
      borderWidth: 1,
      borderColor: palette.border,
    };
  }
  return {
    borderWidth: 1,
    borderColor: palette.border,
    shadowColor: palette.shadow,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 3,
    elevation: 1,
  };
}

/** Cor de categoria ajustada para o tema — as pastéis somem no fundo claro. */
export function categoryColor(base: string, palette: ThemePalette): string {
  return palette.name === 'dark' ? lighten(base, 0.18) : darken(base, 0.12);
}

function clamp(n: number) {
  return Math.max(0, Math.min(255, Math.round(n)));
}

function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace('#', '');
  const full = h.length === 3 ? h.split('').map((c) => c + c).join('') : h;
  return [
    parseInt(full.slice(0, 2), 16),
    parseInt(full.slice(2, 4), 16),
    parseInt(full.slice(4, 6), 16),
  ];
}

function rgbToHex(r: number, g: number, b: number) {
  return `#${[r, g, b].map((v) => clamp(v).toString(16).padStart(2, '0')).join('')}`;
}

export function darken(hex: string, amount: number) {
  const [r, g, b] = hexToRgb(hex);
  return rgbToHex(r * (1 - amount), g * (1 - amount), b * (1 - amount));
}

export function lighten(hex: string, amount: number) {
  const [r, g, b] = hexToRgb(hex);
  return rgbToHex(r + (255 - r) * amount, g + (255 - g) * amount, b + (255 - b) * amount);
}

/** Versão translúcida de uma cor sólida — para fundos de badge/chip. */
export function alpha(hex: string, opacity: number) {
  const [r, g, b] = hexToRgb(hex);
  return `rgba(${r}, ${g}, ${b}, ${opacity})`;
}
