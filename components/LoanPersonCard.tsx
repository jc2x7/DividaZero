import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { LoanPerson } from '../types';
import {
  formatCurrency,
  formatPhone,
} from '../utils/formatting';
import { calculateLoanInstallment } from '../utils/calculations';
import { useTheme, useThemedStyles } from '../hooks/useTheme';
import { ThemePalette, alpha } from '../constants/theme';

interface LoanPersonCardProps {
  person: LoanPerson;
  onPress: () => void;
  onCharge: () => void;
}

export default function LoanPersonCard({ person, onPress, onCharge }: LoanPersonCardProps) {
  const { theme } = useTheme();
  const styles = useThemedStyles(makeStyles);
  const installmentAmount = calculateLoanInstallment(
    person.total_amount,
    person.monthly_interest,
    person.installments
  );
  const remaining = person.installments - person.installments_paid;
  const progressPercent = (person.installments_paid / person.installments) * 100;
  const isFullyPaid = remaining === 0;

  return (
    <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.8}>
      {/* Avatar */}
      <View style={styles.avatar}>
        <Text style={styles.avatarText}>
          {person.name.charAt(0).toUpperCase()}
        </Text>
      </View>

      {/* Info */}
      <View style={styles.info}>
        <View style={styles.topRow}>
          <Text style={styles.name} numberOfLines={1}>{person.name}</Text>
          {isFullyPaid && (
            <View style={styles.paidBadge}>
              <MaterialCommunityIcons name="check-circle" size={12} color={theme.success} />
              <Text style={styles.paidText}>Quitado</Text>
            </View>
          )}
        </View>
        <Text style={styles.phone}>{formatPhone(person.phone)}</Text>

        {/* Progress */}
        <View style={styles.progressRow}>
          <View style={styles.progressBar}>
            <View
              style={[styles.progressFill, { width: `${progressPercent}%` }]}
            />
          </View>
          <Text style={styles.progressText}>
            {person.installments_paid}/{person.installments}
          </Text>
        </View>

        {/* Amounts row */}
        <View style={styles.amountsRow}>
          <View>
            <Text style={styles.amountLabel}>Parcela</Text>
            <Text style={styles.amount}>{formatCurrency(installmentAmount)}</Text>
          </View>
          <View>
            <Text style={styles.amountLabel}>Total</Text>
            <Text style={styles.totalAmount}>{formatCurrency(person.total_amount)}</Text>
          </View>
          <View>
            <Text style={styles.amountLabel}>Vence dia</Text>
            <Text style={styles.dueDay}>{person.payment_day}</Text>
          </View>
        </View>
      </View>

      {/* Charge Button */}
      {!isFullyPaid && (
        <TouchableOpacity style={styles.chargeBtn} onPress={onCharge}>
          <MaterialCommunityIcons name="whatsapp" size={22} color="#25D366" />
        </TouchableOpacity>
      )}
    </TouchableOpacity>
  );
}

const makeStyles = (t: ThemePalette) => StyleSheet.create({
  card: {
    flexDirection: 'row',
    backgroundColor: t.surface,
    borderRadius: 16,
    padding: 14,
    marginBottom: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 3,
    alignItems: 'flex-start',
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: t.primaryFill,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
    marginTop: 2,
  },
  avatarText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '700',
  },
  info: {
    flex: 1,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 2,
  },
  name: {
    fontSize: 16,
    fontWeight: '700',
    color: t.text,
    flex: 1,
  },
  paidBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: alpha(t.success, 0.08),
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
  },
  paidText: {
    fontSize: 10,
    fontWeight: '700',
    color: t.success,
  },
  phone: {
    fontSize: 12,
    color: t.textSecondary,
    marginBottom: 8,
  },
  progressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  progressBar: {
    flex: 1,
    height: 5,
    backgroundColor: t.border,
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: t.primaryFill,
    borderRadius: 3,
  },
  progressText: {
    fontSize: 11,
    color: t.textSecondary,
    fontWeight: '600',
  },
  amountsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  amountLabel: {
    fontSize: 10,
    color: t.textSecondary,
    marginBottom: 2,
  },
  amount: {
    fontSize: 13,
    fontWeight: '700',
    color: t.primary,
  },
  totalAmount: {
    fontSize: 13,
    fontWeight: '700',
    color: t.text,
  },
  dueDay: {
    fontSize: 13,
    fontWeight: '700',
    color: t.info,
  },
  chargeBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(37, 211, 102, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 8,
    alignSelf: 'center',
  },
});
