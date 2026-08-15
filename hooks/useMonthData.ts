import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  getExpensesForMonth,
  getIncomesForMonth,
  getEffectiveSalary,
} from '../database/database';
import { Expense, Salary, MonthSummary, ExpenseCategory } from '../types';
import { monthIndex } from '../utils/formatting';

/**
 * Uma despesa está atrasada se tem dia de vencimento, não foi paga e esse dia
 * já passou. Meses inteiros no passado contam como atrasados por completo.
 */
function isOverdue(expense: Expense, year: number, month: number, now: Date): boolean {
  if (expense.is_paid) return false;
  const current = monthIndex(now.getFullYear(), now.getMonth() + 1);
  const target = monthIndex(year, month);
  if (target > current) return false;
  if (target < current) return true;
  if (!expense.due_day) return false;
  return expense.due_day < now.getDate();
}

export function useMonthData(year: number, month: number) {
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [incomes, setIncomes] = useState<Expense[]>([]);
  const [salary, setSalary] = useState<Salary | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [exp, inc, sal] = await Promise.all([
        getExpensesForMonth(year, month),
        getIncomesForMonth(year, month),
        getEffectiveSalary(year, month),
      ]);
      setExpenses(exp);
      setIncomes(inc);
      setSalary(sal);
    } finally {
      setLoading(false);
    }
  }, [year, month]);

  useEffect(() => {
    load();
  }, [load]);

  const summary = useMemo<MonthSummary>(() => {
    const now = new Date();
    const sumOf = (list: Expense[]) => list.reduce((s, e) => s + e.amount, 0);

    // Parcela marcada no plano de quitação será paga com o dinheiro extra, que
    // não vem do salário deste mês. Ela sai de todos os totais do painel — é
    // isso que faz a economia aparecer de verdade para quem planejou.
    const planejadas = expenses.filter((e) => e.planned_payoff);
    const doMes = expenses.filter((e) => !e.planned_payoff);
    const plannedPayoffTotal = sumOf(planejadas);

    const totalExpenses = sumOf(doMes);
    const paidTotal = sumOf(doMes.filter((e) => e.is_paid === 1));
    const totalExtraIncome = sumOf(incomes);

    const fixedTotal = sumOf(doMes.filter((e) => e.type === 'FIXED'));
    const installmentTotal = sumOf(doMes.filter((e) => e.type === 'INSTALLMENT'));
    // Qualquer tipo desconhecido cai em "avulso" para o total sempre fechar.
    const variableTotal = totalExpenses - fixedTotal - installmentTotal;

    const overdue = doMes.filter((e) => isOverdue(e, year, month, now));

    const baseSalary = (salary?.amount ?? 0) + (salary?.other_income ?? 0);
    const totalIncome = baseSalary + totalExtraIncome;

    return {
      year,
      month,
      salary: salary?.amount ?? 0,
      otherIncome: (salary?.other_income ?? 0) + totalExtraIncome,
      totalIncome,
      totalExpenses,
      balance: totalIncome - totalExpenses,
      expenses,
      // Derivado das próprias despesas em vez de uma lista fixa: assim
      // categorias criadas pelo usuário aparecem sem precisar de manutenção.
      plannedPayoffTotal,
      plannedPayoffCount: planejadas.length,
      categoryBreakdown: Object.entries(
        doMes.reduce<Record<string, number>>((acc, e) => {
          acc[e.category] = (acc[e.category] ?? 0) + e.amount;
          return acc;
        }, {})
      )
        .map(([category, total]) => ({ category: category as ExpenseCategory, total }))
        .filter((c) => c.total > 0)
        .sort((a, b) => b.total - a.total),
      paidTotal,
      unpaidTotal: totalExpenses - paidTotal,
      fixedTotal,
      installmentTotal,
      variableTotal,
      commitment: totalIncome > 0 ? (totalExpenses / totalIncome) * 100 : 0,
      overdueTotal: sumOf(overdue),
      overdueCount: overdue.length,
    };
  }, [expenses, incomes, salary, year, month]);

  /** Despesas agrupadas pela natureza, na ordem em que o dashboard exibe. */
  const groups = useMemo(
    () => ({
      fixed: expenses.filter((e) => e.type === 'FIXED'),
      installment: expenses.filter((e) => e.type === 'INSTALLMENT'),
      variable: expenses.filter((e) => e.type !== 'FIXED' && e.type !== 'INSTALLMENT'),
    }),
    [expenses]
  );

  return { expenses, incomes, salary, summary, groups, loading, reload: load };
}
