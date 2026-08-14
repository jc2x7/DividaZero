import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as DocumentPicker from 'expo-document-picker';
import { router } from 'expo-router';
import {
  analisarExtrato,
  ExtratoError,
  RespostaExtrato,
  TransacaoExtrato,
} from '../../services/extrato';
import { importTransactions } from '../../database/database';
import { useCategories } from '../../hooks/useCategories';
import { useTheme, useThemedStyles } from '../../hooks/useTheme';
import { ThemePalette, RADIUS, SPACING, alpha, categoryColor } from '../../constants/theme';
import { Card, EmptyState, Label, PrimaryButton, GhostButton, StatRow } from '../../components/ui';
import { formatCurrency, formatDate, getMonthName } from '../../utils/formatting';

type Etapa = 'inicio' | 'lendo' | 'revisao';

export default function ImportarScreen() {
  const { theme } = useTheme();
  const styles = useThemedStyles(makeStyles);
  const { categories, get } = useCategories();

  const [etapa, setEtapa] = useState<Etapa>('inicio');
  const [resposta, setResposta] = useState<RespostaExtrato | null>(null);
  const [selecionados, setSelecionados] = useState<Set<number>>(new Set());
  const [categoriasEditadas, setCategoriasEditadas] = useState<Record<number, string>>({});
  const [mesesAbertos, setMesesAbertos] = useState<Set<string>>(new Set());
  const [editandoCategoria, setEditandoCategoria] = useState<number | null>(null);
  const [salvando, setSalvando] = useState(false);

  const escolherArquivo = async () => {
    const res = await DocumentPicker.getDocumentAsync({
      type: 'application/pdf',
      copyToCacheDirectory: true,
    });
    if (res.canceled || !res.assets?.[0]) return;

    const arquivo = res.assets[0];
    setEtapa('lendo');
    try {
      const r = await analisarExtrato(arquivo.uri, arquivo.name);
      setResposta(r);
      // Transferência entre contas próprias fica desmarcada: não é gasto nem receita.
      setSelecionados(
        new Set(r.transacoes.map((t, i) => (t.interno ? -1 : i)).filter((i) => i >= 0))
      );
      setCategoriasEditadas({});
      // Abre só o mês mais recente — 900 linhas abertas de uma vez é ilegível.
      const meses = [...new Set(r.transacoes.map((t) => t.data.slice(0, 7)))].sort().reverse();
      setMesesAbertos(new Set(meses.slice(0, 1)));
      setEtapa('revisao');
    } catch (e) {
      setEtapa('inicio');
      Alert.alert(
        'Não deu para ler',
        e instanceof ExtratoError ? e.message : 'Erro inesperado ao ler o arquivo.'
      );
    }
  };

  const porMes = useMemo(() => {
    if (!resposta) return [];
    const mapa = new Map<string, { indice: number; tx: TransacaoExtrato }[]>();
    resposta.transacoes.forEach((tx, indice) => {
      const chave = tx.data.slice(0, 7);
      if (!mapa.has(chave)) mapa.set(chave, []);
      mapa.get(chave)!.push({ indice, tx });
    });
    return [...mapa.entries()].sort((a, b) => b[0].localeCompare(a[0]));
  }, [resposta]);

  const totais = useMemo(() => {
    if (!resposta) return { entradas: 0, saidas: 0, n: 0 };
    let entradas = 0;
    let saidas = 0;
    selecionados.forEach((i) => {
      const t = resposta.transacoes[i];
      if (!t) return;
      if (t.tipo === 'ENTRADA') entradas += t.valor;
      else saidas += t.valor;
    });
    return { entradas, saidas, n: selecionados.size };
  }, [resposta, selecionados]);

  const alternar = (i: number) =>
    setSelecionados((s) => {
      const novo = new Set(s);
      novo.has(i) ? novo.delete(i) : novo.add(i);
      return novo;
    });

  const alternarMes = (itens: { indice: number }[]) => {
    const todosMarcados = itens.every((x) => selecionados.has(x.indice));
    setSelecionados((s) => {
      const novo = new Set(s);
      itens.forEach((x) => (todosMarcados ? novo.delete(x.indice) : novo.add(x.indice)));
      return novo;
    });
  };

  const importar = async () => {
    if (!resposta || selecionados.size === 0) return;
    setSalvando(true);
    try {
      // Carrega o índice junto até o fim: a categoria editada é indexada por
      // ele, e filtrar antes de ler desalinharia os dois.
      const lista = [...selecionados]
        .map((i) => ({ i, t: resposta.transacoes[i] }))
        .filter((x) => !!x.t)
        .map(({ i, t }) => ({
          data: t.data,
          descricao: t.descricao,
          valor: t.valor,
          tipo: t.tipo,
          categoria: categoriasEditadas[i] ?? t.categoria ?? 'OTHER',
        }));

      const { inseridos, repetidos } = await importTransactions(lista);
      Alert.alert(
        'Importação concluída',
        `${inseridos} ${inseridos === 1 ? 'lançamento adicionado' : 'lançamentos adicionados'}.` +
          (repetidos > 0
            ? `\n\n${repetidos} ${repetidos === 1 ? 'já existia' : 'já existiam'} no app e ${repetidos === 1 ? 'foi ignorado' : 'foram ignorados'}.`
            : ''),
        [{ text: 'Ver no painel', onPress: () => router.replace('/(drawer)') }]
      );
      setEtapa('inicio');
      setResposta(null);
    } catch {
      Alert.alert('Erro', 'Não foi possível gravar os lançamentos.');
    } finally {
      setSalvando(false);
    }
  };

  // ── Início ────────────────────────────────────────────────
  if (etapa === 'inicio') {
    return (
      <SafeAreaView style={styles.container} edges={['bottom']}>
        <ScrollView contentContainerStyle={styles.content}>
          <Card>
            <EmptyState
              icon="file-pdf-box"
              title="Importar extrato em PDF"
              subtitle="Baixe o extrato no app do seu banco e envie aqui. O app separa entradas e saídas e sugere uma categoria para cada lançamento."
              action={
                <PrimaryButton
                  label="Escolher arquivo PDF"
                  icon="file-upload-outline"
                  onPress={escolherArquivo}
                />
              }
            />
          </Card>

          <Card style={styles.block}>
            <Label>Como funciona</Label>
            <Passo n={1} texto="Você escolhe o PDF do extrato." />
            <Passo n={2} texto="O arquivo é enviado para o servidor do app, que lê as datas e os valores e devolve tudo organizado." />
            <Passo n={3} texto="Você revisa, desmarca o que não quer e confirma." />
            <View style={styles.privacidade}>
              <MaterialCommunityIcons name="shield-check-outline" size={17} color={theme.info} />
              <Text style={styles.privacidadeTexto}>
                O PDF é apagado do servidor logo depois de lido — nada fica guardado.
                CPF, agência e conta são removidos antes do processamento, e os valores
                nunca são enviados ao modelo que sugere as categorias.
              </Text>
            </View>
            <Text style={styles.aviso}>
              Esta é a única função do app que usa internet. Todo o resto continua só no
              seu celular.
            </Text>
          </Card>
        </ScrollView>
      </SafeAreaView>
    );
  }

  // ── Lendo ─────────────────────────────────────────────────
  if (etapa === 'lendo') {
    return (
      <SafeAreaView style={styles.container} edges={['bottom']}>
        <View style={styles.carregando}>
          <ActivityIndicator size="large" color={theme.primary} />
          <Text style={styles.carregandoTitulo}>Lendo o extrato…</Text>
          <Text style={styles.carregandoTexto}>
            Extratos longos levam cerca de meio minuto. Pode deixar a tela aberta.
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  // ── Revisão ───────────────────────────────────────────────
  const r = resposta!;
  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Card>
          <Label>Extrato lido</Label>
          <Text style={styles.periodo}>
            {r.resumo.de ? formatDate(r.resumo.de) : '—'} a{' '}
            {r.resumo.ate ? formatDate(r.resumo.ate) : '—'}
          </Text>
          <View style={{ marginTop: SPACING.md }}>
            <StatRow label="Lançamentos encontrados" value={String(r.resumo.total)} />
            <StatRow
              label="Entradas"
              value={formatCurrency(r.resumo.entradas)}
              color={theme.success}
            />
            <StatRow
              label="Saídas"
              value={formatCurrency(r.resumo.saidas)}
              color={theme.danger}
            />
            {r.resumo.internas > 0 && (
              <StatRow
                label="Transferências entre contas suas"
                value={`${r.resumo.internas} (desmarcadas)`}
                icon="swap-horizontal"
              />
            )}
            {r.resumo.parceladas > 0 && (
              <StatRow
                label="Parcelas identificadas"
                value={String(r.resumo.parceladas)}
                icon="credit-card-outline"
              />
            )}
          </View>
        </Card>

        {porMes.map(([mes, itens]) => {
          const [ano, m] = mes.split('-');
          const aberto = mesesAbertos.has(mes);
          const marcados = itens.filter((x) => selecionados.has(x.indice)).length;
          return (
            <View key={mes} style={styles.block}>
              <View style={styles.mesHeader}>
                <TouchableOpacity
                  style={styles.mesToggle}
                  onPress={() =>
                    setMesesAbertos((s) => {
                      const novo = new Set(s);
                      novo.has(mes) ? novo.delete(mes) : novo.add(mes);
                      return novo;
                    })
                  }
                >
                  <MaterialCommunityIcons
                    name={aberto ? 'chevron-up' : 'chevron-down'}
                    size={20}
                    color={theme.textSecondary}
                  />
                  <Text style={styles.mesTitulo}>
                    {getMonthName(Number(m))} {ano}
                  </Text>
                  <Text style={styles.mesContagem}>
                    {marcados}/{itens.length}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => alternarMes(itens)} hitSlop={8}>
                  <Text style={styles.mesAcao}>
                    {marcados === itens.length ? 'Desmarcar' : 'Marcar todos'}
                  </Text>
                </TouchableOpacity>
              </View>

              {aberto &&
                itens.map(({ indice, tx }) => {
                  const marcado = selecionados.has(indice);
                  const catKey = categoriasEditadas[indice] ?? tx.categoria ?? 'OTHER';
                  const cat = get(catKey);
                  const tint = categoryColor(cat.color, theme);
                  return (
                    <View key={indice}>
                      <TouchableOpacity
                        style={[styles.linha, !marcado && styles.linhaOff]}
                        onPress={() => alternar(indice)}
                        activeOpacity={0.7}
                      >
                        <View style={[styles.check, marcado && styles.checkOn]}>
                          {marcado && (
                            <MaterialCommunityIcons name="check" size={12} color={theme.onFill} />
                          )}
                        </View>

                        <View style={{ flex: 1, minWidth: 0 }}>
                          <Text style={styles.linhaNome} numberOfLines={1}>
                            {tx.descricao}
                          </Text>
                          <View style={styles.linhaTags}>
                            <TouchableOpacity
                              style={[styles.catChip, { backgroundColor: alpha(tint, 0.13) }]}
                              onPress={() =>
                                setEditandoCategoria(editandoCategoria === indice ? null : indice)
                              }
                            >
                              <MaterialCommunityIcons
                                name={cat.icon as never}
                                size={10}
                                color={tint}
                              />
                              <Text style={[styles.catChipTexto, { color: tint }]}>
                                {cat.label}
                              </Text>
                              <MaterialCommunityIcons
                                name="chevron-down"
                                size={11}
                                color={tint}
                              />
                            </TouchableOpacity>
                            <Text style={styles.linhaData}>{formatDate(tx.data)}</Text>
                            {tx.interno && (
                              <Text style={styles.linhaInterno}>entre contas suas</Text>
                            )}
                            {!!tx.parcela && (
                              <Text style={styles.linhaParcela}>
                                {tx.parcela.atual}/{tx.parcela.total}
                              </Text>
                            )}
                          </View>
                        </View>

                        <Text
                          style={[
                            styles.linhaValor,
                            { color: tx.tipo === 'ENTRADA' ? theme.success : theme.text },
                          ]}
                        >
                          {tx.tipo === 'ENTRADA' ? '+' : '−'}
                          {formatCurrency(tx.valor)}
                        </Text>
                      </TouchableOpacity>

                      {editandoCategoria === indice && (
                        <View style={styles.catPicker}>
                          {categories.map((c) => {
                            const ct = categoryColor(c.color, theme);
                            const ativo = c.key === catKey;
                            return (
                              <TouchableOpacity
                                key={c.key}
                                style={[
                                  styles.catOpcao,
                                  ativo && { borderColor: ct, backgroundColor: alpha(ct, 0.12) },
                                ]}
                                onPress={() => {
                                  setCategoriasEditadas((m) => ({ ...m, [indice]: c.key }));
                                  setEditandoCategoria(null);
                                }}
                              >
                                <MaterialCommunityIcons
                                  name={c.icon as never}
                                  size={13}
                                  color={ativo ? ct : theme.textLight}
                                />
                                <Text
                                  style={[
                                    styles.catOpcaoTexto,
                                    ativo && { color: ct, fontWeight: '700' },
                                  ]}
                                >
                                  {c.label}
                                </Text>
                              </TouchableOpacity>
                            );
                          })}
                        </View>
                      )}
                    </View>
                  );
                })}
            </View>
          );
        })}

        <View style={{ height: 120 }} />
      </ScrollView>

      <View style={styles.rodape}>
        <View style={styles.rodapeInfo}>
          <Text style={styles.rodapeContagem}>
            {totais.n} {totais.n === 1 ? 'selecionado' : 'selecionados'}
          </Text>
          <Text style={styles.rodapeValores}>
            <Text style={{ color: theme.success }}>+{formatCurrency(totais.entradas)}</Text>
            {'   '}
            <Text style={{ color: theme.danger }}>−{formatCurrency(totais.saidas)}</Text>
          </Text>
        </View>
        <View style={styles.rodapeBotoes}>
          <GhostButton
            label="Cancelar"
            onPress={() => {
              setEtapa('inicio');
              setResposta(null);
            }}
            style={{ flex: 1 }}
          />
          <PrimaryButton
            label="Importar"
            icon="check"
            onPress={importar}
            loading={salvando}
            disabled={totais.n === 0}
            style={{ flex: 1.4 }}
          />
        </View>
      </View>
    </SafeAreaView>
  );
}

function Passo({ n, texto }: { n: number; texto: string }) {
  const styles = useThemedStyles(makeStyles);
  return (
    <View style={styles.passo}>
      <View style={styles.passoNum}>
        <Text style={styles.passoNumTexto}>{n}</Text>
      </View>
      <Text style={styles.passoTexto}>{texto}</Text>
    </View>
  );
}

const makeStyles = (t: ThemePalette) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: t.background },
    content: { padding: SPACING.lg, paddingBottom: SPACING.xxl },
    block: { marginTop: SPACING.lg },

    passo: { flexDirection: 'row', gap: SPACING.md, marginBottom: SPACING.md, alignItems: 'flex-start' },
    passoNum: {
      width: 22,
      height: 22,
      borderRadius: 11,
      backgroundColor: alpha(t.primary, 0.12),
      alignItems: 'center',
      justifyContent: 'center',
      marginTop: 1,
    },
    passoNumTexto: { fontSize: 11.5, fontWeight: '800', color: t.primary },
    passoTexto: { flex: 1, fontSize: 13.5, color: t.textSecondary, lineHeight: 19 },
    privacidade: {
      flexDirection: 'row',
      gap: SPACING.sm,
      padding: SPACING.md,
      borderRadius: RADIUS.md,
      backgroundColor: alpha(t.info, 0.1),
      marginTop: SPACING.sm,
    },
    privacidadeTexto: { flex: 1, fontSize: 12.5, color: t.info, lineHeight: 18 },
    aviso: { fontSize: 12, color: t.textLight, marginTop: SPACING.md, lineHeight: 17 },

    carregando: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: SPACING.xl, gap: SPACING.md },
    carregandoTitulo: { fontSize: 17, fontWeight: '700', color: t.text },
    carregandoTexto: { fontSize: 13.5, color: t.textSecondary, textAlign: 'center', lineHeight: 19 },

    periodo: { fontSize: 20, fontWeight: '700', color: t.text, letterSpacing: -0.3 },

    mesHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: SPACING.sm,
    },
    mesToggle: { flexDirection: 'row', alignItems: 'center', gap: 4, flex: 1 },
    mesTitulo: { fontSize: 14.5, fontWeight: '700', color: t.text },
    mesContagem: { fontSize: 12, color: t.textLight, marginLeft: 4 },
    mesAcao: { fontSize: 12.5, fontWeight: '700', color: t.primary },

    linha: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: SPACING.md,
      paddingVertical: 9,
      paddingHorizontal: SPACING.md,
      backgroundColor: t.surface,
      borderRadius: RADIUS.md,
      borderWidth: 1,
      borderColor: t.border,
      marginBottom: 6,
    },
    linhaOff: { opacity: 0.45 },
    check: {
      width: 19,
      height: 19,
      borderRadius: 5,
      borderWidth: 1.5,
      borderColor: t.borderStrong,
      alignItems: 'center',
      justifyContent: 'center',
    },
    checkOn: { backgroundColor: t.primaryFill, borderColor: t.primaryFill },
    linhaNome: { fontSize: 13.5, fontWeight: '600', color: t.text },
    linhaTags: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4, flexWrap: 'wrap' },
    catChip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 3,
      paddingHorizontal: 6,
      paddingVertical: 2,
      borderRadius: RADIUS.sm,
    },
    catChipTexto: { fontSize: 10, fontWeight: '700' },
    linhaData: { fontSize: 10.5, color: t.textLight },
    linhaInterno: { fontSize: 10, color: t.warning, fontWeight: '600' },
    linhaParcela: { fontSize: 10, color: t.info, fontWeight: '700' },
    linhaValor: { fontSize: 13.5, fontWeight: '700', fontVariant: ['tabular-nums'] },

    catPicker: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 5,
      padding: SPACING.sm,
      marginBottom: 6,
      backgroundColor: t.surfaceAlt,
      borderRadius: RADIUS.md,
    },
    catOpcao: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      paddingHorizontal: 8,
      paddingVertical: 5,
      borderRadius: RADIUS.sm,
      borderWidth: 1,
      borderColor: t.border,
      backgroundColor: t.surface,
    },
    catOpcaoTexto: { fontSize: 11, color: t.textSecondary },

    rodape: {
      position: 'absolute',
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: t.surface,
      borderTopWidth: 1,
      borderTopColor: t.border,
      padding: SPACING.lg,
      paddingBottom: SPACING.xl,
      gap: SPACING.md,
    },
    rodapeInfo: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
    rodapeContagem: { fontSize: 13, fontWeight: '700', color: t.text },
    rodapeValores: { fontSize: 12.5, fontWeight: '600', fontVariant: ['tabular-nums'] },
    rodapeBotoes: { flexDirection: 'row', gap: SPACING.md },
  });
