import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Expense } from '../types';
import { formatCurrency } from '../utils/formatting';
import { useTheme, useThemedStyles } from '../hooks/useTheme';
import { ThemePalette, RADIUS, alpha } from '../constants/theme';
import { deleteExpenseScoped, countDeleteScope, DeleteResult } from '../database/database';
import { cancelExpenseNotifications } from '../hooks/useNotifications';
import { DeleteScope } from '../types';
import { Tag } from './ui';

interface IncomeCardProps {
  income: Expense;
  onDeleted: () => void;
}

export default function IncomeCard({ income, onDeleted }: IncomeCardProps) {
  const { theme } = useTheme();
  const styles = useThemedStyles(makeStyles);
  const isInstallment = income.type === 'INSTALLMENT';
  const isFixed = income.type === 'FIXED';

  const runDelete = async (scope: DeleteScope) => {
    const { notificationIds }: DeleteResult = await deleteExpenseScoped(income.id, scope);
    await cancelExpenseNotifications(notificationIds);
    onDeleted();
  };

  const handleDelete = async () => {
    if (!isInstallment && !isFixed) {
      Alert.alert('Excluir entrada', `Remover "${income.name}"?`, [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Excluir', style: 'destructive', onPress: () => runDelete('one') },
      ]);
      return;
    }

    const counts = await countDeleteScope(income.id);
    Alert.alert(
      'Excluir entrada',
      `"${income.name}" está lançada em ${counts.all} ${counts.all === 1 ? 'mês' : 'meses'}.`,
      [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Só este mês', onPress: () => runDelete('one') },
        {
          text: `Este e os ${Math.max(0, counts.future - 1)} próximos`,
          style: 'destructive',
          onPress: () => runDelete('future'),
        },
      ]
    );
  };

  return (
    <View style={styles.card}>
      <View style={styles.iconBox}>
        <MaterialCommunityIcons name="arrow-down-left" size={19} color={theme.success} />
      </View>

      <View style={styles.info}>
        <Text style={styles.name} numberOfLines={1}>
          {income.name}
        </Text>
        <View style={styles.tags}>
          {isInstallment ? (
            <Tag
              label={`${income.installments_current}/${income.installments_total}`}
              color={theme.info}
              icon="credit-card-outline"
            />
          ) : isFixed ? (
            <Tag label="Recorrente" color={theme.textSecondary} icon="repeat" />
          ) : (
            <Tag label="Única" color={theme.textSecondary} />
          )}
          {!!income.due_day && (
            <Tag
              label={`dia ${income.due_day}`}
              color={theme.textSecondary}
              icon="calendar-blank-outline"
            />
          )}
        </View>
      </View>

      <View style={styles.actions}>
        <Text style={styles.amount}>+{formatCurrency(income.amount)}</Text>
        <TouchableOpacity style={styles.iconBtn} onPress={handleDelete} hitSlop={6}>
          <MaterialCommunityIcons name="trash-can-outline" size={16} color={theme.textLight} />
        </TouchableOpacity>
      </View>
    </View>
  );
}

const makeStyles = (t: ThemePalette) =>
  StyleSheet.create({
    card: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: t.surface,
      borderRadius: RADIUS.md,
      borderWidth: 1,
      borderColor: alpha(t.success, 0.3),
      paddingVertical: 11,
      paddingHorizontal: 12,
      marginBottom: 8,
      gap: 10,
    },
    iconBox: {
      width: 36,
      height: 36,
      borderRadius: RADIUS.sm + 2,
      backgroundColor: alpha(t.success, 0.12),
      alignItems: 'center',
      justifyContent: 'center',
      flexShrink: 0,
    },
    info: { flex: 1, minWidth: 0 },
    name: { fontSize: 14.5, fontWeight: '600', color: t.text, marginBottom: 5 },
    tags: { flexDirection: 'row', flexWrap: 'wrap', gap: 4 },
    actions: { alignItems: 'flex-end', gap: 3 },
    amount: {
      fontSize: 14.5,
      fontWeight: '700',
      color: t.success,
      fontVariant: ['tabular-nums'],
    },
    iconBtn: { padding: 3 },
  });
