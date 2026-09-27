import { logoutAction } from '@/app/admin/actions';
import { AdminNav, type NavItem } from '@/components/admin/AdminNav';
import { ROLE_LABELS, hasPermission, type Permission } from '@/lib/auth/permissions';
import { requireUser } from '@/lib/auth/session';

// Sections are shown only to roles that may open them; every page re-checks the permission on the server.
const NAV: (NavItem & { permission?: Permission })[] = [
  { href: '/admin', label: 'Обзор', permission: 'dashboard:view' },
  { href: '/admin/leads', label: 'Лиды', permission: 'leads:view' },
  { href: '/admin/bookings', label: 'Заказы', permission: 'bookings:view' },
  { href: '/admin/calendar', label: 'Календарь', permission: 'calendar:view' },
  // The ledger (all clients' payments) is for roles that handle money; OPERATOR/EDITOR see payment status on their bookings/tasks only.
  { href: '/admin/payments', label: 'Платежи', permission: 'payments:manage' },
  { href: '/admin/production', label: 'Production', permission: 'production:view' },
  { href: '/admin/tours', label: 'Туры', permission: 'tours:view' },
  { href: '/admin/clients', label: 'Клиенты', permission: 'clients:view' },
  { href: '/admin/integrations', label: 'Интеграции', permission: 'integrations:view' },
  { href: '/admin/users', label: 'Сотрудники', permission: 'users:manage' },
  { href: '/admin/settings', label: 'Настройки', permission: 'settings:view' },
  { href: '/admin/account', label: 'Мой аккаунт' },
];

export default async function AdminPanelLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  const items = NAV.filter((item) => !item.permission || hasPermission(user.role, item.permission)).map(
    ({ href, label }) => ({ href, label }),
  );

  return (
    <div className="md:flex min-h-screen">
      <aside className="bg-black text-white md:w-60 md:min-h-screen md:flex md:flex-col p-4 gap-6">
        <div className="flex items-center gap-3 mb-4 md:mb-6">
          <div className="w-8 h-8 bg-brand-gradient rounded-lg flex items-center justify-center" aria-hidden="true">
            <span className="text-white font-bold">◉</span>
          </div>
          <span className="font-bold text-sm">SHYMKENT CRM</span>
        </div>
        <AdminNav items={items} />
        <div className="mt-4 md:mt-auto pt-4 border-t border-gray-800 text-sm">
          <p className="font-semibold truncate">{user.name}</p>
          <p className="text-gray-400 text-xs mb-3">{ROLE_LABELS[user.role]}</p>
          <form action={logoutAction}>
            <button
              type="submit"
              className="text-gray-300 hover:text-white underline-offset-4 hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-strong rounded"
            >
              Выйти
            </button>
          </form>
        </div>
      </aside>
      <main className="flex-1 p-4 md:p-8 min-w-0">{children}</main>
    </div>
  );
}
