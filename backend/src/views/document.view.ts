import type { DocumentDoc } from "../schemas/models.js";

/** No `fileKey`: files are only reachable through signed URLs. */
export function documentView(d: DocumentDoc) {
  return {
    id: d._id,
    tripId: d.tripId,
    name: d.name,
    mime: d.mime,
    size: d.size,
    uploadedBy: d.uploadedBy,
    createdAt: d.createdAt.toISOString(),
  };
}
