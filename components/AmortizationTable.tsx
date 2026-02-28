import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
} from 'react-native';
import { AmortizationRow } from '../types';
import { formatCurrency } from '../utils/formatting';
import { COLORS } from '../constants/colors';

interface AmortizationTableProps {
  rows: AmortizationRow[];
  type: 'PRICE' | 'SAC';
  totalInterest: number;
  totalPayment: number;
  monthlyPayment?: number;
}

export default function AmortizationTable({
  rows,
  type,
  totalInterest,
  totalPayment,
  monthlyPayment,
}: AmortizationTableProps) {
  const [showAll, setShowAll] = useState(false);
  const displayRows = showAll ? rows : rows.slice(0, 6);

  return (
    <View style={styles.container}>
      {/* Summary Cards */}
      <View style={styles.summaryRow}>
        <View style={[styles.summaryCard, { borderTopColor: COLORS.highlight }]}>
          <Text style={styles.summaryLabel}>
            {type === 'PRICE' ? 'Parcela Fixa' : '1ª Parcela'}
          </Text>
          <Text style={[styles.summaryValue, { color: COLORS.highlight }]}>
            {formatCurrency(rows[0]?.payment ?? 0)}
          </Text>
        </View>
        <View style={[styles.summaryCard, { borderTopColor: COLORS.error }]}>
          <Text style={styles.summaryLabel}>Total de Juros</Text>
          <Text style={[styles.summaryValue, { color: COLORS.error }]}>
            {formatCurrency(totalInterest)}
          </Text>
        </View>
        <View style={[styles.summaryCard, { borderTopColor: COLORS.info }]}>
          <Text style={styles.summaryLabel}>Total Pago</Text>
          <Text style={[styles.summaryValue, { color: COLORS.info }]}>
            {formatCurrency(totalPayment)}
          </Text>
        </View>
      </View>

      {/* Table Header */}
      <View style={styles.tableHeader}>
        <Text style={[styles.th, styles.col1]}>Parc.</Text>
        <Text style={[styles.th, styles.col2]}>Prestação</Text>
        <Text style={[styles.th, styles.col2]}>Juros</Text>
        <Text style={[styles.th, styles.col2]}>Amort.</Text>
        <Text style={[styles.th, styles.col2]}>Saldo</Text>
      </View>

      {/* Table Rows */}
      <ScrollView style={styles.tableScroll} nestedScrollEnabled>
        {displayRows.map((row, idx) => (
          <View
            key={row.period}
            style={[styles.tableRow, idx % 2 === 0 && styles.tableRowEven]}
          >
            <Text style={[styles.td, styles.col1, styles.tdPeriod]}>
              {row.period}
            </Text>
            <Text style={[styles.td, styles.col2]}>{formatCurrency(row.payment)}</Text>
            <Text style={[styles.td, styles.col2, { color: COLORS.error }]}>
              {formatCurrency(row.interest)}
            </Text>
            <Text style={[styles.td, styles.col2, { color: COLORS.success }]}>
              {formatCurrency(row.amortization)}
            </Text>
            <Text style={[styles.td, styles.col2]}>
              {formatCurrency(Math.max(0, row.balance))}
            </Text>
          </View>
        ))}
      </ScrollView>

      {rows.length > 6 && (
        <TouchableOpacity
          style={styles.showMoreBtn}
          onPress={() => setShowAll(!showAll)}
        >
          <Text style={styles.showMoreText}>
            {showAll ? 'Mostrar menos' : `Ver todas as ${rows.length} parcelas`}
          </Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: COLORS.card,
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.07,
    shadowRadius: 6,
    elevation: 2,
  },
  summaryRow: {
    flexDirection: 'row',
    gap: 8,
    padding: 14,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  summaryCard: {
    flex: 1,
    backgroundColor: COLORS.background,
    borderRadius: 10,
    padding: 10,
    alignItems: 'center',
    borderTopWidth: 3,
  },
  summaryLabel: {
    fontSize: 10,
    color: COLORS.textSecondary,
    marginBottom: 4,
    textAlign: 'center',
  },
  summaryValue: {
    fontSize: 13,
    fontWeight: '800',
    textAlign: 'center',
  },
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: COLORS.secondary,
    paddingVertical: 10,
    paddingHorizontal: 14,
  },
  th: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  tableScroll: {
    maxHeight: 300,
  },
  tableRow: {
    flexDirection: 'row',
    paddingVertical: 10,
    paddingHorizontal: 14,
  },
  tableRowEven: {
    backgroundColor: `${COLORS.background}88`,
  },
  td: {
    fontSize: 12,
    color: COLORS.text,
  },
  tdPeriod: {
    fontWeight: '700',
    color: COLORS.textSecondary,
  },
  col1: {
    width: 36,
  },
  col2: {
    flex: 1,
    textAlign: 'right',
  },
  showMoreBtn: {
    paddingVertical: 12,
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  showMoreText: {
    fontSize: 13,
    color: COLORS.highlight,
    fontWeight: '600',
  },
});
