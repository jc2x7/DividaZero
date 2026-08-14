import React, {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  useCallback,
} from 'react';
import { StyleSheet, useColorScheme } from 'react-native';
import { ThemeMode, ThemeName, ThemePalette, THEMES } from '../constants/theme';
import { getSetting, setSetting } from '../database/database';

const THEME_SETTING_KEY = 'theme_mode';

interface ThemeContextValue {
  /** Preferência salva pelo usuário. */
  mode: ThemeMode;
  /** Tema efetivamente aplicado (resolve `system`). */
  name: ThemeName;
  theme: ThemePalette;
  setMode: (mode: ThemeMode) => void;
  /** Alterna claro ↔ escuro (sai do modo `system`). */
  toggle: () => void;
}

const ThemeContext = createContext<ThemeContextValue>({
  mode: 'system',
  name: 'light',
  theme: THEMES.light,
  setMode: () => {},
  toggle: () => {},
});

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const systemScheme = useColorScheme();
  const [mode, setModeState] = useState<ThemeMode>('system');

  // Carrega a preferência salva. Falha silenciosa cai no padrão `system`.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const saved = await getSetting(THEME_SETTING_KEY);
        if (!cancelled && (saved === 'light' || saved === 'dark' || saved === 'system')) {
          setModeState(saved);
        }
      } catch {
        // Banco ainda não pronto — mantém o padrão.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const setMode = useCallback((next: ThemeMode) => {
    setModeState(next);
    setSetting(THEME_SETTING_KEY, next).catch(() => {});
  }, []);

  const name: ThemeName =
    mode === 'system' ? (systemScheme === 'dark' ? 'dark' : 'light') : mode;

  const toggle = useCallback(() => {
    setMode(name === 'dark' ? 'light' : 'dark');
  }, [name, setMode]);

  const value = useMemo<ThemeContextValue>(
    () => ({ mode, name, theme: THEMES[name], setMode, toggle }),
    [mode, name, setMode, toggle]
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  return useContext(ThemeContext);
}

type NamedStyles = Record<string, object>;

/**
 * Cria a folha de estilos a partir do tema atual, recriando-a só quando o tema
 * muda. Uso:
 *
 *   const makeStyles = (t: ThemePalette) => StyleSheet.create({ ... });
 *   ...
 *   const styles = useThemedStyles(makeStyles);
 */
export function useThemedStyles<T extends NamedStyles>(
  factory: (theme: ThemePalette) => T
): T {
  const { theme } = useTheme();
  // A factory costuma ser definida no escopo do módulo (identidade estável),
  // mas guardamos a última para não recriar estilos à toa se for inline.
  const factoryRef = useRef(factory);
  factoryRef.current = factory;
  return useMemo(() => StyleSheet.create(factoryRef.current(theme) as never) as T, [theme]);
}
