'use server';

import { deleteCatalogEntity, saveRoom, saveService, setArchived } from '@/lib/admin/catalog';
import type { z as zod } from 'zod';
import {
  crmOptionsSchema,
  integrationSwitchesSchema,
  productionTemplatesSchema,
  reminderRulesSchema,
  studioContactsSchema,
} from '@/lib/settings-schema';
import { revalidatePath, revalidateTag } from 'next/cache';
import { logActivity } from '@/lib/activity';
import { actionError, type ActionState } from '@/lib/admin/action-state';
import { assertPermission } from '@/lib/auth/session';
import { prisma } from '@/lib/db';
import { cancellationPolicySchema } from '@/lib/policy';
import { SETTINGS_CACHE_TAG } from '@/lib/public-settings';
import { SETTING_KEYS, getCancellationPolicy, getWorkingHours, writeSetting } from '@/lib/settings';
import { parseWorkingHoursForm } from '@/lib/admin/working-hours-form';
import { CATALOG_CACHE_TAG } from '@/lib/public-catalog';
import type { Prisma } from '@prisma/client';

function intField(formData: FormData, name: string): number {
  const raw = String(formData.get(name) ?? '').trim();
  return raw === '' ? Number.NaN : Number(raw);
}

export async function updateCancellationPolicyAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  try {
    const actor = await assertPermission('settings:manage');
    const next = cancellationPolicySchema.parse({
      fullRefundHours: intField(formData, 'fullRefundHours'),
      partialRefundHours: intField(formData, 'partialRefundHours'),
      partialRefundPercent: intField(formData, 'partialRefundPercent'),
      freeReschedules: intField(formData, 'freeReschedules'),
      rescheduleMinHours: intField(formData, 'rescheduleMinHours'),
    });
    await prisma.$transaction(async (tx) => {
      const previous = await getCancellationPolicy(tx);
      await writeSetting(tx, SETTING_KEYS.cancellationPolicy, next, actor.id);
      await logActivity(tx, {
        userId: actor.id,
        entityType: 'Setting',
        entityId: SETTING_KEYS.cancellationPolicy,
        action: 'settings.update',
        metadata: { before: { ...previous }, after: { ...next } },
      });
    });
    // Public pages (FAQ, terms, pricing, booking) show the policy text.
    revalidateTag(SETTINGS_CACHE_TAG);
    revalidatePath('/', 'layout');
    return { ok: true, message: 'Правила сохранены. Тексты на сайте обновятся в течение нескольких минут.' };
  } catch (error) {
    return actionError(error);
  }
}

export async function updateWorkingHoursAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  try {
    const actor = await assertPermission('settings:manage');
    const next = parseWorkingHoursForm(formData);
    await prisma.$transaction(async (tx) => {
      const previous = await getWorkingHours(tx);
      await writeSetting(tx, SETTING_KEYS.workingHours, next as unknown as Prisma.InputJsonValue, actor.id);
      await logActivity(tx, {
        userId: actor.id,
        entityType: 'Setting',
        entityId: SETTING_KEYS.workingHours,
        action: 'settings.update',
        metadata: { before: previous as unknown as Prisma.InputJsonValue, after: next as unknown as Prisma.InputJsonValue },
      });
    });
    revalidateTag(SETTINGS_CACHE_TAG);
    revalidateTag(CATALOG_CACHE_TAG);
    return { ok: true, message: 'Рабочее время сохранено. Новые слоты сразу доступны в форме записи.' };
  } catch (error) {
    return actionError(error);
  }
}

// ─── Stage 4 settings ────────────────────────────────────────────────────────



const field = (f: FormData, k: string) => String(f.get(k) ?? '');

async function saveSettingValue<T>(
  permission: 'settings:manage' | 'integrations:manage',
  key: string,
  schema: zod.ZodType<T>,
  raw: unknown,
  message: string,
): Promise<ActionState> {
  try {
    const actor = await assertPermission(permission);
    const value = schema.parse(raw);
    await prisma.$transaction(async (tx) => {
      const before = await tx.setting.findUnique({ where: { key } });
      await writeSetting(tx, key, value as unknown as Prisma.InputJsonValue, actor.id);
      await logActivity(tx, {
        userId: actor.id,
        entityType: 'Setting',
        entityId: key,
        action: 'settings.update',
        metadata: { before: (before?.value ?? null) as Prisma.InputJsonValue, after: value as unknown as Prisma.InputJsonValue },
      });
    });
    revalidateTag(SETTINGS_CACHE_TAG);
    revalidateTag(CATALOG_CACHE_TAG);
    revalidatePath('/', 'layout');
    return { ok: true, message };
  } catch (error) {
    return actionError(error);
  }
}

export async function updateContactsAction(_prev: ActionState, f: FormData): Promise<ActionState> {
  return saveSettingValue(
    'settings:manage',
    SETTING_KEYS.studioContacts,
    studioContactsSchema,
    {
      studioName: field(f, 'studioName'),
      email: field(f, 'email').trim(),
      phone: field(f, 'phone'),
      whatsapp: field(f, 'whatsapp').replace(/\D/g, ''),
      instagram: field(f, 'instagram')
        .trim()
        .replace(/^https?:\/\/(www\.)?instagram\.com\//i, '')
        .replace(/^@/, '')
        .replace(/\/+$/, ''),
      city: field(f, 'city'),
      address: field(f, 'address'),
      addressKk: field(f, 'addressKk'),
      mapUrl: field(f, 'mapUrl').trim(),
      openingDate: field(f, 'openingDate'),
    },
    'Контакты сохранены',
  );
}

export async function updateRemindersAction(_prev: ActionState, f: FormData): Promise<ActionState> {
  return saveSettingValue(
    'settings:manage',
    SETTING_KEYS.reminderRules,
    reminderRulesSchema,
    { booking24h: f.get('booking24h') === 'on', booking2h: f.get('booking2h') === 'on', tourHoursBefore: Number(field(f, 'tourHoursBefore') || 0) },
    'Правила напоминаний сохранены (действуют для новых подтверждений)',
  );
}

export async function updateCrmOptionsAction(_prev: ActionState, f: FormData): Promise<ActionState> {
  return saveSettingValue('settings:manage', SETTING_KEYS.crmOptions, crmOptionsSchema, { autoLeadFromBooking: f.get('autoLeadFromBooking') === 'on' }, 'Сохранено');
}

export async function updateIntegrationSwitchesAction(_prev: ActionState, f: FormData): Promise<ActionState> {
  return saveSettingValue(
    'integrations:manage',
    SETTING_KEYS.integrationSwitches,
    integrationSwitchesSchema,
    { email: f.get('email') === 'on', calendar: f.get('calendar') === 'on', sheets: f.get('sheets') === 'on' },
    'Интеграции сохранены',
  );
}

export async function updateTemplatesAction(_prev: ActionState, f: FormData): Promise<ActionState> {
  let parsed: unknown;
  try {
    parsed = JSON.parse(field(f, 'templates'));
  } catch {
    return { error: 'Некорректный JSON' };
  }
  return saveSettingValue('settings:manage', SETTING_KEYS.productionTemplates, productionTemplatesSchema, parsed, 'Шаблоны сохранены (применяются к новым подтверждениям)');
}

function catalogRefresh() {
  revalidateTag(CATALOG_CACHE_TAG);
  revalidatePath('/', 'layout');
  revalidatePath('/admin/settings/catalog');
}

function formObject(f: FormData) {
  return Object.fromEntries([...f.entries()].filter(([k]) => !k.startsWith('$')).map(([k, v]) => [k, String(v)]));
}

export async function saveRoomAction(_prev: ActionState, f: FormData): Promise<ActionState> {
  try {
    const actor = await assertPermission('settings:manage');
    const data = formObject(f);
    await saveRoom(prisma, actor, { ...data, id: data.id || undefined });
    catalogRefresh();
    return { ok: true, message: 'Комната сохранена' };
  } catch (error) {
    return actionError(error);
  }
}

export async function saveServiceAction(_prev: ActionState, f: FormData): Promise<ActionState> {
  try {
    const actor = await assertPermission('settings:manage');
    const data = formObject(f);
    await saveService(prisma, actor, { ...data, id: data.id || undefined });
    catalogRefresh();
    return { ok: true, message: 'Тариф сохранён' };
  } catch (error) {
    return actionError(error);
  }
}

export async function catalogStateAction(_prev: ActionState, f: FormData): Promise<ActionState> {
  try {
    const actor = await assertPermission('settings:manage');
    const kind = field(f, 'kind') === 'service' ? 'service' : 'room';
    const id = field(f, 'id');
    const op = field(f, 'op');
    if (op === 'delete') await deleteCatalogEntity(prisma, actor, kind, id);
    else await setArchived(prisma, actor, kind, id, op === 'archive');
    catalogRefresh();
    return { ok: true, message: op === 'delete' ? 'Удалено' : op === 'archive' ? 'Перенесено в архив' : 'Восстановлено' };
  } catch (error) {
    return actionError(error);
  }
}
