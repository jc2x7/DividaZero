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
import { Expense, PayoffDebt } from '../types';
import { getExpenseGroup, updateDueDayForGroup } from '../database/database';
import { useTheme, useThemedStyles } from '../hooks/useTheme';
import { ThemePalette, RADIUS, SPACING, alpha } from '../constants/theme';
import { Label, StatRow, GhostButton } from './ui';
import {
  ParcelaAberta,
  simularPelaUltimaParcela,
  simularQuitacao,
  vencimentoDe,
  formatarTaxaMensal,
  taxaAnual,
  diasAteVencimento,
} from '../utils/quitacao';
import { formatCurrency, formatDate, monthIndex, currentMonthIndex } from '../utils/formatting';

interface Props {
  debt: PayoffDebt | null;
  onClose: () => void;
  onChanged: () => void;
}

/** Vencimento assumido quando a despesa não tem dia definido. */
const DIA_PADRAO = 10;

export default function QuitacaoSheet({ debt, onClose, onChanged }: Props) {
  const { theme } = useTheme();
  const styles = useThemedStyles(makeStyles);

  const [ocorrencias, setOcorrencias] = useState<Expense[]>([]);
  const [diaInput, setDiaInput] = useState('');
  const [ultimaInput, setUltimaInput] = useState('');
  const [salvandoDia, setSalvandoDia] = useState(false);

  const carregar = useCallback(async () => {
    if (!debt) return;
    const linhas = await getExpenseGroup(debt.groupId);
    setOcorrencias(linhas);
    const comDia = linhas.find((l) => l.due_day);
    setDiaInput(comDia?.due_day ? String(comDia.due_day) : '');
  }, [debt]);

  useEffect(() => {
    if (!debt) return;
    setUltimaInput('');
    carregar();
  }, [debt, carregar]);

  const agora = currentMonthIndex();
  const dia = parseInt(diaInput, 10) || DIA_PADRAO;

  /** Parcelas ainda em aberto, já com a data de vencimento montada. */
  const parcelas: ParcelaAberta[] = useMemo(
    () =>
      ocorrencias
        .filter((o) => !o.is_paid && monthIndex(o.year, o.month) >= agora)
        .sort((a, b) => monthIndex(a.year, a.month) - monthIndex(b.year, b.month))
        .map((o) => ({
          id: o.id,
          numero: o.installments_current,
          total: o.installments_total,
          valor: o.amount,
          vencimento: vencimentoDe(o.year, o.month, dia),
        })),
    [ocorrencias, agora, dia]
  );

  const ultimaParcela = parcelas.length ? parcelas[parcelas.length - 1] : null;
  const valorUltima = parseFloat(ultimaInput.replace(/\./g, '').replace(',', '.'));

  const sim = useMemo(() => {
    if (!parcelas.length || isNaN(valorUltima) || valorUltima <= 0) return null;
    return simularPelaUltimaParcela(parcelas, valorUltima);
  }, [parcelas, valorUltima]);

  /** Prévia sem proposta: mostra o desenho do desconto a uma taxa de mercado. */
  const previa = useMemo(
    () => (parcelas.length && !sim ? simularQuitacao(parcelas, 0.025) : null),
    [parcelas, sim]
  );

  const salvarDia = async () => {
    if (!debt || !parcelas.length) return;
    const d = parseInt(diaInput, 10);
    if (isNaN(d) || d < 1 || d > 31) {
      Alert.alert('Dia inválido', 'Informe um dia entre 1 e 31.');
      return;
    }
    setSalvandoDia(true);
    try {
      await updateDueDayForGroup(parcelas[0].id, d);
      onChanged();
      await carregar();
    } finally {
      setSalvandoDia(false);
    }
  };

  if (!debt) return null;

  const semDesconto =
    ultimaInput.length > 0 && !isNaN(valorUltima) && valorUltima > 0 && sim === null;

  return (
    <Modal visible animationType="slide" transparent onRequestClose={onClose}>
      <KeyboardAvoidingView
        style={styles.overlay}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.sheet}>
          <View style={styles.handle} />

          <View style={styles.header}>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={styles.title} numberOfLines={1}>
                {debt.name}
              </Text>
              <Text style={styles.subtitle}>
                {parcelas.length} {parcelas.length === 1 ? 'parcela em aberto' : 'parcelas em aberto'}{' '}
                · {formatCurrency(debt.installmentAmount)} cada
              </Text>
            </View>
            <TouchableOpacity onPress={onClose} hitSlop={8} style={{ padding: 4 }}>
              <MaterialCommunityIcons name="close" size={22} color={theme.textSecondary} />
            </TouchableOpacity>
          </View>

          <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
            {/* Dia de vencimento */}
            <Label>Vence todo dia</Label>
            <View style={styles.linhaDia}>
              <View style={styles.campoDia}>
                <MaterialCommunityIcons
                  name="calendar-blank-outline"
                  size={17}
                  color={diaInput ? theme.primary : theme.textLight}
                />
                <TextInput
                  style={styles.inputDia}
                  value={diaInput}
                  onChangeText={(v) => setDiaInput(v.replace(/[^0-9]/g, '').slice(0, 2))}
                  keyboardType="number-pad"
                  placeholder={String(DIA_PADRAO)}
                  placeholderTextColor={theme.textLight}
                  maxLength={2}
                />
              </View>
              <TouchableOpacity
                style={[styles.btnSalvar, salvandoDia && { opacity: 0.5 }]}
                onPress={salvarDia}
                disabled={salvandoDia}
              >
                <Text style={styles.btnSalvarTexto}>Salvar</Text>
              </TouchableOpacity>
            </View>
            <Text style={styles.dica}>
              O dia do vencimento decide quanto juro já correu em cada parcela — é ele que
              define o tamanho do desconto.
            </Text>

            {/* Proposta da última parcela */}
            <Label style={styles.espacado}>Quanto o credor cobra pela última parcela</Label>
            {!!ultimaParcela && (
              <Text style={styles.dica}>
                A última vence em {formatDate(ultimaParcela.vencimento)}, daqui a{' '}
                {diasAteVencimento(ultimaParcela.vencimento)} dias. Pergunte quanto fica para
                pagá-la hoje.
              </Text>
            )}
            <View style={styles.campoValor}>
              <Text style={styles.prefixo}>R$</Text>
              <TextInput
                style={styles.inputValor}
                value={ultimaInput}
                onChangeText={setUltimaInput}
                keyboardType="decimal-pad"
                placeholder="0,00"
                placeholderTextColor={theme.textLight}
              />
            </View>

            {semDesconto && (
              <View style={styles.aviso}>
                <MaterialCommunityIcons
                  name="alert-circle-outline"
                  size={17}
                  color={theme.danger}
                />
                <Text style={styles.avisoTexto}>
                  Esse valor é igual ou maior que a parcela de {formatCurrency(debt.installmentAmount)}.
                  Sem desconto não há antecipação — vale pedir outra proposta.
                </Text>
              </View>
            )}

            {/* Resultado */}
            {!!sim && (
              <>
                <View style={styles.destaque}>
                  <Text style={styles.destaqueLabel}>Para quitar tudo hoje</Text>
                  <Text style={styles.destaqueValor}>{formatCurrency(sim.totalHoje)}</Text>
                  <Text style={styles.destaqueSub}>
                    em vez de {formatCurrency(sim.totalNominal)} — você economiza{' '}
                    <Text style={{ fontWeight: '800', color: theme.success }}>
                      {formatCurrency(sim.descontoTotal)}
                    </Text>{' '}
                    ({sim.descontoPercentual.toFixed(1).replace('.', ',')}%)
                  </Text>
                  <View style={styles.divisor} />
                  <StatRow
                    label="Juro embutido nas parcelas"
                    value={`${formatarTaxaMensal(sim.taxaMensal)} · ${(taxaAnual(sim.taxaMensal) * 100).toFixed(1).replace('.', ',')}% a.a.`}
                    icon="percent-outline"
                  />
                </View>

                <Label style={styles.espacado}>Desconto de cada parcela</Label>
                <View style={styles.tabela}>
                  <View style={styles.cabecalho}>
                    <Text style={[styles.th, { flex: 1.5 }]}>Vencimento</Text>
                    <Text style={[styles.th, styles.thNum]}>Valor</Text>
                    <Text style={[styles.th, styles.thNum]}>Hoje</Text>
                    <Text style={[styles.th, styles.thNum]}>Desconto</Text>
                  </View>
                  {sim.parcelas.map((p) => (
                    <View key={p.id} style={styles.linha}>
                      <View style={{ flex: 1.5 }}>
                        <Text style={styles.tdData}>{formatDate(p.vencimento)}</Text>
                        <Text style={styles.tdParcela}>
                          {p.numero}/{p.total} · {p.dias}d
                        </Text>
                      </View>
                      <Text style={[styles.td, styles.tdNum]}>{p.valor.toFixed(2)}</Text>
                      <Text style={[styles.td, styles.tdNum, { fontWeight: '700' }]}>
                        {p.valorHoje.toFixed(2)}
                      </Text>
                      <Text style={[styles.td, styles.tdNum, { color: theme.success }]}>
                        −{p.desconto.toFixed(2)}
                      </Text>
                    </View>
                  ))}
                </View>
                <Text style={styles.rodape}>
                  Estimativa a partir da proposta que você informou. O credor pode usar outra
                  regra de cálculo — confirme o valor final antes de pagar.
                </Text>
              </>
            )}

            {/* Prévia enquanto não há proposta */}
            {!!previa && !semDesconto && (
              <View style={styles.previa}>
                <Text style={styles.previaTitulo}>Como funciona</Text>
                <Text style={styles.previaTexto}>
                  Cada parcela vale menos hoje do que no vencimento, porque o juro dos meses
                  que faltam deixa de correr. A parcela mais distante é a que ganha o maior
                  desconto.
                </Text>
                <Text style={styles.previaTexto}>
                  A uma taxa de 2,5% ao mês, por exemplo, as {parcelas.length} parcelas desta
                  dívida sairiam por cerca de{' '}
                  <Text style={{ fontWeight: '700', color: theme.text }}>
                    {formatCurrency(previa.totalHoje)}
                  </Text>{' '}
                  em vez de {formatCurrency(previa.totalNominal)}.
                </Text>
                <Text style={styles.previaTexto}>
                  Informe acima quanto o credor cobra pela última parcela e o app descobre a
                  taxa real e o desconto de cada uma.
                </Text>
              </View>
            )}

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
    title: { fontSize: 18, fontWeight: '700', color: t.text, letterSpacing: -0.3 },
    subtitle: { fontSize: 12.5, color: t.textSecondary, marginTop: 2 },
    espacado: { marginTop: SPACING.xl },
    dica: { fontSize: 12, color: t.textSecondary, marginTop: SPACING.sm, lineHeight: 17 },

    linhaDia: { flexDirection: 'row', gap: SPACING.sm },
    campoDia: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      gap: SPACING.sm,
      backgroundColor: t.surfaceAlt,
      borderRadius: RADIUS.md,
      paddingHorizontal: 14,
      paddingVertical: 11,
      borderWidth: 1,
      borderColor: t.border,
    },
    inputDia: { flex: 1, fontSize: 15, color: t.text, padding: 0 },
    btnSalvar: {
      paddingHorizontal: SPACING.lg,
      justifyContent: 'center',
      borderRadius: RADIUS.md,
      borderWidth: 1,
      borderColor: t.border,
      backgroundColor: t.surfaceAlt,
    },
    btnSalvarTexto: { fontSize: 14, fontWeight: '700', color: t.primary },

    campoValor: {
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
    prefixo: { fontSize: 16, fontWeight: '600', color: t.textSecondary },
    inputValor: { flex: 1, paddingVertical: 13, fontSize: 21, fontWeight: '700', color: t.text },

    aviso: {
      flexDirection: 'row',
      gap: SPACING.sm,
      alignItems: 'flex-start',
      marginTop: SPACING.md,
      padding: SPACING.md,
      borderRadius: RADIUS.md,
      backgroundColor: alpha(t.danger, 0.09),
    },
    avisoTexto: { flex: 1, fontSize: 12.5, color: t.danger, lineHeight: 18 },

    destaque: {
      marginTop: SPACING.lg,
      padding: SPACING.lg,
      borderRadius: RADIUS.lg,
      backgroundColor: alpha(t.success, 0.09),
    },
    destaqueLabel: {
      fontSize: 11.5,
      fontWeight: '700',
      color: t.textSecondary,
      textTransform: 'uppercase',
      letterSpacing: 0.7,
    },
    destaqueValor: {
      fontSize: 30,
      fontWeight: '800',
      color: t.text,
      letterSpacing: -1,
      marginTop: 2,
      fontVariant: ['tabular-nums'],
    },
    destaqueSub: { fontSize: 12.5, color: t.textSecondary, marginTop: 4, lineHeight: 18 },
    divisor: { height: 1, backgroundColor: t.border, marginVertical: SPACING.md },

    tabela: {
      borderWidth: 1,
      borderColor: t.border,
      borderRadius: RADIUS.md,
      overflow: 'hidden',
    },
    cabecalho: {
      flexDirection: 'row',
      backgroundColor: t.surfaceAlt,
      paddingVertical: 8,
      paddingHorizontal: SPACING.md,
    },
    th: {
      fontSize: 10,
      fontWeight: '700',
      color: t.textSecondary,
      textTransform: 'uppercase',
      letterSpacing: 0.4,
    },
    thNum: { flex: 1, textAlign: 'right' },
    linha: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: 9,
      paddingHorizontal: SPACING.md,
      borderTopWidth: 1,
      borderTopColor: t.divider,
    },
    tdData: { fontSize: 12.5, color: t.text, fontWeight: '600' },
    tdParcela: { fontSize: 10.5, color: t.textLight, marginTop: 1 },
    td: { fontSize: 12.5, color: t.textSecondary, fontVariant: ['tabular-nums'] },
    tdNum: { flex: 1, textAlign: 'right' },
    rodape: { fontSize: 11.5, color: t.textLight, marginTop: SPACING.md, lineHeight: 16 },

    previa: {
      marginTop: SPACING.lg,
      padding: SPACING.lg,
      borderRadius: RADIUS.md,
      backgroundColor: t.surfaceAlt,
      gap: SPACING.sm,
    },
    previaTitulo: { fontSize: 13.5, fontWeight: '700', color: t.text },
    previaTexto: { fontSize: 12.5, color: t.textSecondary, lineHeight: 18 },
  });
