import React, { useState, useCallback, useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView, RefreshControl } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  getDatabase,
  getMonthlyTotals,
  getCategoryTotals,
  MonthTotalsRow,
  CategoryTotalRow,
} from '../../database/database';
import { useCategories } from '../../hooks/useCategories';
import { ExpenseCategory } from '../../types';
import { useTheme, useThemedStyles } from '../../hooks/useTheme';
import { ThemePalette, RADIUS, SPACING, alpha, categoryColor } from '../../constants/theme';
import { Card, EmptyState, Label, SegmentedControl, ProgressBar } from '../../components/ui';
import MonthlyBarChart, { MonthBar } from '../../components/MonthlyBarChart';
import {
  formatCurrency,
  currentMonthIndex,
  monthIndex,
  formatMonthIndex,
  formatMonthIndexLong,
} from '../../utils/formatting';

type Period = '6' | '12' | '24';

interface SalaryRow {
  year: number;
  month: number;
  amount: number;
  other_income: number;
}

export default function AnaliseScreen() {
  const { theme } = useTheme();
  const styles = useThemedStyles(makeStyles);
  const { get: getCategory } = useCategories();

  const [period, setPeriod] = useState<Period>('12');
  const [rows, setRows] = useState<MonthTotalsRow[]>([]);
  const [categories, setCategories] = useState<CategoryTotalRow[]>([]);
  const [salaries, setSalaries] = useState<SalaryRow[]>([]);
  const [selected, setSelected] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);

  const months = parseInt(period, 10);
  const endIndex = currentMonthIndex();
  const startIndex = endIndex - months + 1;

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const db = await getDatabase();
      const [totals, cats, sal] = await Promise.all([
        getMonthlyTotals(startIndex, endIndex),
        getCategoryTotals(startIndex, endIndex),
        db.getAllAsync<SalaryRow>(
          'SELECT year, month, amount, other_income FROM salary ORDER BY year, month'
        ),
      ]);
      setRows(totals);
      setCategories(cats);
      setSalaries(sal);
    } finally {
      setLoading(false);
    }
  }, [startIndex, endIndex]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  /** Salário vigente em cada mês — o último informado até ali. */
  const salaryAt = useCallback(
    (index: number) => {
      let value = 0;
      for (const s of salaries) {
        if (monthIndex(s.year, s.month) <= index) value = s.amount + s.other_income;
        else break;
      }
      return value;
    },
    [salaries]
  );

  const series = useMemo(() => {
    const byIndex = new Map(rows.map((r) => [monthIndex(r.year, r.month), r]));
    return Array.from({ length: months }, (_, i) => {
      const idx = startIndex + i;
      const r = byIndex.get(idx);
      const extraIncome = r?.income ?? 0;
      return {
        index: idx,
        fixed: r?.fixed ?? 0,
        installment: r?.installment ?? 0,
        variable: r?.variable ?? 0,
        total: r?.total ?? 0,
        paid: r?.paid ?? 0,
        income: salaryAt(idx) + extraIncome,
      };
    });
  }, [rows, months, startIndex, salaryAt]);

  const withData = series.filter((s) => s.total > 0);
  const totalSpent = withData.reduce((s, x) => s + x.total, 0);
  const average = withData.length > 0 ? totalSpent / withData.length : 0;

  // Tendência: média da metade mais recente contra a metade anterior.
  const half = Math.floor(series.length / 2);
  const recent = series.slice(half).filter((s) => s.total > 0);
  const older = series.slice(0, half).filter((s) => s.total > 0);
  const recentAvg = recent.length ? recent.reduce((s, x) => s + x.total, 0) / recent.length : 0;
  const olderAvg = older.length ? older.reduce((s, x) => s + x.total, 0) / older.length : 0;
  const trend = olderAvg > 0 ? ((recentAvg - olderAvg) / olderAvg) * 100 : 0;

  const totals = {
    fixed: withData.reduce((s, x) => s + x.fixed, 0),
    installment: withData.reduce((s, x) => s + x.installment, 0),
    variable: withData.reduce((s, x) => s + x.variable, 0),
  };

  const avgCommitment = (() => {
    const valid = series.filter((s) => s.income > 0 && s.total > 0);
    if (!valid.length) return null;
    return (valid.reduce((s, x) => s + x.total / x.income, 0) / valid.length) * 100;
  })();

  const chartData: MonthBar[] = series.map((s) => ({
    index: s.index,
    segments: [
      { value: s.fixed, color: theme.chart[0] },
      { value: s.installment, color: theme.chart[1] },
      { value: s.variable, color: theme.chart[3] },
    ],
    reference: s.income > 0 ? s.income : undefined,
  }));

  const selectedMonth = selected !== null ? series.find((s) => s.index === selected) : null;
  const maxCategory = categories.length > 0 ? categories[0].total : 1;

  if (!loading && withData.length === 0) {
    return (
      <SafeAreaView style={styles.container} edges={['bottom']}>
        <ScrollView contentContainerStyle={styles.content}>
          <Card>
            <EmptyState
              icon="chart-line"
              title="Ainda não há dados suficientes"
              subtitle="Assim que você lançar despesas em alguns meses, a evolução e as comparações aparecem aqui."
            />
          </Card>
        </ScrollView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={loading} onRefresh={load} tintColor={theme.textSecondary} />
        }
      >
        <SegmentedControl
          options={[
            { value: '6' as Period, label: '6 meses' },
            { value: '12' as Period, label: '12 meses' },
            { value: '24' as Period, label: '24 meses' },
          ]}
          value={period}
          onChange={(v) => {
            setPeriod(v);
            setSelected(null);
          }}
        />

        {/* Média e tendência */}
        <Card style={styles.block}>
          <Label>Média por mês</Label>
          <Text style={styles.heroValue}>{formatCurrency(average)}</Text>
          <View style={styles.trendRow}>
            {Math.abs(trend) >= 1 ? (
              <>
                <MaterialCommunityIcons
                  name={trend > 0 ? 'trending-up' : 'trending-down'}
                  size={16}
                  color={trend > 0 ? theme.danger : theme.success}
                />
                <Text
                  style={[
                    styles.trendText,
                    { color: trend > 0 ? theme.danger : theme.success },
                  ]}
                >
                  {trend > 0 ? '+' : ''}
                  {trend.toFixed(0)}%
                </Text>
                <Text style={styles.trendHint}>
                  nos últimos meses, comparado ao período anterior
                </Text>
              </>
            ) : (
              <Text style={styles.trendHint}>Gastos estáveis no período.</Text>
            )}
          </View>

          {avgCommitment !== null && (
            <View style={styles.commitmentBlock}>
              <View style={styles.commitmentHeader}>
                <Text style={styles.commitmentLabel}>Média da renda comprometida</Text>
                <Text
                  style={[
                    styles.commitmentValue,
                    {
                      color:
                        avgCommitment > 90
                          ? theme.danger
                          : avgCommitment > 70
                            ? theme.warning
                            : theme.success,
                    },
                  ]}
                >
                  {Math.round(avgCommitment)}%
                </Text>
              </View>
              <ProgressBar
                progress={avgCommitment / 100}
                color={
                  avgCommitment > 90
                    ? theme.danger
                    : avgCommitment > 70
                      ? theme.warning
                      : theme.success
                }
                height={7}
              />
            </View>
          )}
        </Card>

        {/* Evolução */}
        <Card style={styles.block}>
          <Label>Evolução dos gastos</Label>
          <MonthlyBarChart
            data={chartData}
            selectedIndex={selected}
            onSelect={(idx) => setSelected((cur) => (cur === idx ? null : idx))}
          />

          <View style={styles.legend}>
            <LegendItem color={theme.chart[0]} label="Fixas" />
            <LegendItem color={theme.chart[1]} label="Parceladas" />
            <LegendItem color={theme.chart[3]} label="Avulsas" />
          </View>

          {selectedMonth && (
            <View style={styles.detailBox}>
              <Text style={styles.detailTitle}>{formatMonthIndexLong(selectedMonth.index)}</Text>
              <DetailRow label="Fixas" value={selectedMonth.fixed} color={theme.chart[0]} />
              <DetailRow
                label="Parceladas"
                value={selectedMonth.installment}
                color={theme.chart[1]}
              />
              <DetailRow label="Avulsas" value={selectedMonth.variable} color={theme.chart[3]} />
              <View style={styles.detailDivider} />
              <DetailRow label="Total" value={selectedMonth.total} bold />
              {selectedMonth.income > 0 && (
                <DetailRow
                  label="Sobrou"
                  value={selectedMonth.income - selectedMonth.total}
                  color={
                    selectedMonth.income - selectedMonth.total >= 0 ? theme.success : theme.danger
                  }
                  bold
                />
              )}
            </View>
          )}
          {!selectedMonth && (
            <Text style={styles.chartHint}>Toque em um mês para ver o detalhe.</Text>
          )}
        </Card>

        {/* Composição no período */}
        <Card style={styles.block}>
          <Label>Composição do período</Label>
          <CompositionRow
            label="Fixas"
            hint="Contas que se repetem"
            value={totals.fixed}
            total={totalSpent}
            color={theme.chart[0]}
          />
          <CompositionRow
            label="Parceladas"
            hint="Compras com fim previsto"
            value={totals.installment}
            total={totalSpent}
            color={theme.chart[1]}
          />
          <CompositionRow
            label="Avulsas"
            hint="Gastos de uma vez só"
            value={totals.variable}
            total={totalSpent}
            color={theme.chart[3]}
          />
          <Text style={styles.compositionNote}>
            {totals.fixed > totals.installment + totals.variable
              ? 'Seu orçamento é dominado por contas fixas. Reduzir uma delas tem efeito em todos os meses seguintes.'
              : totals.installment > totals.fixed
                ? 'Boa parte do que você gasta são parcelas. Elas têm fim — o plano de quitação mostra quando.'
                : 'Seus gastos são bem distribuídos entre contas fixas, parcelas e gastos do dia a dia.'}
          </Text>
        </Card>

        {/* Ranking de categorias */}
        {categories.length > 0 && (
          <Card style={styles.block}>
            <Label>Onde você mais gasta</Label>
            {categories.slice(0, 8).map((c) => {
              const cfg = getCategory(c.category as ExpenseCategory);
              const tint = categoryColor(cfg.color, theme);
              const share = totalSpent > 0 ? (c.total / totalSpent) * 100 : 0;
              return (
                <View key={c.category} style={styles.catRow}>
                  <View style={[styles.catIcon, { backgroundColor: alpha(tint, 0.12) }]}>
                    <MaterialCommunityIcons name={cfg.icon as never} size={16} color={tint} />
                  </View>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <View style={styles.catHeader}>
                      <Text style={styles.catLabel} numberOfLines={1}>
                        {cfg.label}
                      </Text>
                      <Text style={styles.catValue}>{formatCurrency(c.total)}</Text>
                    </View>
                    <View style={{ marginTop: 6 }}>
                      <ProgressBar progress={c.total / maxCategory} color={tint} height={5} />
                    </View>
                    <Text style={styles.catMeta}>
                      {share.toFixed(0)}% do período · {formatCurrency(c.total / months)} por mês
                    </Text>
                  </View>
                </View>
              );
            })}
          </Card>
        )}

        {/* Meses extremos */}
        {withData.length >= 2 && (
          <Card style={styles.block}>
            <Label>Extremos</Label>
            <ExtremeRow
              icon="arrow-up-bold-circle-outline"
              color={theme.danger}
              title="Mês mais caro"
              month={withData.reduce((a, b) => (b.total > a.total ? b : a))}
            />
            <ExtremeRow
              icon="arrow-down-bold-circle-outline"
              color={theme.success}
              title="Mês mais leve"
              month={withData.reduce((a, b) => (b.total < a.total ? b : a))}
            />
          </Card>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function LegendItem({ color, label }: { color: string; label: string }) {
  const styles = useThemedStyles(makeStyles);
  return (
    <View style={styles.legendItem}>
      <View style={[styles.legendDot, { backgroundColor: color }]} />
      <Text style={styles.legendLabel}>{label}</Text>
    </View>
  );
}

function DetailRow({
  label,
  value,
  color,
  bold,
}: {
  label: string;
  value: number;
  color?: string;
  bold?: boolean;
}) {
  const styles = useThemedStyles(makeStyles);
  return (
    <View style={styles.detailRow}>
      <View style={styles.detailRowLeft}>
        {!!color && <View style={[styles.legendDot, { backgroundColor: color }]} />}
        <Text style={[styles.detailLabel, bold && { fontWeight: '700' }]}>{label}</Text>
      </View>
      <Text style={[styles.detailValue, bold && { fontWeight: '800' }, !!color && bold && { color }]}>
        {formatCurrency(value)}
      </Text>
    </View>
  );
}

function CompositionRow({
  label,
  hint,
  value,
  total,
  color,
}: {
  label: string;
  hint: string;
  value: number;
  total: number;
  color: string;
}) {
  const styles = useThemedStyles(makeStyles);
  const share = total > 0 ? (value / total) * 100 : 0;
  return (
    <View style={styles.compRow}>
      <View style={styles.compHeader}>
        <View style={[styles.legendDot, { backgroundColor: color }]} />
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={styles.compLabel}>{label}</Text>
          <Text style={styles.compHint}>{hint}</Text>
        </View>
        <View style={{ alignItems: 'flex-end' }}>
          <Text style={styles.compValue}>{formatCurrency(value)}</Text>
          <Text style={styles.compShare}>{share.toFixed(0)}%</Text>
        </View>
      </View>
      <View style={{ marginTop: SPACING.sm }}>
        <ProgressBar progress={share / 100} color={color} height={5} />
      </View>
    </View>
  );
}

function ExtremeRow({
  icon,
  color,
  title,
  month,
}: {
  icon: string;
  color: string;
  title: string;
  month: { index: number; total: number };
}) {
  const styles = useThemedStyles(makeStyles);
  return (
    <View style={styles.extremeRow}>
      <MaterialCommunityIcons name={icon as never} size={20} color={color} />
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={styles.extremeTitle}>{title}</Text>
        <Text style={styles.extremeMonth}>{formatMonthIndex(month.index)}</Text>
      </View>
      <Text style={[styles.extremeValue, { color }]}>{formatCurrency(month.total)}</Text>
    </View>
  );
}

const makeStyles = (t: ThemePalette) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: t.background },
    content: { padding: SPACING.lg, paddingBottom: SPACING.xxl },
    block: { marginTop: SPACING.lg },

    heroValue: {
      fontSize: 32,
      fontWeight: '800',
      color: t.text,
      letterSpacing: -1,
      fontVariant: ['tabular-nums'],
    },
    trendRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 6, flexWrap: 'wrap' },
    trendText: { fontSize: 13.5, fontWeight: '800' },
    trendHint: { fontSize: 12.5, color: t.textSecondary, flexShrink: 1 },

    commitmentBlock: {
      marginTop: SPACING.lg,
      paddingTop: SPACING.lg,
      borderTopWidth: 1,
      borderTopColor: t.divider,
    },
    commitmentHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'baseline',
      marginBottom: SPACING.sm,
    },
    commitmentLabel: { fontSize: 12.5, color: t.textSecondary },
    commitmentValue: { fontSize: 14, fontWeight: '800', fontVariant: ['tabular-nums'] },

    legend: {
      flexDirection: 'row',
      gap: SPACING.lg,
      marginTop: SPACING.md,
      flexWrap: 'wrap',
      marginLeft: 34,
    },
    legendItem: { flexDirection: 'row', alignItems: 'center', gap: 5 },
    legendDot: { width: 8, height: 8, borderRadius: 4 },
    legendLabel: { fontSize: 11, color: t.textSecondary },

    chartHint: {
      fontSize: 11.5,
      color: t.textLight,
      marginTop: SPACING.md,
      textAlign: 'center',
    },
    detailBox: {
      marginTop: SPACING.lg,
      padding: SPACING.md,
      borderRadius: RADIUS.md,
      backgroundColor: t.surfaceAlt,
    },
    detailTitle: { fontSize: 13.5, fontWeight: '700', color: t.text, marginBottom: SPACING.sm },
    detailRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingVertical: 4,
    },
    detailRowLeft: { flexDirection: 'row', alignItems: 'center', gap: 7 },
    detailLabel: { fontSize: 12.5, color: t.textSecondary },
    detailValue: {
      fontSize: 13,
      fontWeight: '600',
      color: t.text,
      fontVariant: ['tabular-nums'],
    },
    detailDivider: { height: 1, backgroundColor: t.border, marginVertical: 6 },

    compRow: { marginBottom: SPACING.lg },
    compHeader: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm },
    compLabel: { fontSize: 14, fontWeight: '600', color: t.text },
    compHint: { fontSize: 11, color: t.textLight, marginTop: 1 },
    compValue: {
      fontSize: 13.5,
      fontWeight: '700',
      color: t.text,
      fontVariant: ['tabular-nums'],
    },
    compShare: { fontSize: 11, color: t.textSecondary, marginTop: 1 },
    compositionNote: {
      fontSize: 12.5,
      color: t.textSecondary,
      lineHeight: 18,
      paddingTop: SPACING.sm,
      borderTopWidth: 1,
      borderTopColor: t.divider,
    },

    catRow: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: SPACING.md,
      marginBottom: SPACING.lg,
    },
    catIcon: {
      width: 32,
      height: 32,
      borderRadius: RADIUS.sm,
      alignItems: 'center',
      justifyContent: 'center',
    },
    catHeader: { flexDirection: 'row', justifyContent: 'space-between', gap: SPACING.sm },
    catLabel: { fontSize: 13.5, fontWeight: '600', color: t.text, flexShrink: 1 },
    catValue: {
      fontSize: 13.5,
      fontWeight: '700',
      color: t.text,
      fontVariant: ['tabular-nums'],
    },
    catMeta: { fontSize: 10.5, color: t.textLight, marginTop: 5 },

    extremeRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: SPACING.md,
      paddingVertical: SPACING.md,
      borderBottomWidth: 1,
      borderBottomColor: t.divider,
    },
    extremeTitle: { fontSize: 13, color: t.textSecondary },
    extremeMonth: { fontSize: 14, fontWeight: '700', color: t.text, marginTop: 1 },
    extremeValue: { fontSize: 14.5, fontWeight: '700', fontVariant: ['tabular-nums'] },
  });
