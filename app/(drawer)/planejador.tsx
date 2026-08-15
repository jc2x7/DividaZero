import React, { useCallback, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  RefreshControl,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { PlanDebt, PlanPayment } from '../../types';
import {
  getPlanDebts,
  getPlanPayments,
  addPlanDebt,
  updatePlanDebt,
  deletePlanDebt,
  setPlanPayment,
  getSetting,
  setSetting,
} from '../../database/database';
import { useCategories } from '../../hooks/useCategories';
import { useTheme, useThemedStyles } from '../../hooks/useTheme';
import { ThemePalette, RADIUS, SPACING, alpha, categoryColor } from '../../constants/theme';
import { Card, EmptyState, Label, ProgressBar, PrimaryButton } from '../../components/ui';
import {
  calcularPlano,
  proximoMes,
  mesAtualChave,
  valorParaPercentual,
  mesDeQuitacao,
} from '../../utils/planejador';
import {
  formatCurrency,
  getMonthShortName,
  getMonthName,
  somenteDigitos,
  digitosParaTexto,
  digitosParaNumero,
  numeroParaDigitos,
} from '../../utils/formatting';

const MESES_KEY = 'planejador_meses';

export default function PlanejadorScreen() {
  const { theme } = useTheme();
  const styles = useThemedStyles(makeStyles);
  const { get } = useCategories();

  const [debts, setDebts] = useState<PlanDebt[]>([]);
  const [payments, setPayments] = useState<PlanPayment[]>([]);
  const [meses, setMeses] = useState<string[]>([mesAtualChave()]);
  const [selecionado, setSelecionado] = useState<string>(mesAtualChave());
  const [loading, setLoading] = useState(true);
  const [editando, setEditando] = useState<number | null>(null);

  const [novoNome, setNovoNome] = useState('');
  const [novoValor, setNovoValor] = useState('');

  const carregar = useCallback(async () => {
    setLoading(true);
    try {
      const [d, p, salvos] = await Promise.all([
        getPlanDebts(),
        getPlanPayments(),
        getSetting(MESES_KEY),
      ]);
      setDebts(d);
      setPayments(p);

      let lista: string[] = salvos ? JSON.parse(salvos) : [];
      if (!Array.isArray(lista) || lista.length === 0) lista = [mesAtualChave()];
      lista.sort();
      setMeses(lista);
      setSelecionado((s) => (lista.includes(s) ? s : lista[lista.length - 1]));
    } catch {
      setMeses([mesAtualChave()]);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      carregar();
    }, [carregar])
  );

  const plano = useMemo(
    () => calcularPlano(meses, debts, payments),
    [meses, debts, payments]
  );
  const mes = plano[selecionado];
  const quitacao = useMemo(() => mesDeQuitacao(plano, meses), [plano, meses]);

  const salvarMeses = async (lista: string[]) => {
    setMeses(lista);
    await setSetting(MESES_KEY, JSON.stringify(lista));
  };

  const adicionarMes = async () => {
    const proximo = proximoMes(meses[meses.length - 1]);
    await salvarMeses([...meses, proximo]);
    setSelecionado(proximo);
  };

  const definirPercentual = async (debtId: number, percent: number) => {
    // Atualiza o estado antes de gravar: a barra reage no toque, sem esperar o disco.
    setPayments((atual) => {
      const outros = atual.filter(
        (p) => !(p.debt_id === debtId && p.month === selecionado)
      );
      return [...outros, { debt_id: debtId, month: selecionado, percent }];
    });
    await setPlanPayment(debtId, selecionado, percent);
  };

  const adicionarDivida = async () => {
    const nome = novoNome.trim();
    const valor = digitosParaNumero(novoValor);
    if (!nome) {
      Alert.alert('Falta o nome', 'Dê um nome para a dívida.');
      return;
    }
    if (isNaN(valor) || valor <= 0) {
      Alert.alert('Valor inválido', 'Informe quanto você deve.');
      return;
    }
    await addPlanDebt(nome, valor, 'OTHER', selecionado);
    setNovoNome('');
    setNovoValor('');
    carregar();
  };

  const excluir = (d: PlanDebt) => {
    Alert.alert('Excluir dívida', `Remover "${d.name}" do planejador?`, [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Excluir',
        style: 'destructive',
        onPress: async () => {
          await deletePlanDebt(d.id);
          setEditando(null);
          carregar();
        },
      },
    ]);
  };

  const pagoAcumulado = mes ? mes.totalOriginal - mes.totalRestante : 0;
  const pctGeral = mes && mes.totalOriginal > 0 ? (pagoAcumulado / mes.totalOriginal) * 100 : 0;

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      {/* Meses */}
      <View style={styles.mesesBarra}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.mesesLinha}
        >
          {meses.map((mk) => {
            const [ano, m] = mk.split('-');
            const ativo = mk === selecionado;
            return (
              <TouchableOpacity
                key={mk}
                style={[styles.mesChip, ativo && styles.mesChipAtivo]}
                onPress={() => setSelecionado(mk)}
              >
                <Text style={[styles.mesChipTexto, ativo && styles.mesChipTextoAtivo]}>
                  {getMonthShortName(Number(m))}/{ano.slice(2)}
                </Text>
              </TouchableOpacity>
            );
          })}
          <TouchableOpacity style={[styles.mesChip, styles.mesChipAdd]} onPress={adicionarMes}>
            <Text style={[styles.mesChipTexto, { color: theme.primary }]}>+ mês</Text>
          </TouchableOpacity>
        </ScrollView>
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        refreshControl={
          <RefreshControl refreshing={loading} onRefresh={carregar} tintColor={theme.textSecondary} />
        }
      >
        {/* Progresso */}
        <Card>
          <Label>Dívida restante ao fim de {getMonthName(Number(selecionado.split('-')[1]))}</Label>
          <Text style={styles.heroValor}>{formatCurrency(mes?.totalRestante ?? 0)}</Text>
          <Text style={styles.heroSub}>
            de {formatCurrency(mes?.totalOriginal ?? 0)} no total
          </Text>
          <View style={{ marginTop: SPACING.lg }}>
            <ProgressBar progress={pctGeral / 100} color={theme.success} height={8} />
          </View>
          <View style={styles.linhaResumo}>
            <Text style={styles.resumoTexto}>
              Quitado até aqui: <Text style={styles.resumoForte}>{formatCurrency(pagoAcumulado)}</Text>{' '}
              ({pctGeral.toFixed(0)}%)
            </Text>
            <Text style={styles.resumoTexto}>
              Pago no mês: <Text style={styles.resumoForte}>{formatCurrency(mes?.totalPago ?? 0)}</Text>
            </Text>
          </View>
          {quitacao && (
            <View style={styles.quitacaoBox}>
              <MaterialCommunityIcons name="flag-checkered" size={17} color={theme.success} />
              <Text style={styles.quitacaoTexto}>
                Neste ritmo, tudo quitado em{' '}
                <Text style={{ fontWeight: '800' }}>
                  {getMonthName(Number(quitacao.split('-')[1]))} de {quitacao.split('-')[0]}
                </Text>
              </Text>
            </View>
          )}
        </Card>

        {/* Dívidas do mês */}
        <View style={styles.block}>
          <Label>Dívidas</Label>
          <Text style={styles.dica}>
            Escolha quanto abater de cada uma neste mês. O que sobrar passa para o mês seguinte.
          </Text>

          {!mes || mes.linhas.length === 0 ? (
            <Card style={{ marginTop: SPACING.md }}>
              <EmptyState
                icon="clipboard-list-outline"
                title="Nenhuma dívida neste mês"
                subtitle="Cadastre abaixo o que você deve. Diferente das parcelas do painel, aqui você define o ritmo de pagamento mês a mês."
              />
            </Card>
          ) : (
            mes.linhas.map((l) => {
              const cat = get(l.debt.category);
              const tint = categoryColor(cat.color, theme);
              const quitada = l.saldoFinal === 0;
              return (
                <View key={l.debt.id} style={styles.divida}>
                  <View style={styles.dividaTopo}>
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <View style={styles.dividaNomeLinha}>
                        <Text style={styles.dividaNome} numberOfLines={1}>
                          {l.debt.name}
                        </Text>
                        {quitada && (
                          <View style={styles.selo}>
                            <Text style={styles.seloTexto}>Quitada</Text>
                          </View>
                        )}
                      </View>
                      <Text style={styles.dividaSaldo}>
                        {l.quitadaAntes
                          ? `Valor original: ${formatCurrency(l.debt.amount)}`
                          : `Saldo no mês: ${formatCurrency(l.saldoInicial)}`}
                      </Text>
                    </View>
                    <TouchableOpacity
                      onPress={() => setEditando(editando === l.debt.id ? null : l.debt.id)}
                      hitSlop={8}
                      style={styles.iconeBtn}
                    >
                      <MaterialCommunityIcons
                        name="pencil-outline"
                        size={16}
                        color={theme.textLight}
                      />
                    </TouchableOpacity>
                  </View>

                  {!l.quitadaAntes && (
                    <>
                      <View style={styles.controles}>
                        <View style={styles.campoPct}>
                          <TextInput
                            style={styles.inputPct}
                            value={l.percent ? String(l.percent).replace('.', ',') : ''}
                            onChangeText={(v) =>
                              definirPercentual(
                                l.debt.id,
                                parseFloat(v.replace(',', '.')) || 0
                              )
                            }
                            keyboardType="decimal-pad"
                            placeholder="0"
                            placeholderTextColor={theme.textLight}
                          />
                          <Text style={styles.sufixo}>%</Text>
                        </View>

                        <View style={styles.campoValor}>
                          <Text style={styles.prefixo}>R$</Text>
                          <TextInput
                            style={styles.inputValor}
                            value={digitosParaTexto(numeroParaDigitos(l.pago))}
                            onChangeText={(v) =>
                              definirPercentual(
                                l.debt.id,
                                valorParaPercentual(
                                  digitosParaNumero(somenteDigitos(v)),
                                  l.saldoInicial
                                )
                              )
                            }
                            keyboardType="decimal-pad"
                            placeholder="0"
                            placeholderTextColor={theme.textLight}
                          />
                        </View>

                        <View style={styles.atalhos}>
                          {[0, 50, 100].map((v) => (
                            <TouchableOpacity
                              key={v}
                              style={[styles.atalho, l.percent === v && styles.atalhoAtivo]}
                              onPress={() => definirPercentual(l.debt.id, v)}
                            >
                              <Text
                                style={[
                                  styles.atalhoTexto,
                                  l.percent === v && { color: theme.primary, fontWeight: '700' },
                                ]}
                              >
                                {v}%
                              </Text>
                            </TouchableOpacity>
                          ))}
                        </View>
                      </View>

                      <View style={styles.restaLinha}>
                        <ProgressBar
                          progress={
                            l.saldoInicial > 0 ? l.pago / l.saldoInicial : 0
                          }
                          color={tint}
                          height={5}
                        />
                        <Text style={styles.restaTexto}>
                          Resta{' '}
                          <Text style={[styles.restaValor, quitada && { color: theme.success }]}>
                            {formatCurrency(l.saldoFinal)}
                          </Text>
                        </Text>
                      </View>
                    </>
                  )}

                  {editando === l.debt.id && (
                    <EditarDivida
                      debt={l.debt}
                      onSalvo={() => {
                        setEditando(null);
                        carregar();
                      }}
                      onExcluir={() => excluir(l.debt)}
                    />
                  )}
                </View>
              );
            })
          )}

          {/* Nova dívida */}
          <View style={styles.novaDivida}>
            <TextInput
              style={[styles.input, { flex: 1 }]}
              placeholder="Nova dívida (ex: Cartão)"
              placeholderTextColor={theme.textLight}
              value={novoNome}
              onChangeText={setNovoNome}
            />
            <TextInput
              style={[styles.input, { width: 110, textAlign: 'right' }]}
              placeholder="R$"
              placeholderTextColor={theme.textLight}
              value={digitosParaTexto(somenteDigitos(novoValor))}
              onChangeText={(v) => setNovoValor(somenteDigitos(v))}
              keyboardType="number-pad"
            />
          </View>
          <PrimaryButton
            label="Adicionar dívida"
            icon="plus"
            onPress={adicionarDivida}
            style={{ marginTop: SPACING.md }}
          />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function EditarDivida({
  debt,
  onSalvo,
  onExcluir,
}: {
  debt: PlanDebt;
  onSalvo: () => void;
  onExcluir: () => void;
}) {
  const { theme } = useTheme();
  const styles = useThemedStyles(makeStyles);
  const [nome, setNome] = useState(debt.name);
  const [valor, setValor] = useState(numeroParaDigitos(debt.amount));

  return (
    <View style={styles.editor}>
      <TextInput
        style={[styles.input, { flex: 1 }]}
        value={nome}
        onChangeText={setNome}
        placeholderTextColor={theme.textLight}
      />
      <TextInput
        style={[styles.input, { width: 100, textAlign: 'right' }]}
        value={digitosParaTexto(somenteDigitos(valor))}
        onChangeText={(v) => setValor(somenteDigitos(v))}
        keyboardType="number-pad"
      />
      <TouchableOpacity
        style={styles.editorSalvar}
        onPress={async () => {
          const v = digitosParaNumero(valor);
          if (!nome.trim() || isNaN(v) || v <= 0) return;
          await updatePlanDebt(debt.id, nome, v, debt.category);
          onSalvo();
        }}
      >
        <MaterialCommunityIcons name="check" size={18} color={theme.onFill} />
      </TouchableOpacity>
      <TouchableOpacity style={styles.editorExcluir} onPress={onExcluir}>
        <MaterialCommunityIcons name="trash-can-outline" size={18} color={theme.danger} />
      </TouchableOpacity>
    </View>
  );
}

const makeStyles = (t: ThemePalette) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: t.background },
    content: { padding: SPACING.lg, paddingBottom: SPACING.xxl },
    block: { marginTop: SPACING.xl },

    mesesBarra: {
      borderBottomWidth: 1,
      borderBottomColor: t.divider,
      paddingVertical: SPACING.sm,
    },
    mesesLinha: { gap: SPACING.sm, paddingHorizontal: SPACING.lg },
    mesChip: {
      paddingHorizontal: 14,
      paddingVertical: 7,
      borderRadius: RADIUS.pill,
      borderWidth: 1,
      borderColor: t.border,
      backgroundColor: t.surface,
    },
    mesChipAtivo: { backgroundColor: t.primaryFill, borderColor: t.primaryFill },
    mesChipAdd: { borderStyle: 'dashed', borderColor: t.primary },
    mesChipTexto: { fontSize: 13, fontWeight: '600', color: t.textSecondary },
    mesChipTextoAtivo: { color: t.onFill },

    heroValor: {
      fontSize: 30,
      fontWeight: '800',
      color: t.text,
      letterSpacing: -1,
      fontVariant: ['tabular-nums'],
    },
    heroSub: { fontSize: 13, color: t.textSecondary, marginTop: 2 },
    linhaResumo: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      flexWrap: 'wrap',
      gap: SPACING.sm,
      marginTop: SPACING.md,
    },
    resumoTexto: { fontSize: 12.5, color: t.textSecondary },
    resumoForte: { color: t.text, fontWeight: '700' },
    quitacaoBox: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: SPACING.sm,
      marginTop: SPACING.lg,
      padding: SPACING.md,
      borderRadius: RADIUS.md,
      backgroundColor: alpha(t.success, 0.1),
    },
    quitacaoTexto: { flex: 1, fontSize: 13, color: t.text },

    dica: { fontSize: 12.5, color: t.textSecondary, marginTop: -4, marginBottom: SPACING.md, lineHeight: 18 },

    divida: {
      backgroundColor: t.surface,
      borderRadius: RADIUS.lg,
      borderWidth: 1,
      borderColor: t.border,
      padding: SPACING.lg,
      marginBottom: SPACING.md,
    },
    dividaTopo: { flexDirection: 'row', alignItems: 'flex-start', gap: SPACING.sm },
    dividaNomeLinha: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm },
    dividaNome: { fontSize: 14.5, fontWeight: '700', color: t.text, flexShrink: 1 },
    dividaSaldo: {
      fontSize: 12,
      color: t.textSecondary,
      marginTop: 2,
      fontVariant: ['tabular-nums'],
    },
    selo: {
      paddingHorizontal: 7,
      paddingVertical: 2,
      borderRadius: RADIUS.pill,
      backgroundColor: alpha(t.success, 0.14),
    },
    seloTexto: { fontSize: 10, fontWeight: '700', color: t.success },
    iconeBtn: { padding: 3 },

    controles: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: SPACING.sm,
      marginTop: SPACING.md,
      flexWrap: 'wrap',
    },
    campoPct: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: t.surfaceAlt,
      borderRadius: RADIUS.sm,
      borderWidth: 1,
      borderColor: t.border,
      paddingHorizontal: 8,
    },
    inputPct: {
      width: 42,
      paddingVertical: 8,
      fontSize: 14,
      fontWeight: '700',
      color: t.text,
      textAlign: 'right',
    },
    sufixo: { fontSize: 12.5, color: t.textSecondary, marginLeft: 2 },
    campoValor: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: t.surfaceAlt,
      borderRadius: RADIUS.sm,
      borderWidth: 1,
      borderColor: t.border,
      paddingHorizontal: 8,
      flex: 1,
      minWidth: 96,
    },
    prefixo: { fontSize: 12.5, color: t.textSecondary, marginRight: 3 },
    inputValor: {
      flex: 1,
      paddingVertical: 8,
      fontSize: 14,
      fontWeight: '700',
      color: t.text,
      textAlign: 'right',
    },
    atalhos: { flexDirection: 'row', gap: 4 },
    atalho: {
      paddingHorizontal: 8,
      paddingVertical: 6,
      borderRadius: RADIUS.sm,
      borderWidth: 1,
      borderColor: t.border,
      backgroundColor: t.surfaceAlt,
    },
    atalhoAtivo: { borderColor: t.primary, backgroundColor: alpha(t.primary, 0.1) },
    atalhoTexto: { fontSize: 11, color: t.textSecondary, fontWeight: '600' },

    restaLinha: { marginTop: SPACING.md, gap: 6 },
    restaTexto: { fontSize: 12, color: t.textSecondary, textAlign: 'right' },
    restaValor: { fontWeight: '700', color: t.text, fontVariant: ['tabular-nums'] },

    editor: {
      flexDirection: 'row',
      gap: SPACING.sm,
      marginTop: SPACING.md,
      paddingTop: SPACING.md,
      borderTopWidth: 1,
      borderTopColor: t.divider,
      alignItems: 'center',
    },
    editorSalvar: {
      width: 38,
      height: 38,
      borderRadius: RADIUS.sm,
      backgroundColor: t.primaryFill,
      alignItems: 'center',
      justifyContent: 'center',
    },
    editorExcluir: {
      width: 38,
      height: 38,
      borderRadius: RADIUS.sm,
      borderWidth: 1,
      borderColor: t.border,
      alignItems: 'center',
      justifyContent: 'center',
    },

    novaDivida: { flexDirection: 'row', gap: SPACING.sm, marginTop: SPACING.lg },
    input: {
      backgroundColor: t.surface,
      borderRadius: RADIUS.md,
      borderWidth: 1,
      borderColor: t.border,
      paddingHorizontal: SPACING.md,
      paddingVertical: 11,
      fontSize: 14.5,
      color: t.text,
    },
  });
