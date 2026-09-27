'use client';

import Link from 'next/link';
import { useEffect } from 'react';

export default function AdminError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error('[admin] render error', error.digest ?? '');
  }, [error]);
  return (
    <div className="max-w-xl bg-white border border-border-light rounded-card p-6 md:p-8" role="alert">
      <h1 className="text-2xl font-bold mb-2">Не удалось открыть страницу</h1>
      <p className="text-text-secondary mb-2">Произошла ошибка на сервере. Данные не потеряны — попробуйте обновить страницу.</p>
      {error.digest && (
        <p className="text-xs text-text-secondary mb-6">
          Код ошибки для поддержки: <code>{error.digest}</code>
        </p>
      )}
      <div className="flex flex-wrap gap-3">
        <button type="button" onClick={reset} className="px-4 py-2 rounded-xl text-sm font-semibold bg-brand-gradient text-on-brand">
          Повторить
        </button>
        <Link href="/admin" className="px-4 py-2 rounded-xl text-sm font-semibold border border-border-light bg-white">
          На главную CRM
        </Link>
      </div>
    </div>
  );
}
