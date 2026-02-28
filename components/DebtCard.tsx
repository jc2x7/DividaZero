import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Expense } from '../types';
import { getCategoryConfig } from '../constants/categories';
import { formatCurrency } from '../utils/formatting';
import { COLORS } from '../constants/colors';
import { deleteExpense, deleteExpenseAndFuture } from '../database/database';

interface DebtCardProps {
  expense: Expense;
  onDeleted: () => void;
  onEdit?: (expense: Expense) => void;
}

export default function DebtCard({ expense, onDeleted, onEdit }: DebtCardProps) {
  const cat = getCategoryConfig(expense.category);

  const handleDelete = () => {
    if (expense.type === 'FIXED') {
      Alert.alert(
        'Excluir Despesa Fixa',
        'Deseja excluir apenas este mês ou este e todos os meses futuros?',
        [
          { text: 'Cancelar', style: 'cancel' },
          {
            text: 'Só este mês',
            onPress: async () => {
              await deleteExpense(expense.id);
              onDeleted();
            },
          },
          {
            text: 'Este e futuros',
            style: 'destructive',
            onPress: async () => {
              await deleteExpenseAndFuture(expense.id);
              onDeleted();
            },
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
            onPress: async () => {
              await deleteExpense(expense.id);
              onDeleted();
            },
          },
        ]
      );
    }
  };

  return (
    <View style={styles.card}>
      <View style={[styles.categoryDot, { backgroundColor: cat.color }]} />
      <View style={[styles.iconBox, { backgroundColor: `${cat.color}22` }]}>
        <MaterialCommunityIcons name={cat.icon as never} size={20} color={cat.color} />
      </View>
      <View style={styles.info}>
        <Text style={styles.name} numberOfLines={1}>{expense.name}</Text>
        <View style={styles.tags}>
          <View style={[styles.tag, { backgroundColor: `${cat.color}20` }]}>
            <Text style={[styles.tagText, { color: cat.color }]}>{cat.label}</Text>
          </View>
          {expense.type === 'INSTALLMENT' && (
            <View style={styles.tagInstallment}>
              <Text style={styles.tagInstallmentText}>
                {expense.installments_current}/{expense.installments_total}
              </Text>
            </View>
          )}
          {expense.type === 'FIXED' && (
            <View style={styles.tagFixed}>
              <Text style={styles.tagFixedText}>Fixo</Text>
            </View>
          )}
        </View>
      </View>
      <View style={styles.actions}>
        <Text style={styles.amount}>{formatCurrency(expense.amount)}</Text>
        <View style={styles.buttons}>
          {onEdit && (
            <TouchableOpacity
              style={styles.editBtn}
              onPress={() => onEdit(expense)}
            >
              <MaterialCommunityIcons name="pencil" size={16} color={COLORS.info} />
            </TouchableOpacity>
          )}
          <TouchableOpacity style={styles.deleteBtn} onPress={handleDelete}>
            <MaterialCommunityIcons name="trash-can-outline" size={16} color={COLORS.error} />
          </TouchableOpacity>
        </View>
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
    padding: 14,
    marginBottom: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  categoryDot: {
    width: 4,
    height: 40,
    borderRadius: 2,
    marginRight: 10,
  },
  iconBox: {
    width: 40,
    height: 40,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  info: {
    flex: 1,
  },
  name: {
    fontSize: 15,
    fontWeight: '600',
    color: COLORS.text,
    marginBottom: 4,
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
  actions: {
    alignItems: 'flex-end',
  },
  amount: {
    fontSize: 15,
    fontWeight: '700',
    color: COLORS.error,
    marginBottom: 6,
  },
  buttons: {
    flexDirection: 'row',
    gap: 6,
  },
  editBtn: {
    padding: 4,
  },
  deleteBtn: {
    padding: 4,
  },
});
