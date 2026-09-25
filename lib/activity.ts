import 'server-only';
import type { Prisma, PrismaClient } from '@prisma/client';

type Db = PrismaClient | Prisma.TransactionClient;

export interface ActivityInput {
  userId?: string | null;
  entityType: string;
  entityId?: string | null;
  action: string;
  /** Must not contain passwords, tokens or unnecessary personal data. */
  metadata?: Prisma.InputJsonValue;
}

export async function logActivity(db: Db, input: ActivityInput): Promise<void> {
  await db.activityLog.create({
    data: {
      userId: input.userId ?? null,
      entityType: input.entityType,
      entityId: input.entityId ?? null,
      action: input.action,
      metadata: input.metadata,
    },
  });
}
