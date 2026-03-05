import { useState, useEffect, useCallback } from 'react';
import {
  getExpensesForMonth,
  getIncomesForMonth,
  getEffectiveSalary,
} from '../database/database';
import { Expense, Salary, MonthSummary, ExpenseCategory } from '../types';
import { CATEGORIES } from '../constants/categories';

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

  const totalExpenses = expenses.reduce((sum, e) => sum + e.amount, 0);
  const paidTotal = expenses.filter((e) => e.is_paid === 1).reduce((sum, e) => sum + e.amount, 0);
  const totalExtraIncome = incomes.reduce((sum, i) => sum + i.amount, 0);

  const baseSalary = (salary?.amount ?? 0) + (salary?.other_income ?? 0);
  const totalIncome = baseSalary + totalExtraIncome;

  const summary: MonthSummary = {
    year,
    month,
    salary: salary?.amount ?? 0,
    otherIncome: (salary?.other_income ?? 0) + totalExtraIncome,
    totalExpenses,
    balance: totalIncome - totalExpenses,
    expenses,
    categoryBreakdown: CATEGORIES.map((cat) => ({
      category: cat.value as ExpenseCategory,
      total: expenses
        .filter((e) => e.category === cat.value)
        .reduce((sum, e) => sum + e.amount, 0),
    })).filter((c) => c.total > 0),
    paidTotal,
    unpaidTotal: totalExpenses - paidTotal,
  };

  return { expenses, incomes, salary, summary, loading, reload: load };
}
