'use client';

import { useEffect, useRef } from 'react';
import type { ActionState } from '@/lib/admin/action-state';
import { FormPendingContext, useFormPending, useKeepAction } from './useKeepAction';

type Action = (prev: ActionState, formData: FormData) => Promise<ActionState>;

export function SubmitButton({
  children,
  variant = 'primary',
  pendingLabel = 'Сохранение…',
  confirm,
  name,
  value,
}: {
  children: React.ReactNode;
  variant?: 'primary' | 'secondary' | 'danger';
  pendingLabel?: string;
  /** Asks for confirmation first (irreversible or destructive actions). */
  confirm?: string;
  name?: string;
  value?: string;
}) {
  const pending = useFormPending();
  const styles = {
    primary: 'bg-orange-accent text-white hover:bg-orange-light',
    secondary: 'border border-border-light bg-white hover:border-orange-accent',
    danger: 'border border-red-200 bg-white text-red-700 hover:bg-red-50',
  }[variant];
  return (
    <button
      type="submit"
      name={name}
      value={value}
      onClick={(event) => {
        if (confirm && !window.confirm(confirm)) event.preventDefault();
      }}
      disabled={pending}
      aria-disabled={pending}
      className={`px-4 py-2 rounded-xl text-sm font-semibold transition focus:outline-none focus-visible:ring-2 focus-visible:ring-orange-accent disabled:opacity-60 ${styles}`}
    >
      {pending ? pendingLabel : children}
    </button>
  );
}

/**
 * Form bound to a Server Action; shows the action's success or error message.
 * Input is kept on errors. `resetOnSuccess` clears create-forms (new user, comment, payment) after a successful save.
 */
export function ActionForm({
  action,
  children,
  className,
  resetOnSuccess = false,
}: {
  action: Action;
  children: React.ReactNode;
  className?: string;
  resetOnSuccess?: boolean;
}) {
  const { state, pending, formProps } = useKeepAction<ActionState>(action, {});
  const formRef = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (resetOnSuccess && state.ok) formRef.current?.reset();
  }, [state, resetOnSuccess]);
  return (
    <form ref={formRef} {...formProps} className={className} aria-busy={pending}>
      <FormPendingContext.Provider value={pending}>
        {children}
        {state.error && (
          <p role="alert" className="mt-3 text-sm text-red-700">
            {state.error}
          </p>
        )}
        {state.ok && state.message && (
          <p role="status" className="mt-3 text-sm text-green-700">
            {state.message}
          </p>
        )}
      </FormPendingContext.Provider>
    </form>
  );
}
