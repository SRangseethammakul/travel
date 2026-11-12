import { collections } from "../db/collections.js";
import type { TagDoc } from "../schemas/models.js";

export function findTagsByOwner(ownerId: string): Promise<TagDoc[]> {
  return collections.tags().find({ ownerId }).sort({ name: 1 }).toArray();
}

/** Unknown ids (deleted tags) are skipped. */
export function findTagsByIds(ids: string[]): Promise<TagDoc[]> {
  if (!ids.length) return Promise.resolve([]);
  return collections.tags().find({ _id: { $in: ids } }).sort({ name: 1 }).toArray();
}

export function findTag(tagId: string): Promise<TagDoc | null> {
  return collections.tags().findOne({ _id: tagId });
}

/** Throws E11000 when the owner already has a tag with that name (`tags_owner_name`). */
export async function insertTags(docs: TagDoc[]): Promise<void> {
  if (docs.length) await collections.tags().insertMany(docs);
}

/** Only the owner's tag is updated. Throws E11000 on a duplicate name. */
export function updateTag(tagId: string, ownerId: string, set: Partial<Pick<TagDoc, "name" | "group">>): Promise<TagDoc | null> {
  return collections.tags().findOneAndUpdate({ _id: tagId, ownerId }, { $set: set }, { returnDocument: "after" });
}

export async function deleteTag(tagId: string, ownerId: string): Promise<void> {
  await collections.tags().deleteOne({ _id: tagId, ownerId });
}
