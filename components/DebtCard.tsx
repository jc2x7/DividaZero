import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert, Modal } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Expense, DeleteScope } from '../types';
import { useCategories } from '../hooks/useCategories';
import { formatCurrency } from '../utils/formatting';
import { useTheme, useThemedStyles } from '../hooks/useTheme';
import { ThemePalette, RADIUS, SPACING, alpha, categoryColor } from '../constants/theme';
import { deleteExpenseScoped, countDeleteScope, toggleExpensePaid } from '../database/database';
import { cancelExpenseNotifications } from '../hooks/useNotifications';
import { Tag } from './ui';

interface DebtCardProps {
  expense: Expense;
  onDeleted: () => void;
  onTogglePaid?: () => void;
  onEdit?: (expense: Expense) => void;
  /** Abre o detalhe da dívida (vencimento, saldo, quitar antes). */
  onOpenDetail?: (expense: Expense) => void;
  /** Marca a despesa como vencida (destaque de atenção). */
  overdue?: boolean;
}

export default function DebtCard({
  expense,
  onDeleted,
  onTogglePaid,
  onEdit,
  onOpenDetail,
  overdue,
}: DebtCardProps) {
  const { theme } = useTheme();
  const styles = useThemedStyles(makeStyles);
  const { get } = useCategories();
  const [scopeSheet, setScopeSheet] = useState<{ one: number; future: number; all: number } | null>(
    null
  );

  const cat = get(expense.category);
  const catTint = categoryColor(cat.color, theme);
  const isPaid = !!expense.is_paid;
  /** Parcela que a pessoa planejou quitar com o dinheiro extra do plano. */
  const planejada = !!expense.planned_payoff && !isPaid;
  const isInstallment = expense.type === 'INSTALLMENT';
  const isFixed = expense.type === 'FIXED';

  const handleTogglePaid = async () => {
    await toggleExpensePaid(expense.id, !isPaid);
    onTogglePaid?.();
  };

  const handleDelete = async () => {
    // Lançamento avulso: nada a perguntar, existe só neste mês.
    if (!isInstallment && !isFixed) {
      Alert.alert('Excluir gasto', `Remover "${expense.name}"?`, [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Excluir',
          style: 'destructive',
          onPress: () => runDelete('one'),
        },
      ]);
      return;
    }
    // Recorrente ou parcelado: mostra quantas ocorrências cada opção atinge.
    const counts = await countDeleteScope(expense.id);
    setScopeSheet(counts);
  };

  const runDelete = async (scope: DeleteScope) => {
    setScopeSheet(null);
    const { notificationIds } = await deleteExpenseScoped(expense.id, scope);
    await cancelExpenseNotifications(notificationIds);
    onDeleted();
  };

  return (
    <>
      <View
        style={[
          styles.card,
          isPaid && styles.cardPaid,
          planejada && styles.cardPlanejada,
          overdue && !isPaid && !planejada && styles.cardOverdue,
        ]}
      >
        <TouchableOpacity onPress={handleTogglePaid} style={styles.checkBtn} hitSlop={10}>
          <View style={[styles.checkCircle, isPaid && styles.checkCirclePaid]}>
            {isPaid && <MaterialCommunityIcons name="check" size={13} color={theme.onFill} />}
          </View>
        </TouchableOpacity>

        <View
          style={[
            styles.iconBox,
            { backgroundColor: alpha(isPaid ? theme.textLight : catTint, 0.12) },
          ]}
        >
          <MaterialCommunityIcons
            name={cat.icon as never}
            size={19}
            color={isPaid ? theme.textLight : catTint}
          />
        </View>

        <TouchableOpacity
          style={styles.info}
          activeOpacity={onOpenDetail ? 0.6 : 1}
          disabled={!onOpenDetail}
          onPress={() => onOpenDetail?.(expense)}
        >
          <Text style={[styles.name, isPaid && styles.namePaid]} numberOfLines={1}>
            {expense.name}
          </Text>
          <View style={styles.tags}>
            <Tag label={cat.label} color={isPaid ? theme.textLight : catTint} />
            {isInstallment && (
              <Tag
                label={`${expense.installments_current}/${expense.installments_total}`}
                color={isPaid ? theme.textLight : theme.info}
                icon="credit-card-outline"
              />
            )}
            {isFixed && (
              <Tag label="Fixo" color={isPaid ? theme.textLight : theme.textSecondary} icon="repeat" />
            )}
            {planejada && (
              <Tag label="No plano" color={theme.primary} icon="rocket-launch-outline" />
            )}
            {!!expense.due_day && (
              <Tag
                label={`dia ${expense.due_day}`}
                color={
                  isPaid ? theme.textLight : overdue ? theme.danger : theme.textSecondary
                }
                icon={expense.alert_enabled ? 'bell-ring-outline' : 'calendar-blank-outline'}
              />
            )}
          </View>
        </TouchableOpacity>

        <View style={styles.actions}>
          <Text
            style={[
              styles.amount,
              isPaid && styles.amountPaid,
              planejada && styles.amountPlanejada,
            ]}
          >
            {formatCurrency(expense.amount)}
          </Text>
          <View style={styles.buttons}>
            {!!onEdit && (
              <TouchableOpacity style={styles.iconBtn} onPress={() => onEdit(expense)} hitSlop={6}>
                <MaterialCommunityIcons
                  name="pencil-outline"
                  size={16}
                  color={theme.textLight}
                />
              </TouchableOpacity>
            )}
            <TouchableOpacity style={styles.iconBtn} onPress={handleDelete} hitSlop={6}>
              <MaterialCommunityIcons
                name="trash-can-outline"
                size={16}
                color={theme.textLight}
              />
            </TouchableOpacity>
          </View>
        </View>
      </View>

      {/* Escolha do alcance da exclusão */}
      <Modal
        visible={!!scopeSheet}
        transparent
        animationType="slide"
        onRequestClose={() => setScopeSheet(null)}
      >
        <TouchableOpacity
          style={styles.overlay}
          activeOpacity={1}
          onPress={() => setScopeSheet(null)}
        >
          <TouchableOpacity activeOpacity={1} style={styles.sheet}>
            <View style={styles.handle} />
            <Text style={styles.sheetTitle}>Excluir "{expense.name}"</Text>
            <Text style={styles.sheetSubtitle}>
              {isInstallment
                ? `Compra parcelada em ${expense.installments_total}x. O que você quer remover?`
                : 'Despesa fixa, lançada em vários meses. O que você quer remover?'}
            </Text>

            <ScopeOption
              icon="calendar-today"
              title={isInstallment ? 'Só esta parcela' : 'Só este mês'}
              detail="Os outros meses continuam do jeito que estão."
              count={scopeSheet?.one ?? 0}
              onPress={() => runDelete('one')}
            />
            <ScopeOption
              icon="calendar-arrow-right"
              title={isInstallment ? 'Esta e as próximas' : 'Este mês e os futuros'}
              detail="O histórico dos meses anteriores é preservado."
              count={scopeSheet?.future ?? 0}
              onPress={() => runDelete('future')}
            />
            <ScopeOption
              icon="delete-sweep-outline"
              title={isInstallment ? 'A compra inteira' : 'Todos os meses'}
              detail="Remove também os meses já passados."
              count={scopeSheet?.all ?? 0}
              destructive
              onPress={() => runDelete('all')}
            />

            <TouchableOpacity style={styles.cancelBtn} onPress={() => setScopeSheet(null)}>
              <Text style={styles.cancelBtnText}>Cancelar</Text>
            </TouchableOpacity>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>
    </>
  );
}

function ScopeOption({
  icon,
  title,
  detail,
  count,
  onPress,
  destructive,
}: {
  icon: string;
  title: string;
  detail: string;
  count: number;
  onPress: () => void;
  destructive?: boolean;
}) {
  const { theme } = useTheme();
  const styles = useThemedStyles(makeStyles);
  const tint = destructive ? theme.danger : theme.primary;
  return (
    <TouchableOpacity style={styles.scopeOption} onPress={onPress} activeOpacity={0.7}>
      <View style={[styles.scopeIcon, { backgroundColor: alpha(tint, 0.12) }]}>
        <MaterialCommunityIcons name={icon as never} size={19} color={tint} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.scopeTitle}>{title}</Text>
        <Text style={styles.scopeDetail}>{detail}</Text>
      </View>
      <View style={styles.scopeCount}>
        <Text style={[styles.scopeCountText, { color: tint }]}>
          {count} {count === 1 ? 'lançamento' : 'lançamentos'}
        </Text>
      </View>
    </TouchableOpacity>
  );
}

const makeStyles = (t: ThemePalette) =>
  StyleSheet.create({
    card: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: t.surface,
      borderRadius: RADIUS.md,
      borderWidth: 1,
      borderColor: t.border,
      paddingVertical: 11,
      paddingHorizontal: 12,
      marginBottom: 8,
      gap: 10,
    },
    cardPaid: {
      backgroundColor: t.surfaceAlt,
      borderColor: 'transparent',
    },
    cardOverdue: {
      borderColor: alpha(t.danger, 0.45),
    },
    cardPlanejada: {
      borderColor: alpha(t.primary, 0.4),
      backgroundColor: alpha(t.primary, 0.04),
    },
    amountPlanejada: {
      textDecorationLine: 'line-through',
      color: t.primary,
    },
    checkBtn: { padding: 1 },
    checkCircle: {
      width: 21,
      height: 21,
      borderRadius: 11,
      borderWidth: 1.5,
      borderColor: t.borderStrong,
      alignItems: 'center',
      justifyContent: 'center',
    },
    checkCirclePaid: {
      backgroundColor: t.successFill,
      borderColor: t.successFill,
    },
    iconBox: {
      width: 36,
      height: 36,
      borderRadius: RADIUS.sm + 2,
      alignItems: 'center',
      justifyContent: 'center',
      flexShrink: 0,
    },
    info: { flex: 1, minWidth: 0 },
    name: {
      fontSize: 14.5,
      fontWeight: '600',
      color: t.text,
      marginBottom: 5,
    },
    namePaid: {
      textDecorationLine: 'line-through',
      color: t.textLight,
      fontWeight: '500',
    },
    tags: { flexDirection: 'row', flexWrap: 'wrap', gap: 4 },
    actions: { alignItems: 'flex-end', gap: 3 },
    amount: {
      fontSize: 14.5,
      fontWeight: '700',
      color: t.text,
      fontVariant: ['tabular-nums'],
    },
    amountPaid: {
      textDecorationLine: 'line-through',
      color: t.textLight,
      fontWeight: '500',
    },
    buttons: { flexDirection: 'row', gap: 2 },
    iconBtn: { padding: 3 },

    overlay: {
      flex: 1,
      backgroundColor: t.overlay,
      justifyContent: 'flex-end',
    },
    sheet: {
      backgroundColor: t.surface,
      borderTopLeftRadius: RADIUS.xl + 4,
      borderTopRightRadius: RADIUS.xl + 4,
      padding: SPACING.xl,
      paddingTop: SPACING.md,
      gap: 2,
    },
    handle: {
      width: 36,
      height: 4,
      backgroundColor: t.borderStrong,
      borderRadius: 2,
      alignSelf: 'center',
      marginBottom: SPACING.lg,
    },
    sheetTitle: { fontSize: 18, fontWeight: '700', color: t.text },
    sheetSubtitle: {
      fontSize: 13.5,
      color: t.textSecondary,
      marginTop: 4,
      marginBottom: SPACING.lg,
      lineHeight: 19,
    },
    scopeOption: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: SPACING.md,
      paddingVertical: 12,
      paddingHorizontal: 12,
      borderRadius: RADIUS.md,
      borderWidth: 1,
      borderColor: t.border,
      marginBottom: 8,
    },
    scopeIcon: {
      width: 38,
      height: 38,
      borderRadius: RADIUS.sm + 2,
      alignItems: 'center',
      justifyContent: 'center',
    },
    scopeTitle: { fontSize: 14.5, fontWeight: '700', color: t.text },
    scopeDetail: { fontSize: 12, color: t.textSecondary, marginTop: 2, lineHeight: 16 },
    scopeCount: { alignItems: 'flex-end' },
    scopeCountText: { fontSize: 11, fontWeight: '700' },

    cancelBtn: {
      paddingVertical: 14,
      alignItems: 'center',
      marginTop: 4,
      marginBottom: SPACING.sm,
    },
    cancelBtnText: { color: t.textSecondary, fontWeight: '600', fontSize: 15 },
  });
