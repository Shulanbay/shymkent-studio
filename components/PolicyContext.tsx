'use client';

import { createContext, useContext } from 'react';
import { DEFAULT_CANCELLATION_POLICY, type CancellationPolicy } from '@/lib/policy';

const PolicyContext = createContext<CancellationPolicy>(DEFAULT_CANCELLATION_POLICY);

export function PolicyProvider({ policy, children }: { policy: CancellationPolicy; children: React.ReactNode }) {
  return <PolicyContext.Provider value={policy}>{children}</PolicyContext.Provider>;
}

export function useCancellationPolicy() {
  return useContext(PolicyContext);
}
