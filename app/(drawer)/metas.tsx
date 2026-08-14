import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  Modal,
  TextInput,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Goal, GoalContribution } from '../../types';
import {
  getGoals,
  getContributions,
  addContribution,
  deleteContribution,
  deleteGoal,
  archiveGoal,
} from '../../database/database';
import { useTheme, useThemedStyles } from '../../hooks/useTheme';
import { ThemePalette, RADIUS, SPACING, alpha } from '../../constants/theme';
import {
  Card,
  EmptyState,
  Label,
  PrimaryButton,
  ProgressBar,
  GhostButton,
} from '../../components/ui';
import GoalFormModal from '../../components/GoalFormModal';
import {
  formatCurrency,
  formatDate,
  getTodayString,
  currentMonthIndex,
  formatMonthIndex,
  formatDuration,
} from '../../utils/formatting';

export default function MetasScreen() {
  const { theme } = useTheme();
  const styles = useThemedStyles(makeStyles);

  const [goals, setGoals] = useState<Goal[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingGoal, setEditingGoal] = useState<Goal | undefined>();
  const [detailGoal, setDetailGoal] = useState<Goal | null>(null);
  const [contributions, setContributions] = useState<GoalContribution[]>([]);
  const [contributionInput, setContributionInput] = useState('');
  const [showArchived, setShowArchived] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setGoals(await getGoals(showArchived));
    } finally {
      setLoading(false);
    }
  }, [showArchived]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const openDetail = async (goal: Goal) => {
    setDetailGoal(goal);
    setContributionInput('');
    setContributions(await getContributions(goal.id));
  };

  const refreshDetail = async (goalId: number) => {
    const [all, list] = await Promise.all([getGoals(showArchived), getContributions(goalId)]);
    setGoals(all);
    setContributions(list);
    setDetailGoal(all.find((g) => g.id === goalId) ?? null);
  };

  const handleContribute = async (sign: 1 | -1) => {
    if (!detailGoal) return;
    const value = parseFloat(contributionInput.replace(/\./g, '').replace(',', '.'));
    if (isNaN(value) || value <= 0) {
      Alert.alert('Valor inválido', 'Digite quanto você está guardando.');
      return;
    }
    await addContribution(detailGoal.id, sign * value, getTodayString());
    setContributionInput('');
    await refreshDetail(detailGoal.id);
  };

  const handleDeleteGoal = (goal: Goal) => {
    Alert.alert(
      'Excluir meta',
      `"${goal.name}" e todo o histórico de aportes serão apagados. Se você só quer tirar da lista, use "arquivar".`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Arquivar',
          onPress: async () => {
            await archiveGoal(goal.id, true);
            setDetailGoal(null);
            load();
          },
        },
        {
          text: 'Excluir',
          style: 'destructive',
          onPress: async () => {
            await deleteGoal(goal.id);
            setDetailGoal(null);
            load();
          },
        },
      ]
    );
  };

  const active = goals.filter((g) => !g.is_archived);
  const totalSaved = active.reduce((s, g) => s + g.saved, 0);
  const totalTarget = active.reduce((s, g) => s + g.target_amount, 0);
  const completed = active.filter((g) => g.saved >= g.target_amount).length;

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={loading} onRefresh={load} tintColor={theme.textSecondary} />
        }
      >
        {active.length > 0 && (
          <Card>
            <Label>Você já guardou</Label>
            <Text style={styles.heroValue}>{formatCurrency(totalSaved)}</Text>
            <Text style={styles.heroSub}>
              de {formatCurrency(totalTarget)} em {active.length}{' '}
              {active.length === 1 ? 'meta' : 'metas'}
              {completed > 0 && ` · ${completed} concluída${completed > 1 ? 's' : ''}`}
            </Text>
            <View style={{ marginTop: SPACING.lg }}>
              <ProgressBar
                progress={totalTarget > 0 ? totalSaved / totalTarget : 0}
                color={theme.success}
                height={8}
              />
            </View>
          </Card>
        )}

        {goals.length === 0 ? (
          <Card style={{ marginTop: SPACING.lg }}>
            <EmptyState
              icon="flag-checkered"
              title="Nenhuma meta ainda"
              subtitle="Defina um objetivo com valor e prazo. A cada valor guardado você vê o quanto falta."
              action={
                <PrimaryButton
                  label="Criar primeira meta"
                  icon="plus"
                  onPress={() => {
                    setEditingGoal(undefined);
                    setShowForm(true);
                  }}
                />
              }
            />
          </Card>
        ) : (
          <View style={{ marginTop: SPACING.lg, gap: SPACING.md }}>
            {goals.map((goal) => (
              <GoalCard key={goal.id} goal={goal} onPress={() => openDetail(goal)} />
            ))}
          </View>
        )}

        <TouchableOpacity
          style={styles.archivedToggle}
          onPress={() => setShowArchived((v) => !v)}
        >
          <MaterialCommunityIcons
            name={showArchived ? 'eye-off-outline' : 'archive-outline'}
            size={15}
            color={theme.textSecondary}
          />
          <Text style={styles.archivedToggleText}>
            {showArchived ? 'Ocultar arquivadas' : 'Mostrar metas arquivadas'}
          </Text>
        </TouchableOpacity>
      </ScrollView>

      <TouchableOpacity
        style={styles.fab}
        onPress={() => {
          setEditingGoal(undefined);
          setShowForm(true);
        }}
        activeOpacity={0.85}
      >
        <MaterialCommunityIcons name="plus" size={26} color={theme.onFill} />
      </TouchableOpacity>

      <GoalFormModal
        visible={showForm}
        onClose={() => {
          setShowForm(false);
          setEditingGoal(undefined);
        }}
        onSaved={load}
        editingGoal={editingGoal}
      />

      {/* Detalhe da meta */}
      <Modal
        visible={!!detailGoal}
        transparent
        animationType="slide"
        onRequestClose={() => setDetailGoal(null)}
      >
        <KeyboardAvoidingView
          style={styles.overlay}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <View style={styles.sheet}>
            <View style={styles.handle} />
            {detailGoal && (
              <>
                <View style={styles.detailHeader}>
                  <View
                    style={[
                      styles.detailIcon,
                      { backgroundColor: alpha(detailGoal.color, 0.14) },
                    ]}
                  >
                    <MaterialCommunityIcons
                      name={detailGoal.icon as never}
                      size={22}
                      color={detailGoal.color}
                    />
                  </View>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={styles.detailTitle} numberOfLines={1}>
                      {detailGoal.name}
                    </Text>
                    <Text style={styles.detailSub}>
                      {formatCurrency(detailGoal.saved)} de{' '}
                      {formatCurrency(detailGoal.target_amount)}
                    </Text>
                  </View>
                  <TouchableOpacity onPress={() => setDetailGoal(null)} hitSlop={8}>
                    <MaterialCommunityIcons name="close" size={22} color={theme.textSecondary} />
                  </TouchableOpacity>
                </View>

                <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
                  <ProgressBar
                    progress={detailGoal.saved / detailGoal.target_amount}
                    color={detailGoal.color}
                    height={10}
                  />
                  <Text style={styles.detailRemaining}>
                    {detailGoal.saved >= detailGoal.target_amount
                      ? 'Meta atingida. Parabéns.'
                      : `Faltam ${formatCurrency(detailGoal.target_amount - detailGoal.saved)}`}
                  </Text>

                  <Label style={{ marginTop: SPACING.xl }}>Guardar agora</Label>
                  <View style={styles.contributeRow}>
                    <View style={styles.amountWrapper}>
                      <Text style={styles.currencyPrefix}>R$</Text>
                      <TextInput
                        style={styles.amountInput}
                        placeholder="0,00"
                        placeholderTextColor={theme.textLight}
                        value={contributionInput}
                        onChangeText={setContributionInput}
                        keyboardType="decimal-pad"
                      />
                    </View>
                    <TouchableOpacity
                      style={[styles.contributeBtn, { backgroundColor: detailGoal.color }]}
                      onPress={() => handleContribute(1)}
                    >
                      <MaterialCommunityIcons name="plus" size={22} color={theme.onFill} />
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.withdrawBtn}
                      onPress={() => handleContribute(-1)}
                    >
                      <MaterialCommunityIcons name="minus" size={22} color={theme.textSecondary} />
                    </TouchableOpacity>
                  </View>
                  <Text style={styles.contributeHint}>
                    O botão − registra uma retirada, caso precise usar parte do que guardou.
                  </Text>

                  <Label style={{ marginTop: SPACING.xl }}>
                    Histórico ({contributions.length})
                  </Label>
                  {contributions.length === 0 ? (
                    <Text style={styles.emptyHistory}>Nenhum aporte registrado ainda.</Text>
                  ) : (
                    contributions.map((c) => (
                      <View key={c.id} style={styles.historyRow}>
                        <MaterialCommunityIcons
                          name={c.amount >= 0 ? 'arrow-down-left' : 'arrow-up-right'}
                          size={16}
                          color={c.amount >= 0 ? theme.success : theme.danger}
                        />
                        <Text style={styles.historyDate}>{formatDate(c.date)}</Text>
                        <Text
                          style={[
                            styles.historyAmount,
                            { color: c.amount >= 0 ? theme.success : theme.danger },
                          ]}
                        >
                          {c.amount >= 0 ? '+' : '−'}
                          {formatCurrency(Math.abs(c.amount))}
                        </Text>
                        <TouchableOpacity
                          hitSlop={8}
                          onPress={async () => {
                            await deleteContribution(c.id);
                            await refreshDetail(detailGoal.id);
                          }}
                        >
                          <MaterialCommunityIcons
                            name="close"
                            size={15}
                            color={theme.textLight}
                          />
                        </TouchableOpacity>
                      </View>
                    ))
                  )}

                  <View style={styles.detailActions}>
                    <GhostButton
                      label="Editar"
                      icon="pencil-outline"
                      style={{ flex: 1 }}
                      onPress={() => {
                        setEditingGoal(detailGoal);
                        setDetailGoal(null);
                        setShowForm(true);
                      }}
                    />
                    <GhostButton
                      label="Excluir"
                      icon="trash-can-outline"
                      color={theme.danger}
                      style={{ flex: 1 }}
                      onPress={() => handleDeleteGoal(detailGoal)}
                    />
                  </View>
                </ScrollView>
              </>
            )}
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
}

/**
 * Projeção: se a pessoa definiu um aporte mensal usamos ele; senão, o ritmo
 * observado (o que já guardou dividido pelos meses desde a criação da meta).
 */
function projectGoal(goal: Goal): { monthsLeft: number | null; pace: number } {
  const remaining = Math.max(0, goal.target_amount - goal.saved);
  if (remaining <= 0) return { monthsLeft: 0, pace: 0 };

  let pace = goal.monthly_target ?? 0;
  if (!pace && goal.created_at && goal.saved > 0) {
    // O SQLite grava "YYYY-MM-DD HH:MM:SS"; o Hermes só parseia com o T do ISO.
    const created = new Date(goal.created_at.replace(' ', 'T'));
    if (!isNaN(created.getTime())) {
      const elapsed = Math.max(
        1,
        (new Date().getFullYear() - created.getFullYear()) * 12 +
          (new Date().getMonth() - created.getMonth()) +
          1
      );
      pace = goal.saved / elapsed;
    }
  }
  if (pace <= 0) return { monthsLeft: null, pace: 0 };
  return { monthsLeft: Math.ceil(remaining / pace), pace };
}

function GoalCard({ goal, onPress }: { goal: Goal; onPress: () => void }) {
  const { theme } = useTheme();
  const styles = useThemedStyles(makeStyles);

  const progress = goal.target_amount > 0 ? goal.saved / goal.target_amount : 0;
  const done = goal.saved >= goal.target_amount;
  const { monthsLeft } = projectGoal(goal);

  const deadlineIndex = goal.deadline
    ? Number(goal.deadline.split('-')[0]) * 12 + Number(goal.deadline.split('-')[1]) - 1
    : null;
  const monthsToDeadline = deadlineIndex !== null ? deadlineIndex - currentMonthIndex() : null;
  // Vai atrasar se o ritmo atual levar mais tempo do que resta até o prazo.
  const behind =
    !done &&
    monthsLeft !== null &&
    monthsToDeadline !== null &&
    monthsLeft > Math.max(0, monthsToDeadline) + 1;

  return (
    <TouchableOpacity
      style={[styles.goalCard, goal.is_archived === 1 && { opacity: 0.55 }]}
      onPress={onPress}
      activeOpacity={0.75}
    >
      <View style={styles.goalHeader}>
        <View style={[styles.goalIcon, { backgroundColor: alpha(goal.color, 0.14) }]}>
          <MaterialCommunityIcons name={goal.icon as never} size={20} color={goal.color} />
        </View>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={styles.goalName} numberOfLines={1}>
            {goal.name}
          </Text>
          <Text style={styles.goalAmounts}>
            {formatCurrency(goal.saved)}{' '}
            <Text style={styles.goalTarget}>de {formatCurrency(goal.target_amount)}</Text>
          </Text>
        </View>
        <Text style={[styles.goalPercent, done && { color: theme.success }]}>
          {Math.min(999, Math.round(progress * 100))}%
        </Text>
      </View>

      <View style={{ marginTop: SPACING.md }}>
        <ProgressBar progress={progress} color={done ? theme.success : goal.color} height={7} />
      </View>

      <View style={styles.goalFooter}>
        {done ? (
          <Text style={[styles.goalFooterText, { color: theme.success }]}>
            <MaterialCommunityIcons name="check-circle" size={12} /> Meta atingida
          </Text>
        ) : (
          <Text style={styles.goalFooterText}>
            Faltam {formatCurrency(goal.target_amount - goal.saved)}
          </Text>
        )}

        {!done && monthsLeft !== null && monthsLeft > 0 && (
          <Text style={[styles.goalFooterText, behind && { color: theme.warning }]}>
            {behind ? 'Ritmo atual: ' : ''}
            {formatDuration(monthsLeft)}
          </Text>
        )}
        {!done && monthsLeft === null && goal.deadline && (
          <Text style={styles.goalFooterText}>
            Prazo {formatMonthIndex(deadlineIndex as number)}
          </Text>
        )}
      </View>
    </TouchableOpacity>
  );
}

const makeStyles = (t: ThemePalette) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: t.background },
    content: { padding: SPACING.lg, paddingBottom: 110 },
    heroValue: {
      fontSize: 32,
      fontWeight: '800',
      color: t.text,
      letterSpacing: -1,
      fontVariant: ['tabular-nums'],
    },
    heroSub: { fontSize: 13, color: t.textSecondary, marginTop: 4 },

    goalCard: {
      backgroundColor: t.surface,
      borderRadius: RADIUS.lg,
      borderWidth: 1,
      borderColor: t.border,
      padding: SPACING.lg,
    },
    goalHeader: { flexDirection: 'row', alignItems: 'center', gap: SPACING.md },
    goalIcon: {
      width: 40,
      height: 40,
      borderRadius: RADIUS.md,
      alignItems: 'center',
      justifyContent: 'center',
    },
    goalName: { fontSize: 15, fontWeight: '700', color: t.text },
    goalAmounts: {
      fontSize: 13,
      fontWeight: '700',
      color: t.text,
      marginTop: 2,
      fontVariant: ['tabular-nums'],
    },
    goalTarget: { fontWeight: '400', color: t.textSecondary },
    goalPercent: {
      fontSize: 15,
      fontWeight: '800',
      color: t.textSecondary,
      fontVariant: ['tabular-nums'],
    },
    goalFooter: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginTop: SPACING.md,
      gap: SPACING.sm,
    },
    goalFooterText: { fontSize: 11.5, color: t.textSecondary, fontWeight: '500' },

    archivedToggle: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
      marginTop: SPACING.xl,
      paddingVertical: SPACING.md,
    },
    archivedToggleText: { fontSize: 12.5, color: t.textSecondary, fontWeight: '600' },

    fab: {
      position: 'absolute',
      bottom: 24,
      right: 20,
      width: 56,
      height: 56,
      borderRadius: 28,
      backgroundColor: t.primaryFill,
      alignItems: 'center',
      justifyContent: 'center',
      shadowColor: t.shadow,
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.22,
      shadowRadius: 10,
      elevation: 6,
    },

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
    detailHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: SPACING.md,
      marginBottom: SPACING.lg,
    },
    detailIcon: {
      width: 42,
      height: 42,
      borderRadius: RADIUS.md,
      alignItems: 'center',
      justifyContent: 'center',
    },
    detailTitle: { fontSize: 18, fontWeight: '700', color: t.text },
    detailSub: {
      fontSize: 13,
      color: t.textSecondary,
      marginTop: 2,
      fontVariant: ['tabular-nums'],
    },
    detailRemaining: {
      fontSize: 13,
      color: t.textSecondary,
      marginTop: SPACING.sm,
      fontWeight: '600',
    },
    contributeRow: { flexDirection: 'row', gap: SPACING.sm, alignItems: 'center' },
    amountWrapper: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      gap: SPACING.sm,
      backgroundColor: t.surfaceAlt,
      borderRadius: RADIUS.md,
      paddingHorizontal: SPACING.lg,
      borderWidth: 1,
      borderColor: t.border,
    },
    currencyPrefix: { fontSize: 15, fontWeight: '600', color: t.textSecondary },
    amountInput: { flex: 1, paddingVertical: 13, fontSize: 20, fontWeight: '700', color: t.text },
    contributeBtn: {
      width: 50,
      height: 50,
      borderRadius: RADIUS.md,
      alignItems: 'center',
      justifyContent: 'center',
    },
    withdrawBtn: {
      width: 50,
      height: 50,
      borderRadius: RADIUS.md,
      borderWidth: 1,
      borderColor: t.border,
      alignItems: 'center',
      justifyContent: 'center',
    },
    contributeHint: { fontSize: 11.5, color: t.textLight, marginTop: SPACING.sm, lineHeight: 16 },
    emptyHistory: { fontSize: 13, color: t.textLight, paddingVertical: SPACING.md },
    historyRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: SPACING.md,
      paddingVertical: 11,
      borderBottomWidth: 1,
      borderBottomColor: t.divider,
    },
    historyDate: { flex: 1, fontSize: 13, color: t.textSecondary },
    historyAmount: { fontSize: 14, fontWeight: '700', fontVariant: ['tabular-nums'] },
    detailActions: {
      flexDirection: 'row',
      gap: SPACING.md,
      marginTop: SPACING.xl,
      marginBottom: SPACING.xl,
    },
  });
