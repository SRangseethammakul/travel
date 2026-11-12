/**
 * CreateTrip (page 6): what the form sends and the check the Server Action
 * runs on it. Pure (no store), safe for client components.
 */
import type { ColorKey } from "@/lib/api/types";
import { daysBetween, parseISODate, type ISODate } from "@/lib/date";
import type { Satang } from "@/lib/money/format";

/** Cover colours in mockup order (CreateTrip.dc.html). */
export const TRIP_COVERS: readonly { key: ColorKey; label: string }[] = [
  { key: "ink", label: "สีกรมท่า" },
  { key: "teal", label: "สีเขียวอมฟ้า" },
  { key: "blue", label: "สีน้ำเงิน" },
  { key: "orange", label: "สีส้มอิฐ" },
  { key: "purple", label: "สีม่วง" },
];

/** Avatar colours for typed-in Members, cycled in order (mockup palette). */
export const MEMBER_COLORS: readonly ColorKey[] = ["teal", "blue", "orange", "purple", "slate", "gray"];

/** Ready-made document names (SPEC: "มีชื่อสำเร็จรูปให้กด"). */
export const DOCUMENT_QUICK_NAMES = ["ใบจองโรงแรม", "ใบจองรถ", "ตั๋วเครื่องบิน", "ประกันเดินทาง", "ตั๋วกิจกรรม"] as const;

export const MAX_DOC_BYTES = 10 * 1024 * 1024; // backend B12 limit
export const MAX_TRIP_DAYS = 60;
export const MAX_NAME = 80;

export interface TripDocDraft {
  /** Name typed by the user; falls back to the file name when left empty. */
  name: string;
  fileName: string;
  mime: string;
  size: number;
}

export interface TripDraft {
  name: string;
  destination: string;
  startDate: ISODate;
  endDate: ISODate;
  /** Satang, or null when left empty. */
  budget: Satang | null;
  cover: ColorKey;
  /** Names of the other Members (the creator is added as owner automatically). */
  memberNames: string[];
  documents: TripDocDraft[];
}

export type CheckedTrip =
  | { ok: true; trip: TripDraft }
  | { ok: false; error: string; field?: "name" | "destination" | "dates" | "budget" | "members" | "documents" };

const clean = (s: string) => s.trim().replace(/\s+/g, " ");

/** "booking-confirmation.pdf" → "booking-confirmation". */
export function fileBaseName(fileName: string): string {
  return fileName.replace(/\.[^./]+$/, "") || fileName;
}

export function isAllowedDocument(mime: string, size: number): boolean {
  return /^(image\/|application\/pdf$)/.test(mime) && size > 0 && size <= MAX_DOC_BYTES;
}

function validDate(value: string): boolean {
  try {
    parseISODate(value);
    return true;
  } catch {
    return false;
  }
}

/** Validate and normalise a draft. `creatorName` is used to drop a duplicate of the creator from memberNames. */
export function checkTripDraft(draft: TripDraft, creatorName: string): CheckedTrip {
  const name = clean(draft.name);
  if (!name) return { ok: false, error: "ใส่ชื่อทริป", field: "name" };
  if (name.length > MAX_NAME) return { ok: false, error: `ชื่อทริปยาวเกิน ${MAX_NAME} ตัวอักษร`, field: "name" };
  const destination = clean(draft.destination);
  if (!destination) return { ok: false, error: "ใส่ปลายทาง", field: "destination" };
  if (destination.length > MAX_NAME) return { ok: false, error: `ปลายทางยาวเกิน ${MAX_NAME} ตัวอักษร`, field: "destination" };
  if (!validDate(draft.startDate) || !validDate(draft.endDate)) return { ok: false, error: "เลือกวันไปและวันกลับ", field: "dates" };
  const nights = daysBetween(draft.startDate, draft.endDate);
  if (nights < 0) return { ok: false, error: "วันกลับต้องไม่ก่อนวันไป", field: "dates" };
  if (nights + 1 > MAX_TRIP_DAYS) return { ok: false, error: `ทริปยาวได้ไม่เกิน ${MAX_TRIP_DAYS} วัน`, field: "dates" };
  if (draft.budget !== null && (!Number.isSafeInteger(draft.budget) || draft.budget < 0)) {
    return { ok: false, error: "งบประมาณไม่ถูกต้อง", field: "budget" };
  }

  const seen = new Set([clean(creatorName).toLowerCase()]);
  const memberNames: string[] = [];
  for (const raw of draft.memberNames) {
    const n = clean(raw);
    if (!n) continue;
    if (n.length > 40) return { ok: false, error: "ชื่อสมาชิกยาวเกิน 40 ตัวอักษร", field: "members" };
    if (seen.has(n.toLowerCase())) return { ok: false, error: `มีชื่อ "${n}" ซ้ำ`, field: "members" };
    seen.add(n.toLowerCase());
    memberNames.push(n);
  }
  if (memberNames.length > 30) return { ok: false, error: "เพิ่มสมาชิกได้ไม่เกิน 30 คน", field: "members" };

  const documents: TripDocDraft[] = [];
  for (const d of draft.documents) {
    if (!isAllowedDocument(d.mime, d.size)) return { ok: false, error: "เอกสารต้องเป็น PDF หรือรูป ขนาดไม่เกิน 10 MB", field: "documents" };
    documents.push({ ...d, name: (clean(d.name) || fileBaseName(d.fileName)).slice(0, 120) });
  }

  return {
    ok: true,
    trip: { name, destination, startDate: draft.startDate, endDate: draft.endDate, budget: draft.budget || null, cover: draft.cover, memberNames, documents },
  };
}
