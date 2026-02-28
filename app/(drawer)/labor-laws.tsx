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
import { formatCurrency } from '../../utils/formatting';
import {
  calculateSeverance,
  calculateVacation,
  DismissalType,
} from '../../utils/calculations';

type Tab = 'SEVERANCE' | 'VACATION';

const DISMISSAL_TYPES: { value: DismissalType; label: string; desc: string }[] = [
  { value: 'SEM_JUSTA_CAUSA', label: 'Sem Justa Causa', desc: 'Demitido pelo empregador' },
  { value: 'PEDIDO_DEMISSAO', label: 'Pedido de Demissão', desc: 'Iniciado pelo empregado' },
  { value: 'ACORDO_CONSENSUAL', label: 'Acordo Consensual', desc: 'Art. 484-A CLT' },
  { value: 'JUSTA_CAUSA', label: 'Justa Causa', desc: 'Por infração grave' },
];

function NumberInput({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <>
      <Text style={styles.inputLabel}>{label}</Text>
      <TextInput
        style={styles.input}
        value={value}
        onChangeText={onChange}
        placeholder={placeholder ?? '0'}
        placeholderTextColor={COLORS.textLight}
        keyboardType="decimal-pad"
      />
    </>
  );
}

export default function LaborLawsScreen() {
  const [tab, setTab] = useState<Tab>('SEVERANCE');

  // Severance State
  const [sevSalary, setSevSalary] = useState('');
  const [sevYears, setSevYears] = useState('');
  const [sevMonths, setSevMonths] = useState('');
  const [sevDays, setSevDays] = useState('');
  const [sevVacDays, setSevVacDays] = useState('0');
  const [sevFgts, setSevFgts] = useState('');
  const [sevDismissal, setSevDismissal] = useState<DismissalType>('SEM_JUSTA_CAUSA');
  const [sevPriorWorked, setSevPriorWorked] = useState(false);
  const [sevCalc, setSevCalc] = useState(false);

  // Vacation State
  const [vacSalary, setVacSalary] = useState('');
  const [vacMonths, setVacMonths] = useState('12');
  const [vacSellDays, setVacSellDays] = useState('0');
  const [vacCalc, setVacCalc] = useState(false);

  const severanceResult = useMemo(() => {
    if (!sevCalc) return null;
    const s = parseFloat(sevSalary.replace(',', '.')) || 0;
    if (s <= 0) return null;
    return calculateSeverance(
      s,
      parseInt(sevYears, 10) || 0,
      parseInt(sevMonths, 10) || 0,
      parseInt(sevDays, 10) || 0,
      parseInt(sevVacDays, 10) || 0,
      parseFloat(sevFgts.replace(',', '.')) || 0,
      sevDismissal,
      sevPriorWorked
    );
  }, [sevCalc, sevSalary, sevYears, sevMonths, sevDays, sevVacDays, sevFgts, sevDismissal, sevPriorWorked]);

  const vacationResult = useMemo(() => {
    if (!vacCalc) return null;
    const s = parseFloat(vacSalary.replace(',', '.')) || 0;
    if (s <= 0) return null;
    return calculateVacation(
      s,
      parseInt(vacMonths, 10) || 12,
      parseInt(vacSellDays, 10) || 0
    );
  }, [vacCalc, vacSalary, vacMonths, vacSellDays]);

  const ResultLine = ({
    label,
    value,
    color,
    indent,
    bold,
    large,
    sign = '+',
  }: {
    label: string;
    value: number;
    color?: string;
    indent?: boolean;
    bold?: boolean;
    large?: boolean;
    sign?: '+' | '-';
  }) => (
    <View style={[styles.resultLine, indent && { paddingLeft: 20 }]}>
      <Text style={[styles.resultLineLabel, bold && { fontWeight: '700' }]}>
        {sign === '-' ? '(-) ' : '(+) '}{label}
      </Text>
      <Text
        style={[
          styles.resultLineValue,
          { color: color ?? COLORS.text },
          bold && { fontWeight: '800' },
          large && { fontSize: 18 },
        ]}
      >
        {sign === '-' && value > 0 ? '- ' : ''}{formatCurrency(value)}
      </Text>
    </View>
  );

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        {/* Tabs */}
        <View style={styles.tabRow}>
          <TouchableOpacity
            style={[styles.tab, tab === 'SEVERANCE' && styles.tabActive]}
            onPress={() => setTab('SEVERANCE')}
          >
            <MaterialCommunityIcons
              name="briefcase-check"
              size={18}
              color={tab === 'SEVERANCE' ? COLORS.highlight : COLORS.textSecondary}
            />
            <Text style={[styles.tabText, tab === 'SEVERANCE' && styles.tabTextActive]}>
              Rescisão
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tab, tab === 'VACATION' && styles.tabActive]}
            onPress={() => setTab('VACATION')}
          >
            <MaterialCommunityIcons
              name="beach"
              size={18}
              color={tab === 'VACATION' ? COLORS.highlight : COLORS.textSecondary}
            />
            <Text style={[styles.tabText, tab === 'VACATION' && styles.tabTextActive]}>
              Férias
            </Text>
          </TouchableOpacity>
        </View>

        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          {tab === 'SEVERANCE' && (
            <>
              <View style={styles.card}>
                <NumberInput label="Salário Bruto (R$)" value={sevSalary} onChange={(v) => { setSevSalary(v); setSevCalc(false); }} placeholder="Ex: 3000,00" />
                <NumberInput label="Anos Trabalhados" value={sevYears} onChange={(v) => { setSevYears(v); setSevCalc(false); }} placeholder="Ex: 2" />
                <NumberInput label="Meses (além dos anos)" value={sevMonths} onChange={(v) => { setSevMonths(v); setSevCalc(false); }} placeholder="0" />
                <NumberInput label="Dias Trabalhados no Mês Atual" value={sevDays} onChange={(v) => { setSevDays(v); setSevCalc(false); }} placeholder="Ex: 15" />
                <NumberInput label="Dias de Férias Vencidos (0 se quitadas)" value={sevVacDays} onChange={(v) => { setSevVacDays(v); setSevCalc(false); }} placeholder="0" />
                <NumberInput label="Saldo do FGTS (R$)" value={sevFgts} onChange={(v) => { setSevFgts(v); setSevCalc(false); }} placeholder="Ex: 5000,00" />
              </View>

              {/* Dismissal Type */}
              <Text style={styles.sectionLabel}>Tipo de Rescisão</Text>
              <View style={styles.dismissalGrid}>
                {DISMISSAL_TYPES.map((dt) => (
                  <TouchableOpacity
                    key={dt.value}
                    style={[
                      styles.dismissalBtn,
                      sevDismissal === dt.value && styles.dismissalBtnActive,
                    ]}
                    onPress={() => { setSevDismissal(dt.value); setSevCalc(false); }}
                  >
                    <Text style={[styles.dismissalLabel, sevDismissal === dt.value && styles.dismissalLabelActive]}>
                      {dt.label}
                    </Text>
                    <Text style={styles.dismissalDesc}>{dt.desc}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              {sevDismissal === 'SEM_JUSTA_CAUSA' && (
                <TouchableOpacity
                  style={styles.checkRow}
                  onPress={() => { setSevPriorWorked(!sevPriorWorked); setSevCalc(false); }}
                >
                  <MaterialCommunityIcons
                    name={sevPriorWorked ? 'checkbox-marked' : 'checkbox-blank-outline'}
                    size={22}
                    color={sevPriorWorked ? COLORS.highlight : COLORS.textSecondary}
                  />
                  <Text style={styles.checkLabel}>Aviso prévio trabalhado (não indenizado)</Text>
                </TouchableOpacity>
              )}

              <TouchableOpacity
                style={[styles.calcBtn, !sevSalary && styles.calcBtnDisabled]}
                onPress={() => setSevCalc(true)}
                disabled={!sevSalary}
              >
                <MaterialCommunityIcons name="calculator" size={20} color="#fff" />
                <Text style={styles.calcBtnText}>Calcular Rescisão</Text>
              </TouchableOpacity>

              {severanceResult && (
                <View style={styles.resultsCard}>
                  <Text style={styles.resultsTitle}>Verbas Rescisórias</Text>
                  <ResultLine label="Saldo de Salário" value={severanceResult.salaryBalance} color={COLORS.success} />
                  {severanceResult.priorNotice > 0 && (
                    <ResultLine label="Aviso Prévio Indenizado" value={severanceResult.priorNotice} color={COLORS.success} />
                  )}
                  {severanceResult.thirteenthSalary > 0 && (
                    <ResultLine label="13º Salário Proporcional" value={severanceResult.thirteenthSalary} color={COLORS.success} />
                  )}
                  {severanceResult.vacationBalance > 0 && (
                    <ResultLine label="Férias Proporcionais" value={severanceResult.vacationBalance} color={COLORS.success} />
                  )}
                  {severanceResult.vacationThird > 0 && (
                    <ResultLine label="1/3 sobre Férias" value={severanceResult.vacationThird} color={COLORS.success} />
                  )}
                  {severanceResult.fgtsFine > 0 && (
                    <ResultLine label="Multa do FGTS" value={severanceResult.fgtsFine} color={COLORS.success} />
                  )}
                  <View style={styles.divider} />
                  <ResultLine label="Total Bruto" value={severanceResult.total} bold />
                  <ResultLine label="INSS" value={severanceResult.inss} color={COLORS.error} sign="-" />
                  <ResultLine label="IRRF" value={severanceResult.ir} color={severanceResult.ir === 0 ? COLORS.success : COLORS.error} sign="-" />
                  <View style={styles.divider} />
                  <View style={styles.netRow}>
                    <Text style={styles.netLabel}>(=) Total Líquido</Text>
                    <Text style={styles.netValue}>{formatCurrency(severanceResult.netTotal)}</Text>
                  </View>
                </View>
              )}
            </>
          )}

          {tab === 'VACATION' && (
            <>
              <View style={styles.card}>
                <NumberInput label="Salário Bruto (R$)" value={vacSalary} onChange={(v) => { setVacSalary(v); setVacCalc(false); }} placeholder="Ex: 3000,00" />
                <NumberInput label="Meses do Período Aquisitivo (1-12)" value={vacMonths} onChange={(v) => { setVacMonths(v); setVacCalc(false); }} placeholder="12" />
                <NumberInput label="Dias para Venda (Abono Pecuniário, máx 10)" value={vacSellDays} onChange={(v) => { setVacSellDays(v); setVacCalc(false); }} placeholder="0" />
              </View>

              <View style={[styles.alertBox, { borderLeftColor: COLORS.info, backgroundColor: `${COLORS.info}10` }]}>
                <MaterialCommunityIcons name="information" size={18} color={COLORS.info} />
                <Text style={[styles.alertText, { color: COLORS.text }]}>
                  O funcionário pode converter até 1/3 das férias (10 dias) em abono pecuniário.
                  Período aquisitivo de 12 meses = direito a 30 dias de férias + 1/3 constitucional.
                </Text>
              </View>

              <TouchableOpacity
                style={[styles.calcBtn, !vacSalary && styles.calcBtnDisabled]}
                onPress={() => setVacCalc(true)}
                disabled={!vacSalary}
              >
                <MaterialCommunityIcons name="calculator" size={20} color="#fff" />
                <Text style={styles.calcBtnText}>Calcular Férias</Text>
              </TouchableOpacity>

              {vacationResult && (
                <View style={styles.resultsCard}>
                  <Text style={styles.resultsTitle}>Demonstrativo de Férias</Text>
                  <View style={styles.daysRow}>
                    <Text style={styles.daysLabel}>Dias de Gozo</Text>
                    <Text style={styles.daysValue}>{vacationResult.totalDays - (parseInt(vacSellDays, 10) || 0)} dias</Text>
                    {(parseInt(vacSellDays, 10) || 0) > 0 && (
                      <>
                        <Text style={styles.daysLabel}>Dias Vendidos</Text>
                        <Text style={styles.daysValue}>{Math.min(parseInt(vacSellDays, 10) || 0, 10)} dias</Text>
                      </>
                    )}
                  </View>
                  <View style={styles.divider} />
                  <ResultLine label="Férias Brutas" value={vacationResult.vacationGross} color={COLORS.success} />
                  <ResultLine label="1/3 Constitucional" value={vacationResult.vacationThird} color={COLORS.success} />
                  {vacationResult.pecuniary > 0 && (
                    <ResultLine label="Abono Pecuniário" value={vacationResult.pecuniary} color={COLORS.success} />
                  )}
                  <View style={styles.divider} />
                  <ResultLine label="INSS" value={vacationResult.inss} color={COLORS.error} sign="-" />
                  <ResultLine label="IRRF" value={vacationResult.ir} color={vacationResult.ir === 0 ? COLORS.success : COLORS.error} sign="-" />
                  <View style={styles.divider} />
                  <View style={styles.netRow}>
                    <Text style={styles.netLabel}>(=) Férias Líquidas</Text>
                    <Text style={styles.netValue}>{formatCurrency(vacationResult.netValue)}</Text>
                  </View>
                </View>
              )}
            </>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  tabRow: {
    flexDirection: 'row',
    backgroundColor: COLORS.card,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  tabActive: { borderBottomColor: COLORS.highlight },
  tabText: { fontSize: 14, fontWeight: '600', color: COLORS.textSecondary },
  tabTextActive: { color: COLORS.highlight },
  content: { padding: 16, paddingBottom: 40 },
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
    fontSize: 17,
    color: COLORS.text,
    borderWidth: 1,
    borderColor: COLORS.border,
    fontWeight: '600',
  },
  sectionLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 10,
    marginTop: 4,
  },
  dismissalGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 12,
  },
  dismissalBtn: {
    width: '48%',
    borderWidth: 1.5,
    borderColor: COLORS.border,
    borderRadius: 12,
    padding: 12,
    backgroundColor: COLORS.card,
  },
  dismissalBtnActive: {
    borderColor: COLORS.highlight,
    backgroundColor: `${COLORS.highlight}12`,
  },
  dismissalLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.textSecondary,
    marginBottom: 2,
  },
  dismissalLabelActive: { color: COLORS.highlight },
  dismissalDesc: { fontSize: 10, color: COLORS.textLight },
  checkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 10,
    marginBottom: 12,
  },
  checkLabel: { fontSize: 14, color: COLORS.text },
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
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.07,
    shadowRadius: 6,
    elevation: 2,
    marginBottom: 16,
  },
  resultsTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.text,
    marginBottom: 14,
    textAlign: 'center',
  },
  resultLine: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 7,
  },
  resultLineLabel: { fontSize: 13, color: COLORS.text, flex: 1 },
  resultLineValue: { fontSize: 14, fontWeight: '600' },
  divider: {
    height: 1,
    backgroundColor: COLORS.border,
    marginVertical: 8,
  },
  netRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 12,
    backgroundColor: `${COLORS.success}12`,
    borderRadius: 10,
    marginTop: 4,
  },
  netLabel: { fontSize: 16, fontWeight: '700', color: COLORS.text },
  netValue: { fontSize: 22, fontWeight: '900', color: COLORS.success },
  daysRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: COLORS.background,
    borderRadius: 10,
    padding: 12,
    marginBottom: 8,
  },
  daysLabel: { fontSize: 12, color: COLORS.textSecondary },
  daysValue: { fontSize: 14, fontWeight: '700', color: COLORS.text, marginRight: 10 },
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
});
