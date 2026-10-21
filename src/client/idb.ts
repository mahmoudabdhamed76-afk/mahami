import { openDB, type DBSchema, type IDBPDatabase } from "idb";
import type { CategoryRec, NoteRec, SubtaskRec, SyncOp, TaskRec, UserDTO } from "@/lib/types";

export interface OutboxItem extends SyncOp { seq?: number }
export interface AudioItem { id: string; blob: Blob; mime: string; uploaded: boolean }

interface Schema extends DBSchema {
  categories: { key: string; value: CategoryRec };
  tasks: { key: string; value: TaskRec };
  subtasks: { key: string; value: SubtaskRec };
  notes: { key: string; value: NoteRec };
  audio: { key: string; value: AudioItem };
  outbox: { key: number; value: OutboxItem };
  meta: { key: string; value: unknown };
}

export type StoreName = "categories" | "tasks" | "subtasks" | "notes";
let dbp: Promise<IDBPDatabase<Schema>> | null = null;

export function db() {
  if (!dbp) {
    dbp = openDB<Schema>("mahami", 2, {
      upgrade(d, oldVersion) {
        if (oldVersion < 1) {
          d.createObjectStore("categories", { keyPath: "id" });
          d.createObjectStore("tasks", { keyPath: "id" });
          d.createObjectStore("subtasks", { keyPath: "id" });
          d.createObjectStore("outbox", { keyPath: "seq", autoIncrement: true });
          d.createObjectStore("meta");
        }
        if (oldVersion < 2) {
          d.createObjectStore("notes", { keyPath: "id" });
          d.createObjectStore("audio", { keyPath: "id" });
        }
      },
      blocking() { dbp?.then((x) => x.close()); dbp = null; },
    });
  }
  return dbp;
}

export async function loadAll() {
  const d = await db();
  const [categories, tasks, subtasks, notes, user, cursor] = await Promise.all([
    d.getAll("categories"), d.getAll("tasks"), d.getAll("subtasks"), d.getAll("notes"),
    d.get("meta", "user") as Promise<UserDTO | undefined>, d.get("meta", "cursor") as Promise<number | undefined>,
  ]);
  return { categories, tasks, subtasks, notes, user: user ?? null, cursor: cursor ?? 0 };
}

export async function putRecords(store: StoreName, recs: (CategoryRec | TaskRec | SubtaskRec | NoteRec)[], deletes: string[] = []) {
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
  const tx = d.transaction(["categories", "tasks", "subtasks", "notes", "audio", "outbox", "meta"], "readwrite");
  await Promise.all([...tx.objectStoreNames].map((n) => tx.objectStore(n).clear()).concat(tx.done));
}

// ── Voice-note audio (local cache + pending uploads) ─────────────────────────
export async function putAudio(item: AudioItem) { await (await db()).put("audio", item); }
export async function getAudio(id: string) { return (await db()).get("audio", id); }
export async function pendingAudio() { return (await (await db()).getAll("audio")).filter((a) => !a.uploaded); }
export async function deleteAudio(id: string) { await (await db()).delete("audio", id); }
