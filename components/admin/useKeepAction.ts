'use client';

import { createContext, useActionState, useContext, useTransition, type FormEvent } from 'react';

/** Pending state of the surrounding action form (SubmitButton reads it). */
export const FormPendingContext = createContext(false);

export function useFormPending(): boolean {
  return useContext(FormPendingContext);
}

/**
 * useActionState without React 19's automatic form reset. Server Actions here
 * report validation errors as a returned state, and a reset would wipe what the
 * user typed. The `action` attribute stays for progressive enhancement; with
 * JavaScript the submit is dispatched manually inside a transition.
 */
export function useKeepAction<S>(action: (prev: Awaited<S>, formData: FormData) => Promise<S>, initial: Awaited<S>) {
  const [state, formAction, actionPending] = useActionState<S, FormData>(action, initial);
  const [transitionPending, startTransition] = useTransition();
  const onSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const submitter = (event.nativeEvent as SubmitEvent).submitter as HTMLElement | null;
    const formData = new FormData(event.currentTarget, submitter);
    startTransition(() => formAction(formData));
  };
  return { state, pending: actionPending || transitionPending, formProps: { action: formAction, onSubmit } };
}
