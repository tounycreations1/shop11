import type { SVGProps } from "react";

export type IconName =
  | "visitor"
  | "seller"
  | "shop"
  | "map"
  | "search"
  | "live"
  | "arrow"
  | "package"
  | "service"
  | "close"
  | "upload"
  | "navigation"
  | "users"
  | "spark"
  | "chevron"
  | "image"
  | "trash"
  | "star"
  | "check"
  | "grid"
  | "compass"
  | "clock"
  | "tag"
  | "plus"
  | "refresh"
  | "walk"
  | "sound"
  | "offers"
  | "phone"
  | "eye"
  | "male"
  | "female"
  | "chat"
  | "whatsapp"
  | "send"
  | "back";

export function Icon({
  name,
  size = 20,
  ...props
}: { name: IconName; size?: number } & Omit<SVGProps<SVGSVGElement>, "name">) {
  const common = {
    width: size,
    height: size,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.8,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    "aria-hidden": true,
    ...props,
  };

  const paths: Record<IconName, React.ReactNode> = {
    visitor: <><circle cx="9" cy="7" r="3" /><path d="M3.5 20v-2.2A5.5 5.5 0 0 1 9 12.3a5.5 5.5 0 0 1 5.5 5.5V20" /><path d="M15 9h5l-1 5h-4z" /></>,
    seller: <><path d="M4 10v10h16V10" /><path d="M3 10 5 4h14l2 6" /><path d="M3 10a3 3 0 0 0 6 0 3 3 0 0 0 6 0 3 3 0 0 0 6 0" /><path d="M9 20v-6h6v6" /></>,
    shop: <><path d="M4 21V9h16v12M2 9l2-5h16l2 5" /><path d="M2 9a3 3 0 0 0 6 0 3 3 0 0 0 6 0 3 3 0 0 0 6 0M9 21v-7h6v7" /></>,
    map: <><path d="m3 6 5-2 8 3 5-2v13l-5 2-8-3-5 2z" /><path d="M8 4v13M16 7v13" /></>,
    search: <><circle cx="10.5" cy="10.5" r="6.5" /><path d="m16 16 5 5" /></>,
    live: <><circle cx="12" cy="12" r="3" fill="currentColor" stroke="none" /><path d="M7.8 7.8a6 6 0 0 0 0 8.4M16.2 7.8a6 6 0 0 1 0 8.4M4.6 4.6a10.5 10.5 0 0 0 0 14.8M19.4 4.6a10.5 10.5 0 0 1 0 14.8" /></>,
    arrow: <><path d="M5 12h14M13 6l6 6-6 6" /></>,
    package: <><path d="m4 7 8-4 8 4v10l-8 4-8-4z" /><path d="m4 7 8 4 8-4M12 11v10M8 5l8 4" /></>,
    service: <><path d="M14.7 6.3a4 4 0 0 0-5-5L12 3.6 9.6 6 7.3 3.7a4 4 0 0 0 5 5L4 17a2.1 2.1 0 0 0 3 3l8.3-8.3a4 4 0 0 0 5-5L18 9l-2.4-2.4L18 4.3a4 4 0 0 0-3.3 2Z" /></>,
    close: <><path d="m6 6 12 12M18 6 6 18" /></>,
    upload: <><path d="M12 16V3m0 0L7 8m5-5 5 5" /><path d="M4 14v6h16v-6" /></>,
    navigation: <><path d="m21 3-8.5 18-2.3-7.2L3 11.5z" /><path d="m10.2 13.8 4-4" /></>,
    users: <><circle cx="9" cy="8" r="3" /><path d="M3 20v-2a6 6 0 0 1 12 0v2M16 5.5a3 3 0 0 1 0 5.8M17 14a5 5 0 0 1 4 4.9V20" /></>,
    spark: <><path d="m12 2 1.8 6.2L20 10l-6.2 1.8L12 18l-1.8-6.2L4 10l6.2-1.8z" /><path d="m19 16 .8 2.2L22 19l-2.2.8L19 22l-.8-2.2L16 19l2.2-.8z" /></>,
    chevron: <><path d="m9 5 7 7-7 7" /></>,
    image: <><rect x="3" y="3" width="18" height="18" rx="3" /><circle cx="8.5" cy="8.5" r="1.5" /><path d="m21 15-5-5L5 21" /></>,
    trash: <><path d="M4 7h16M9 3h6l1 4H8zM6 7l1 14h10l1-14M10 11v6M14 11v6" /></>,
    star: <><path d="m12 3 2.8 5.7 6.2.9-4.5 4.4 1.1 6.2-5.6-3-5.6 3 1.1-6.2L3 9.6l6.2-.9z" /></>,
    check: <><path d="m4 12 5 5L20 6" /></>,
    grid: <><rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" /><rect x="3" y="14" width="7" height="7" rx="1" /><rect x="14" y="14" width="7" height="7" rx="1" /></>,
    compass: <><circle cx="12" cy="12" r="9" /><path d="m16 8-2.5 5.5L8 16l2.5-5.5z" /></>,
    clock: <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>,
    tag: <><path d="M20 13 13 20a2 2 0 0 1-3 0l-7-7V4h9l8 7a2 2 0 0 1 0 2Z" /><circle cx="8" cy="8" r="1" /></>,
    plus: <><path d="M12 5v14M5 12h14" /></>,
    refresh: <><path d="M20 7v5h-5M4 17v-5h5" /><path d="M6.1 8a7 7 0 0 1 11.8-1L20 12M4 12l2.1 5a7 7 0 0 0 11.8-1" /></>,
    walk: <><circle cx="13" cy="4" r="2" /><path d="m10 21 2-7-3-3 2-4 4 3 3 1M12 14l4 3 1 4M9 11l-4 3" /></>,
    sound: <><path d="M5 9v6h4l5 4V5L9 9zM17 9a4 4 0 0 1 0 6M19 6a8 8 0 0 1 0 12" /></>,
    offers: <><path d="M4 5h16v14H4zM4 9h16M8 5v14" /><path d="m12 13 1 2 2 .3-1.5 1.5.4 2.2-1.9-1-1.9 1 .4-2.2L9 15.3l2-.3z" /></>,
    phone: <><path d="M7 3H4a1 1 0 0 0-1 1c0 9.4 7.6 17 17 17a1 1 0 0 0 1-1v-3l-5-2-2 2c-3.5-1.5-6.5-4.5-8-8l2-2z" /></>,
    male: <><circle cx="12" cy="7" r="3.6" /><path d="M5 21v-2.5A6.5 6.5 0 0 1 11.500 12h1A6.5 6.5 0 0 1 19 18.500V21" /></>,
    female: <><path d="M12 2.500c-3.600 0-5.800 2.600-5.800 6 0 1.800.5 3.200 1.400 4.200C4.800 13.800 3 15.800 3 18.500v3h18v-3c0-2.700-1.800-4.700-4.600-5.800.9-1 1.400-2.400 1.400-4.200 0-3.400-2.200-6-5.800-6z" /><ellipse cx="12" cy="9.500" rx="3" ry="3.600" /></>,
    chat: <><path d="M4 5h16v11H9l-5 4z" /><path d="M8 9h8M8 12h5" /></>,
    whatsapp: <><path d="M3 21l1.600-4.800A8.500 8.500 0 1 1 8 19.500z" /><path d="M9 8.500c0 3.500 3 6.500 6.500 6.500l1-1.500-2-1-1 .8c-1-.4-1.800-1.200-2.200-2.200l.8-1-1-2z" /></>,
    send: <><path d="m3 11 18-8-8 18-2-7z" /></>,
    back: <><path d="M19 12H5M11 6l-6 6 6 6" /></>,
    eye: <><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z" /><circle cx="12" cy="12" r="3" /></>,
  };

  return <svg {...common}>{paths[name]}</svg>;
}

export function FarshaMark({ size = 42, className = "" }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" fill="none" className={className} aria-hidden>
      <defs>
        <linearGradient id="farsha-gold" x1="8" y1="5" x2="39" y2="43" gradientUnits="userSpaceOnUse">
          <stop stopColor="#FDE68A" />
          <stop offset=".48" stopColor="#F59E0B" />
          <stop offset="1" stopColor="#F97316" />
        </linearGradient>
      </defs>
      <path d="M6 18 10 7h28l4 11" stroke="url(#farsha-gold)" strokeWidth="3" strokeLinejoin="round" />
      <path d="M6 18a6 6 0 0 0 12 0 6 6 0 0 0 12 0 6 6 0 0 0 12 0" stroke="url(#farsha-gold)" strokeWidth="3" />
      <path d="M10 24v17h28V24M19 41V29a5 5 0 0 1 10 0v12" stroke="currentColor" strokeWidth="2.5" strokeLinejoin="round" />
      <path d="M34 29h4M14 29h2" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
    </svg>
  );
}
