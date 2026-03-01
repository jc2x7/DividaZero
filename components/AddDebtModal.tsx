import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  ScrollView,
  TextInput,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Switch,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { COLORS } from '../constants/colors';
import { CATEGORIES } from '../constants/categories';
import { ExpenseCategory, ExpenseType } from '../types';
import {
  addFixedExpense,
  addInstallmentExpense,
  updateExpenseNotificationId,
} from '../database/database';
import { scheduleExpenseDueAlert } from '../hooks/useNotifications';
import { getTodayString } from '../utils/formatting';

interface AddDebtModalProps {
  visible: boolean;
  onClose: () => void;
  onAdded: () => void;
  year: number;
  month: number;
}

export default function AddDebtModal({
  visible,
  onClose,
  onAdded,
  year,
  month,
}: AddDebtModalProps) {
  const [name, setName] = useState('');
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState<ExpenseCategory>('OTHER');
  const [type, setType] = useState<ExpenseType>('FIXED');
  const [installments, setInstallments] = useState('1');
  const [dueDay, setDueDay] = useState('');
  const [alertEnabled, setAlertEnabled] = useState(false);
  const [saving, setSaving] = useState(false);

  const resetForm = () => {
    setName('');
    setAmount('');
    setCategory('OTHER');
    setType('FIXED');
    setInstallments('1');
    setDueDay('');
    setAlertEnabled(false);
  };

  const handleSave = async () => {
    if (!name.trim()) {
      Alert.alert('Atenção', 'Digite o nome da despesa.');
      return;
    }
    const amountNum = parseFloat(amount.replace(',', '.'));
    if (isNaN(amountNum) || amountNum <= 0) {
      Alert.alert('Atenção', 'Digite um valor válido.');
      return;
    }
    const dueDayNum = dueDay ? parseInt(dueDay, 10) : undefined;
    if (dueDay && (isNaN(dueDayNum!) || dueDayNum! < 1 || dueDayNum! > 31)) {
      Alert.alert('Atenção', 'Dia de vencimento deve ser entre 1 e 31.');
      return;
    }
    if (alertEnabled && !dueDayNum) {
      Alert.alert('Atenção', 'Informe o dia de vencimento para ativar o alerta.');
      return;
    }

    setSaving(true);
    try {
      const baseExpense = {
        name: name.trim(),
        category,
        amount: amountNum,
        type,
        installments_total: type === 'INSTALLMENT' ? parseInt(installments, 10) || 1 : 1,
        installments_current: 1,
        start_date: getTodayString(),
        is_active: 1 as const,
        due_day: dueDayNum,
        alert_enabled: alertEnabled && dueDayNum ? 1 : 0,
        is_paid: 0,
      };

      let insertedId: number | undefined;

      if (type === 'FIXED') {
        await addFixedExpense(baseExpense, year, month);
      } else {
        await addInstallmentExpense(baseExpense, year, month);
      }

      // Se alertas habilitados, agenda notificação para a despesa recém criada
      if (alertEnabled && dueDayNum) {
        const draftExpense = {
          id: -1, // será encontrado pelo efeito de reload
          ...baseExpense,
          year,
          month,
          due_day: dueDayNum,
          alert_enabled: 1,
        };
        // Agenda e ignora erro (permissão pode ter sido negada)
        await scheduleExpenseDueAlert(draftExpense, year, month);
      }

      resetForm();
      onAdded();
      onClose();
    } catch (error) {
      Alert.alert('Erro', 'Não foi possível salvar a despesa.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <KeyboardAvoidingView
        style={styles.overlay}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.sheet}>
          <View style={styles.handle} />

          <View style={styles.header}>
            <Text style={styles.title}>Nova Despesa</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <MaterialCommunityIcons name="close" size={22} color={COLORS.textSecondary} />
            </TouchableOpacity>
          </View>

          <ScrollView showsVerticalScrollIndicator={false}>
            {/* Name */}
            <Text style={styles.label}>Nome da Despesa</Text>
            <TextInput
              style={styles.input}
              placeholder="Ex: Aluguel, Parcela do Carro..."
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
                style={[styles.typeBtn, type === 'FIXED' && styles.typeBtnActive]}
                onPress={() => setType('FIXED')}
              >
                <MaterialCommunityIcons
                  name="repeat"
                  size={18}
                  color={type === 'FIXED' ? COLORS.highlight : COLORS.textSecondary}
                />
                <Text style={[styles.typeBtnText, type === 'FIXED' && styles.typeBtnTextActive]}>
                  Fixo (recorrente)
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.typeBtn, type === 'INSTALLMENT' && styles.typeBtnActive]}
                onPress={() => setType('INSTALLMENT')}
              >
                <MaterialCommunityIcons
                  name="credit-card-multiple"
                  size={18}
                  color={type === 'INSTALLMENT' ? COLORS.highlight : COLORS.textSecondary}
                />
                <Text style={[styles.typeBtnText, type === 'INSTALLMENT' && styles.typeBtnTextActive]}>
                  Parcelado
                </Text>
              </TouchableOpacity>
            </View>

            {/* Installments */}
            {type === 'INSTALLMENT' && (
              <>
                <Text style={styles.label}>Número de Parcelas</Text>
                <TextInput
                  style={styles.input}
                  placeholder="Ex: 12"
                  placeholderTextColor={COLORS.textLight}
                  value={installments}
                  onChangeText={setInstallments}
                  keyboardType="number-pad"
                />
              </>
            )}

            {/* Due Day + Alert */}
            <View style={styles.dueDateRow}>
              <View style={styles.dueDateField}>
                <Text style={styles.label}>Dia de Vencimento</Text>
                <View style={styles.dueDateInput}>
                  <MaterialCommunityIcons
                    name="calendar-clock"
                    size={18}
                    color={dueDay ? COLORS.highlight : COLORS.textLight}
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
              </View>

              <View style={styles.alertField}>
                <Text style={styles.label}>Alerta 1 dia antes</Text>
                <View style={styles.alertRow}>
                  <MaterialCommunityIcons
                    name={alertEnabled ? 'bell-ring' : 'bell-off-outline'}
                    size={20}
                    color={alertEnabled ? COLORS.highlight : COLORS.textLight}
                  />
                  <Switch
                    value={alertEnabled}
                    onValueChange={setAlertEnabled}
                    trackColor={{ false: COLORS.border, true: `${COLORS.highlight}60` }}
                    thumbColor={alertEnabled ? COLORS.highlight : COLORS.textLight}
                  />
                </View>
                {alertEnabled && (
                  <Text style={styles.alertHint}>
                    Avisa às 15h do dia anterior ao vencimento
                  </Text>
                )}
              </View>
            </View>

            {/* Category */}
            <Text style={styles.label}>Categoria</Text>
            <View style={styles.categoryGrid}>
              {CATEGORIES.map((cat) => (
                <TouchableOpacity
                  key={cat.value}
                  style={[
                    styles.catItem,
                    category === cat.value && { borderColor: cat.color, backgroundColor: `${cat.color}15` },
                  ]}
                  onPress={() => setCategory(cat.value)}
                >
                  <MaterialCommunityIcons
                    name={cat.icon as never}
                    size={22}
                    color={category === cat.value ? cat.color : COLORS.textLight}
                  />
                  <Text
                    style={[
                      styles.catLabel,
                      category === cat.value && { color: cat.color, fontWeight: '700' },
                    ]}
                    numberOfLines={1}
                  >
                    {cat.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Save Button */}
            <TouchableOpacity
              style={[styles.saveBtn, saving && { opacity: 0.6 }]}
              onPress={handleSave}
              disabled={saving}
            >
              <MaterialCommunityIcons name="check" size={20} color="#fff" />
              <Text style={styles.saveBtnText}>
                {saving ? 'Salvando...' : 'Adicionar Despesa'}
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
    maxHeight: '92%',
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
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  title: {
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
    borderColor: COLORS.highlight,
    backgroundColor: `${COLORS.highlight}10`,
  },
  typeBtnText: {
    fontSize: 13,
    color: COLORS.textSecondary,
    fontWeight: '500',
  },
  typeBtnTextActive: {
    color: COLORS.highlight,
    fontWeight: '700',
  },
  // Due date row
  dueDateRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 4,
  },
  dueDateField: {
    flex: 1,
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
  alertField: {
    flex: 1,
  },
  alertRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: COLORS.background,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  alertHint: {
    fontSize: 11,
    color: COLORS.highlight,
    marginTop: 4,
    lineHeight: 15,
  },
  categoryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 8,
  },
  catItem: {
    width: '30%',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: COLORS.border,
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 4,
    gap: 4,
  },
  catLabel: {
    fontSize: 11,
    color: COLORS.textSecondary,
    textAlign: 'center',
  },
  saveBtn: {
    backgroundColor: COLORS.highlight,
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
