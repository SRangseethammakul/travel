import type { SVGProps } from "react";

/** Line icons copied from the mockups (24×24, round caps). Always decorative. */
const paths = {
  back: { w: 2, d: <path d="M15 6l-6 6 6 6" /> },
  close: { w: 2, d: <path d="M6 6l12 12M18 6L6 18" /> },
  chevronRight: { w: 2, d: <path d="M9 6l6 6-6 6" /> },
  chevronDown: { w: 2.2, d: <path d="M6 9l6 6 6-6" /> },
  plus: { w: 2.2, d: <path d="M12 5v14M5 12h14" /> },
  check: { w: 3, d: <path d="M5 12l5 5 9-10" /> },
  edit: { w: 1.8, d: <><path d="M12 20h9" /><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z" /></> },
  trash: { w: 1.8, d: <><path d="M4 7h16M10 11v6M14 11v6" /><path d="M6 7l1 13h10l1-13" /><path d="M9 7V4h6v3" /></> },
  bell: { w: 1.8, d: <><path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" /><path d="M10.3 21a1.9 1.9 0 0 0 3.4 0" /></> },
  more: { w: 0, d: <><circle cx="5" cy="12" r="1.8" fill="currentColor" /><circle cx="12" cy="12" r="1.8" fill="currentColor" /><circle cx="19" cy="12" r="1.8" fill="currentColor" /></> },
  tag: { w: 1.8, d: <><path d="M20.6 13.4l-7.2 7.2a2 2 0 0 1-2.8 0L3 13V3h10l7.6 7.6a2 2 0 0 1 0 2.8z" /><circle cx="7.5" cy="7.5" r="1.5" /></> },
  search: { w: 1.8, d: <><circle cx="11" cy="11" r="7" /><path d="M20 20l-3.5-3.5" /></> },
  sort: { w: 1.8, d: <path d="M7 4v16M3 16l4 4 4-4M17 20V4M13 8l4-4 4 4" /> },
  trip: { w: 1.8, d: <><rect x="3" y="7" width="18" height="13" rx="2" /><path d="M9 7V5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2" /><path d="M3 13h18" /></> },
  plan: { w: 1.8, d: <><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M3 10h18M8 3v4M16 3v4" /></> },
  place: { w: 1.8, d: <><path d="M12 21s-7-6.2-7-11.5a7 7 0 0 1 14 0C19 14.8 12 21 12 21z" /><circle cx="12" cy="9.5" r="2.5" /></> },
  receipt: { w: 1.8, d: <><path d="M6 3h12v18l-3-2-3 2-3-2-3 2z" /><path d="M9 8h6M9 12h6" /></> },
  summary: { w: 1.8, d: <><path d="M12 3a9 9 0 1 0 9 9h-9z" /><path d="M15 3.5A9 9 0 0 1 20.5 9H15z" /></> },
  addMember: { w: 2, d: <><circle cx="9" cy="8" r="3.5" /><path d="M2.5 20a6.5 6.5 0 0 1 13 0" /><path d="M17 11h5M19.5 8.5v5" /></> },
  link: { w: 1.8, d: <><path d="M10 14a5 5 0 0 0 7 0l3-3a5 5 0 0 0-7-7l-1 1" /><path d="M14 10a5 5 0 0 0-7 0l-3 3a5 5 0 0 0 7 7l1-1" /></> },
  plane: { w: 1.8, d: <path d="M2 16l20-6-3-3-6 2-6-5-2 1 4 6-5 2-2-1-1 1z" /> },
  train: { w: 1.8, d: <><rect x="5" y="3" width="14" height="14" rx="3" /><path d="M5 11h14M9 21l2-4M15 21l-2-4" /><circle cx="9" cy="14" r=".6" fill="currentColor" /><circle cx="15" cy="14" r=".6" fill="currentColor" /></> },
  boat: { w: 1.8, d: <><path d="M3 17l2 3h14l2-3z" /><path d="M6 17V11h12v6M12 11V5h3" /></> },
  bus: { w: 1.8, d: <><rect x="4" y="3" width="16" height="15" rx="3" /><path d="M4 11h16M7 18v3M17 18v3" /><circle cx="8" cy="14.5" r=".6" fill="currentColor" /><circle cx="16" cy="14.5" r=".6" fill="currentColor" /></> },
  car: { w: 1.8, d: <><path d="M4 16v-4l2-5h12l2 5v4z" /><path d="M4 12h16M6 16v3M18 16v3" /><circle cx="8" cy="14" r=".6" fill="currentColor" /><circle cx="16" cy="14" r=".6" fill="currentColor" /></> },
  walk: { w: 1.8, d: <><circle cx="13" cy="4" r="2" /><path d="M10 21l2-6 3 3v3" /><path d="M7 12l2-4 4-1 3 4 2 1" /><path d="M12 15l1-8" /></> },
  route: { w: 2, d: <><circle cx="6" cy="19" r="2" /><circle cx="18" cy="5" r="2" /><path d="M8 19h8a3 3 0 0 0 0-6H8a3 3 0 0 1 0-6h8" /></> },
  doc: { w: 2, d: <><path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z" /><path d="M14 3v6h6" /></> },
  card: { w: 1.8, d: <><rect x="2" y="5" width="20" height="14" rx="2" /><path d="M2 10h20M6 15h4" /></> },
  home: { w: 1.8, d: <><path d="M3 11l9-7 9 7" /><path d="M5 10v10h14V10" /><path d="M10 20v-5h4v5" /></> },
  clock: { w: 1.8, d: <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></> },
  lock: { w: 1.8, d: <><rect x="5" y="11" width="14" height="10" rx="2" /><path d="M8 11V7a4 4 0 0 1 8 0v4" /></> },
  arrowRight: { w: 2, d: <path d="M5 12h14M13 6l6 6-6 6" /> },
  checklist: { w: 2, d: <><path d="M4 6l2 2 4-4M4 14l2 2 4-4" /><path d="M13 7h7M13 15h7" /></> },
  cash: { w: 1.8, d: <><rect x="2" y="6" width="20" height="12" rx="2" /><circle cx="12" cy="12" r="2.5" /><path d="M6 9.5v5M18 9.5v5" /></> },
  transfer: { w: 1.8, d: <><path d="M4 8h15l-3-3" /><path d="M20 16H5l3 3" /></> },
  wallet: { w: 1.8, d: <><path d="M3 7h16a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" /><path d="M3 7l12-4v4" /><circle cx="16" cy="13.5" r="1.3" /></> },
  paste: { w: 1.8, d: <><path d="M9 4h6v3H9z" /><path d="M15 5h2a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h2" /></> },
  image: { w: 1.8, d: <><rect x="3" y="3" width="18" height="18" rx="2" /><circle cx="9" cy="9" r="2" /><path d="M21 15l-5-5L5 21" /></> },
  print: { w: 1.8, d: <><path d="M7 9V3h10v6" /><rect x="3" y="9" width="18" height="8" rx="2" /><path d="M7 14h10v7H7z" /></> },
  minus: { w: 2, d: <path d="M5 12h14" /> },
} as const;

export type IconName = keyof typeof paths;

/** Icon per Transit mode (plane, train, boat, bus, car, walk); "other" falls back to the route icon. */
export const transitModeIcon = { plane: "plane", train: "train", bus: "bus", car: "car", boat: "boat", walk: "walk", other: "route" } as const satisfies Record<string, IconName>;

interface IconProps extends Omit<SVGProps<SVGSVGElement>, "children"> {
  name: IconName;
  size?: number;
}

export function Icon({ name, size = 24, ...rest }: IconProps) {
  const icon = paths[name];
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={icon.w || undefined}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      {...rest}
    >
      {icon.d}
    </svg>
  );
}
