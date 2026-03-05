import * as SQLite from 'expo-sqlite';
import { Expense, Salary, LoanPerson } from '../types';

let db: SQLite.SQLiteDatabase | null = null;

export async function getDatabase(): Promise<SQLite.SQLiteDatabase> {
  if (!db) {
    db = await SQLite.openDatabaseAsync('dividazero.db');
    await initializeDatabase(db);
  }
  return db;
}

// ============================================================
// SCHEMA CREATION
// ============================================================
async function initializeDatabase(database: SQLite.SQLiteDatabase): Promise<void> {
  await database.execAsync(`
    PRAGMA journal_mode = WAL;
    PRAGMA foreign_keys = ON;

    CREATE TABLE IF NOT EXISTS salary (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      amount REAL NOT NULL DEFAULT 0,
      other_income REAL NOT NULL DEFAULT 0,
      year INTEGER NOT NULL,
      month INTEGER NOT NULL,
      notes TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(year, month)
    );

    CREATE TABLE IF NOT EXISTS expenses (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      category TEXT NOT NULL DEFAULT 'OTHER',
      amount REAL NOT NULL,
      type TEXT NOT NULL DEFAULT 'FIXED',
      installments_total INTEGER DEFAULT 1,
      installments_current INTEGER DEFAULT 1,
      start_date TEXT NOT NULL,
      end_date TEXT,
      year INTEGER NOT NULL,
      month INTEGER NOT NULL,
      is_active INTEGER NOT NULL DEFAULT 1,
      parent_id INTEGER,
      notes TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (parent_id) REFERENCES expenses(id)
    );

    CREATE TABLE IF NOT EXISTS loan_persons (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      phone TEXT NOT NULL,
      total_amount REAL NOT NULL,
      monthly_interest REAL NOT NULL DEFAULT 0,
      installments INTEGER NOT NULL DEFAULT 1,
      installments_paid INTEGER NOT NULL DEFAULT 0,
      start_date TEXT NOT NULL,
      payment_day INTEGER NOT NULL DEFAULT 1,
      notes TEXT,
      notification_id TEXT,
      is_active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // Migrations: add new columns to expenses if they don't exist yet
  const migrations = [
    'ALTER TABLE expenses ADD COLUMN due_day INTEGER',
    'ALTER TABLE expenses ADD COLUMN alert_enabled INTEGER DEFAULT 0',
    'ALTER TABLE expenses ADD COLUMN is_paid INTEGER DEFAULT 0',
    'ALTER TABLE expenses ADD COLUMN notification_id TEXT',
    'ALTER TABLE expenses ADD COLUMN is_income INTEGER DEFAULT 0',
  ];
  for (const sql of migrations) {
    try {
      await database.execAsync(sql);
    } catch {
      // Column already exists — ignore
    }
  }
}

// ============================================================
// SALARY OPERATIONS
// ============================================================
export async function upsertSalary(
  year: number,
  month: number,
  amount: number,
  otherIncome = 0,
  notes = ''
): Promise<void> {
  const db = await getDatabase();
  await db.runAsync(
    `INSERT INTO salary (year, month, amount, other_income, notes)
     VALUES (?, ?, ?, ?, ?)
     ON CONFLICT(year, month) DO UPDATE SET
       amount = excluded.amount,
       other_income = excluded.other_income,
       notes = excluded.notes`,
    [year, month, amount, otherIncome, notes]
  );
}

export async function getSalary(year: number, month: number): Promise<Salary | null> {
  const db = await getDatabase();
  return db.getFirstAsync<Salary>(
    'SELECT * FROM salary WHERE year = ? AND month = ?',
    [year, month]
  );
}

/**
 * Get the most recent salary at or before the given year/month
 * (prospective inheritance: salary propagates forward until changed)
 */
export async function getEffectiveSalary(year: number, month: number): Promise<Salary | null> {
  const db = await getDatabase();
  return db.getFirstAsync<Salary>(
    `SELECT * FROM salary
     WHERE (year < ? OR (year = ? AND month <= ?))
     ORDER BY year DESC, month DESC
     LIMIT 1`,
    [year, year, month]
  );
}

export async function getAllSalaryYears(): Promise<number[]> {
  const db = await getDatabase();
  const rows = await db.getAllAsync<{ year: number }>(
    'SELECT DISTINCT year FROM salary ORDER BY year DESC'
  );
  return rows.map((r) => r.year);
}

// ============================================================
// EXPENSE OPERATIONS
// ============================================================
export async function addExpense(
  expense: Omit<Expense, 'id'>
): Promise<number> {
  const db = await getDatabase();
  const result = await db.runAsync(
    `INSERT INTO expenses
      (name, category, amount, type, installments_total, installments_current,
       start_date, end_date, year, month, is_active, parent_id, notes,
       due_day, alert_enabled, is_paid, notification_id, is_income)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      expense.name,
      expense.category,
      expense.amount,
      expense.type,
      expense.installments_total,
      expense.installments_current,
      expense.start_date,
      expense.end_date ?? null,
      expense.year,
      expense.month,
      expense.is_active,
      expense.parent_id ?? null,
      expense.notes ?? null,
      expense.due_day ?? null,
      expense.alert_enabled ?? 0,
      expense.is_paid ?? 0,
      expense.notification_id ?? null,
      expense.is_income ?? 0,
    ]
  );
  return result.lastInsertRowId;
}

export async function toggleExpensePaid(id: number, isPaid: boolean): Promise<void> {
  const db = await getDatabase();
  await db.runAsync('UPDATE expenses SET is_paid = ? WHERE id = ?', [isPaid ? 1 : 0, id]);
}

export async function updateExpenseNotificationId(id: number, notificationId: string): Promise<void> {
  const db = await getDatabase();
  await db.runAsync('UPDATE expenses SET notification_id = ? WHERE id = ?', [notificationId, id]);
}

/**
 * Add a FIXED expense and propagate it to all future months (up to 5 years ahead)
 */
export async function addFixedExpense(
  baseExpense: Omit<Expense, 'id' | 'year' | 'month'>,
  startYear: number,
  startMonth: number
): Promise<void> {
  const db = await getDatabase();
  const parentId = await addExpense({
    ...baseExpense,
    year: startYear,
    month: startMonth,
    type: 'FIXED',
    installments_total: 1,
    installments_current: 1,
    is_active: 1,
  });

  // Propagate 60 months forward
  for (let i = 1; i <= 60; i++) {
    const totalMonths = (startYear * 12 + startMonth - 1) + i;
    const futureYear = Math.floor(totalMonths / 12);
    const futureMonth = (totalMonths % 12) + 1;
    await db.runAsync(
      `INSERT INTO expenses
        (name, category, amount, type, installments_total, installments_current,
         start_date, year, month, is_active, parent_id, due_day)
       VALUES (?, ?, ?, 'FIXED', 1, 1, ?, ?, ?, 1, ?, ?)`,
      [
        baseExpense.name,
        baseExpense.category,
        baseExpense.amount,
        baseExpense.start_date,
        futureYear,
        futureMonth,
        parentId,
        baseExpense.due_day ?? null,
      ]
    );
  }
}

/**
 * Add an INSTALLMENT expense and create entries for each installment month
 */
export async function addInstallmentExpense(
  baseExpense: Omit<Expense, 'id' | 'year' | 'month' | 'installments_current'>,
  startYear: number,
  startMonth: number
): Promise<void> {
  const totalInstallments = baseExpense.installments_total;
  const startMonthIndex = startYear * 12 + startMonth - 1;

  for (let k = 0; k < totalInstallments; k++) {
    const totalMonthIndex = startMonthIndex + k;
    const year = Math.floor(totalMonthIndex / 12);
    const month = (totalMonthIndex % 12) + 1;
    await addExpense({
      ...baseExpense,
      year,
      month,
      installments_current: k + 1,
      type: 'INSTALLMENT',
      is_active: 1,
    });
  }
}

export async function getExpensesForMonth(
  year: number,
  month: number
): Promise<Expense[]> {
  const db = await getDatabase();
  return db.getAllAsync<Expense>(
    `SELECT * FROM expenses
     WHERE year = ? AND month = ? AND is_active = 1 AND (is_income = 0 OR is_income IS NULL)
     ORDER BY category, name`,
    [year, month]
  );
}

export async function getIncomesForMonth(
  year: number,
  month: number
): Promise<Expense[]> {
  const db = await getDatabase();
  return db.getAllAsync<Expense>(
    `SELECT * FROM expenses
     WHERE year = ? AND month = ? AND is_active = 1 AND is_income = 1
     ORDER BY name`,
    [year, month]
  );
}

/**
 * Adiciona uma entrada de dinheiro única (apenas para o mês especificado)
 */
export async function addSingleIncome(
  income: Omit<Expense, 'id' | 'year' | 'month'>,
  year: number,
  month: number
): Promise<void> {
  await addExpense({
    ...income,
    year,
    month,
    type: 'FIXED',
    installments_total: 1,
    installments_current: 1,
    is_active: 1,
    is_income: 1,
  });
}

/**
 * Adiciona uma entrada de dinheiro parcelada (spread across N months)
 */
export async function addInstallmentIncome(
  income: Omit<Expense, 'id' | 'year' | 'month' | 'installments_current'>,
  startYear: number,
  startMonth: number
): Promise<void> {
  const total = income.installments_total;
  const startIdx = startYear * 12 + startMonth - 1;
  for (let k = 0; k < total; k++) {
    const totalIdx = startIdx + k;
    const y = Math.floor(totalIdx / 12);
    const m = (totalIdx % 12) + 1;
    await addExpense({
      ...income,
      year: y,
      month: m,
      installments_current: k + 1,
      type: 'INSTALLMENT',
      is_active: 1,
      is_income: 1,
    });
  }
}

export async function updateExpenseAmount(
  id: number,
  amount: number
): Promise<void> {
  const db = await getDatabase();
  await db.runAsync('UPDATE expenses SET amount = ? WHERE id = ?', [amount, id]);
}

export async function updateExpense(
  id: number,
  updates: {
    name: string;
    amount: number;
    category: string;
    due_day?: number;
    alert_enabled: number;
  }
): Promise<void> {
  const db = await getDatabase();
  await db.runAsync(
    `UPDATE expenses SET name = ?, amount = ?, category = ?, due_day = ?, alert_enabled = ? WHERE id = ?`,
    [updates.name, updates.amount, updates.category, updates.due_day ?? null, updates.alert_enabled, id]
  );
}

export async function deleteExpense(id: number): Promise<void> {
  const db = await getDatabase();
  await db.runAsync('UPDATE expenses SET is_active = 0 WHERE id = ?', [id]);
}

export async function deleteExpenseAndFuture(id: number): Promise<void> {
  const db = await getDatabase();
  const expense = await db.getFirstAsync<Expense>(
    'SELECT * FROM expenses WHERE id = ?',
    [id]
  );
  if (!expense) return;

  if (expense.parent_id) {
    // Delete this and future occurrences of the same parent chain
    await db.runAsync(
      `UPDATE expenses SET is_active = 0
       WHERE (id = ? OR parent_id = ?)
         AND (year > ? OR (year = ? AND month >= ?))`,
      [id, expense.parent_id ?? id, expense.year, expense.year, expense.month]
    );
  } else {
    await db.runAsync(
      `UPDATE expenses SET is_active = 0
       WHERE (id = ? OR parent_id = ?)
         AND (year > ? OR (year = ? AND month >= ?))`,
      [id, id, expense.year, expense.year, expense.month]
    );
  }
}

export async function getAvailableMonths(): Promise<{ year: number; month: number }[]> {
  const db = await getDatabase();
  return db.getAllAsync<{ year: number; month: number }>(
    `SELECT DISTINCT year, month FROM expenses WHERE is_active = 1
     UNION
     SELECT DISTINCT year, month FROM salary
     ORDER BY year DESC, month DESC`
  );
}

// ============================================================
// LOAN PERSON OPERATIONS
// ============================================================
export async function addLoanPerson(
  person: Omit<LoanPerson, 'id' | 'created_at'>
): Promise<number> {
  const db = await getDatabase();
  const result = await db.runAsync(
    `INSERT INTO loan_persons
      (name, phone, total_amount, monthly_interest, installments, installments_paid,
       start_date, payment_day, notes, is_active)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1)`,
    [
      person.name,
      person.phone,
      person.total_amount,
      person.monthly_interest,
      person.installments,
      person.installments_paid,
      person.start_date,
      person.payment_day,
      person.notes ?? null,
    ]
  );
  return result.lastInsertRowId;
}

export async function getAllLoanPersons(): Promise<LoanPerson[]> {
  const db = await getDatabase();
  return db.getAllAsync<LoanPerson>(
    'SELECT * FROM loan_persons WHERE is_active = 1 ORDER BY name'
  );
}

export async function getLoanPerson(id: number): Promise<LoanPerson | null> {
  const db = await getDatabase();
  return db.getFirstAsync<LoanPerson>(
    'SELECT * FROM loan_persons WHERE id = ?',
    [id]
  );
}

export async function updateLoanPerson(
  id: number,
  updates: Partial<Omit<LoanPerson, 'id'>>
): Promise<void> {
  const db = await getDatabase();
  const fields = Object.keys(updates)
    .map((k) => `${k} = ?`)
    .join(', ');
  const values = [...Object.values(updates), id];
  await db.runAsync(`UPDATE loan_persons SET ${fields} WHERE id = ?`, values);
}

export async function markInstallmentPaid(id: number): Promise<void> {
  const db = await getDatabase();
  await db.runAsync(
    `UPDATE loan_persons
     SET installments_paid = installments_paid + 1
     WHERE id = ? AND installments_paid < installments`,
    [id]
  );
}

export async function updateNotificationId(
  id: number,
  notificationId: string
): Promise<void> {
  const db = await getDatabase();
  await db.runAsync(
    'UPDATE loan_persons SET notification_id = ? WHERE id = ?',
    [notificationId, id]
  );
}

export async function deleteLoanPerson(id: number): Promise<void> {
  const db = await getDatabase();
  await db.runAsync(
    'UPDATE loan_persons SET is_active = 0 WHERE id = ?',
    [id]
  );
}

// ============================================================
// BACKUP / RESTORE
// ============================================================
export async function exportAllData(): Promise<string> {
  const db = await getDatabase();
  const [salaries, expenses, loanPersons] = await Promise.all([
    db.getAllAsync('SELECT * FROM salary'),
    db.getAllAsync('SELECT * FROM expenses'),
    db.getAllAsync('SELECT * FROM loan_persons'),
  ]);
  return JSON.stringify(
    { version: 1, exportedAt: new Date().toISOString(), salaries, expenses, loanPersons },
    null,
    2
  );
}

export async function importAllData(jsonStr: string): Promise<void> {
  const data = JSON.parse(jsonStr);
  if (!data.version || !Array.isArray(data.salaries) || !Array.isArray(data.expenses) || !Array.isArray(data.loanPersons)) {
    throw new Error('Arquivo de backup inválido ou corrompido.');
  }

  const db = await getDatabase();
  await db.withTransactionAsync(async () => {
    await db.runAsync('DELETE FROM loan_persons');
    await db.runAsync('DELETE FROM expenses');
    await db.runAsync('DELETE FROM salary');

    for (const s of data.salaries) {
      await db.runAsync(
        'INSERT INTO salary (id, amount, other_income, year, month, notes, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
        [s.id, s.amount, s.other_income, s.year, s.month, s.notes ?? null, s.created_at ?? null]
      );
    }

    for (const e of data.expenses) {
      await db.runAsync(
        `INSERT INTO expenses
          (id, name, category, amount, type, installments_total, installments_current,
           start_date, end_date, year, month, is_active, parent_id, notes, created_at,
           due_day, alert_enabled, is_paid, notification_id, is_income)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          e.id, e.name, e.category, e.amount, e.type,
          e.installments_total, e.installments_current, e.start_date,
          e.end_date ?? null, e.year, e.month, e.is_active,
          e.parent_id ?? null, e.notes ?? null, e.created_at ?? null,
          e.due_day ?? null, e.alert_enabled ?? 0, e.is_paid ?? 0, e.notification_id ?? null,
          e.is_income ?? 0,
        ]
      );
    }

    for (const p of data.loanPersons) {
      await db.runAsync(
        `INSERT INTO loan_persons
          (id, name, phone, total_amount, monthly_interest, installments, installments_paid,
           start_date, payment_day, notes, notification_id, is_active, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          p.id, p.name, p.phone, p.total_amount, p.monthly_interest,
          p.installments, p.installments_paid, p.start_date,
          p.payment_day, p.notes ?? null, p.notification_id ?? null,
          p.is_active, p.created_at ?? null,
        ]
      );
    }
  });
}
