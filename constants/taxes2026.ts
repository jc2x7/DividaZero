// ============================================================
// Tabelas Tributárias Brasileiras 2026
// Fonte: Reforma Tributária / Medidas Provisórias vigentes
// ============================================================

export interface TaxBracket {
  max: number;
  rate: number;
  deduction: number;
}

// Tabela Progressiva INSS 2026
// Alíquotas progressivas por faixa de salário de contribuição
export const INSS_TABLE_2026: TaxBracket[] = [
  { max: 1621.00, rate: 0.075, deduction: 0 },
  { max: 2902.84, rate: 0.09, deduction: 24.32 },
  { max: 4354.27, rate: 0.12, deduction: 111.40 },
  { max: 8475.55, rate: 0.14, deduction: 198.49 },
];

export const INSS_CEILING_2026 = 8475.55;

// Tabela IRRF 2026 (base = salário bruto - INSS - outras deduções)
// Isenção total para rendimentos até R$ 5.000,00
// Redutor progressivo para faixas entre R$ 5.000,01 e R$ 7.350,00
export const IRRF_TABLE_2026: TaxBracket[] = [
  { max: 5000.00, rate: 0, deduction: 0 },
  { max: 7000.00, rate: 0.075, deduction: 375.00 },
  { max: 9000.00, rate: 0.15, deduction: 900.00 },
  { max: 12000.00, rate: 0.225, deduction: 1575.00 },
  { max: Infinity, rate: 0.275, deduction: 2175.00 },
];

// Limite de isenção total do IR 2026
export const IR_EXEMPT_LIMIT_2026 = 5000.00;

// Limite até onde o redutor progressivo atua
export const IR_REDUCER_LIMIT_2026 = 7350.00;

// Redutor máximo para faixas entre 5k e 7.35k
export const IR_REDUCER_MAX_2026 = 312.89;

// Salário mínimo nacional 2026
export const MINIMUM_WAGE_2026 = 1518.00;

// Dedução por dependente no IRRF
export const IRRF_DEPENDENT_DEDUCTION_2026 = 189.59;

// Dedução para despesas com instrução (limite anual)
export const IRRF_EDUCATION_DEDUCTION_ANNUAL_2026 = 3561.50;

// Teto de contribuição FGTS (8% sobre salário)
export const FGTS_RATE = 0.08;

// Multa FGTS em demissão sem justa causa
export const FGTS_FINE_RATE = 0.40;

// Multa FGTS em acordo consensual (art. 484-A CLT)
export const FGTS_FINE_CONSENSUAL_RATE = 0.20;

// Aviso prévio base (30 dias + 3 dias por ano trabalhado, máx 90 dias)
export const PRIOR_NOTICE_BASE_DAYS = 30;
export const PRIOR_NOTICE_EXTRA_DAYS_PER_YEAR = 3;
export const PRIOR_NOTICE_MAX_DAYS = 90;
