import Link from 'next/link';
import { redirect } from 'next/navigation';
import { AuthShell } from '@/components/admin/AuthShell';
import { EmailLoginForm } from '@/components/admin/EmailLoginForm';
import { LoginForm } from '@/components/admin/LoginForm';
import { safeAdminRedirect } from '@/lib/auth/redirect';
import { getCurrentUser } from '@/lib/auth/session';

export const metadata = { title: 'Вход' };

// Default: sign in with a one-time link sent by email. Password sign-in stays
// available as a fallback (e.g. when email delivery is down).
export default async function AdminLoginPage(props: { searchParams: Promise<{ next?: string; method?: string }> }) {
  const searchParams = await props.searchParams;
  const next = searchParams.next ? safeAdminRedirect(searchParams.next) : undefined;
  if (await getCurrentUser()) redirect(next ?? '/admin');
  const password = searchParams.method === 'password';
  const switchHref = (method?: string) => {
    const q = new URLSearchParams();
    if (method) q.set('method', method);
    if (next) q.set('next', next);
    const s = q.toString();
    return s ? `/admin/login?${s}` : '/admin/login';
  };

  return (
    <AuthShell title="Вход для сотрудников">
      {password ? <LoginForm next={next} /> : <EmailLoginForm next={next} />}
      <p className="mt-6 pt-5 border-t border-border-light text-sm text-center">
        <Link href={password ? switchHref() : switchHref('password')} className="text-orange-accent font-semibold hover:underline">
          {password ? 'Войти по ссылке на почту' : 'Войти с паролем'}
        </Link>
      </p>
    </AuthShell>
  );
}
