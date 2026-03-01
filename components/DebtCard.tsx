import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Expense } from '../types';
import { getCategoryConfig } from '../constants/categories';
import { formatCurrency } from '../utils/formatting';
import { COLORS } from '../constants/colors';
import { deleteExpense, deleteExpenseAndFuture, toggleExpensePaid } from '../database/database';

interface DebtCardProps {
  expense: Expense;
  onDeleted: () => void;
  onTogglePaid?: () => void;
  onEdit?: (expense: Expense) => void;
}

export default function DebtCard({ expense, onDeleted, onTogglePaid, onEdit }: DebtCardProps) {
  const cat = getCategoryConfig(expense.category);
  const isPaid = !!expense.is_paid;

  const handleTogglePaid = async () => {
    await toggleExpensePaid(expense.id, !isPaid);
    onTogglePaid?.();
  };

  const handleDelete = () => {
    if (expense.type === 'FIXED') {
      Alert.alert(
        'Excluir Despesa Fixa',
        'Deseja excluir apenas este mês ou este e todos os meses futuros?',
        [
          { text: 'Cancelar', style: 'cancel' },
          {
            text: 'Só este mês',
            onPress: async () => { await deleteExpense(expense.id); onDeleted(); },
          },
          {
            text: 'Este e futuros',
            style: 'destructive',
            onPress: async () => { await deleteExpenseAndFuture(expense.id); onDeleted(); },
          },
        ]
      );
    } else {
      Alert.alert(
        'Excluir Parcela',
        `Remover ${expense.name} (parcela ${expense.installments_current}/${expense.installments_total})?`,
        [
          { text: 'Cancelar', style: 'cancel' },
          {
            text: 'Excluir',
            style: 'destructive',
            onPress: async () => { await deleteExpense(expense.id); onDeleted(); },
          },
        ]
      );
    }
  };

  return (
    <View style={[styles.card, isPaid && styles.cardPaid]}>
      {/* Paid toggle */}
      <TouchableOpacity onPress={handleTogglePaid} style={styles.checkBtn} hitSlop={8}>
        <View style={[styles.checkCircle, isPaid && styles.checkCirclePaid]}>
          {isPaid && <MaterialCommunityIcons name="check" size={13} color="#fff" />}
        </View>
      </TouchableOpacity>

      {/* Category color bar */}
      <View style={[styles.categoryDot, { backgroundColor: isPaid ? COLORS.textLight : cat.color }]} />

      {/* Icon */}
      <View style={[styles.iconBox, { backgroundColor: isPaid ? `${COLORS.textLight}22` : `${cat.color}22` }]}>
        <MaterialCommunityIcons
          name={cat.icon as never}
          size={20}
          color={isPaid ? COLORS.textLight : cat.color}
        />
      </View>

      {/* Info */}
      <View style={styles.info}>
        <Text style={[styles.name, isPaid && styles.namePaid]} numberOfLines={1}>
          {expense.name}
        </Text>
        <View style={styles.tags}>
          <View style={[styles.tag, { backgroundColor: isPaid ? `${COLORS.textLight}20` : `${cat.color}20` }]}>
            <Text style={[styles.tagText, { color: isPaid ? COLORS.textLight : cat.color }]}>
              {cat.label}
            </Text>
          </View>
          {expense.type === 'INSTALLMENT' && (
            <View style={styles.tagInstallment}>
              <Text style={styles.tagInstallmentText}>
                {expense.installments_current}/{expense.installments_total}
              </Text>
            </View>
          )}
          {expense.type === 'FIXED' && (
            <View style={[styles.tagFixed, isPaid && { backgroundColor: `${COLORS.textLight}20` }]}>
              <Text style={[styles.tagFixedText, isPaid && { color: COLORS.textLight }]}>Fixo</Text>
            </View>
          )}
          {expense.due_day && (
            <View style={styles.tagDue}>
              <MaterialCommunityIcons
                name={expense.alert_enabled ? 'bell-ring' : 'calendar'}
                size={10}
                color={isPaid ? COLORS.textLight : COLORS.warning}
              />
              <Text style={[styles.tagDueText, isPaid && { color: COLORS.textLight }]}>
                dia {expense.due_day}
              </Text>
            </View>
          )}
        </View>
      </View>

      {/* Amount + buttons */}
      <View style={styles.actions}>
        <Text style={[styles.amount, isPaid && styles.amountPaid]}>
          {formatCurrency(expense.amount)}
        </Text>
        {isPaid && (
          <Text style={styles.paidBadge}>Pago ✓</Text>
        )}
        {!isPaid && (
          <View style={styles.buttons}>
            {onEdit && (
              <TouchableOpacity style={styles.iconBtn} onPress={() => onEdit(expense)}>
                <MaterialCommunityIcons name="pencil" size={16} color={COLORS.info} />
              </TouchableOpacity>
            )}
            <TouchableOpacity style={styles.iconBtn} onPress={handleDelete}>
              <MaterialCommunityIcons name="trash-can-outline" size={16} color={COLORS.error} />
            </TouchableOpacity>
          </View>
        )}
        {isPaid && (
          <View style={styles.buttons}>
            <TouchableOpacity style={styles.iconBtn} onPress={handleDelete}>
              <MaterialCommunityIcons name="trash-can-outline" size={14} color={COLORS.textLight} />
            </TouchableOpacity>
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.card,
    borderRadius: 14,
    padding: 12,
    marginBottom: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
    gap: 8,
  },
  cardPaid: {
    backgroundColor: `${COLORS.success}08`,
    borderWidth: 1,
    borderColor: `${COLORS.success}25`,
  },
  checkBtn: {
    padding: 2,
  },
  checkCircle: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: COLORS.border,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.background,
  },
  checkCirclePaid: {
    backgroundColor: COLORS.success,
    borderColor: COLORS.success,
  },
  categoryDot: {
    width: 4,
    height: 36,
    borderRadius: 2,
    flexShrink: 0,
  },
  iconBox: {
    width: 38,
    height: 38,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  info: {
    flex: 1,
    minWidth: 0,
  },
  name: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.text,
    marginBottom: 4,
  },
  namePaid: {
    textDecorationLine: 'line-through',
    color: COLORS.textLight,
  },
  tags: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 4,
  },
  tag: {
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  tagText: {
    fontSize: 10,
    fontWeight: '600',
  },
  tagInstallment: {
    backgroundColor: `${COLORS.info}20`,
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  tagInstallmentText: {
    fontSize: 10,
    fontWeight: '600',
    color: COLORS.info,
  },
  tagFixed: {
    backgroundColor: `${COLORS.success}20`,
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  tagFixedText: {
    fontSize: 10,
    fontWeight: '600',
    color: COLORS.success,
  },
  tagDue: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: `${COLORS.warning}20`,
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  tagDueText: {
    fontSize: 10,
    fontWeight: '600',
    color: COLORS.warning,
  },
  actions: {
    alignItems: 'flex-end',
    gap: 4,
  },
  amount: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.error,
  },
  amountPaid: {
    textDecorationLine: 'line-through',
    color: COLORS.textLight,
    fontSize: 13,
  },
  paidBadge: {
    fontSize: 10,
    fontWeight: '700',
    color: COLORS.success,
  },
  buttons: {
    flexDirection: 'row',
    gap: 4,
  },
  iconBtn: {
    padding: 4,
  },
});
