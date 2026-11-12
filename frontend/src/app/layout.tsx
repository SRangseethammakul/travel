import type { Metadata, Viewport } from "next";
import { IBM_Plex_Sans_Thai, Prompt } from "next/font/google";
import { UserSwitcher } from "@/components/dev/UserSwitcher";
import "./globals.css";

const prompt = Prompt({
  weight: ["500", "600", "700"],
  subsets: ["thai", "latin"],
  variable: "--font-prompt",
  display: "swap",
});

const plexThai = IBM_Plex_Sans_Thai({
  weight: ["400", "500", "600"],
  subsets: ["thai", "latin"],
  variable: "--font-plex-thai",
  display: "swap",
});

export const metadata: Metadata = {
  title: "[ชื่อแอป]",
  description: "วางแผนเที่ยวเป็นกลุ่ม จดค่าใช้จ่าย หารเงิน และโอนคืน",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#F3F5F7",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="th" className={`${prompt.variable} ${plexThai.variable}`}>
      <body>
        {/* Designed at 390px; wider screens keep the phone frame centred. */}
        <div className="relative mx-auto flex min-h-dvh w-full max-w-[390px] flex-col bg-bg">
          {process.env.NODE_ENV === "development" ? <UserSwitcher /> : null}
          {children}
        </div>
      </body>
    </html>
  );
}
