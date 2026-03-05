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
import { COLORS } from '../constants/colors';
import { addSingleIncome, addInstallmentIncome } from '../database/database';
import { getTodayString } from '../utils/formatting';

interface AddIncomeModalProps {
  visible: boolean;
  onClose: () => void;
  onAdded: () => void;
  year: number;
  month: number;
}

type IncomeType = 'SINGLE' | 'INSTALLMENT';

export default function AddIncomeModal({
  visible,
  onClose,
  onAdded,
  year,
  month,
}: AddIncomeModalProps) {
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

  const handleSave = async () => {
    if (!name.trim()) {
      Alert.alert('Atenção', 'Digite o nome da entrada.');
      return;
    }
    const amountNum = parseFloat(amount.replace(',', '.'));
    if (isNaN(amountNum) || amountNum <= 0) {
      Alert.alert('Atenção', 'Digite um valor válido.');
      return;
    }
    const dueDayNum = dueDay ? parseInt(dueDay, 10) : undefined;
    if (dueDay && (isNaN(dueDayNum!) || dueDayNum! < 1 || dueDayNum! > 31)) {
      Alert.alert('Atenção', 'Dia de recebimento deve ser entre 1 e 31.');
      return;
    }

    setSaving(true);
    try {
      const base = {
        name: name.trim(),
        category: 'OTHER' as const,
        amount: amountNum,
        type: 'FIXED' as const,
        installments_total: type === 'INSTALLMENT' ? parseInt(installments, 10) || 2 : 1,
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
      } else {
        await addInstallmentIncome(base, year, month);
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
              <MaterialCommunityIcons name="cash-plus" size={22} color={COLORS.success} />
            </View>
            <Text style={styles.title}>Nova Entrada</Text>
            <TouchableOpacity onPress={handleClose} style={styles.closeBtn}>
              <MaterialCommunityIcons name="close" size={22} color={COLORS.textSecondary} />
            </TouchableOpacity>
          </View>

          <ScrollView showsVerticalScrollIndicator={false}>
            {/* Name */}
            <Text style={styles.label}>Nome da Entrada</Text>
            <TextInput
              style={styles.input}
              placeholder="Ex: Freelance, Bônus, Venda..."
              placeholderTextColor={COLORS.textLight}
              value={name}
              onChangeText={setName}
            />

            {/* Amount */}
            <Text style={styles.label}>Valor (R$)</Text>
            <TextInput
              style={styles.input}
              placeholder="0,00"
              placeholderTextColor={COLORS.textLight}
              value={amount}
              onChangeText={setAmount}
              keyboardType="decimal-pad"
            />

            {/* Type */}
            <Text style={styles.label}>Tipo</Text>
            <View style={styles.typeRow}>
              <TouchableOpacity
                style={[styles.typeBtn, type === 'SINGLE' && styles.typeBtnActive]}
                onPress={() => setType('SINGLE')}
              >
                <MaterialCommunityIcons
                  name="cash"
                  size={18}
                  color={type === 'SINGLE' ? COLORS.success : COLORS.textSecondary}
                />
                <Text style={[styles.typeBtnText, type === 'SINGLE' && styles.typeBtnTextActive]}>
                  Entrada Única
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.typeBtn, type === 'INSTALLMENT' && styles.typeBtnActive]}
                onPress={() => setType('INSTALLMENT')}
              >
                <MaterialCommunityIcons
                  name="cash-multiple"
                  size={18}
                  color={type === 'INSTALLMENT' ? COLORS.success : COLORS.textSecondary}
                />
                <Text style={[styles.typeBtnText, type === 'INSTALLMENT' && styles.typeBtnTextActive]}>
                  Parcelada
                </Text>
              </TouchableOpacity>
            </View>

            {/* Installments */}
            {type === 'INSTALLMENT' && (
              <>
                <Text style={styles.label}>Número de Parcelas</Text>
                <TextInput
                  style={styles.input}
                  placeholder="Ex: 3"
                  placeholderTextColor={COLORS.textLight}
                  value={installments}
                  onChangeText={setInstallments}
                  keyboardType="number-pad"
                />
                <Text style={styles.hint}>
                  O valor será dividido em {parseInt(installments) || 2}x de{' '}
                  {amount
                    ? `R$ ${(parseFloat(amount.replace(',', '.')) / (parseInt(installments) || 2)).toFixed(2).replace('.', ',')}`
                    : 'R$ 0,00'}{' '}
                  ao longo dos próximos meses.
                </Text>
              </>
            )}

            {/* Due Day */}
            <Text style={styles.label}>Dia de Recebimento</Text>
            <View style={styles.dueDateInput}>
              <MaterialCommunityIcons
                name="calendar-check"
                size={18}
                color={dueDay ? COLORS.success : COLORS.textLight}
              />
              <TextInput
                style={styles.dueDateTextInput}
                placeholder="1–31  (opcional)"
                placeholderTextColor={COLORS.textLight}
                value={dueDay}
                onChangeText={(v) => setDueDay(v.replace(/[^0-9]/g, '').slice(0, 2))}
                keyboardType="number-pad"
                maxLength={2}
              />
            </View>

            {/* Save Button */}
            <TouchableOpacity
              style={[styles.saveBtn, saving && { opacity: 0.6 }]}
              onPress={handleSave}
              disabled={saving}
            >
              <MaterialCommunityIcons name="check" size={20} color="#fff" />
              <Text style={styles.saveBtnText}>
                {saving ? 'Salvando...' : 'Registrar Entrada'}
              </Text>
            </TouchableOpacity>
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: COLORS.surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    maxHeight: '88%',
  },
  handle: {
    width: 40,
    height: 4,
    backgroundColor: COLORS.border,
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 16,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
    gap: 10,
  },
  headerIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: `${COLORS.success}20`,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    flex: 1,
    fontSize: 20,
    fontWeight: '700',
    color: COLORS.text,
  },
  closeBtn: { padding: 4 },
  label: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.textSecondary,
    marginBottom: 8,
    marginTop: 14,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  input: {
    backgroundColor: COLORS.background,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    color: COLORS.text,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  typeRow: {
    flexDirection: 'row',
    gap: 10,
  },
  typeBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderWidth: 1.5,
    borderColor: COLORS.border,
    borderRadius: 12,
    paddingVertical: 12,
  },
  typeBtnActive: {
    borderColor: COLORS.success,
    backgroundColor: `${COLORS.success}10`,
  },
  typeBtnText: {
    fontSize: 13,
    color: COLORS.textSecondary,
    fontWeight: '500',
  },
  typeBtnTextActive: {
    color: COLORS.success,
    fontWeight: '700',
  },
  hint: {
    fontSize: 12,
    color: COLORS.textSecondary,
    marginTop: 6,
    lineHeight: 17,
    fontStyle: 'italic',
  },
  dueDateInput: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: COLORS.background,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  dueDateTextInput: {
    flex: 1,
    fontSize: 16,
    color: COLORS.text,
    padding: 0,
  },
  saveBtn: {
    backgroundColor: COLORS.success,
    borderRadius: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 16,
    marginTop: 20,
    marginBottom: 10,
  },
  saveBtnText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
});
