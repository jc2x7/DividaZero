/**
 * Desconto de antecipação, parcela por parcela.
 *
 * Quando alguém quita uma compra parcelada antes do fim, cada parcela vale
 * menos hoje do que o valor de face — porque os juros dos meses que faltam
 * deixam de correr. Quanto mais longe o vencimento, maior o desconto.
 *
 * A conta é valor presente:
 *
 *     VP = P / (1 + i)^(dias/30)
 *
 * O expoente usa dias corridos, e não meses inteiros, porque é assim que banco
 * e financeira calculam — e porque é o dia de vencimento que determina quanto
 * de juro já correu.
 */

/** Um dia em milissegundos. */
const DIA_MS = 86_400_000;

export interface ParcelaAberta {
  id: number;
  /** Nº da parcela dentro da compra (3 de 12). */
  numero: number;
  total: number;
  valor: number;
  /** Data de vencimento em 'YYYY-MM-DD'. */
  vencimento: string;
}

export interface ParcelaDescontada extends ParcelaAberta {
  dias: number;
  valorHoje: number;
  desconto: number;
}

export interface SimulacaoQuitacao {
  taxaMensal: number;
  parcelas: ParcelaDescontada[];
  /** Soma dos valores de face. */
  totalNominal: number;
  /** Soma dos valores presentes: o que custa quitar tudo hoje. */
  totalHoje: number;
  descontoTotal: number;
  descontoPercentual: number;
}

/** Meia-noite local, para a diferença de dias não oscilar com o horário. */
function meiaNoite(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

export function diasEntre(de: Date, ate: Date): number {
  return Math.round((meiaNoite(ate).getTime() - meiaNoite(de).getTime()) / DIA_MS);
}

/**
 * Monta a data de vencimento de uma parcela.
 *
 * Dia 31 em mês de 30 (ou fevereiro) não existe: o vencimento cai no último dia
 * do mês, que é o que banco e boleto fazem.
 */
export function vencimentoDe(ano: number, mes: number, dia: number): string {
  const ultimoDia = new Date(ano, mes, 0).getDate();
  const d = Math.min(Math.max(1, dia || 1), ultimoDia);
  return `${ano}-${String(mes).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

/**
 * 'YYYY-MM-DD' para Date local.
 *
 * O parse é manual de propósito: o Hermes (motor do React Native) não aceita
 * todos os formatos de string que o V8 aceita, e `new Date('2027/02/18')`
 * devolve Invalid Date lá — o que virava NaN na tela.
 */
function paraData(iso: string): Date {
  const [a, m, d] = iso.split('-').map(Number);
  return new Date(a, (m || 1) - 1, d || 1);
}

/** Dias corridos entre hoje e um vencimento em 'YYYY-MM-DD'. */
export function diasAteVencimento(iso: string, hoje = new Date()): number {
  return diasEntre(hoje, paraData(iso));
}

/**
 * Deduz a taxa mensal a partir do que o credor cobra para quitar **uma**
 * parcela específica — normalmente a última, a mais descontada.
 *
 *     valorHoje = P / (1+i)^(dias/30)   ⇒   i = (P / valorHoje)^(30/dias) − 1
 *
 * Devolve `null` quando a conta não tem sentido: sem prazo, sem desconto, ou
 * com "desconto" negativo (o credor cobrando mais para antecipar).
 */
export function taxaPelaParcela(
  valorParcela: number,
  valorHoje: number,
  dias: number
): number | null {
  if (dias <= 0 || valorParcela <= 0 || valorHoje <= 0) return null;
  if (valorHoje >= valorParcela) return null;
  return Math.pow(valorParcela / valorHoje, 30 / dias) - 1;
}

/**
 * Aplica a taxa a todas as parcelas em aberto e devolve o custo real de quitar
 * hoje. Parcela já vencida não ganha desconto — juro que já correu não volta.
 */
export function simularQuitacao(
  parcelas: ParcelaAberta[],
  taxaMensal: number,
  hoje = new Date()
): SimulacaoQuitacao {
  const detalhadas: ParcelaDescontada[] = parcelas.map((p) => {
    const dias = Math.max(0, diasEntre(hoje, paraData(p.vencimento)));
    const valorHoje =
      dias === 0 ? p.valor : p.valor / Math.pow(1 + taxaMensal, dias / 30);
    return {
      ...p,
      dias,
      valorHoje: Math.round(valorHoje * 100) / 100,
      desconto: Math.round((p.valor - valorHoje) * 100) / 100,
    };
  });

  const totalNominal = detalhadas.reduce((s, p) => s + p.valor, 0);
  const totalHoje = detalhadas.reduce((s, p) => s + p.valorHoje, 0);
  const descontoTotal = totalNominal - totalHoje;

  return {
    taxaMensal,
    parcelas: detalhadas,
    totalNominal: Math.round(totalNominal * 100) / 100,
    totalHoje: Math.round(totalHoje * 100) / 100,
    descontoTotal: Math.round(descontoTotal * 100) / 100,
    descontoPercentual: totalNominal > 0 ? (descontoTotal / totalNominal) * 100 : 0,
  };
}

/**
 * Caminho completo: o usuário informa quanto o credor cobra para quitar a
 * última parcela, e daí sai o valor de quitação da compra inteira.
 */
export function simularPelaUltimaParcela(
  parcelas: ParcelaAberta[],
  valorUltimaHoje: number,
  hoje = new Date()
): SimulacaoQuitacao | null {
  if (parcelas.length === 0) return null;
  const ultima = parcelas.reduce((a, b) =>
    paraData(b.vencimento) > paraData(a.vencimento) ? b : a
  );
  const dias = diasEntre(hoje, paraData(ultima.vencimento));
  const taxa = taxaPelaParcela(ultima.valor, valorUltimaHoje, dias);
  if (taxa === null) return null;
  return simularQuitacao(parcelas, taxa, hoje);
}

/** '2,49% a.m.' */
export function formatarTaxaMensal(i: number): string {
  return `${(i * 100).toFixed(2).replace('.', ',')}% a.m.`;
}

/** Equivalente anual da taxa mensal. */
export function taxaAnual(mensal: number): number {
  return Math.pow(1 + mensal, 12) - 1;
}
