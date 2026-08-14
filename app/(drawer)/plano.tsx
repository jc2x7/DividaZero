import React, { useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  RefreshControl,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { PayoffDebt, PayoffStrategy, ExpenseCategory } from '../../types';
import { getOpenInstallmentGroups, getSetting, setSetting } from '../../database/database';
import { useCategories } from '../../hooks/useCategories';
import { useTheme, useThemedStyles } from '../../hooks/useTheme';
import { ThemePalette, RADIUS, SPACING, alpha, categoryColor } from '../../constants/theme';
import { Card, EmptyState, Label, SegmentedControl, ProgressBar } from '../../components/ui';
import {
  buildPayoffPlan,
  STRATEGY_LABEL,
  STRATEGY_DESCRIPTION,
} from '../../utils/payoff';
import {
  formatCurrency,
  currentMonthIndex,
  formatMonthIndex,
  formatMonthIndexLong,
  formatDuration,
} from '../../utils/formatting';

const EXTRA_SETTING_KEY = 'payoff_extra';
const STRATEGY_SETTING_KEY = 'payoff_strategy';

const QUICK_EXTRAS = [0, 100, 200, 500];

export default function PlanoScreen() {
  const { theme } = useTheme();
  const styles = useThemedStyles(makeStyles);
  const { get: getCategory } = useCategories();

  const [debts, setDebts] = useState<PayoffDebt[]>([]);
  const [strategy, setStrategy] = useState<PayoffStrategy>('SNOWBALL');
  const [extraInput, setExtraInput] = useState('0');
  const [loading, setLoading] = useState(true);

  const startIndex = currentMonthIndex();

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [rows, savedExtra, savedStrategy] = await Promise.all([
        getOpenInstallmentGroups(startIndex),
        getSetting(EXTRA_SETTING_KEY),
        getSetting(STRATEGY_SETTING_KEY),
      ]);
      setDebts(
        rows.map((r) => ({
          groupId: r.group_id,
          name: r.name,
          category: r.category as ExpenseCategory,
          installmentAmount: r.installment_amount,
          remainingCount: r.remaining_count,
          remainingTotal: r.remaining_total,
          installmentsTotal: r.installments_total,
          lastIndex: r.last_index,
          nextIndex: r.next_index,
        }))
      );
      if (savedExtra !== null) setExtraInput(savedExtra);
      if (savedStrategy === 'SNOWBALL' || savedStrategy === 'AVALANCHE') {
        setStrategy(savedStrategy);
      }
    } finally {
      setLoading(false);
    }
  }, [startIndex]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const extra = Math.max(0, parseFloat(extraInput.replace(/\./g, '').replace(',', '.')) || 0);

  const plan = useMemo(
    () => buildPayoffPlan(debts, strategy, extra, startIndex),
    [debts, strategy, extra, startIndex]
  );

  const persist = (nextStrategy: PayoffStrategy, nextExtra: string) => {
    setSetting(STRATEGY_SETTING_KEY, nextStrategy).catch(() => {});
    setSetting(EXTRA_SETTING_KEY, nextExtra).catch(() => {});
  };

  const monthlyCommitted = debts.reduce((s, d) => s + d.installmentAmount, 0);

  if (!loading && debts.length === 0) {
    return (
      <SafeAreaView style={styles.container} edges={['bottom']}>
        <ScrollView contentContainerStyle={styles.content}>
          <Card>
            <EmptyState
              icon="party-popper"
              title="Nenhuma parcela em aberto"
              subtitle="Você não tem compras parceladas pendentes a partir deste mês. Despesas fixas não entram aqui porque não têm data para acabar."
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
        {/* Situação atual */}
        <Card>
          <Label>Você ainda deve em parcelas</Label>
          <Text style={styles.heroValue}>{formatCurrency(plan.totalDebt)}</Text>
          <Text style={styles.heroSub}>
            {debts.length} {debts.length === 1 ? 'compra' : 'compras'} ·{' '}
            {formatCurrency(monthlyCommitted)} por mês
          </Text>

          {plan.freeIndex !== null && (
            <View style={styles.freedomBox}>
              <View style={styles.freedomIcon}>
                <MaterialCommunityIcons
                  name="flag-checkered"
                  size={19}
                  color={theme.success}
                />
              </View>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={styles.freedomLabel}>Livre de parcelas em</Text>
                <Text style={styles.freedomValue}>{formatMonthIndexLong(plan.freeIndex)}</Text>
              </View>
              {plan.monthsSaved > 0 && (
                <View style={styles.savedBadge}>
                  <Text style={styles.savedBadgeText}>
                    −{formatDuration(plan.monthsSaved)}
                  </Text>
                </View>
              )}
            </View>
          )}

          {plan.baselineFreeIndex !== null && plan.monthsSaved > 0 && (
            <Text style={styles.baselineNote}>
              Sem plano, a última parcela cairia em{' '}
              {formatMonthIndex(plan.baselineFreeIndex)}.
            </Text>
          )}
        </Card>

        {/* Estratégia */}
        <View style={styles.block}>
          <Label>Por onde começar</Label>
          <SegmentedControl
            options={[
              { value: 'SNOWBALL' as PayoffStrategy, label: STRATEGY_LABEL.SNOWBALL },
              { value: 'AVALANCHE' as PayoffStrategy, label: STRATEGY_LABEL.AVALANCHE },
            ]}
            value={strategy}
            onChange={(v) => {
              setStrategy(v);
              persist(v, extraInput);
            }}
          />
          <Text style={styles.hint}>{STRATEGY_DESCRIPTION[strategy]}</Text>
        </View>

        {/* Valor extra */}
        <View style={styles.block}>
          <Label>Quanto dá para colocar a mais por mês</Label>
          <View style={styles.amountWrapper}>
            <Text style={styles.currencyPrefix}>R$</Text>
            <TextInput
              style={styles.amountInput}
              value={extraInput}
              onChangeText={(v) => {
                setExtraInput(v);
                persist(strategy, v);
              }}
              keyboardType="decimal-pad"
              placeholder="0,00"
              placeholderTextColor={theme.textLight}
            />
          </View>
          <View style={styles.quickRow}>
            {QUICK_EXTRAS.map((v) => (
              <TouchableOpacity
                key={v}
                style={[styles.quickChip, extra === v && styles.quickChipActive]}
                onPress={() => {
                  setExtraInput(String(v));
                  persist(strategy, String(v));
                }}
              >
                <Text style={[styles.quickText, extra === v && styles.quickTextActive]}>
                  {v === 0 ? 'Nada extra' : `+ ${formatCurrency(v)}`}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
          <Text style={styles.hint}>
            Mesmo sem colocar nada extra o plano acelera: cada parcela quitada deixa de sair da
            sua conta e é redirecionada para a próxima dívida da fila.
          </Text>
        </View>

        {/* Ordem de ataque */}
        <View style={styles.block}>
          <Label>Ordem de quitação</Label>
          {plan.steps.map((step) => {
            const cat = getCategory(step.debt.category);
            const tint = categoryColor(cat.color, theme);
            const isFocus = step.debt.groupId === plan.focusGroupId;
            const progress =
              step.debt.installmentsTotal > 0
                ? 1 - step.debt.remainingCount / step.debt.installmentsTotal
                : 0;
            return (
              <View
                key={step.debt.groupId}
                style={[styles.stepCard, isFocus && styles.stepCardFocus]}
              >
                {isFocus && (
                  <View style={styles.focusBadge}>
                    <MaterialCommunityIcons name="target" size={11} color={theme.primary} />
                    <Text style={styles.focusBadgeText}>
                      Coloque o dinheiro extra aqui
                    </Text>
                  </View>
                )}
                <View style={styles.stepHeader}>
                  <View
                    style={[styles.stepOrder, isFocus && { backgroundColor: theme.primaryFill }]}
                  >
                    <Text style={[styles.stepOrderText, isFocus && { color: theme.onFill }]}>
                      {step.order}
                    </Text>
                  </View>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={styles.stepName} numberOfLines={1}>
                      {step.debt.name}
                    </Text>
                    <Text style={styles.stepMeta}>
                      faltam {step.debt.remainingCount} de {step.debt.installmentsTotal}{' '}
                      parcelas · {formatCurrency(step.debt.installmentAmount)}/mês
                    </Text>
                  </View>
                  <View style={{ alignItems: 'flex-end' }}>
                    <Text style={styles.stepTotal}>
                      {formatCurrency(step.debt.remainingTotal)}
                    </Text>
                    <Text style={styles.stepPayoff}>
                      quita {formatMonthIndex(step.payoffIndex)}
                    </Text>
                  </View>
                </View>

                <View style={{ marginTop: SPACING.md }}>
                  <ProgressBar progress={progress} color={tint} height={5} />
                </View>

                {step.monthsSaved > 0 && (
                  <View style={styles.stepSaved}>
                    <MaterialCommunityIcons
                      name="clock-fast"
                      size={12}
                      color={theme.success}
                    />
                    <Text style={styles.stepSavedText}>
                      {formatDuration(step.monthsSaved)} antes do previsto
                    </Text>
                  </View>
                )}
              </View>
            );
          })}
        </View>

        <TouchableOpacity
          style={styles.footerLink}
          onPress={() => router.push('/(drawer)/analise')}
        >
          <MaterialCommunityIcons name="chart-line" size={16} color={theme.primary} />
          <Text style={styles.footerLinkText}>Ver evolução dos gastos</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const makeStyles = (t: ThemePalette) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: t.background },
    content: { padding: SPACING.lg, paddingBottom: SPACING.xxl },
    block: { marginTop: SPACING.xl },
    hint: { fontSize: 12.5, color: t.textSecondary, marginTop: SPACING.sm, lineHeight: 18 },

    heroValue: {
      fontSize: 32,
      fontWeight: '800',
      color: t.text,
      letterSpacing: -1,
      fontVariant: ['tabular-nums'],
    },
    heroSub: { fontSize: 13, color: t.textSecondary, marginTop: 4 },

    freedomBox: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: SPACING.md,
      marginTop: SPACING.lg,
      padding: SPACING.md,
      borderRadius: RADIUS.md,
      backgroundColor: alpha(t.success, 0.1),
    },
    freedomIcon: {
      width: 34,
      height: 34,
      borderRadius: 17,
      backgroundColor: alpha(t.success, 0.15),
      alignItems: 'center',
      justifyContent: 'center',
    },
    freedomLabel: { fontSize: 11.5, color: t.textSecondary, fontWeight: '500' },
    freedomValue: { fontSize: 15, fontWeight: '700', color: t.text, marginTop: 1 },
    savedBadge: {
      paddingHorizontal: 9,
      paddingVertical: 4,
      borderRadius: RADIUS.pill,
      backgroundColor: alpha(t.success, 0.18),
    },
    savedBadgeText: { fontSize: 11, fontWeight: '800', color: t.success },
    baselineNote: { fontSize: 11.5, color: t.textLight, marginTop: SPACING.sm, lineHeight: 16 },

    amountWrapper: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: SPACING.sm,
      backgroundColor: t.surface,
      borderRadius: RADIUS.md,
      paddingHorizontal: SPACING.lg,
      borderWidth: 1,
      borderColor: t.border,
    },
    currencyPrefix: { fontSize: 16, fontWeight: '600', color: t.textSecondary },
    amountInput: { flex: 1, paddingVertical: 14, fontSize: 21, fontWeight: '700', color: t.text },
    quickRow: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.sm, marginTop: SPACING.md },
    quickChip: {
      paddingHorizontal: 12,
      paddingVertical: 7,
      borderRadius: RADIUS.pill,
      borderWidth: 1,
      borderColor: t.border,
      backgroundColor: t.surface,
    },
    quickChipActive: { borderColor: t.primary, backgroundColor: alpha(t.primary, 0.1) },
    quickText: { fontSize: 12.5, fontWeight: '600', color: t.textSecondary },
    quickTextActive: { color: t.primary },

    stepCard: {
      backgroundColor: t.surface,
      borderRadius: RADIUS.lg,
      borderWidth: 1,
      borderColor: t.border,
      padding: SPACING.lg,
      marginBottom: SPACING.md,
    },
    stepCardFocus: { borderColor: alpha(t.primary, 0.5) },
    focusBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      alignSelf: 'flex-start',
      paddingHorizontal: 8,
      paddingVertical: 3,
      borderRadius: RADIUS.pill,
      backgroundColor: alpha(t.primary, 0.12),
      marginBottom: SPACING.md,
    },
    focusBadgeText: { fontSize: 10.5, fontWeight: '700', color: t.primary },
    stepHeader: { flexDirection: 'row', alignItems: 'center', gap: SPACING.md },
    stepOrder: {
      width: 28,
      height: 28,
      borderRadius: 14,
      backgroundColor: t.surfaceSunken,
      alignItems: 'center',
      justifyContent: 'center',
    },
    stepOrderText: { fontSize: 13, fontWeight: '800', color: t.textSecondary },
    stepName: { fontSize: 14.5, fontWeight: '700', color: t.text },
    stepMeta: { fontSize: 11.5, color: t.textSecondary, marginTop: 2 },
    stepTotal: {
      fontSize: 14,
      fontWeight: '700',
      color: t.text,
      fontVariant: ['tabular-nums'],
    },
    stepPayoff: { fontSize: 11, color: t.textLight, marginTop: 2 },
    stepSaved: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: SPACING.sm },
    stepSavedText: { fontSize: 11, fontWeight: '600', color: t.success },

    footerLink: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
      marginTop: SPACING.xl,
      paddingVertical: SPACING.md,
    },
    footerLinkText: { fontSize: 13, fontWeight: '700', color: t.primary },
  });
