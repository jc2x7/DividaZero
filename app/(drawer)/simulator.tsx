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
import { calculatePrice, calculateSAC } from '../../utils/calculations';
import AmortizationTable from '../../components/AmortizationTable';

type SimType = 'PRICE' | 'SAC';

// InputField FORA do componente para não ser recriado a cada render
// (se estiver dentro, o TextInput perde o foco após cada keystroke)
function InputField({
  label,
  value,
  onChange,
  placeholder,
  suffix,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  suffix?: string;
}) {
  return (
    <View style={styles.inputGroup}>
      <Text style={styles.inputLabel}>{label}</Text>
      <View style={styles.inputRow}>
        <TextInput
          style={[styles.input, suffix ? styles.inputWithSuffix : null]}
          value={value}
          onChangeText={onChange}
          placeholder={placeholder}
          placeholderTextColor={COLORS.textLight}
          keyboardType="decimal-pad"
        />
        {suffix && (
          <View style={styles.suffix}>
            <Text style={styles.suffixText}>{suffix}</Text>
          </View>
        )}
      </View>
    </View>
  );
}

export default function SimulatorScreen() {
  const [principal, setPrincipal] = useState('');
  const [rate, setRate] = useState('');
  const [periods, setPeriods] = useState('');
  const [simType, setSimType] = useState<SimType>('PRICE');
  const [calculated, setCalculated] = useState(false);

  const principalNum = parseFloat(principal.replace(',', '.')) || 0;
  const rateNum = parseFloat(rate.replace(',', '.')) || 0;
  const periodsNum = parseInt(periods, 10) || 0;

  const result = useMemo(() => {
    if (!calculated || principalNum <= 0 || periodsNum <= 0) return null;
    return simType === 'PRICE'
      ? calculatePrice(principalNum, rateNum, periodsNum)
      : calculateSAC(principalNum, rateNum, periodsNum);
  }, [calculated, principalNum, rateNum, periodsNum, simType]);

  const handleCalculate = () => {
    if (principalNum <= 0 || periodsNum <= 0) return;
    setCalculated(true);
  };

  const handleReset = () => {
    setPrincipal('');
    setRate('');
    setPeriods('');
    setCalculated(false);
  };

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
          {/* Header Info */}
          <View style={styles.headerCard}>
            <MaterialCommunityIcons name="calculator-variant" size={32} color={COLORS.highlight} />
            <View style={styles.headerText}>
              <Text style={styles.headerTitle}>Simulador de Juros</Text>
              <Text style={styles.headerSubtitle}>
                Calcule amortizações no sistema Price ou SAC
              </Text>
            </View>
          </View>

          {/* System Type Toggle */}
          <Text style={styles.sectionLabel}>Sistema de Amortização</Text>
          <View style={styles.typeToggle}>
            <TouchableOpacity
              style={[styles.typeBtn, simType === 'PRICE' && styles.typeBtnActive]}
              onPress={() => { setSimType('PRICE'); setCalculated(false); }}
            >
              <Text style={[styles.typeBtnTitle, simType === 'PRICE' && styles.typeBtnTitleActive]}>
                Tabela Price
              </Text>
              <Text style={[styles.typeBtnDesc, simType === 'PRICE' && styles.typeBtnDescActive]}>
                Parcelas fixas
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.typeBtn, simType === 'SAC' && styles.typeBtnActive]}
              onPress={() => { setSimType('SAC'); setCalculated(false); }}
            >
              <Text style={[styles.typeBtnTitle, simType === 'SAC' && styles.typeBtnTitleActive]}>
                SAC
              </Text>
              <Text style={[styles.typeBtnDesc, simType === 'SAC' && styles.typeBtnDescActive]}>
                Parcelas decrescentes
              </Text>
            </TouchableOpacity>
          </View>

          {/* Inputs */}
          <View style={styles.card}>
            <InputField
              label="Valor do Empréstimo / Financiamento"
              value={principal}
              onChange={(v) => { setPrincipal(v); setCalculated(false); }}
              placeholder="Ex: 10000,00"
              suffix="R$"
            />
            <InputField
              label="Taxa de Juros Mensal"
              value={rate}
              onChange={(v) => { setRate(v); setCalculated(false); }}
              placeholder="Ex: 1,50"
              suffix="% a.m."
            />
            <InputField
              label="Número de Parcelas"
              value={periods}
              onChange={(v) => { setPeriods(v); setCalculated(false); }}
              placeholder="Ex: 12"
            />
          </View>

          {/* System explanation */}
          <View style={styles.infoBox}>
            <MaterialCommunityIcons name="information" size={18} color={COLORS.info} />
            <Text style={styles.infoText}>
              {simType === 'PRICE'
                ? 'Na Tabela Price, as parcelas são sempre iguais. Os juros são maiores no início e a amortização aumenta ao longo do tempo.'
                : 'No SAC, a amortização é constante. As parcelas são maiores no início e diminuem ao longo do tempo, resultando em menor custo total.'}
            </Text>
          </View>

          {/* Calculate Button */}
          <View style={styles.actionRow}>
            <TouchableOpacity
              style={[
                styles.calcBtn,
                (principalNum <= 0 || periodsNum <= 0) && styles.calcBtnDisabled,
              ]}
              onPress={handleCalculate}
              disabled={principalNum <= 0 || periodsNum <= 0}
            >
              <MaterialCommunityIcons name="calculator" size={20} color="#fff" />
              <Text style={styles.calcBtnText}>Calcular</Text>
            </TouchableOpacity>
            {calculated && (
              <TouchableOpacity style={styles.resetBtn} onPress={handleReset}>
                <MaterialCommunityIcons name="refresh" size={20} color={COLORS.textSecondary} />
              </TouchableOpacity>
            )}
          </View>

          {/* Results */}
          {result && (
            <View style={styles.resultsSection}>
              <Text style={styles.sectionLabel}>
                Resultado · {simType === 'PRICE' ? 'Tabela Price' : 'SAC'}
              </Text>

              {/* Quick stats */}
              <View style={styles.statsRow}>
                <View style={styles.statCard}>
                  <Text style={styles.statLabel}>Valor Financiado</Text>
                  <Text style={styles.statValue}>{formatCurrency(principalNum)}</Text>
                </View>
                <View style={styles.statCard}>
                  <Text style={styles.statLabel}>Taxa Anual</Text>
                  <Text style={[styles.statValue, { color: COLORS.warning }]}>
                    {((Math.pow(1 + rateNum / 100, 12) - 1) * 100).toFixed(2)}%
                  </Text>
                </View>
              </View>
              <View style={styles.statsRow}>
                <View style={styles.statCard}>
                  <Text style={styles.statLabel}>Total de Juros</Text>
                  <Text style={[styles.statValue, { color: COLORS.error }]}>
                    {formatCurrency(result.totalInterest)}
                  </Text>
                </View>
                <View style={styles.statCard}>
                  <Text style={styles.statLabel}>Custo Efetivo Total</Text>
                  <Text style={[styles.statValue, { color: COLORS.info }]}>
                    {formatCurrency(result.totalPayment)}
                  </Text>
                </View>
              </View>

              {/* Amortization Table */}
              <Text style={[styles.sectionLabel, { marginTop: 8 }]}>
                Tabela de Amortização
              </Text>
              <AmortizationTable
                rows={result.rows}
                type={simType}
                totalInterest={result.totalInterest}
                totalPayment={result.totalPayment}
                monthlyPayment={result.monthlyPayment}
              />
            </View>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  content: {
    padding: 16,
    paddingBottom: 40,
  },
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
  headerText: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.text,
  },
  headerSubtitle: {
    fontSize: 13,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  sectionLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 10,
  },
  typeToggle: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 16,
  },
  typeBtn: {
    flex: 1,
    borderWidth: 1.5,
    borderColor: COLORS.border,
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 12,
    backgroundColor: COLORS.card,
  },
  typeBtnActive: {
    borderColor: COLORS.highlight,
    backgroundColor: `${COLORS.highlight}12`,
  },
  typeBtnTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: COLORS.textSecondary,
  },
  typeBtnTitleActive: {
    color: COLORS.highlight,
  },
  typeBtnDesc: {
    fontSize: 11,
    color: COLORS.textLight,
    marginTop: 2,
  },
  typeBtnDescActive: {
    color: `${COLORS.highlight}aa`,
  },
  card: {
    backgroundColor: COLORS.card,
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  inputGroup: {
    marginBottom: 16,
  },
  inputLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.textSecondary,
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  inputRow: {
    flexDirection: 'row',
    borderWidth: 1.5,
    borderColor: COLORS.border,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: COLORS.background,
  },
  input: {
    flex: 1,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 18,
    color: COLORS.text,
    fontWeight: '600',
  },
  inputWithSuffix: {
    borderRightWidth: 0,
  },
  suffix: {
    backgroundColor: `${COLORS.border}80`,
    paddingHorizontal: 14,
    justifyContent: 'center',
    borderLeftWidth: 1,
    borderLeftColor: COLORS.border,
  },
  suffixText: {
    fontSize: 12,
    color: COLORS.textSecondary,
    fontWeight: '600',
  },
  infoBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    backgroundColor: `${COLORS.info}12`,
    borderRadius: 12,
    padding: 12,
    marginBottom: 16,
    borderLeftWidth: 3,
    borderLeftColor: COLORS.info,
  },
  infoText: {
    flex: 1,
    fontSize: 12,
    color: COLORS.text,
    lineHeight: 18,
  },
  actionRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 20,
  },
  calcBtn: {
    flex: 1,
    backgroundColor: COLORS.highlight,
    borderRadius: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 16,
  },
  calcBtnDisabled: {
    opacity: 0.4,
  },
  calcBtnText: {
    color: '#fff',
    fontSize: 17,
    fontWeight: '700',
  },
  resetBtn: {
    width: 52,
    borderWidth: 1.5,
    borderColor: COLORS.border,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.card,
  },
  resultsSection: {
    gap: 0,
  },
  statsRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 10,
  },
  statCard: {
    flex: 1,
    backgroundColor: COLORS.card,
    borderRadius: 14,
    padding: 14,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 1,
  },
  statLabel: {
    fontSize: 11,
    color: COLORS.textSecondary,
    marginBottom: 6,
    textAlign: 'center',
  },
  statValue: {
    fontSize: 15,
    fontWeight: '800',
    color: COLORS.text,
    textAlign: 'center',
  },
});
