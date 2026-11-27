import type { Metadata } from "next";
import type { ReactNode } from "react";
import { AdminSidebar } from "@/components/admin/AdminSidebar";
import { UserSwitcher } from "@/components/dev/UserSwitcher";
import { getAdmin } from "@/lib/api/admin";

export const metadata: Metadata = { title: "ผู้ดูแลระบบ · Plan Trip", robots: { index: false } };

/**
 * Admin area (desktop, full width; SPEC "ผู้ดูแลระบบ"). The backend answers 404 to
 * anyone who is not an Admin, which getAdmin() turns into the app's normal 404.
 */
export default async function AdminLayout({ children }: { children: ReactNode }) {
  const admin = await getAdmin();
  return (
    <div className="flex min-h-dvh min-w-[1100px] flex-col bg-bg">
      {process.env.NODE_ENV === "development" ? <UserSwitcher /> : null}
      <div className="grid flex-1 grid-cols-[240px_1fr]">
        <AdminSidebar admin={admin} />
        <div className="flex min-w-0 flex-col">{children}</div>
      </div>
    </div>
  );
}
