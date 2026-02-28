import { useState, useEffect, useCallback } from 'react';
import {
  getExpensesForMonth,
  getEffectiveSalary,
  upsertSalary,
} from '../database/database';
import { Expense, Salary, MonthSummary, ExpenseCategory } from '../types';
import { CATEGORIES } from '../constants/categories';

export function useMonthData(year: number, month: number) {
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [salary, setSalary] = useState<Salary | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [exp, sal] = await Promise.all([
        getExpensesForMonth(year, month),
        getEffectiveSalary(year, month),
      ]);
      setExpenses(exp);
      setSalary(sal);
    } finally {
      setLoading(false);
    }
  }, [year, month]);

  useEffect(() => {
    load();
  }, [load]);

  const summary: MonthSummary = {
    year,
    month,
    salary: salary?.amount ?? 0,
    otherIncome: salary?.other_income ?? 0,
    totalExpenses: expenses.reduce((sum, e) => sum + e.amount, 0),
    balance:
      (salary?.amount ?? 0) +
      (salary?.other_income ?? 0) -
      expenses.reduce((sum, e) => sum + e.amount, 0),
    expenses,
    categoryBreakdown: CATEGORIES.map((cat) => ({
      category: cat.value as ExpenseCategory,
      total: expenses
        .filter((e) => e.category === cat.value)
        .reduce((sum, e) => sum + e.amount, 0),
    })).filter((c) => c.total > 0),
  };

  return { expenses, salary, summary, loading, reload: load };
}
