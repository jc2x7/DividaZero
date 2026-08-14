/**
 * Contas de antecipação de parcelas.
 *
 * Quando alguém pede para quitar uma compra parcelada antes do fim, a loja ou o
 * banco cobra um "valor de quitação" menor que a soma das parcelas que faltam —
 * porque os juros dos meses que não vão mais existir saem da conta. O que este
 * módulo faz é medir esse desconto e a taxa de juros que estava embutida.
 */

/** Precisão da busca pela taxa: 1e-7 ao mês é muito além do necessário. */
const TOL = 1e-7;
const MAX_ITER = 200;

export interface Antecipacao {
  /** Nº de parcelas que ainda faltam. */
  parcelasRestantes: number;
  /** Soma nominal das parcelas restantes. */
  totalSemAntecipar: number;
  /** Valor cobrado para quitar hoje. */
  valorQuitacao: number;
  /** Quanto se economiza pagando agora. */
  economia: number;
  /** Percentual de desconto sobre o total. */
  descontoPercentual: number;
  /**
   * Taxa mensal embutida no parcelamento, deduzida do fluxo de caixa.
   * `null` quando não dá para calcular (quitação ≥ soma das parcelas).
   */
  taxaMensal: number | null;
  taxaAnual: number | null;
  /** Verdadeiro quando a "antecipação" sai mais cara — vale avisar. */
  semVantagem: boolean;
}

/**
 * Taxa mensal implícita: resolve i em
 *
 *   VP = P · (1 − (1+i)^−n) / i
 *
 * onde VP é o valor para quitar hoje, P a parcela e n quantas faltam.
 * Não há fórmula fechada para i; a função é monótona decrescente em i, então
 * bisseção resolve com segurança e sem risco de divergir como Newton-Raphson.
 */
export function taxaImplicita(valorPresente: number, parcela: number, n: number): number | null {
  if (n <= 0 || parcela <= 0 || valorPresente <= 0) return null;
  // Quitar custa o mesmo (ou mais) que pagar tudo: não há juros a extrair.
  if (valorPresente >= parcela * n) return null;

  const vp = (i: number) => (i === 0 ? parcela * n : (parcela * (1 - Math.pow(1 + i, -n))) / i);

  let lo = 0;
  let hi = 1; // 100% ao mês — teto absurdo de propósito, só para cercar a raiz
  for (let k = 0; k < 60 && vp(hi) > valorPresente; k++) hi *= 2;

  for (let k = 0; k < MAX_ITER; k++) {
    const mid = (lo + hi) / 2;
    const v = vp(mid);
    if (Math.abs(v - valorPresente) < TOL) return mid;
    if (v > valorPresente) lo = mid;
    else hi = mid;
  }
  return (lo + hi) / 2;
}

export function calcularAntecipacao(
  parcela: number,
  parcelasRestantes: number,
  valorQuitacao: number
): Antecipacao {
  const total = parcela * parcelasRestantes;
  const economia = total - valorQuitacao;
  const taxaMensal = taxaImplicita(valorQuitacao, parcela, parcelasRestantes);

  return {
    parcelasRestantes,
    totalSemAntecipar: total,
    valorQuitacao,
    economia,
    descontoPercentual: total > 0 ? (economia / total) * 100 : 0,
    taxaMensal,
    taxaAnual: taxaMensal === null ? null : Math.pow(1 + taxaMensal, 12) - 1,
    semVantagem: economia <= 0,
  };
}

/**
 * Estimativa do valor de quitação quando a pessoa não tem a proposta em mãos,
 * mas sabe (ou chuta) a taxa do parcelamento. É o valor presente das parcelas
 * que faltam descontadas a essa taxa.
 */
export function valorQuitacaoEstimado(
  parcela: number,
  parcelasRestantes: number,
  taxaMensal: number
): number {
  if (taxaMensal <= 0) return parcela * parcelasRestantes;
  return (parcela * (1 - Math.pow(1 + taxaMensal, -parcelasRestantes))) / taxaMensal;
}

/** '2,49% a.m. · 34,3% a.a.' */
export function formatarTaxa(mensal: number | null, anual: number | null): string {
  if (mensal === null || anual === null) return '—';
  return `${(mensal * 100).toFixed(2).replace('.', ',')}% a.m. · ${(anual * 100)
    .toFixed(1)
    .replace('.', ',')}% a.a.`;
}
