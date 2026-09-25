import { ACTIVITY_LABELS, formatDateTime } from '@/lib/admin/format';

interface Item {
  id: string;
  action: string;
  createdAt: Date;
  metadata: unknown;
  user: { name: string } | null;
}

function describe(metadata: unknown): string | null {
  if (!metadata || typeof metadata !== 'object') return null;
  const m = metadata as Record<string, unknown>;
  const parts: string[] = [];
  if (m.from !== undefined && m.to !== undefined) parts.push(`${String(m.from)} → ${String(m.to)}`);
  if (typeof m.reason === 'string') parts.push(`причина: ${m.reason}`);
  if (typeof m.overrideReason === 'string') parts.push(`изменение возврата: ${m.overrideReason}`);
  if (typeof m.refund === 'number') parts.push(`возврат ${m.refund} ₸`);
  if (Array.isArray(m.fields)) parts.push(`поля: ${m.fields.join(', ')}`);
  if (typeof m.number === 'string') parts.push(m.number);
  return parts.length ? parts.join('; ') : null;
}

export function ActivityList({ items }: { items: Item[] }) {
  if (items.length === 0) return <p className="text-text-secondary text-sm">Пока нет записей.</p>;
  return (
    <ol className="divide-y divide-border-light text-sm">
      {items.map((item) => {
        const details = describe(item.metadata);
        return (
          <li key={item.id} className="py-2">
            <div className="flex flex-wrap justify-between gap-x-4">
              <span>
                <span className="font-semibold">{item.user?.name ?? 'Сайт / система'}</span> — {ACTIVITY_LABELS[item.action] ?? item.action}
              </span>
              <time className="text-text-secondary" dateTime={item.createdAt.toISOString()}>
                {formatDateTime(item.createdAt)}
              </time>
            </div>
            {details && <p className="text-text-secondary break-words">{details}</p>}
          </li>
        );
      })}
    </ol>
  );
}
