import { PayoffDebt, PayoffPlan, PayoffStep, PayoffStrategy } from '../types';

/** Trava de segurança da simulação — 50 anos é muito além de qualquer caso real. */
const MAX_MONTHS = 600;

export const STRATEGY_LABEL: Record<PayoffStrategy, string> = {
  SNOWBALL: 'Bola de neve',
  AVALANCHE: 'Maior alívio',
};

export const STRATEGY_DESCRIPTION: Record<PayoffStrategy, string> = {
  SNOWBALL:
    'Ataca primeiro a dívida de menor saldo. Você risca nomes da lista rápido, e cada parcela quitada vira munição para a próxima.',
  AVALANCHE:
    'Ataca primeiro a dívida de maior parcela mensal. Demora mais para riscar a primeira, mas alivia o orçamento do mês mais cedo.',
};

function orderDebts(debts: PayoffDebt[], strategy: PayoffStrategy): PayoffDebt[] {
  const copy = [...debts];
  if (strategy === 'SNOWBALL') {
    // Menor saldo primeiro; empate desempata pela parcela maior.
    copy.sort(
      (a, b) => a.remainingTotal - b.remainingTotal || b.installmentAmount - a.installmentAmount
    );
  } else {
    // Maior parcela primeiro; empate desempata pelo saldo menor.
    copy.sort(
      (a, b) => b.installmentAmount - a.installmentAmount || a.remainingTotal - b.remainingTotal
    );
  }
  return copy;
}

/**
 * Mês em que a pessoa fica sem parcelas se apenas seguir o carnê, sem antecipar
 * nada. É a régua contra a qual o plano se compara.
 */
export function baselineFreeIndex(debts: PayoffDebt[]): number | null {
  if (debts.length === 0) return null;
  return debts.reduce((max, d) => Math.max(max, d.lastIndex), debts[0].lastIndex);
}

/**
 * Simula a quitação acelerada.
 *
 * O orçamento mensal é fixo: a soma de todas as parcelas atuais mais o extra que
 * a pessoa se comprometeu a colocar. Conforme uma dívida é quitada, a parcela
 * dela não some do orçamento — ela é redirecionada para a próxima da fila. É daí
 * que vem o efeito bola de neve, e é por isso que o plano acelera mesmo com
 * extra igual a zero.
 *
 * Parcelas de compras futuras (que ainda nem começaram a ser cobradas) entram no
 * saldo total: antecipar é sempre permitido, então o simulador não bloqueia o
 * pagamento por data.
 */
export function buildPayoffPlan(
  debts: PayoffDebt[],
  strategy: PayoffStrategy,
  extraMonthly: number,
  startIndex: number
): PayoffPlan {
  const baseline = baselineFreeIndex(debts);
  const totalDebt = debts.reduce((s, d) => s + d.remainingTotal, 0);

  if (debts.length === 0) {
    return {
      strategy,
      extraMonthly,
      steps: [],
      focusGroupId: null,
      freeIndex: null,
      baselineFreeIndex: null,
      totalDebt: 0,
      monthsSaved: 0,
    };
  }

  const ordered = orderDebts(debts, strategy);
  const balances = new Map<string, number>();
  ordered.forEach((d) => balances.set(d.groupId, d.remainingTotal));

  // Orçamento constante: tudo que já sai hoje + o esforço extra.
  const monthlyBudget =
    debts.reduce((s, d) => s + d.installmentAmount, 0) + Math.max(0, extraMonthly);

  const steps: PayoffStep[] = [];
  let month = startIndex;
  let guard = 0;

  while (steps.length < ordered.length && guard < MAX_MONTHS) {
    let available = monthlyBudget;

    // 1) Parcela mínima de cada dívida ainda ativa.
    for (const d of ordered) {
      const bal = balances.get(d.groupId) ?? 0;
      if (bal <= 0) continue;
      const pay = Math.min(d.installmentAmount, bal, available);
      balances.set(d.groupId, bal - pay);
      available -= pay;
      if (available <= 0) break;
    }

    // 2) Sobra vai toda para a dívida foco da estratégia.
    for (const d of ordered) {
      if (available <= 0.005) break;
      const bal = balances.get(d.groupId) ?? 0;
      if (bal <= 0) continue;
      const pay = Math.min(available, bal);
      balances.set(d.groupId, bal - pay);
      available -= pay;
    }

    // 3) Registra o que foi quitado neste mês, na ordem da estratégia.
    for (const d of ordered) {
      if ((balances.get(d.groupId) ?? 0) > 0.005) continue;
      if (steps.some((s) => s.debt.groupId === d.groupId)) continue;
      steps.push({
        debt: d,
        payoffIndex: month,
        monthsSaved: Math.max(0, d.lastIndex - month),
        order: steps.length + 1,
      });
    }

    month += 1;
    guard += 1;
  }

  const freeIndex = steps.length
    ? steps.reduce((max, s) => Math.max(max, s.payoffIndex), steps[0].payoffIndex)
    : null;

  return {
    strategy,
    extraMonthly,
    steps,
    focusGroupId: ordered[0]?.groupId ?? null,
    freeIndex,
    baselineFreeIndex: baseline,
    totalDebt,
    monthsSaved:
      baseline !== null && freeIndex !== null ? Math.max(0, baseline - freeIndex) : 0,
  };
}

/**
 * Quanto a pessoa precisaria colocar por mês, além das parcelas, para zerar tudo
 * até o mês alvo. Usado no modo "quero estar livre em X".
 */
export function extraNeededForTarget(
  debts: PayoffDebt[],
  strategy: PayoffStrategy,
  startIndex: number,
  targetIndex: number
): number {
  const months = targetIndex - startIndex + 1;
  if (months <= 0 || debts.length === 0) return 0;

  const total = debts.reduce((s, d) => s + d.remainingTotal, 0);
  const currentMonthly = debts.reduce((s, d) => s + d.installmentAmount, 0);
  // Busca binária sobre o extra: a simulação é monótona (mais extra nunca atrasa).
  let lo = 0;
  let hi = Math.max(0, total / months - currentMonthly) + total;
  for (let i = 0; i < 40; i++) {
    const mid = (lo + hi) / 2;
    const plan = buildPayoffPlan(debts, strategy, mid, startIndex);
    if (plan.freeIndex !== null && plan.freeIndex <= targetIndex) hi = mid;
    else lo = mid;
  }
  return Math.ceil(hi);
}
