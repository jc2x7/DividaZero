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
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Expense, PayoffDebt } from '../types';
import {
  getExpenseGroup,
  updateDueDayForGroup,
  getPayoffQuote,
  savePayoffQuote,
  getSelections,
  toggleSelection,
  getSelectionTotals,
} from '../database/database';
import { useTheme, useThemedStyles } from '../hooks/useTheme';
import { ThemePalette, RADIUS, SPACING, alpha } from '../constants/theme';
import { Label, StatRow, GhostButton, MoneyInput } from './ui';
import {
  ParcelaAberta,
  simularPelaUltimaParcela,
  simularQuitacao,
  vencimentoDe,
  formatarTaxaMensal,
  taxaAnual,
  diasAteVencimento,
  taxaPelaParcela,
} from '../utils/quitacao';
import {
  formatCurrency,
  formatDate,
  monthIndex,
  currentMonthIndex,
  getTodayString,
} from '../utils/formatting';

interface Props {
  debt: PayoffDebt | null;
  onClose: () => void;
  onChanged: () => void;
  /** Mês de onde sai o dinheiro extra, 'YYYY-MM'. */
  mesKey: string;
  /** Quanto foi reservado para aquele mês. */
  dinheiroDoMes: number;
}

/** Vencimento assumido quando a despesa não tem dia definido. */
const DIA_PADRAO = 10;

export default function QuitacaoSheet({
  debt,
  onClose,
  onChanged,
  mesKey,
  dinheiroDoMes,
}: Props) {
  const { theme } = useTheme();
  const styles = useThemedStyles(makeStyles);

  const [ocorrencias, setOcorrencias] = useState<Expense[]>([]);
  const [diaInput, setDiaInput] = useState('');
  const [ultimaInput, setUltimaInput] = useState('');
  /** Taxa já deduzida em uma simulação anterior desta dívida. */
  const [taxaSalva, setTaxaSalva] = useState<number | null>(null);
  /** Dia que já está gravado, para evitar escrita desnecessária no banco. */
  const [diaNoBanco, setDiaNoBanco] = useState<number | null>(null);
  const [salvoEm, setSalvoEm] = useState<string | null>(null);
  const [statusSalvo, setStatusSalvo] = useState<'ocioso' | 'salvando' | 'salvo'>('ocioso');
  /** expense_id → valor comprometido, das parcelas marcadas nesta dívida. */
  const [marcadas, setMarcadas] = useState<Record<number, number>>({});
  /**
   * Total comprometido no mês somando todas as dívidas. Fica aqui dentro, e não
   * como prop, porque precisa ser relido a cada marcação — vindo de fora ele
   * envelhecia e o dinheiro desta própria dívida aparecia como "em outras".
   */
  const [totalDoMes, setTotalDoMes] = useState(0);

  const carregar = useCallback(async () => {
    if (!debt) return;
    const [linhas, salvo, selecoes, totais] = await Promise.all([
      getExpenseGroup(debt.groupId),
      getPayoffQuote(debt.groupId),
      getSelections(debt.groupId),
      getSelectionTotals(),
    ]);
    setMarcadas(Object.fromEntries(selecoes.map((x) => [x.expense_id, x.amount])));
    setTotalDoMes(totais[mesKey] ?? 0);
    setOcorrencias(linhas);
    const comDia = linhas.find((l) => l.due_day);
    setDiaInput(comDia?.due_day ? String(comDia.due_day) : '');
    setDiaNoBanco(comDia?.due_day ?? null);

    // Restaura a simulação anterior desta dívida.
    setTaxaSalva(salvo?.monthly_rate ?? null);
    setSalvoEm(salvo?.quoted_at ?? null);
    setUltimaInput(
      salvo?.last_quote ? String(salvo.last_quote).replace('.', ',') : ''
    );
    setStatusSalvo('ocioso');
  }, [debt, mesKey]);

  useEffect(() => {
    if (!debt) return;
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

  /**
   * Sem proposta nova na tela, vale a taxa já deduzida antes para esta dívida —
   * ela é do contrato e continua valendo mesmo com os vencimentos mais perto.
   * Sem nada salvo, mostra o desenho do desconto a uma taxa de mercado.
   */
  const TAXA_REFERENCIA = 0.025;
  const usandoTaxaSalva = !sim && taxaSalva !== null && taxaSalva > 0;
  const previa = useMemo(() => {
    if (!parcelas.length || sim) return null;
    return simularQuitacao(parcelas, usandoTaxaSalva ? taxaSalva! : TAXA_REFERENCIA);
  }, [parcelas, sim, usandoTaxaSalva, taxaSalva]);

  /**
   * Grava sozinho o que a pessoa mexeu — dia de vencimento e proposta — depois
   * de uma pausa na digitação. Sem botão: o usuário não deveria precisar
   * lembrar de salvar uma simulação.
   */
  useEffect(() => {
    if (!debt || !parcelas.length) return;
    // Só grava o que já é utilizável; rascunho inválido não vira estado salvo.
    const d = parseInt(diaInput, 10);
    const diaValido = !isNaN(d) && d >= 1 && d <= 31;
    const quoteValida = !isNaN(valorUltima) && valorUltima > 0;
    if (!diaValido && !quoteValida) return;

    setStatusSalvo('salvando');
    const timer = setTimeout(async () => {
      try {
        if (diaValido && d !== diaNoBanco) {
          await updateDueDayForGroup(parcelas[0].id, d);
          setDiaNoBanco(d);
          onChanged();
        }
        if (quoteValida && ultimaParcela) {
          const dias = diasAteVencimento(ultimaParcela.vencimento);
          const taxa = taxaPelaParcela(ultimaParcela.valor, valorUltima, dias);
          await savePayoffQuote({
            group_id: debt.groupId,
            last_quote: valorUltima,
            quoted_at: getTodayString(),
            days_to_last: dias,
            monthly_rate: taxa,
          });
          setTaxaSalva(taxa);
          setSalvoEm(getTodayString());
        }
        setStatusSalvo('salvo');
      } catch {
        setStatusSalvo('ocioso');
      }
    }, 700);
    return () => clearTimeout(timer);
    // `ultima` é derivada de parcelas; incluí-la basta para reagir a mudanças.
  }, [debt, diaInput, valorUltima, parcelas.length]);

  /** Quanto do dinheiro do mês ainda está livre. */
  const usadoAqui = Object.values(marcadas).reduce((a, b) => a + b, 0);
  const usadoEmOutras = Math.max(0, totalDoMes - usadoAqui);
  const restante = dinheiroDoMes - usadoEmOutras - usadoAqui;

  /** Texto que explica por que dá (ou não dá) para marcar mais parcelas. */
  const dicaMarcacao = (lista: { id: number; valorHoje: number }[]) => {
    const cabeAlguma = lista.some(
      (p) => marcadas[p.id] === undefined && p.valorHoje <= restante + 0.005
    );
    if (cabeAlguma) {
      return 'Toque nas parcelas que você vai pagar com esse dinheiro. Cada marcação desconta o valor de hoje, não o de face.';
    }
    if (restante > 0.005) {
      return `Sobraram ${formatCurrency(restante)}, menos que a parcela mais barata desta dívida. Aumente o valor do mês ou use em outra dívida.`;
    }
    return 'Todo o dinheiro do mês já está distribuído. Desmarque uma parcela para trocar de escolha.';
  };

  /**
   * Marca ou desmarca uma parcela. Ao marcar, o que sai do bolso é o valor
   * *descontado* — antecipar custa menos que o valor de face.
   */
  const alternarParcela = async (expenseId: number, valorHoje: number) => {
    if (!debt) return;
    const jaMarcada = marcadas[expenseId] !== undefined;
    // Sem dinheiro sobrando, marcar mais seria mentira; desmarcar é sempre ok.
    if (!jaMarcada && valorHoje > restante + 0.005) return;

    await toggleSelection(expenseId, debt.groupId, mesKey, valorHoje);
    setMarcadas((atual) => {
      const proximo = { ...atual };
      if (jaMarcada) delete proximo[expenseId];
      else proximo[expenseId] = valorHoje;
      return proximo;
    });
    setTotalDoMes((t) => t + (jaMarcada ? -valorHoje : valorHoje));
    onChanged();
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
            {/* Dinheiro reservado para este mês */}
            {dinheiroDoMes > 0 && (
              <View
                style={[
                  styles.carteira,
                  {
                    backgroundColor:
                      restante > 0.005 ? alpha(theme.primary, 0.09) : alpha(theme.success, 0.1),
                  },
                ]}
              >
                <MaterialCommunityIcons
                  name={restante > 0.005 ? 'wallet-outline' : 'check-circle-outline'}
                  size={22}
                  color={restante > 0.005 ? theme.primary : theme.success}
                />
                <View>
                  <Text style={styles.carteiraLabel}>
                    {restante > 0.005 ? 'Ainda dá para usar' : 'Dinheiro todo alocado'}
                  </Text>
                  <Text
                    style={[
                      styles.carteiraValor,
                      { color: restante > 0.005 ? theme.primary : theme.success },
                    ]}
                  >
                    {formatCurrency(Math.max(0, restante))}
                  </Text>
                </View>
                <Text style={styles.carteiraDica}>
                  de {formatCurrency(dinheiroDoMes)} reservados
                  {usadoEmOutras > 0
                    ? ` · ${formatCurrency(usadoEmOutras)} em outras dívidas`
                    : ''}
                </Text>
              </View>
            )}

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
              {statusSalvo !== 'ocioso' && (
                <View style={styles.statusSalvo}>
                  <MaterialCommunityIcons
                    name={statusSalvo === 'salvo' ? 'check-circle' : 'progress-clock'}
                    size={14}
                    color={statusSalvo === 'salvo' ? theme.success : theme.textLight}
                  />
                  <Text
                    style={[
                      styles.statusSalvoTexto,
                      statusSalvo === 'salvo' && { color: theme.success },
                    ]}
                  >
                    {statusSalvo === 'salvo' ? 'Salvo' : 'Salvando'}
                  </Text>
                </View>
              )}
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
            <MoneyInput
              value={valorUltima || 0}
              onChangeValue={(v) => setUltimaInput(v > 0 ? String(v) : '')}
              style={{ marginTop: SPACING.md }}
            />

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
                {dinheiroDoMes > 0 && (
                  <Text style={styles.dica}>{dicaMarcacao(sim.parcelas)}</Text>
                )}
                <View style={styles.tabela}>
                  <View style={styles.cabecalho}>
                    {dinheiroDoMes > 0 && <View style={styles.colMarca} />}
                    <Text style={[styles.th, { flex: 1.5 }]}>Vencimento</Text>
                    <Text style={[styles.th, styles.thNum]}>Valor</Text>
                    <Text style={[styles.th, styles.thNum]}>Hoje</Text>
                    <Text style={[styles.th, styles.thNum]}>Desconto</Text>
                  </View>
                  {sim.parcelas.map((p) => (
                    <ParcelaLinha
                      key={p.id}
                      p={p}
                      marcada={marcadas[p.id] !== undefined}
                      podeMarcar={p.valorHoje <= restante + 0.005}
                      temDinheiro={dinheiroDoMes > 0}
                      onToggle={() => alternarParcela(p.id, p.valorHoje)}
                    />
                  ))}
                </View>
                <Text style={styles.rodape}>
                  Estimativa a partir da proposta que você informou. O credor pode usar outra
                  regra de cálculo — confirme o valor final antes de pagar.
                </Text>
              </>
            )}

            {/* Sem proposta nova: usa a taxa já salva, ou explica o mecanismo */}
            {!!previa && !semDesconto && (
              <View style={styles.previa}>
                {usandoTaxaSalva ? (
                  <>
                    <View style={styles.previaCabecalho}>
                      <MaterialCommunityIcons
                        name="content-save-check-outline"
                        size={16}
                        color={theme.success}
                      />
                      <Text style={styles.previaTitulo}>Usando a taxa salva</Text>
                    </View>
                    <Text style={styles.previaTexto}>
                      Você já simulou esta dívida
                      {salvoEm ? ` em ${formatDate(salvoEm)}` : ''} e a taxa apurada foi de{' '}
                      <Text style={{ fontWeight: '700', color: theme.text }}>
                        {formatarTaxaMensal(taxaSalva!)}
                      </Text>
                      . Com ela, quitar as {parcelas.length} parcelas hoje sairia por{' '}
                      <Text style={{ fontWeight: '700', color: theme.text }}>
                        {formatCurrency(previa.totalHoje)}
                      </Text>{' '}
                      em vez de {formatCurrency(previa.totalNominal)} — economia de{' '}
                      <Text style={{ fontWeight: '700', color: theme.success }}>
                        {formatCurrency(previa.descontoTotal)}
                      </Text>
                      .
                    </Text>
                    <Text style={styles.previaTexto}>
                      O valor muda sozinho conforme os vencimentos se aproximam. Se o credor
                      passar uma proposta nova, digite acima para atualizar a taxa.
                    </Text>
                  </>
                ) : (
                  <>
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
                      taxa real e o desconto de cada uma. A partir daí fica salvo.
                    </Text>
                  </>
                )}
              </View>
            )}

            {/* Tabela também aparece quando a base é a taxa salva */}
            {!!previa && usandoTaxaSalva && !semDesconto && (
              <>
                <Label style={styles.espacado}>Desconto de cada parcela</Label>
                {dinheiroDoMes > 0 && (
                  <Text style={styles.dica}>{dicaMarcacao(previa.parcelas)}</Text>
                )}
                <View style={styles.tabela}>
                  <View style={styles.cabecalho}>
                    {dinheiroDoMes > 0 && <View style={styles.colMarca} />}
                    <Text style={[styles.th, { flex: 1.5 }]}>Vencimento</Text>
                    <Text style={[styles.th, styles.thNum]}>Valor</Text>
                    <Text style={[styles.th, styles.thNum]}>Hoje</Text>
                    <Text style={[styles.th, styles.thNum]}>Desconto</Text>
                  </View>
                  {previa.parcelas.map((p) => (
                    <ParcelaLinha
                      key={p.id}
                      p={p}
                      marcada={marcadas[p.id] !== undefined}
                      podeMarcar={p.valorHoje <= restante + 0.005}
                      temDinheiro={dinheiroDoMes > 0}
                      onToggle={() => alternarParcela(p.id, p.valorHoje)}
                    />
                  ))}
                </View>
              </>
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

/**
 * Linha da tabela de parcelas. Quando há dinheiro reservado no mês, ela vira
 * tocável: marcar a parcela compromete o valor *descontado* com ela.
 */
function ParcelaLinha({
  p,
  marcada,
  podeMarcar,
  temDinheiro,
  onToggle,
}: {
  p: { id: number; numero: number; total: number; valor: number; valorHoje: number; desconto: number; dias: number; vencimento: string };
  marcada: boolean;
  podeMarcar: boolean;
  temDinheiro: boolean;
  onToggle: () => void;
}) {
  const { theme } = useTheme();
  const styles = useThemedStyles(makeStyles);
  const bloqueada = temDinheiro && !marcada && !podeMarcar;

  return (
    <TouchableOpacity
      style={[
        styles.linha,
        marcada && styles.linhaMarcada,
        bloqueada && { opacity: 0.45 },
      ]}
      onPress={onToggle}
      disabled={!temDinheiro || bloqueada}
      activeOpacity={0.7}
    >
      {temDinheiro && (
        <View style={styles.colMarca}>
          <View style={[styles.caixa, marcada && styles.caixaMarcada]}>
            {marcada && (
              <MaterialCommunityIcons name="check" size={12} color={theme.onFill} />
            )}
          </View>
        </View>
      )}
      <View style={{ flex: 1.5 }}>
        <Text style={styles.tdData}>{formatDate(p.vencimento)}</Text>
        <Text style={styles.tdParcela}>
          {p.numero}/{p.total} · {p.dias}d
        </Text>
      </View>
      <Text style={[styles.td, styles.tdNum]}>{p.valor.toFixed(2)}</Text>
      <Text
        style={[
          styles.td,
          styles.tdNum,
          { fontWeight: '700' },
          marcada && { color: theme.primary },
        ]}
      >
        {p.valorHoje.toFixed(2)}
      </Text>
      <Text style={[styles.td, styles.tdNum, { color: theme.success }]}>
        −{p.desconto.toFixed(2)}
      </Text>
    </TouchableOpacity>
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
    statusSalvo: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      paddingHorizontal: SPACING.md,
    },
    statusSalvoTexto: { fontSize: 12, fontWeight: '600', color: t.textLight },

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
    linhaMarcada: { backgroundColor: alpha(t.primary, 0.08) },
    colMarca: { width: 26, alignItems: 'flex-start' },
    caixa: {
      width: 18,
      height: 18,
      borderRadius: 5,
      borderWidth: 1.5,
      borderColor: t.borderStrong,
      alignItems: 'center',
      justifyContent: 'center',
    },
    caixaMarcada: { backgroundColor: t.primaryFill, borderColor: t.primaryFill },

    carteira: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: SPACING.md,
      padding: SPACING.md,
      borderRadius: RADIUS.md,
      marginTop: SPACING.md,
    },
    carteiraLabel: { fontSize: 11.5, fontWeight: '600', color: t.textSecondary },
    carteiraValor: {
      fontSize: 19,
      fontWeight: '800',
      marginTop: 1,
      fontVariant: ['tabular-nums'],
    },
    carteiraDica: { fontSize: 11.5, color: t.textSecondary, flex: 1, lineHeight: 16 },
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
    previaCabecalho: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    previaTitulo: { fontSize: 13.5, fontWeight: '700', color: t.text },
    previaTexto: { fontSize: 12.5, color: t.textSecondary, lineHeight: 18 },
  });
