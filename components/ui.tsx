import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ViewStyle,
  TextStyle,
  StyleProp,
  ActivityIndicator,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useTheme, useThemedStyles } from '../hooks/useTheme';
import { ThemePalette, RADIUS, SPACING, cardShadow, alpha } from '../constants/theme';
import {
  somenteDigitos,
  digitosParaTexto,
  digitosParaNumero,
  numeroParaDigitos,
} from '../utils/formatting';

// ============================================================
// Card
// ============================================================
export function Card({
  children,
  style,
  padded = true,
}: {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  padded?: boolean;
}) {
  const { theme } = useTheme();
  return (
    <View
      style={[
        {
          backgroundColor: theme.surface,
          borderRadius: RADIUS.lg,
          padding: padded ? SPACING.lg : 0,
          ...cardShadow(theme),
        },
        style,
      ]}
    >
      {children}
    </View>
  );
}

// ============================================================
// Section header
// ============================================================
export function SectionTitle({
  title,
  subtitle,
  right,
  style,
}: {
  title: string;
  subtitle?: string;
  right?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  const styles = useThemedStyles(makeStyles);
  return (
    <View style={[styles.sectionHeader, style]}>
      <View style={{ flex: 1 }}>
        <Text style={styles.sectionTitle}>{title}</Text>
        {!!subtitle && <Text style={styles.sectionSubtitle}>{subtitle}</Text>}
      </View>
      {right}
    </View>
  );
}

/** Rótulo pequeno em caixa alta, usado acima de campos e blocos. */
export function Label({ children, style }: { children: React.ReactNode; style?: StyleProp<TextStyle> }) {
  const styles = useThemedStyles(makeStyles);
  return <Text style={[styles.label, style]}>{children}</Text>;
}

// ============================================================
// Progress bar
// ============================================================
export function ProgressBar({
  progress,
  color,
  height = 8,
  track,
}: {
  /** 0–1. Valores acima de 1 são achatados; o excedente vira cor de alerta. */
  progress: number;
  color?: string;
  height?: number;
  track?: string;
}) {
  const { theme } = useTheme();
  const clamped = Math.max(0, Math.min(1, progress));
  const tint = color ?? theme.primary;
  return (
    <View
      style={{
        height,
        borderRadius: height / 2,
        backgroundColor: track ?? theme.surfaceSunken,
        overflow: 'hidden',
      }}
    >
      <View
        style={{
          width: `${clamped * 100}%`,
          height: '100%',
          borderRadius: height / 2,
          backgroundColor: tint,
        }}
      />
    </View>
  );
}

/**
 * Barra segmentada — mostra a composição de um total (fixo / parcelado / avulso)
 * numa faixa só, sem precisar de gráfico.
 */
export function StackedBar({
  segments,
  height = 10,
}: {
  segments: { value: number; color: string }[];
  height?: number;
}) {
  const { theme } = useTheme();
  const total = segments.reduce((s, x) => s + x.value, 0);
  if (total <= 0) {
    return (
      <View
        style={{ height, borderRadius: height / 2, backgroundColor: theme.surfaceSunken }}
      />
    );
  }
  return (
    <View style={{ height, borderRadius: height / 2, overflow: 'hidden', flexDirection: 'row' }}>
      {segments
        .filter((s) => s.value > 0)
        .map((s, i) => (
          <View key={i} style={{ flex: s.value, backgroundColor: s.color }} />
        ))}
    </View>
  );
}

// ============================================================
// Campo de dinheiro
// ============================================================
/**
 * Entrada de valor com máscara que preenche dos centavos para cima:
 * digitar 5 → 0,05; 50 → 0,50; 500 → 5,00. Ninguém precisa achar a vírgula.
 *
 * O componente guarda os dígitos crus e deriva o texto deles. O valor numérico
 * volta pelo `onChangeValue` em reais.
 */
export function MoneyInput({
  value,
  onChangeValue,
  placeholder = '0,00',
  autoFocus,
  size = 'grande',
  prefixo = 'R$',
  style,
}: {
  /** Valor em reais. */
  value: number;
  onChangeValue: (valor: number) => void;
  placeholder?: string;
  autoFocus?: boolean;
  /** 'grande' para campos protagonistas, 'medio' para campos secundários. */
  size?: 'grande' | 'medio';
  prefixo?: string | null;
  style?: StyleProp<ViewStyle>;
}) {
  const { theme } = useTheme();
  const [digitos, setDigitos] = useState(() => numeroParaDigitos(value));

  // Ressincroniza quando o valor muda por fora (atalho, troca de mês, carga do
  // banco). Compara pelo número para não brigar com a própria digitação.
  useEffect(() => {
    if (Math.abs(digitosParaNumero(digitos) - (value || 0)) > 0.004) {
      setDigitos(numeroParaDigitos(value));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  const aoDigitar = (texto: string) => {
    const proximos = somenteDigitos(texto);
    setDigitos(proximos);
    onChangeValue(digitosParaNumero(proximos));
  };

  const grande = size === 'grande';

  return (
    <View
      style={[
        {
          flexDirection: 'row',
          alignItems: 'center',
          gap: SPACING.sm,
          backgroundColor: theme.surfaceAlt,
          borderRadius: RADIUS.md,
          paddingHorizontal: SPACING.lg,
          borderWidth: 1,
          borderColor: theme.border,
        },
        style,
      ]}
    >
      {!!prefixo && (
        <Text
          style={{
            fontSize: grande ? 16 : 15,
            fontWeight: '600',
            color: theme.textSecondary,
          }}
        >
          {prefixo}
        </Text>
      )}
      <TextInput
        style={{
          flex: 1,
          paddingVertical: grande ? 14 : 12,
          fontSize: grande ? 22 : 17,
          fontWeight: '700',
          color: theme.text,
        }}
        value={digitosParaTexto(digitos)}
        onChangeText={aoDigitar}
        // number-pad: só dígitos, já que a vírgula é posta pela máscara.
        keyboardType="number-pad"
        placeholder={placeholder}
        placeholderTextColor={theme.textLight}
        autoFocus={autoFocus}
        selectTextOnFocus={false}
      />
    </View>
  );
}

// ============================================================
// Chip
// ============================================================
export function Chip({
  label,
  icon,
  color,
  active,
  onPress,
  compact,
}: {
  label: string;
  icon?: string;
  color?: string;
  active?: boolean;
  onPress?: () => void;
  compact?: boolean;
}) {
  const { theme } = useTheme();
  const tint = color ?? theme.primary;
  const Wrapper: React.ElementType = onPress ? TouchableOpacity : View;
  return (
    <Wrapper
      onPress={onPress}
      activeOpacity={0.7}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 5,
        paddingHorizontal: compact ? 8 : 12,
        paddingVertical: compact ? 3 : 7,
        borderRadius: RADIUS.pill,
        borderWidth: 1,
        borderColor: active ? tint : theme.border,
        backgroundColor: active ? alpha(tint, theme.name === 'dark' ? 0.18 : 0.1) : theme.surface,
      }}
    >
      {!!icon && (
        <MaterialCommunityIcons
          name={icon as never}
          size={compact ? 11 : 14}
          color={active ? tint : theme.textSecondary}
        />
      )}
      <Text
        style={{
          fontSize: compact ? 10 : 12.5,
          fontWeight: active ? '700' : '500',
          color: active ? tint : theme.textSecondary,
        }}
      >
        {label}
      </Text>
    </Wrapper>
  );
}

/** Etiqueta estática colorida (sem interação). */
export function Tag({ label, color, icon }: { label: string; color: string; icon?: string }) {
  const { theme } = useTheme();
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 3,
        borderRadius: RADIUS.sm,
        paddingHorizontal: 6,
        paddingVertical: 2,
        backgroundColor: alpha(color, theme.name === 'dark' ? 0.2 : 0.12),
      }}
    >
      {!!icon && <MaterialCommunityIcons name={icon as never} size={10} color={color} />}
      <Text style={{ fontSize: 10, fontWeight: '700', color }}>{label}</Text>
    </View>
  );
}

// ============================================================
// Buttons
// ============================================================
export function PrimaryButton({
  label,
  icon,
  onPress,
  disabled,
  loading,
  color,
  style,
}: {
  label: string;
  icon?: string;
  onPress: () => void;
  disabled?: boolean;
  loading?: boolean;
  color?: string;
  style?: StyleProp<ViewStyle>;
}) {
  const { theme } = useTheme();
  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={disabled || loading}
      activeOpacity={0.85}
      style={[
        {
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 8,
          backgroundColor: color ?? theme.primaryFill,
          borderRadius: RADIUS.md,
          paddingVertical: 15,
          opacity: disabled || loading ? 0.5 : 1,
        },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={theme.onFill} size="small" />
      ) : (
        <>
          {!!icon && <MaterialCommunityIcons name={icon as never} size={19} color={theme.onFill} />}
          <Text style={{ color: theme.onFill, fontSize: 15.5, fontWeight: '700' }}>{label}</Text>
        </>
      )}
    </TouchableOpacity>
  );
}

export function GhostButton({
  label,
  icon,
  onPress,
  style,
  color,
}: {
  label: string;
  icon?: string;
  onPress: () => void;
  style?: StyleProp<ViewStyle>;
  color?: string;
}) {
  const { theme } = useTheme();
  const tint = color ?? theme.textSecondary;
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.7}
      style={[
        {
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 7,
          borderWidth: 1,
          borderColor: theme.border,
          borderRadius: RADIUS.md,
          paddingVertical: 14,
          backgroundColor: theme.surface,
        },
        style,
      ]}
    >
      {!!icon && <MaterialCommunityIcons name={icon as never} size={18} color={tint} />}
      <Text style={{ color: tint, fontSize: 15, fontWeight: '600' }}>{label}</Text>
    </TouchableOpacity>
  );
}

/**
 * Seletor de opções em linha — usado para tipo de despesa, estratégia de
 * quitação, tema, etc.
 */
export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { value: T; label: string; icon?: string }[];
  value: T;
  onChange: (value: T) => void;
}) {
  const { theme } = useTheme();
  return (
    <View
      style={{
        flexDirection: 'row',
        backgroundColor: theme.surfaceSunken,
        borderRadius: RADIUS.md,
        padding: 3,
        gap: 3,
      }}
    >
      {options.map((opt) => {
        const active = opt.value === value;
        return (
          <TouchableOpacity
            key={opt.value}
            onPress={() => onChange(opt.value)}
            activeOpacity={0.8}
            style={{
              flex: 1,
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 5,
              paddingVertical: 9,
              borderRadius: RADIUS.sm + 1,
              backgroundColor: active ? theme.surface : 'transparent',
              ...(active && theme.name === 'light'
                ? {
                    shadowColor: theme.shadow,
                    shadowOffset: { width: 0, height: 1 },
                    shadowOpacity: 0.06,
                    shadowRadius: 2,
                    elevation: 1,
                  }
                : null),
            }}
          >
            {!!opt.icon && (
              <MaterialCommunityIcons
                name={opt.icon as never}
                size={15}
                color={active ? theme.primary : theme.textSecondary}
              />
            )}
            <Text
              style={{
                fontSize: 13,
                fontWeight: active ? '700' : '500',
                color: active ? theme.text : theme.textSecondary,
              }}
            >
              {opt.label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

// ============================================================
// Estados
// ============================================================
export function EmptyState({
  icon,
  title,
  subtitle,
  action,
}: {
  icon: string;
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
}) {
  const styles = useThemedStyles(makeStyles);
  const { theme } = useTheme();
  return (
    <View style={styles.empty}>
      <View style={styles.emptyIcon}>
        <MaterialCommunityIcons name={icon as never} size={28} color={theme.textLight} />
      </View>
      <Text style={styles.emptyTitle}>{title}</Text>
      {!!subtitle && <Text style={styles.emptySubtitle}>{subtitle}</Text>}
      {!!action && <View style={{ marginTop: SPACING.lg, alignSelf: 'stretch' }}>{action}</View>}
    </View>
  );
}

/** Linha rótulo → valor, o bloco de leitura mais usado no app. */
export function StatRow({
  label,
  value,
  color,
  bold,
  icon,
}: {
  label: string;
  value: string;
  color?: string;
  bold?: boolean;
  icon?: string;
}) {
  const styles = useThemedStyles(makeStyles);
  const { theme } = useTheme();
  return (
    <View style={styles.statRow}>
      <View style={styles.statRowLeft}>
        {!!icon && (
          <MaterialCommunityIcons
            name={icon as never}
            size={15}
            color={color ?? theme.textSecondary}
          />
        )}
        <Text style={styles.statRowLabel}>{label}</Text>
      </View>
      <Text
        style={[
          styles.statRowValue,
          !!color && { color },
          bold && { fontWeight: '800', fontSize: 15.5 },
        ]}
      >
        {value}
      </Text>
    </View>
  );
}

const makeStyles = (t: ThemePalette) =>
  StyleSheet.create({
    sectionHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: SPACING.sm,
      marginBottom: SPACING.md,
    },
    sectionTitle: {
      fontSize: 16.5,
      fontWeight: '700',
      color: t.text,
      letterSpacing: -0.2,
    },
    sectionSubtitle: {
      fontSize: 12.5,
      color: t.textSecondary,
      marginTop: 2,
    },
    label: {
      fontSize: 11.5,
      fontWeight: '700',
      color: t.textSecondary,
      textTransform: 'uppercase',
      letterSpacing: 0.7,
      marginBottom: SPACING.sm,
    },
    empty: {
      alignItems: 'center',
      paddingVertical: SPACING.xxl,
      paddingHorizontal: SPACING.lg,
    },
    emptyIcon: {
      width: 56,
      height: 56,
      borderRadius: 28,
      backgroundColor: t.surfaceSunken,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: SPACING.md,
    },
    emptyTitle: {
      fontSize: 15,
      fontWeight: '700',
      color: t.text,
      textAlign: 'center',
    },
    emptySubtitle: {
      fontSize: 13,
      color: t.textSecondary,
      textAlign: 'center',
      marginTop: 4,
      lineHeight: 19,
    },
    statRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingVertical: 9,
    },
    statRowLeft: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 7,
      flex: 1,
      minWidth: 0,
    },
    statRowLabel: {
      fontSize: 13.5,
      color: t.textSecondary,
      flexShrink: 1,
    },
    statRowValue: {
      fontSize: 14.5,
      fontWeight: '700',
      color: t.text,
    },
  });
