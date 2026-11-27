import { Segmented } from "@/components/ui/Segmented";
import { IconLink } from "@/components/ui/IconButton";

interface AddToPlanHeaderProps {
  title: string;
  subtitle?: string;
  closeHref: string;
  /** `/trips/<id>/plan` */
  planBase: string;
  day: number;
  current: "place" | "transit";
  children?: React.ReactNode;
}

/** Header of PickPlace / AddTransit: close, title and the "สถานที่ · การเดินทาง" switch (links, state in the URL). */
export function AddToPlanHeader({ title, subtitle, closeHref, planBase, day, current, children }: AddToPlanHeaderProps) {
  return (
    <header className="flex flex-col gap-3 px-5 pt-4 pb-3">
      <div className="-ml-2 flex items-center gap-2">
        <IconLink href={closeHref} icon="close" label="ปิด" variant="ghost" />
        <div className="flex min-w-0 flex-col">
          <h1 className="m-0 truncate font-display text-lg font-semibold">{title}</h1>
          {subtitle ? <span className="text-[13px] text-ink-muted">{subtitle}</span> : null}
        </div>
      </div>
      <Segmented
        label="ประเภทรายการ"
        value={current}
        options={[
          { value: "place", label: "สถานที่", href: `${planBase}/add?day=${day}` },
          { value: "transit", label: "ตั๋วเดินทาง", href: `${planBase}/transit/new?day=${day}` },
        ]}
      />
      {children}
    </header>
  );
}
