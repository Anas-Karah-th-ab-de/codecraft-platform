// Einheitliche Linien-Symbole (24er Raster, 1.75 Strich) – ersetzen Emojis in Portal und Mail.
import type { CSSProperties } from "react";

const P: Record<string, string> = {
  home: "M3 10.5 12 3l9 7.5M5 9v11h5v-6h4v6h5V9",
  chat: "M4 5h16v11H9l-5 4V5Z",
  mail: "M3 6h18v12H3zM3 7l9 6 9-6",
  "mail-open": "M3 10 12 4l9 6v10H3V10Zm0 0 9 6 9-6",
  inbox: "M3 13h5l1.5 3h5L16 13h5M5 5h14l2 8v6H3v-6l2-8Z",
  send: "M21 3 10 14M21 3l-7 18-4-7-7-4 18-7Z",
  draft: "M14 3H6v18h12V7l-4-4Zm0 0v4h4M9 13h6M9 17h4",
  trash: "M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3",
  spam: "M12 3 3 7v5c0 5 4 8 9 9 5-1 9-4 9-9V7l-9-4Zm0 6v4m0 3v.01",
  archive: "M3 4h18v4H3zM5 8v12h14V8M10 12h4",
  star: "m12 3 2.8 5.7 6.2.9-4.5 4.4 1 6.2L12 17.3 6.5 20.2l1-6.2L3 9.6l6.2-.9L12 3Z",
  reply: "M10 8 4 13l6 5M4 13h11a5 5 0 0 1 5 5v1",
  "reply-all": "M11 8l-6 5 6 5M7 8l-6 5 6 5M5 13h10a5 5 0 0 1 5 5v1",
  forward: "m14 8 6 5-6 5M20 13H9a5 5 0 0 0-5 5v1",
  clip: "m20 11-8.5 8.5a5 5 0 0 1-7-7L13 4a3.5 3.5 0 0 1 5 5l-8.5 8.5a2 2 0 0 1-3-3L14 7",
  search: "M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14Zm9 16-4-4",
  check: "m5 12 5 5 9-10",
  x: "M6 6l12 12M18 6 6 18",
  refresh: "M20 11a8 8 0 1 0-2.3 5.7M20 4v7h-7",
  bell: "M6 16V11a6 6 0 1 1 12 0v5l2 2H4l2-2Zm4 4a2 2 0 0 0 4 0",
  "bell-off": "M6 16v-5a6 6 0 0 1 9.5-4.9M18 11v5l2 2H8M10 20a2 2 0 0 0 4 0M3 3l18 18",
  megaphone: "M4 10v4h3l8 4V6L7 10H4Zm15-1a4 4 0 0 1 0 6M7 14l1 5h3l-1-4",
  phone: "M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2Z",
  "phone-off": "M10.7 13.3a11 11 0 0 1-2.2-2.8L11 9 9 4H5a2 2 0 0 0-2 2c0 3 1 5.8 2.6 8.2M8.5 17.7A16 16 0 0 0 18 21a2 2 0 0 0 2-2v-4l-5-2-1.5 2.5M3 3l18 18",
  video: "M3 7h12v10H3zM15 10l6-3v10l-6-3",
  menu: "M4 6h16M4 12h16M4 18h16",
  "panel-left": "M3 4h18v16H3zM9 4v16",
  plus: "M12 5v14M5 12h14",
  more: "M5 12h.01M12 12h.01M19 12h.01",
  dot: "M12 10a2 2 0 1 0 0 4 2 2 0 0 0 0-4Z",
  download: "M12 4v11m-5-5 5 5 5-5M5 20h14",
  eye: "M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12Zm10-3a3 3 0 1 0 0 6 3 3 0 0 0 0-6Z",
  lock: "M6 11h12v10H6zM8 11V7a4 4 0 0 1 8 0v4",
  unlock: "M6 11h12v10H6zM8 11V7a4 4 0 0 1 7.5-2",
  "user-x": "M10 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm-7 9a7 7 0 0 1 12-5M17 15l4 4m0-4-4 4",
  user: "M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm-8 9a8 8 0 0 1 16 0",
  users: "M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm-7 10a7 7 0 0 1 14 0M16 4a4 4 0 0 1 0 7m6 10a7 7 0 0 0-4-6.3",
  support: "M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18Zm0 5a4 4 0 1 0 0 8 4 4 0 0 0 0-8ZM5.6 5.6l3.6 3.6m5.6 5.6 3.6 3.6m0-12.8-3.6 3.6m-5.6 5.6-3.6 3.6",
  code: "m8 7-5 5 5 5m8-10 5 5-5 5M14 4l-4 16",
  folder: "M3 6h6l2 2h10v11H3V6Z",
  cart: "M3 4h2l2.5 11h11L21 7H7M9 20h.01M18 20h.01",
  building: "M4 21V5l8-2v18M12 8h8v13M8 8h.01M8 12h.01M8 16h.01M16 12h.01M16 16h.01M2 21h20",
  box: "m12 3 9 4.5v9L12 21l-9-4.5v-9L12 3Zm0 9 9-4.5M12 12 3 7.5M12 12v9",
  cpu: "M7 7h10v10H7zM10 10h4v4h-4zM10 3v4M14 3v4M10 17v4M14 17v4M3 10h4M3 14h4M17 10h4M17 14h4",
  key: "M15 3a6 6 0 0 0-5.7 7.9L3 17v4h4v-2h2v-2h2l1.1-1.1A6 6 0 1 0 15 3Zm1.5 4.5h.01",
  quote: "M6 3h9l5 5v13H6zM15 3v5h5M9 13h8M9 17h5",
  receipt: "M5 3h14v18l-3-2-2 2-2-2-2 2-2-2-3 2V3Zm4 5h6M9 12h6M9 16h3",
  clock: "M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18Zm0 4v5l3 2",
  briefcase: "M3 8h18v12H3zM9 8V5h6v3M3 13h18",
  inbox2: "M4 4h16v16H4zM4 14h4l2 3h4l2-3h4",
  account: "M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18Zm0 4a3 3 0 1 0 0 6 3 3 0 0 0 0-6Zm-5.3 11a7 7 0 0 1 10.6 0",
  help: "M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18Zm-2.5 6.5a2.5 2.5 0 1 1 3.5 2.3c-.6.3-1 .9-1 1.6V14m0 3v.01",
  settings: "M12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6Zm7.4 3a7.5 7.5 0 0 0-.1-1.2l2-1.6-2-3.4-2.4 1a7.6 7.6 0 0 0-2-1.2L14.5 3h-5l-.4 2.6a7.6 7.6 0 0 0-2 1.2l-2.4-1-2 3.4 2 1.6a7.5 7.5 0 0 0 0 2.4l-2 1.6 2 3.4 2.4-1a7.6 7.6 0 0 0 2 1.2l.4 2.6h5l.4-2.6a7.6 7.6 0 0 0 2-1.2l2.4 1 2-3.4-2-1.6c.1-.4.1-.8.1-1.2Z",
  edit: "M4 20h4L19 9l-4-4L4 16v4ZM14 6l4 4",
  external: "M14 4h6v6M20 4l-9 9M18 14v6H4V6h6",
  chevron: "m9 6 6 6-6 6",
  "chevron-left": "m15 6-6 6 6 6",
  "chevron-down": "m6 9 6 6 6-6",
  "arrow-left": "M20 12H4m6-6-6 6 6 6",
  pin: "M9 4h6l-1 5 4 3v2H6v-2l4-3-1-5Zm3 10v6",
  info: "M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18Zm0 8v5m0-8v.01",
  alert: "M12 4 2 20h20L12 4Zm0 6v4m0 3v.01",
  calendar: "M4 5h16v15H4zM4 10h16M9 3v4M15 3v4",
  vscode: "M17 3 7 12l10 9 4-2V5l-4-2ZM17 3v18M7 12 3 9v6l4-3",
  device: "M7 3h10v18H7zM11 18h2",
  monitor: "M3 4h18v12H3zM8 20h8M12 16v4",
  shield: "M12 3 4 6v6c0 5 3.5 8 8 9 4.5-1 8-4 8-9V6l-8-3Z",
  logout: "M15 4h4v16h-4M10 8l-4 4 4 4M6 12h11",
  volume: "M4 9h4l5-4v14l-5-4H4V9Zm13-1a5 5 0 0 1 0 8",
  mute: "M4 9h4l5-4v14l-5-4H4V9Zm13 0 4 6m0-6-4 6",
  select: "M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM14 14h6v6h-6z",
};

export type IconName = keyof typeof P;

export function Icon({ name, size = 18, className, style, fill, title }: {
  name: IconName | string; size?: number; className?: string; style?: CSSProperties; fill?: boolean; title?: string;
}) {
  const d = P[name] ?? P.dot;
  return (
    <svg className={`ic ${className ?? ""}`} width={size} height={size} viewBox="0 0 24 24" style={style}
      fill={fill ? "currentColor" : "none"} stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round"
      aria-hidden={title ? undefined : true} role={title ? "img" : undefined}>
      {title && <title>{title}</title>}
      <path d={d} />
    </svg>
  );
}
