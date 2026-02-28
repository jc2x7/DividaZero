import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { COLORS } from '../constants/colors';
import { formatCurrency } from '../utils/formatting';

interface SummaryCardProps {
  income: number;
  expenses: number;
  balance: number;
}

export default function SummaryCard({ income, expenses, balance }: SummaryCardProps) {
  const isPositive = balance >= 0;
  const savingsRate = income > 0 ? ((balance / income) * 100).toFixed(1) : '0';

  return (
    <View style={styles.card}>
      <View style={styles.row}>
        <View style={styles.item}>
          <View style={[styles.iconBox, { backgroundColor: `${COLORS.success}20` }]}>
            <MaterialCommunityIcons name="arrow-down-circle" size={20} color={COLORS.success} />
          </View>
          <Text style={styles.itemLabel}>Entradas</Text>
          <Text style={[styles.itemValue, { color: COLORS.success }]}>
            {formatCurrency(income)}
          </Text>
        </View>

        <View style={styles.divider} />

        <View style={styles.item}>
          <View style={[styles.iconBox, { backgroundColor: `${COLORS.error}20` }]}>
            <MaterialCommunityIcons name="arrow-up-circle" size={20} color={COLORS.error} />
          </View>
          <Text style={styles.itemLabel}>Saídas</Text>
          <Text style={[styles.itemValue, { color: COLORS.error }]}>
            {formatCurrency(expenses)}
          </Text>
        </View>

        <View style={styles.divider} />

        <View style={styles.item}>
          <View
            style={[
              styles.iconBox,
              { backgroundColor: isPositive ? `${COLORS.info}20` : `${COLORS.warning}20` },
            ]}
          >
            <MaterialCommunityIcons
              name={isPositive ? 'piggy-bank' : 'alert-circle'}
              size={20}
              color={isPositive ? COLORS.info : COLORS.warning}
            />
          </View>
          <Text style={styles.itemLabel}>Saldo</Text>
          <Text
            style={[
              styles.itemValue,
              { color: isPositive ? COLORS.info : COLORS.warning },
            ]}
          >
            {formatCurrency(balance)}
          </Text>
        </View>
      </View>

      {income > 0 && (
        <View style={styles.savingsRow}>
          <Text style={styles.savingsLabel}>Taxa de Economia:</Text>
          <Text
            style={[
              styles.savingsValue,
              { color: isPositive ? COLORS.success : COLORS.error },
            ]}
          >
            {savingsRate}%
          </Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: COLORS.card,
    borderRadius: 18,
    padding: 18,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  item: {
    flex: 1,
    alignItems: 'center',
  },
  iconBox: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
  },
  itemLabel: {
    fontSize: 11,
    color: COLORS.textSecondary,
    marginBottom: 4,
    fontWeight: '500',
  },
  itemValue: {
    fontSize: 13,
    fontWeight: '800',
    textAlign: 'center',
  },
  divider: {
    width: 1,
    height: 50,
    backgroundColor: COLORS.border,
    marginHorizontal: 4,
  },
  savingsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 14,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    gap: 6,
  },
  savingsLabel: {
    fontSize: 12,
    color: COLORS.textSecondary,
  },
  savingsValue: {
    fontSize: 13,
    fontWeight: '800',
  },
});
