import { redirect } from "next/navigation";

/** The app starts at "ทริปของฉัน" (proxy sends signed-out visitors to /login first). */
export default function Home() {
  redirect("/trips");
}
