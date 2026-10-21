"use client";
import { commit, schedule } from "./sync";
import { deleteAudio, getAudio, putAudio } from "./idb";
import { getState } from "./store";
import { uid } from "./uid";
import type { NoteRec } from "@/lib/types";

const now = () => new Date().toISOString();

export function createNote(input: Partial<Omit<NoteRec, "id" | "createdAt" | "updatedAt" | "deletedAt">> = {}) {
  const ts = now();
  const note: NoteRec = {
    id: uid(), title: "", body: "", color: null, pinned: false,
    audioId: null, audioMime: null, audioDuration: null, audioPeaks: null,
    ...input, createdAt: ts, updatedAt: ts, deletedAt: null,
  };
  void commit("note", [note]);
  return note;
}

export function updateNote(id: string, patch: Partial<NoteRec>) {
  const cur = getState().notes[id];
  if (!cur) return;
  void commit("note", [{ ...cur, ...patch, updatedAt: now() }]);
}

export function deleteNote(id: string) {
  const cur = getState().notes[id];
  void commit("note", [], [{ id, ts: now() }]);
  return cur ?? null;
}

export function restoreNote(n: NoteRec) {
  void commit("note", [{ ...n, updatedAt: now(), deletedAt: null }]);
}

/** Keep the recording locally (works offline); the sync engine uploads it. */
export async function saveRecording(blob: Blob, mime: string) {
  const id = uid();
  await putAudio({ id, blob, mime, uploaded: false });
  schedule(100);
  return id;
}

export async function discardRecording(id: string) {
  await deleteAudio(id).catch(() => {});
}

const urls = new Map<string, string>();
/** Object URL for a voice note: local cache first, then the server (cached for offline). */
export async function audioUrl(id: string): Promise<string> {
  const hit = urls.get(id);
  if (hit) return hit;
  const local = await getAudio(id);
  let blob = local?.blob;
  if (!blob) {
    const res = await fetch(`/api/notes/audio/${id}`, { credentials: "same-origin" });
    if (!res.ok) throw new Error(res.status === 404 ? "التسجيل لسه بيترفع من جهاز تاني" : "تعذّر تحميل التسجيل");
    blob = await res.blob();
    await putAudio({ id, blob, mime: blob.type, uploaded: true });
  }
  const url = URL.createObjectURL(blob);
  urls.set(id, url);
  return url;
}

/** 48 peaks (0-255) → base64, and back. */
export const encodePeaks = (p: number[]) => btoa(String.fromCharCode(...p.map((v) => Math.max(0, Math.min(255, Math.round(v * 255))))));
export const decodePeaks = (s: string | null) => {
  if (!s) return [];
  try { return Array.from(atob(s), (c) => c.charCodeAt(0) / 255); } catch { return []; }
};
