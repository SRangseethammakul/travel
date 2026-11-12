/** `_id` → `id`, Date → ISO string. Every resource view builds on this. */
export type Serialized<T> = {
  [K in keyof T as K extends "_id" ? "id" : K]: T[K] extends Date
    ? string
    : T[K] extends Date | undefined
      ? string | undefined
      : T[K] extends Date | null
        ? string | null
        : T[K];
};

export function serialize<T extends { _id: string }>(doc: T): Serialized<T> {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(doc) as [string, unknown][]) {
    out[key === "_id" ? "id" : key] = value instanceof Date ? value.toISOString() : value;
  }
  return out as Serialized<T>;
}
