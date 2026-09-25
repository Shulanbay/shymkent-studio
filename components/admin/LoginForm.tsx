'use client';

import { loginAction, type LoginState } from '@/app/admin/login/actions';
import { useKeepAction } from './useKeepAction';

function SubmitButton({ pending }: { pending: boolean }) {
  return (
    <button type="submit" className="btn-primary w-full disabled:opacity-60" disabled={pending} aria-disabled={pending}>
      {pending ? 'Вход…' : 'Войти'}
    </button>
  );
}

export function LoginForm({ next }: { next?: string }) {
  const { state, pending, formProps } = useKeepAction<LoginState>(loginAction, {});

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
          className="w-full px-4 py-3 border border-border-light rounded-card focus:outline-none focus:ring-2 focus:ring-orange-accent"
          aria-invalid={Boolean(state.error)}
          aria-describedby={state.error ? 'login-error' : undefined}
        />
      </div>
      <div>
        <label htmlFor="password" className="block text-sm font-semibold mb-2">
          Пароль
        </label>
        <input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          maxLength={256}
          className="w-full px-4 py-3 border border-border-light rounded-card focus:outline-none focus:ring-2 focus:ring-orange-accent"
          aria-invalid={Boolean(state.error)}
          aria-describedby={state.error ? 'login-error' : undefined}
        />
      </div>
      {state.error && (
        <p id="login-error" role="alert" className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-card px-4 py-3">
          {state.error}
        </p>
      )}
      <SubmitButton pending={pending} />
    </form>
  );
}
