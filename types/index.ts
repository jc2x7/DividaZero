export type AmortizationType = 'PRICE' | 'SAC';
export type ExpenseType = 'FIXED' | 'INSTALLMENT';
export type ExpenseCategory =
  | 'RENT'
  | 'CAR'
  | 'GYM'
  | 'FOOD'
  | 'HEALTH'
  | 'EDUCATION'
  | 'ENTERTAINMENT'
  | 'TRANSPORT'
  | 'UTILITIES'
  | 'OTHER';

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
}
