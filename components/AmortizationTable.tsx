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
import { useTheme, useThemedStyles } from '../hooks/useTheme';
import { ThemePalette, alpha } from '../constants/theme';

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
  const { theme } = useTheme();
  const styles = useThemedStyles(makeStyles);
  const [showAll, setShowAll] = useState(false);
  const displayRows = showAll ? rows : rows.slice(0, 6);

  return (
    <View style={styles.container}>
      {/* Summary Cards */}
      <View style={styles.summaryRow}>
        <View style={[styles.summaryCard, { borderTopColor: theme.primary }]}>
          <Text style={styles.summaryLabel}>
            {type === 'PRICE' ? 'Parcela Fixa' : '1ª Parcela'}
          </Text>
          <Text style={[styles.summaryValue, { color: theme.primary }]}>
            {formatCurrency(rows[0]?.payment ?? 0)}
          </Text>
        </View>
        <View style={[styles.summaryCard, { borderTopColor: theme.danger }]}>
          <Text style={styles.summaryLabel}>Total de Juros</Text>
          <Text style={[styles.summaryValue, { color: theme.danger }]}>
            {formatCurrency(totalInterest)}
          </Text>
        </View>
        <View style={[styles.summaryCard, { borderTopColor: theme.info }]}>
          <Text style={styles.summaryLabel}>Total Pago</Text>
          <Text style={[styles.summaryValue, { color: theme.info }]}>
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
            <Text style={[styles.td, styles.col2, { color: theme.danger }]}>
              {formatCurrency(row.interest)}
            </Text>
            <Text style={[styles.td, styles.col2, { color: theme.success }]}>
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

const makeStyles = (t: ThemePalette) => StyleSheet.create({
  container: {
    backgroundColor: t.surface,
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
    borderBottomColor: t.border,
  },
  summaryCard: {
    flex: 1,
    backgroundColor: t.background,
    borderRadius: 10,
    padding: 10,
    alignItems: 'center',
    borderTopWidth: 3,
  },
  summaryLabel: {
    fontSize: 10,
    color: t.textSecondary,
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
    backgroundColor: t.surfaceAlt,
    paddingVertical: 10,
    paddingHorizontal: 14,
  },
  th: {
    color: t.textSecondary,
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
    backgroundColor: alpha(t.background, 0.53),
  },
  td: {
    fontSize: 12,
    color: t.text,
  },
  tdPeriod: {
    fontWeight: '700',
    color: t.textSecondary,
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
    borderTopColor: t.border,
  },
  showMoreText: {
    fontSize: 13,
    color: t.primary,
    fontWeight: '600',
  },
});
