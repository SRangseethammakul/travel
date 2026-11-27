import type { Metadata } from "next";
import { NotFoundState } from "@/components/ui/NotFoundState";

export const metadata: Metadata = { title: "ไม่พบหน้านี้" };

/** App-wide 404 (unknown URLs and notFound() outside a trip). */
export default function NotFound() {
  return (
    // The root layout has no frame any more, so the 404 brings its own (also used for non-admins on /admin).
    <div className="relative mx-auto flex min-h-dvh w-full max-w-app flex-col bg-bg">
      <NotFoundState
        title="ไม่พบหน้านี้"
        body="ลิงก์อาจไม่ถูกต้อง หรือหน้านี้ถูกลบไปแล้ว"
        href="/trips"
        backLabel="กลับไปหน้าทริปของฉัน"
      />
    </div>
  );
}
