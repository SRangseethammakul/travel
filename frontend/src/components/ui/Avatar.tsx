"use client";

import { useState } from "react";
import type { ColorKey } from "@/lib/api/types";
import { cn } from "@/lib/cn";
import { solidBg } from "./colors";

const sizes = {
  xs: "size-7 text-[11px]", // 28 — avatar stacks on trip cards
  sm: "size-8 text-[13px]", // 32 — split rows
  md: "size-9 text-sm", // 36 — detail rows
  lg: "size-10 text-[15px]", // 40 — member list
  xl: "size-11 text-base", // 44 — account button
} as const;

interface AvatarProps {
  name: string;
  color: ColorKey;
  /** Profile picture (LINE / Google). Falls back to the initial if missing or it fails to load. */
  src?: string;
  size?: keyof typeof sizes;
  /** White ring, for overlapping stacks. */
  ring?: boolean;
  /** Set when the avatar stands alone and needs to be announced. Otherwise it is decorative. */
  label?: string;
  className?: string;
}

export function Avatar({ name, color, src, size = "lg", ring, label, className }: AvatarProps) {
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  const showImage = !!src && failedSrc !== src;
  return (
    <span
      {...(label ? { role: "img", "aria-label": label } : { "aria-hidden": true })}
      className={cn(
        "inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full font-display font-semibold text-surface",
        solidBg[color],
        sizes[size],
        ring && "border-2 border-surface",
        className,
      )}
    >
      {showImage ? (
        // Plain <img>: provider hosts vary, and Google answers 403 to some referrers.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={src}
          alt=""
          referrerPolicy="no-referrer"
          className="size-full object-cover"
          onError={() => setFailedSrc(src)}
        />
      ) : (
        name.trim().charAt(0).toUpperCase()
      )}
    </span>
  );
}

interface AvatarStackProps {
  people: { id: string; name: string; color: ColorKey }[];
  className?: string;
}

/** Overlapping avatars; the names are announced once as a list label. */
export function AvatarStack({ people, className }: AvatarStackProps) {
  return (
    <span role="img" aria-label={`สมาชิก ${people.map((p) => p.name).join(", ")}`} className={cn("flex", className)}>
      {people.map((p) => (
        <Avatar key={p.id} name={p.name} color={p.color} size="xs" ring className="-mr-1.5" />
      ))}
    </span>
  );
}
