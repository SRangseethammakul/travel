"use client";

import { useRouter } from "next/navigation";
import { useId, useState, useTransition } from "react";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { updateTripAction } from "@/lib/api/trip-actions";
import { cn } from "@/lib/cn";
import { MAX_NAME, type TripDetails } from "@/lib/trip-form";

const inputClass =
  "h-12 w-full min-w-0 rounded-icon border border-line-strong bg-surface px-3.5 text-base text-ink placeholder:text-ink-muted";

/**
 * "แก้ไขทริป" (owner only): name, destination and dates, with CreateTrip's fields.
 * Self-designed — there is no mockup for this page.
 */
export function EditTripForm({ tripId, initial }: { tripId: string; initial: TripDetails }) {
  const router = useRouter();
  const ids = { name: useId(), dest: useId(), start: useId(), end: useId() };
  const [name, setName] = useState(initial.name);
  const [destination, setDestination] = useState(initial.destination);
  const [startDate, setStartDate] = useState(initial.startDate);
  const [endDate, setEndDate] = useState(initial.endDate);
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();

  const submit = () =>
    startTransition(async () => {
      setError("");
      const result = await updateTripAction(tripId, { name, destination, startDate, endDate });
      if ("error" in result) {
        setError(result.error);
        return;
      }
      router.push(result.href);
    });

  return (
    <form
      className="flex flex-1 flex-col"
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
    >
      <main className="flex flex-1 flex-col gap-5 px-5 pt-1 pb-5">
        <div className="flex flex-col gap-1.5">
          <label htmlFor={ids.name} className="text-sm font-semibold">
            ชื่อทริป
          </label>
          <input id={ids.name} required maxLength={MAX_NAME} value={name} onChange={(e) => setName(e.target.value)} placeholder="เช่น โตเกียวหน้าหนาว" className={inputClass} />
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor={ids.dest} className="text-sm font-semibold">
            ปลายทาง
          </label>
          <div className="flex h-12 items-center gap-2 rounded-icon border border-line-strong px-3.5 text-ink-muted focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-primary">
            <Icon name="place" size={18} />
            <input
              id={ids.dest}
              required
              maxLength={MAX_NAME}
              value={destination}
              onChange={(e) => setDestination(e.target.value)}
              placeholder="เมือง หรือ ประเทศ"
              className="min-w-0 flex-1 border-0 bg-transparent text-base text-ink outline-none placeholder:text-ink-muted"
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2.5">
          <div className="flex flex-col gap-1.5">
            <label htmlFor={ids.start} className="text-sm font-semibold">
              วันไป
            </label>
            <input
              id={ids.start}
              type="date"
              required
              value={startDate}
              onChange={(e) => {
                setStartDate(e.target.value);
                if (endDate < e.target.value) setEndDate(e.target.value);
              }}
              className={cn(inputClass, "px-3")}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label htmlFor={ids.end} className="text-sm font-semibold">
              วันกลับ
            </label>
            <input id={ids.end} type="date" required min={startDate} value={endDate} onChange={(e) => setEndDate(e.target.value)} className={cn(inputClass, "px-3")} />
          </div>
        </div>
      </main>

      <footer className="sticky bottom-0 z-10 flex flex-col gap-2 border-t border-line bg-surface px-5 pt-3 pb-[calc(28px+env(safe-area-inset-bottom))]">
        {error ? (
          <p role="alert" className="m-0 rounded-chip bg-danger-soft px-3 py-2 text-[13px] font-semibold text-danger-ink">
            {error}
          </p>
        ) : null}
        <Button type="submit" size="lg" block disabled={pending} aria-busy={pending || undefined} className="h-[54px] rounded-2xl">
          {pending ? "กำลังบันทึก…" : "บันทึก"}
        </Button>
      </footer>
    </form>
  );
}
