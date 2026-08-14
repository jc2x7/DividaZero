import React, { useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  Alert,
  Modal,
  TextInput,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useCategories } from '../../hooks/useCategories';
import { useMonthData } from '../../hooks/useMonthData';
import { useTheme, useThemedStyles } from '../../hooks/useTheme';
import { ThemePalette, RADIUS, SPACING, alpha, categoryColor } from '../../constants/theme';
import DebtCard from '../../components/DebtCard';
import AddDebtModal from '../../components/AddDebtModal';
import AddIncomeModal from '../../components/AddIncomeModal';
import IncomeCard from '../../components/IncomeCard';
import MonthYearPicker from '../../components/MonthYearPicker';
import MonthOverview from '../../components/MonthOverview';
import DebtDetailSheet from '../../components/DebtDetailSheet';
import { Card, Chip, EmptyState, Label, PrimaryButton, StackedBar } from '../../components/ui';
import { formatCurrency, monthIndex } from '../../utils/formatting';
import { upsertSalary } from '../../database/database';
import { Expense, ExpenseCategory } from '../../types';

type SectionKey = 'fixed' | 'installment' | 'variable';

const SECTION_META: Record<
  SectionKey,
  { title: string; icon: string; hint: string; emptyHint: string }
> = {
  fixed: {
    title: 'Fixas',
    icon: 'repeat',
    hint: 'Se repetem todo mês',
    emptyHint: 'Aluguel, internet, academia — o que cai sempre.',
  },
  installment: {
    title: 'Parceladas',
    icon: 'credit-card-outline',
    hint: 'Têm data para acabar',
    emptyHint: 'Compras divididas em parcelas aparecem aqui.',
  },
  variable: {
    title: 'Avulsas',
    icon: 'cart-outline',
    hint: 'Só neste mês',
    emptyHint: 'Gastos únicos, que não se repetem.',
  },
};

export default function DashboardScreen() {
  const today = new Date();
  const { theme } = useTheme();
  const styles = useThemedStyles(makeStyles);
  const { categories } = useCategories();

  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth() + 1);
  const [showAddDebt, setShowAddDebt] = useState(false);
  const [editingExpense, setEditingExpense] = useState<Expense | undefined>(undefined);
  const [detailExpense, setDetailExpense] = useState<Expense | null>(null);
  const [showFabMenu, setShowFabMenu] = useState(false);
  const [showAddIncome, setShowAddIncome] = useState(false);
  const [showSalaryModal, setShowSalaryModal] = useState(false);
  const [salaryInput, setSalaryInput] = useState('');
  const [otherInput, setOtherInput] = useState('');
  const [filterCategory, setFilterCategory] = useState<ExpenseCategory | 'ALL'>('ALL');
  const [collapsed, setCollapsed] = useState<Record<SectionKey, boolean>>({
    fixed: false,
    installment: false,
    variable: false,
  });

  const { expenses, incomes, salary, summary, groups, loading, reload } = useMonthData(year, month);

  useFocusEffect(
    useCallback(() => {
      reload();
    }, [reload])
  );

  const now = new Date();
  const isPastOrCurrent = monthIndex(year, month) <= monthIndex(now.getFullYear(), now.getMonth() + 1);

  const applyFilter = useCallback(
    (list: Expense[]) =>
      filterCategory === 'ALL' ? list : list.filter((e) => e.category === filterCategory),
    [filterCategory]
  );

  const sections = useMemo(
    () =>
      (['fixed', 'installment', 'variable'] as SectionKey[]).map((key) => {
        const items = applyFilter(groups[key]);
        return { key, items, total: items.reduce((s, e) => s + e.amount, 0) };
      }),
    [groups, applyFilter]
  );

  const activeCategories = summary.categoryBreakdown.map((c) => c.category);
  const composition = [
    { key: 'fixed', label: 'Fixas', value: summary.fixedTotal, color: theme.chart[0] },
    { key: 'installment', label: 'Parceladas', value: summary.installmentTotal, color: theme.chart[1] },
    { key: 'variable', label: 'Avulsas', value: summary.variableTotal, color: theme.chart[3] },
  ];

  const handleOpenSalaryModal = () => {
    setSalaryInput(salary ? String(salary.amount) : '');
    setOtherInput(salary && salary.other_income ? String(salary.other_income) : '');
    setShowSalaryModal(true);
  };

  const handleSaveSalary = async () => {
    const amount = parseFloat(salaryInput.replace(/\./g, '').replace(',', '.'));
    const other = parseFloat(otherInput.replace(/\./g, '').replace(',', '.')) || 0;
    if (isNaN(amount) || amount < 0) {
      Alert.alert('Valor inválido', 'Digite um valor de renda válido.');
      return;
    }
    await upsertSalary(year, month, amount, other);
    setShowSalaryModal(false);
    reload();
  };

  const openNewExpense = () => {
    setShowFabMenu(false);
    setEditingExpense(undefined);
    setShowAddDebt(true);
  };

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <View style={styles.topBar}>
        <MonthYearPicker year={year} month={month} onSelect={(y, m) => { setYear(y); setMonth(m); }} />
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={loading}
            onRefresh={reload}
            tintColor={theme.textSecondary}
          />
        }
      >
        <MonthOverview summary={summary} onPressIncome={handleOpenSalaryModal} />

        {/* Aviso de atraso — só faz sentido em meses já iniciados */}
        {isPastOrCurrent && summary.overdueCount > 0 && (
          <TouchableOpacity
            style={styles.alertBanner}
            activeOpacity={0.8}
            onPress={() => setFilterCategory('ALL')}
          >
            <MaterialCommunityIcons name="alert-circle-outline" size={19} color={theme.danger} />
            <Text style={styles.alertText}>
              {summary.overdueCount} {summary.overdueCount === 1 ? 'conta venceu' : 'contas venceram'} e
              {summary.overdueCount === 1 ? ' continua' : ' continuam'} em aberto —{' '}
              {formatCurrency(summary.overdueTotal)}
            </Text>
          </TouchableOpacity>
        )}

        {/* Composição das despesas */}
        {summary.totalExpenses > 0 && (
          <Card style={styles.block}>
            <View style={styles.compositionHeader}>
              <Label style={{ marginBottom: 0 }}>Para onde vai o dinheiro</Label>
              <TouchableOpacity
                onPress={() => router.push('/(drawer)/analise')}
                hitSlop={8}
                style={styles.linkBtn}
              >
                <Text style={styles.linkText}>Análise</Text>
                <MaterialCommunityIcons name="chevron-right" size={15} color={theme.primary} />
              </TouchableOpacity>
            </View>

            <StackedBar segments={composition} height={10} />

            <View style={styles.legend}>
              {composition.map((c) => (
                <View key={c.key} style={styles.legendItem}>
                  <View style={[styles.legendDot, { backgroundColor: c.color }]} />
                  <View style={{ minWidth: 0 }}>
                    <Text style={styles.legendLabel}>{c.label}</Text>
                    <Text style={styles.legendValue} numberOfLines={1}>
                      {formatCurrency(c.value)}
                    </Text>
                  </View>
                </View>
              ))}
            </View>
          </Card>
        )}

        {/* Entradas extras */}
        {incomes.length > 0 && (
          <View style={styles.block}>
            <Label>Entradas extras deste mês</Label>
            {incomes.map((inc) => (
              <IncomeCard key={inc.id} income={inc} onDeleted={reload} />
            ))}
          </View>
        )}

        {/* Filtro por categoria */}
        {activeCategories.length > 1 && (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.filterRow}
            style={styles.block}
          >
            <Chip
              label={`Todas (${expenses.length})`}
              active={filterCategory === 'ALL'}
              onPress={() => setFilterCategory('ALL')}
            />
            {categories
              .filter((c) => activeCategories.includes(c.key))
              .map((cat) => (
                <Chip
                  key={cat.key}
                  label={cat.label}
                  icon={cat.icon}
                  color={categoryColor(cat.color, theme)}
                  active={filterCategory === cat.key}
                  onPress={() =>
                    setFilterCategory((prev) => (prev === cat.key ? 'ALL' : cat.key))
                  }
                />
              ))}
          </ScrollView>
        )}

        {/* Despesas separadas por natureza */}
        {expenses.length === 0 ? (
          <Card style={styles.block}>
            <EmptyState
              icon="receipt-text-outline"
              title="Nenhuma despesa neste mês"
              subtitle="Comece lançando o que já sai todo mês — depois some as compras parceladas."
              action={
                <PrimaryButton label="Adicionar despesa" icon="plus" onPress={openNewExpense} />
              }
            />
          </Card>
        ) : (
          sections.map(({ key, items, total }) => {
            const meta = SECTION_META[key];
            const isCollapsed = collapsed[key];
            // Com filtro ativo, seções sem correspondência somem em vez de
            // aparecerem vazias — o filtro deve enxugar a tela, não poluí-la.
            if (filterCategory !== 'ALL' && items.length === 0) return null;

            return (
              <View key={key} style={styles.block}>
                <TouchableOpacity
                  style={styles.sectionHeader}
                  activeOpacity={0.7}
                  onPress={() => setCollapsed((c) => ({ ...c, [key]: !c[key] }))}
                >
                  <MaterialCommunityIcons
                    name={meta.icon as never}
                    size={16}
                    color={theme.textSecondary}
                  />
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={styles.sectionTitle}>
                      {meta.title}{' '}
                      <Text style={styles.sectionCount}>
                        {items.length > 0 ? `· ${items.length}` : ''}
                      </Text>
                    </Text>
                    <Text style={styles.sectionHint}>{meta.hint}</Text>
                  </View>
                  <Text style={styles.sectionTotal}>{formatCurrency(total)}</Text>
                  <MaterialCommunityIcons
                    name={isCollapsed ? 'chevron-down' : 'chevron-up'}
                    size={19}
                    color={theme.textLight}
                  />
                </TouchableOpacity>

                {!isCollapsed &&
                  (items.length === 0 ? (
                    <Text style={styles.sectionEmpty}>{meta.emptyHint}</Text>
                  ) : (
                    items.map((expense) => (
                      <DebtCard
                        key={expense.id}
                        expense={expense}
                        overdue={
                          isPastOrCurrent &&
                          !expense.is_paid &&
                          (monthIndex(year, month) < monthIndex(now.getFullYear(), now.getMonth() + 1) ||
                            (!!expense.due_day && expense.due_day < now.getDate()))
                        }
                        onDeleted={reload}
                        onTogglePaid={reload}
                        onOpenDetail={setDetailExpense}
                        onEdit={(exp) => {
                          setEditingExpense(exp);
                          setShowAddDebt(true);
                        }}
                      />
                    ))
                  ))}
              </View>
            );
          })
        )}

        {/* Atalhos */}
        <View style={styles.shortcuts}>
          <Shortcut
            icon="flag-checkered"
            label="Metas"
            hint="Guardar para um objetivo"
            onPress={() => router.push('/(drawer)/metas')}
          />
          <Shortcut
            icon="rocket-launch-outline"
            label="Plano de quitação"
            hint="Sair das parcelas antes"
            onPress={() => router.push('/(drawer)/plano')}
          />
        </View>
      </ScrollView>

      {/* FAB */}
      {showFabMenu && (
        <TouchableOpacity
          style={styles.fabBackdrop}
          activeOpacity={1}
          onPress={() => setShowFabMenu(false)}
        />
      )}
      {showFabMenu && (
        <View style={styles.fabMenu}>
          <FabAction
            label="Entrada de dinheiro"
            icon="arrow-down-left"
            color={theme.successFill}
            onPress={() => {
              setShowFabMenu(false);
              setShowAddIncome(true);
            }}
          />
          <FabAction
            label="Despesa"
            icon="arrow-up-right"
            color={theme.dangerFill}
            onPress={openNewExpense}
          />
        </View>
      )}
      <TouchableOpacity
        style={[styles.fab, showFabMenu && { backgroundColor: theme.textSecondary }]}
        onPress={() => setShowFabMenu((v) => !v)}
        activeOpacity={0.85}
      >
        <MaterialCommunityIcons
          name={showFabMenu ? 'close' : 'plus'}
          size={26}
          color={theme.onFill}
        />
      </TouchableOpacity>

      <AddDebtModal
        visible={showAddDebt}
        onClose={() => {
          setShowAddDebt(false);
          setEditingExpense(undefined);
        }}
        onAdded={reload}
        year={year}
        month={month}
        editingExpense={editingExpense}
      />

      <AddIncomeModal
        visible={showAddIncome}
        onClose={() => setShowAddIncome(false)}
        onAdded={reload}
        year={year}
        month={month}
      />

      <DebtDetailSheet
        expense={detailExpense}
        onClose={() => setDetailExpense(null)}
        onChanged={reload}
      />

      {/* Renda do mês */}
      <Modal
        visible={showSalaryModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowSalaryModal(false)}
      >
        <KeyboardAvoidingView
          style={styles.modalOverlay}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <View style={styles.modalSheet}>
            <View style={styles.handle} />
            <Text style={styles.modalTitle}>Renda do mês</Text>
            <Text style={styles.modalSubtitle}>
              O valor vale deste mês em diante — os anteriores ficam como estão.
            </Text>

            <Label style={{ marginTop: SPACING.lg }}>Salário</Label>
            <View style={styles.amountWrapper}>
              <Text style={styles.currencyPrefix}>R$</Text>
              <TextInput
                style={styles.amountInput}
                value={salaryInput}
                onChangeText={setSalaryInput}
                keyboardType="decimal-pad"
                placeholder="0,00"
                placeholderTextColor={theme.textLight}
              />
            </View>

            <Label style={{ marginTop: SPACING.lg }}>Outras rendas fixas</Label>
            <View style={styles.amountWrapper}>
              <Text style={styles.currencyPrefix}>R$</Text>
              <TextInput
                style={styles.amountInput}
                value={otherInput}
                onChangeText={setOtherInput}
                keyboardType="decimal-pad"
                placeholder="0,00"
                placeholderTextColor={theme.textLight}
              />
            </View>

            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={styles.cancelBtn}
                onPress={() => setShowSalaryModal(false)}
              >
                <Text style={styles.cancelBtnText}>Cancelar</Text>
              </TouchableOpacity>
              <PrimaryButton label="Salvar" onPress={handleSaveSalary} style={{ flex: 2 }} />
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
}

function FabAction({
  label,
  icon,
  color,
  onPress,
}: {
  label: string;
  icon: string;
  color: string;
  onPress: () => void;
}) {
  const { theme } = useTheme();
  const styles = useThemedStyles(makeStyles);
  return (
    <TouchableOpacity style={styles.fabMenuItem} onPress={onPress} activeOpacity={0.8}>
      <View style={styles.fabMenuLabel}>
        <Text style={styles.fabMenuLabelText}>{label}</Text>
      </View>
      <View style={[styles.fabMenuBtn, { backgroundColor: color }]}>
        <MaterialCommunityIcons name={icon as never} size={20} color={theme.onFill} />
      </View>
    </TouchableOpacity>
  );
}

function Shortcut({
  icon,
  label,
  hint,
  onPress,
}: {
  icon: string;
  label: string;
  hint: string;
  onPress: () => void;
}) {
  const { theme } = useTheme();
  const styles = useThemedStyles(makeStyles);
  return (
    <TouchableOpacity style={styles.shortcut} onPress={onPress} activeOpacity={0.75}>
      <View style={styles.shortcutIcon}>
        <MaterialCommunityIcons name={icon as never} size={19} color={theme.primary} />
      </View>
      <Text style={styles.shortcutLabel}>{label}</Text>
      <Text style={styles.shortcutHint} numberOfLines={2}>
        {hint}
      </Text>
    </TouchableOpacity>
  );
}

const makeStyles = (t: ThemePalette) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: t.background },
    topBar: {
      paddingVertical: SPACING.sm,
      backgroundColor: t.background,
      borderBottomWidth: 1,
      borderBottomColor: t.divider,
    },
    scroll: { flex: 1 },
    content: { padding: SPACING.lg, paddingBottom: 110 },
    block: { marginTop: SPACING.lg },

    alertBanner: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: SPACING.sm,
      marginTop: SPACING.lg,
      padding: SPACING.md,
      borderRadius: RADIUS.md,
      backgroundColor: alpha(t.danger, 0.1),
      borderWidth: 1,
      borderColor: alpha(t.danger, 0.25),
    },
    alertText: { flex: 1, fontSize: 12.5, color: t.danger, lineHeight: 17, fontWeight: '500' },

    compositionHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: SPACING.md,
    },
    linkBtn: { flexDirection: 'row', alignItems: 'center', gap: 1 },
    linkText: { fontSize: 12.5, fontWeight: '700', color: t.primary },
    legend: { flexDirection: 'row', marginTop: SPACING.md, gap: SPACING.md },
    legendItem: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 6, minWidth: 0 },
    legendDot: { width: 8, height: 8, borderRadius: 4, flexShrink: 0 },
    legendLabel: { fontSize: 11, color: t.textSecondary },
    legendValue: {
      fontSize: 12.5,
      fontWeight: '700',
      color: t.text,
      fontVariant: ['tabular-nums'],
    },

    sectionHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: SPACING.sm,
      paddingVertical: SPACING.sm,
      marginBottom: SPACING.sm,
    },
    sectionTitle: { fontSize: 14.5, fontWeight: '700', color: t.text },
    sectionCount: { color: t.textLight, fontWeight: '600' },
    sectionHint: { fontSize: 11, color: t.textLight, marginTop: 1 },
    sectionTotal: {
      fontSize: 14,
      fontWeight: '700',
      color: t.text,
      fontVariant: ['tabular-nums'],
    },
    sectionEmpty: {
      fontSize: 12.5,
      color: t.textLight,
      paddingVertical: SPACING.md,
      paddingHorizontal: SPACING.xs,
      lineHeight: 18,
    },

    filterRow: { gap: SPACING.sm, paddingRight: SPACING.lg },

    shortcuts: { flexDirection: 'row', gap: SPACING.md, marginTop: SPACING.xl },
    shortcut: {
      flex: 1,
      backgroundColor: t.surface,
      borderRadius: RADIUS.lg,
      borderWidth: 1,
      borderColor: t.border,
      padding: SPACING.lg,
      gap: 3,
    },
    shortcutIcon: {
      width: 36,
      height: 36,
      borderRadius: RADIUS.sm + 2,
      backgroundColor: alpha(t.primary, 0.11),
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: SPACING.sm,
    },
    shortcutLabel: { fontSize: 14, fontWeight: '700', color: t.text },
    shortcutHint: { fontSize: 11.5, color: t.textSecondary, lineHeight: 16 },

    fab: {
      position: 'absolute',
      bottom: 24,
      right: 20,
      width: 56,
      height: 56,
      borderRadius: 28,
      backgroundColor: t.primaryFill,
      alignItems: 'center',
      justifyContent: 'center',
      shadowColor: t.shadow,
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.22,
      shadowRadius: 10,
      elevation: 6,
    },
    fabBackdrop: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: t.overlay,
      zIndex: 9,
    },
    fabMenu: { position: 'absolute', bottom: 92, right: 20, gap: SPACING.md, zIndex: 10 },
    fabMenuItem: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: SPACING.md,
      justifyContent: 'flex-end',
    },
    fabMenuLabel: {
      backgroundColor: t.surface,
      borderRadius: RADIUS.sm,
      paddingHorizontal: SPACING.md,
      paddingVertical: 7,
      borderWidth: 1,
      borderColor: t.border,
    },
    fabMenuLabelText: { fontSize: 13, fontWeight: '600', color: t.text },
    fabMenuBtn: {
      width: 46,
      height: 46,
      borderRadius: 23,
      alignItems: 'center',
      justifyContent: 'center',
    },

    modalOverlay: { flex: 1, backgroundColor: t.overlay, justifyContent: 'flex-end' },
    modalSheet: {
      backgroundColor: t.surface,
      borderTopLeftRadius: RADIUS.xl + 4,
      borderTopRightRadius: RADIUS.xl + 4,
      padding: SPACING.xl,
      paddingTop: SPACING.md,
    },
    handle: {
      width: 36,
      height: 4,
      backgroundColor: t.borderStrong,
      borderRadius: 2,
      alignSelf: 'center',
      marginBottom: SPACING.lg,
    },
    modalTitle: { fontSize: 20, fontWeight: '700', color: t.text, letterSpacing: -0.3 },
    modalSubtitle: { fontSize: 13, color: t.textSecondary, marginTop: 4, lineHeight: 18 },
    amountWrapper: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: SPACING.sm,
      backgroundColor: t.surfaceAlt,
      borderRadius: RADIUS.md,
      paddingHorizontal: SPACING.lg,
      borderWidth: 1,
      borderColor: t.border,
    },
    currencyPrefix: { fontSize: 16, fontWeight: '600', color: t.textSecondary },
    amountInput: {
      flex: 1,
      paddingVertical: 14,
      fontSize: 21,
      fontWeight: '700',
      color: t.text,
    },
    modalButtons: {
      flexDirection: 'row',
      gap: SPACING.md,
      marginTop: SPACING.xl,
      marginBottom: SPACING.sm,
      alignItems: 'center',
    },
    cancelBtn: {
      flex: 1,
      borderWidth: 1,
      borderColor: t.border,
      borderRadius: RADIUS.md,
      paddingVertical: 15,
      alignItems: 'center',
    },
    cancelBtnText: { color: t.textSecondary, fontWeight: '600', fontSize: 15 },
  });
