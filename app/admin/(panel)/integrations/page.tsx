import Link from 'next/link';
import type { IntegrationJobStatus, Prisma } from '@prisma/client';
import { ActionForm, SubmitButton } from '@/components/admin/ActionForm';
import { Badge, EmptyState, PageHeader, cardClass, linkButtonClass } from '@/components/admin/ui';
import { formatDateTime } from '@/lib/admin/format';
import { requirePermission } from '@/lib/auth/session';
import { prisma } from '@/lib/db';
import { validateEnv } from '@/lib/env-schema';
import { getIntegrationConfig, isDryRun } from '@/lib/integrations/config';
import { checkReadiness } from '@/lib/readiness';
import { getIntegrationSwitches } from '@/lib/settings';
import { JOB_LABELS, jobStatusText, type JobType } from '@/lib/outbox/jobs';
import { processQueueAction, retryJobAction } from './actions';

export const metadata = { title: 'Интеграции' };

const STATUS_STYLES: Record<IntegrationJobStatus, string> = {
  PENDING: 'bg-amber-100 text-amber-800',
  PROCESSING: 'bg-sky-100 text-sky-800',
  COMPLETED: 'bg-green-100 text-green-800',
  FAILED: 'bg-red-100 text-red-800',
};

const FILTERS: Record<string, { label: string; where: Prisma.IntegrationJobWhereInput }> = {
  problems: { label: 'Требуют внимания', where: { OR: [{ status: 'FAILED' }, { status: 'PENDING', attempts: { gt: 0 } }] } },
  pending: { label: 'В очереди', where: { status: { in: ['PENDING', 'PROCESSING'] } } },
  completed: { label: 'Выполненные', where: { status: 'COMPLETED' } },
  all: { label: 'Все', where: {} },
};

export default async function IntegrationsPage(props: { searchParams: Promise<{ f?: string; retried?: string }> }) {
  const searchParams = await props.searchParams;
  await requirePermission('integrations:view');
  const filterKey = searchParams.f && FILTERS[searchParams.f] ? searchParams.f : 'problems';
  const [jobs, counts, readiness, switches, lastDone, oldestDue] = await Promise.all([
    prisma.integrationJob.findMany({ where: FILTERS[filterKey].where, orderBy: { createdAt: 'desc' }, take: 100 }),
    prisma.integrationJob.groupBy({ by: ['status'], _count: { _all: true } }),
    checkReadiness(prisma),
    getIntegrationSwitches(prisma),
    prisma.integrationJob.findFirst({ where: { status: 'COMPLETED' }, orderBy: { completedAt: 'desc' }, select: { completedAt: true } }),
    prisma.integrationJob.findFirst({ where: { status: 'PENDING', nextAttemptAt: { lte: new Date() } }, orderBy: { nextAttemptAt: 'asc' }, select: { nextAttemptAt: true } }),
  ]);
  const envReport = validateEnv();
  // A due job waiting > 10 min means neither the cron nor the worker is running.
  const queueStalled = oldestDue ? Date.now() - oldestDue.nextAttemptAt.getTime() > 10 * 60_000 : false;
  const count = (s: IntegrationJobStatus) => counts.find((c) => c.status === s)?._count._all ?? 0;
  const config = getIntegrationConfig();
  const entityHref = (j: { entityType: string; entityId: string }) =>
    j.entityType === 'Booking' ? `/admin/bookings/${j.entityId}` : `/admin/tours/${j.entityId}`;

  return (
    <div className="space-y-6 max-w-6xl">
      <PageHeader
        title="Очередь интеграций"
        description="Письма, Google Calendar и Google Sheets выполняются после сохранения заявки. Ошибка здесь не влияет на сам заказ."
        actions={
          <ActionForm action={processQueueAction}>
            <SubmitButton pendingLabel="Обработка…">Обработать очередь сейчас</SubmitButton>
          </ActionForm>
        }
      />

      {searchParams.retried === 'ok' && (
        <p role="status" className="text-sm text-green-800 bg-green-50 border border-green-200 rounded-xl px-4 py-3">
          Повтор выполнен успешно.
        </p>
      )}
      {searchParams.retried === 'failed' && (
        <p role="alert" className="text-sm text-red-800 bg-red-50 border border-red-200 rounded-xl px-4 py-3">
          Повтор не удался — ошибка обновлена в списке, будет новая попытка.
        </p>
      )}
      <section className={`${cardClass} grid sm:grid-cols-2 lg:grid-cols-4 gap-4 text-sm`} aria-label="Настройка интеграций">
        {[
          ['Email', config.email ? (config.adminEmail ? `включён → ${config.adminEmail}` : 'нет адреса администратора') : 'не настроен'],
          ['Google Calendar', config.calendar ? 'включён' : 'не настроен'],
          ['Google Sheets', config.sheets ? 'включён (дополнительная копия)' : 'не настроен'],
          ['Режим', isDryRun() ? 'dry-run: внешние сервисы не вызываются' : 'рабочий'],
        ].map(([k, v]) => (
          <div key={k}>
            <p className="text-text-secondary">{k}</p>
            <p className="font-semibold break-words">{v}</p>
          </div>
        ))}
      </section>

      <section className={cardClass} aria-labelledby="health-h">
        <h2 id="health-h" className="text-lg font-bold mb-3">
          Состояние системы
        </h2>
        <ul className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3 text-sm">
          {[
            ['База данных', readiness.checks.database === 'ok', readiness.checks.database === 'ok' ? 'доступна' : 'недоступна'],
            ['Миграции', readiness.checks.migrations === 'ok', readiness.checks.migrations === 'ok' ? 'все применены' : 'есть неприменённые — выполните npm run db:deploy'],
            ['Конфигурация', envReport.errors.length === 0, envReport.errors.length === 0 ? 'без ошибок' : `ошибок: ${envReport.errors.length}`],
            ['Часовой пояс', readiness.checks.timezone === 'ok', readiness.checks.timezone === 'ok' ? 'Asia/Almaty, UTC+5' : 'устаревшие данные часовых поясов — обновите Node.js'],
            [
              'Очередь',
              !queueStalled,
              queueStalled ? 'задачи ждут больше 10 минут — проверьте cron / worker' : oldestDue ? 'есть задачи к выполнению' : 'нет просроченных задач',
            ],
            ['Последняя успешная отправка', true, lastDone?.completedAt ? formatDateTime(lastDone.completedAt) : 'ещё не было'],
            [
              'Включено в CRM',
              true,
              [switches.email && 'email', switches.calendar && 'Calendar', switches.sheets && 'Sheets'].filter(Boolean).join(', ') || 'всё выключено',
            ],
          ].map(([label, ok, text]) => (
            <li key={String(label)} className="flex items-start gap-2">
              <span aria-hidden="true" className={ok ? 'text-green-700' : 'text-red-700'}>
                {ok ? '●' : '▲'}
              </span>
              <span>
                <span className="text-text-secondary">{label}: </span>
                <span className={`font-semibold ${ok ? '' : 'text-red-700'}`}>{text}</span>
              </span>
            </li>
          ))}
        </ul>
        {(envReport.errors.length > 0 || envReport.warnings.length > 0) && (
          <ul className="mt-4 space-y-1 text-sm">
            {envReport.errors.map((e) => (
              <li key={e} className="text-red-700">
                ✗ {e}
              </li>
            ))}
            {envReport.warnings.map((w) => (
              <li key={w} className="text-amber-800">
                ! {w}
              </li>
            ))}
          </ul>
        )}
        <p className="mt-3 text-xs text-text-secondary">Публичные проверки для мониторинга: /api/health (процесс жив) и /api/ready (база, миграции, конфигурация).</p>
      </section>

      <dl className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {(['PENDING', 'PROCESSING', 'FAILED', 'COMPLETED'] as const).map((s) => (
          <div key={s} className={cardClass}>
            <dt>
              <Badge className={STATUS_STYLES[s]}>{s}</Badge>
            </dt>
            <dd className="text-2xl font-bold mt-2">{count(s)}</dd>
          </div>
        ))}
      </dl>

      <nav aria-label="Фильтр" className="flex flex-wrap gap-2">
        {Object.entries(FILTERS).map(([key, f]) => (
          <Link
            key={key}
            href={`/admin/integrations?f=${key}`}
            aria-current={key === filterKey ? 'page' : undefined}
            className={key === filterKey ? 'px-4 py-2 rounded-xl text-sm font-semibold bg-brand-gradient text-on-brand' : linkButtonClass}
          >
            {f.label}
          </Link>
        ))}
      </nav>

      <div className={`${cardClass} p-0 md:p-0 overflow-x-auto`}>
        {jobs.length === 0 ? (
          <EmptyState>Задач нет.</EmptyState>
        ) : (
          <table className="w-full text-sm">
            <caption className="sr-only">Задачи интеграций</caption>
            <thead className="text-left text-text-secondary border-b border-border-light">
              <tr>
                <th scope="col" className="px-4 py-3">Задача</th>
                <th scope="col" className="px-4 py-3">Статус</th>
                <th scope="col" className="px-4 py-3">Попытки</th>
                <th scope="col" className="px-4 py-3">Ошибка</th>
                <th scope="col" className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-border-light">
              {jobs.map((j) => (
                <tr key={j.id} className="align-top">
                  <td className="px-4 py-3">
                    <span className="font-semibold">{JOB_LABELS[j.type as JobType] ?? j.type}</span>
                    <br />
                    <Link href={entityHref(j)} className="text-brand-ink hover:underline text-xs">
                      Открыть {j.entityType === 'Booking' ? 'заказ' : 'тур'}
                    </Link>
                    <span className="block text-xs text-text-secondary">создана {formatDateTime(j.createdAt)}</span>
                  </td>
                  <td className="px-4 py-3">
                    <Badge className={STATUS_STYLES[j.status]}>{jobStatusText(j)}</Badge>
                    {j.status === 'PENDING' && j.attempts > 0 && (
                      <span className="block text-xs text-text-secondary mt-1">повтор {formatDateTime(j.nextAttemptAt)}</span>
                    )}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    {j.attempts} / {j.maxAttempts}
                  </td>
                  <td className="px-4 py-3 max-w-md">
                    <span className="break-words text-xs text-red-800">{j.lastError ?? '—'}</span>
                  </td>
                  <td className="px-4 py-3">
                    {(j.status === 'FAILED' || j.status === 'PENDING') && (
                      <ActionForm action={retryJobAction}>
                        <input type="hidden" name="jobId" value={j.id} />
                        <SubmitButton variant="secondary" pendingLabel="…">
                          Повторить
                        </SubmitButton>
                      </ActionForm>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
