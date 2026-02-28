// ============================================================
// Tabelas Tributárias Brasileiras 2025/2026
// Fonte: Receita Federal / IN RFB vigente
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

// Tabela IRRF vigente (base = salário bruto - INSS - deduções)
// Isenção: até R$ 2.259,20
// Fonte: IN RFB 2.203/2024 e tabela progressiva em vigor
export const IRRF_TABLE_2026: TaxBracket[] = [
  { max: 2259.20,  rate: 0,     deduction: 0       },
  { max: 2826.65,  rate: 0.075, deduction: 169.44  },
  { max: 3751.05,  rate: 0.15,  deduction: 381.44  },
  { max: 4664.68,  rate: 0.225, deduction: 662.77  },
  { max: Infinity, rate: 0.275, deduction: 908.73  },
];

// Limite de isenção do IR (tabela vigente)
export const IR_EXEMPT_LIMIT_2026 = 2259.20;

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
