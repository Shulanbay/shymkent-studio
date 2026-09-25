import 'server-only';
import type { Prisma, PrismaClient } from '@prisma/client';
import { getIntegrationSwitches } from '@/lib/settings';
import { getIntegrationConfig, type IntegrationConfig } from './config';

/** Integrations that are both configured in the environment and switched on in the CRM. */
export async function getEffectiveIntegrationConfig(db: PrismaClient | Prisma.TransactionClient): Promise<IntegrationConfig> {
  const env = getIntegrationConfig();
  const switches = await getIntegrationSwitches(db);
  return {
    email: env.email && switches.email,
    adminEmail: env.adminEmail,
    calendar: env.calendar && switches.calendar,
    sheets: env.sheets && switches.sheets,
  };
}
