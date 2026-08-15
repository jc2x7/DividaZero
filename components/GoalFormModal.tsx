import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  TextInput,
  Alert,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Goal } from '../types';
import { addGoal, updateGoal } from '../database/database';
import { useTheme, useThemedStyles } from '../hooks/useTheme';
import { ThemePalette, RADIUS, SPACING, alpha } from '../constants/theme';
import { Label, PrimaryButton, MoneyInput } from './ui';
import { formatCurrency, fromMonthIndex, currentMonthIndex, getMonthShortName } from '../utils/formatting';

const GOAL_ICONS = [
  'flag-checkered',
  'airplane',
  'home-city-outline',
  'car-outline',
  'laptop',
  'school-outline',
  'heart-pulse',
  'party-popper',
  'shield-check-outline',
  'piggy-bank-outline',
  'ring',
  'beach',
];

const GOAL_COLORS = [
  '#4F46E5',
  '#0EA5E9',
  '#10B981',
  '#F59E0B',
  '#EF4444',
  '#8B5CF6',
  '#EC4899',
  '#14B8A6',
];

interface Props {
  visible: boolean;
  onClose: () => void;
  onSaved: () => void;
  editingGoal?: Goal;
}

export default function GoalFormModal({ visible, onClose, onSaved, editingGoal }: Props) {
  const { theme } = useTheme();
  const styles = useThemedStyles(makeStyles);

  const [name, setName] = useState('');
  const [alvo, setAlvo] = useState(0);
  const [mensal, setMensal] = useState(0);
  const [icon, setIcon] = useState(GOAL_ICONS[0]);
  const [color, setColor] = useState(GOAL_COLORS[0]);
  const [deadlineIndex, setDeadlineIndex] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!visible) return;
    if (editingGoal) {
      setName(editingGoal.name);
      setAlvo(editingGoal.target_amount);
      setMensal(editingGoal.monthly_target ?? 0);
      setIcon(editingGoal.icon);
      setColor(editingGoal.color);
      setDeadlineIndex(parseDeadline(editingGoal.deadline));
    } else {
      setName('');
      setAlvo(0);
      setMensal(0);
      setIcon(GOAL_ICONS[0]);
      setColor(GOAL_COLORS[0]);
      setDeadlineIndex(null);
    }
  }, [editingGoal, visible]);

  const targetNum = alvo;
  const monthlyNum = mensal;

  const handleSave = async () => {
    if (!name.trim()) {
      Alert.alert('Falta o nome', 'Dê um nome para a meta.');
      return;
    }
    if (isNaN(targetNum) || targetNum <= 0) {
      Alert.alert('Valor inválido', 'Informe quanto você quer juntar.');
      return;
    }

    setSaving(true);
    try {
      const payload = {
        name: name.trim(),
        target_amount: targetNum,
        icon,
        color,
        deadline: deadlineIndex !== null ? formatDeadline(deadlineIndex) : undefined,
        monthly_target: !isNaN(monthlyNum) && monthlyNum > 0 ? monthlyNum : undefined,
        notes: undefined,
        is_archived: 0,
      };
      if (editingGoal) {
        await updateGoal(editingGoal.id, payload);
      } else {
        await addGoal(payload);
      }
      onSaved();
      onClose();
    } catch {
      Alert.alert('Erro', 'Não foi possível salvar a meta.');
    } finally {
      setSaving(false);
    }
  };

  // Sugestão de prazo em meses cheios a partir do mês atual.
  const base = currentMonthIndex();
  const deadlineOptions = [6, 12, 24, 36].map((m) => base + m);

  const monthsToDeadline = deadlineIndex !== null ? deadlineIndex - base + 1 : null;
  const suggestedMonthly =
    monthsToDeadline && monthsToDeadline > 0 && !isNaN(targetNum) && targetNum > 0
      ? targetNum / monthsToDeadline
      : null;

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <KeyboardAvoidingView
        style={styles.overlay}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.sheet}>
          <View style={styles.handle} />
          <View style={styles.header}>
            <Text style={styles.title}>{editingGoal ? 'Editar meta' : 'Nova meta'}</Text>
            <TouchableOpacity onPress={onClose} style={{ padding: 4 }} hitSlop={8}>
              <MaterialCommunityIcons name="close" size={22} color={theme.textSecondary} />
            </TouchableOpacity>
          </View>

          <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
            <Label>O que você quer conquistar</Label>
            <TextInput
              style={styles.input}
              placeholder="Reserva de emergência, viagem, notebook..."
              placeholderTextColor={theme.textLight}
              value={name}
              onChangeText={setName}
            />

            <Label style={styles.spaced}>Quanto precisa juntar</Label>
            <MoneyInput value={alvo} onChangeValue={setAlvo} />

            <Label style={styles.spaced}>Prazo</Label>
            <View style={styles.deadlineRow}>
              <TouchableOpacity
                style={[styles.deadlineChip, deadlineIndex === null && styles.deadlineChipActive]}
                onPress={() => setDeadlineIndex(null)}
              >
                <Text
                  style={[
                    styles.deadlineText,
                    deadlineIndex === null && styles.deadlineTextActive,
                  ]}
                >
                  Sem prazo
                </Text>
              </TouchableOpacity>
              {deadlineOptions.map((idx, i) => {
                const { year, month } = fromMonthIndex(idx);
                const active = deadlineIndex === idx;
                return (
                  <TouchableOpacity
                    key={idx}
                    style={[styles.deadlineChip, active && styles.deadlineChipActive]}
                    onPress={() => setDeadlineIndex(idx)}
                  >
                    <Text style={[styles.deadlineText, active && styles.deadlineTextActive]}>
                      {[6, 12, 24, 36][i]} meses
                    </Text>
                    <Text style={[styles.deadlineSub, active && styles.deadlineTextActive]}>
                      {getMonthShortName(month)}/{String(year).slice(2)}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <Label style={styles.spaced}>Quanto pretende guardar por mês</Label>
            <MoneyInput
              value={mensal}
              onChangeValue={setMensal}
              size="medio"
              placeholder="opcional"
            />
            {suggestedMonthly !== null && (
              <TouchableOpacity
                style={styles.suggestion}
                onPress={() => setMensal(Math.round(suggestedMonthly * 100) / 100)}
              >
                <MaterialCommunityIcons name="lightbulb-outline" size={14} color={theme.info} />
                <Text style={styles.suggestionText}>
                  Para bater no prazo:{' '}
                  <Text style={{ fontWeight: '700' }}>{formatCurrency(suggestedMonthly)}</Text> por
                  mês. Tocar para usar.
                </Text>
              </TouchableOpacity>
            )}

            <Label style={styles.spaced}>Ícone</Label>
            <View style={styles.iconGrid}>
              {GOAL_ICONS.map((ic) => {
                const active = ic === icon;
                return (
                  <TouchableOpacity
                    key={ic}
                    style={[
                      styles.iconItem,
                      active && { borderColor: color, backgroundColor: alpha(color, 0.12) },
                    ]}
                    onPress={() => setIcon(ic)}
                  >
                    <MaterialCommunityIcons
                      name={ic as never}
                      size={21}
                      color={active ? color : theme.textLight}
                    />
                  </TouchableOpacity>
                );
              })}
            </View>

            <Label style={styles.spaced}>Cor</Label>
            <View style={styles.colorRow}>
              {GOAL_COLORS.map((c) => (
                <TouchableOpacity
                  key={c}
                  style={[
                    styles.colorItem,
                    { backgroundColor: c },
                    c === color && styles.colorItemActive,
                  ]}
                  onPress={() => setColor(c)}
                >
                  {c === color && (
                    <MaterialCommunityIcons name="check" size={16} color="#FFFFFF" />
                  )}
                </TouchableOpacity>
              ))}
            </View>

            <PrimaryButton
              label={editingGoal ? 'Salvar meta' : 'Criar meta'}
              icon="check"
              onPress={handleSave}
              loading={saving}
              color={color}
              style={{ marginTop: SPACING.xl, marginBottom: SPACING.md }}
            />
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

function parseDeadline(deadline?: string): number | null {
  if (!deadline) return null;
  const [y, m] = deadline.split('-').map(Number);
  if (!y || !m) return null;
  return y * 12 + m - 1;
}

function formatDeadline(index: number): string {
  const { year, month } = fromMonthIndex(index);
  return `${year}-${String(month).padStart(2, '0')}`;
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
      justifyContent: 'space-between',
      marginBottom: SPACING.lg,
    },
    title: { fontSize: 20, fontWeight: '700', color: t.text, letterSpacing: -0.3 },
    spaced: { marginTop: SPACING.lg },
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
    deadlineRow: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.sm },
    deadlineChip: {
      paddingHorizontal: 14,
      paddingVertical: 9,
      borderRadius: RADIUS.md,
      borderWidth: 1,
      borderColor: t.border,
      backgroundColor: t.surfaceAlt,
      alignItems: 'center',
    },
    deadlineChipActive: { borderColor: t.primary, backgroundColor: alpha(t.primary, 0.1) },
    deadlineText: { fontSize: 13, fontWeight: '600', color: t.textSecondary },
    deadlineSub: { fontSize: 10.5, color: t.textLight, marginTop: 1 },
    deadlineTextActive: { color: t.primary },
    suggestion: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      marginTop: SPACING.sm,
      padding: SPACING.md,
      borderRadius: RADIUS.md,
      backgroundColor: alpha(t.info, 0.1),
    },
    suggestionText: { flex: 1, fontSize: 12, color: t.info, lineHeight: 17 },
    iconGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.sm },
    iconItem: {
      width: 48,
      height: 44,
      borderRadius: RADIUS.md,
      borderWidth: 1,
      borderColor: t.border,
      alignItems: 'center',
      justifyContent: 'center',
    },
    colorRow: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.md },
    colorItem: {
      width: 36,
      height: 36,
      borderRadius: 18,
      alignItems: 'center',
      justifyContent: 'center',
    },
    colorItemActive: { borderWidth: 2, borderColor: t.text },
  });
