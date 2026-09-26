'use client';

import { consumeEmailLinkAction, type ConsumeState } from '@/app/admin/login/email-actions';
import { useKeepAction } from './useKeepAction';

export function EmailLinkConfirm({ token, next }: { token: string; next?: string }) {
  const { state, pending, formProps } = useKeepAction<ConsumeState>(consumeEmailLinkAction, {});
  return (
    <form {...formProps} className="space-y-5">
      <input type="hidden" name="token" value={token} />
      {next && <input type="hidden" name="next" value={next} />}
      {state.error ? (
        <>
          <p role="alert" className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-card px-4 py-3">
            {state.error}
          </p>
          <a href="/admin/login" className="btn-secondary w-full">
            Запросить новую ссылку
          </a>
        </>
      ) : (
        <button type="submit" className="btn-primary w-full disabled:opacity-60" disabled={pending} aria-disabled={pending}>
          {pending ? 'Входим…' : 'Войти в CRM'}
        </button>
      )}
    </form>
  );
}
