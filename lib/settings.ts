import 'server-only';
import type { Prisma, PrismaClient } from '@prisma/client';
import type { z } from 'zod';
import {
  DEFAULT_CANCELLATION_POLICY,
  cancellationPolicySchema,
  type CancellationPolicy,
} from '@/lib/policy';
import {
  DEFAULT_CRM_OPTIONS,
  crmOptionsSchema,
  type CrmOptions,
  DEFAULT_INTEGRATION_SWITCHES,
  DEFAULT_PRODUCTION_TEMPLATES,
  DEFAULT_REMINDER_RULES,
  DEFAULT_STUDIO_CONTACTS,
  DEFAULT_WORKING_HOURS,
  SETTING_KEYS,
  integrationSwitchesSchema,
  productionTemplatesSchema,
  reminderRulesSchema,
  studioContactsSchema,
  workingHoursSchema,
  type IntegrationSwitches,
  type ProductionTemplates,
  type ReminderRules,
  type StudioContacts,
  type WorkingHours,
} from '@/lib/settings-schema';
import { log } from '@/lib/log';

export { DEFAULT_WORKING_HOURS, SETTING_KEYS, workingHoursSchema, type WorkingHours };

// ─── Access ───────────────────────────────────────────────────────────────────

type Db = PrismaClient | Prisma.TransactionClient;

async function readSetting<T>(db: Db, key: string, schema: z.ZodType<T>, fallback: T): Promise<T> {
  const row = await db.setting.findUnique({ where: { key } });
  if (!row) return fallback;
  const parsed = schema.safeParse(row.value);
  if (!parsed.success) {
    log.error('settings.invalid_value', { key });
    return fallback;
  }
  return parsed.data;
}

export function getCancellationPolicy(db: Db): Promise<CancellationPolicy> {
  return readSetting(db, SETTING_KEYS.cancellationPolicy, cancellationPolicySchema, DEFAULT_CANCELLATION_POLICY);
}

export function getWorkingHours(db: Db): Promise<WorkingHours> {
  return readSetting(db, SETTING_KEYS.workingHours, workingHoursSchema, DEFAULT_WORKING_HOURS);
}

export function getStudioContacts(db: Db): Promise<StudioContacts> {
  return readSetting(db, SETTING_KEYS.studioContacts, studioContactsSchema, DEFAULT_STUDIO_CONTACTS);
}

export function getReminderRules(db: Db): Promise<ReminderRules> {
  return readSetting(db, SETTING_KEYS.reminderRules, reminderRulesSchema, DEFAULT_REMINDER_RULES);
}

export function getIntegrationSwitches(db: Db): Promise<IntegrationSwitches> {
  return readSetting(db, SETTING_KEYS.integrationSwitches, integrationSwitchesSchema, DEFAULT_INTEGRATION_SWITCHES);
}

export function getProductionTemplates(db: Db): Promise<ProductionTemplates> {
  return readSetting(db, SETTING_KEYS.productionTemplates, productionTemplatesSchema, DEFAULT_PRODUCTION_TEMPLATES);
}

export function getCrmOptions(db: Db): Promise<CrmOptions> {
  return readSetting(db, SETTING_KEYS.crmOptions, crmOptionsSchema, DEFAULT_CRM_OPTIONS);
}

export async function writeSetting(db: Db, key: string, value: Prisma.InputJsonValue, userId: string | null) {
  await db.setting.upsert({
    where: { key },
    create: { key, value, updatedById: userId },
    update: { value, updatedById: userId },
  });
}
