'use client';

import { requestEmailLinkAction, type EmailLinkState } from '@/app/admin/login/email-actions';
import { useKeepAction } from './useKeepAction';

const inputClass = 'w-full px-4 py-3 border border-border-light rounded-card focus:outline-none focus:ring-2 focus:ring-brand-strong';

export function EmailLoginForm({ next }: { next?: string }) {
  const { state, pending, formProps } = useKeepAction<EmailLinkState>(requestEmailLinkAction, {});

  if (state.sent) {
    return (
      <div role="status" className="space-y-3">
        <p className="font-semibold">Проверьте почту</p>
        <p className="text-sm text-text-secondary">
          Если <strong className="text-text-primary break-all">{state.email}</strong> — адрес сотрудника студии, на него отправлена ссылка для
          входа. Она действует 15 минут и работает один раз.
        </p>
        <p className="text-sm text-text-secondary">Письма нет через пару минут? Проверьте папку «Спам» или запросите ссылку снова.</p>
        <a href={next ? `/admin/login?next=${encodeURIComponent(next)}` : '/admin/login'} className="inline-block text-sm font-semibold text-brand-ink hover:underline">
          Отправить ещё раз
        </a>
      </div>
    );
  }

  return (
    <form {...formProps} className="space-y-5" noValidate>
      {next && <input type="hidden" name="next" value={next} />}
      <div>
        <label htmlFor="email" className="block text-sm font-semibold mb-2">
          Email
        </label>
        <input
          id="email"
          name="email"
          type="email"
          autoComplete="username"
          required
          maxLength={254}
          className={inputClass}
          aria-invalid={Boolean(state.error)}
          aria-describedby={state.error ? 'email-login-error' : 'email-login-hint'}
        />
        <p id="email-login-hint" className="text-xs text-text-secondary mt-2">
          Мы отправим на этот адрес ссылку для входа — пароль не нужен.
        </p>
      </div>
      {state.error && (
        <p id="email-login-error" role="alert" className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-card px-4 py-3">
          {state.error}
        </p>
      )}
      <button type="submit" className="btn-primary w-full disabled:opacity-60" disabled={pending} aria-disabled={pending}>
        {pending ? 'Отправляем…' : 'Получить ссылку для входа'}
      </button>
    </form>
  );
}
