/**
 * Format a number as Brazilian Real currency
 */
export const formatCurrency = (value: number): string => {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
};

/**
 * Format a number as percentage
 */
export const formatPercent = (value: number, decimals = 2): string => {
  return `${value.toFixed(decimals)}%`;
};

/**
 * Parse a Brazilian currency string back to number
 */
export const parseCurrency = (value: string): number => {
  const cleaned = value.replace(/[R$\s.]/g, '').replace(',', '.');
  const parsed = parseFloat(cleaned);
  return isNaN(parsed) ? 0 : parsed;
};

/**
 * Format a phone number for display (XX) XXXXX-XXXX
 */
export const formatPhone = (phone: string): string => {
  const digits = phone.replace(/\D/g, '');
  if (digits.length === 11) {
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
  }
  if (digits.length === 10) {
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
  }
  return phone;
};

/**
 * Get month name in Portuguese
 */
export const getMonthName = (month: number): string => {
  const months = [
    'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
    'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
  ];
  return months[month - 1] ?? '';
};

/**
 * Get short month name in Portuguese
 */
export const getMonthShortName = (month: number): string => {
  const months = [
    'Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun',
    'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez',
  ];
  return months[month - 1] ?? '';
};

/**
 * Format date string YYYY-MM-DD to DD/MM/YYYY
 */
export const formatDate = (dateStr: string): string => {
  if (!dateStr) return '';
  const [year, month, day] = dateStr.split('-');
  return `${day}/${month}/${year}`;
};

/**
 * Get today as YYYY-MM-DD
 */
export const getTodayString = (): string => {
  const today = new Date();
  return today.toISOString().split('T')[0];
};

/**
 * Valor compacto para eixos de gráfico: 1.2k, 18k, 1,4M.
 */
export const formatCompact = (value: number): string => {
  const abs = Math.abs(value);
  if (abs >= 1_000_000) return `${(value / 1_000_000).toFixed(1).replace('.', ',')}M`;
  if (abs >= 1_000) return `${Math.round(value / 1_000)}k`;
  return String(Math.round(value));
};

// ── Índice absoluto de mês ────────────────────────────────────
// Muitos cálculos (parcelas, plano de quitação, séries temporais) ficam triviais
// se o par ano/mês virar um único inteiro contínuo.

export const monthIndex = (year: number, month: number): number => year * 12 + month - 1;

export const fromMonthIndex = (index: number): { year: number; month: number } => ({
  year: Math.floor(index / 12),
  month: (index % 12) + 1,
});

export const currentMonthIndex = (): number => {
  const now = new Date();
  return monthIndex(now.getFullYear(), now.getMonth() + 1);
};

/** 'Mar/26' — rótulo curto para eixos e listas. */
export const formatMonthIndex = (index: number): string => {
  const { year, month } = fromMonthIndex(index);
  return `${getMonthShortName(month)}/${String(year).slice(2)}`;
};

/** 'Março de 2026' — rótulo por extenso. */
export const formatMonthIndexLong = (index: number): string => {
  const { year, month } = fromMonthIndex(index);
  return `${getMonthName(month)} de ${year}`;
};

/** '3 anos e 2 meses' / '5 meses' — duração legível. */
export const formatDuration = (months: number): string => {
  if (months <= 0) return 'agora';
  const y = Math.floor(months / 12);
  const m = months % 12;
  const parts: string[] = [];
  if (y > 0) parts.push(`${y} ${y === 1 ? 'ano' : 'anos'}`);
  if (m > 0) parts.push(`${m} ${m === 1 ? 'mês' : 'meses'}`);
  return parts.join(' e ');
};

// ── Máscara de moeda ──────────────────────────────────────────
// A digitação entra pelos centavos e empurra para a esquerda: 5 → 0,05,
// 50 → 0,50, 500 → 5,00. Assim ninguém precisa procurar a vírgula no teclado.

/** Quantos dígitos a máscara aceita — 12 dá até 9.999.999.999,99. */
const MAX_DIGITOS = 12;

/** Só os dígitos que a máscara considera, já limitados. */
export const somenteDigitos = (texto: string): string =>
  texto.replace(/\D/g, '').replace(/^0+(?=\d)/, '').slice(0, MAX_DIGITOS);

/** '12345' → '123,45'. String vazia devolve vazio, para o placeholder aparecer. */
export const digitosParaTexto = (digitos: string): string => {
  if (!digitos) return '';
  return (parseInt(digitos, 10) / 100).toLocaleString('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
};

/** '12345' → 123.45 */
export const digitosParaNumero = (digitos: string): number =>
  digitos ? parseInt(digitos, 10) / 100 : 0;

/** 123.45 → '12345'. Zero vira vazio, para o campo não nascer preenchido. */
export const numeroParaDigitos = (valor: number): string => {
  if (!valor || !isFinite(valor) || valor <= 0) return '';
  return String(Math.round(valor * 100)).slice(0, MAX_DIGITOS);
};

/**
 * Apply currency mask to input value
 * @deprecated use o componente `MoneyInput`
 */
export const applyCurrencyMask = (value: string): string => {
  const digits = somenteDigitos(value);
  if (!digits) return '';
  return formatCurrency(digitosParaNumero(digits));
};
