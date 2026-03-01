import React, { useState, useCallback } from 'react';
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
import { COLORS } from '../../constants/colors';
import { CATEGORIES, getCategoryConfig } from '../../constants/categories';
import { useMonthData } from '../../hooks/useMonthData';
import DebtCard from '../../components/DebtCard';
import AddDebtModal from '../../components/AddDebtModal';
import MonthYearPicker from '../../components/MonthYearPicker';
import SummaryCard from '../../components/SummaryCard';
import DonutChart from '../../components/DonutChart';
import { formatCurrency, getMonthName } from '../../utils/formatting';
import { upsertSalary } from '../../database/database';
import { ExpenseCategory } from '../../types';

export default function DashboardScreen() {
  const today = new Date();
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth() + 1);
  const [showAddDebt, setShowAddDebt] = useState(false);
  const [showSalaryModal, setShowSalaryModal] = useState(false);
  const [salaryInput, setSalaryInput] = useState('');
  const [otherInput, setOtherInput] = useState('');
  const [filterCategory, setFilterCategory] = useState<ExpenseCategory | 'ALL'>('ALL');
  const [showCharts, setShowCharts] = useState(false);

  const { expenses, salary, summary, loading, reload } = useMonthData(year, month);

  useFocusEffect(
    useCallback(() => {
      reload();
    }, [reload])
  );

  const filteredExpenses =
    filterCategory === 'ALL'
      ? expenses
      : expenses.filter((e) => e.category === filterCategory);

  const handleOpenSalaryModal = () => {
    setSalaryInput(salary ? String(salary.amount) : '');
    setOtherInput(salary ? String(salary.other_income) : '');
    setShowSalaryModal(true);
  };

  const handleSaveSalary = async () => {
    const amount = parseFloat(salaryInput.replace(',', '.'));
    const other = parseFloat(otherInput.replace(',', '.')) || 0;
    if (isNaN(amount) || amount < 0) {
      Alert.alert('Atenção', 'Digite um valor de salário válido.');
      return;
    }
    await upsertSalary(year, month, amount, other);
    setShowSalaryModal(false);
    reload();
  };

  const activeCategories = summary.categoryBreakdown.map((c) => c.category);

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={reload} />}
      >
        {/* Month Selector */}
        <MonthYearPicker
          year={year}
          month={month}
          onSelect={(y, m) => {
            setYear(y);
            setMonth(m);
          }}
        />

        {/* Salary Banner */}
        <TouchableOpacity style={styles.salaryBanner} onPress={handleOpenSalaryModal}>
          <View>
            <Text style={styles.salaryLabel}>Salário + Entradas</Text>
            <Text style={styles.salaryValue}>
              {formatCurrency((salary?.amount ?? 0) + (salary?.other_income ?? 0))}
            </Text>
            {salary?.other_income ? (
              <Text style={styles.salaryOther}>
                Salário: {formatCurrency(salary.amount)} · Outros: {formatCurrency(salary.other_income)}
              </Text>
            ) : null}
          </View>
          <View style={styles.editSalaryBtn}>
            <MaterialCommunityIcons name="pencil" size={18} color="#fff" />
            <Text style={styles.editSalaryText}>Editar</Text>
          </View>
        </TouchableOpacity>

        {/* Summary */}
        <SummaryCard
          income={(salary?.amount ?? 0) + (salary?.other_income ?? 0)}
          expenses={summary.totalExpenses}
          balance={summary.balance}
        />

        {/* Category Filter */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            {expenses.length > 0 ? (
              <TouchableOpacity
                style={styles.infoBtn}
                onPress={() => setShowCharts(true)}
                hitSlop={8}
              >
                <MaterialCommunityIcons name="information" size={20} color={COLORS.highlight} />
              </TouchableOpacity>
            ) : (
              <View style={styles.infoBtnPlaceholder} />
            )}
            <Text style={styles.sectionTitle}>
              Despesas de {getMonthName(month)}/{year}
            </Text>
          </View>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.filterRow}
          >
            <TouchableOpacity
              style={[styles.filterChip, filterCategory === 'ALL' && styles.filterChipActive]}
              onPress={() => setFilterCategory('ALL')}
            >
              <Text style={[styles.filterChipText, filterCategory === 'ALL' && styles.filterChipTextActive]}>
                Todas ({expenses.length})
              </Text>
            </TouchableOpacity>
            {CATEGORIES.filter((c) => activeCategories.includes(c.value as ExpenseCategory)).map((cat) => (
              <TouchableOpacity
                key={cat.value}
                style={[
                  styles.filterChip,
                  filterCategory === cat.value && {
                    backgroundColor: `${cat.color}20`,
                    borderColor: cat.color,
                  },
                ]}
                onPress={() => setFilterCategory(cat.value as ExpenseCategory)}
              >
                <MaterialCommunityIcons
                  name={cat.icon as never}
                  size={14}
                  color={filterCategory === cat.value ? cat.color : COLORS.textSecondary}
                />
                <Text
                  style={[
                    styles.filterChipText,
                    filterCategory === cat.value && { color: cat.color, fontWeight: '700' },
                  ]}
                >
                  {cat.label}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          {/* Expenses List */}
          {filteredExpenses.length === 0 ? (
            <View style={styles.emptyContainer}>
              <MaterialCommunityIcons name="receipt" size={48} color={COLORS.textLight} />
              <Text style={styles.emptyText}>Nenhuma despesa registrada</Text>
              <Text style={styles.emptySubtext}>
                Toque no + para adicionar uma despesa
              </Text>
            </View>
          ) : (
            filteredExpenses.map((expense) => (
              <DebtCard
                key={expense.id}
                expense={expense}
                onDeleted={reload}
                onTogglePaid={reload}
              />
            ))
          )}
        </View>
      </ScrollView>

      {/* FAB */}
      <TouchableOpacity
        style={styles.fab}
        onPress={() => setShowAddDebt(true)}
      >
        <MaterialCommunityIcons name="plus" size={28} color="#fff" />
      </TouchableOpacity>

      {/* Add Debt Modal */}
      <AddDebtModal
        visible={showAddDebt}
        onClose={() => setShowAddDebt(false)}
        onAdded={reload}
        year={year}
        month={month}
      />

      {/* ── Charts Modal ── */}
      <Modal
        visible={showCharts}
        transparent
        animationType="slide"
        onRequestClose={() => setShowCharts(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalSheet, styles.chartsSheet]}>
            <View style={styles.handle} />
            <View style={styles.chartsHeader}>
              <Text style={styles.modalTitle}>
                Análise · {getMonthName(month)}/{year}
              </Text>
              <TouchableOpacity onPress={() => setShowCharts(false)} style={{ padding: 4 }}>
                <MaterialCommunityIcons name="close" size={22} color={COLORS.textSecondary} />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              {/* Status pago / pendente */}
              <View style={styles.chartSection}>
                <Text style={styles.chartSectionTitle}>Status das Despesas</Text>
                <DonutChart
                  size={200}
                  strokeWidth={36}
                  data={[
                    {
                      value: summary.paidTotal,
                      color: COLORS.success,
                      label: 'Pagas',
                      sublabel: formatCurrency(summary.paidTotal),
                    },
                    {
                      value: summary.unpaidTotal,
                      color: COLORS.error,
                      label: 'Pendentes',
                      sublabel: formatCurrency(summary.unpaidTotal),
                    },
                  ]}
                  centerLabel={
                    summary.totalExpenses > 0
                      ? `${Math.round((summary.paidTotal / summary.totalExpenses) * 100)}%`
                      : '0%'
                  }
                  centerSub="pago"
                />
              </View>

              {/* Por categoria */}
              {summary.categoryBreakdown.length > 0 && (
                <View style={styles.chartSection}>
                  <Text style={styles.chartSectionTitle}>Por Categoria</Text>
                  <DonutChart
                    size={200}
                    strokeWidth={36}
                    data={summary.categoryBreakdown.map((cat) => {
                      const cfg = getCategoryConfig(cat.category);
                      return {
                        value: cat.total,
                        color: cfg.color,
                        label: cfg.label,
                        sublabel: formatCurrency(cat.total),
                      };
                    })}
                    centerLabel={formatCurrency(summary.totalExpenses)}
                    centerSub="total"
                  />
                </View>
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Salary Modal */}
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
            <Text style={styles.modalTitle}>Editar Salário e Entradas</Text>
            <Text style={styles.modalSubtitle}>
              {getMonthName(month)} / {year}
            </Text>

            <Text style={styles.inputLabel}>Salário Principal (R$)</Text>
            <TextInput
              style={styles.modalInput}
              value={salaryInput}
              onChangeText={setSalaryInput}
              keyboardType="decimal-pad"
              placeholder="0,00"
              placeholderTextColor={COLORS.textLight}
            />

            <Text style={styles.inputLabel}>Outras Entradas (R$)</Text>
            <TextInput
              style={styles.modalInput}
              value={otherInput}
              onChangeText={setOtherInput}
              keyboardType="decimal-pad"
              placeholder="Freelance, bônus, etc."
              placeholderTextColor={COLORS.textLight}
            />

            <Text style={styles.salaryNote}>
              * Ao alterar o salário, o valor será aplicado apenas a partir deste mês.
              Os meses anteriores permanecem inalterados.
            </Text>

            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={styles.cancelBtn}
                onPress={() => setShowSalaryModal(false)}
              >
                <Text style={styles.cancelBtnText}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.confirmBtn} onPress={handleSaveSalary}>
                <Text style={styles.confirmBtnText}>Salvar</Text>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  scroll: {
    flex: 1,
  },
  content: {
    padding: 16,
    paddingBottom: 100,
  },
  salaryBanner: {
    backgroundColor: COLORS.primary,
    borderRadius: 18,
    padding: 18,
    marginBottom: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  salaryLabel: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 12,
    fontWeight: '500',
    marginBottom: 4,
  },
  salaryValue: {
    color: '#fff',
    fontSize: 26,
    fontWeight: '800',
  },
  salaryOther: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 11,
    marginTop: 4,
  },
  editSalaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(255,255,255,0.15)',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
  },
  editSalaryText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '600',
  },
  section: {
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.text,
    flex: 1,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  infoBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: `${COLORS.highlight}15`,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  infoBtnPlaceholder: {
    width: 28,
    height: 28,
  },
  chartsSheet: {
    maxHeight: '90%',
  },
  chartsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  chartSection: {
    backgroundColor: COLORS.background,
    borderRadius: 16,
    padding: 20,
    alignItems: 'center',
    marginBottom: 16,
  },
  chartSectionTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginBottom: 16,
    alignSelf: 'flex-start',
  },
  filterRow: {
    gap: 8,
    paddingBottom: 12,
  },
  filterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderWidth: 1.5,
    borderColor: COLORS.border,
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: COLORS.card,
  },
  filterChipActive: {
    backgroundColor: `${COLORS.highlight}15`,
    borderColor: COLORS.highlight,
  },
  filterChipText: {
    fontSize: 12,
    color: COLORS.textSecondary,
    fontWeight: '500',
  },
  filterChipTextActive: {
    color: COLORS.highlight,
    fontWeight: '700',
  },
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: 40,
    gap: 8,
  },
  emptyText: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.textSecondary,
  },
  emptySubtext: {
    fontSize: 13,
    color: COLORS.textLight,
  },
  fab: {
    position: 'absolute',
    bottom: 24,
    right: 24,
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: COLORS.highlight,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: COLORS.highlight,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 10,
    elevation: 8,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalSheet: {
    backgroundColor: COLORS.surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
  },
  handle: {
    width: 40,
    height: 4,
    backgroundColor: COLORS.border,
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: COLORS.text,
    marginBottom: 4,
  },
  modalSubtitle: {
    fontSize: 14,
    color: COLORS.textSecondary,
    marginBottom: 20,
  },
  inputLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.textSecondary,
    marginBottom: 8,
    marginTop: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  modalInput: {
    backgroundColor: COLORS.background,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 18,
    color: COLORS.text,
    borderWidth: 1,
    borderColor: COLORS.border,
    fontWeight: '600',
  },
  salaryNote: {
    fontSize: 11,
    color: COLORS.textLight,
    marginTop: 12,
    lineHeight: 16,
  },
  modalButtons: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 24,
    marginBottom: 8,
  },
  cancelBtn: {
    flex: 1,
    borderWidth: 1.5,
    borderColor: COLORS.border,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  cancelBtnText: {
    color: COLORS.textSecondary,
    fontWeight: '600',
  },
  confirmBtn: {
    flex: 2,
    backgroundColor: COLORS.highlight,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  confirmBtnText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 16,
  },
});
