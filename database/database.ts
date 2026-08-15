import * as SQLite from 'expo-sqlite';
import {
  Expense,
  Salary,
  LoanPerson,
  Goal,
  GoalContribution,
  DeleteScope,
  Category,
  PlanDebt,
  PlanPayment,
  PayoffQuote,
  PayoffSelection,
} from '../types';

/**
 * Guardamos a *promessa* de abertura, não o banco já aberto.
 *
 * O ThemeProvider lê a preferência de tema no mesmo instante em que o layout
 * raiz inicializa o app; se guardássemos só o handle, as duas chamadas veriam
 * `null`, abririam duas conexões e rodariam a migração duas vezes em paralelo.
 * Com a promessa memoizada, quem chegar depois espera a mesma abertura.
 */
let dbPromise: Promise<SQLite.SQLiteDatabase> | null = null;

export async function getDatabase(): Promise<SQLite.SQLiteDatabase> {
  if (!dbPromise) {
    dbPromise = (async () => {
      const database = await SQLite.openDatabaseAsync('dividazero.db');
      await initializeDatabase(database);
      return database;
    })().catch((err) => {
      // Falhou: limpa o cache para a próxima chamada poder tentar de novo.
      dbPromise = null;
      throw err;
    });
  }
  return dbPromise;
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

    CREATE TABLE IF NOT EXISTS settings (
      key   TEXT PRIMARY KEY NOT NULL,
      value TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS goals (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      target_amount REAL NOT NULL,
      icon TEXT NOT NULL DEFAULT 'flag-checkered',
      color TEXT NOT NULL DEFAULT '#4F46E5',
      deadline TEXT,
      monthly_target REAL,
      notes TEXT,
      is_archived INTEGER NOT NULL DEFAULT 0,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS goal_contributions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      goal_id INTEGER NOT NULL,
      amount REAL NOT NULL,
      date TEXT NOT NULL,
      note TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (goal_id) REFERENCES goals(id) ON DELETE CASCADE
    );

    -- Dívidas com saldo que rola de um mês para o outro (planejador).
    -- Diferente da tabela expenses: aqui não há parcela fixa. A pessoa tem um
    -- saldo devedor e decide todo mês quanto abater; o que sobra passa adiante.
    CREATE TABLE IF NOT EXISTS plan_debts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      amount REAL NOT NULL,
      category TEXT NOT NULL DEFAULT 'OTHER',
      start_month TEXT NOT NULL,
      notes TEXT,
      is_archived INTEGER NOT NULL DEFAULT 0,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    -- Quanto foi abatido de cada dívida em cada mês, em percentual do saldo
    -- de abertura daquele mês. Guardar % (e não valor) é o que faz a conta
    -- continuar certa quando o saldo anterior muda.
    CREATE TABLE IF NOT EXISTS plan_payments (
      debt_id INTEGER NOT NULL,
      month TEXT NOT NULL,
      percent REAL NOT NULL DEFAULT 0,
      PRIMARY KEY (debt_id, month),
      FOREIGN KEY (debt_id) REFERENCES plan_debts(id) ON DELETE CASCADE
    );

    -- Simulação de quitação antecipada, guardada por compra parcelada.
    --
    -- Guardamos a proposta *e* a taxa deduzida dela. A proposta envelhece: os
    -- mesmos R$ 245 que hoje valem para uma parcela a 69 dias valeriam outra
    -- coisa daqui a um mês. Já a taxa é característica do contrato e continua
    -- valendo — é ela que serve de base para as simulações seguintes.
    CREATE TABLE IF NOT EXISTS payoff_quotes (
      group_id TEXT PRIMARY KEY NOT NULL,
      last_quote REAL,
      quoted_at TEXT,
      days_to_last INTEGER,
      monthly_rate REAL,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    -- Parcelas que o usuário marcou para pagar com o dinheiro extra de um mês.
    --
    -- A coluna amount guarda o valor descontado no instante da escolha: é o que
    -- de fato sai do bolso ao antecipar aquela parcela. Fica congelado para o
    -- total do mês não mudar sozinho quando os vencimentos se aproximam.
    CREATE TABLE IF NOT EXISTS payoff_selections (
      expense_id INTEGER PRIMARY KEY NOT NULL,
      group_id TEXT NOT NULL,
      month TEXT NOT NULL,
      amount REAL NOT NULL,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    -- Categorias viram dados, não mais constante no código, para o usuário
    -- poder criar as suas. As 11 originais entram como "builtin" e não podem
    -- ser excluídas — só arquivadas — senão lançamentos antigos ficariam órfãos.
    CREATE TABLE IF NOT EXISTS categories (
      key TEXT PRIMARY KEY NOT NULL,
      label TEXT NOT NULL,
      icon TEXT NOT NULL DEFAULT 'tag-outline',
      color TEXT NOT NULL DEFAULT '#64748B',
      sort_order INTEGER NOT NULL DEFAULT 100,
      is_builtin INTEGER NOT NULL DEFAULT 0,
      is_archived INTEGER NOT NULL DEFAULT 0
    );
  `);

  // ── Migrações aditivas ──────────────────────────────────────
  // Cada ALTER é idempotente por tentativa/erro: se a coluna já existe o SQLite
  // reclama e nós ignoramos. Nunca removemos nem reescrevemos dados do usuário.
  const columnMigrations = [
    'ALTER TABLE expenses ADD COLUMN due_day INTEGER',
    'ALTER TABLE expenses ADD COLUMN alert_enabled INTEGER DEFAULT 0',
    'ALTER TABLE expenses ADD COLUMN is_paid INTEGER DEFAULT 0',
    'ALTER TABLE expenses ADD COLUMN notification_id TEXT',
    'ALTER TABLE expenses ADD COLUMN is_income INTEGER DEFAULT 0',
    // group_id liga todas as ocorrências de um mesmo lançamento
    // (as 12 parcelas de uma compra, os N meses de uma despesa fixa).
    'ALTER TABLE expenses ADD COLUMN group_id TEXT',
  ];
  for (const sql of columnMigrations) {
    try {
      await database.execAsync(sql);
    } catch {
      // Coluna já existe — ok.
    }
  }

  await database.execAsync(`
    CREATE INDEX IF NOT EXISTS idx_expenses_month ON expenses(year, month, is_active);
    CREATE INDEX IF NOT EXISTS idx_expenses_group ON expenses(group_id);
    CREATE INDEX IF NOT EXISTS idx_contrib_goal ON goal_contributions(goal_id);
  `);

  await backfillGroupIds(database);
  await seedCategories(database);
}

/** As 11 categorias originais do app, gravadas na primeira execução. */
const BUILTIN_CATEGORIES: [string, string, string, string][] = [
  ['RENT', 'Aluguel', 'home', '#FF6B6B'],
  ['CAR', 'Carro', 'car', '#4ECDC4'],
  ['GYM', 'Academia', 'dumbbell', '#45B7D1'],
  ['FOOD', 'Alimentação', 'food-fork-drink', '#96CEB4'],
  ['HEALTH', 'Saúde', 'medical-bag', '#FF9F43'],
  ['EDUCATION', 'Educação', 'school', '#A29BFE'],
  ['ENTERTAINMENT', 'Lazer', 'gamepad-variant', '#FD79A8'],
  ['TRANSPORT', 'Transporte', 'bus', '#FDCB6E'],
  ['UTILITIES', 'Contas', 'lightning-bolt', '#74B9FF'],
  ['INVESTMENT', 'Investimento', 'trending-up', '#00B894'],
  ['OTHER', 'Outros', 'dots-horizontal', '#B2BEC3'],
];

async function seedCategories(database: SQLite.SQLiteDatabase): Promise<void> {
  for (let i = 0; i < BUILTIN_CATEGORIES.length; i++) {
    const [key, label, icon, color] = BUILTIN_CATEGORIES[i];
    // INSERT OR IGNORE: se o usuário renomeou uma categoria, a escolha dele fica.
    await database.runAsync(
      `INSERT OR IGNORE INTO categories (key, label, icon, color, sort_order, is_builtin)
       VALUES (?, ?, ?, ?, ?, 1)`,
      [key, label, icon, color, i]
    );
  }
}

// ============================================================
// CATEGORIES
// ============================================================
export async function getCategories(includeArchived = false): Promise<Category[]> {
  const db = await getDatabase();
  return db.getAllAsync<Category>(
    `SELECT * FROM categories
      WHERE (? = 1 OR is_archived = 0)
      ORDER BY is_archived ASC, sort_order ASC, label ASC`,
    [includeArchived ? 1 : 0]
  );
}

export async function addCategory(
  label: string,
  icon: string,
  color: string
): Promise<string> {
  const db = await getDatabase();
  const key = `CUSTOM_${Date.now().toString(36).toUpperCase()}`;
  const max = await db.getFirstAsync<{ m: number }>(
    'SELECT COALESCE(MAX(sort_order), 0) AS m FROM categories'
  );
  await db.runAsync(
    `INSERT INTO categories (key, label, icon, color, sort_order, is_builtin)
     VALUES (?, ?, ?, ?, ?, 0)`,
    [key, label.trim(), icon, color, (max?.m ?? 0) + 1]
  );
  return key;
}

export async function updateCategory(
  key: string,
  label: string,
  icon: string,
  color: string
): Promise<void> {
  const db = await getDatabase();
  await db.runAsync(
    'UPDATE categories SET label = ?, icon = ?, color = ? WHERE key = ?',
    [label.trim(), icon, color, key]
  );
}

export async function countExpensesInCategory(key: string): Promise<number> {
  const db = await getDatabase();
  const r = await db.getFirstAsync<{ n: number }>(
    'SELECT COUNT(*) AS n FROM expenses WHERE category = ? AND is_active = 1',
    [key]
  );
  return r?.n ?? 0;
}

/**
 * Categorias internas nunca somem — só saem da lista de escolha. Uma categoria
 * criada pelo usuário só é apagada de fato se nenhum lançamento a usa; caso
 * contrário é arquivada, para o histórico não perder o rótulo.
 */
export async function removeCategory(key: string): Promise<'deleted' | 'archived'> {
  const db = await getDatabase();
  const cat = await db.getFirstAsync<Category>('SELECT * FROM categories WHERE key = ?', [key]);
  if (!cat) return 'archived';

  const emUso = await countExpensesInCategory(key);
  if (cat.is_builtin === 1 || emUso > 0) {
    await db.runAsync('UPDATE categories SET is_archived = 1 WHERE key = ?', [key]);
    return 'archived';
  }
  await db.runAsync('DELETE FROM categories WHERE key = ?', [key]);
  return 'deleted';
}

export async function restoreCategory(key: string): Promise<void> {
  const db = await getDatabase();
  await db.runAsync('UPDATE categories SET is_archived = 0 WHERE key = ?', [key]);
}

/**
 * Preenche `group_id` nos lançamentos criados antes da coluna existir.
 *
 * FIXED: já havia `parent_id` apontando para a primeira ocorrência, então o
 * grupo é direto.
 *
 * INSTALLMENT: as parcelas eram gravadas como linhas totalmente independentes —
 * é justamente por isso que apagar uma compra parcelada só apagava um mês.
 * Reagrupamos pela assinatura da compra (nome + categoria + nº de parcelas +
 * data de origem). Duas compras diferentes com exatamente a mesma assinatura
 * seriam indistinguíveis mesmo para o usuário, então o risco de fusão é aceitável.
 */
async function backfillGroupIds(database: SQLite.SQLiteDatabase): Promise<void> {
  const pending = await database.getFirstAsync<{ n: number }>(
    `SELECT COUNT(*) AS n FROM expenses WHERE group_id IS NULL`
  );
  if (!pending || pending.n === 0) return;

  await database.execAsync(`
    UPDATE expenses
       SET group_id = 'g-fix-' || COALESCE(parent_id, id)
     WHERE group_id IS NULL AND type = 'FIXED';

    UPDATE expenses
       SET group_id = 'g-par-' || name || '~' || category || '~'
                      || COALESCE(installments_total, 1) || '~'
                      || COALESCE(start_date, '') || '~'
                      || COALESCE(is_income, 0)
     WHERE group_id IS NULL AND type = 'INSTALLMENT';

    UPDATE expenses
       SET group_id = 'g-avu-' || id
     WHERE group_id IS NULL;
  `);
}

let groupCounter = 0;
function newGroupId(prefix: string): string {
  groupCounter += 1;
  return `${prefix}-${Date.now().toString(36)}-${groupCounter}-${Math.floor(
    Math.random() * 1e6
  ).toString(36)}`;
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
 * Salário vigente em um mês: o último informado até aquele mês
 * (o valor se propaga para frente até ser alterado).
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
export async function addExpense(expense: Omit<Expense, 'id'>): Promise<number> {
  const db = await getDatabase();
  const result = await db.runAsync(
    `INSERT INTO expenses
      (name, category, amount, type, installments_total, installments_current,
       start_date, end_date, year, month, is_active, parent_id, notes,
       due_day, alert_enabled, is_paid, notification_id, is_income, group_id)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
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
      expense.group_id ?? null,
    ]
  );
  return result.lastInsertRowId;
}

export async function toggleExpensePaid(id: number, isPaid: boolean): Promise<void> {
  const db = await getDatabase();
  await db.runAsync('UPDATE expenses SET is_paid = ? WHERE id = ?', [isPaid ? 1 : 0, id]);
}

export async function updateExpenseNotificationId(
  id: number,
  notificationId: string
): Promise<void> {
  const db = await getDatabase();
  await db.runAsync('UPDATE expenses SET notification_id = ? WHERE id = ?', [notificationId, id]);
}

/** Quantos meses uma despesa fixa é projetada para frente. */
const FIXED_HORIZON_MONTHS = 60;

/**
 * Despesa fixa: cria o mês inicial e projeta 60 meses à frente.
 * Todas as ocorrências compartilham o mesmo `group_id`.
 */
export async function addFixedExpense(
  baseExpense: Omit<Expense, 'id' | 'year' | 'month'>,
  startYear: number,
  startMonth: number
): Promise<string> {
  const db = await getDatabase();
  const groupId = newGroupId('g-fix');

  const parentId = await addExpense({
    ...baseExpense,
    year: startYear,
    month: startMonth,
    type: 'FIXED',
    installments_total: 1,
    installments_current: 1,
    is_active: 1,
    group_id: groupId,
  });

  const startIndex = startYear * 12 + startMonth - 1;
  for (let i = 1; i <= FIXED_HORIZON_MONTHS; i++) {
    const idx = startIndex + i;
    await db.runAsync(
      `INSERT INTO expenses
        (name, category, amount, type, installments_total, installments_current,
         start_date, year, month, is_active, parent_id, due_day, alert_enabled,
         is_paid, is_income, group_id, notes)
       VALUES (?, ?, ?, 'FIXED', 1, 1, ?, ?, ?, 1, ?, ?, 0, 0, ?, ?, ?)`,
      [
        baseExpense.name,
        baseExpense.category,
        baseExpense.amount,
        baseExpense.start_date,
        Math.floor(idx / 12),
        (idx % 12) + 1,
        parentId,
        baseExpense.due_day ?? null,
        baseExpense.is_income ?? 0,
        groupId,
        baseExpense.notes ?? null,
      ]
    );
  }
  return groupId;
}

/**
 * Compra parcelada: uma linha por parcela, todas no mesmo `group_id`.
 * É o `group_id` que permite apagar/editar a compra inteira depois.
 */
export async function addInstallmentExpense(
  baseExpense: Omit<Expense, 'id' | 'year' | 'month' | 'installments_current'>,
  startYear: number,
  startMonth: number
): Promise<string> {
  const groupId = newGroupId('g-par');
  const total = Math.max(1, baseExpense.installments_total);
  const startIndex = startYear * 12 + startMonth - 1;

  for (let k = 0; k < total; k++) {
    const idx = startIndex + k;
    await addExpense({
      ...baseExpense,
      year: Math.floor(idx / 12),
      month: (idx % 12) + 1,
      installments_current: k + 1,
      type: 'INSTALLMENT',
      is_active: 1,
      group_id: groupId,
      // Só a primeira parcela herda o alerta configurado na criação.
      alert_enabled: k === 0 ? baseExpense.alert_enabled ?? 0 : 0,
    });
  }
  return groupId;
}

/** Gasto avulso: existe só no mês em que foi lançado. */
export async function addVariableExpense(
  baseExpense: Omit<Expense, 'id' | 'year' | 'month' | 'installments_current'>,
  year: number,
  month: number
): Promise<string> {
  const groupId = newGroupId('g-avu');
  await addExpense({
    ...baseExpense,
    year,
    month,
    type: 'VARIABLE',
    installments_total: 1,
    installments_current: 1,
    is_active: 1,
    group_id: groupId,
  });
  return groupId;
}

export async function getExpensesForMonth(year: number, month: number): Promise<Expense[]> {
  const db = await getDatabase();
  // O LEFT JOIN marca as parcelas que a pessoa planejou quitar com o dinheiro
  // extra. Elas continuam aparecendo na lista, mas saem do total do mês: esse
  // valor não vai sair do salário.
  return db.getAllAsync<Expense>(
    `SELECT e.*, (s.expense_id IS NOT NULL) AS planned_payoff
       FROM expenses e
       LEFT JOIN payoff_selections s ON s.expense_id = e.id
      WHERE e.year = ? AND e.month = ? AND e.is_active = 1
        AND (e.is_income = 0 OR e.is_income IS NULL)
      ORDER BY e.is_paid ASC, e.due_day IS NULL, e.due_day ASC, e.name ASC`,
    [year, month]
  );
}

export async function getIncomesForMonth(year: number, month: number): Promise<Expense[]> {
  const db = await getDatabase();
  return db.getAllAsync<Expense>(
    `SELECT * FROM expenses
     WHERE year = ? AND month = ? AND is_active = 1 AND is_income = 1
     ORDER BY name`,
    [year, month]
  );
}

/** Todas as ocorrências ativas de um lançamento, em ordem cronológica. */
export async function getExpenseGroup(groupId: string): Promise<Expense[]> {
  const db = await getDatabase();
  return db.getAllAsync<Expense>(
    `SELECT * FROM expenses
     WHERE group_id = ? AND is_active = 1
     ORDER BY year, month`,
    [groupId]
  );
}

/**
 * Entrada de dinheiro única (apenas no mês informado).
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
    type: 'VARIABLE',
    installments_total: 1,
    installments_current: 1,
    is_active: 1,
    is_income: 1,
    group_id: newGroupId('g-avu'),
  });
}

/**
 * Entrada de dinheiro parcelada (dividida em N meses).
 */
export async function addInstallmentIncome(
  income: Omit<Expense, 'id' | 'year' | 'month' | 'installments_current'>,
  startYear: number,
  startMonth: number
): Promise<void> {
  const groupId = newGroupId('g-par');
  const total = Math.max(1, income.installments_total);
  const startIndex = startYear * 12 + startMonth - 1;
  for (let k = 0; k < total; k++) {
    const idx = startIndex + k;
    await addExpense({
      ...income,
      year: Math.floor(idx / 12),
      month: (idx % 12) + 1,
      installments_current: k + 1,
      type: 'INSTALLMENT',
      is_active: 1,
      is_income: 1,
      group_id: groupId,
    });
  }
}

/** Entrada fixa recorrente (ex.: aluguel recebido, pensão). */
export async function addFixedIncome(
  income: Omit<Expense, 'id' | 'year' | 'month'>,
  year: number,
  month: number
): Promise<void> {
  await addFixedExpense({ ...income, is_income: 1 }, year, month);
}

export async function updateExpenseAmount(id: number, amount: number): Promise<void> {
  const db = await getDatabase();
  await db.runAsync('UPDATE expenses SET amount = ? WHERE id = ?', [amount, id]);
}

export interface ExpenseUpdate {
  name: string;
  amount: number;
  category: string;
  due_day?: number;
  alert_enabled: number;
  notes?: string;
}

/** Edita apenas a ocorrência informada. */
export async function updateExpense(id: number, updates: ExpenseUpdate): Promise<void> {
  const db = await getDatabase();
  await db.runAsync(
    `UPDATE expenses
        SET name = ?, amount = ?, category = ?, due_day = ?, alert_enabled = ?, notes = COALESCE(?, notes)
      WHERE id = ?`,
    [
      updates.name,
      updates.amount,
      updates.category,
      updates.due_day ?? null,
      updates.alert_enabled,
      updates.notes ?? null,
      id,
    ]
  );
}

/**
 * Edita a ocorrência e todas as futuras do mesmo lançamento.
 * Meses já passados ficam intactos — o histórico não é reescrito.
 */
export async function updateExpenseAndFuture(
  id: number,
  updates: ExpenseUpdate
): Promise<void> {
  const db = await getDatabase();
  const ref = await db.getFirstAsync<Expense>('SELECT * FROM expenses WHERE id = ?', [id]);
  if (!ref) return;
  if (!ref.group_id) {
    await updateExpense(id, updates);
    return;
  }
  await db.runAsync(
    `UPDATE expenses
        SET name = ?, amount = ?, category = ?, due_day = ?, alert_enabled = ?
      WHERE group_id = ?
        AND (year > ? OR (year = ? AND month >= ?))`,
    [
      updates.name,
      updates.amount,
      updates.category,
      updates.due_day ?? null,
      updates.alert_enabled,
      ref.group_id,
      ref.year,
      ref.year,
      ref.month,
    ]
  );
}

/** Edita todas as ocorrências do lançamento, inclusive as passadas. */
export async function updateExpenseGroup(id: number, updates: ExpenseUpdate): Promise<void> {
  const db = await getDatabase();
  const ref = await db.getFirstAsync<Expense>('SELECT * FROM expenses WHERE id = ?', [id]);
  if (!ref) return;
  if (!ref.group_id) {
    await updateExpense(id, updates);
    return;
  }
  await db.runAsync(
    `UPDATE expenses
        SET name = ?, amount = ?, category = ?, due_day = ?, alert_enabled = ?
      WHERE group_id = ?`,
    [
      updates.name,
      updates.amount,
      updates.category,
      updates.due_day ?? null,
      updates.alert_enabled,
      ref.group_id,
    ]
  );
}

/**
 * Ajusta o dia de vencimento desta ocorrência em diante. O passado fica como
 * está para não reescrever histórico de atraso.
 */
export async function updateDueDayForGroup(id: number, dueDay: number | null): Promise<void> {
  const db = await getDatabase();
  const ref = await db.getFirstAsync<Expense>('SELECT * FROM expenses WHERE id = ?', [id]);
  if (!ref) return;
  if (!ref.group_id) {
    await db.runAsync('UPDATE expenses SET due_day = ? WHERE id = ?', [dueDay, id]);
    return;
  }
  await db.runAsync(
    `UPDATE expenses SET due_day = ?
      WHERE group_id = ? AND (year > ? OR (year = ? AND month >= ?))`,
    [dueDay, ref.group_id, ref.year, ref.year, ref.month]
  );
}

export async function deleteExpense(id: number): Promise<void> {
  const db = await getDatabase();
  await db.runAsync('UPDATE expenses SET is_active = 0 WHERE id = ?', [id]);
}

/**
 * Exclusão com escopo explícito — a correção central do app.
 *
 *  'one'    → só esta ocorrência/parcela
 *  'future' → esta e todas as seguintes (passado preservado)
 *  'all'    → o lançamento inteiro, incluindo parcelas já pagas
 *
 * Sempre exclusão lógica (`is_active = 0`), então nada some do backup nem
 * quebra referência de notificação.
 */
export interface DeleteResult {
  changes: number;
  /** Alertas agendados das ocorrências removidas, para o chamador cancelar. */
  notificationIds: string[];
}

export async function deleteExpenseScoped(
  id: number,
  scope: DeleteScope
): Promise<DeleteResult> {
  const db = await getDatabase();
  const ref = await db.getFirstAsync<Expense>('SELECT * FROM expenses WHERE id = ?', [id]);
  if (!ref) return { changes: 0, notificationIds: [] };

  const [where, params]: [string, (string | number)[]] =
    scope === 'one' || !ref.group_id
      ? ['id = ?', [id]]
      : scope === 'all'
        ? ['group_id = ?', [ref.group_id]]
        : [
            'group_id = ? AND (year > ? OR (year = ? AND month >= ?))',
            [ref.group_id, ref.year, ref.year, ref.month],
          ];

  // Lê antes de desativar: depois a linha sai de todas as consultas ativas.
  const pending = await db.getAllAsync<{ notification_id: string }>(
    `SELECT notification_id FROM expenses
      WHERE ${where} AND is_active = 1 AND notification_id IS NOT NULL`,
    params
  );

  const r = await db.runAsync(`UPDATE expenses SET is_active = 0 WHERE ${where}`, params);
  return {
    changes: r.changes,
    notificationIds: pending.map((p) => p.notification_id).filter(Boolean),
  };
}

/** @deprecated use `deleteExpenseScoped(id, 'future')` */
export async function deleteExpenseAndFuture(id: number): Promise<void> {
  await deleteExpenseScoped(id, 'future');
}

/**
 * Quantas ocorrências cada escopo apagaria — usado para avisar o usuário
 * ("isso vai apagar 8 das 12 parcelas") antes de confirmar.
 */
export async function countDeleteScope(
  id: number
): Promise<{ one: number; future: number; all: number }> {
  const db = await getDatabase();
  const ref = await db.getFirstAsync<Expense>('SELECT * FROM expenses WHERE id = ?', [id]);
  if (!ref) return { one: 0, future: 0, all: 0 };
  if (!ref.group_id) return { one: 1, future: 1, all: 1 };

  const all = await db.getFirstAsync<{ n: number }>(
    'SELECT COUNT(*) AS n FROM expenses WHERE group_id = ? AND is_active = 1',
    [ref.group_id]
  );
  const future = await db.getFirstAsync<{ n: number }>(
    `SELECT COUNT(*) AS n FROM expenses
      WHERE group_id = ? AND is_active = 1
        AND (year > ? OR (year = ? AND month >= ?))`,
    [ref.group_id, ref.year, ref.year, ref.month]
  );
  return { one: 1, future: future?.n ?? 1, all: all?.n ?? 1 };
}

// ============================================================
// IMPORTAÇÃO DE EXTRATO
// ============================================================
export interface ImportedTx {
  /** 'YYYY-MM-DD' */
  data: string;
  descricao: string;
  valor: number;
  tipo: 'ENTRADA' | 'SAIDA';
  categoria: string;
}

/**
 * Grava lançamentos vindos de um extrato como avulsos do mês correspondente.
 *
 * Reimportar o mesmo extrato é o erro mais fácil de cometer, e dobraria o mês
 * inteiro sem aviso. Por isso cada linha é comparada com o que já existe no
 * mesmo mês (nome + valor + dia); o que bater é pulado e reportado.
 */
export async function importTransactions(
  txs: ImportedTx[]
): Promise<{ inseridos: number; repetidos: number }> {
  const db = await getDatabase();
  let inseridos = 0;
  let repetidos = 0;

  for (const t of txs) {
    const [ano, mes, dia] = t.data.split('-').map(Number);
    if (!ano || !mes) continue;

    const existente = await db.getFirstAsync<{ n: number }>(
      `SELECT COUNT(*) AS n FROM expenses
        WHERE year = ? AND month = ? AND is_active = 1
          AND name = ? AND ABS(amount - ?) < 0.005
          AND COALESCE(due_day, 0) = ?`,
      [ano, mes, t.descricao, t.valor, dia ?? 0]
    );
    if ((existente?.n ?? 0) > 0) {
      repetidos++;
      continue;
    }

    await addExpense({
      name: t.descricao,
      category: t.categoria,
      amount: t.valor,
      type: 'VARIABLE',
      installments_total: 1,
      installments_current: 1,
      start_date: t.data,
      year: ano,
      month: mes,
      is_active: 1,
      // O dia do lançamento vira dia de vencimento: é o que o extrato sabe.
      due_day: dia,
      alert_enabled: 0,
      // Já aconteceu — veio do extrato, então entra como pago.
      is_paid: 1,
      is_income: t.tipo === 'ENTRADA' ? 1 : 0,
      group_id: newGroupId('g-imp'),
    });
    inseridos++;
  }

  return { inseridos, repetidos };
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
// ANALYTICS QUERIES
// ============================================================
export interface MonthTotalsRow {
  year: number;
  month: number;
  fixed: number;
  installment: number;
  variable: number;
  income: number;
  paid: number;
  total: number;
}

/**
 * Totais mês a mês num intervalo fechado, já separados por tipo.
 * Feito em SQL para não carregar milhares de linhas na memória.
 */
export async function getMonthlyTotals(
  fromIndex: number,
  toIndex: number
): Promise<MonthTotalsRow[]> {
  const db = await getDatabase();
  return db.getAllAsync<MonthTotalsRow>(
    // Colunas qualificadas com e.: payoff_selections também tem "month" e
    // "amount", e sem o prefixo o SQLite não sabe de qual tabela é.
    `SELECT e.year AS year,
            e.month AS month,
            SUM(CASE WHEN e.is_income = 1 THEN 0 WHEN e.type = 'FIXED' THEN e.amount ELSE 0 END)       AS fixed,
            SUM(CASE WHEN e.is_income = 1 THEN 0 WHEN e.type = 'INSTALLMENT' THEN e.amount ELSE 0 END) AS installment,
            -- "variable" é o resto por definição, para fixo+parcelado+avulso sempre fechar o total
            SUM(CASE WHEN e.is_income = 1 THEN 0 WHEN e.type IN ('FIXED','INSTALLMENT') THEN 0 ELSE e.amount END) AS variable,
            SUM(CASE WHEN e.is_income = 1 THEN e.amount ELSE 0 END)                                     AS income,
            SUM(CASE WHEN e.is_income = 1 THEN 0 WHEN e.is_paid = 1 THEN e.amount ELSE 0 END)           AS paid,
            SUM(CASE WHEN e.is_income = 1 THEN 0 ELSE e.amount END)                                     AS total
       FROM expenses e
       LEFT JOIN payoff_selections s ON s.expense_id = e.id
      WHERE e.is_active = 1
        -- Parcela planejada para quitação sai do mês também aqui, senão a
        -- análise discordaria do painel para o mesmo mês.
        AND s.expense_id IS NULL
        AND (e.year * 12 + e.month - 1) BETWEEN ? AND ?
      GROUP BY e.year, e.month
      ORDER BY e.year, e.month`,
    [fromIndex, toIndex]
  );
}

export interface CategoryTotalRow {
  category: string;
  total: number;
  months: number;
}

export async function getCategoryTotals(
  fromIndex: number,
  toIndex: number
): Promise<CategoryTotalRow[]> {
  const db = await getDatabase();
  return db.getAllAsync<CategoryTotalRow>(
    `SELECT category,
            SUM(amount) AS total,
            COUNT(DISTINCT year * 12 + month) AS months
       FROM expenses
      WHERE is_active = 1
        AND (is_income = 0 OR is_income IS NULL)
        AND (year * 12 + month - 1) BETWEEN ? AND ?
      GROUP BY category
      ORDER BY total DESC`,
    [fromIndex, toIndex]
  );
}

export interface OpenDebtGroup {
  group_id: string;
  name: string;
  category: string;
  type: string;
  installment_amount: number;
  remaining_count: number;
  remaining_total: number;
  installments_total: number;
  last_index: number;
  next_index: number;
}

/**
 * Dívidas com fim previsto (parceladas) ainda em aberto a partir do mês dado.
 * É a matéria-prima do plano de quitação — fixas recorrentes não entram porque
 * não "acabam".
 */
export async function getOpenInstallmentGroups(fromIndex: number): Promise<OpenDebtGroup[]> {
  const db = await getDatabase();
  return db.getAllAsync<OpenDebtGroup>(
    `SELECT group_id,
            MIN(name)               AS name,
            MIN(category)           AS category,
            'INSTALLMENT'           AS type,
            AVG(amount)             AS installment_amount,
            COUNT(*)                AS remaining_count,
            SUM(amount)             AS remaining_total,
            MAX(installments_total) AS installments_total,
            MAX(year * 12 + month - 1) AS last_index,
            MIN(year * 12 + month - 1) AS next_index
       FROM expenses
      WHERE is_active = 1
        AND type = 'INSTALLMENT'
        AND (is_income = 0 OR is_income IS NULL)
        AND is_paid = 0
        AND group_id IS NOT NULL
        AND (year * 12 + month - 1) >= ?
      GROUP BY group_id
      ORDER BY remaining_total DESC`,
    [fromIndex]
  );
}

// ============================================================
// SIMULAÇÃO DE QUITAÇÃO
// ============================================================
export async function getPayoffQuote(groupId: string): Promise<PayoffQuote | null> {
  const db = await getDatabase();
  return db.getFirstAsync<PayoffQuote>(
    'SELECT * FROM payoff_quotes WHERE group_id = ?',
    [groupId]
  );
}

export async function getAllPayoffQuotes(): Promise<PayoffQuote[]> {
  const db = await getDatabase();
  return db.getAllAsync<PayoffQuote>('SELECT * FROM payoff_quotes');
}

export async function savePayoffQuote(quote: Omit<PayoffQuote, 'updated_at'>): Promise<void> {
  const db = await getDatabase();
  await db.runAsync(
    `INSERT INTO payoff_quotes (group_id, last_quote, quoted_at, days_to_last, monthly_rate, updated_at)
     VALUES (?, ?, ?, ?, ?, datetime('now'))
     ON CONFLICT(group_id) DO UPDATE SET
       last_quote = excluded.last_quote,
       quoted_at = excluded.quoted_at,
       days_to_last = excluded.days_to_last,
       monthly_rate = excluded.monthly_rate,
       updated_at = datetime('now')`,
    [
      quote.group_id,
      quote.last_quote ?? null,
      quote.quoted_at ?? null,
      quote.days_to_last ?? null,
      quote.monthly_rate ?? null,
    ]
  );
}

export async function deletePayoffQuote(groupId: string): Promise<void> {
  const db = await getDatabase();
  await db.runAsync('DELETE FROM payoff_quotes WHERE group_id = ?', [groupId]);
}

/** Parcelas marcadas para pagar com o dinheiro de um mês, dentro de uma dívida. */
export async function getSelections(groupId: string): Promise<PayoffSelection[]> {
  const db = await getDatabase();
  return db.getAllAsync<PayoffSelection>(
    'SELECT * FROM payoff_selections WHERE group_id = ?',
    [groupId]
  );
}

/** Total já comprometido em cada mês, somando todas as dívidas. */
export async function getSelectionTotals(): Promise<Record<string, number>> {
  const db = await getDatabase();
  const linhas = await db.getAllAsync<{ month: string; total: number }>(
    'SELECT month, SUM(amount) AS total FROM payoff_selections GROUP BY month'
  );
  return Object.fromEntries(linhas.map((l) => [l.month, l.total]));
}

export async function toggleSelection(
  expenseId: number,
  groupId: string,
  month: string,
  amount: number
): Promise<boolean> {
  const db = await getDatabase();
  const existe = await db.getFirstAsync<{ expense_id: number }>(
    'SELECT expense_id FROM payoff_selections WHERE expense_id = ?',
    [expenseId]
  );
  if (existe) {
    await db.runAsync('DELETE FROM payoff_selections WHERE expense_id = ?', [expenseId]);
    return false;
  }
  await db.runAsync(
    'INSERT INTO payoff_selections (expense_id, group_id, month, amount) VALUES (?, ?, ?, ?)',
    [expenseId, groupId, month, amount]
  );
  return true;
}

/** Some as marcações de um mês — usado ao zerar o dinheiro daquele mês. */
export async function clearSelectionsForMonth(month: string): Promise<void> {
  const db = await getDatabase();
  await db.runAsync('DELETE FROM payoff_selections WHERE month = ?', [month]);
}

// ============================================================
// PLANEJADOR (dívidas com saldo rolando)
// ============================================================
export async function getPlanDebts(): Promise<PlanDebt[]> {
  const db = await getDatabase();
  return db.getAllAsync<PlanDebt>(
    'SELECT * FROM plan_debts WHERE is_archived = 0 ORDER BY start_month, id'
  );
}

export async function addPlanDebt(
  name: string,
  amount: number,
  category: string,
  startMonth: string
): Promise<number> {
  const db = await getDatabase();
  const r = await db.runAsync(
    'INSERT INTO plan_debts (name, amount, category, start_month) VALUES (?, ?, ?, ?)',
    [name.trim(), amount, category, startMonth]
  );
  return r.lastInsertRowId;
}

export async function updatePlanDebt(
  id: number,
  name: string,
  amount: number,
  category: string
): Promise<void> {
  const db = await getDatabase();
  await db.runAsync(
    'UPDATE plan_debts SET name = ?, amount = ?, category = ? WHERE id = ?',
    [name.trim(), amount, category, id]
  );
}

export async function deletePlanDebt(id: number): Promise<void> {
  const db = await getDatabase();
  await db.runAsync('DELETE FROM plan_payments WHERE debt_id = ?', [id]);
  await db.runAsync('DELETE FROM plan_debts WHERE id = ?', [id]);
}

export async function getPlanPayments(): Promise<PlanPayment[]> {
  const db = await getDatabase();
  return db.getAllAsync<PlanPayment>('SELECT * FROM plan_payments');
}

export async function setPlanPayment(
  debtId: number,
  month: string,
  percent: number
): Promise<void> {
  const db = await getDatabase();
  const p = Math.max(0, Math.min(100, percent));
  await db.runAsync(
    `INSERT INTO plan_payments (debt_id, month, percent) VALUES (?, ?, ?)
     ON CONFLICT(debt_id, month) DO UPDATE SET percent = excluded.percent`,
    [debtId, month, p]
  );
}

// ============================================================
// GOALS
// ============================================================
export async function addGoal(goal: Omit<Goal, 'id' | 'created_at' | 'saved'>): Promise<number> {
  const db = await getDatabase();
  const r = await db.runAsync(
    `INSERT INTO goals (name, target_amount, icon, color, deadline, monthly_target, notes, is_archived)
     VALUES (?, ?, ?, ?, ?, ?, ?, 0)`,
    [
      goal.name,
      goal.target_amount,
      goal.icon,
      goal.color,
      goal.deadline ?? null,
      goal.monthly_target ?? null,
      goal.notes ?? null,
    ]
  );
  return r.lastInsertRowId;
}

export async function updateGoal(
  id: number,
  goal: Omit<Goal, 'id' | 'created_at' | 'saved'>
): Promise<void> {
  const db = await getDatabase();
  await db.runAsync(
    `UPDATE goals
        SET name = ?, target_amount = ?, icon = ?, color = ?,
            deadline = ?, monthly_target = ?, notes = ?
      WHERE id = ?`,
    [
      goal.name,
      goal.target_amount,
      goal.icon,
      goal.color,
      goal.deadline ?? null,
      goal.monthly_target ?? null,
      goal.notes ?? null,
      id,
    ]
  );
}

/** Metas ativas com o total já guardado (soma dos aportes). */
export async function getGoals(includeArchived = false): Promise<Goal[]> {
  const db = await getDatabase();
  return db.getAllAsync<Goal>(
    `SELECT g.*,
            COALESCE((SELECT SUM(c.amount) FROM goal_contributions c WHERE c.goal_id = g.id), 0) AS saved
       FROM goals g
      WHERE (? = 1 OR g.is_archived = 0)
      ORDER BY g.is_archived ASC, g.created_at DESC`,
    [includeArchived ? 1 : 0]
  );
}

export async function getGoal(id: number): Promise<Goal | null> {
  const db = await getDatabase();
  return db.getFirstAsync<Goal>(
    `SELECT g.*,
            COALESCE((SELECT SUM(c.amount) FROM goal_contributions c WHERE c.goal_id = g.id), 0) AS saved
       FROM goals g WHERE g.id = ?`,
    [id]
  );
}

export async function archiveGoal(id: number, archived: boolean): Promise<void> {
  const db = await getDatabase();
  await db.runAsync('UPDATE goals SET is_archived = ? WHERE id = ?', [archived ? 1 : 0, id]);
}

export async function deleteGoal(id: number): Promise<void> {
  const db = await getDatabase();
  await db.runAsync('DELETE FROM goal_contributions WHERE goal_id = ?', [id]);
  await db.runAsync('DELETE FROM goals WHERE id = ?', [id]);
}

export async function addContribution(
  goalId: number,
  amount: number,
  date: string,
  note?: string
): Promise<void> {
  const db = await getDatabase();
  await db.runAsync(
    'INSERT INTO goal_contributions (goal_id, amount, date, note) VALUES (?, ?, ?, ?)',
    [goalId, amount, date, note ?? null]
  );
}

export async function getContributions(goalId: number): Promise<GoalContribution[]> {
  const db = await getDatabase();
  return db.getAllAsync<GoalContribution>(
    'SELECT * FROM goal_contributions WHERE goal_id = ? ORDER BY date DESC, id DESC',
    [goalId]
  );
}

export async function deleteContribution(id: number): Promise<void> {
  const db = await getDatabase();
  await db.runAsync('DELETE FROM goal_contributions WHERE id = ?', [id]);
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
  return db.getFirstAsync<LoanPerson>('SELECT * FROM loan_persons WHERE id = ?', [id]);
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
  await db.runAsync('UPDATE loan_persons SET notification_id = ? WHERE id = ?', [
    notificationId,
    id,
  ]);
}

export async function deleteLoanPerson(id: number): Promise<void> {
  const db = await getDatabase();
  await db.runAsync('UPDATE loan_persons SET is_active = 0 WHERE id = ?', [id]);
}

// ============================================================
// SETTINGS OPERATIONS
// ============================================================
export async function getSetting(key: string): Promise<string | null> {
  const db = await getDatabase();
  const row = await db.getFirstAsync<{ value: string }>(
    'SELECT value FROM settings WHERE key = ?',
    [key]
  );
  return row?.value ?? null;
}

export async function setSetting(key: string, value: string): Promise<void> {
  const db = await getDatabase();
  await db.runAsync(
    `INSERT INTO settings (key, value) VALUES (?, ?)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
    [key, value]
  );
}

// ============================================================
// BACKUP / RESTORE
// ============================================================
/** Versão do formato de backup. v1 não tinha metas nem `group_id`. */
const BACKUP_VERSION = 2;

export async function exportAllData(): Promise<string> {
  const db = await getDatabase();
  const [salaries, expenses, loanPersons, goals, contributions, settings] = await Promise.all([
    db.getAllAsync('SELECT * FROM salary'),
    db.getAllAsync('SELECT * FROM expenses'),
    db.getAllAsync('SELECT * FROM loan_persons'),
    db.getAllAsync('SELECT * FROM goals'),
    db.getAllAsync('SELECT * FROM goal_contributions'),
    db.getAllAsync('SELECT * FROM settings'),
  ]);
  return JSON.stringify(
    {
      version: BACKUP_VERSION,
      exportedAt: new Date().toISOString(),
      salaries,
      expenses,
      loanPersons,
      goals,
      contributions,
      settings,
    },
    null,
    2
  );
}

/**
 * Restaura um backup. Aceita arquivos v1 (sem metas / sem `group_id`) — nesses
 * casos o `group_id` é reconstruído pelo mesmo backfill usado na migração.
 */
export async function importAllData(jsonStr: string): Promise<void> {
  const data = JSON.parse(jsonStr);
  if (
    !data.version ||
    !Array.isArray(data.salaries) ||
    !Array.isArray(data.expenses) ||
    !Array.isArray(data.loanPersons)
  ) {
    throw new Error('Arquivo de backup inválido ou corrompido.');
  }

  const db = await getDatabase();
  await db.withTransactionAsync(async () => {
    await db.runAsync('DELETE FROM goal_contributions');
    await db.runAsync('DELETE FROM goals');
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
           due_day, alert_enabled, is_paid, notification_id, is_income, group_id)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          e.id, e.name, e.category, e.amount, e.type,
          e.installments_total, e.installments_current, e.start_date,
          e.end_date ?? null, e.year, e.month, e.is_active,
          e.parent_id ?? null, e.notes ?? null, e.created_at ?? null,
          e.due_day ?? null, e.alert_enabled ?? 0, e.is_paid ?? 0,
          e.notification_id ?? null, e.is_income ?? 0, e.group_id ?? null,
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

    for (const g of data.goals ?? []) {
      await db.runAsync(
        `INSERT INTO goals (id, name, target_amount, icon, color, deadline, monthly_target, notes, is_archived, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          g.id, g.name, g.target_amount, g.icon ?? 'flag-checkered',
          g.color ?? '#4F46E5', g.deadline ?? null, g.monthly_target ?? null,
          g.notes ?? null, g.is_archived ?? 0, g.created_at ?? null,
        ]
      );
    }

    for (const c of data.contributions ?? []) {
      await db.runAsync(
        'INSERT INTO goal_contributions (id, goal_id, amount, date, note, created_at) VALUES (?, ?, ?, ?, ?, ?)',
        [c.id, c.goal_id, c.amount, c.date, c.note ?? null, c.created_at ?? null]
      );
    }

    for (const s of data.settings ?? []) {
      await db.runAsync(
        'INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value',
        [s.key, s.value]
      );
    }
  });

  // Backup antigo: reconstrói os grupos para que a exclusão de parcelas funcione.
  await backfillGroupIds(db);
}
