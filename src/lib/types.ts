// Shared types between server and client.

export type Priority = 0 | 1 | 2 | 3;
export type EntityName = "category" | "task" | "subtask" | "note";

interface SyncMeta {
  id: string;
  createdAt: string;
  /** Last client-side modification time (ISO). Used for last-write-wins. */
  updatedAt: string;
  deletedAt: string | null;
}

export interface CategoryRec extends SyncMeta {
  name: string;
  color: string;
  icon: string;
  sortOrder: number;
}

export interface TaskRec extends SyncMeta {
  title: string;
  notes: string | null;
  priority: Priority;
  categoryId: string | null;
  dueAt: string | null;
  allDay: boolean;
  remindAt: string | null;
  reminderOffset: number | null;
  completed: boolean;
  completedAt: string | null;
  sortOrder: number;
}

export interface SubtaskRec extends SyncMeta {
  taskId: string;
  title: string;
  done: boolean;
  sortOrder: number;
}

export interface NoteRec extends SyncMeta {
  title: string;
  body: string;
  color: string | null;
  pinned: boolean;
  audioId: string | null;
  audioMime: string | null;
  audioDuration: number | null;
  audioPeaks: string | null;
}

export type EntityRec = CategoryRec | TaskRec | SubtaskRec | NoteRec;

export interface SyncOp {
  opId: string;
  entity: EntityName;
  op: "upsert" | "delete";
  id: string;
  /** Client wall-clock time of the change (ISO) */
  ts: string;
  data?: Record<string, unknown>;
}

export interface PushResult {
  results: { opId: string; status: "applied" | "stale" | "rejected"; reason?: string }[];
}

export interface PullResponse {
  cursor: number;
  hasMore: boolean;
  categories: CategoryRec[];
  tasks: TaskRec[];
  subtasks: SubtaskRec[];
  notes: NoteRec[];
}

export interface UserSettings {
  theme?: "system" | "light" | "dark";
  accent?: string;
  digits?: "arab" | "latn";
  weekStart?: 0 | 1 | 6;
  autoRemind?: boolean;
  defaultReminderTime?: string; // "09:00" for all-day tasks
  runwayStyle?: RunwayStyle;
}

export const RUNWAY_STYLES = ["lanes", "radar", "road", "metro", "countdown", "orbit", "capsules"] as const;
export type RunwayStyle = (typeof RUNWAY_STYLES)[number];

export interface UserDTO {
  id: string;
  email: string;
  name: string;
  timezone: string;
  settings: UserSettings;
  calendarToken: string;
  createdAt: string;
}
