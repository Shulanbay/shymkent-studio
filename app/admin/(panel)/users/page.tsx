import { ActionForm, SubmitButton } from '@/components/admin/ActionForm';
import { ROLES, ROLE_LABELS } from '@/lib/auth/permissions';
import { PASSWORD_MIN_LENGTH } from '@/lib/auth/password';
import { requirePermission } from '@/lib/auth/session';
import { prisma } from '@/lib/db';
import { formatDateTime } from '@/lib/admin/format';
import { createUserAction, resetPasswordAction, updateUserAction } from './actions';

export const metadata = { title: 'Сотрудники' };

const inputClass =
  'w-full px-3 py-2 border border-border-light rounded-xl bg-white text-sm focus:outline-none focus:ring-2 focus:ring-brand-strong';

function RoleSelect({ id, defaultValue, disabled }: { id: string; defaultValue: string; disabled?: boolean }) {
  return (
    <select id={id} name="role" defaultValue={defaultValue} disabled={disabled} className={inputClass}>
      {ROLES.map((role) => (
        <option key={role} value={role}>
          {ROLE_LABELS[role]}
        </option>
      ))}
    </select>
  );
}

export default async function UsersPage() {
  const actor = await requirePermission('users:manage');
  const users = await prisma.user.findMany({
    orderBy: [{ active: 'desc' }, { createdAt: 'asc' }],
    select: { id: true, name: true, email: true, role: true, active: true, lastLoginAt: true },
  });

  return (
    <div className="space-y-8 max-w-5xl">
      <div>
        <h1 className="text-2xl md:text-3xl font-bold">Сотрудники</h1>
        <p className="text-text-secondary mt-1">Доступно только владельцу. Все изменения записываются в журнал действий.</p>
      </div>

      <section aria-labelledby="staff-list" className="space-y-3">
        <h2 id="staff-list" className="text-lg font-bold">
          Список
        </h2>
        {users.map((user) => {
          const isSelf = user.id === actor.id;
          return (
            <article key={user.id} className="bg-white border border-border-light rounded-card p-5">
              <div className="flex flex-wrap justify-between gap-2 mb-4">
                <div>
                  <p className="font-semibold">
                    {user.name} {isSelf && <span className="text-text-secondary font-normal">(вы)</span>}
                  </p>
                  <p className="text-sm text-text-secondary break-all">{user.email}</p>
                </div>
                <p className="text-sm text-text-secondary">Последний вход: {formatDateTime(user.lastLoginAt)}</p>
              </div>
              <div className="grid md:grid-cols-2 gap-4">
                <ActionForm action={updateUserAction} className="flex flex-wrap items-end gap-3">
                  <input type="hidden" name="userId" value={user.id} />
                  <div className="flex-1 min-w-[10rem]">
                    <label htmlFor={`role-${user.id}`} className="block text-xs font-semibold mb-1">
                      Роль
                    </label>
                    <RoleSelect id={`role-${user.id}`} defaultValue={user.role} disabled={isSelf} />
                  </div>
                  <label className="flex items-center gap-2 text-sm py-2">
                    <input type="checkbox" name="active" defaultChecked={user.active} disabled={isSelf} className="w-4 h-4" />
                    Активен
                  </label>
                  {!isSelf && <SubmitButton variant="secondary">Сохранить</SubmitButton>}
                </ActionForm>
                <ActionForm action={resetPasswordAction} resetOnSuccess className="flex flex-wrap items-end gap-3">
                  <input type="hidden" name="userId" value={user.id} />
                  <div className="flex-1 min-w-[10rem]">
                    <label htmlFor={`pw-${user.id}`} className="block text-xs font-semibold mb-1">
                      Новый пароль
                    </label>
                    <input
                      id={`pw-${user.id}`}
                      name="password"
                      type="password"
                      autoComplete="new-password"
                      minLength={PASSWORD_MIN_LENGTH}
                      required
                      className={inputClass}
                    />
                  </div>
                  <SubmitButton variant="secondary">Сменить пароль</SubmitButton>
                </ActionForm>
              </div>
            </article>
          );
        })}
      </section>

      <section aria-labelledby="new-user" className="bg-white border border-border-light rounded-card p-5">
        <h2 id="new-user" className="text-lg font-bold mb-4">
          Добавить сотрудника
        </h2>
        <ActionForm action={createUserAction} resetOnSuccess className="grid md:grid-cols-2 gap-4">
          <div>
            <label htmlFor="new-name" className="block text-xs font-semibold mb-1">
              Имя
            </label>
            <input id="new-name" name="name" required maxLength={100} className={inputClass} />
          </div>
          <div>
            <label htmlFor="new-email" className="block text-xs font-semibold mb-1">
              Email
            </label>
            <input id="new-email" name="email" type="email" required maxLength={254} autoComplete="off" className={inputClass} />
          </div>
          <div>
            <label htmlFor="new-role" className="block text-xs font-semibold mb-1">
              Роль
            </label>
            <RoleSelect id="new-role" defaultValue="OPERATOR" />
          </div>
          <div>
            <label htmlFor="new-password" className="block text-xs font-semibold mb-1">
              Начальный пароль (не короче {PASSWORD_MIN_LENGTH} символов)
            </label>
            <input
              id="new-password"
              name="password"
              type="password"
              required
              minLength={PASSWORD_MIN_LENGTH}
              autoComplete="new-password"
              className={inputClass}
            />
          </div>
          <div className="md:col-span-2">
            <SubmitButton>Добавить</SubmitButton>
          </div>
        </ActionForm>
      </section>
    </div>
  );
}
