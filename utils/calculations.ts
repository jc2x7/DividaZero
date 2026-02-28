import {
  INSS_TABLE_2026,
  INSS_CEILING_2026,
  IRRF_TABLE_2026,
  IR_EXEMPT_LIMIT_2026,
  IR_REDUCER_LIMIT_2026,
  IR_REDUCER_MAX_2026,
  FGTS_RATE,
  FGTS_FINE_RATE,
  FGTS_FINE_CONSENSUAL_RATE,
  PRIOR_NOTICE_BASE_DAYS,
  PRIOR_NOTICE_EXTRA_DAYS_PER_YEAR,
  PRIOR_NOTICE_MAX_DAYS,
} from '../constants/taxes2026';
import {
  AmortizationResult,
  AmortizationRow,
  SalaryCalculation,
  SeveranceCalculation,
  VacationCalculation,
} from '../types';

// ============================================================
// AMORTIZAÇÃO - Tabela Price (Sistema Francês)
// Prestações fixas, juros decrescentes, amortização crescente
// ============================================================
export function calculatePrice(
  principal: number,
  monthlyRate: number,
  periods: number
): AmortizationResult {
  if (monthlyRate === 0) {
    const payment = principal / periods;
    const rows: AmortizationRow[] = Array.from({ length: periods }, (_, i) => ({
      period: i + 1,
      payment,
      interest: 0,
      amortization: payment,
      balance: principal - payment * (i + 1),
    }));
    return { rows, totalInterest: 0, totalPayment: principal, monthlyPayment: payment };
  }

  const i = monthlyRate / 100;
  const factor = Math.pow(1 + i, periods);
  const monthlyPayment = principal * (i * factor) / (factor - 1);

  const rows: AmortizationRow[] = [];
  let balance = principal;
  let totalInterest = 0;

  for (let k = 1; k <= periods; k++) {
    const interest = balance * i;
    const amortization = monthlyPayment - interest;
    balance = Math.max(0, balance - amortization);
    totalInterest += interest;
    rows.push({
      period: k,
      payment: monthlyPayment,
      interest,
      amortization,
      balance,
    });
  }

  return {
    rows,
    totalInterest,
    totalPayment: monthlyPayment * periods,
    monthlyPayment,
  };
}

// ============================================================
// AMORTIZAÇÃO - SAC (Sistema de Amortização Constante)
// Amortização fixa, prestações decrescentes
// ============================================================
export function calculateSAC(
  principal: number,
  monthlyRate: number,
  periods: number
): AmortizationResult {
  const i = monthlyRate / 100;
  const amortization = principal / periods;

  const rows: AmortizationRow[] = [];
  let balance = principal;
  let totalInterest = 0;
  let totalPayment = 0;

  for (let k = 1; k <= periods; k++) {
    const interest = balance * i;
    const payment = amortization + interest;
    balance = Math.max(0, balance - amortization);
    totalInterest += interest;
    totalPayment += payment;
    rows.push({
      period: k,
      payment,
      interest,
      amortization,
      balance,
    });
  }

  return { rows, totalInterest, totalPayment };
}

// ============================================================
// CÁLCULO DE INSS PROGRESSIVO 2026
// ============================================================
function calculateINSS(grossSalary: number): { total: number; details: { range: string; rate: number; amount: number }[] } {
  const base = Math.min(grossSalary, INSS_CEILING_2026);
  let totalINSS = 0;
  const details: { range: string; rate: number; amount: number }[] = [];
  let previousMax = 0;

  for (const bracket of INSS_TABLE_2026) {
    if (base <= previousMax) break;
    const taxableInRange = Math.min(base, bracket.max) - previousMax;
    if (taxableInRange <= 0) break;
    const amount = taxableInRange * bracket.rate;
    totalINSS += amount;
    details.push({
      range: bracket.max === Infinity
        ? `Acima de R$ ${previousMax.toFixed(2)}`
        : `Até R$ ${bracket.max.toFixed(2)}`,
      rate: bracket.rate * 100,
      amount,
    });
    previousMax = bracket.max;
  }

  return { total: totalINSS, details };
}

// ============================================================
// CÁLCULO DO IRRF 2026
// Isenção total até R$ 5.000,00
// Redutor progressivo entre R$ 5.000,01 e R$ 7.350,00
// ============================================================
function calculateIRRF(irBase: number): number {
  if (irBase <= IR_EXEMPT_LIMIT_2026) return 0;

  // Encontra faixa da tabela
  let ir = 0;
  for (const bracket of IRRF_TABLE_2026) {
    if (irBase <= bracket.max) {
      ir = irBase * bracket.rate - bracket.deduction;
      break;
    }
  }

  // Aplica redutor progressivo para faixas entre 5k e 7.35k
  if (irBase > IR_EXEMPT_LIMIT_2026 && irBase <= IR_REDUCER_LIMIT_2026) {
    // Redutor decrescente: máximo de R$ 312,89 em R$ 5.000,01 diminuindo até 0 em R$ 7.350,00
    const reducerFactor = 1 - (irBase - IR_EXEMPT_LIMIT_2026) / (IR_REDUCER_LIMIT_2026 - IR_EXEMPT_LIMIT_2026);
    const reducer = IR_REDUCER_MAX_2026 * reducerFactor;
    ir = Math.max(0, ir - reducer);
  }

  return Math.max(0, ir);
}

// ============================================================
// CÁLCULO DE SALÁRIO LÍQUIDO 2026
// ============================================================
export function calculateNetSalary(
  grossSalary: number,
  dependents = 0,
  otherDeductions = 0
): SalaryCalculation {
  const { total: inss, details: inssDetails } = calculateINSS(grossSalary);

  // Dedução por dependente
  const dependentDeduction = dependents * 189.59;

  // Base de cálculo do IR = salário bruto - INSS - dependentes - outras deduções
  const irBase = Math.max(0, grossSalary - inss - dependentDeduction - otherDeductions);

  const ir = calculateIRRF(irBase);
  const netSalary = grossSalary - inss - ir;

  return {
    grossSalary,
    inss,
    irBase,
    ir,
    netSalary,
    inssDetails,
    isExempt: irBase <= IR_EXEMPT_LIMIT_2026,
  };
}

// ============================================================
// CÁLCULO DE RESCISÃO (CLT)
// ============================================================
export type DismissalType = 'SEM_JUSTA_CAUSA' | 'PEDIDO_DEMISSAO' | 'ACORDO_CONSENSUAL' | 'JUSTA_CAUSA';

export function calculateSeverance(
  grossSalary: number,
  yearsWorked: number,
  monthsWorked: number,
  daysWorked: number,
  vacationDaysAcquired: number,
  fgtsBalance: number,
  dismissalType: DismissalType,
  priorNoticeWorked: boolean
): SeveranceCalculation {
  const totalMonths = yearsWorked * 12 + monthsWorked;

  // Saldo de salário (dias trabalhados no mês / 30)
  const salaryBalance = (grossSalary / 30) * daysWorked;

  // Aviso prévio
  const priorNoticeDays = Math.min(
    PRIOR_NOTICE_BASE_DAYS + yearsWorked * PRIOR_NOTICE_EXTRA_DAYS_PER_YEAR,
    PRIOR_NOTICE_MAX_DAYS
  );
  let priorNotice = 0;
  if (dismissalType === 'SEM_JUSTA_CAUSA' && !priorNoticeWorked) {
    priorNotice = (grossSalary / 30) * priorNoticeDays;
  }

  // 13º salário proporcional
  const thirteenthSalary =
    dismissalType !== 'JUSTA_CAUSA'
      ? (grossSalary / 12) * (totalMonths % 12 || 12)
      : 0;

  // Férias proporcionais (períodos aquisitivos incompletos)
  const vacationMonths = Math.floor((totalMonths % 12));
  const vacationBalance =
    dismissalType !== 'JUSTA_CAUSA'
      ? (grossSalary / 12) * vacationMonths
      : 0;

  // 1/3 sobre férias
  const vacationThird = vacationBalance / 3;

  // Férias vencidas (se existirem)
  const vacationOwed = (grossSalary + grossSalary / 3) * (vacationDaysAcquired / 30);

  // Multa FGTS
  let fgtsFine = 0;
  if (dismissalType === 'SEM_JUSTA_CAUSA') {
    fgtsFine = fgtsBalance * FGTS_FINE_RATE;
  } else if (dismissalType === 'ACORDO_CONSENSUAL') {
    fgtsFine = fgtsBalance * FGTS_FINE_CONSENSUAL_RATE;
  }

  const grossTotal =
    salaryBalance + priorNotice + thirteenthSalary + vacationBalance + vacationThird + vacationOwed + fgtsFine;

  // Incidência de INSS e IR sobre verbas tributáveis
  const tributaryBase = salaryBalance + priorNotice + thirteenthSalary;
  const { total: inss } = calculateINSS(tributaryBase);
  const irBase = Math.max(0, tributaryBase - inss);
  const ir = calculateIRRF(irBase);

  return {
    salaryBalance,
    priorNotice,
    thirteenthSalary,
    vacationBalance,
    vacationThird,
    fgtsBalance,
    fgtsFine,
    total: grossTotal,
    inss,
    ir,
    netTotal: grossTotal - inss - ir,
  };
}

// ============================================================
// CÁLCULO DE FÉRIAS (CLT + 1/3 Constitucional)
// ============================================================
export function calculateVacation(
  grossSalary: number,
  monthsAcquired: number,
  sellDays = 0
): VacationCalculation {
  const totalDays = Math.floor((30 / 12) * monthsAcquired);
  const workDays = totalDays - sellDays;

  // Férias brutas proporcionais aos dias de gozo
  const vacationGross = (grossSalary / 30) * workDays;

  // 1/3 constitucional
  const vacationThird = vacationGross / 3;

  // Abono pecuniário (venda de dias) - máx 10 dias
  const pecuniary = sellDays > 0 ? (grossSalary / 30) * Math.min(sellDays, 10) * (4 / 3) : 0;

  const tributaryBase = vacationGross + vacationThird + pecuniary;

  const { total: inss } = calculateINSS(tributaryBase);
  const irBase = Math.max(0, tributaryBase - inss);
  const ir = calculateIRRF(irBase);

  return {
    vacationGross,
    vacationThird,
    pecuniary,
    inss,
    ir,
    netValue: tributaryBase - inss - ir,
    totalDays,
  };
}

// ============================================================
// CALCULAR VALOR DO EMPRÉSTIMO COM JUROS COMPOSTOS
// ============================================================
export function calculateLoanBalance(
  principal: number,
  monthlyInterest: number,
  monthsPassed: number
): number {
  if (monthlyInterest === 0) return principal;
  return principal * Math.pow(1 + monthlyInterest / 100, monthsPassed);
}

// ============================================================
// CALCULAR PARCELA DO EMPRÉSTIMO
// ============================================================
export function calculateLoanInstallment(
  principal: number,
  monthlyInterest: number,
  installments: number
): number {
  if (monthlyInterest === 0) return principal / installments;
  const i = monthlyInterest / 100;
  const factor = Math.pow(1 + i, installments);
  return principal * (i * factor) / (factor - 1);
}
