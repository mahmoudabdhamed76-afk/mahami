import { z } from "zod";
import { RUNWAY_STYLES } from "./types";

const uuidRe = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const uuid = z.string().regex(uuidRe, "معرّف غير صالح");
export const isoDate = z.string().max(40).refine((s) => !Number.isNaN(Date.parse(s)), "تاريخ غير صالح");

export const categoryData = z.object({
  name: z.string().trim().min(1, "اسم القائمة مطلوب").max(60),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  icon: z.string().min(1).max(40),
  sortOrder: z.number().finite().default(0),
  createdAt: isoDate.optional(),
});

export const taskData = z.object({
  title: z.string().trim().min(1, "عنوان المهمة مطلوب").max(500),
  notes: z.string().max(10000).nullable().default(null),
  priority: z.number().int().min(0).max(3).default(0),
  categoryId: uuid.nullable().default(null),
  dueAt: isoDate.nullable().default(null),
  allDay: z.boolean().default(true),
  remindAt: isoDate.nullable().default(null),
  reminderOffset: z.number().int().min(-1440).max(60 * 24 * 30).nullable().default(null),
  completed: z.boolean().default(false),
  completedAt: isoDate.nullable().default(null),
  sortOrder: z.number().finite().default(0),
  createdAt: isoDate.optional(),
});

export const subtaskData = z.object({
  taskId: uuid,
  title: z.string().trim().min(1).max(300),
  done: z.boolean().default(false),
  sortOrder: z.number().finite().default(0),
  createdAt: isoDate.optional(),
});

export const noteData = z.object({
  title: z.string().max(300).default(""),
  body: z.string().max(50000).default(""),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/).nullable().default(null),
  pinned: z.boolean().default(false),
  audioId: uuid.nullable().default(null),
  audioMime: z.string().max(80).nullable().default(null),
  audioDuration: z.number().min(0).max(60 * 60).nullable().default(null),
  audioPeaks: z.string().max(2000).nullable().default(null),
  createdAt: isoDate.optional(),
});

export const syncOp = z.object({
  opId: z.string().min(1).max(64),
  entity: z.enum(["category", "task", "subtask", "note"]),
  op: z.enum(["upsert", "delete"]),
  id: uuid,
  ts: isoDate,
  data: z.record(z.string(), z.unknown()).optional(),
});

export const pushBody = z.object({
  ops: z.array(syncOp).max(500),
  clientNow: isoDate.optional(),
});

export const settingsSchema = z.object({
  theme: z.enum(["system", "light", "dark"]).optional(),
  accent: z.string().max(20).optional(),
  digits: z.enum(["arab", "latn"]).optional(),
  weekStart: z.union([z.literal(0), z.literal(1), z.literal(6)]).optional(),
  autoRemind: z.boolean().optional(),
  defaultReminderTime: z.string().regex(/^\d{2}:\d{2}$/).optional(),
  runwayStyle: z.enum(RUNWAY_STYLES).optional(),
});

export const emailSchema = z.string().trim().toLowerCase().max(200).regex(/^[^\s@]+@[^\s@]+\.[^\s@]+$/, "البريد الإلكتروني غير صالح");
export const passwordSchema = z.string().min(8, "كلمة المرور يجب ألا تقل عن ٨ أحرف").max(200);
