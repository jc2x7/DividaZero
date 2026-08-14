import React, { useState, useCallback, useMemo, useEffect } from 'react';
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
import QuitacaoSheet from '../../components/QuitacaoSheet';
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
  getMonthShortName,
  fromMonthIndex,
} from '../../utils/formatting';

const EXTRAS_SETTING_KEY = 'payoff_extras';
const ALLOC_SETTING_KEY = 'payoff_alloc';
const STRATEGY_SETTING_KEY = 'payoff_strategy';

const QUICK_EXTRAS = [0, 100, 200, 500];
/** Quantos meses aparecem para planejar o extra. */
const MESES_PLANEJAVEIS = 12;

/** 'YYYY-MM' a partir do índice absoluto. */
const chaveMes = (index: number) =>
  `${Math.floor(index / 12)}-${String((index % 12) + 1).padStart(2, '0')}`;

export default function PlanoScreen() {
  const { theme } = useTheme();
  const styles = useThemedStyles(makeStyles);
  const { get: getCategory } = useCategories();

  const [debts, setDebts] = useState<PayoffDebt[]>([]);
  const [strategy, setStrategy] = useState<PayoffStrategy>('SNOWBALL');
  /** Valor extra de cada mês, por 'YYYY-MM'. */
  const [extras, setExtras] = useState<Record<string, number>>({});
  /** Dívida escolhida para receber o extra de cada mês. */
  const [alloc, setAlloc] = useState<Record<string, string>>({});
  const [mesAberto, setMesAberto] = useState<number>(currentMonthIndex());
  const [detalhe, setDetalhe] = useState<PayoffDebt | null>(null);
  const [loading, setLoading] = useState(true);

  const startIndex = currentMonthIndex();

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [rows, savedExtras, savedAlloc, savedStrategy] = await Promise.all([
        getOpenInstallmentGroups(startIndex),
        getSetting(EXTRAS_SETTING_KEY),
        getSetting(ALLOC_SETTING_KEY),
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
      // Formato antigo guardava um único valor; vira o extra do mês corrente.
      if (savedExtras) {
        try {
          const obj = JSON.parse(savedExtras);
          setExtras(typeof obj === 'object' && obj !== null ? obj : {});
        } catch {
          const antigo = parseFloat(savedExtras);
          setExtras(antigo > 0 ? { [chaveMes(startIndex)]: antigo } : {});
        }
      }
      if (savedAlloc) {
        try {
          const obj = JSON.parse(savedAlloc);
          setAlloc(typeof obj === 'object' && obj !== null ? obj : {});
        } catch {
          setAlloc({});
        }
      }
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

  const plan = useMemo(
    () => buildPayoffPlan(debts, strategy, extras, startIndex, alloc),
    [debts, strategy, extras, startIndex, alloc]
  );

  /** Meses oferecidos para planejar, a partir do mês corrente. */
  const meses = useMemo(
    () => Array.from({ length: MESES_PLANEJAVEIS }, (_, k) => startIndex + k),
    [startIndex]
  );

  const mkAberto = chaveMes(mesAberto);
  const extraDoMes = extras[mkAberto] ?? 0;
  const destinoDoMes = alloc[mkAberto];

  // Texto do campo de valor. Fica em estado próprio porque quem digita e quem
  // toca num atalho precisam ver a mesma coisa, e trocar de mês tem de
  // recarregar o valor daquele mês.
  const [extraTexto, setExtraTexto] = useState('');
  useEffect(() => {
    setExtraTexto(extraDoMes > 0 ? String(extraDoMes).replace('.', ',') : '');
  }, [mkAberto, extraDoMes]);

  const definirExtra = (mk: string, valor: number) => {
    const proximos = { ...extras };
    if (valor > 0) proximos[mk] = valor;
    else delete proximos[mk];
    setExtras(proximos);
    setSetting(EXTRAS_SETTING_KEY, JSON.stringify(proximos)).catch(() => {});
  };

  const definirDestino = (mk: string, groupId: string | null) => {
    const proximos = { ...alloc };
    if (groupId) proximos[mk] = groupId;
    else delete proximos[mk];
    setAlloc(proximos);
    setSetting(ALLOC_SETTING_KEY, JSON.stringify(proximos)).catch(() => {});
  };

  /** Repete o valor deste mês em todos os meses seguintes da lista. */
  const repetirNosProximos = (valor: number) => {
    const proximos = { ...extras };
    for (const idx of meses) {
      if (idx < mesAberto) continue;
      const mk = chaveMes(idx);
      if (valor > 0) proximos[mk] = valor;
      else delete proximos[mk];
    }
    setExtras(proximos);
    setSetting(EXTRAS_SETTING_KEY, JSON.stringify(proximos)).catch(() => {});
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
              setSetting(STRATEGY_SETTING_KEY, v).catch(() => {});
            }}
          />
          <Text style={styles.hint}>{STRATEGY_DESCRIPTION[strategy]}</Text>
        </View>

        {/* Valor extra, mês a mês */}
        <View style={styles.block}>
          <Label>Quanto dá para colocar a mais</Label>
          <Text style={styles.hint}>
            O valor pode ser diferente em cada mês. Décimo terceiro, férias e bônus entram só
            no mês em que caem.
          </Text>

          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.mesesLinha}
            style={{ marginTop: SPACING.md }}
          >
            {meses.map((idx) => {
              const mk = chaveMes(idx);
              const valor = extras[mk] ?? 0;
              const ativo = idx === mesAberto;
              const { month } = fromMonthIndex(idx);
              return (
                <TouchableOpacity
                  key={mk}
                  style={[styles.mesChip, ativo && styles.mesChipAtivo]}
                  onPress={() => setMesAberto(idx)}
                >
                  <Text style={[styles.mesChipMes, ativo && styles.mesChipTextoAtivo]}>
                    {getMonthShortName(month)}
                  </Text>
                  <Text
                    style={[
                      styles.mesChipValor,
                      ativo && styles.mesChipTextoAtivo,
                      valor === 0 && !ativo && { color: theme.textLight },
                    ]}
                  >
                    {valor > 0 ? formatCurrency(valor).replace('R$\u00a0', '') : '—'}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          <View style={styles.amountWrapper}>
            <Text style={styles.currencyPrefix}>R$</Text>
            <TextInput
              style={styles.amountInput}
              value={extraTexto}
              onChangeText={(v) => {
                setExtraTexto(v);
                definirExtra(
                  mkAberto,
                  Math.max(0, parseFloat(v.replace(/\./g, '').replace(',', '.')) || 0)
                );
              }}
              keyboardType="decimal-pad"
              placeholder="0,00"
              placeholderTextColor={theme.textLight}
            />
          </View>
          <Text style={styles.mesAtivoLabel}>
            em {formatMonthIndexLong(mesAberto)}
          </Text>

          <View style={styles.quickRow}>
            {QUICK_EXTRAS.map((v) => (
              <TouchableOpacity
                key={v}
                style={[styles.quickChip, extraDoMes === v && styles.quickChipActive]}
                onPress={() => definirExtra(mkAberto, v)}
              >
                <Text style={[styles.quickText, extraDoMes === v && styles.quickTextActive]}>
                  {v === 0 ? 'Nada' : `+ ${formatCurrency(v)}`}
                </Text>
              </TouchableOpacity>
            ))}
            {extraDoMes > 0 && (
              <TouchableOpacity
                style={[styles.quickChip, styles.repetirChip]}
                onPress={() => repetirNosProximos(extraDoMes)}
              >
                <MaterialCommunityIcons name="content-copy" size={12} color={theme.primary} />
                <Text style={[styles.quickText, styles.quickTextActive]}>
                  repetir nos próximos
                </Text>
              </TouchableOpacity>
            )}
          </View>

          {/* Para onde vai o dinheiro deste mês */}
          {extraDoMes > 0 && debts.length > 1 && (
            <>
              <Text style={styles.destinoTitulo}>
                Usar esse dinheiro em qual dívida?
              </Text>
              <View style={styles.destinoLinha}>
                <TouchableOpacity
                  style={[styles.destinoChip, !destinoDoMes && styles.destinoChipAtivo]}
                  onPress={() => definirDestino(mkAberto, null)}
                >
                  <MaterialCommunityIcons
                    name="auto-fix"
                    size={12}
                    color={!destinoDoMes ? theme.primary : theme.textSecondary}
                  />
                  <Text
                    style={[styles.destinoTexto, !destinoDoMes && styles.destinoTextoAtivo]}
                  >
                    Seguir a estratégia
                  </Text>
                </TouchableOpacity>
                {debts.map((d) => {
                  const ativo = destinoDoMes === d.groupId;
                  return (
                    <TouchableOpacity
                      key={d.groupId}
                      style={[styles.destinoChip, ativo && styles.destinoChipAtivo]}
                      onPress={() => definirDestino(mkAberto, ativo ? null : d.groupId)}
                    >
                      <Text
                        style={[styles.destinoTexto, ativo && styles.destinoTextoAtivo]}
                        numberOfLines={1}
                      >
                        {d.name}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </>
          )}

          {plan.extraTotal > 0 && (
            <View style={styles.totalExtra}>
              <MaterialCommunityIcons name="cash-plus" size={15} color={theme.success} />
              <Text style={styles.totalExtraTexto}>
                {formatCurrency(plan.extraTotal)} planejados em{' '}
                {Object.values(plan.extras).filter((v) => v > 0).length}{' '}
                {Object.values(plan.extras).filter((v) => v > 0).length === 1 ? 'mês' : 'meses'}
              </Text>
            </View>
          )}

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
              <TouchableOpacity
                key={step.debt.groupId}
                style={[styles.stepCard, isFocus && styles.stepCardFocus]}
                onPress={() => setDetalhe(step.debt)}
                activeOpacity={0.75}
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

                <View style={styles.stepRodape}>
                  {step.monthsSaved > 0 ? (
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
                  ) : (
                    <View />
                  )}
                  <View style={styles.stepLink}>
                    <Text style={styles.stepLinkTexto}>Simular quitação</Text>
                    <MaterialCommunityIcons
                      name="chevron-right"
                      size={14}
                      color={theme.primary}
                    />
                  </View>
                </View>
              </TouchableOpacity>
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

      <QuitacaoSheet
        debt={detalhe}
        onClose={() => setDetalhe(null)}
        onChanged={load}
      />
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
    repetirChip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      borderStyle: 'dashed',
      borderColor: t.primary,
    },

    // Faixa de meses do planejamento do extra
    mesesLinha: { gap: SPACING.sm, paddingRight: SPACING.lg },
    mesChip: {
      minWidth: 74,
      alignItems: 'center',
      paddingHorizontal: 10,
      paddingVertical: 8,
      borderRadius: RADIUS.md,
      borderWidth: 1,
      borderColor: t.border,
      backgroundColor: t.surface,
    },
    mesChipAtivo: { borderColor: t.primary, backgroundColor: alpha(t.primary, 0.1) },
    mesChipMes: {
      fontSize: 11,
      fontWeight: '700',
      color: t.textSecondary,
      textTransform: 'uppercase',
    },
    mesChipValor: {
      fontSize: 12.5,
      fontWeight: '700',
      color: t.text,
      marginTop: 2,
      fontVariant: ['tabular-nums'],
    },
    mesChipTextoAtivo: { color: t.primary },
    mesAtivoLabel: { fontSize: 12, color: t.textSecondary, marginTop: 6 },

    // Escolha da dívida que recebe o extra
    destinoTitulo: {
      fontSize: 12.5,
      fontWeight: '700',
      color: t.text,
      marginTop: SPACING.lg,
      marginBottom: SPACING.sm,
    },
    destinoLinha: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.sm },
    destinoChip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      maxWidth: '100%',
      paddingHorizontal: 11,
      paddingVertical: 7,
      borderRadius: RADIUS.pill,
      borderWidth: 1,
      borderColor: t.border,
      backgroundColor: t.surface,
    },
    destinoChipAtivo: { borderColor: t.primary, backgroundColor: alpha(t.primary, 0.1) },
    destinoTexto: { fontSize: 12, fontWeight: '600', color: t.textSecondary, flexShrink: 1 },
    destinoTextoAtivo: { color: t.primary },

    totalExtra: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      marginTop: SPACING.lg,
      padding: SPACING.md,
      borderRadius: RADIUS.md,
      backgroundColor: alpha(t.success, 0.1),
    },
    totalExtraTexto: { flex: 1, fontSize: 12.5, color: t.text, fontWeight: '600' },

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
    stepRodape: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginTop: SPACING.sm,
      gap: SPACING.sm,
    },
    stepLink: { flexDirection: 'row', alignItems: 'center', gap: 1 },
    stepLinkTexto: { fontSize: 11.5, fontWeight: '700', color: t.primary },
    stepSaved: { flexDirection: 'row', alignItems: 'center', gap: 4 },
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
