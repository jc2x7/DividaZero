import { Category } from '../types';

/**
 * As categorias agora moram no banco (tabela `categories`), para o usuário
 * poder criar as suas. Esta lista é só o retrato das originais, usada enquanto
 * o banco ainda não respondeu e como referência de ícones/cores.
 *
 * Para ler categorias na UI use `useCategories()`, nunca esta constante.
 */
export const FALLBACK_CATEGORIES: Category[] = [
  { key: 'RENT', label: 'Aluguel', icon: 'home', color: '#FF6B6B' },
  { key: 'CAR', label: 'Carro', icon: 'car', color: '#4ECDC4' },
  { key: 'GYM', label: 'Academia', icon: 'dumbbell', color: '#45B7D1' },
  { key: 'FOOD', label: 'Alimentação', icon: 'food-fork-drink', color: '#96CEB4' },
  { key: 'HEALTH', label: 'Saúde', icon: 'medical-bag', color: '#FF9F43' },
  { key: 'EDUCATION', label: 'Educação', icon: 'school', color: '#A29BFE' },
  { key: 'ENTERTAINMENT', label: 'Lazer', icon: 'gamepad-variant', color: '#FD79A8' },
  { key: 'TRANSPORT', label: 'Transporte', icon: 'bus', color: '#FDCB6E' },
  { key: 'UTILITIES', label: 'Contas', icon: 'lightning-bolt', color: '#74B9FF' },
  { key: 'INVESTMENT', label: 'Investimento', icon: 'trending-up', color: '#00B894' },
  { key: 'OTHER', label: 'Outros', icon: 'dots-horizontal', color: '#B2BEC3' },
].map((c, i) => ({ ...c, sort_order: i, is_builtin: 1, is_archived: 0 }));

/** Ícones oferecidos ao criar uma categoria. */
export const CATEGORY_ICONS = [
  'tag-outline', 'home', 'car', 'dumbbell', 'food-fork-drink', 'medical-bag',
  'school', 'gamepad-variant', 'bus', 'lightning-bolt', 'trending-up',
  'cart-outline', 'gift-outline', 'paw', 'baby-carriage', 'airplane',
  'cellphone', 'hammer-wrench', 'tshirt-crew-outline', 'coffee-outline',
  'church', 'hand-heart-outline', 'scissors-cutting', 'book-open-variant',
];

/** Paleta oferecida ao criar uma categoria. */
export const CATEGORY_COLORS = [
  '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FF9F43', '#A29BFE',
  '#FD79A8', '#FDCB6E', '#74B9FF', '#00B894', '#B2BEC3', '#8B5CF6',
];
