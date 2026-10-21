import { randomUUID } from "node:crypto";
import { HttpError } from "./http";
import { applyOps } from "./sync";
import type { EntityName } from "@/lib/types";

/** REST writes go through the same LWW/versioning pipeline as sync, stamped with server time. */
export async function writeEntity(userId: string, entity: EntityName, op: "upsert" | "delete", id: string, data?: Record<string, unknown>) {
  const { results } = await applyOps(userId, [{ opId: randomUUID(), entity, op, id, ts: new Date().toISOString(), data }]);
  const r = results[0];
  if (r.status === "rejected") {
    if (r.reason === "forbidden") throw new HttpError(404, "العنصر غير موجود");
    if (r.reason === "parent_missing") throw new HttpError(404, "المهمة الأصلية غير موجودة");
    throw new HttpError(400, "بيانات غير صالحة");
  }
}
