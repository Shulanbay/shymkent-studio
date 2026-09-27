import Link from 'next/link';

export const metadata = { title: 'Нет доступа' };

export default function ForbiddenPage() {
  return (
    <div className="max-w-lg">
      <h1 className="text-2xl font-bold mb-3">Нет доступа</h1>
      <p className="text-text-secondary mb-6">
        У вашей роли нет прав на этот раздел. Если доступ нужен для работы, обратитесь к владельцу студии.
      </p>
      <Link href="/admin" className="text-brand-ink font-semibold hover:underline">
        Вернуться к обзору
      </Link>
    </div>
  );
}
