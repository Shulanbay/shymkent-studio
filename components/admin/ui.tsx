import Link from 'next/link';

export const inputClass =
  'w-full px-3 py-2 border border-border-light rounded-xl bg-white text-sm focus:outline-none focus:ring-2 focus:ring-brand-strong disabled:bg-bg-light';
export const labelClass = 'block text-xs font-semibold mb-1';
export const cardClass = 'bg-white border border-border-light rounded-card p-4 md:p-5';
export const linkButtonClass =
  'inline-block px-4 py-2 rounded-xl text-sm font-semibold border border-border-light bg-white hover:border-brand focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-strong';

export function Badge({ className, children }: { className: string; children: React.ReactNode }) {
  return <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-semibold whitespace-nowrap ${className}`}>{children}</span>;
}

export function PageHeader({ title, description, actions }: { title: string; description?: string; actions?: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="text-2xl md:text-3xl font-bold">{title}</h1>
        {description && <p className="text-text-secondary mt-1">{description}</p>}
      </div>
      {actions}
    </div>
  );
}

export function EmptyState({ children }: { children: React.ReactNode }) {
  return <p className="text-text-secondary text-sm py-6 text-center">{children}</p>;
}

/** Pagination links that keep the current filters. */
export function Pagination({
  basePath,
  params,
  page,
  pages,
  total,
}: {
  basePath: string;
  params: Record<string, string | undefined>;
  page: number;
  pages: number;
  total: number;
}) {
  const href = (p: number) => {
    const search = new URLSearchParams();
    for (const [k, v] of Object.entries(params)) if (v && k !== 'page') search.set(k, v);
    if (p > 1) search.set('page', String(p));
    const qs = search.toString();
    return qs ? `${basePath}?${qs}` : basePath;
  };
  return (
    <nav aria-label="Страницы" className="flex flex-wrap items-center justify-between gap-3 text-sm">
      <span className="text-text-secondary">Всего: {total}</span>
      <div className="flex items-center gap-2">
        {page > 1 ? (
          <Link href={href(page - 1)} className={linkButtonClass} rel="prev">
            ← Назад
          </Link>
        ) : null}
        <span className="text-text-secondary">
          {page} / {pages}
        </span>
        {page < pages ? (
          <Link href={href(page + 1)} className={linkButtonClass} rel="next">
            Вперёд →
          </Link>
        ) : null}
      </div>
    </nav>
  );
}

export function Field({ id, label, children }: { id: string; label: string; children: React.ReactNode }) {
  return (
    <div>
      <label htmlFor={id} className={labelClass}>
        {label}
      </label>
      {children}
    </div>
  );
}
