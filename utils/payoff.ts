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

/** 'YYYY-MM' a partir do índice absoluto de mês. */
function chaveMes(index: number): string {
  return `${Math.floor(index / 12)}-${String((index % 12) + 1).padStart(2, '0')}`;
}

/**
 * Simula a quitação acelerada.
 *
 * A base do orçamento é fixa: a soma de todas as parcelas atuais. Conforme uma
 * dívida é quitada, a parcela dela não some do orçamento — é redirecionada para
 * a próxima da fila. Daí o efeito bola de neve, e por isso o plano acelera mesmo
 * sem nenhum extra. Sobre essa base entra o valor extra daquele mês.
 *
 * Parcelas de compras futuras (que ainda nem começaram a ser cobradas) entram no
 * saldo total: antecipar é sempre permitido, então o simulador não bloqueia o
 * pagamento por data.
 */
export function buildPayoffPlan(
  debts: PayoffDebt[],
  strategy: PayoffStrategy,
  /** Valor extra por mês, indexado por 'YYYY-MM'. Mês ausente = sem extra. */
  extras: Record<string, number>,
  startIndex: number,
  /**
   * Dívida escolhida à mão para receber a sobra em cada mês ('YYYY-MM' → groupId).
   * Onde não houver escolha, vale a ordem da estratégia.
   */
  allocations: Record<string, string> = {}
): PayoffPlan {
  const baseline = baselineFreeIndex(debts);
  const totalDebt = debts.reduce((s, d) => s + d.remainingTotal, 0);
  const extraTotal = Object.values(extras).reduce((s, v) => s + Math.max(0, v || 0), 0);

  if (debts.length === 0) {
    return {
      strategy,
      extras,
      extraTotal: 0,
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

  // A soma das parcelas atuais continua saindo do bolso mesmo depois de uma
  // dívida acabar — é o que produz o efeito bola de neve. O extra do mês entra
  // por cima disso.
  const parcelasHoje = debts.reduce((s, d) => s + d.installmentAmount, 0);

  const steps: PayoffStep[] = [];
  let month = startIndex;
  let guard = 0;

  while (steps.length < ordered.length && guard < MAX_MONTHS) {
    const mk = chaveMes(month);
    let available = parcelasHoje + Math.max(0, extras[mk] ?? 0);

    // 1) Parcela mínima de cada dívida ainda ativa.
    for (const d of ordered) {
      const bal = balances.get(d.groupId) ?? 0;
      if (bal <= 0) continue;
      const pay = Math.min(d.installmentAmount, bal, available);
      balances.set(d.groupId, bal - pay);
      available -= pay;
      if (available <= 0) break;
    }

    // 2) A sobra vai para a dívida que o usuário escolheu neste mês; sem
    //    escolha (ou já quitada), segue a ordem da estratégia.
    const escolhida = allocations[mk];
    const fila = escolhida
      ? [
          ...ordered.filter((d) => d.groupId === escolhida),
          ...ordered.filter((d) => d.groupId !== escolhida),
        ]
      : ordered;

    for (const d of fila) {
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

  // Foco de agora: o que o usuário escolheu para este mês, ou o primeiro da fila.
  const mkAgora = chaveMes(startIndex);
  const focoEscolhido = allocations[mkAgora];
  const focusGroupId =
    (focoEscolhido && ordered.some((d) => d.groupId === focoEscolhido)
      ? focoEscolhido
      : ordered[0]?.groupId) ?? null;

  return {
    strategy,
    extras,
    extraTotal,
    steps,
    focusGroupId,
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
  // Testa um extra constante em todos os meses do horizonte.
  const comExtraFixo = (valor: number) => {
    const extras: Record<string, number> = {};
    for (let k = 0; k <= months + 12; k++) {
      const idx = startIndex + k;
      extras[`${Math.floor(idx / 12)}-${String((idx % 12) + 1).padStart(2, '0')}`] = valor;
    }
    return buildPayoffPlan(debts, strategy, extras, startIndex);
  };

  for (let i = 0; i < 40; i++) {
    const mid = (lo + hi) / 2;
    const plan = comExtraFixo(mid);
    if (plan.freeIndex !== null && plan.freeIndex <= targetIndex) hi = mid;
    else lo = mid;
  }
  return Math.ceil(hi);
}
