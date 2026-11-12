import type { Metadata } from "next";
import { ProviderButton } from "@/components/auth/ProviderButton";
import { Avatar } from "@/components/ui/Avatar";
import { getInvitePreview } from "@/lib/api";
import { signIn } from "@/lib/api/auth-actions";
import { joinTokenFromPath, safeNextPath } from "@/lib/next-path";

export const metadata: Metadata = { title: "เข้าสู่ระบบ · [ชื่อแอป]" };

function first(v: string | string[] | undefined) {
  return Array.isArray(v) ? v[0] : v;
}

/** "เข้าสู่ระบบเพื่อเข้าร่วม โตเกียวหน้าหนาว · ในชื่อ Ploy" when Login was opened from an invite. */
async function inviteContext(next: string) {
  const token = joinTokenFromPath(next);
  if (!token) return null;
  const preview = await getInvitePreview(token);
  if (!preview) return null;
  const query = new URLSearchParams(next.split("?")[1] ?? "");
  const as = query.get("as");
  const picked = as && as !== "new" ? preview.unclaimed.find((u) => u.member.id === as)?.member : undefined;
  const name = picked?.displayName ?? (as === "new" ? query.get("name")?.trim().slice(0, 40) : undefined);
  return { trip: preview.trip, name: name || null, color: picked?.color ?? "gray" };
}

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const query = await searchParams;
  const next = safeNextPath(first(query.next));
  const invite = await inviteContext(next);
  // The backend's OAuth callback comes back with ?error=cancelled when the User backs out.
  const cancelled = first(query.error) === "cancelled";
  // Development signs in with the mock buttons (`mock-user`); production goes through LINE / Google.
  const mock = process.env.NODE_ENV === "development";
  const oauthHref = (provider: "line" | "google") => `/api/auth/${provider}?next=${encodeURIComponent(next)}`;

  return (
    <div className="flex min-h-dvh flex-1 flex-col bg-surface">
      <main className="flex flex-1 flex-col justify-center gap-7 px-6 pt-6 pb-3">
        <div className="flex flex-col items-center gap-3.5 text-center">
          <span className="flex size-[72px] items-center justify-center rounded-[22px] bg-ink text-surface">
            <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <rect x="3" y="7" width="18" height="13" rx="2" />
              <path d="M9 7V5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2" />
              <path d="M3 13h18" />
            </svg>
          </span>
          <h1 className="m-0 font-display text-[26px] font-semibold">[ชื่อแอป]</h1>
          <p className="m-0 leading-[1.55] text-ink-subtle">
            วางแผนเที่ยวกับเพื่อน จดค่าใช้จ่าย
            <br />
            แล้วหารกันง่ายๆ ในที่เดียว
          </p>
        </div>

        {invite ? (
          <section aria-label="คำเชิญ" className="flex items-center gap-3 rounded-tile bg-bg p-3.5">
            <Avatar name={invite.name ?? invite.trip.name} color={invite.name ? invite.color : invite.trip.cover} size="xl" />
            <span className="flex min-w-0 flex-col gap-0.5">
              <span className="text-[13px] text-ink-muted">เข้าสู่ระบบเพื่อเข้าร่วม</span>
              <span className="font-semibold">
                {invite.trip.name}
                {invite.name ? ` · ในชื่อ ${invite.name}` : ""}
              </span>
            </span>
          </section>
        ) : null}

        {cancelled ? (
          <p role="alert" className="m-0 rounded-xl bg-todo-soft px-3.5 py-2.5 text-center text-[13px] text-todo">
            ยังไม่ได้เข้าสู่ระบบ ลองกดเข้าสู่ระบบอีกครั้ง
          </p>
        ) : null}

        {mock ? (
          <form action={signIn} className="flex flex-col gap-2.5">
            <input type="hidden" name="next" value={next} />
            <ProviderButton provider="line" />
            <ProviderButton provider="google" />
            <p className="m-0 mt-1 text-center text-xs leading-normal text-ink-muted">ใช้แค่ชื่อ อีเมล และรูปโปรไฟล์ ไม่โพสต์อะไรแทนคุณ</p>
          </form>
        ) : (
          <div className="flex flex-col gap-2.5">
            <ProviderButton provider="line" href={oauthHref("line")} />
            <ProviderButton provider="google" href={oauthHref("google")} />
            <p className="m-0 mt-1 text-center text-xs leading-normal text-ink-muted">ใช้แค่ชื่อ อีเมล และรูปโปรไฟล์ ไม่โพสต์อะไรแทนคุณ</p>
          </div>
        )}
      </main>

      <footer className="px-6 pt-3 pb-8 text-center text-xs leading-relaxed text-ink-muted">
        การเข้าสู่ระบบถือว่ายอมรับ <strong className="font-semibold text-ink-subtle">ข้อกำหนดการใช้งาน</strong> และ{" "}
        <strong className="font-semibold text-ink-subtle">นโยบายความเป็นส่วนตัว</strong>
      </footer>
    </div>
  );
}
