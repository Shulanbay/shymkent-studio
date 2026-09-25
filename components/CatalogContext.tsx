'use client';

import { createContext, useContext } from 'react';
import type { PublicCatalog, PublicService } from '@/lib/catalog-types';

const CatalogContext = createContext<PublicCatalog | null>(null);

export function CatalogProvider({ catalog, children }: { catalog: PublicCatalog; children: React.ReactNode }) {
  return <CatalogContext.Provider value={catalog}>{children}</CatalogContext.Provider>;
}

export function useCatalog(): PublicCatalog {
  const catalog = useContext(CatalogContext);
  if (!catalog) throw new Error('useCatalog must be used within CatalogProvider');
  return catalog;
}

export function useService(slug: string): PublicService | undefined {
  return useCatalog().services.find((s) => s.slug === slug);
}

export function formatPrice(value: number): string {
  return value.toLocaleString('ru-RU').replace(/ /g, ' ');
}
