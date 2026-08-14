import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { Category, ExpenseCategory } from '../types';
import { getCategories } from '../database/database';
import { FALLBACK_CATEGORIES } from '../constants/categories';

interface CategoriesContextValue {
  /** Categorias ativas, na ordem de exibição. */
  categories: Category[];
  /** Inclui as arquivadas — usado para rotular lançamentos antigos. */
  all: Category[];
  get: (key: ExpenseCategory) => Category;
  reload: () => Promise<void>;
  loading: boolean;
}

const DESCONHECIDA: Category = {
  key: 'OTHER',
  label: 'Outros',
  icon: 'dots-horizontal',
  color: '#B2BEC3',
  sort_order: 999,
  is_builtin: 1,
  is_archived: 0,
};

const CategoriesContext = createContext<CategoriesContextValue>({
  categories: FALLBACK_CATEGORIES,
  all: FALLBACK_CATEGORIES,
  get: () => DESCONHECIDA,
  reload: async () => {},
  loading: true,
});

export function CategoriesProvider({ children }: { children: React.ReactNode }) {
  const [all, setAll] = useState<Category[]>(FALLBACK_CATEGORIES);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    try {
      const rows = await getCategories(true);
      if (rows.length) setAll(rows);
    } catch {
      // Banco ainda não pronto — segue com as categorias originais.
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    reload();
  }, [reload]);

  const value = useMemo<CategoriesContextValue>(() => {
    const index = new Map(all.map((c) => [c.key, c]));
    return {
      all,
      categories: all.filter((c) => c.is_archived === 0),
      // Categoria removida do banco mas ainda usada por um lançamento antigo
      // não pode quebrar a tela: cai em "Outros".
      get: (key) => index.get(key) ?? DESCONHECIDA,
      reload,
      loading,
    };
  }, [all, reload, loading]);

  return <CategoriesContext.Provider value={value}>{children}</CategoriesContext.Provider>;
}

export function useCategories() {
  return useContext(CategoriesContext);
}
