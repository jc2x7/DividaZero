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
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useTheme, useThemedStyles } from '../hooks/useTheme';
import { MoneyInput } from './ui';
import { ThemePalette, alpha } from '../constants/theme';
import { addLoanPerson } from '../database/database';
import { schedulePaymentNotification } from '../hooks/useNotifications';
import { getLoanPerson } from '../database/database';
import { getTodayString } from '../utils/formatting';

interface AddLoanModalProps {
  visible: boolean;
  onClose: () => void;
  onAdded: () => void;
}

function Field({
  label,
  value,
  onChange,
  placeholder,
  keyboardType = 'default',
  dinheiro,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  keyboardType?: 'default' | 'decimal-pad' | 'phone-pad' | 'number-pad';
  /** Aplica a máscara de moeda, que preenche dos centavos para cima. */
  dinheiro?: boolean;
}) {
  const { theme } = useTheme();
  const styles = useThemedStyles(makeStyles);

  if (dinheiro) {
    return (
      <>
        <Text style={styles.label}>{label}</Text>
        <MoneyInput
          value={parseFloat(value.replace(',', '.')) || 0}
          onChangeValue={(v) => onChange(v > 0 ? String(v) : '')}
          size="medio"
        />
      </>
    );
  }

  return (
    <>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        style={styles.input}
        value={value}
        onChangeText={onChange}
        placeholder={placeholder}
        placeholderTextColor={theme.textLight}
        keyboardType={keyboardType}
      />
    </>
  );
}

export default function AddLoanModal({ visible, onClose, onAdded }: AddLoanModalProps) {
  const { theme } = useTheme();
  const styles = useThemedStyles(makeStyles);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [amount, setAmount] = useState('');
  const [interest, setInterest] = useState('0');
  const [installments, setInstallments] = useState('1');
  const [paymentDay, setPaymentDay] = useState('1');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  const resetForm = () => {
    setName('');
    setPhone('');
    setAmount('');
    setInterest('0');
    setInstallments('1');
    setPaymentDay('1');
    setNotes('');
  };

  const handleSave = async () => {
    if (!name.trim()) {
      Alert.alert('Atenção', 'Digite o nome da pessoa.');
      return;
    }
    if (!phone.trim()) {
      Alert.alert('Atenção', 'Digite o telefone da pessoa.');
      return;
    }
    const amountNum = parseFloat(amount.replace(',', '.'));
    if (isNaN(amountNum) || amountNum <= 0) {
      Alert.alert('Atenção', 'Digite um valor válido.');
      return;
    }

    const dayNum = parseInt(paymentDay, 10);
    if (isNaN(dayNum) || dayNum < 1 || dayNum > 31) {
      Alert.alert('Atenção', 'Dia de pagamento inválido (1-31).');
      return;
    }

    setSaving(true);
    try {
      const id = await addLoanPerson({
        name: name.trim(),
        phone: phone.trim(),
        total_amount: amountNum,
        monthly_interest: parseFloat(interest.replace(',', '.')) || 0,
        installments: parseInt(installments, 10) || 1,
        installments_paid: 0,
        start_date: getTodayString(),
        payment_day: dayNum,
        notes: notes.trim() || undefined,
        is_active: 1,
      });

      // Agenda 3 lembretes: 5, 3 e 1 dia antes do vencimento
      const person = await getLoanPerson(id);
      if (person) {
        await schedulePaymentNotification(person);
      }

      resetForm();
      onAdded();
      onClose();
    } catch (error) {
      Alert.alert('Erro', 'Não foi possível salvar o empréstimo.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <KeyboardAvoidingView
        style={styles.overlay}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'android' ? 0 : 0}
      >
        <View style={styles.sheet}>
          <View style={styles.handle} />
          <View style={styles.header}>
            <Text style={styles.title}>Novo Empréstimo</Text>
            <TouchableOpacity onPress={onClose}>
              <MaterialCommunityIcons name="close" size={22} color={theme.textSecondary} />
            </TouchableOpacity>
          </View>

          <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
            <Field label="Nome" value={name} onChange={setName} placeholder="Nome completo" />
            <Field
              label="Telefone (WhatsApp)"
              value={phone}
              onChange={setPhone}
              placeholder="(11) 99999-9999"
              keyboardType="phone-pad"
            />
            <Field
              label="Valor Emprestado (R$)"
              value={amount}
              onChange={setAmount}
              dinheiro
            />
            <Field
              label="Juros Mensal (%)"
              value={interest}
              onChange={setInterest}
              placeholder="0,00"
              keyboardType="decimal-pad"
            />
            <Field
              label="Número de Parcelas"
              value={installments}
              onChange={setInstallments}
              placeholder="1"
              keyboardType="number-pad"
            />
            <Field
              label="Dia de Pagamento (1-31)"
              value={paymentDay}
              onChange={setPaymentDay}
              placeholder="1"
              keyboardType="number-pad"
            />

            <Text style={styles.label}>Observações (opcional)</Text>
            <TextInput
              style={[styles.input, styles.notesInput]}
              value={notes}
              onChangeText={setNotes}
              placeholder="Motivo do empréstimo..."
              placeholderTextColor={theme.textLight}
              multiline
              numberOfLines={3}
            />

            <TouchableOpacity
              style={[styles.saveBtn, saving && { opacity: 0.6 }]}
              onPress={handleSave}
              disabled={saving}
            >
              <MaterialCommunityIcons name="check" size={20} color="#fff" />
              <Text style={styles.saveBtnText}>
                {saving ? 'Salvando...' : 'Registrar Empréstimo'}
              </Text>
            </TouchableOpacity>
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const makeStyles = (t: ThemePalette) => StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: t.surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    maxHeight: '90%',
  },
  handle: {
    width: 40,
    height: 4,
    backgroundColor: t.border,
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
    color: t.text,
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
    color: t.textSecondary,
    marginBottom: 8,
    marginTop: 14,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  input: {
    backgroundColor: t.background,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    color: t.text,
    borderWidth: 1,
    borderColor: t.border,
  },
  notesInput: {
    height: 80,
    textAlignVertical: 'top',
  },
  saveBtn: {
    backgroundColor: t.primaryFill,
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
