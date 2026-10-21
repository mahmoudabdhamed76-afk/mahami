import { openDB, type DBSchema, type IDBPDatabase } from "idb";
import type { CategoryRec, SubtaskRec, SyncOp, TaskRec, UserDTO } from "@/lib/types";

export interface OutboxItem extends SyncOp { seq?: number }

interface Schema extends DBSchema {
  categories: { key: string; value: CategoryRec };
  tasks: { key: string; value: TaskRec };
  subtasks: { key: string; value: SubtaskRec };
  outbox: { key: number; value: OutboxItem };
  meta: { key: string; value: unknown };
}

export type StoreName = "categories" | "tasks" | "subtasks";
let dbp: Promise<IDBPDatabase<Schema>> | null = null;

export function db() {
  if (!dbp) {
    dbp = openDB<Schema>("mahami", 1, {
      upgrade(d) {
        d.createObjectStore("categories", { keyPath: "id" });
        d.createObjectStore("tasks", { keyPath: "id" });
        d.createObjectStore("subtasks", { keyPath: "id" });
        d.createObjectStore("outbox", { keyPath: "seq", autoIncrement: true });
        d.createObjectStore("meta");
      },
      blocking() { dbp?.then((x) => x.close()); dbp = null; },
    });
  }
  return dbp;
}

export async function loadAll() {
  const d = await db();
  const [categories, tasks, subtasks, user, cursor] = await Promise.all([
    d.getAll("categories"), d.getAll("tasks"), d.getAll("subtasks"),
    d.get("meta", "user") as Promise<UserDTO | undefined>, d.get("meta", "cursor") as Promise<number | undefined>,
  ]);
  return { categories, tasks, subtasks, user: user ?? null, cursor: cursor ?? 0 };
}

export async function putRecords(store: StoreName, recs: (CategoryRec | TaskRec | SubtaskRec)[], deletes: string[] = []) {
  if (!recs.length && !deletes.length) return;
  const d = await db();
  const tx = d.transaction(store, "readwrite");
  const s = tx.objectStore(store) as unknown as { put(v: unknown): Promise<unknown>; delete(k: string): Promise<unknown> };
  await Promise.all([...recs.map((r) => s.put(r)), ...deletes.map((id) => s.delete(id)), tx.done]);
}

export async function setMeta(key: string, value: unknown) { await (await db()).put("meta", value, key); }
export async function getMeta<T>(key: string) { return (await (await db()).get("meta", key)) as T | undefined; }

export async function clearAll() {
  const d = await db();
  const tx = d.transaction(["categories", "tasks", "subtasks", "outbox", "meta"], "readwrite");
  await Promise.all([...tx.objectStoreNames].map((n) => tx.objectStore(n).clear()).concat(tx.done));
}
