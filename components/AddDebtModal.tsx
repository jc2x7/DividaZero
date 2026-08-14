import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  ScrollView,
  TextInput,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Switch,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useCategories } from '../hooks/useCategories';
import { Expense, ExpenseCategory, ExpenseType, DeleteScope, Category } from '../types';
import CategoryFormModal from './CategoryFormModal';
import {
  addFixedExpense,
  addInstallmentExpense,
  addVariableExpense,
  updateExpense,
  updateExpenseAndFuture,
  updateExpenseGroup,
  getExpenseGroup,
} from '../database/database';
import { scheduleExpenseDueAlert } from '../hooks/useNotifications';
import { getTodayString, formatCurrency } from '../utils/formatting';
import { useTheme, useThemedStyles } from '../hooks/useTheme';
import { ThemePalette, RADIUS, SPACING, alpha, categoryColor } from '../constants/theme';
import { Label, PrimaryButton, SegmentedControl } from './ui';

interface AddDebtModalProps {
  visible: boolean;
  onClose: () => void;
  onAdded: () => void;
  year: number;
  month: number;
  editingExpense?: Expense;
}

const TYPE_OPTIONS: { value: ExpenseType; label: string; icon: string; hint: string }[] = [
  {
    value: 'VARIABLE',
    label: 'Avulso',
    icon: 'cart-outline',
    hint: 'Um gasto único. Só aparece neste mês.',
  },
  {
    value: 'FIXED',
    label: 'Fixo',
    icon: 'repeat',
    hint: 'Se repete todo mês, sem data para acabar (aluguel, academia, streaming).',
  },
  {
    value: 'INSTALLMENT',
    label: 'Parcelado',
    icon: 'credit-card-outline',
    hint: 'Compra dividida em parcelas, com fim previsto.',
  },
];

export default function AddDebtModal({
  visible,
  onClose,
  onAdded,
  year,
  month,
  editingExpense,
}: AddDebtModalProps) {
  const { theme } = useTheme();
  const styles = useThemedStyles(makeStyles);
  const { categories } = useCategories();
  const isEditing = !!editingExpense;

  const [showNewCategory, setShowNewCategory] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | undefined>();

  const [name, setName] = useState('');
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState<ExpenseCategory>('OTHER');
  const [type, setType] = useState<ExpenseType>('VARIABLE');
  const [installments, setInstallments] = useState('12');
  const [dueDay, setDueDay] = useState('');
  const [alertEnabled, setAlertEnabled] = useState(false);
  const [editScope, setEditScope] = useState<DeleteScope>('future');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!visible) return;
    if (editingExpense) {
      setName(editingExpense.name);
      setAmount(String(editingExpense.amount));
      setCategory(editingExpense.category);
      setType(editingExpense.type);
      setInstallments(String(editingExpense.installments_total ?? 1));
      setDueDay(editingExpense.due_day ? String(editingExpense.due_day) : '');
      setAlertEnabled(!!editingExpense.alert_enabled);
      setEditScope('future');
    } else {
      resetForm();
    }
  }, [editingExpense, visible]);

  const resetForm = () => {
    setName('');
    setAmount('');
    setCategory('OTHER');
    setType('VARIABLE');
    setInstallments('12');
    setDueDay('');
    setAlertEnabled(false);
    setEditScope('future');
  };

  const amountNum = parseFloat(amount.replace(/\./g, '').replace(',', '.'));
  const installmentsNum = parseInt(installments, 10) || 1;
  const isRecurring = type === 'FIXED' || type === 'INSTALLMENT';

  const handleSave = async () => {
    if (!name.trim()) {
      Alert.alert('Falta o nome', 'Diga o que é essa despesa.');
      return;
    }
    if (isNaN(amountNum) || amountNum <= 0) {
      Alert.alert('Valor inválido', 'Digite um valor maior que zero.');
      return;
    }
    const dueDayNum = dueDay ? parseInt(dueDay, 10) : undefined;
    if (dueDay && (isNaN(dueDayNum!) || dueDayNum! < 1 || dueDayNum! > 31)) {
      Alert.alert('Dia inválido', 'O dia de vencimento deve estar entre 1 e 31.');
      return;
    }
    if (alertEnabled && !dueDayNum) {
      Alert.alert('Falta o vencimento', 'Informe o dia de vencimento para ligar o alerta.');
      return;
    }
    if (type === 'INSTALLMENT' && (installmentsNum < 1 || installmentsNum > 120)) {
      Alert.alert('Parcelas inválidas', 'Informe entre 1 e 120 parcelas.');
      return;
    }

    setSaving(true);
    try {
      if (isEditing && editingExpense) {
        const updates = {
          name: name.trim(),
          amount: amountNum,
          category,
          due_day: dueDayNum,
          alert_enabled: alertEnabled && dueDayNum ? 1 : 0,
        };
        const recurringEdit = editingExpense.type === 'FIXED' || editingExpense.type === 'INSTALLMENT';
        if (!recurringEdit || editScope === 'one') {
          await updateExpense(editingExpense.id, updates);
        } else if (editScope === 'future') {
          await updateExpenseAndFuture(editingExpense.id, updates);
        } else {
          await updateExpenseGroup(editingExpense.id, updates);
        }
      } else {
        const baseExpense = {
          name: name.trim(),
          category,
          amount: amountNum,
          type,
          installments_total: type === 'INSTALLMENT' ? installmentsNum : 1,
          installments_current: 1,
          start_date: getTodayString(),
          is_active: 1 as const,
          due_day: dueDayNum,
          alert_enabled: alertEnabled && dueDayNum ? 1 : 0,
          is_paid: 0,
        };

        const groupId =
          type === 'FIXED'
            ? await addFixedExpense(baseExpense, year, month)
            : type === 'INSTALLMENT'
              ? await addInstallmentExpense(baseExpense, year, month)
              : await addVariableExpense(baseExpense, year, month);

        if (alertEnabled && dueDayNum) {
          // Agenda contra a linha já gravada — só assim o alerta pode ser
          // cancelado depois, se a despesa for excluída.
          const [first] = await getExpenseGroup(groupId);
          if (first) await scheduleExpenseDueAlert(first, year, month);
        }
      }

      resetForm();
      onAdded();
      onClose();
    } catch {
      Alert.alert('Erro', 'Não foi possível salvar a despesa.');
    } finally {
      setSaving(false);
    }
  };

  const typeHint = TYPE_OPTIONS.find((o) => o.value === type)?.hint;

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <KeyboardAvoidingView
        style={styles.overlay}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.sheet}>
          <View style={styles.handle} />

          <View style={styles.header}>
            <Text style={styles.title}>{isEditing ? 'Editar despesa' : 'Nova despesa'}</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn} hitSlop={8}>
              <MaterialCommunityIcons name="close" size={22} color={theme.textSecondary} />
            </TouchableOpacity>
          </View>

          <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
            <Label>O que é</Label>
            <TextInput
              style={styles.input}
              placeholder="Aluguel, mercado, parcela do celular..."
              placeholderTextColor={theme.textLight}
              value={name}
              onChangeText={setName}
            />

            <Label style={styles.spaced}>Valor {type === 'INSTALLMENT' ? 'da parcela' : ''}</Label>
            <View style={styles.amountWrapper}>
              <Text style={styles.currencyPrefix}>R$</Text>
              <TextInput
                style={styles.amountInput}
                placeholder="0,00"
                placeholderTextColor={theme.textLight}
                value={amount}
                onChangeText={setAmount}
                keyboardType="decimal-pad"
              />
            </View>

            {!isEditing && (
              <>
                <Label style={styles.spaced}>Tipo</Label>
                <SegmentedControl
                  options={TYPE_OPTIONS.map((o) => ({
                    value: o.value,
                    label: o.label,
                    icon: o.icon,
                  }))}
                  value={type}
                  onChange={setType}
                />
                {!!typeHint && <Text style={styles.hint}>{typeHint}</Text>}
              </>
            )}

            {!isEditing && type === 'INSTALLMENT' && (
              <>
                <Label style={styles.spaced}>Em quantas vezes</Label>
                <View style={styles.installmentRow}>
                  <TouchableOpacity
                    style={styles.stepBtn}
                    onPress={() => setInstallments(String(Math.max(1, installmentsNum - 1)))}
                  >
                    <MaterialCommunityIcons name="minus" size={18} color={theme.text} />
                  </TouchableOpacity>
                  <TextInput
                    style={styles.installmentInput}
                    value={installments}
                    onChangeText={(v) => setInstallments(v.replace(/[^0-9]/g, '').slice(0, 3))}
                    keyboardType="number-pad"
                  />
                  <TouchableOpacity
                    style={styles.stepBtn}
                    onPress={() => setInstallments(String(Math.min(120, installmentsNum + 1)))}
                  >
                    <MaterialCommunityIcons name="plus" size={18} color={theme.text} />
                  </TouchableOpacity>
                </View>
                {!isNaN(amountNum) && amountNum > 0 && (
                  <Text style={styles.hint}>
                    {installmentsNum}x de {formatCurrency(amountNum)} — total{' '}
                    <Text style={{ fontWeight: '700', color: theme.text }}>
                      {formatCurrency(amountNum * installmentsNum)}
                    </Text>
                  </Text>
                )}
              </>
            )}

            {/* Alcance da edição, só quando faz diferença */}
            {isEditing &&
              (editingExpense?.type === 'FIXED' || editingExpense?.type === 'INSTALLMENT') && (
                <>
                  <Label style={styles.spaced}>Aplicar a</Label>
                  <SegmentedControl
                    options={[
                      { value: 'one' as DeleteScope, label: 'Só este mês' },
                      { value: 'future' as DeleteScope, label: 'Daqui pra frente' },
                      { value: 'all' as DeleteScope, label: 'Tudo' },
                    ]}
                    value={editScope}
                    onChange={setEditScope}
                  />
                  <Text style={styles.hint}>
                    {editScope === 'one'
                      ? 'Altera apenas a ocorrência deste mês.'
                      : editScope === 'future'
                        ? 'Altera este mês e os seguintes. O histórico fica intacto.'
                        : 'Altera todos os meses, inclusive os já passados.'}
                  </Text>
                </>
              )}

            <View style={styles.dueRow}>
              <View style={styles.dueField}>
                <Label>Vence dia</Label>
                <View style={styles.dueInput}>
                  <MaterialCommunityIcons
                    name="calendar-blank-outline"
                    size={17}
                    color={dueDay ? theme.primary : theme.textLight}
                  />
                  <TextInput
                    style={styles.dueTextInput}
                    placeholder="opcional"
                    placeholderTextColor={theme.textLight}
                    value={dueDay}
                    onChangeText={(v) => setDueDay(v.replace(/[^0-9]/g, '').slice(0, 2))}
                    keyboardType="number-pad"
                    maxLength={2}
                  />
                </View>
              </View>

              <View style={styles.dueField}>
                <Label>Me avisar</Label>
                <View style={styles.alertRow}>
                  <MaterialCommunityIcons
                    name={alertEnabled ? 'bell-ring-outline' : 'bell-off-outline'}
                    size={19}
                    color={alertEnabled ? theme.primary : theme.textLight}
                  />
                  <Switch
                    value={alertEnabled}
                    onValueChange={setAlertEnabled}
                    trackColor={{ false: theme.surfaceSunken, true: alpha(theme.primary, 0.4) }}
                    thumbColor={alertEnabled ? theme.primaryFill : theme.textLight}
                  />
                </View>
              </View>
            </View>
            {alertEnabled && (
              <Text style={styles.hint}>Notificação às 15h do dia anterior ao vencimento.</Text>
            )}

            <Label style={styles.spaced}>Categoria</Label>
            <View style={styles.categoryGrid}>
              {categories.map((cat) => {
                const tint = categoryColor(cat.color, theme);
                const active = category === cat.key;
                return (
                  <TouchableOpacity
                    key={cat.key}
                    style={[
                      styles.catItem,
                      active && { borderColor: tint, backgroundColor: alpha(tint, 0.1) },
                    ]}
                    onPress={() => setCategory(cat.key)}
                    onLongPress={() => setEditingCategory(cat)}
                    activeOpacity={0.7}
                  >
                    <MaterialCommunityIcons
                      name={cat.icon as never}
                      size={20}
                      color={active ? tint : theme.textLight}
                    />
                    <Text
                      style={[styles.catLabel, active && { color: tint, fontWeight: '700' }]}
                      numberOfLines={1}
                    >
                      {cat.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}

              <TouchableOpacity
                style={[styles.catItem, styles.catItemNew]}
                onPress={() => setShowNewCategory(true)}
                activeOpacity={0.7}
              >
                <MaterialCommunityIcons name="plus" size={20} color={theme.primary} />
                <Text style={[styles.catLabel, { color: theme.primary, fontWeight: '700' }]}>
                  Nova
                </Text>
              </TouchableOpacity>
            </View>
            <Text style={styles.hint}>
              Segure uma categoria para editar o nome, o ícone ou a cor.
            </Text>

            <PrimaryButton
              label={isEditing ? 'Salvar alterações' : 'Adicionar despesa'}
              icon="check"
              onPress={handleSave}
              loading={saving}
              style={{ marginTop: SPACING.xl, marginBottom: SPACING.md }}
            />
          </ScrollView>
        </View>
      </KeyboardAvoidingView>

      <CategoryFormModal
        visible={showNewCategory || !!editingCategory}
        editing={editingCategory}
        onClose={() => {
          setShowNewCategory(false);
          setEditingCategory(undefined);
        }}
        onSaved={(key) => setCategory(key)}
      />
    </Modal>
  );
}

const makeStyles = (t: ThemePalette) =>
  StyleSheet.create({
    overlay: { flex: 1, backgroundColor: t.overlay, justifyContent: 'flex-end' },
    sheet: {
      backgroundColor: t.surface,
      borderTopLeftRadius: RADIUS.xl + 4,
      borderTopRightRadius: RADIUS.xl + 4,
      paddingHorizontal: SPACING.xl,
      paddingTop: SPACING.md,
      maxHeight: '92%',
    },
    handle: {
      width: 36,
      height: 4,
      backgroundColor: t.borderStrong,
      borderRadius: 2,
      alignSelf: 'center',
      marginBottom: SPACING.lg,
    },
    header: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: SPACING.lg,
    },
    title: { fontSize: 20, fontWeight: '700', color: t.text, letterSpacing: -0.3 },
    closeBtn: { padding: 4 },
    spaced: { marginTop: SPACING.lg },
    hint: {
      fontSize: 12.5,
      color: t.textSecondary,
      marginTop: SPACING.sm,
      lineHeight: 18,
    },
    input: {
      backgroundColor: t.surfaceAlt,
      borderRadius: RADIUS.md,
      paddingHorizontal: SPACING.lg,
      paddingVertical: 14,
      fontSize: 15.5,
      color: t.text,
      borderWidth: 1,
      borderColor: t.border,
    },
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
      fontSize: 22,
      fontWeight: '700',
      color: t.text,
    },
    installmentRow: { flexDirection: 'row', alignItems: 'center', gap: SPACING.md },
    stepBtn: {
      width: 46,
      height: 46,
      borderRadius: RADIUS.md,
      borderWidth: 1,
      borderColor: t.border,
      backgroundColor: t.surfaceAlt,
      alignItems: 'center',
      justifyContent: 'center',
    },
    installmentInput: {
      flex: 1,
      textAlign: 'center',
      backgroundColor: t.surfaceAlt,
      borderRadius: RADIUS.md,
      borderWidth: 1,
      borderColor: t.border,
      paddingVertical: 12,
      fontSize: 19,
      fontWeight: '700',
      color: t.text,
    },
    dueRow: { flexDirection: 'row', gap: SPACING.md, marginTop: SPACING.lg },
    dueField: { flex: 1 },
    dueInput: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: SPACING.sm,
      backgroundColor: t.surfaceAlt,
      borderRadius: RADIUS.md,
      paddingHorizontal: 14,
      paddingVertical: 12,
      borderWidth: 1,
      borderColor: t.border,
    },
    dueTextInput: { flex: 1, fontSize: 15, color: t.text, padding: 0 },
    alertRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      backgroundColor: t.surfaceAlt,
      borderRadius: RADIUS.md,
      paddingHorizontal: 14,
      paddingVertical: 8,
      borderWidth: 1,
      borderColor: t.border,
    },
    categoryGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.sm },
    catItemNew: { borderStyle: 'dashed', borderColor: t.primary },
    catItem: {
      width: '31.4%',
      alignItems: 'center',
      borderWidth: 1,
      borderColor: t.border,
      borderRadius: RADIUS.md,
      paddingVertical: 11,
      paddingHorizontal: 4,
      gap: 5,
    },
    catLabel: { fontSize: 11, color: t.textSecondary, textAlign: 'center' },
  });
