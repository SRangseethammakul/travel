import type { Metadata } from "next";
import { DocumentList, type DocumentRow } from "@/components/documents/DocumentList";
import { BackHeader } from "@/components/ui/BackHeader";
import { getDocuments, getDocumentUrl, getMembers, requireTripMember } from "@/lib/api";
import { canDeleteDocument, canUploadDocument } from "@/lib/permissions";

export const metadata: Metadata = { title: "เอกสารของทริป · [ชื่อแอป]" };

/** Trip documents (A6 list, B13 open, B12 upload, B14 delete). Self-designed: SPEC lists this page as open. */
export default async function DocumentsPage({ params }: PageProps<"/trips/[tripId]/documents">) {
  const { tripId } = await params;
  const { trip, me } = await requireTripMember(tripId);
  const [documents, members] = await Promise.all([getDocuments(tripId), getMembers(tripId)]);
  const urls = await Promise.all(documents.map((d) => getDocumentUrl(tripId, d.id)));
  const rows: DocumentRow[] = documents.map((d, i) => ({
    id: d.id,
    name: d.name,
    mime: d.mime,
    size: d.size,
    uploaderName: d.uploadedBy === me.id ? "คุณ" : (members.find((m) => m.id === d.uploadedBy)?.displayName ?? "สมาชิกที่ออกไปแล้ว"),
    url: urls[i],
    canDelete: canDeleteDocument(me, d),
  }));

  return (
    <div className="flex min-h-dvh flex-1 flex-col">
      <BackHeader title="เอกสารของทริป" subtitle={`${trip.name} · ${documents.length} ไฟล์`} href={`/trips/${encodeURIComponent(tripId)}`} />
      <main className="flex flex-1 flex-col gap-3 px-5 pt-2 pb-6">
        <DocumentList tripId={tripId} rows={rows} canUpload={canUploadDocument(me)} />
      </main>
    </div>
  );
}
