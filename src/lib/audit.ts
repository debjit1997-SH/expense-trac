import prisma from "./db";
import { Prisma } from "@prisma/client";

export interface LogAuditParams {
  actorId: string;
  action: string;
  entityType: string;
  entityId: string;
  reportId?: string | null;
  previousVal?: unknown;
  newVal?: unknown;
  reason?: string | null;
  tx?: Prisma.TransactionClient;
}

/**
 * Record an audit log entry in the database (supports standalone or inside transactions)
 */
export async function logAudit({
  actorId,
  action,
  entityType,
  entityId,
  reportId,
  previousVal,
  newVal,
  reason,
  tx,
}: LogAuditParams) {
  const client = tx || prisma;

  return client.auditLog.create({
    data: {
      actorId,
      action,
      entityType,
      entityId,
      reportId: reportId ?? null,
      previousVal: previousVal ? JSON.stringify(previousVal) : null,
      newVal: newVal ? JSON.stringify(newVal) : null,
      reason: reason ?? null,
    },
  });
}
