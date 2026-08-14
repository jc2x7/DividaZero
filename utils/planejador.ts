import { PlanDebt, PlanPayment, PlanMonth, PlanRow } from '../types';

/**
 * Motor do planejador mês a mês.
 *
 * A ideia, herdada da planilha: cada dívida tem um saldo. Todo mês você decide
 * abater uma fatia dele (em % ou em reais). O que sobra vira o saldo de abertura
 * do mês seguinte. Não há parcela fixa — o ritmo é seu.
 *
 * O pagamento é guardado em **percentual**, não em reais. Assim, se você mudar o
 * valor original da dívida ou o quanto pagou num mês anterior, os meses
 * seguintes se recalculam sozinhos em vez de ficarem com números inconsistentes.
 */

export function proximoMes(mk: string): string {
  const [a, m] = mk.split('-').map(Number);
  return m >= 12 ? `${a + 1}-01` : `${a}-${String(m + 1).padStart(2, '0')}`;
}

export function mesAtualChave(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function r2(v: number): number {
  return Math.round((v + Number.EPSILON) * 100) / 100;
}

function clampPct(v: number): number {
  return Math.max(0, Math.min(100, Number.isFinite(v) ? v : 0));
}

/**
 * Calcula a situação de todas as dívidas em cada mês da lista.
 * `meses` precisa estar em ordem cronológica.
 */
export function calcularPlano(
  meses: string[],
  debts: PlanDebt[],
  payments: PlanPayment[]
): Record<string, PlanMonth> {
  const pagoPor = new Map<string, number>();
  for (const p of payments) pagoPor.set(`${p.debt_id}|${p.month}`, p.percent);

  // Saldo que atravessa os meses, por dívida.
  const corrente = new Map<number, number>();
  const resultado: Record<string, PlanMonth> = {};

  for (const mk of meses) {
    const linhas: PlanRow[] = [];
    let totalPago = 0;
    let totalRestante = 0;
    let totalOriginal = 0;

    for (const d of debts) {
      // Dívida que ainda não começou não aparece no mês.
      if (d.start_month > mk) continue;
      if (!corrente.has(d.id)) corrente.set(d.id, r2(d.amount));

      const saldoInicial = corrente.get(d.id)!;
      const percent = clampPct(pagoPor.get(`${d.id}|${mk}`) ?? 0);
      const pago = r2((saldoInicial * percent) / 100);
      const saldoFinal = r2(saldoInicial - pago);

      linhas.push({
        debt: d,
        saldoInicial,
        percent,
        pago,
        saldoFinal,
        quitadaAntes: saldoInicial === 0,
      });

      totalPago = r2(totalPago + pago);
      totalRestante = r2(totalRestante + saldoFinal);
      totalOriginal = r2(totalOriginal + d.amount);
      corrente.set(d.id, saldoFinal);
    }

    resultado[mk] = { month: mk, linhas, totalPago, totalRestante, totalOriginal };
  }

  return resultado;
}

/**
 * Converte um valor em reais para o percentual equivalente do saldo, que é como
 * o pagamento é armazenado. Saldo zerado devolve 0 — não há o que abater.
 */
export function valorParaPercentual(valor: number, saldoInicial: number): number {
  if (saldoInicial <= 0) return 0;
  return clampPct((valor / saldoInicial) * 100);
}

/**
 * Mês em que a última dívida é quitada, seguindo os percentuais informados.
 * `null` se ainda sobra saldo no fim da lista de meses.
 */
export function mesDeQuitacao(plano: Record<string, PlanMonth>, meses: string[]): string | null {
  for (const mk of meses) {
    const m = plano[mk];
    if (m && m.linhas.length > 0 && m.totalRestante <= 0.005) return mk;
  }
  return null;
}
