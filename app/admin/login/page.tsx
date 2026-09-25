import { redirect } from 'next/navigation';
import { LoginForm } from '@/components/admin/LoginForm';
import { safeAdminRedirect } from '@/lib/auth/redirect';
import { getCurrentUser } from '@/lib/auth/session';

export const metadata = { title: 'Вход' };

export default async function AdminLoginPage(props: { searchParams: Promise<{ next?: string }> }) {
  const searchParams = await props.searchParams;
  const next = searchParams.next ? safeAdminRedirect(searchParams.next) : undefined;
  if (await getCurrentUser()) redirect(next ?? '/admin');

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-sm">
        <div className="flex items-center gap-3 mb-8 justify-center">
          <div className="w-9 h-9 bg-orange-accent rounded-lg flex items-center justify-center" aria-hidden="true">
            <span className="text-white font-bold text-lg">◉</span>
          </div>
          <span className="font-bold text-sm">SHYMKENT STUDIO · CRM</span>
        </div>
        <div className="bg-white rounded-card border border-border-light p-8">
          <h1 className="text-2xl font-bold mb-6">Вход для сотрудников</h1>
          <LoginForm next={next} />
        </div>
      </div>
    </div>
  );
}
