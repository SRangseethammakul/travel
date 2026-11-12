import { switchMockUser } from "@/lib/api/dev-actions";
import { getSignedInUser, listUsers } from "@/lib/api";
import { cn } from "@/lib/cn";
import { solidBg } from "@/components/ui/colors";

/**
 * Dev-only strip for switching the signed-in User (cookie `mock-user`; the list
 * comes from the backend, A17). Renders nothing outside `next dev`, and also
 * shows on Login, so it must not redirect when signed out.
 */
export async function UserSwitcher() {
  if (process.env.NODE_ENV !== "development") return null;
  const [me, users] = await Promise.all([getSignedInUser(), listUsers()]);

  return (
    <form
      action={switchMockUser}
      aria-label="สลับผู้ใช้ทดสอบ (เฉพาะตอนพัฒนา)"
      className="flex items-center gap-1 border-b border-dashed border-control bg-surface-alt px-3"
    >
      <span className="mr-auto text-xs text-ink-muted">
        {me ? (
          <>
            ทดสอบเป็น <strong className="font-semibold text-ink">{me.name}</strong>
          </>
        ) : (
          "ยังไม่ได้เข้าสู่ระบบ"
        )}
      </span>
      {users.map((u) => {
        const current = u.id === me?.id;
        return (
          <button
            key={u.id}
            type="submit"
            name="userId"
            value={u.id}
            aria-pressed={current}
            aria-label={`ทดสอบเป็น ${u.name}`}
            className="flex size-11 cursor-pointer items-center justify-center rounded-full border-0 bg-transparent"
          >
            <span
              aria-hidden="true"
              className={cn(
                "flex size-7 items-center justify-center rounded-full font-display text-[11px] font-semibold text-surface transition-shadow",
                solidBg[u.color],
                current ? "ring-2 ring-ink ring-offset-2 ring-offset-surface-alt" : "opacity-70",
              )}
            >
              {u.name.charAt(0)}
            </span>
          </button>
        );
      })}
    </form>
  );
}
