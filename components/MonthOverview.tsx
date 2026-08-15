import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { MonthSummary } from '../types';
import { formatCurrency } from '../utils/formatting';
import { useTheme, useThemedStyles } from '../hooks/useTheme';
import { ThemePalette, RADIUS, SPACING, alpha, cardShadow } from '../constants/theme';
import { ProgressBar } from './ui';

/**
 * Cartão principal do mês: sobra, quanto entrou, quanto saiu e o quanto da
 * renda já está comprometido. É a única coisa que a pessoa precisa ler para
 * saber se o mês está de pé.
 */
export default function MonthOverview({
  summary,
  onPressIncome,
}: {
  summary: MonthSummary;
  onPressIncome: () => void;
}) {
  const { theme } = useTheme();
  const styles = useThemedStyles(makeStyles);

  const positive = summary.balance >= 0;
  const balanceColor = positive ? theme.success : theme.danger;

  // Verde até 70% da renda, amarelo até 90%, vermelho acima disso.
  const commitmentColor =
    summary.commitment > 90
      ? theme.danger
      : summary.commitment > 70
        ? theme.warning
        : theme.success;

  const noIncome = summary.totalIncome <= 0;

  return (
    <View style={styles.card}>
      <View style={styles.balanceBlock}>
        <Text style={styles.balanceLabel}>{positive ? 'Sobra no mês' : 'Falta no mês'}</Text>
        <Text style={[styles.balanceValue, { color: balanceColor }]}>
          {formatCurrency(Math.abs(summary.balance))}
        </Text>
      </View>

      <View style={styles.flowRow}>
        <TouchableOpacity style={styles.flowItem} onPress={onPressIncome} activeOpacity={0.7}>
          <View style={[styles.flowIcon, { backgroundColor: alpha(theme.success, 0.12) }]}>
            <MaterialCommunityIcons name="arrow-down-left" size={15} color={theme.success} />
          </View>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={styles.flowLabel}>Entrou</Text>
            <Text
              style={styles.flowValue}
              numberOfLines={1}
              adjustsFontSizeToFit
              minimumFontScale={0.7}
            >
              {formatCurrency(summary.totalIncome)}
            </Text>
          </View>
          <MaterialCommunityIcons name="pencil-outline" size={14} color={theme.textLight} />
        </TouchableOpacity>

        <View style={styles.flowDivider} />

        <View style={styles.flowItem}>
          <View style={[styles.flowIcon, { backgroundColor: alpha(theme.danger, 0.12) }]}>
            <MaterialCommunityIcons name="arrow-up-right" size={15} color={theme.danger} />
          </View>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={styles.flowLabel}>Saiu</Text>
            <Text
              style={styles.flowValue}
              numberOfLines={1}
              adjustsFontSizeToFit
              minimumFontScale={0.7}
            >
              {formatCurrency(summary.totalExpenses)}
            </Text>
          </View>
        </View>
      </View>

      {noIncome ? (
        <TouchableOpacity style={styles.setupIncome} onPress={onPressIncome} activeOpacity={0.7}>
          <MaterialCommunityIcons name="information-outline" size={15} color={theme.info} />
          <Text style={styles.setupIncomeText}>
            Informe sua renda para ver o quanto está comprometido
          </Text>
        </TouchableOpacity>
      ) : (
        <View style={styles.commitmentBlock}>
          <View style={styles.commitmentHeader}>
            <Text style={styles.commitmentLabel}>Renda comprometida</Text>
            <Text style={[styles.commitmentValue, { color: commitmentColor }]}>
              {Math.round(summary.commitment)}%
            </Text>
          </View>
          <ProgressBar
            progress={summary.commitment / 100}
            color={commitmentColor}
            height={7}
          />
        </View>
      )}

      {summary.plannedPayoffCount > 0 && (
        <View style={styles.planejadoBox}>
          <MaterialCommunityIcons name="rocket-launch-outline" size={16} color={theme.primary} />
          <Text style={styles.planejadoTexto}>
            {formatCurrency(summary.plannedPayoffTotal)} em{' '}
            {summary.plannedPayoffCount}{' '}
            {summary.plannedPayoffCount === 1 ? 'parcela saiu' : 'parcelas saíram'} do mês —
            você planejou quitar com o dinheiro do plano
          </Text>
        </View>
      )}

      <View style={styles.footerRow}>
        <FooterStat
          label="Pago"
          value={formatCurrency(summary.paidTotal)}
          color={theme.success}
        />
        <View style={styles.footerDivider} />
        <FooterStat
          label="A pagar"
          value={formatCurrency(summary.unpaidTotal)}
          color={theme.text}
        />
        <View style={styles.footerDivider} />
        <FooterStat
          label="Atrasado"
          value={formatCurrency(summary.overdueTotal)}
          color={summary.overdueTotal > 0 ? theme.danger : theme.textLight}
        />
      </View>
    </View>
  );
}

function FooterStat({ label, value, color }: { label: string; value: string; color: string }) {
  const styles = useThemedStyles(makeStyles);
  return (
    <View style={styles.footerStat}>
      <Text style={styles.footerLabel}>{label}</Text>
      <Text
        style={[styles.footerValue, { color }]}
        numberOfLines={1}
        adjustsFontSizeToFit
        minimumFontScale={0.75}
      >
        {value}
      </Text>
    </View>
  );
}

const makeStyles = (t: ThemePalette) =>
  StyleSheet.create({
    card: {
      backgroundColor: t.surface,
      borderRadius: RADIUS.xl,
      padding: SPACING.xl,
      paddingBottom: SPACING.md,
      ...cardShadow(t),
    },
    balanceBlock: { alignItems: 'center', marginBottom: SPACING.xl },
    balanceLabel: {
      fontSize: 12.5,
      fontWeight: '600',
      color: t.textSecondary,
      textTransform: 'uppercase',
      letterSpacing: 0.8,
      marginBottom: 6,
    },
    balanceValue: {
      fontSize: 36,
      fontWeight: '800',
      letterSpacing: -1.2,
      fontVariant: ['tabular-nums'],
    },

    flowRow: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: t.surfaceAlt,
      borderRadius: RADIUS.md,
      padding: SPACING.md,
      gap: SPACING.md,
    },
    flowItem: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, minWidth: 0 },
    flowDivider: { width: 1, height: 26, backgroundColor: t.border },
    flowIcon: {
      width: 28,
      height: 28,
      borderRadius: 14,
      alignItems: 'center',
      justifyContent: 'center',
    },
    flowLabel: { fontSize: 11, color: t.textSecondary, fontWeight: '500' },
    flowValue: {
      fontSize: 14.5,
      fontWeight: '700',
      color: t.text,
      fontVariant: ['tabular-nums'],
    },

    setupIncome: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: SPACING.sm,
      marginTop: SPACING.lg,
      padding: SPACING.md,
      borderRadius: RADIUS.md,
      backgroundColor: alpha(t.info, 0.1),
    },
    setupIncomeText: { flex: 1, fontSize: 12.5, color: t.info, lineHeight: 17 },

    commitmentBlock: { marginTop: SPACING.lg },
    commitmentHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'baseline',
      marginBottom: SPACING.sm,
    },
    commitmentLabel: { fontSize: 12.5, color: t.textSecondary, fontWeight: '500' },
    commitmentValue: { fontSize: 14, fontWeight: '800', fontVariant: ['tabular-nums'] },

    planejadoBox: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: SPACING.sm,
      marginTop: SPACING.lg,
      padding: SPACING.md,
      borderRadius: RADIUS.md,
      backgroundColor: alpha(t.primary, 0.09),
    },
    planejadoTexto: { flex: 1, fontSize: 12, color: t.primary, lineHeight: 17 },
    footerRow: {
      flexDirection: 'row',
      alignItems: 'center',
      marginTop: SPACING.lg,
      paddingTop: SPACING.md,
      borderTopWidth: 1,
      borderTopColor: t.divider,
    },
    footerStat: { flex: 1, alignItems: 'center', gap: 2, minWidth: 0 },
    footerDivider: { width: 1, height: 22, backgroundColor: t.divider },
    footerLabel: { fontSize: 10.5, color: t.textSecondary, fontWeight: '500' },
    footerValue: { fontSize: 13, fontWeight: '700', fontVariant: ['tabular-nums'] },
  });
