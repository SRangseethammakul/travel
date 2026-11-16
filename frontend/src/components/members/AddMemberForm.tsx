"use client";

import { useId, useState, useTransition } from "react";
import { Button } from "@/components/ui/Button";
import { fieldClass } from "@/components/ui/field";
import { addMemberByName } from "@/lib/api/member-actions";
import type { ID } from "@/lib/api/types";

/** Owner types a friend's name; they join as an Unclaimed Member and pick the name from the invite link later. */
export function AddMemberForm({ tripId, alone }: { tripId: ID; alone: boolean }) {
  const id = useId();
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const [added, setAdded] = useState("");
  const [pending, startTransition] = useTransition();

  const submit = () => {
    const n = name.trim();
    if (!n) {
      setError("พิมพ์ชื่อเพื่อนก่อน");
      return;
    }
    startTransition(async () => {
      setError("");
      setAdded("");
      const result = await addMemberByName(tripId, n);
      if (result?.error) setError(result.error);
      else {
        setAdded(n);
        setName("");
      }
    });
  };

  return (
    <section aria-labelledby={`${id}-h`} className="flex flex-col gap-2.5 rounded-tile border-[1.5px] border-primary bg-primary-soft p-3.5">
      <h2 id={`${id}-h`} className="m-0 text-sm font-semibold text-primary-ink-strong">
        เพิ่มคนด้วยชื่อ
      </h2>
      {alone ? (
        <p className="m-0 text-[13px] leading-normal text-primary-ink-strong">ตอนนี้ในทริปมีแค่คุณคนเดียว เพิ่มชื่อเพื่อนก่อน แล้วค่อยหารค่าใช้จ่ายกันได้</p>
      ) : null}
      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
      >
        <label htmlFor={id} className="sr-only">
          ชื่อเพื่อน
        </label>
        <input id={id} maxLength={40} value={name} onChange={(e) => setName(e.target.value)} placeholder="พิมพ์ชื่อเพื่อน เช่น มิ้นท์" className={fieldClass} />
        <Button type="submit" disabled={pending} className="shrink-0">
          {pending ? "กำลังเพิ่ม…" : "เพิ่ม"}
        </Button>
      </form>
      {error ? (
        <p role="alert" className="m-0 text-[13px] font-semibold text-danger-ink">
          {error}
        </p>
      ) : null}
      {added ? (
        <p role="status" className="m-0 text-[13px] font-semibold text-primary-ink-strong">
          เพิ่ม {added} แล้ว
        </p>
      ) : null}
      <p className="m-0 text-xs leading-normal text-primary-ink-soft">
        เพื่อนจะอยู่ในรายชื่อและหารเงินได้ทันที ภายหลังเพื่อนกดลิงก์เชิญด้านล่างแล้วเลือกชื่อตัวเองได้ ค่าใช้จ่ายที่จดไว้จะไปอยู่ในบัญชีเขา
      </p>
    </section>
  );
}
