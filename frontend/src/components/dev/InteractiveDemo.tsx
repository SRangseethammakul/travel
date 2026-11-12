"use client";

import { useState } from "react";
import { BottomSheet, Button, Chip, ConfirmDialog, Segmented } from "@/components/ui";

const MODES = ["เดิน", "รถไฟ", "รถบัส", "แท็กซี่", "รถเช่า"] as const;
const TAGS = ["ราเมง", "ต้องจอง", "ปิ้งย่าง", "คาเฟ่", "เปิดดึก"] as const;

/** Client-side pieces of /dev/ui: state-driven chips, segmented, sheet and dialog. */
export function InteractiveDemo() {
  const [groupBy, setGroupBy] = useState<"area" | "type">("area");
  const [split, setSplit] = useState<"equal" | "amount" | "shares">("equal");
  const [tags, setTags] = useState<string[]>(["ราเมง"]);
  const [mode, setMode] = useState<string>("รถไฟ");
  const [sheetOpen, setSheetOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [log, setLog] = useState("");

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <h3 className="m-0 text-sm font-semibold text-ink-muted">Segmented (ปุ่ม · radiogroup)</h3>
        <Segmented
          label="วิธีหาร"
          value={split}
          onChange={setSplit}
          options={[
            { value: "equal", label: "เท่ากัน" },
            { value: "amount", label: "ระบุจำนวน" },
            { value: "shares", label: "ตามสัดส่วน" },
          ]}
        />
        <Segmented
          label="จัดกลุ่มตาม"
          size="sm"
          fill={false}
          value={groupBy}
          onChange={setGroupBy}
          options={[
            { value: "area", label: "ตามย่าน" },
            { value: "type", label: "ตามประเภท" },
          ]}
        />
      </div>

      <div className="flex flex-col gap-2">
        <h3 className="m-0 text-sm font-semibold text-ink-muted">Chip · กรอง tag (เลือกได้หลายอัน)</h3>
        <div aria-label="กรองด้วย tag" role="group" className="-mx-5 flex gap-1.5 overflow-x-auto px-5 py-1">
          {TAGS.map((t) => (
            <Chip
              key={t}
              size="sm"
              selected={tags.includes(t)}
              onClick={() => setTags((x) => (x.includes(t) ? x.filter((y) => y !== t) : [...x, t]))}
            >
              <span className="opacity-70">#</span>
              {t}
            </Chip>
          ))}
        </div>
        <h3 className="m-0 text-sm font-semibold text-ink-muted">Chip · เลือกอันเดียว (radio, สีเข้ม)</h3>
        <div role="radiogroup" aria-label="วิธีเดินทาง" className="flex flex-wrap gap-2">
          {MODES.map((m) => (
            <Chip key={m} kind="radio" tone="ink" selected={mode === m} onClick={() => setMode(m)}>
              {m}
            </Chip>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <Button variant="secondary" onClick={() => setSheetOpen(true)}>
          เปิด BottomSheet
        </Button>
        <Button variant="danger-outline" onClick={() => setConfirmOpen(true)}>
          เปิด ConfirmDialog
        </Button>
      </div>
      {log ? (
        <p role="status" className="m-0 text-[13px] text-ink-muted">
          {log}
        </p>
      ) : null}

      <BottomSheet
        open={sheetOpen}
        onClose={() => setSheetOpen(false)}
        caption="การเดินทาง"
        title="โรงแรมใกล้สถานีชินจูกุ → ร้านราเมงซุปเข้มข้น"
        footer={
          <div className="grid grid-cols-2 gap-2">
            <Button variant="secondary" onClick={() => setSheetOpen(false)}>
              ยกเลิก
            </Button>
            <Button
              onClick={() => {
                setSheetOpen(false);
                setLog(`บันทึกการเดินทาง: ${mode}`);
              }}
            >
              บันทึก
            </Button>
          </div>
        }
      >
        <div role="radiogroup" aria-label="วิธีเดินทาง" className="flex flex-wrap gap-2">
          {MODES.map((m) => (
            <Chip key={m} kind="radio" tone="ink" selected={mode === m} onClick={() => setMode(m)}>
              {m}
            </Chip>
          ))}
        </div>
        <div className="grid grid-cols-[110px_minmax(0,1fr)] gap-2">
          <label className="flex flex-col gap-1 text-xs font-semibold text-ink-muted">
            นาที (โดยประมาณ)
            <input inputMode="numeric" placeholder="15" className="h-11 min-w-0 rounded-chip border border-line-strong px-3 text-[15px] font-normal text-ink" />
          </label>
          <label className="flex flex-col gap-1 text-xs font-semibold text-ink-muted">
            โน้ต เช่น สายรถไฟ ทางออก
            <input placeholder="JR Yamanote ไป Shibuya" className="h-11 min-w-0 rounded-chip border border-line-strong px-3 text-[15px] font-normal text-ink" />
          </label>
        </div>
      </BottomSheet>

      <ConfirmDialog
        open={confirmOpen}
        title={"ลบ \"ที่พัก 3 คืน\"?"}
        description="ยอดที่ทุกคนต้องจ่ายจะคำนวณใหม่ และสมาชิกทุกคนจะได้รับแจ้งเตือน"
        confirmLabel="ลบรายการ"
        onConfirm={() => {
          setConfirmOpen(false);
          setLog("กดยืนยันลบแล้ว (ตัวอย่าง ไม่ได้ลบจริง)");
        }}
        onCancel={() => setConfirmOpen(false)}
      />
    </div>
  );
}
