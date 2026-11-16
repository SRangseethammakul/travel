"use client";

import { useParams, usePathname } from "next/navigation";
import { NotFoundState } from "@/components/ui/NotFoundState";

/**
 * 404 inside a trip (notFound() from an Expense or Personal Expense page).
 * not-found.tsx gets no props, so the back link is built from the URL.
 * A missing trip never gets here: requireTripMember redirects to /trips.
 */
export default function TripNotFound() {
  const { tripId } = useParams<{ tripId: string }>();
  const pathname = usePathname();
  const base = `/trips/${encodeURIComponent(tripId)}`;

  if (pathname.includes("/expenses/personal/")) {
    return (
      <NotFoundState
        title="ไม่พบรายการนี้"
        body="รายการนี้อาจถูกลบไปแล้ว หรือลิงก์ไม่ถูกต้อง"
        href={`${base}/expenses?view=personal`}
        backLabel="กลับไปค่าใช้จ่ายส่วนตัว"
      />
    );
  }
  if (pathname.includes("/expenses/")) {
    return (
      <NotFoundState
        title="ไม่พบรายการนี้"
        body="รายการนี้อาจถูกลบไปแล้ว หรือลิงก์ไม่ถูกต้อง"
        href={`${base}/expenses`}
        backLabel="กลับไปค่าใช้จ่าย"
      />
    );
  }
  return (
    <NotFoundState title="ไม่พบหน้านี้" body="ลิงก์อาจไม่ถูกต้อง หรือหน้านี้ถูกลบไปแล้ว" href={base} backLabel="กลับไปหน้าทริป" />
  );
}
