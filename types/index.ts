export type AmortizationType = 'PRICE' | 'SAC';

/**
 * FIXED       → recorrente, se repete todo mês (aluguel, academia)
 * INSTALLMENT → compra parcelada, tem fim previsto (celular em 12x)
 * VARIABLE    → gasto avulso, existe só no mês em que foi lançado
 */
export type ExpenseType = 'FIXED' | 'INSTALLMENT' | 'VARIABLE';

/** Alcance de uma exclusão/edição de lançamento recorrente ou parcelado. */
export type DeleteScope = 'one' | 'future' | 'all';
/** Chaves das categorias originais. Continuam existindo, mas não são mais o limite. */
export type BuiltinCategory =
  | 'RENT'
  | 'CAR'
  | 'GYM'
  | 'FOOD'
  | 'HEALTH'
  | 'EDUCATION'
  | 'ENTERTAINMENT'
  | 'TRANSPORT'
  | 'UTILITIES'
  | 'INVESTMENT'
  | 'OTHER';

/**
 * Categoria de um lançamento. É `string` porque o usuário pode criar as suas —
 * as chaves personalizadas têm o formato `CUSTOM_<id>`.
 */
export type ExpenseCategory = string;

export interface Expense {
  id: number;
  name: string;
  category: ExpenseCategory;
  amount: number;
  type: ExpenseType;
  installments_total: number;
  installments_current: number;
  start_date: string;
  end_date?: string;
  year: number;
  month: number;
  is_active: number;
  parent_id?: number;
  notes?: string;
  due_day?: number;        // dia do mês de vencimento (1-31)
  alert_enabled?: number;  // 1 = alerta 1 dia antes às 15h ativado
  is_paid?: number;        // 1 = pago, 0 = pendente
  notification_id?: string;
  is_income?: number;      // 1 = entrada de dinheiro, 0 = despesa
  /**
   * Liga todas as ocorrências de um mesmo lançamento: as 12 parcelas de uma
   * compra, os 60 meses de uma despesa fixa. É o que permite apagar ou editar
   * a compra inteira em vez de um mês solto.
   */
  group_id?: string;
  /**
   * 1 quando esta parcela foi marcada no plano para ser quitada com o dinheiro
   * extra. Ela continua devida, mas não sai do orçamento do mês — por isso fica
   * fora dos totais do painel.
   */
  planned_payoff?: number;
}

/**
 * Simulação de quitação salva de uma compra parcelada.
 *
 * `last_quote` é a proposta que o credor deu, com a data em que foi dada —
 * ela perde validade conforme os vencimentos se aproximam. `monthly_rate` é o
 * que se extrai dela e continua valendo: é a taxa do contrato.
 */
export interface PayoffQuote {
  group_id: string;
  last_quote: number | null;
  /** 'YYYY-MM-DD' em que a proposta foi informada. */
  quoted_at: string | null;
  /** Dias que faltavam para a última parcela quando a proposta foi dada. */
  days_to_last: number | null;
  monthly_rate: number | null;
  updated_at?: string;
}

/** Parcela marcada para ser paga com o dinheiro extra de um mês. */
export interface PayoffSelection {
  expense_id: number;
  group_id: string;
  /** Mês de onde sai o dinheiro, 'YYYY-MM'. */
  month: string;
  /** Valor descontado no momento da escolha. */
  amount: number;
  created_at?: string;
}

/**
 * Dívida do planejador: um saldo devedor sem parcela fixa, que a pessoa vai
 * abatendo no ritmo que consegue. O que não for pago passa para o mês seguinte.
 */
export interface PlanDebt {
  id: number;
  name: string;
  /** Valor original da dívida, no mês em que ela entrou. */
  amount: number;
  category: string;
  /** 'YYYY-MM' em que a dívida passa a existir. */
  start_month: string;
  notes?: string;
  is_archived: number;
  created_at?: string;
}

export interface PlanPayment {
  debt_id: number;
  month: string;
  /** Percentual do saldo de abertura do mês que foi abatido. */
  percent: number;
}

/** Situação de uma dívida em um mês do planejador. */
export interface PlanRow {
  debt: PlanDebt;
  saldoInicial: number;
  percent: number;
  pago: number;
  saldoFinal: number;
  quitadaAntes: boolean;
}

export interface PlanMonth {
  month: string;
  linhas: PlanRow[];
  totalPago: number;
  totalRestante: number;
  totalOriginal: number;
}

export interface Category {
  key: string;
  label: string;
  icon: string;
  color: string;
  sort_order: number;
  /** 1 = uma das categorias originais; não pode ser excluída, só arquivada. */
  is_builtin: number;
  is_archived: number;
}

export interface Goal {
  id: number;
  name: string;
  target_amount: number;
  icon: string;
  color: string;
  /** 'YYYY-MM' — mês em que a pessoa quer ter concluído. */
  deadline?: string;
  /** Aporte mensal planejado, se a pessoa definiu um. */
  monthly_target?: number;
  notes?: string;
  is_archived: number;
  created_at?: string;
  /** Soma dos aportes — vem calculada da consulta, não é coluna. */
  saved: number;
}

export interface GoalContribution {
  id: number;
  goal_id: number;
  /** Negativo representa uma retirada. */
  amount: number;
  date: string;
  note?: string;
  created_at?: string;
}

export interface Salary {
  id: number;
  amount: number;
  other_income: number;
  year: number;
  month: number;
  notes?: string;
}

export interface LoanPerson {
  id: number;
  name: string;
  phone: string;
  total_amount: number;
  monthly_interest: number;
  installments: number;
  installments_paid: number;
  start_date: string;
  payment_day: number;
  notes?: string;
  notification_id?: string;
  is_active: number;
}

export interface AmortizationRow {
  period: number;
  payment: number;
  interest: number;
  amortization: number;
  balance: number;
}

export interface AmortizationResult {
  rows: AmortizationRow[];
  totalInterest: number;
  totalPayment: number;
  monthlyPayment?: number;
}

export interface INSSDetail {
  range: string;
  rate: number;
  amount: number;
}

export interface SalaryCalculation {
  grossSalary: number;
  inss: number;
  irBase: number;
  ir: number;
  netSalary: number;
  inssDetails: INSSDetail[];
  isExempt: boolean;
}

export interface SeveranceCalculation {
  salaryBalance: number;
  priorNotice: number;
  thirteenthSalary: number;
  vacationBalance: number;
  vacationThird: number;
  fgtsBalance: number;
  fgtsFine: number;
  total: number;
  inss: number;
  ir: number;
  netTotal: number;
}

export interface VacationCalculation {
  vacationGross: number;
  vacationThird: number;
  pecuniary: number;
  inss: number;
  ir: number;
  netValue: number;
  totalDays: number;
}

export interface MonthSummary {
  year: number;
  month: number;
  salary: number;
  otherIncome: number;
  totalExpenses: number;
  balance: number;
  expenses: Expense[];
  categoryBreakdown: { category: ExpenseCategory; total: number }[];
  paidTotal: number;
  unpaidTotal: number;

  /** Totais por natureza da despesa — a separação que o dashboard mostra. */
  fixedTotal: number;
  installmentTotal: number;
  variableTotal: number;
  /** Percentual da renda comprometido com despesas (0–100+). */
  commitment: number;
  totalIncome: number;
  /** Despesas vencidas e ainda não pagas neste mês. */
  overdueTotal: number;
  overdueCount: number;

  /**
   * Parcelas marcadas no plano para serem quitadas com o dinheiro extra.
   * Ficam fora de `totalExpenses` — o valor não sai do orçamento do mês.
   */
  plannedPayoffTotal: number;
  plannedPayoffCount: number;
}

/** Uma dívida parcelada em aberto, na visão do plano de quitação. */
export interface PayoffDebt {
  groupId: string;
  name: string;
  category: ExpenseCategory;
  installmentAmount: number;
  remainingCount: number;
  remainingTotal: number;
  installmentsTotal: number;
  /** Índice absoluto (ano*12+mês-1) da última parcela prevista. */
  lastIndex: number;
  nextIndex: number;
}

export type PayoffStrategy = 'SNOWBALL' | 'AVALANCHE';

export interface PayoffStep {
  debt: PayoffDebt;
  /** Índice absoluto do mês em que esta dívida é quitada no plano. */
  payoffIndex: number;
  /** Meses economizados em relação ao cronograma original. */
  monthsSaved: number;
  order: number;
}

export interface PayoffPlan {
  strategy: PayoffStrategy;
  /** Valor extra planejado para cada mês, indexado por 'YYYY-MM'. */
  extras: Record<string, number>;
  /** Soma de todos os extras planejados. */
  extraTotal: number;
  steps: PayoffStep[];
  /**
   * Dívida que recebe o dinheiro extra agora. Não é necessariamente a primeira
   * a ser quitada: outra pode terminar antes só de pagar as parcelas normais.
   */
  focusGroupId: string | null;
  /** Índice absoluto do mês em que fica sem parcelas. */
  freeIndex: number | null;
  baselineFreeIndex: number | null;
  totalDebt: number;
  monthsSaved: number;
}
