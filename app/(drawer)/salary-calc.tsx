import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { COLORS } from '../../constants/colors';
import { formatCurrency, formatPercent } from '../../utils/formatting';
import { calculateNetSalary } from '../../utils/calculations';
import {
  INSS_TABLE_2026,
  IRRF_TABLE_2026,
  INSS_CEILING_2026,
  IR_EXEMPT_LIMIT_2026,
} from '../../constants/taxes2026';

export default function SalaryCalcScreen() {
  const [grossSalary, setGrossSalary] = useState('');
  const [dependents, setDependents] = useState('0');
  const [otherDeductions, setOtherDeductions] = useState('0');
  const [calculated, setCalculated] = useState(false);
  const [showTables, setShowTables] = useState(false);

  const grossNum = parseFloat(grossSalary.replace(',', '.')) || 0;
  const dependentsNum = parseInt(dependents, 10) || 0;
  const otherDedNum = parseFloat(otherDeductions.replace(',', '.')) || 0;

  const result = useMemo(() => {
    if (!calculated || grossNum <= 0) return null;
    return calculateNetSalary(grossNum, dependentsNum, otherDedNum);
  }, [calculated, grossNum, dependentsNum, otherDedNum]);

  const ResultRow = ({
    label,
    value,
    color,
    bold,
    large,
    negative,
  }: {
    label: string;
    value: number;
    color?: string;
    bold?: boolean;
    large?: boolean;
    negative?: boolean;
  }) => (
    <View style={styles.resultRow}>
      <Text style={[styles.resultLabel, bold && styles.resultLabelBold]}>{label}</Text>
      <Text
        style={[
          styles.resultValue,
          { color: color ?? COLORS.text },
          bold && styles.resultValueBold,
          large && styles.resultValueLarge,
        ]}
      >
        {negative ? '- ' : ''}{formatCurrency(value)}
      </Text>
    </View>
  );

  const TableSection = ({
    title,
    rows,
    headers,
  }: {
    title: string;
    rows: string[][];
    headers: string[];
  }) => (
    <View style={styles.tableSection}>
      <Text style={styles.tableSectionTitle}>{title}</Text>
      <View style={styles.tableContainer}>
        <View style={styles.tableHeaderRow}>
          {headers.map((h) => (
            <Text key={h} style={[styles.tableHeaderCell, { flex: h === headers[0] ? 2 : 1 }]}>
              {h}
            </Text>
          ))}
        </View>
        {rows.map((row, i) => (
          <View key={i} style={[styles.tableDataRow, i % 2 === 0 && styles.tableDataRowEven]}>
            {row.map((cell, j) => (
              <Text
                key={j}
                style={[styles.tableDataCell, { flex: j === 0 ? 2 : 1 }]}
              >
                {cell}
              </Text>
            ))}
          </View>
        ))}
      </View>
    </View>
  );

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Header */}
          <View style={styles.headerCard}>
            <MaterialCommunityIcons name="cash-multiple" size={32} color={COLORS.success} />
            <View>
              <Text style={styles.headerTitle}>Salário Líquido</Text>
              <Text style={styles.headerSubtitle}>
                Tabelas INSS e IRRF · Legislação 2026
              </Text>
            </View>
          </View>

          {/* Inputs */}
          <View style={styles.card}>
            <Text style={styles.inputLabel}>Salário Bruto (R$)</Text>
            <TextInput
              style={styles.input}
              value={grossSalary}
              onChangeText={(v) => { setGrossSalary(v); setCalculated(false); }}
              placeholder="Ex: 5000,00"
              placeholderTextColor={COLORS.textLight}
              keyboardType="decimal-pad"
            />

            <Text style={styles.inputLabel}>Número de Dependentes</Text>
            <TextInput
              style={styles.input}
              value={dependents}
              onChangeText={(v) => { setDependents(v); setCalculated(false); }}
              placeholder="0"
              placeholderTextColor={COLORS.textLight}
              keyboardType="number-pad"
            />

            <Text style={styles.inputLabel}>Outras Deduções (R$)</Text>
            <TextInput
              style={styles.input}
              value={otherDeductions}
              onChangeText={(v) => { setOtherDeductions(v); setCalculated(false); }}
              placeholder="Pensão alimentícia, previdência privada..."
              placeholderTextColor={COLORS.textLight}
              keyboardType="decimal-pad"
            />
          </View>

          {/* Exempt notice */}
          {grossNum > 0 && grossNum <= IR_EXEMPT_LIMIT_2026 && (
            <View style={[styles.alertBox, { backgroundColor: `${COLORS.success}15`, borderLeftColor: COLORS.success }]}>
              <MaterialCommunityIcons name="check-circle" size={18} color={COLORS.success} />
              <Text style={[styles.alertText, { color: COLORS.success }]}>
                Rendimento até R$ {IR_EXEMPT_LIMIT_2026.toLocaleString('pt-BR')} — isento de Imposto de Renda em 2026
              </Text>
            </View>
          )}

          {/* Calculate Button */}
          <TouchableOpacity
            style={[styles.calcBtn, grossNum <= 0 && styles.calcBtnDisabled]}
            onPress={() => setCalculated(true)}
            disabled={grossNum <= 0}
          >
            <MaterialCommunityIcons name="calculator" size={20} color="#fff" />
            <Text style={styles.calcBtnText}>Calcular Salário Líquido</Text>
          </TouchableOpacity>

          {/* Results */}
          {result && (
            <View style={styles.resultsCard}>
              <Text style={styles.resultsTitle}>Demonstrativo de Pagamento</Text>

              <ResultRow label="(+) Salário Bruto" value={result.grossSalary} bold />

              <View style={styles.resultDivider} />
              <Text style={styles.resultGroupLabel}>DESCONTOS OBRIGATÓRIOS</Text>

              <ResultRow
                label="(-) INSS"
                value={result.inss}
                color={COLORS.error}
                negative
              />
              {result.inssDetails.map((d) => (
                <View key={d.range} style={styles.subRow}>
                  <Text style={styles.subRowLabel}>
                    {d.range} — {formatPercent(d.rate)}
                  </Text>
                  <Text style={styles.subRowValue}>{formatCurrency(d.amount)}</Text>
                </View>
              ))}

              <ResultRow
                label="(-) IRRF"
                value={result.ir}
                color={result.isExempt ? COLORS.success : COLORS.error}
                negative={!result.isExempt}
              />
              {result.isExempt && (
                <View style={styles.subRow}>
                  <Text style={[styles.subRowLabel, { color: COLORS.success }]}>
                    Isento — base de cálculo abaixo de R$ 5.000,00
                  </Text>
                </View>
              )}
              {!result.isExempt && (
                <View style={styles.subRow}>
                  <Text style={styles.subRowLabel}>
                    Base de cálculo: {formatCurrency(result.irBase)}
                  </Text>
                </View>
              )}

              <View style={styles.resultDivider} />

              <View style={styles.liquidRow}>
                <Text style={styles.liquidLabel}>(=) Salário Líquido</Text>
                <Text style={styles.liquidValue}>{formatCurrency(result.netSalary)}</Text>
              </View>

              {/* Effective rate */}
              <View style={styles.effectiveRow}>
                <Text style={styles.effectiveLabel}>
                  Carga tributária efetiva:
                  <Text style={styles.effectiveValue}>
                    {' '}{(((result.inss + result.ir) / result.grossSalary) * 100).toFixed(2)}%
                  </Text>
                </Text>
              </View>
            </View>
          )}

          {/* Tax Tables Toggle */}
          <TouchableOpacity
            style={styles.tableToggle}
            onPress={() => setShowTables(!showTables)}
          >
            <MaterialCommunityIcons
              name={showTables ? 'chevron-up' : 'chevron-down'}
              size={20}
              color={COLORS.info}
            />
            <Text style={styles.tableToggleText}>
              {showTables ? 'Ocultar' : 'Ver'} Tabelas INSS e IRRF 2026
            </Text>
          </TouchableOpacity>

          {showTables && (
            <>
              <TableSection
                title="Tabela Progressiva INSS 2026"
                headers={['Faixa Salarial', 'Alíquota', 'Parcela Deduzir']}
                rows={[
                  ['Até R$ 1.621,00', '7,5%', '-'],
                  ['R$ 1.621,01 a R$ 2.902,84', '9,0%', 'R$ 24,32'],
                  ['R$ 2.902,85 a R$ 4.354,27', '12,0%', 'R$ 111,40'],
                  ['R$ 4.354,28 a R$ 8.475,55', '14,0%', 'R$ 198,49'],
                ]}
              />
              <TableSection
                title="Tabela IRRF 2026 (após INSS)"
                headers={['Base de Cálculo', 'Alíquota', 'Parcela Deduzir']}
                rows={[
                  ['Até R$ 5.000,00', 'Isento', '-'],
                  ['R$ 5.000,01 a R$ 7.000,00', '7,5%', 'R$ 375,00'],
                  ['R$ 7.000,01 a R$ 9.000,00', '15,0%', 'R$ 900,00'],
                  ['R$ 9.000,01 a R$ 12.000,00', '22,5%', 'R$ 1.575,00'],
                  ['Acima de R$ 12.000,00', '27,5%', 'R$ 2.175,00'],
                ]}
              />
              <View style={styles.footnote}>
                <Text style={styles.footnoteText}>
                  * Contribuintes com rendimento total até R$ 5.000,00 estão isentos do IRRF
                  conforme legislação vigente em 2026. Para rendas entre R$ 5.000,01 e R$ 7.350,00,
                  aplica-se redutor progressivo de até R$ 312,89.
                </Text>
              </View>
            </>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  content: { padding: 16, paddingBottom: 40 },
  headerCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    backgroundColor: COLORS.card,
    borderRadius: 16,
    padding: 16,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 2,
  },
  headerTitle: { fontSize: 18, fontWeight: '700', color: COLORS.text },
  headerSubtitle: { fontSize: 12, color: COLORS.textSecondary, marginTop: 2 },
  card: {
    backgroundColor: COLORS.card,
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 1,
  },
  inputLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 8,
    marginTop: 12,
  },
  input: {
    backgroundColor: COLORS.background,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 18,
    color: COLORS.text,
    borderWidth: 1,
    borderColor: COLORS.border,
    fontWeight: '600',
  },
  alertBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
    borderLeftWidth: 3,
  },
  alertText: { flex: 1, fontSize: 12, lineHeight: 18 },
  calcBtn: {
    backgroundColor: COLORS.highlight,
    borderRadius: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 16,
    marginBottom: 20,
  },
  calcBtnDisabled: { opacity: 0.4 },
  calcBtnText: { color: '#fff', fontSize: 17, fontWeight: '700' },
  resultsCard: {
    backgroundColor: COLORS.card,
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.07,
    shadowRadius: 6,
    elevation: 2,
  },
  resultsTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.text,
    marginBottom: 16,
    textAlign: 'center',
  },
  resultRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
  },
  resultLabel: { fontSize: 14, color: COLORS.text },
  resultLabelBold: { fontWeight: '700' },
  resultValue: { fontSize: 14, color: COLORS.text },
  resultValueBold: { fontWeight: '700' },
  resultValueLarge: { fontSize: 18 },
  resultDivider: {
    height: 1,
    backgroundColor: COLORS.border,
    marginVertical: 8,
  },
  resultGroupLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 4,
  },
  subRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 3,
    paddingLeft: 16,
  },
  subRowLabel: { fontSize: 11, color: COLORS.textSecondary, flex: 1 },
  subRowValue: { fontSize: 11, color: COLORS.textSecondary, fontWeight: '600' },
  liquidRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    borderRadius: 10,
    paddingHorizontal: 12,
    backgroundColor: `${COLORS.success}12`,
    marginTop: 4,
  },
  liquidLabel: { fontSize: 16, fontWeight: '700', color: COLORS.text },
  liquidValue: { fontSize: 22, fontWeight: '900', color: COLORS.success },
  effectiveRow: {
    alignItems: 'center',
    marginTop: 10,
  },
  effectiveLabel: { fontSize: 12, color: COLORS.textSecondary },
  effectiveValue: { fontWeight: '700', color: COLORS.text },
  tableToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 12,
    marginBottom: 8,
  },
  tableToggleText: {
    fontSize: 13,
    color: COLORS.info,
    fontWeight: '600',
  },
  tableSection: {
    backgroundColor: COLORS.card,
    borderRadius: 14,
    marginBottom: 12,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
  },
  tableSectionTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.text,
    padding: 14,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  tableContainer: {},
  tableHeaderRow: {
    flexDirection: 'row',
    backgroundColor: COLORS.secondary,
    padding: 10,
  },
  tableHeaderCell: {
    fontSize: 10,
    fontWeight: '700',
    color: '#fff',
    textTransform: 'uppercase',
  },
  tableDataRow: {
    flexDirection: 'row',
    padding: 10,
  },
  tableDataRowEven: {
    backgroundColor: `${COLORS.background}88`,
  },
  tableDataCell: {
    fontSize: 11,
    color: COLORS.text,
  },
  footnote: {
    backgroundColor: `${COLORS.warning}10`,
    borderRadius: 10,
    padding: 12,
    marginBottom: 16,
    borderLeftWidth: 3,
    borderLeftColor: COLORS.warning,
  },
  footnoteText: {
    fontSize: 11,
    color: COLORS.text,
    lineHeight: 17,
  },
});
