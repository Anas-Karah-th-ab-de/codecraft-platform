// Leiterplatte als Erkennungszeichen: der KM-Chip, vier Leiterbahnen zu den Geschäftsbereichen.
// Die Bahnen zeichnen sich beim Laden einmal; beim Überfahren eines Bereichs leuchtet seine Bahn.
import { useState } from "react";
import { Link } from "react-router-dom";

export type BoardItem = { t: string; d: string; to: string };

// Kontaktpunkte (SVG-Koordinaten, viewBox 600×480): symmetrischer Fan-out vom Chip in die vier Ecken.
// Die Bahn läuft senkrecht in den Kontakt, die Beschriftung steht waagerecht daneben → keine Überschneidung.
const PADS = [
  { x: 60, y: 70, path: "M225 200 H120 L60 140 V82", lx: 13.3, ly: 10, end: false },
  { x: 540, y: 70, path: "M375 200 H480 L540 140 V82", lx: 86.7, ly: 10, end: true },
  { x: 540, y: 410, path: "M375 280 H480 L540 340 V398", lx: 86.7, ly: 80.6, end: true },
  { x: 60, y: 410, path: "M225 280 H120 L60 340 V398", lx: 13.3, ly: 80.6, end: false },
];
// Zusätzliche Bahnen und Durchkontaktierungen: nur Kulisse
const FAINT = ["M277 165 V125 L297 105 V58", "M337 165 V122 H372", "M297 315 V352 L317 372 V396", "M257 315 V346", "M357 315 V340 L377 360 H410", "M225 240 H170", "M375 240 H430"];
const VIAS = [[297, 58], [372, 122], [317, 396], [257, 346], [410, 360], [170, 240], [430, 240]];
const pins = (n: number, from: number) => Array.from({ length: n }, (_, i) => from + i * 20);

export function Board({ items, label }: { items: BoardItem[]; label: string }) {
  const [lit, setLit] = useState(-1);
  return (
    <div className="board draw">
      <svg viewBox="0 0 600 480" role="img" aria-label={label}>
        <defs>
          <pattern id="dots" width="16" height="16" patternUnits="userSpaceOnUse"><circle cx="2" cy="2" r="1.1" className="b-dots" /></pattern>
        </defs>
        <rect x="8" y="8" width="584" height="464" rx="20" className="b-edge" />
        <rect x="8" y="8" width="584" height="464" rx="20" fill="url(#dots)" />
        {[[34, 34], [566, 34], [34, 446], [566, 446]].map(([x, y]) => <circle key={`${x}${y}`} cx={x} cy={y} r="9" className="b-hole" />)}
        {pins(6, 245).map((x) => <rect key={x} x={x} y="448" width="10" height="24" rx="2" className="b-finger" />)}
        {FAINT.map((d) => <path key={d} d={d} className="b-faint" />)}
        {VIAS.map(([x, y]) => <circle key={`${x}-${y}`} cx={x} cy={y} r="5" className="b-via" />)}

        {/* Chip mit Anschlüssen */}
        {pins(7, 237).map((x) => <rect key={`t${x}`} x={x} y="152" width="6" height="13" rx="1" className="b-pin" />)}
        {pins(7, 237).map((x) => <rect key={`b${x}`} x={x} y="315" width="6" height="13" rx="1" className="b-pin" />)}
        {pins(7, 177).map((y) => <rect key={`l${y}`} x="212" y={y} width="13" height="6" rx="1" className="b-pin" />)}
        {pins(7, 177).map((y) => <rect key={`r${y}`} x="375" y={y} width="13" height="6" rx="1" className="b-pin" />)}
        <rect x="225" y="165" width="150" height="150" rx="12" className="b-chip" />
        <circle cx="243" cy="183" r="4" className="b-pin1" />
        <text x="300" y="252" textAnchor="middle" className="b-km">KM</text>
        <text x="300" y="282" textAnchor="middle" className="b-sub">CODE CRAFT</text>

        {/* Leiterbahnen zu den Bereichen */}
        {PADS.map((p, i) => (
          <g key={i} style={{ ["--d" as string]: `${0.15 + i * 0.18}s`, ["--len" as string]: 1 }}>
            <path d={p.path} pathLength={1} className={`b-trace ${lit === i ? "lit" : ""}`} />
            <circle cx={p.x} cy={p.y} r="12" className={`b-pad ${lit === i ? "lit" : ""}`} />
            <circle cx={p.x} cy={p.y} r="4" className="b-pad-core" />
          </g>
        ))}
      </svg>
      {items.map((it, i) => {
        const p = PADS[i];
        return (
          <Link key={it.t} to={it.to} className={`b-label ${p.end ? "end" : ""} ${lit === i ? "lit" : ""}`}
            style={{ left: `${p.lx}%`, top: `${p.ly}%`, ["--d" as string]: `${0.15 + i * 0.18}s` }}
            onMouseEnter={() => setLit(i)} onMouseLeave={() => setLit(-1)} onFocus={() => setLit(i)} onBlur={() => setLit(-1)}>
            <b>{it.t}</b><span>{it.d}</span>
          </Link>
        );
      })}
      <ul className="board-list">
        {items.map((it) => <li key={it.t}><Link to={it.to}><b>{it.t}</b><span>{it.d}</span></Link></li>)}
      </ul>
    </div>
  );
}

/** 404: unterbrochene Leiterbahn */
export function BrokenTrace() {
  return (
    <svg viewBox="0 0 360 120" aria-hidden="true">
      <path d="M20 60 H120 L140 40 H160" className="nf-trace" />
      <circle cx="20" cy="60" r="9" className="nf-pad" />
      <path d="M200 40 H220 L240 60 H340" className="nf-trace" />
      <circle cx="340" cy="60" r="9" className="nf-pad" />
      <path d="M172 32 L188 48 M188 32 L172 48" className="nf-cut" />
    </svg>
  );
}
