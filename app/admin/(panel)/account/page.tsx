import { ActionForm, SubmitButton } from '@/components/admin/ActionForm';
import { ROLE_LABELS } from '@/lib/auth/permissions';
import { PASSWORD_MIN_LENGTH } from '@/lib/auth/password';
import { requireUser } from '@/lib/auth/session';
import { changeOwnPasswordAction } from './actions';

export const metadata = { title: 'Мой аккаунт' };

const inputClass =
  'w-full px-3 py-2 border border-border-light rounded-xl bg-white text-sm focus:outline-none focus:ring-2 focus:ring-orange-accent';

export default async function AccountPage() {
  const user = await requireUser();
  return (
    <div className="space-y-8 max-w-xl">
      <div>
        <h1 className="text-2xl md:text-3xl font-bold">Мой аккаунт</h1>
        <p className="text-text-secondary mt-1 break-all">
          {user.name} · {user.email} · {ROLE_LABELS[user.role]}
        </p>
      </div>
      <section aria-labelledby="pw-heading" className="bg-white border border-border-light rounded-card p-5">
        <h2 id="pw-heading" className="text-lg font-bold mb-4">
          Сменить пароль
        </h2>
        <ActionForm action={changeOwnPasswordAction} resetOnSuccess className="space-y-4">
          <div>
            <label htmlFor="currentPassword" className="block text-xs font-semibold mb-1">
              Текущий пароль
            </label>
            <input id="currentPassword" name="currentPassword" type="password" autoComplete="current-password" required className={inputClass} />
          </div>
          <div>
            <label htmlFor="newPassword" className="block text-xs font-semibold mb-1">
              Новый пароль (не короче {PASSWORD_MIN_LENGTH} символов)
            </label>
            <input
              id="newPassword"
              name="newPassword"
              type="password"
              autoComplete="new-password"
              minLength={PASSWORD_MIN_LENGTH}
              required
              className={inputClass}
            />
          </div>
          <div>
            <label htmlFor="confirmPassword" className="block text-xs font-semibold mb-1">
              Повторите новый пароль
            </label>
            <input id="confirmPassword" name="confirmPassword" type="password" autoComplete="new-password" required className={inputClass} />
          </div>
          <SubmitButton>Сменить пароль</SubmitButton>
        </ActionForm>
      </section>
    </div>
  );
}
