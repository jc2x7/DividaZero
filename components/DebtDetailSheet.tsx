import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  ScrollView,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  Alert,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Expense } from '../types';
import { getExpenseGroup, updateDueDayForGroup } from '../database/database';
import { useCategories } from '../hooks/useCategories';
import { useTheme, useThemedStyles } from '../hooks/useTheme';
import { ThemePalette, RADIUS, SPACING, alpha, categoryColor } from '../constants/theme';
import { Label, ProgressBar, StatRow, GhostButton } from './ui';
import {
  calcularAntecipacao,
  valorQuitacaoEstimado,
  formatarTaxa,
} from '../utils/antecipacao';
import {
  formatCurrency,
  monthIndex,
  currentMonthIndex,
  formatMonthIndex,
} from '../utils/formatting';

interface Props {
  expense: Expense | null;
  onClose: () => void;
  onChanged: () => void;
}

/** Taxas de referência do mercado brasileiro, para o usuário ter um chute inicial. */
const TAXAS_SUGERIDAS = [
  { label: 'Loja / carnê', taxa: 0.035 },
  { label: 'Cartão parcelado', taxa: 0.025 },
  { label: 'Consignado', taxa: 0.018 },
];

export default function DebtDetailSheet({ expense, onClose, onChanged }: Props) {
  const { theme } = useTheme();
  const styles = useThemedStyles(makeStyles);
  const { get } = useCategories();

  const [ocorrencias, setOcorrencias] = useState<Expense[]>([]);
  const [quitacaoInput, setQuitacaoInput] = useState('');
  const [dueDayInput, setDueDayInput] = useState('');
  const [salvandoDia, setSalvandoDia] = useState(false);

  const carregar = useCallback(async () => {
    if (!expense?.group_id) {
      setOcorrencias(expense ? [expense] : []);
      return;
    }
    setOcorrencias(await getExpenseGroup(expense.group_id));
  }, [expense]);

  useEffect(() => {
    if (!expense) return;
    setQuitacaoInput('');
    setDueDayInput(expense.due_day ? String(expense.due_day) : '');
    carregar();
  }, [expense, carregar]);

  const agora = currentMonthIndex();

  const resumo = useMemo(() => {
    // "Restante" = parcelas ainda não pagas, deste mês em diante. Parcela
    // vencida e não paga continua contando: ela ainda vai ser cobrada.
    const abertas = ocorrencias.filter(
      (o) => !o.is_paid && monthIndex(o.year, o.month) >= agora
    );
    const pagas = ocorrencias.filter((o) => o.is_paid).length;
    const parcela = expense?.amount ?? 0;
    return {
      abertas: abertas.length,
      pagas,
      totalOcorrencias: ocorrencias.length,
      restante: abertas.reduce((s, o) => s + o.amount, 0),
      parcela,
      ultimoIndice: abertas.length
        ? Math.max(...abertas.map((o) => monthIndex(o.year, o.month)))
        : null,
    };
  }, [ocorrencias, expense, agora]);

  const quitacao = parseFloat(quitacaoInput.replace(/\./g, '').replace(',', '.'));
  const calc =
    !isNaN(quitacao) && quitacao > 0 && resumo.abertas > 0
      ? calcularAntecipacao(resumo.parcela, resumo.abertas, quitacao)
      : null;

  const salvarDia = async () => {
    if (!expense) return;
    const dia = parseInt(dueDayInput, 10);
    if (dueDayInput && (isNaN(dia) || dia < 1 || dia > 31)) {
      Alert.alert('Dia inválido', 'Informe um dia entre 1 e 31.');
      return;
    }
    setSalvandoDia(true);
    try {
      await updateDueDayForGroup(expense.id, dueDayInput ? dia : null);
      onChanged();
      await carregar();
    } finally {
      setSalvandoDia(false);
    }
  };

  if (!expense) return null;

  const cat = get(expense.category);
  const tint = categoryColor(cat.color, theme);
  const progresso =
    resumo.totalOcorrencias > 0 ? resumo.pagas / resumo.totalOcorrencias : 0;
  const parcelado = expense.type === 'INSTALLMENT';

  return (
    <Modal visible animationType="slide" transparent onRequestClose={onClose}>
      <KeyboardAvoidingView
        style={styles.overlay}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.sheet}>
          <View style={styles.handle} />

          <View style={styles.header}>
            <View style={[styles.icon, { backgroundColor: alpha(tint, 0.14) }]}>
              <MaterialCommunityIcons name={cat.icon as never} size={22} color={tint} />
            </View>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={styles.title} numberOfLines={1}>
                {expense.name}
              </Text>
              <Text style={styles.subtitle}>
                {parcelado
                  ? `${formatCurrency(resumo.parcela)} × ${expense.installments_total} parcelas`
                  : `${formatCurrency(resumo.parcela)} por mês`}
              </Text>
            </View>
            <TouchableOpacity onPress={onClose} hitSlop={8} style={{ padding: 4 }}>
              <MaterialCommunityIcons name="close" size={22} color={theme.textSecondary} />
            </TouchableOpacity>
          </View>

          <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
            {parcelado && (
              <>
                <View style={{ marginBottom: SPACING.md }}>
                  <ProgressBar progress={progresso} color={tint} height={7} />
                </View>
                <StatRow
                  label="Parcelas pagas"
                  value={`${resumo.pagas} de ${resumo.totalOcorrencias}`}
                />
              </>
            )}
            <StatRow
              label={parcelado ? 'Parcelas em aberto' : 'Meses em aberto'}
              value={String(resumo.abertas)}
            />
            <StatRow
              label="Ainda falta pagar"
              value={formatCurrency(resumo.restante)}
              bold
              color={theme.text}
            />
            {resumo.ultimoIndice !== null && (
              <StatRow
                label="Última parcela prevista"
                value={formatMonthIndex(resumo.ultimoIndice)}
              />
            )}

            {/* Dia de vencimento */}
            <Label style={styles.spaced}>Dia de vencimento</Label>
            <View style={styles.dueRow}>
              <View style={styles.dueInput}>
                <MaterialCommunityIcons
                  name="calendar-blank-outline"
                  size={17}
                  color={dueDayInput ? theme.primary : theme.textLight}
                />
                <TextInput
                  style={styles.dueText}
                  value={dueDayInput}
                  onChangeText={(v) => setDueDayInput(v.replace(/[^0-9]/g, '').slice(0, 2))}
                  keyboardType="number-pad"
                  placeholder="1 a 31"
                  placeholderTextColor={theme.textLight}
                  maxLength={2}
                />
              </View>
              <TouchableOpacity
                style={[styles.dueSave, salvandoDia && { opacity: 0.5 }]}
                onPress={salvarDia}
                disabled={salvandoDia}
              >
                <Text style={styles.dueSaveText}>Salvar</Text>
              </TouchableOpacity>
            </View>
            <Text style={styles.hint}>
              Vale para este mês e os seguintes. Os meses já passados não mudam.
            </Text>

            {/* Antecipação */}
            {parcelado && resumo.abertas > 0 && (
              <>
                <Label style={styles.spaced}>Quitar antes</Label>
                <Text style={styles.hint}>
                  Peça à loja ou ao banco o valor para quitar hoje e digite abaixo. O app mostra
                  quanto você economiza e qual juro estava embutido nas parcelas.
                </Text>

                <View style={styles.amountWrapper}>
                  <Text style={styles.currencyPrefix}>R$</Text>
                  <TextInput
                    style={styles.amountInput}
                    value={quitacaoInput}
                    onChangeText={setQuitacaoInput}
                    keyboardType="decimal-pad"
                    placeholder="0,00"
                    placeholderTextColor={theme.textLight}
                  />
                </View>

                <View style={styles.sugestoes}>
                  <Text style={styles.sugestaoLabel}>Não tem a proposta? Estime pela taxa:</Text>
                  <View style={styles.sugestaoRow}>
                    {TAXAS_SUGERIDAS.map((s) => (
                      <TouchableOpacity
                        key={s.label}
                        style={styles.sugestaoChip}
                        onPress={() =>
                          setQuitacaoInput(
                            valorQuitacaoEstimado(resumo.parcela, resumo.abertas, s.taxa)
                              .toFixed(2)
                              .replace('.', ',')
                          )
                        }
                      >
                        <Text style={styles.sugestaoChipText}>{s.label}</Text>
                        <Text style={styles.sugestaoChipTaxa}>
                          {(s.taxa * 100).toFixed(1).replace('.', ',')}% a.m.
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>

                {calc && (
                  <View
                    style={[
                      styles.resultado,
                      calc.semVantagem && { backgroundColor: alpha(theme.danger, 0.08) },
                    ]}
                  >
                    {calc.semVantagem ? (
                      <View style={styles.avisoRow}>
                        <MaterialCommunityIcons
                          name="alert-circle-outline"
                          size={18}
                          color={theme.danger}
                        />
                        <Text style={styles.aviso}>
                          Esse valor é igual ou maior que a soma das parcelas que faltam
                          ({formatCurrency(calc.totalSemAntecipar)}). Antecipar assim não
                          compensa — vale pedir outra proposta.
                        </Text>
                      </View>
                    ) : (
                      <>
                        <Text style={styles.economiaLabel}>Você economiza</Text>
                        <Text style={styles.economiaValor}>{formatCurrency(calc.economia)}</Text>
                        <Text style={styles.economiaSub}>
                          {calc.descontoPercentual.toFixed(1).replace('.', ',')}% de desconto sobre
                          os {formatCurrency(calc.totalSemAntecipar)} que faltam
                        </Text>

                        <View style={styles.divisor} />

                        <StatRow
                          label="Pagando as parcelas"
                          value={formatCurrency(calc.totalSemAntecipar)}
                        />
                        <StatRow
                          label="Quitando hoje"
                          value={formatCurrency(calc.valorQuitacao)}
                          color={theme.success}
                          bold
                        />
                        <StatRow
                          label="Juro embutido nas parcelas"
                          value={formatarTaxa(calc.taxaMensal, calc.taxaAnual)}
                          icon="percent-outline"
                        />
                        {calc.taxaMensal !== null && (
                          <Text style={styles.interpretacao}>
                            {calc.taxaMensal > 0.03
                              ? 'Taxa alta. Quitar costuma render mais do que a maioria dos investimentos.'
                              : calc.taxaMensal > 0.015
                                ? 'Taxa na média do mercado. Vale comparar com o que seu dinheiro rende parado.'
                                : 'Taxa baixa. Talvez seja melhor manter as parcelas e investir a diferença.'}
                          </Text>
                        )}
                      </>
                    )}
                  </View>
                )}
              </>
            )}

            {/* GhostButton, não PrimaryButton: o texto do primário é sempre
                branco (onFill), que sumiria sobre um fundo claro. */}
            <GhostButton
              label="Fechar"
              onPress={onClose}
              style={{ marginTop: SPACING.xl, marginBottom: SPACING.xl }}
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
    icon: {
      width: 42,
      height: 42,
      borderRadius: RADIUS.md,
      alignItems: 'center',
      justifyContent: 'center',
    },
    title: { fontSize: 18, fontWeight: '700', color: t.text, letterSpacing: -0.3 },
    subtitle: { fontSize: 13, color: t.textSecondary, marginTop: 2 },
    spaced: { marginTop: SPACING.xl },
    hint: { fontSize: 12.5, color: t.textSecondary, marginTop: SPACING.sm, lineHeight: 18 },

    dueRow: { flexDirection: 'row', gap: SPACING.sm },
    dueInput: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      gap: SPACING.sm,
      backgroundColor: t.surfaceAlt,
      borderRadius: RADIUS.md,
      paddingHorizontal: 14,
      paddingVertical: 12,
      borderWidth: 1,
      borderColor: t.border,
    },
    dueText: { flex: 1, fontSize: 15, color: t.text, padding: 0 },
    dueSave: {
      paddingHorizontal: SPACING.lg,
      justifyContent: 'center',
      borderRadius: RADIUS.md,
      borderWidth: 1,
      borderColor: t.border,
      backgroundColor: t.surfaceAlt,
    },
    dueSaveText: { fontSize: 14, fontWeight: '700', color: t.primary },

    amountWrapper: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: SPACING.sm,
      backgroundColor: t.surfaceAlt,
      borderRadius: RADIUS.md,
      paddingHorizontal: SPACING.lg,
      borderWidth: 1,
      borderColor: t.border,
      marginTop: SPACING.md,
    },
    currencyPrefix: { fontSize: 16, fontWeight: '600', color: t.textSecondary },
    amountInput: { flex: 1, paddingVertical: 14, fontSize: 21, fontWeight: '700', color: t.text },

    sugestoes: { marginTop: SPACING.md },
    sugestaoLabel: { fontSize: 12, color: t.textLight, marginBottom: SPACING.sm },
    sugestaoRow: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.sm },
    sugestaoChip: {
      paddingHorizontal: 12,
      paddingVertical: 7,
      borderRadius: RADIUS.md,
      borderWidth: 1,
      borderColor: t.border,
      backgroundColor: t.surface,
      alignItems: 'center',
    },
    sugestaoChipText: { fontSize: 12.5, fontWeight: '600', color: t.text },
    sugestaoChipTaxa: { fontSize: 10.5, color: t.textSecondary, marginTop: 1 },

    resultado: {
      marginTop: SPACING.lg,
      padding: SPACING.lg,
      borderRadius: RADIUS.lg,
      backgroundColor: alpha(t.success, 0.08),
    },
    economiaLabel: {
      fontSize: 11.5,
      fontWeight: '700',
      color: t.textSecondary,
      textTransform: 'uppercase',
      letterSpacing: 0.7,
    },
    economiaValor: {
      fontSize: 30,
      fontWeight: '800',
      color: t.success,
      letterSpacing: -1,
      marginTop: 2,
      fontVariant: ['tabular-nums'],
    },
    economiaSub: { fontSize: 12.5, color: t.textSecondary, marginTop: 4, lineHeight: 18 },
    divisor: { height: 1, backgroundColor: t.border, marginVertical: SPACING.md },
    interpretacao: {
      fontSize: 12.5,
      color: t.textSecondary,
      lineHeight: 18,
      marginTop: SPACING.sm,
      fontStyle: 'italic',
    },
    avisoRow: { flexDirection: 'row', gap: SPACING.sm, alignItems: 'flex-start' },
    aviso: { flex: 1, fontSize: 13, color: t.danger, lineHeight: 19 },
  });
