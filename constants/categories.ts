import { ExpenseCategory } from '../types';

export interface CategoryConfig {
  value: ExpenseCategory;
  label: string;
  icon: string;
  color: string;
}

export const CATEGORIES: CategoryConfig[] = [
  { value: 'RENT', label: 'Aluguel', icon: 'home', color: '#FF6B6B' },
  { value: 'CAR', label: 'Carro', icon: 'car', color: '#4ECDC4' },
  { value: 'GYM', label: 'Academia', icon: 'dumbbell', color: '#45B7D1' },
  { value: 'FOOD', label: 'Alimentação', icon: 'food-fork-drink', color: '#96CEB4' },
  { value: 'HEALTH', label: 'Saúde', icon: 'medical-bag', color: '#FF9F43' },
  { value: 'EDUCATION', label: 'Educação', icon: 'school', color: '#A29BFE' },
  { value: 'ENTERTAINMENT', label: 'Lazer', icon: 'gamepad-variant', color: '#FD79A8' },
  { value: 'TRANSPORT', label: 'Transporte', icon: 'bus', color: '#FDCB6E' },
  { value: 'UTILITIES', label: 'Contas', icon: 'lightning-bolt', color: '#74B9FF' },
  { value: 'INVESTMENT', label: 'Investimento', icon: 'trending-up', color: '#00B894' },
  { value: 'OTHER', label: 'Outros', icon: 'dots-horizontal', color: '#B2BEC3' },
];

export const getCategoryConfig = (category: ExpenseCategory): CategoryConfig =>
  CATEGORIES.find((c) => c.value === category) ?? CATEGORIES[CATEGORIES.length - 1];
