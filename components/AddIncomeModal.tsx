import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  TextInput,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import {
  addSingleIncome,
  addInstallmentIncome,
  addFixedIncome,
} from '../database/database';
import { getTodayString, formatCurrency } from '../utils/formatting';
import { useTheme, useThemedStyles } from '../hooks/useTheme';
import { ThemePalette, RADIUS, SPACING, alpha } from '../constants/theme';
import { Label, PrimaryButton, SegmentedControl } from './ui';

interface AddIncomeModalProps {
  visible: boolean;
  onClose: () => void;
  onAdded: () => void;
  year: number;
  month: number;
}

type IncomeType = 'SINGLE' | 'INSTALLMENT' | 'RECURRING';

const TYPE_HINT: Record<IncomeType, string> = {
  SINGLE: 'Um valor que entrou só desta vez (bônus, venda, presente).',
  INSTALLMENT: 'Um valor que você vai receber dividido em algumas vezes.',
  RECURRING: 'Uma renda que entra todo mês, além do salário (aluguel, pensão).',
};

export default function AddIncomeModal({
  visible,
  onClose,
  onAdded,
  year,
  month,
}: AddIncomeModalProps) {
  const { theme } = useTheme();
  const styles = useThemedStyles(makeStyles);

  const [name, setName] = useState('');
  const [amount, setAmount] = useState('');
  const [type, setType] = useState<IncomeType>('SINGLE');
  const [installments, setInstallments] = useState('2');
  const [dueDay, setDueDay] = useState('');
  const [saving, setSaving] = useState(false);

  const resetForm = () => {
    setName('');
    setAmount('');
    setType('SINGLE');
    setInstallments('2');
    setDueDay('');
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  const amountNum = parseFloat(amount.replace(/\./g, '').replace(',', '.'));
  const installmentsNum = parseInt(installments, 10) || 2;

  const handleSave = async () => {
    if (!name.trim()) {
      Alert.alert('Falta o nome', 'Diga de onde veio essa entrada.');
      return;
    }
    if (isNaN(amountNum) || amountNum <= 0) {
      Alert.alert('Valor inválido', 'Digite um valor maior que zero.');
      return;
    }
    const dueDayNum = dueDay ? parseInt(dueDay, 10) : undefined;
    if (dueDay && (isNaN(dueDayNum!) || dueDayNum! < 1 || dueDayNum! > 31)) {
      Alert.alert('Dia inválido', 'O dia de recebimento deve estar entre 1 e 31.');
      return;
    }

    setSaving(true);
    try {
      const base = {
        name: name.trim(),
        category: 'OTHER' as const,
        amount: amountNum,
        type: 'VARIABLE' as const,
        installments_total: type === 'INSTALLMENT' ? installmentsNum : 1,
        installments_current: 1,
        start_date: getTodayString(),
        is_active: 1 as const,
        due_day: dueDayNum,
        alert_enabled: 0,
        is_paid: 0,
        is_income: 1,
      };

      if (type === 'SINGLE') {
        await addSingleIncome(base, year, month);
      } else if (type === 'INSTALLMENT') {
        await addInstallmentIncome(base, year, month);
      } else {
        await addFixedIncome(base, year, month);
      }

      resetForm();
      onAdded();
      onClose();
    } catch {
      Alert.alert('Erro', 'Não foi possível salvar a entrada.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={handleClose}>
      <KeyboardAvoidingView
        style={styles.overlay}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.sheet}>
          <View style={styles.handle} />

          <View style={styles.header}>
            <View style={styles.headerIcon}>
              <MaterialCommunityIcons name="arrow-down-left" size={20} color={theme.success} />
            </View>
            <Text style={styles.title}>Nova entrada</Text>
            <TouchableOpacity onPress={handleClose} style={styles.closeBtn} hitSlop={8}>
              <MaterialCommunityIcons name="close" size={22} color={theme.textSecondary} />
            </TouchableOpacity>
          </View>

          <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
            <Label>De onde veio</Label>
            <TextInput
              style={styles.input}
              placeholder="Freela, 13º, venda, aluguel recebido..."
              placeholderTextColor={theme.textLight}
              value={name}
              onChangeText={setName}
            />

            <Label style={styles.spaced}>
              Valor {type === 'INSTALLMENT' ? 'de cada parcela' : ''}
            </Label>
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

            <Label style={styles.spaced}>Como entra</Label>
            <SegmentedControl
              options={[
                { value: 'SINGLE' as IncomeType, label: 'Única', icon: 'numeric-1-circle-outline' },
                {
                  value: 'INSTALLMENT' as IncomeType,
                  label: 'Parcelada',
                  icon: 'credit-card-outline',
                },
                { value: 'RECURRING' as IncomeType, label: 'Todo mês', icon: 'repeat' },
              ]}
              value={type}
              onChange={setType}
            />
            <Text style={styles.hint}>{TYPE_HINT[type]}</Text>

            {type === 'INSTALLMENT' && (
              <>
                <Label style={styles.spaced}>Em quantas vezes</Label>
                <View style={styles.installmentRow}>
                  <TouchableOpacity
                    style={styles.stepBtn}
                    onPress={() => setInstallments(String(Math.max(2, installmentsNum - 1)))}
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
                    onPress={() => setInstallments(String(Math.min(60, installmentsNum + 1)))}
                  >
                    <MaterialCommunityIcons name="plus" size={18} color={theme.text} />
                  </TouchableOpacity>
                </View>
                {!isNaN(amountNum) && amountNum > 0 && (
                  <Text style={styles.hint}>
                    Total a receber:{' '}
                    <Text style={{ fontWeight: '700', color: theme.success }}>
                      {formatCurrency(amountNum * installmentsNum)}
                    </Text>
                  </Text>
                )}
              </>
            )}

            <Label style={styles.spaced}>Cai no dia</Label>
            <View style={styles.dueInput}>
              <MaterialCommunityIcons
                name="calendar-blank-outline"
                size={17}
                color={dueDay ? theme.success : theme.textLight}
              />
              <TextInput
                style={styles.dueTextInput}
                placeholder="opcional — 1 a 31"
                placeholderTextColor={theme.textLight}
                value={dueDay}
                onChangeText={(v) => setDueDay(v.replace(/[^0-9]/g, '').slice(0, 2))}
                keyboardType="number-pad"
                maxLength={2}
              />
            </View>

            <PrimaryButton
              label="Adicionar entrada"
              icon="check"
              onPress={handleSave}
              loading={saving}
              color={theme.successFill}
              style={{ marginTop: SPACING.xl, marginBottom: SPACING.md }}
            />
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
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
      alignItems: 'center',
      gap: SPACING.md,
      marginBottom: SPACING.lg,
    },
    headerIcon: {
      width: 36,
      height: 36,
      borderRadius: 18,
      backgroundColor: alpha(t.success, 0.12),
      alignItems: 'center',
      justifyContent: 'center',
    },
    title: { flex: 1, fontSize: 20, fontWeight: '700', color: t.text, letterSpacing: -0.3 },
    closeBtn: { padding: 4 },
    spaced: { marginTop: SPACING.lg },
    hint: { fontSize: 12.5, color: t.textSecondary, marginTop: SPACING.sm, lineHeight: 18 },
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
    amountInput: { flex: 1, paddingVertical: 14, fontSize: 22, fontWeight: '700', color: t.text },
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
    dueInput: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: SPACING.sm,
      backgroundColor: t.surfaceAlt,
      borderRadius: RADIUS.md,
      paddingHorizontal: 14,
      paddingVertical: 13,
      borderWidth: 1,
      borderColor: t.border,
    },
    dueTextInput: { flex: 1, fontSize: 15, color: t.text, padding: 0 },
  });
