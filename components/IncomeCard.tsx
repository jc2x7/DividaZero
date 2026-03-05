import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Expense } from '../types';
import { formatCurrency } from '../utils/formatting';
import { COLORS } from '../constants/colors';
import { deleteExpense } from '../database/database';

interface IncomeCardProps {
  income: Expense;
  onDeleted: () => void;
}

export default function IncomeCard({ income, onDeleted }: IncomeCardProps) {
  const isInstallment = income.type === 'INSTALLMENT';

  const handleDelete = () => {
    Alert.alert(
      'Excluir Entrada',
      `Remover "${income.name}"?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Excluir',
          style: 'destructive',
          onPress: async () => {
            await deleteExpense(income.id);
            onDeleted();
          },
        },
      ]
    );
  };

  return (
    <View style={styles.card}>
      {/* Color bar */}
      <View style={styles.colorBar} />

      {/* Icon */}
      <View style={styles.iconBox}>
        <MaterialCommunityIcons name="cash-plus" size={20} color={COLORS.success} />
      </View>

      {/* Info */}
      <View style={styles.info}>
        <Text style={styles.name} numberOfLines={1}>
          {income.name}
        </Text>
        <View style={styles.tags}>
          {isInstallment ? (
            <View style={styles.tagInstallment}>
              <Text style={styles.tagInstallmentText}>
                Parcela {income.installments_current}/{income.installments_total}
              </Text>
            </View>
          ) : (
            <View style={styles.tagSingle}>
              <Text style={styles.tagSingleText}>Única</Text>
            </View>
          )}
          {income.due_day ? (
            <View style={styles.tagDue}>
              <MaterialCommunityIcons name="calendar" size={10} color={COLORS.info} />
              <Text style={styles.tagDueText}>dia {income.due_day}</Text>
            </View>
          ) : null}
        </View>
      </View>

      {/* Amount + delete */}
      <View style={styles.actions}>
        <Text style={styles.amount}>{formatCurrency(income.amount)}</Text>
        <TouchableOpacity style={styles.iconBtn} onPress={handleDelete}>
          <MaterialCommunityIcons name="trash-can-outline" size={16} color={COLORS.textLight} />
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: `${COLORS.success}10`,
    borderRadius: 14,
    padding: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: `${COLORS.success}30`,
    gap: 8,
  },
  colorBar: {
    width: 4,
    height: 36,
    borderRadius: 2,
    backgroundColor: COLORS.success,
    flexShrink: 0,
  },
  iconBox: {
    width: 38,
    height: 38,
    borderRadius: 10,
    backgroundColor: `${COLORS.success}20`,
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
  tags: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 4,
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
  tagSingle: {
    backgroundColor: `${COLORS.success}20`,
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  tagSingleText: {
    fontSize: 10,
    fontWeight: '600',
    color: COLORS.success,
  },
  tagDue: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: `${COLORS.info}15`,
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  tagDueText: {
    fontSize: 10,
    fontWeight: '600',
    color: COLORS.info,
  },
  actions: {
    alignItems: 'flex-end',
    gap: 4,
  },
  amount: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.success,
  },
  iconBtn: {
    padding: 4,
  },
});
