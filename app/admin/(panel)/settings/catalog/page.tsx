import Link from 'next/link';
import type { Room, Service } from '@prisma/client';
import { ActionForm, SubmitButton } from '@/components/admin/ActionForm';
import { Badge, PageHeader, cardClass, inputClass } from '@/components/admin/ui';
import { formatMoney } from '@/lib/admin/format';
import { hasPermission } from '@/lib/auth/permissions';
import { requirePermission } from '@/lib/auth/session';
import { prisma } from '@/lib/db';
import { getProductionTemplates } from '@/lib/settings';
import { catalogStateAction, saveRoomAction, saveServiceAction, updateTemplatesAction } from '../actions';

export const metadata = { title: 'Каталог' };

function Input({ name, label, value, type = 'text', disabled, ...rest }: { name: string; label: string; value?: string | number | null; type?: string; disabled?: boolean } & Record<string, unknown>) {
  const id = `${rest.prefix ?? ''}${name}`;
  return (
    <div>
      <label htmlFor={id} className="block text-xs font-semibold mb-1">
        {label}
      </label>
      <input id={id} name={name} type={type} defaultValue={value ?? ''} disabled={disabled} className={inputClass} {...(rest.inputProps as object)} />
    </div>
  );
}

function RoomForm({ room, used, disabled }: { room?: Room; used: number; disabled: boolean }) {
  const p = room ? `r-${room.id}-` : 'r-new-';
  return (
    <ActionForm action={saveRoomAction} className="grid sm:grid-cols-3 lg:grid-cols-5 gap-3 items-end">
      {room && <input type="hidden" name="id" value={room.id} />}
      <Input prefix={p} name="slug" label={used ? `Slug (заказов: ${used} — не меняется)` : 'Slug'} value={room?.slug} disabled={disabled} inputProps={{ readOnly: used > 0, required: true }} />
      <Input prefix={p} name="nameRu" label="Название (RU)" value={room?.nameRu} disabled={disabled} inputProps={{ required: true }} />
      <Input prefix={p} name="nameKk" label="Название (KK)" value={room?.nameKk} disabled={disabled} inputProps={{ required: true }} />
      <Input prefix={p} name="capacity" label="Вместимость, чел." type="number" value={room?.capacity ?? 2} disabled={disabled} inputProps={{ min: 1, max: 20 }} />
      <Input prefix={p} name="color" label="Цвет в календаре" type="color" value={room?.color ?? '#FF7A1A'} disabled={disabled} />
      <Input prefix={p} name="googleColorId" label="Цвет Google (1–11)" value={room?.googleColorId ?? ''} disabled={disabled} />
      <Input prefix={p} name="bufferBeforeMinutes" label="Буфер до, мин" type="number" value={room?.bufferBeforeMinutes ?? 15} disabled={disabled} inputProps={{ min: 0, max: 120 }} />
      <Input prefix={p} name="bufferAfterMinutes" label="Буфер после, мин" type="number" value={room?.bufferAfterMinutes ?? 15} disabled={disabled} inputProps={{ min: 0, max: 120 }} />
      <Input prefix={p} name="sortOrder" label="Порядок" type="number" value={room?.sortOrder ?? 10} disabled={disabled} inputProps={{ min: 0 }} />
      {!disabled && (
        <div>
          <SubmitButton>{room ? 'Сохранить' : 'Добавить комнату'}</SubmitButton>
        </div>
      )}
    </ActionForm>
  );
}

function ServiceForm({ service, used, disabled }: { service?: Service; used: number; disabled: boolean }) {
  const p = service ? `s-${service.id}-` : 's-new-';
  return (
    <ActionForm action={saveServiceAction} className="grid sm:grid-cols-3 lg:grid-cols-4 gap-3 items-end">
      {service && <input type="hidden" name="id" value={service.id} />}
      <Input prefix={p} name="slug" label={used ? `Slug (заказов: ${used} — не меняется)` : 'Slug'} value={service?.slug} disabled={disabled} inputProps={{ readOnly: used > 0, required: true }} />
      <Input prefix={p} name="nameRu" label="Название (RU)" value={service?.nameRu} disabled={disabled} inputProps={{ required: true }} />
      <Input prefix={p} name="nameKk" label="Название (KK)" value={service?.nameKk} disabled={disabled} inputProps={{ required: true }} />
      <Input prefix={p} name="basePrice" label="Цена, ₸" type="number" value={service?.basePrice ?? 0} disabled={disabled} inputProps={{ min: 0, step: 1 }} />
      <Input prefix={p} name="defaultDuration" label="Длительность, мин" type="number" value={service?.defaultDuration ?? 60} disabled={disabled} inputProps={{ min: 15, step: 5 }} />
      <Input prefix={p} name="maxDuration" label="Макс. длительность, мин" type="number" value={service?.maxDuration ?? 60} disabled={disabled} inputProps={{ min: 15, step: 5 }} />
      <Input prefix={p} name="extraStepMinutes" label="Шаг продления, мин (пусто — нет)" type="number" value={service?.extraStepMinutes ?? ''} disabled={disabled} />
      <Input prefix={p} name="extraStepPrice" label="Цена шага, ₸" type="number" value={service?.extraStepPrice ?? ''} disabled={disabled} />
      <div className="sm:col-span-3 lg:col-span-2">
        <Input prefix={p} name="descriptionRu" label="Описание (RU)" value={service?.descriptionRu} disabled={disabled} />
      </div>
      <div className="sm:col-span-3 lg:col-span-2">
        <Input prefix={p} name="descriptionKk" label="Описание (KK)" value={service?.descriptionKk} disabled={disabled} />
      </div>
      <Input prefix={p} name="sortOrder" label="Порядок" type="number" value={service?.sortOrder ?? 10} disabled={disabled} />
      {!disabled && (
        <div>
          <SubmitButton>{service ? 'Сохранить' : 'Добавить тариф'}</SubmitButton>
        </div>
      )}
    </ActionForm>
  );
}

function StateButtons({ kind, id, active, used }: { kind: 'room' | 'service'; id: string; active: boolean; used: number }) {
  return (
    <ActionForm action={catalogStateAction} className="flex flex-wrap gap-2">
      <input type="hidden" name="kind" value={kind} />
      <input type="hidden" name="id" value={id} />
      <SubmitButton variant="secondary" name="op" value={active ? 'archive' : 'restore'} pendingLabel="…">
        {active ? 'В архив' : 'Вернуть из архива'}
      </SubmitButton>
      {used === 0 && (
        <SubmitButton
          variant="danger"
          name="op"
          value="delete"
          pendingLabel="…"
          confirm="Удалить навсегда? По этой позиции ещё нет заказов, поэтому удаление разрешено. Если сомневаетесь — используйте архив."
        >
          Удалить
        </SubmitButton>
      )}
    </ActionForm>
  );
}

export default async function CatalogPage() {
  const user = await requirePermission('settings:view');
  const canEdit = hasPermission(user.role, 'settings:manage');
  const [rooms, services, roomUse, serviceUse, templates] = await Promise.all([
    prisma.room.findMany({ orderBy: [{ active: 'desc' }, { sortOrder: 'asc' }] }),
    prisma.service.findMany({ orderBy: [{ active: 'desc' }, { sortOrder: 'asc' }] }),
    prisma.booking.groupBy({ by: ['roomId'], _count: { _all: true } }),
    prisma.booking.groupBy({ by: ['serviceId'], _count: { _all: true } }),
    getProductionTemplates(prisma),
  ]);
  const roomUsed = new Map(roomUse.map((r) => [r.roomId, r._count._all]));
  const serviceUsed = new Map(serviceUse.map((s) => [s.serviceId, s._count._all]));

  return (
    <div className="space-y-8 max-w-6xl">
      <div>
        <Link href="/admin/settings" className="text-sm text-text-secondary hover:underline">
          ← Настройки
        </Link>
        <PageHeader title="Комнаты, тарифы и шаблоны" description="Изменения сразу видны на сайте и в форме записи. Используемые записи не удаляются — только архивируются." />
      </div>

      <section aria-labelledby="rooms-h" className="space-y-4">
        <h2 id="rooms-h" className="text-lg font-bold">
          Комнаты
        </h2>
        {rooms.map((room) => (
          <article key={room.id} className={`${cardClass} space-y-3 ${room.active ? '' : 'opacity-70'}`}>
            <div className="flex flex-wrap justify-between gap-2 items-center">
              <p className="font-semibold inline-flex items-center gap-2">
                <span className="w-3 h-3 rounded-full" style={{ backgroundColor: room.color }} aria-hidden="true" />
                {room.nameRu} {!room.active && <Badge className="bg-gray-200 text-gray-700">архив</Badge>}
              </p>
              {canEdit && <StateButtons kind="room" id={room.id} active={room.active} used={roomUsed.get(room.id) ?? 0} />}
            </div>
            <RoomForm room={room} used={roomUsed.get(room.id) ?? 0} disabled={!canEdit} />
          </article>
        ))}
        {canEdit && (
          <details className={cardClass}>
            <summary className="font-semibold cursor-pointer">Добавить комнату</summary>
            <div className="mt-3">
              <RoomForm used={0} disabled={false} />
            </div>
          </details>
        )}
      </section>

      <section aria-labelledby="services-h" className="space-y-4">
        <h2 id="services-h" className="text-lg font-bold">
          Тарифы
        </h2>
        {services.map((service) => (
          <article key={service.id} className={`${cardClass} space-y-3 ${service.active ? '' : 'opacity-70'}`}>
            <div className="flex flex-wrap justify-between gap-2 items-center">
              <p className="font-semibold">
                {service.nameRu} · {formatMoney(service.basePrice)} {!service.active && <Badge className="bg-gray-200 text-gray-700">архив</Badge>}
              </p>
              {canEdit && <StateButtons kind="service" id={service.id} active={service.active} used={serviceUsed.get(service.id) ?? 0} />}
            </div>
            <ServiceForm service={service} used={serviceUsed.get(service.id) ?? 0} disabled={!canEdit} />
          </article>
        ))}
        {canEdit && (
          <details className={cardClass}>
            <summary className="font-semibold cursor-pointer">Добавить тариф</summary>
            <div className="mt-3">
              <ServiceForm used={0} disabled={false} />
            </div>
          </details>
        )}
        <p className="text-xs text-text-secondary">
          Цена меняется только для новых заявок: у существующих заказов сохранённая сумма не пересчитывается (для этого есть изменение суммы с причиной в карточке заказа).
        </p>
      </section>

      <section aria-labelledby="tpl-h" className={cardClass}>
        <h2 id="tpl-h" className="text-lg font-bold mb-1">
          Шаблоны production-задач
        </h2>
        <p className="text-sm text-text-secondary mb-3">
          Набор задач по slug тарифа, создаётся при подтверждении заказа. Поля: key, type (PREPARATION, RECORDING, EDITING, THUMBNAIL, SHORTS, REVIEW, DELIVERY,
          PUBLISHING), title, dueOffsetHours (от конца записи; с relativeToStart — от начала), priority, checklist.
        </p>
        <ActionForm action={updateTemplatesAction} className="space-y-3">
          <label htmlFor="templates" className="sr-only">
            Шаблоны (JSON)
          </label>
          <textarea
            id="templates"
            name="templates"
            rows={18}
            defaultValue={JSON.stringify(templates, null, 2)}
            disabled={!canEdit}
            spellCheck={false}
            className={`${inputClass} font-mono text-xs`}
          />
          {canEdit && <SubmitButton>Сохранить шаблоны</SubmitButton>}
        </ActionForm>
      </section>
    </div>
  );
}
