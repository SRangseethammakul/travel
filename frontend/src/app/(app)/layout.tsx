import { UserSwitcher } from "@/components/dev/UserSwitcher";

/** The phone-sized app frame. Mockups are drawn at 390px; it stretches up to 640px (--container-app) and stays centred beyond that. */
export default function AppLayout({ children }: LayoutProps<"/">) {
  return (
    <div className="relative mx-auto flex min-h-dvh w-full max-w-app flex-col bg-bg">
      {process.env.NODE_ENV === "development" ? <UserSwitcher /> : null}
      {children}
    </div>
  );
}
