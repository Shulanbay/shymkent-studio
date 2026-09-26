import { redirect } from 'next/navigation';
import { AuthShell } from '@/components/admin/AuthShell';
import { EmailLinkConfirm } from '@/components/admin/EmailLinkConfirm';
import { safeAdminRedirect } from '@/lib/auth/redirect';
import { getCurrentUser } from '@/lib/auth/session';

export const metadata = { title: 'Вход по ссылке', referrer: 'no-referrer' as const };

// Opened from the sign-in email. Nothing happens on GET (email scanners open
// links automatically); the link is used only when the person presses the button.
export default async function VerifyEmailLinkPage(props: { searchParams: Promise<{ token?: string; next?: string }> }) {
  const searchParams = await props.searchParams;
  const next = searchParams.next ? safeAdminRedirect(searchParams.next) : undefined;
  if (await getCurrentUser()) redirect(next ?? '/admin');
  const token = typeof searchParams.token === 'string' && /^[A-Za-z0-9_-]{20,128}$/.test(searchParams.token) ? searchParams.token : null;

  return (
    <AuthShell title="Вход в CRM">
      {token ? (
        <>
          <p className="text-sm text-text-secondary mb-5">Нажмите кнопку, чтобы войти. Ссылка сработает один раз.</p>
          <EmailLinkConfirm token={token} next={next} />
        </>
      ) : (
        <>
          <p role="alert" className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-card px-4 py-3 mb-5">
            Ссылка неполная или повреждена. Запросите новую.
          </p>
          <a href="/admin/login" className="btn-secondary w-full">
            Запросить новую ссылку
          </a>
        </>
      )}
    </AuthShell>
  );
}
