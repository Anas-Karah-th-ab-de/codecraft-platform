// Liniensymbole (24er Raster, Strich)
const I = {
  back:'M15 5l-7 7 7 7', fwd:'M9 5l7 7-7 7', home:'M12 4a8 8 0 1 0 0 16 8 8 0 0 0 0-16z', rec:'M6 6h12v12H6z', close:'M6 6l12 12M18 6 6 18', plus:'M12 5v14M5 12h14', minus:'M5 12h14', check:'M5 12l4.5 4.5L19 7',
  chev:'M9 6l6 6-6 6', down:'M6 9l6 6 6-6', up:'M6 15l6-6 6 6', more:'M12 6h.01M12 12h.01M12 18h.01', search:'M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14zM20 20l-3.5-3.5',
  gear:'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM19.4 15a1.6 1.6 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.6 1.6 0 0 0-2.7 1.1V21a2 2 0 0 1-4 0v-.1a1.6 1.6 0 0 0-2.7-1.1l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1A1.6 1.6 0 0 0 3 14.3a2 2 0 0 1 0-4h.1a1.6 1.6 0 0 0 1.1-2.7l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1A1.6 1.6 0 0 0 9.7 3.6V3a2 2 0 0 1 4 0v.1a1.6 1.6 0 0 0 2.7 1.1l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.6 1.6 0 0 0 1.1 2.7H21a2 2 0 0 1 0 4h-.1a1.6 1.6 0 0 0-1.5 1.3z',
  phone:'M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2', phoneOff:'M3 3l18 18M10.7 13.3a11 11 0 0 0 2.8 2.2L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 5.3 12.5M7 9.5 8.5 8.5 7 4H5a2 2 0 0 0-2 2c0 1 .1 2 .3 3',
  msg:'M4 5h16v11H8l-4 4z', cam:'M4 8h3l2-3h6l2 3h3v11H4zM12 16.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7z', img:'M4 5h16v14H4zM4 15l5-5 4 4 3-3 4 4M15.5 8.5h.01',
  folder:'M3 6h6l2 2h10v11H3z', file:'M6 3h8l4 4v14H6zM14 3v4h4', pdf:'M6 3h8l4 4v14H6zM9 13h6M9 17h4', clock:'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 7v5l3 2',
  alarm:'M12 21a8 8 0 1 0 0-16 8 8 0 0 0 0 16zM12 9v4l2 2M5 3 2 6M19 3l3 3', timer:'M12 21a8 8 0 1 0 0-16 8 8 0 0 0 0 16zM12 9v4M9 2h6', stop:'M12 21a8 8 0 1 0 0-16 8 8 0 0 0 0 16zM12 13l3-3M10 2h4M19 5l1.5-1.5', globe:'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18',
  cal:'M4 6h16v15H4zM4 10h16M9 3v4M15 3v4', calc:'M5 3h14v18H5zM8 7h8M8 12h2M14 12h2M8 16h2M14 16h2', note:'M5 3h10l4 4v14H5zM9 11h6M9 15h6', user:'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM4 21a8 8 0 0 1 16 0', users:'M9 11a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7zM2 20a7 7 0 0 1 14 0M16 4a3.5 3.5 0 0 1 0 7M18 14a6 6 0 0 1 4 6',
  tools:'M14 6a4 4 0 0 0 5 5l-9 9a2 2 0 0 1-3-3l9-9a4 4 0 0 0-2-2zM5 5l3 3', send:'M21 3 3 10l7 3 3 7z', tg:'M21 4 3 11l6 2 2 6 3-4 5 4z', store:'M5 8h14l-1 13H6zM9 8V6a3 3 0 0 1 6 0v2', pulse:'M3 12h4l3-7 4 14 3-7h4',
  term:'M4 5h16v14H4zM7 10l3 2-3 2M12 15h5', shield:'M12 3 4 6v6c0 5 3.5 8 8 9 4.5-1 8-4 8-9V6z', shieldOk:'M12 3 4 6v6c0 5 3.5 8 8 9 4.5-1 8-4 8-9V6zM9 12l2 2 4-4', lock:'M5 11h14v10H5zM8 11V8a4 4 0 0 1 8 0v3', unlock:'M5 11h14v10H5zM8 11V8a4 4 0 0 1 7.5-2',
  wifi:'M2 8.5a15 15 0 0 1 20 0M5.5 12.3a10 10 0 0 1 13 0M9 16a5 5 0 0 1 6 0M12 19.5h.01', wifiOff:'M3 3l18 18M2 8.5a15 15 0 0 1 4.5-3M10.5 5.1A15 15 0 0 1 22 8.5M5.5 12.3a10 10 0 0 1 4-2.2M9 16a5 5 0 0 1 6 0M12 19.5h.01',
  bt:'M7 7l10 10-5 4V3l5 4L7 17', plane:'M10 3v6L3 13v2l7-2v5l-2 2v1l4-1 4 1v-1l-2-2v-5l7 2v-2l-7-4V3a2 2 0 0 0-4 0', torch:'M8 2h8l-1 6H9zM9 8h6v13H9zM12 12v3', key:'M14 10a4 4 0 1 0-3 3.9V16h2v2h2v2h3v-3l-4.1-4.1A4 4 0 0 0 14 10zM10 10h.01',
  vol:'M4 9h4l5-4v14l-5-4H4zM17 9a4 4 0 0 1 0 6M19.5 6.5a8 8 0 0 1 0 11', mute:'M4 9h4l5-4v14l-5-4H4zM17 9l5 5M22 9l-5 5', moon:'M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z', sun:'M12 16a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM12 2v2M12 20v2M2 12h2M20 12h2M5 5l1.5 1.5M17.5 17.5 19 19M5 19l1.5-1.5M17.5 6.5 19 5',
  leaf:'M5 19C5 10 10 5 20 4c0 10-5 15-14 15M5 19l7-7', rotate:'M4 12a8 8 0 0 1 14-5.3M20 12a8 8 0 0 1-14 5.3M18 3v4h-4M6 21v-4h4', desk:'M3 4h18v12H3zM8 20h8M12 16v4', bell:'M6 16V11a6 6 0 0 1 12 0v5l2 2H4zM10 21h4', bellOff:'M3 3l18 18M8.5 5.5A6 6 0 0 1 18 11v3M6 11v5l-2 2h14M10 21h4',
  bat:'M3 8h16v8H3zM21 11v2', bolt:'M13 2 4 14h7l-1 8 9-12h-7z', chip:'M7 7h10v10H7zM10 2v3M14 2v3M10 19v3M14 19v3M2 10h3M2 14h3M19 10h3M19 14h3', drive:'M3 6h18v12H3zM7 14h.01M11 14h6', heart:'M12 20s-8-5-8-11a4.5 4.5 0 0 1 8-2.8A4.5 4.5 0 0 1 20 9c0 6-8 11-8 11z', star:'M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1L3.2 9.5l6.1-.9z',
  trash:'M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3', edit:'M4 20h4L19 9l-4-4L4 16zM14 6l4 4', copy:'M9 9h11v11H9zM5 15H4V4h11v1', paste:'M9 4h6v3H9zM7 5H5v16h14V5h-2', cut:'M6 7a2.5 2.5 0 1 0 0-.01M6 17a2.5 2.5 0 1 0 0 .01M8 8l12 10M8 16 20 6', share:'M12 3v12M7 8l5-5 5 5M5 14v6h14v-6',
  dl:'M12 3v12M7 10l5 5 5-5M5 21h14', upd:'M4 12a8 8 0 0 1 14-5.3L20 9M20 4v5h-5M20 12a8 8 0 0 1-14 5.3L4 15M4 20v-5h5', lang:'M4 5h9M8 3v2M6 5c0 5 3 8 7 9M12 5c-1 4-4 7-8 9M14 21l4-10 4 10M15.5 18h5', info:'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 11v6M12 7.5h.01', warn:'M12 3 2 20h20zM12 10v4M12 17h.01',
  layers:'M12 3 2 8l10 5 10-5zM2 13l10 5 10-5', apps:'M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM14 14h6v6h-6z', mic:'M9 3h6v11H9zM5 11a7 7 0 0 0 14 0M12 18v3', kbd:'M3 6h18v12H3zM7 10h.01M11 10h.01M15 10h.01M7 14h10', eye:'M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12zM12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z', eyeOff:'M3 3l18 18M10.6 5.1A10 10 0 0 1 22 12s-1.3 2.3-3.6 4.2M6.6 6.6C3.7 8.5 2 12 2 12s4 7 10 7c1.7 0 3.2-.5 4.5-1.2',
  sim:'M7 3h7l4 4v14H7zM10 12h4v5h-4z', cell:'M7 20V10M12 20V6M17 20V14M3 20h18', signal:'M5 18h.01M9 18v-3M13 18v-6M17 18V9M21 18V6', loc:'M12 21s-7-6-7-11a7 7 0 0 1 14 0c0 5-7 11-7 11zM12 12a2 2 0 1 0 0-4 2 2 0 0 0 0 4z', compass:'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM15.5 8.5l-2 5-5 2 2-5z',
  level:'M3 12h18M7 8v8M17 8v8M12 10a2 2 0 1 0 0 4', kaaba:'M5 8l7-4 7 4v11H5zM5 11h14M10 19v-4h4v4', mosque:'M4 21V11a8 6 0 0 1 16 0v10zM12 3v2M9 21v-4a3 3 0 0 1 6 0v4', sos:'M12 3a5 5 0 0 0-5 5c0 4 5 9 5 9s5-5 5-9a5 5 0 0 0-5-5zM3 21h18', focus:'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 16a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM12 12h.01', list:'M9 6h11M9 12h11M9 18h11M5 6h.01M5 12h.01M5 18h.01', sos2:'M12 3 2 20h20zM12 9v5M12 17h.01',
  play:'M7 4l13 8-13 8z', pause:'M7 4h4v16H7zM13 4h4v16h-4z', flag:'M5 21V4h11l-2 4 2 4H5', reset:'M4 12a8 8 0 1 0 2.5-5.8L4 8.5M4 4v4.5h4.5', scan:'M4 8V4h4M16 4h4v4M20 16v4h-4M8 20H4v-4M7 12h10', grid:'M4 4h16v16H4zM9.3 4v16M14.7 4v16M4 9.3h16M4 14.7h16', flip:'M7 4 3 8l4 4M3 8h12a5 5 0 0 1 0 10H9M17 20l4-4-4-4',
  power:'M12 3v8M6.3 7a8 8 0 1 0 11.4 0', yt:'M3 7a3 3 0 0 1 3-3h12a3 3 0 0 1 3 3v10a3 3 0 0 1-3 3H6a3 3 0 0 1-3-3zM10 9v6l5-3z', wa:'M12 21a9 9 0 1 0-8-4.8L3 21l4.9-1.2A9 9 0 0 0 12 21zM8.5 9c0 3.5 3 6.5 6.5 6.5l1-2-2.3-1-1 1a5 5 0 0 1-2.2-2.2l1-1-1-2.3z', spot:'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM7 9.5c3.5-1 7-.6 10 1M7.5 13c2.8-.7 5.6-.4 8 .9M8 16c2.2-.5 4.2-.3 6 .6',
  box:'M3 7l9-4 9 4v10l-9 4-9-4zM3 7l9 4 9-4M12 11v10', server:'M4 4h16v6H4zM4 14h16v6H4zM8 7h.01M8 17h.01', link:'M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1', tab:'M4 6h16v13H4zM4 10h16M8 6v4', ref:'M20 11a8 8 0 1 0-2.3 5.7M20 4v7h-7',
  face:'M8 4H5a1 1 0 0 0-1 1v3M16 4h3a1 1 0 0 1 1 1v3M8 20H5a1 1 0 0 1-1-1v-3M16 20h3a1 1 0 0 0 1-1v-3M9 10h.01M15 10h.01M9.5 15a3.5 3.5 0 0 0 5 0', fp:'M6.5 8.5a6 6 0 0 1 11 3.3v1.7M12 11.5v3.5a6 6 0 0 0 1.4 3.8M9 12a3 3 0 0 1 6 0v2a9 9 0 0 0 1 4M6 13v1a9 9 0 0 0 1.6 5', sliders:'M4 7h10M18 7h2M4 17h4M12 17h8M16 5v4M10 15v4', sparkle:'M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8zM19 16l.8 2.2L22 19l-2.2.8L19 22l-.8-2.2L16 19l2.2-.8z',
  backup:'M7 18a5 5 0 0 1-.6-10A7 7 0 0 1 20 9.5a4.5 4.5 0 0 1-1.5 8.5M12 12v9M9 15l3-3 3 3', hand:'M8 13V5a1.5 1.5 0 0 1 3 0v6M11 10V3.5a1.5 1.5 0 0 1 3 0V10M14 10V5a1.5 1.5 0 0 1 3 0v8a7 7 0 0 1-7 7 6 6 0 0 1-5-3l-2.5-4.5a1.5 1.5 0 0 1 2.5-1.5L8 13', data:'M7 4v16M3 8l4-4 4 4M17 20V4M13 16l4 4 4-4', palette:'M12 21a9 9 0 1 1 9-9c0 2-1.5 3-3.5 3H16a2 2 0 0 0-1.5 3.3A2 2 0 0 1 12 21zM7.5 11h.01M10 7h.01M15 7h.01',
  type:'M4 7V5h16v2M12 5v14M9 19h6', night:'M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5zM17 3v3M15.5 4.5h3', care:'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM8 12l3 3 5-6', svc:'M4 5h16v4H4zM4 11h16v4H4zM4 17h16v2H4z', ubuntu:'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6zM12 3v6M4.2 16.5l5.2-3M19.8 16.5l-5.2-3', sortaz:'M4 6h7M4 12h5M4 18h3M17 4v16M13 16l4 4 4-4'
};
function ic(n, s = 22, w = 1.8, extra = '') {
  return `<svg width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" ${extra}><path d="${I[n] || I.info}"/></svg>`;
}

'use strict';
// ===== Ultar OS – interaktive Demo · KM Code Craft =====
const QS = new URLSearchParams(location.search);
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const pad2 = (n) => String(n).padStart(2, '0');
const uid = () => Math.random().toString(36).slice(2, 9);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ---------- Zustand ----------
const START_LANG = ['de', 'en', 'ar'].includes(QS.get('lang')) ? QS.get('lang') : ((navigator.language || 'de').startsWith('ar') ? 'ar' : (navigator.language || '').startsWith('en') ? 'en' : 'de');
function freshState() {
  const now = Date.now();
  return {
    lang: START_LANG, theme: 'dark', accent: '#D8C870', big: false, night: false, autoBright: true, bright: 85, contrast: false,
    wifi: true, wifiNet: 'KM-Office', bt: false, btOn: [], data: true, flight: false, torch: false, vpn: true, ks: true, dns: 'ultraos.code-craft.tech',
    sound: true, profile: 'normal', vol: { media: 60, ring: 70, alarm: 80 }, dnd: false, chime: false,
    privacy: { all: true, net: true, cam: true, mic: true, loc: true, sens: true, bt: true }, trackers: 1284, linkcheck: true, adblock: true,
    rotate: false, helper: true, wake: true, voice: false, secret: '', model: 'local', hlpIntro: false,
    saver: false, saverAt: 20, perf: 'balanced', battery: 87, charging: false, care80: true,
    locked: true, pin: '1234', fp: true, face: false, enc: true, pinFails: 0,
    sim: [{ n: 'Syriatel', on: true, num: '+963 9xx xxx 101' }, { n: 'MTN', on: true, num: '+963 9xx xxx 202' }], simData: 0, simCall: 0, net: 'auto', cell: 'C2', roaming: false, rat: '5G',
    notifs: [
      { id: uid(), app: 'telegram', title: 'Ahmad', body: { de: 'Schick mir bitte die Datei von heute', en: 'Please send me today\'s file', ar: 'أرسل لي ملف اليوم من فضلك' }, t: now - 16 * 60e3 },
      { id: uid(), app: 'store', title: { de: 'KM POS Server aktualisiert', en: 'KM POS Server updated', ar: 'تم تحديث KM POS Server' }, body: { de: 'Signatur geprüft · Version 2.4', en: 'Signature verified · version 2.4', ar: 'تم التحقق من التوقيع · الإصدار 2.4' }, t: now - 58 * 60e3 },
    ],
    installed: ['kmpos'], uos: 'UOS-4821-7730', update: { ch: 'stable', st: 'idle', p: 0 }, backup: { last: now - 26 * 3600e3, st: 'idle', p: 0 },
    services: [['ultar-init', 1], ['ultar-shell', 1], ['ultar-net', 1], ['ultar-audio', 1], ['ultar-ril', 1], ['ultar-vpn', 1], ['ultar-notify', 1], ['llm (Qwen3 1.7B)', 1], ['ultar-compat (Ubuntu 24.04)', 1], ['kmpos-server', 0], ['sshd', 0]],
    gallery: [
      { id: 'g1', g: 'linear-gradient(180deg,#F6B26B,#E58E5A 35%,#7B4A6E 60%,#283049)', d: 0, fav: true },
      { id: 'g2', g: 'linear-gradient(160deg,#0F4C5C,#2A9D8F 50%,#E9C46A)', d: 0 },
      { id: 'g3', g: 'radial-gradient(circle at 30% 30%,#FFE8A3,#E07A5F 45%,#3D405B)', d: 1 },
      { id: 'g4', g: 'linear-gradient(200deg,#264653,#2A9D8F 40%,#8AB17D 70%,#E9C46A)', d: 1, fav: true },
      { id: 'g5', g: 'linear-gradient(180deg,#8EC5FC,#E0C3FC)', d: 3 },
      { id: 'g6', g: 'linear-gradient(135deg,#232526,#414345 60%,#D8C870)', d: 3 },
      { id: 'g7', g: 'radial-gradient(circle at 70% 20%,#FFF3B0,#F4A261 40%,#264653)', d: 9 },
      { id: 'g8', g: 'linear-gradient(180deg,#355C7D,#6C5B7B 50%,#C06C84)', d: 9 },
      { id: 'g9', g: 'linear-gradient(120deg,#1D2B3A,#3A6073)', d: 30, vid: true },
    ],
    files: {
      Dokumente: [['Angebot_KM_POS.pdf', 412], ['Vertrag_2026.pdf', 230], ['Notizen.txt', 4]],
      Bilder: [['IMG_20261120_0912.jpg', 2400], ['IMG_20261119_1830.jpg', 3100]],
      Downloads: [['ultar-os-0.6.uap', 18400], ['km-pos-2.4.uap', 6200]],
      Musik: [['Aufnahme_01.ogg', 840]],
      Ubuntu: [['.bashrc', 3], ['projekte', 0]],
    },
    notes: [
      { id: 'n1', t: { de: 'Einkauf', en: 'Shopping', ar: 'تسوق' }, b: { de: 'Milch, Brot, Datteln, Kaffee', en: 'Milk, bread, dates, coffee', ar: 'حليب، خبز، تمر، قهوة' }, pin: true },
      { id: 'n2', t: { de: 'Idee Ultar', en: 'Ultar idea', ar: 'فكرة Ultar' }, b: { de: 'LoRa als Ausweich-Funk für Notfälle testen', en: 'Test LoRa as fallback radio for emergencies', ar: 'تجربة LoRa كاتصال احتياطي للطوارئ' } },
    ],
    contacts: [
      { id: 'c1', n: 'Ahmad Haddad', p: '+963 944 120 330', c: '#2B6CB0' }, { id: 'c2', n: 'Lina Saleh', p: '+49 151 2233 4455', c: '#9B2C6C' },
      { id: 'c3', n: 'Omar Khalil', p: '+963 933 551 902', c: '#2F855A' }, { id: 'c4', n: 'Sara Yousef', p: '+971 50 330 7781', c: '#B7791F' },
      { id: 'c5', n: 'KM Support', p: 'UOS-1000-0001', c: '#5A4A1C' }, { id: 'c6', n: 'Mama', p: '+963 11 222 3344', c: '#C53030' },
    ],
    calls: [{ n: 'Ahmad Haddad', k: 'in', t: now - 2 * 3600e3, d: 312 }, { n: '+963 933 551 902', k: 'miss', t: now - 5 * 3600e3, d: 0 }, { n: 'Lina Saleh', k: 'out', t: now - 26 * 3600e3, d: 95 }],
    sms: [
      { id: 'm1', n: 'Omar Khalil', m: [{ me: 0, x: { de: 'Bist du morgen im Büro?', en: 'Are you at the office tomorrow?', ar: 'هل أنت في المكتب غداً؟' }, t: now - 3 * 3600e3 }] },
      { id: 'm2', n: 'Syriatel', m: [{ me: 0, x: { de: 'Ihr Datenpaket wurde verlängert: 10 GB.', en: 'Your data bundle was renewed: 10 GB.', ar: 'تم تجديد باقة البيانات: 10 غيغابايت.' }, t: now - 30 * 3600e3 }] },
      { id: 'm3', n: '+49 1577 0000 000', m: [{ me: 0, x: { de: 'Ihr Paket wartet. Bestätigen: paket-zustellung-de.example/login', en: 'Your parcel is waiting. Confirm: paket-zustellung-de.example/login', ar: 'طردك بانتظارك. للتأكيد: paket-zustellung-de.example/login' }, t: now - 50 * 60e3 }] },
    ],
    tg: [
      { id: 't1', n: 'Ahmad Haddad', m: [{ me: 0, x: { de: 'Schick mir bitte die Datei von heute', en: 'Please send me today\'s file', ar: 'أرسل لي ملف اليوم من فضلك' }, t: now - 16 * 60e3 }] },
      { id: 't2', n: 'KM Code Craft', ch: 1, m: [{ me: 0, x: { de: 'Ultar OS 0.6: Kamera mit Dokumentenscanner läuft auf dem A30.', en: 'Ultar OS 0.6: camera with document scanner runs on the A30.', ar: 'Ultar OS 0.6: الكاميرا مع ماسح المستندات تعمل على A30.' }, t: now - 5 * 3600e3 }] },
      { id: 't3', n: 'Team Damaskus', m: [{ me: 0, x: { de: 'Meeting morgen 10:00 ✔', en: 'Meeting tomorrow 10:00 ✔', ar: 'الاجتماع غداً 10:00 ✔' }, t: now - 20 * 3600e3 }] },
    ],
    alarms: [{ id: 'a1', h: 6, m: 30, on: true, days: '12345' }, { id: 'a2', h: 8, m: 0, on: false, days: '67' }],
    events: [{ id: 'e1', d: 0, h: '10:00', t: { de: 'Teammeeting', en: 'Team meeting', ar: 'اجتماع الفريق' } }, { id: 'e2', d: 2, h: '14:30', t: { de: 'Kunde KM POS', en: 'Client KM POS', ar: 'عميل KM POS' } }],
    todos: [{ id: 'd1', t: { de: 'Ultar-Demo prüfen', en: 'Check the Ultar demo', ar: 'مراجعة عرض Ultar' }, ok: false }, { id: 'd2', t: { de: 'Backup machen', en: 'Make a backup', ar: 'عمل نسخة احتياطية' }, ok: true }],
    clips: [], recents: [], hchat: [], wall: null, desktop: false, browserUrl: 'start',
    usage: [['telegram', 52], ['browser', 41], ['camera', 18], ['helper', 12], ['notes', 9]],
  };
}
let S = freshState();
const L = (o) => (o && typeof o === 'object' && !Array.isArray(o) ? (o[S.lang] ?? o.de) : o);
const T = (de, en, ar) => (S.lang === 'ar' ? ar : S.lang === 'en' ? en : de);
const LOC = () => (S.lang === 'ar' ? 'ar-SY-u-nu-latn' : S.lang === 'en' ? 'en-GB' : 'de-DE');
const fmtTime = (d = new Date()) => `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
const fmtDate = (d = new Date(), o = { weekday: 'long', day: 'numeric', month: 'long' }) => new Intl.DateTimeFormat(LOC(), o).format(d);
const ago = (t) => { const m = Math.round((Date.now() - t) / 60e3); if (m < 1) return T('jetzt', 'now', 'الآن'); if (m < 60) return T(`vor ${m} Min.`, `${m} min ago`, `قبل ${m} د`); const h = Math.round(m / 60); if (h < 24) return T(`vor ${h} Std.`, `${h} h ago`, `قبل ${h} س`); return fmtDate(new Date(t), { day: 'numeric', month: 'short' }); };
const hijri = (d = new Date()) => { try { return new Intl.DateTimeFormat(S.lang === 'ar' ? 'ar-SA-u-ca-islamic-umalqura-nu-latn' : (S.lang === 'en' ? 'en-u-ca-islamic-umalqura' : 'de-u-ca-islamic-umalqura'), { day: 'numeric', month: 'long', year: 'numeric' }).format(d); } catch (e) { return ''; } };

// ---------- Apps ----------
const APPS = {
  phone: { n: ['Telefon', 'Phone', 'الهاتف'], i: 'phone', c: '#4ADE80' }, messages: { n: ['Nachrichten', 'Messages', 'الرسائل'], i: 'msg', c: '#7AB8FF' },
  browser: { n: ['Browser', 'Browser', 'المتصفح'], i: 'globe', c: '#F2F0EA' }, camera: { n: ['Kamera', 'Camera', 'الكاميرا'], i: 'cam', c: '#F2F0EA' },
  settings: { n: ['Einstellungen', 'Settings', 'الإعدادات'], i: 'gear', c: '#F2F0EA' }, gallery: { n: ['Galerie', 'Gallery', 'المعرض'], i: 'img', c: '#F2F0EA' },
  files: { n: ['Dateien', 'Files', 'الملفات'], i: 'folder', c: '#F2F0EA' }, clock: { n: ['Uhr', 'Clock', 'الساعة'], i: 'clock', c: '#F2F0EA' },
  calendar: { n: ['Kalender', 'Calendar', 'التقويم'], i: 'cal', c: '#F2F0EA' }, calc: { n: ['Rechner', 'Calculator', 'الحاسبة'], i: 'calc', c: '#F2F0EA' },
  notes: { n: ['Notizen', 'Notes', 'الملاحظات'], i: 'note', c: '#F2F0EA' }, contacts: { n: ['Kontakte', 'Contacts', 'جهات الاتصال'], i: 'user', c: '#F2F0EA' },
  tools: { n: ['Werkzeuge', 'Tools', 'الأدوات'], i: 'tools', c: '#F2F0EA' }, telegram: { n: ['Telegram', 'Telegram', 'تيليجرام'], i: 'tg', c: '#7AB8FF' },
  store: { n: ['Ultar Store', 'Ultar Store', 'متجر Ultar'], i: 'store', c: '#D8C870' }, monitor: { n: ['Monitor', 'Monitor', 'المراقب'], i: 'pulse', c: '#F2F0EA' },
  terminal: { n: ['Terminal', 'Terminal', 'الطرفية'], i: 'term', c: '#F2F0EA' }, helper: { n: ['KM-Helfer', 'KM Helper', 'مساعد KM'], i: 'sparkle', c: '#D8C870' },
  privacy: { n: ['Datenschutz', 'Privacy', 'الخصوصية'], i: 'shield', c: '#F2F0EA' }, whatsapp: { n: ['WhatsApp', 'WhatsApp', 'واتساب'], i: 'wa', c: '#4ADE80' },
  youtube: { n: ['YouTube', 'YouTube', 'يوتيوب'], i: 'yt', c: '#FF6B6B' }, kmpos: { n: ['KM POS', 'KM POS', 'KM POS'], i: 'box', c: '#D8C870', extra: 1 },
  spotify: { n: ['Spotify', 'Spotify', 'سبوتيفاي'], i: 'spot', c: '#4ADE80', extra: 1 }, libre: { n: ['LibreOffice', 'LibreOffice', 'ليبر أوفيس'], i: 'file', c: '#7AB8FF', extra: 1 },
  vscode: { n: ['VS Code', 'VS Code', 'VS Code'], i: 'term', c: '#7AB8FF', extra: 1 }, android: { n: ['Android-Käfig', 'Android cage', 'قفص أندرويد'], i: 'box', c: '#A6A6AE', extra: 1 },
};
const appName = (id) => { const a = APPS[id]; return a ? T(...a.n) : id; };
const HOME_GRID = ['settings', 'gallery', 'files', 'clock', 'calendar', 'calc', 'notes', 'contacts', 'tools', 'telegram', 'whatsapp', 'youtube', 'store', 'monitor', 'terminal', 'helper', 'privacy'];
const DOCK = ['phone', 'messages', 'browser', 'camera'];
const homeApps = () => [...HOME_GRID, ...S.installed.filter((x) => APPS[x])];
function appIcon(id, size = 26) { const a = APPS[id] || {}; return `<span style="color:${a.c === '#F2F0EA' ? 'var(--tx)' : a.c}">${ic(a.i || 'apps', size, 1.6)}</span>`; }

// ---------- Oberflächen (Handy + Fenster) ----------
const SF = {}; // id -> {id, el, stack, win}
const SC = {}; // Bildschirme
const A = {};  // Aktionen
const IN = {}; // Eingaben
const LP = {}; // langer Druck
let MOUNTS = {};
function newSurface(id, el, root) { SF[id] = { id, el, stack: [root] }; return SF[id]; }
const cur = (sf) => sf.stack[sf.stack.length - 1];
function parse(route) { const i = route.indexOf(':'); return i < 0 ? [route, ''] : [route.slice(0, i), route.slice(i + 1)]; }
function go(sf, route) { sf.stack.push(route); const [n] = parse(route); if (APPS[n] && sf.id === 'p') { S.recents = [n, ...S.recents.filter((x) => x !== n)].slice(0, 8); } render(sf, 'in'); }
function replace(sf, route) { sf.stack[sf.stack.length - 1] = route; render(sf, 'in'); }
function back(sf) { if (sf.stack.length > 1) { sf.stack.pop(); render(sf, 'back'); return true; } return false; }
function home(sf) { sf.stack = [sf.stack[0]]; render(sf, 'back'); }
function openApp(id, sf = SF.p) {
  if (S.desktop && sf.id === 'p') return DESK.open(id);
  if (!APPS[id] && !SC[id]) return;
  sf.stack = [sf.stack[0], id];
  if (sf.id === 'p') S.recents = [id, ...S.recents.filter((x) => x !== id)].slice(0, 8);
  render(sf, 'in');
}
function unmount(sf) { const m = MOUNTS[sf.id]; if (m) { try { m(); } catch (e) {} } delete MOUNTS[sf.id]; }
function render(sf, anim) {
  if (!sf || !sf.el) return;
  const route = cur(sf); const [n, arg] = parse(route); const scr = SC[n];
  unmount(sf);
  const keep = anim ? null : $$('.scroll', sf.el).map((e) => e.scrollTop);
  let body = '';
  try { body = scr ? scr.b(sf, arg) : `<div class="empty">${esc(n)}</div>`; } catch (e) { console.error(e); body = `<div class="empty">Fehler: ${esc(e.message)}</div>`; }
  sf.el.innerHTML = `<div class="view ${anim === 'back' ? 'back' : ''} ${scr && scr.cls ? scr.cls(sf, arg) : ''}" style="${anim ? '' : 'animation:none'}">${body}</div>`;
  if (keep) $$('.scroll', sf.el).forEach((e, i) => { if (keep[i] != null) e.scrollTop = keep[i]; });
  if (scr && scr.m) { const c = scr.m(sf.el, sf, arg); if (typeof c === 'function') MOUNTS[sf.id] = c; }
  if (sf.win) DESK.title(sf);
  if (sf.id === 'p') { chrome(); }
}
function R(sf) { render(sf, null); }
function RA() { Object.values(SF).forEach((sf) => R(sf)); chrome(); if (S.desktop) DESK.render(); }

// Kopfzeile
function hd(sf, title, right = '', opts = {}) {
  const canBack = sf.stack.length > 1 || opts.back;
  return `<div class="hd">${canBack ? `<button class="ib" data-a="back" aria-label="${T('Zurück', 'Back', 'رجوع')}"><span class="flip">${ic('back')}</span></button>` : '<span style="width:10px"></span>'}<h1>${title}</h1>${right}</div>`;
}
const tg = (on, a, v = '') => `<button class="tg ${on ? 'on' : ''}" data-a="${a}" data-v="${esc(v)}" role="switch" aria-checked="${on ? 'true' : 'false'}"></button>`;
function row({ i, c = '#2A2D35', t, s, v, a, d = '', right, gold, cls = '' }) {
  return `<div class="row ${cls}" ${a ? `data-a="${a}" data-v="${esc(d)}" role="button" tabindex="0"` : ''}>${i ? `<span class="ri" style="background:${c}">${ic(i, 18)}</span>` : ''}<span class="rt"><b>${t}</b>${s ? `<small>${s}</small>` : ''}</span>${v != null ? `<span class="rv ${gold ? 'gold' : ''}">${v}</span>` : ''}${right ?? (a ? `<span class="chev flip">${ic('chev', 16)}</span>` : '')}</div>`;
}
const inp = (attrs) => `<input class="inp" inputmode="${S.desktop ? 'text' : 'none'}" autocomplete="off" ${attrs}>`;

// ---------- Ereignisse ----------
function sfOf(el) { const s = el.closest('[data-sf]'); return SF[s ? s.dataset.sf : 'p']; }
document.addEventListener('click', (ev) => {
  const el = ev.target.closest('[data-a]'); if (!el) return;
  if (el.dataset.lpDone) { delete el.dataset.lpDone; return; }
  const f = A[el.dataset.a]; if (!f) { console.warn('Aktion fehlt', el.dataset.a); return; }
  ev.preventDefault(); f(el.dataset.v, el, sfOf(el), ev);
});
document.addEventListener('input', (ev) => { const el = ev.target.closest('[data-in]'); if (el && IN[el.dataset.in]) IN[el.dataset.in](el.value, el, sfOf(el), ev); });
document.addEventListener('change', (ev) => { const el = ev.target.closest('[data-ch]'); if (el && A[el.dataset.ch]) A[el.dataset.ch](el.value, el, sfOf(el), ev); });
document.addEventListener('keydown', (ev) => {
  const el = ev.target.closest && ev.target.closest('[data-enter]');
  if (el && ev.key === 'Enter' && !ev.shiftKey) { ev.preventDefault(); A[el.dataset.enter](el.value, el, sfOf(el), ev); }
  if (ev.key === 'Escape') { if (closeTop()) ev.preventDefault(); }
  if ((ev.key === 'Enter' || ev.key === ' ') && ev.target.matches && ev.target.matches('[role=button][data-a]')) { ev.preventDefault(); ev.target.click(); }
});
let lpT = null, lpPos = null;
document.addEventListener('pointerdown', (ev) => {
  const el = ev.target.closest('[data-lp]'); if (!el) return; lpPos = [ev.clientX, ev.clientY];
  lpT = setTimeout(() => { el.dataset.lpDone = '1'; LP[el.dataset.lp] && LP[el.dataset.lp](el.dataset.v, el, sfOf(el), ev); vib(); setTimeout(() => delete el.dataset.lpDone, 600); }, 520);
});
['pointerup', 'pointercancel'].forEach((e) => document.addEventListener(e, () => clearTimeout(lpT)));
document.addEventListener('pointermove', (ev) => { if (lpPos && Math.hypot(ev.clientX - lpPos[0], ev.clientY - lpPos[1]) > 10) clearTimeout(lpT); });
document.addEventListener('contextmenu', (ev) => { const el = ev.target.closest('[data-lp]'); if (el) { ev.preventDefault(); clearTimeout(lpT); LP[el.dataset.lp] && LP[el.dataset.lp](el.dataset.v, el, sfOf(el), ev); } });
function vib() { try { navigator.vibrate && navigator.vibrate(12); } catch (e) {} }

A.back = (v, el, sf) => { if (!back(sf) && sf.id === 'p') home(sf); };
A.open = (v, el, sf) => { closeLayers(); openApp(v, sf.win ? sf : SF.p); };
A.go = (v, el, sf) => go(sf, v);
A.home = () => { closeLayers(); home(SF.p); };
A.noop = () => {};

// ---------- Ton ----------
let AC = null;
function beep(freqs = [880, 1175], dur = 0.12, vol = 0.08) {
  if (!S.sound || S.profile !== 'normal') return;
  try {
    AC = AC || new (window.AudioContext || window.webkitAudioContext)();
    const t0 = AC.currentTime; const v = vol * (S.vol.media / 100);
    freqs.forEach((f, i) => { const o = AC.createOscillator(); const g = AC.createGain(); o.type = 'sine'; o.frequency.value = f; g.gain.setValueAtTime(0, t0 + i * dur); g.gain.linearRampToValueAtTime(v, t0 + i * dur + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t0 + (i + 1) * dur); o.connect(g).connect(AC.destination); o.start(t0 + i * dur); o.stop(t0 + (i + 1) * dur + 0.02); });
  } catch (e) {}
}

// ---------- Ebenen im Handy (Sheets, Dialoge, Menüs) ----------
const layerHost = () => $('#layers');
function closeLayers() { const h = layerHost(); if (h) h.innerHTML = ''; KB.hide(); }
function closeTop() { const h = layerHost(); if (h && h.lastElementChild) { h.lastElementChild.remove(); KB.hide(); return true; } if (SH.open) { SH.close(); return true; } return false; }
function sheet(html, { mid = false, id = '' } = {}) {
  const h = S.desktop ? DESK.layerHost() : layerHost();
  const d = document.createElement('div'); d.className = `scrim ${mid ? 'mid' : ''}`; d.id = id || 'sh' + uid();
  d.innerHTML = `<div class="sheet" data-sf="p">${mid ? '' : '<div class="grab"></div>'}${html}</div>`;
  d.addEventListener('click', (e) => { if (e.target === d) { d.remove(); KB.hide(); } });
  h.appendChild(d); return d;
}
A.closeSheet = (v, el) => { const s = el.closest('.scrim'); s && s.remove(); KB.hide(); };
function confirmBox(title, text, okLabel, onOk, danger) {
  const d = sheet(`<h2>${title}</h2><p class="muted" style="margin:0 2px 16px;line-height:1.5;font-size:14px">${text}</p><div style="display:flex;gap:10px;justify-content:flex-end"><button class="btn ghost sm" data-a="closeSheet">${T('Abbrechen', 'Cancel', 'إلغاء')}</button><button class="btn sm ${danger ? 'red' : ''}" id="cbok">${okLabel}</button></div>`, { mid: true });
  $('#cbok', d).onclick = () => { d.remove(); onOk(); };
}
function menu(items, x, y) {
  const host = S.desktop ? DESK.layerHost() : layerHost(); const scr = host.getBoundingClientRect(); const sc = scaleOf();
  const m = document.createElement('div'); m.className = 'menu';
  m.innerHTML = items.map((it, i) => `<button data-i="${i}">${ic(it.i, 18)}<span>${it.t}</span></button>`).join('');
  const w = document.createElement('div'); w.style.cssText = 'position:absolute;inset:0;z-index:64'; w.onclick = () => w.remove();
  w.appendChild(m); host.appendChild(w);
  let lx = (x - scr.left) / sc, ly = (y - scr.top) / sc;
  lx = clamp(lx, 8, host.clientWidth - 200); ly = clamp(ly, 50, host.clientHeight - items.length * 44 - 20);
  m.style.left = lx + 'px'; m.style.top = ly + 'px';
  m.onclick = (e) => { const b = e.target.closest('button'); if (!b) return; w.remove(); items[+b.dataset.i].f(); };
}
function scaleOf() { const s = $('#scaler'); const m = /scale\(([\d.]+)\)/.exec(s.style.transform || ''); return m ? +m[1] : 1; }

// ---------- Benachrichtigungen ----------
function notify(n, silent) {
  const it = { id: uid(), t: Date.now(), ...n }; S.notifs.unshift(it);
  if (!silent) { if (!S.dnd) beep([1046, 1318], 0.1); heads(it); }
  chrome(); if (SH.open) SH.render();
}
let headT = null;
function heads(n) {
  if (S.locked && !S.desktop) { renderLock(); return; }
  const host = S.desktop ? DESK.layerHost() : $('#toasts'); if (!host || S.dnd) return;
  host.innerHTML = `<div class="toast" data-a="toastOpen" data-v="${esc(n.app || '')}" style="cursor:pointer">${noteIcon(n.app)}<div style="flex:1;min-width:0"><div style="font-size:12px;color:var(--mt)">${appName(n.app)}</div><div style="font-weight:600;font-size:14px">${esc(L(n.title))}</div><div style="font-size:13px;color:var(--mt);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(L(n.body) || '')}</div></div></div>`;
  clearTimeout(headT); headT = setTimeout(() => { host.innerHTML = ''; }, 3800);
}
A.toastOpen = (v, el) => { el.remove(); if (v && APPS[v]) openApp(v); };
function noteIcon(app) { const a = APPS[app] || { i: 'bell', c: '#A6A6AE' }; return `<span class="ni" style="width:34px;height:34px;border-radius:11px;flex:none;display:flex;align-items:center;justify-content:center;background:${a.c === '#F2F0EA' ? '#2A2D35' : a.c + '33'};color:${a.c === '#F2F0EA' ? '#F2F0EA' : a.c}">${ic(a.i, 18)}</span>`; }

// ---------- Statusleiste ----------
function statusIcons() {
  const p = [];
  if (S.vpn && !S.flight) p.push(`<span class="gold">${ic('key', 14, 2.2)}</span>`);
  if (S.dnd) p.push(ic('moon', 13, 2.2));
  if (S.alarms.some((a) => a.on)) p.push(ic('alarm', 13, 2.2));
  if (S.bt && !S.flight) p.push(ic('bt', 13, 2.2));
  if (S.flight) p.push(ic('plane', 14, 2));
  else {
    if (S.data && S.sim[S.simData].on) p.push(`<span style="font-size:10px;font-weight:800;letter-spacing:.02em">${S.rat}</span><svg width="16" height="12" viewBox="0 0 16 12"><rect x="0" y="8" width="3" height="4" rx="1" fill="currentColor"/><rect x="4.5" y="5" width="3" height="7" rx="1" fill="currentColor"/><rect x="9" y="2" width="3" height="10" rx="1" fill="currentColor"/><rect x="13" y="0" width="3" height="12" rx="1" fill="currentColor" opacity=".3"/></svg>`);
    if (S.wifi) p.push(ic('wifi', 15, 2.4));
  }
  if (S.torch) p.push(`<span class="gold">${ic('torch', 13, 2.2)}</span>`);
  const b = Math.round(S.battery);
  p.push(`<span class="num">${b}</span><span class="bat ${b < 15 ? 'low' : ''} ${S.charging ? 'chg' : ''}"><i style="width:${b}%"></i></span>`);
  return p.join('');
}
function statusbar() { return `<div class="sb" data-a="shade"><span class="num" data-clock>${fmtTime()}</span><span class="r">${statusIcons()}</span></div>`; }
function chrome() {
  const sb = $('#sbar'); if (sb) sb.outerHTML = `<div id="sbar">${statusbar()}</div>`;
  const scr = $('#screen'); if (!scr) return;
  scr.classList.toggle('light', S.theme === 'light'); scr.classList.toggle('big', S.big);
  scr.style.setProperty('--ac', S.theme === 'light' ? shade(S.accent, -0.38) : S.accent);
  scr.setAttribute('dir', S.lang === 'ar' ? 'rtl' : 'ltr'); scr.setAttribute('lang', S.lang);
  const dim = $('#dim'); if (dim) dim.style.opacity = String((100 - S.bright) / 140);
  const nl = $('#nightl'); if (nl) nl.style.display = S.night ? 'block' : 'none';
  const tg2 = $('#torchglow'); if (tg2) tg2.style.opacity = S.torch ? '1' : '0';
  const [n] = parse(cur(SF.p)); const full = (SC[n] && SC[n].full) || S.locked;
  const sbw = $('#sbar'); if (sbw) sbw.style.display = '';
  $('#screen').classList.toggle('fullapp', !!(SC[n] && SC[n].full));
  HLP.place();
  document.documentElement.lang = S.lang;
}
function shade(hex, f) { const n = parseInt(hex.slice(1), 16); let r = n >> 16, g = (n >> 8) & 255, b = n & 255; r = Math.round(r * (1 + f)); g = Math.round(g * (1 + f)); b = Math.round(b * (1 + f)); return '#' + [r, g, b].map((x) => pad2(clamp(x, 0, 255).toString(16))).join(''); }

// ---------- Sekundentakt ----------
let TICKS = [];
setInterval(() => {
  const t = fmtTime(); $$('[data-clock]').forEach((e) => { if (e.textContent !== t) e.textContent = t; });
  TICKS.forEach((f) => { try { f(); } catch (e) {} });
}, 1000);
setInterval(() => { // Akku
  if (S.charging) S.battery = Math.min(100, S.battery + 1); else S.battery = Math.max(5, S.battery - (S.saver ? 0.15 : 0.3));
  if (S.charging && S.care80 && S.battery >= 80 && S.battery < 81) notify({ app: 'settings', title: T('Akku bei 80 %', 'Battery at 80%', 'البطارية 80%'), body: T('Akkuschonung: Ladung kann getrennt werden.', 'Battery care: you can unplug now.', 'حماية البطارية: يمكنك فصل الشاحن.') });
  chrome();
}, 60000);

// ---------- Gerät aufbauen ----------
const FIG = "<svg class=\"fig\" viewBox=\"0 0 200 220\" aria-hidden=\"true\"><defs><linearGradient id=\"kmcB\" x1=\"0\" y1=\"0\" x2=\"0\" y2=\"1\"><stop offset=\"0\" stop-color=\"#FFFBEE\"/><stop offset=\".55\" stop-color=\"#F1E7C2\"/><stop offset=\"1\" stop-color=\"#CDB872\"/></linearGradient><radialGradient id=\"kmcG\" cx=\".5\" cy=\".5\" r=\".5\"><stop offset=\"0\" stop-color=\"#F0E8A0\" stop-opacity=\".55\"/><stop offset=\"1\" stop-color=\"#F0E8A0\" stop-opacity=\"0\"/></radialGradient></defs><ellipse class=\"sh\" cx=\"100\" cy=\"210\" rx=\"46\" ry=\"8\" fill=\"url(#kmcG)\"/><g class=\"bob\"><g class=\"lean\"><g class=\"x snd\" stroke=\"#F0E8A0\" stroke-width=\"4\" fill=\"none\" stroke-linecap=\"round\"><path d=\"M34 70q-10 14 0 28\"/><path d=\"M22 62q-16 22 0 44\"/></g><g class=\"x dots\" fill=\"#F0E8A0\"><circle cx=\"150\" cy=\"34\" r=\"5\"/><circle cx=\"166\" cy=\"20\" r=\"7\"/><circle cx=\"186\" cy=\"2\" r=\"10\"/></g><g class=\"x zz\" fill=\"#F0E8A0\" font-family=\"Inter,sans-serif\" font-weight=\"700\"><text x=\"146\" y=\"40\" font-size=\"22\">z</text><text x=\"160\" y=\"22\" font-size=\"16\">z</text></g><g class=\"antL\"><path d=\"M80 52Q74 36 66 26\" stroke=\"#CDB872\" stroke-width=\"4.5\" fill=\"none\" stroke-linecap=\"round\"/><circle class=\"bulb\" cx=\"65\" cy=\"21\" r=\"7.5\" fill=\"#F0F090\"/></g><g class=\"antR\"><path d=\"M120 52Q126 36 134 26\" stroke=\"#CDB872\" stroke-width=\"4.5\" fill=\"none\" stroke-linecap=\"round\"/><circle class=\"bulb\" cx=\"135\" cy=\"21\" r=\"7.5\" fill=\"#F0F090\"/></g><path d=\"M100 42C150 42 170 82 168 122C166 166 140 188 100 188C60 188 34 166 32 122C30 82 50 42 100 42Z\" fill=\"url(#kmcB)\"/><ellipse cx=\"70\" cy=\"70\" rx=\"18\" ry=\"9\" fill=\"#fff\" opacity=\".7\" transform=\"rotate(-28 70 70)\"/><ellipse cx=\"64\" cy=\"124\" rx=\"9\" ry=\"5\" fill=\"#F80000\" opacity=\".2\"/><ellipse cx=\"136\" cy=\"124\" rx=\"9\" ry=\"5\" fill=\"#F80000\" opacity=\".2\"/><g class=\"look\"><g class=\"ex e-open\"><g class=\"eye\"><ellipse cx=\"80\" cy=\"106\" rx=\"10.5\" ry=\"13.5\" fill=\"#1B1C22\"/><circle cx=\"84\" cy=\"100\" r=\"3.8\" fill=\"#fff\"/></g><g class=\"eye\"><ellipse cx=\"120\" cy=\"106\" rx=\"10.5\" ry=\"13.5\" fill=\"#1B1C22\"/><circle cx=\"124\" cy=\"100\" r=\"3.8\" fill=\"#fff\"/></g></g><g class=\"ex e-happy\" stroke=\"#1B1C22\" stroke-width=\"5.5\" fill=\"none\" stroke-linecap=\"round\"><path d=\"M70 110Q80 96 90 110\"/><path d=\"M110 110Q120 96 130 110\"/></g><g class=\"ex e-closed\" stroke=\"#1B1C22\" stroke-width=\"5\" fill=\"none\" stroke-linecap=\"round\"><path d=\"M70 104Q80 114 90 104\"/><path d=\"M110 104Q120 114 130 104\"/></g><g class=\"ex e-narrow\"><ellipse cx=\"80\" cy=\"108\" rx=\"10\" ry=\"5\" fill=\"#1B1C22\"/><ellipse cx=\"120\" cy=\"108\" rx=\"10\" ry=\"5\" fill=\"#1B1C22\"/><path d=\"M66 90L92 98M134 90L108 98\" stroke=\"#1B1C22\" stroke-width=\"5\" stroke-linecap=\"round\"/></g></g><path class=\"mo m-smile\" d=\"M90 130Q100 140 110 130\" stroke=\"#1B1C22\" stroke-width=\"4.5\" fill=\"none\" stroke-linecap=\"round\"/><path class=\"mo m-open\" d=\"M87 128Q100 150 113 128Z\" fill=\"#1B1C22\"/><ellipse class=\"mo m-o\" cx=\"100\" cy=\"133\" rx=\"5\" ry=\"6\" fill=\"#1B1C22\"/><path class=\"mo m-hmm\" d=\"M90 134Q95 129 100 134T110 133\" stroke=\"#1B1C22\" stroke-width=\"4\" fill=\"none\" stroke-linecap=\"round\"/><path class=\"mo m-frown\" d=\"M90 137Q100 127 110 137\" stroke=\"#1B1C22\" stroke-width=\"4.5\" fill=\"none\" stroke-linecap=\"round\"/><g class=\"mo m-talk\"><ellipse class=\"mtalk\" cx=\"100\" cy=\"133\" rx=\"9\" ry=\"7.5\" fill=\"#1B1C22\"/></g><circle class=\"gem\" cx=\"100\" cy=\"162\" r=\"6.5\" fill=\"#D8C870\" stroke=\"#fff\" stroke-opacity=\".6\" stroke-width=\"2\"/><circle class=\"hL\" cx=\"42\" cy=\"142\" r=\"12.5\" fill=\"url(#kmcB)\"/><circle class=\"hR\" cx=\"158\" cy=\"142\" r=\"12.5\" fill=\"url(#kmcB)\"/></g></g></svg>";
const LOGO = 'logo.png';
const MARK = 'mark.png';
function figure(state = '', size = 60) { return `<div class="kmo ${state}" style="--s:${size}px"><div class="ring"></div><div class="ring r2"></div>${FIG}</div>`; }

function buildPhone(noBoot) {
  $('#scaler').innerHTML = `
  <div class="device" id="device">
    <div id="torchglow" style="position:absolute;top:-18px;left:50%;width:220px;height:60px;margin-left:-110px;border-radius:50%;background:radial-gradient(closest-side,rgba(255,250,220,.95),rgba(255,240,180,.35) 55%,transparent);filter:blur(6px);opacity:0;transition:opacity .25s;pointer-events:none"></div>
    <button class="hw pw" data-a="hwPower" aria-label="Power"></button>
    <button class="hw vu" data-a="hwVol" data-v="1" aria-label="Volume +"></button>
    <button class="hw vd" data-a="hwVol" data-v="-1" aria-label="Volume -"></button>
    <div class="screen" id="screen">
      <div class="notch"></div>
      <div style="position:absolute;inset:0;display:flex;flex-direction:column">
        <div id="sbar"></div>
        <div id="pv" data-sf="p" style="position:relative;flex:1;overflow:hidden"></div>
        <div class="nav" id="navbar">
          <button data-a="back" aria-label="Back"><span class="flip">${ic('back', 22, 2)}</span></button>
          <button data-a="home" aria-label="Home">${ic('home', 22, 2)}</button>
          <button data-a="recents" aria-label="Recents">${ic('rec', 20, 2)}</button>
        </div>
      </div>
      <div id="hlpHost"></div>
      <div id="lockHost"></div>
      <div id="shadeHost"></div>
      <div id="recHost"></div>
      <div id="layers" style="position:absolute;inset:0;z-index:60;pointer-events:none"></div>
      <div id="toasts"></div>
      <div id="kbHost"></div>
      <div id="hudHost"></div>
      <div class="overlay-night" id="nightl" style="display:none"></div>
      <div class="overlay-dim" id="dim" style="opacity:0"></div>
      <div id="offHost"></div>
      ${noBoot ? '' : `<div class="boot" id="boot"><img src="${LOGO}" alt="KM Code Craft"><div class="ld"><i></i></div><div style="font-size:12px;color:#777;letter-spacing:.2em">ULTAR OS 0.6</div></div>`}
    </div>
  </div>`;
  const st = document.createElement('style'); st.textContent = '#layers>*{pointer-events:auto}#screen.fullapp #navbar{background:#000}'; document.head.appendChild(st);
  newSurface('p', $('#pv'), 'home');
  render(SF.p);
  renderLock();
  setTimeout(() => { const b = $('#boot'); b && b.remove(); }, 2600);
}

// ---------- Sperrbildschirm ----------
let lockMode = 'main', pinIn = '';
function renderLock() {
  const h = $('#lockHost'); if (!h) return;
  if (!S.locked) { h.innerHTML = ''; HLP.place(); return; }
  const d = new Date();
  if (lockMode === 'pin') {
    h.innerHTML = `<div class="lock" id="lockEl"><div style="height:40px"></div>
      <div style="text-align:center;margin-top:40px">${ic('lock', 26)}<div style="font-size:17px;margin-top:10px">${S.pinFails >= 5 ? T('Zu viele Versuche – 30 s warten', 'Too many attempts – wait 30 s', 'محاولات كثيرة – انتظر 30 ثانية') : T('PIN eingeben', 'Enter PIN', 'أدخل الرمز')}</div><div style="font-size:12px;opacity:.6;margin-top:4px">${T('Demo-PIN: 1234', 'Demo PIN: 1234', 'رمز العرض: 1234')}</div></div>
      <div class="pin-dots" id="pdots">${[0, 1, 2, 3].map((i) => `<i class="${i < pinIn.length ? 'f' : ''}"></i>`).join('')}</div>
      <div class="pin-pad ltr">${['1', '2 ABC', '3 DEF', '4 GHI', '5 JKL', '6 MNO', '7 PQRS', '8 TUV', '9 WXYZ'].map((k) => `<button data-a="pinKey" data-v="${k[0]}">${k[0]}<small>${k.slice(2)}</small></button>`).join('')}
      <button data-a="lockFp" aria-label="Fingerprint" style="background:transparent">${ic('fp', 28, 1.6)}</button><button data-a="pinKey" data-v="0">0</button><button data-a="pinKey" data-v="del" style="background:transparent" aria-label="Delete">${ic('back', 24)}</button></div>
      <div style="flex:1"></div><button data-a="lockMain" style="border:0;background:transparent;color:inherit;opacity:.7;margin:0 auto 30px;font-size:14px">${T('Abbrechen', 'Cancel', 'إلغاء')}</button></div>`;
    return;
  }
  const ns = S.notifs.slice(0, 3);
  h.innerHTML = `<div class="lock" id="lockEl"><div style="height:40px"></div>
    <div style="text-align:center;margin-top:46px"><div style="font-size:15px;opacity:.75">${fmtDate(d)}</div><div class="lk-clock num dots" data-clock>${fmtTime(d)}</div>
    <div style="font-size:13px;opacity:.6;margin-top:6px">${hijri(d)}</div>
    <div style="display:flex;gap:8px;justify-content:center;margin-top:12px;flex-wrap:wrap">${S.alarms.filter((a) => a.on).slice(0, 1).map((a) => `<span class="pill" style="border-color:rgba(255,255,255,.12)">${ic('alarm', 14)}${pad2(a.h)}:${pad2(a.m)}</span>`).join('')}${S.vpn ? `<span class="pill" style="border-color:rgba(255,255,255,.12)">${ic('key', 14)}VPN</span>` : ''}</div></div>
    <div style="margin:28px 16px 0;display:flex;flex-direction:column;gap:8px">${ns.map((n) => `<div class="note" style="margin:0;background:rgba(28,31,38,.78);color:#F2F0EA">${noteIcon(n.app)}<div style="flex:1;min-width:0"><div style="display:flex;justify-content:space-between;font-size:12px;opacity:.7"><span>${appName(n.app)}</span><span>${ago(n.t)}</span></div><div style="font-weight:600;font-size:14px">${esc(L(n.title))}</div><div style="font-size:13px;opacity:.75">${T('Inhalt ausgeblendet, bis entsperrt', 'Content hidden until unlocked', 'المحتوى مخفي حتى فتح القفل')}</div></div></div>`).join('')}</div>
    <div style="flex:1"></div>
    <div style="display:flex;justify-content:space-between;align-items:center;padding:0 24px">
      <button class="ib fill" data-a="qTorch" aria-label="Torch" style="width:52px;height:52px;border-radius:26px;background:rgba(255,255,255,.08);color:inherit">${ic('torch')}</button>
      <div style="display:flex;flex-direction:column;align-items:center;gap:10px"><button class="fp" id="fpb" data-a="lockFp" aria-label="Fingerprint">${ic('fp', 32, 1.5)}</button><div style="font-size:12.5px;opacity:.7">${T('Finger auflegen oder tippen für PIN', 'Touch sensor or tap for PIN', 'ضع إصبعك أو اضغط لإدخال الرمز')}</div></div>
      <button class="ib fill" data-a="lockCam" aria-label="Camera" style="width:52px;height:52px;border-radius:26px;background:rgba(255,255,255,.08);color:inherit">${ic('cam')}</button>
    </div>
    <button data-a="lockPin" style="border:0;background:transparent;color:inherit;margin:10px auto 54px;display:flex;flex-direction:column;align-items:center;gap:4px;font-size:13px;opacity:.85"><span class="ltr">${ic('up', 20, 2)}</span>${T('Nach oben wischen', 'Swipe up', 'اسحب للأعلى')}</button></div>`;
  const le = $('#lockEl'); let y0 = null;
  le.addEventListener('pointerdown', (e) => { y0 = e.clientY; });
  le.addEventListener('pointerup', (e) => { if (y0 != null && y0 - e.clientY > 60) A.lockPin(); y0 = null; });
}
A.lockPin = () => { lockMode = 'pin'; pinIn = ''; renderLock(); };
A.lockMain = () => { lockMode = 'main'; pinIn = ''; renderLock(); };
A.pinKey = (k) => {
  if (S.pinFails >= 5) return;
  if (k === 'del') pinIn = pinIn.slice(0, -1); else if (pinIn.length < 4) pinIn += k;
  beep([660], 0.04, 0.03); renderLock();
  if (pinIn.length === 4) setTimeout(() => {
    if (pinIn === S.pin) { unlock(); } else { S.pinFails++; const d = $('#pdots'); d && d.classList.add('shake'); pinIn = ''; vib(); setTimeout(renderLock, 420); if (S.pinFails >= 5) setTimeout(() => { S.pinFails = 0; renderLock(); }, 30000); }
  }, 160);
};
A.lockFp = () => { if (!S.fp) { A.lockPin(); return; } const b = $('#fpb'); if (b) b.classList.add('scan'); setTimeout(unlock, 750); };
A.lockCam = () => { unlock(); openApp('camera'); };
function unlock() { S.locked = false; S.pinFails = 0; lockMode = 'main'; pinIn = ''; beep([523, 784], 0.07, 0.04); renderLock(); chrome(); HLP.onUnlock(); }
function lockNow() { S.locked = true; lockMode = 'main'; closeLayers(); SH.close(); REC.close(); renderLock(); HLP.place(); }

// ---------- Hardwaretasten ----------
let screenOff = false, lastVol = { d: 0, t: 0 };
A.hwPower = () => {
  if (S.desktop) return;
  screenOff = !screenOff; const h = $('#offHost');
  if (screenOff) { lockNow(); h.innerHTML = `<div class="off" data-a="hwPower"><div style="color:#333;font-size:12px">${T('Bildschirm aus – Ein/Aus drücken', 'Screen off – press power', 'الشاشة مطفأة – اضغط زر التشغيل')}</div></div>`; }
  else { h.innerHTML = ''; renderLock(); }
  HLP.place();
};
A.hwVol = (v) => {
  const d = +v, now = Date.now();
  if (lastVol.d && lastVol.d !== d && now - lastVol.t < 900) { lastVol = { d: 0, t: 0 }; return rescue(); }
  lastVol = { d, t: now };
  S.vol.media = clamp(S.vol.media + d * 10, 0, 100);
  const h = $('#hudHost'); h.innerHTML = `<div class="hud">${ic(S.vol.media ? 'vol' : 'mute', 18)}<div class="lv"><i style="height:${S.vol.media}%"></i></div><span style="font-size:11px" class="num">${S.vol.media}</span></div>`;
  beep([700], 0.05, 0.05); clearTimeout(A._hud); A._hud = setTimeout(() => { h.innerHTML = ''; }, 1300);
};
function rescue() {
  const h = $('#hudHost'); h.innerHTML = `<div class="scrim mid" style="z-index:96"><div class="sheet" style="text-align:center"><div style="color:var(--ac);margin:8px auto">${ic('reset', 36)}</div><h2>${T('Notausstieg', 'Emergency restart', 'خروج طارئ')}</h2><p class="muted" style="font-size:14px;line-height:1.5;margin:0 0 6px">${T('Lauter + Leiser erkannt. Oberfläche wird neu gestartet – Dienste und Daten bleiben erhalten.', 'Volume up + down detected. Restarting the interface – services and data stay intact.', 'تم ضغط رفع وخفض الصوت معاً. يُعاد تشغيل الواجهة – تبقى الخدمات والبيانات.')}</p><div class="bar" style="margin:14px 10px"><i id="rbar" style="width:0"></i></div></div></div>`;
  setTimeout(() => { const b = $('#rbar'); if (b) b.style.width = '100%'; }, 50);
  setTimeout(() => { h.innerHTML = ''; closeLayers(); SH.close(); home(SF.p); notify({ app: 'settings', title: T('Oberfläche neu gestartet', 'Interface restarted', 'أُعيد تشغيل الواجهة'), body: T('Wachhund: alles wieder in Ordnung.', 'Watchdog: all good again.', 'المراقب: كل شيء على ما يرام.') }); }, 1800);
}

// ---------- Schnelleinstellungen ----------
const SH = {
  open: false,
  toggle() { this.open ? this.close() : this.show(); },
  show() { if (S.locked) return; this.open = true; this.render(); },
  close() { this.open = false; const h = $('#shadeHost'); if (h) h.innerHTML = ''; },
  render() {
    const h = $('#shadeHost'); if (!h || !this.open) return;
    const q = (k, i, n, on, a) => `<button class="qs ${on ? 'on' : ''}" data-a="${a}" data-lp="qLong" data-v="${k}"><span class="q">${ic(i, 24, 1.9)}</span><span>${n}</span></button>`;
    h.innerHTML = `<div class="shade" id="shadeEl"><div style="height:40px"></div><div class="scroll" style="padding:0 16px 10px">
      <div style="display:flex;justify-content:space-between;align-items:center;margin:4px 2px 14px"><div style="display:flex;align-items:baseline;gap:10px"><span class="num dots" style="font-size:42px;font-weight:800" data-clock>${fmtTime()}</span><span class="muted" style="font-size:14px">${fmtDate(new Date(), { weekday: 'short', day: 'numeric', month: 'short' })}</span></div>
      <div style="display:flex;gap:8px"><button class="ib fill" data-a="powerMenu" aria-label="Power">${ic('power', 20)}</button><button class="ib fill" data-a="shOpen" data-v="settings" aria-label="Settings">${ic('gear', 20)}</button></div></div>
      <div class="grid2" style="margin-bottom:12px">
        <button class="qbig ${S.wifi && !S.flight ? 'on' : ''}" data-a="qWifi" data-lp="qLong" data-v="wifi">${ic(S.wifi && !S.flight ? 'wifi' : 'wifiOff', 24, 2)}<span><b>${T('WLAN', 'Wi-Fi', 'واي فاي')}</b><small>${S.flight ? T('Flugmodus', 'Airplane mode', 'وضع الطيران') : S.wifi ? S.wifiNet : T('Aus', 'Off', 'متوقف')}</small></span></button>
        <button class="qbig ${S.data && !S.flight ? 'on' : ''}" data-a="qData" data-lp="qLong" data-v="mobile">${ic('cell', 24, 2)}<span><b>${T('Mobile Daten', 'Mobile data', 'بيانات الجوال')}</b><small>${S.flight ? '—' : S.data ? `${S.sim[S.simData].n} · ${S.rat}` : T('Aus', 'Off', 'متوقف')}</small></span></button>
      </div>
      <div class="grid4" style="row-gap:14px;margin-bottom:14px">
        ${q('bt', 'bt', 'Bluetooth', S.bt && !S.flight, 'qBt')}${q('flight', 'plane', T('Flugmodus', 'Airplane', 'الطيران'), S.flight, 'qFlight')}${q('torch', 'torch', T('Lampe', 'Torch', 'المصباح'), S.torch, 'qTorch')}${q('vpn', 'key', 'VPN', S.vpn, 'qVpn')}
        ${q('sound', S.sound ? 'vol' : 'mute', T('Ton', 'Sound', 'الصوت'), S.sound, 'qSound')}${q('dnd', 'moon', T('Nicht stören', 'Do not disturb', 'عدم الإزعاج'), S.dnd, 'qDnd')}${q('night', 'night', T('Nachtlicht', 'Night light', 'الإضاءة الليلية'), S.night, 'qNight')}${q('saver', 'leaf', T('Energiesparen', 'Battery saver', 'توفير الطاقة'), S.saver, 'qSaver')}
        ${q('privacy', 'shield', T('Datenschutz', 'Privacy', 'الخصوصية'), !S.privacy.all, 'qPriv')}${q('theme', 'sun', T('Hell', 'Light', 'فاتح'), S.theme === 'light', 'qTheme')}${q('helper', 'sparkle', T('Helfer', 'Helper', 'المساعد'), S.helper, 'qHelper')}${q('desk', 'desk', 'Desktop', S.desktop, 'qDesk')}
      </div>
      <div class="slider" id="brs"><i style="width:${S.bright}%"></i>${ic('sun', 20, 2)}</div>
      <div style="display:flex;justify-content:space-between;align-items:center;margin:18px 4px 8px"><span class="sec" style="padding:0">${T('Benachrichtigungen', 'Notifications', 'الإشعارات')}</span>${S.notifs.length ? `<button class="pill" data-a="clearNotifs">${T('Alle löschen', 'Clear all', 'مسح الكل')}</button>` : ''}</div>
      ${S.notifs.length ? S.notifs.map((n) => `<div class="note" data-a="nOpen" data-v="${n.id}" style="cursor:pointer">${noteIcon(n.app)}<div style="flex:1;min-width:0;padding-inline-end:20px"><div style="display:flex;justify-content:space-between;font-size:12px;color:var(--mt)"><span>${appName(n.app)}</span><span>${ago(n.t)}</span></div><div style="font-weight:600;font-size:14px">${esc(L(n.title))}</div><div style="font-size:13px;color:var(--mt)">${esc(L(n.body) || '')}</div></div><button class="x" data-a="nDel" data-v="${n.id}" aria-label="X">${ic('close', 16)}</button></div>`).join('') : `<div class="empty">${ic('bellOff', 28)}<br>${T('Keine Benachrichtigungen', 'No notifications', 'لا توجد إشعارات')}</div>`}
      </div><button data-a="shade" aria-label="Close" style="height:30px;border:0;background:transparent;display:flex;align-items:center;justify-content:center;flex:none"><span style="width:44px;height:5px;border-radius:3px;background:var(--s3);display:block"></span></button></div>`;
    const sl = $('#brs'); const setB = (e) => { const r = sl.getBoundingClientRect(); let p = (e.clientX - r.left) / r.width; if (S.lang === 'ar') p = 1 - p; S.bright = clamp(Math.round(p * 100), 8, 100); $('i', sl).style.width = S.bright + '%'; chrome(); };
    sl.addEventListener('pointerdown', (e) => { sl.setPointerCapture(e.pointerId); setB(e); sl.onpointermove = setB; });
    sl.addEventListener('pointerup', () => { sl.onpointermove = null; });
    let y0 = null; const se = $('#shadeEl');
    se.addEventListener('pointerdown', (e) => { y0 = e.target.closest('#brs') ? null : e.clientY; });
    se.addEventListener('pointerup', (e) => { if (y0 != null && y0 - e.clientY > 90) SH.close(); y0 = null; });
  },
};
A.shade = () => SH.toggle();
const flip = (k) => { S[k] = !S[k]; SH.render(); chrome(); RA2(); };
function RA2() { const [n] = parse(cur(SF.p)); if (n !== 'home' || true) R(SF.p); }
A.qWifi = () => { if (S.flight) S.flight = false; flip('wifi'); };
A.qData = () => { if (S.flight) S.flight = false; flip('data'); };
A.qBt = () => { if (S.flight) S.flight = false; flip('bt'); };
A.qFlight = () => { flip('flight'); if (S.flight) toast(T('Flugmodus: alle Funkverbindungen aus', 'Airplane mode: all radios off', 'وضع الطيران: كل الاتصالات متوقفة')); };
A.qTorch = () => { S.torch = !S.torch; SH.render(); chrome(); if (S.locked) renderLock(); };
A.qVpn = () => { flip('vpn'); toast(S.vpn ? T('VPN verbunden · ultraos.code-craft.tech', 'VPN connected · ultraos.code-craft.tech', 'VPN متصل · ultraos.code-craft.tech') : T('VPN getrennt', 'VPN disconnected', 'VPN مفصول')); };
A.qSound = () => { flip('sound'); S.profile = S.sound ? 'normal' : 'silent'; };
A.qDnd = () => flip('dnd');
A.qNight = () => flip('night');
A.qSaver = () => flip('saver');
A.qPriv = () => { S.privacy.all = !S.privacy.all; SH.render(); toast(S.privacy.all ? T('Gerät aktiv: Sensoren wieder erlaubt', 'Device active: sensors allowed again', 'الجهاز نشط: المستشعرات مسموحة') : T('Hauptschalter: Netz, Kamera, Mikrofon, Standort gesperrt', 'Master switch: network, camera, mic, location blocked', 'المفتاح الرئيسي: الشبكة والكاميرا والميكروفون والموقع محجوبة')); R(SF.p); };
A.qTheme = () => { S.theme = S.theme === 'light' ? 'dark' : 'light'; SH.render(); RA(); };
A.qHelper = () => { flip('helper'); HLP.place(); };
A.qDesk = () => { SH.close(); setDesktop(!S.desktop); };
A.shOpen = (v) => { SH.close(); openApp(v); };
A.clearNotifs = () => { S.notifs = []; SH.render(); };
A.nDel = (id, el, sf, ev) => { ev.stopPropagation(); S.notifs = S.notifs.filter((n) => n.id !== id); SH.render(); };
A.nOpen = (id) => { const n = S.notifs.find((x) => x.id === id); S.notifs = S.notifs.filter((x) => x.id !== id); SH.close(); if (n && APPS[n.app]) openApp(n.app); };
LP.qLong = (k) => { SH.close(); const map = { wifi: 'settings:wifi', mobile: 'settings:mobile', bt: 'settings:bt', vpn: 'settings:vpn', sound: 'settings:sound', dnd: 'settings:sound', night: 'settings:display', saver: 'settings:battery', privacy: 'privacy', theme: 'settings:display', helper: 'settings:helper', desk: 'settings', torch: 'tools', flight: 'settings' }; const r = map[k] || 'settings'; const [n] = parse(r); openApp(n); if (r.includes(':')) go(SF.p, r); };
A.powerMenu = () => {
  SH.close();
  sheet(`<h2>${T('Ein/Aus', 'Power', 'التشغيل')}</h2><div class="list">${row({ i: 'lock', c: '#2A2D35', t: T('Sperren', 'Lock', 'قفل'), a: 'pmLock' })}${row({ i: 'reset', c: '#5A4A1C', t: T('Neu starten', 'Restart', 'إعادة التشغيل'), s: T('Demo startet neu', 'Restarts the demo', 'يعيد تشغيل العرض'), a: 'pmRestart' })}${row({ i: 'power', c: '#7F1D1D', t: T('Ausschalten', 'Power off', 'إيقاف التشغيل'), a: 'pmOff' })}</div>`);
};
A.pmLock = (v, el) => { A.closeSheet(v, el); lockNow(); };
A.pmOff = (v, el) => { A.closeSheet(v, el); A.hwPower(); };
A.pmRestart = (v, el) => { A.closeSheet(v, el); reboot(); };
function reboot(reset) {
  const sc = $('#screen'); const b = document.createElement('div'); b.className = 'boot'; b.innerHTML = `<img src="${LOGO}" alt=""><div class="ld"><i></i></div><div style="font-size:12px;color:#777;letter-spacing:.2em">ULTAR OS 0.6</div>`; sc.appendChild(b);
  setTimeout(() => { if (reset) { const l = S.lang; S = freshState(); S.lang = l; } else S.locked = true; lockMode = 'main'; SH.close(); REC.close(); closeLayers(); home(SF.p); renderLock(); chrome(); }, 900);
  setTimeout(() => b.remove(), 2600);
}
let toastT = null;
function toast(msg) {
  const host = S.desktop ? DESK.layerHost() : $('#toasts'); if (!host) return;
  const d = document.createElement('div'); d.className = 'toast'; d.style.cssText = 'top:auto;bottom:70px;justify-content:center;font-size:13.5px;text-align:center'; d.textContent = msg;
  host.querySelectorAll('.toast.small').forEach((x) => x.remove()); d.classList.add('small'); host.appendChild(d);
  setTimeout(() => d.remove(), 2600);
}

// ---------- Letzte Apps ----------
const REC = {
  close() { const h = $('#recHost'); if (h) h.innerHTML = ''; },
};
A.recents = () => {
  if (S.locked) return; const h = $('#recHost'); if (h.innerHTML) { REC.close(); return; }
  SH.close();
  const list = S.recents.filter((x) => APPS[x]);
  h.innerHTML = `<div class="recents"><div style="height:40px"></div><div style="display:flex;justify-content:space-between;align-items:center;padding:0 22px;color:#F2F0EA"><b style="font-size:17px">${T('Zuletzt verwendet', 'Recent apps', 'التطبيقات الأخيرة')}</b>${list.length ? `<button class="pill" style="color:#F2F0EA" data-a="recClear">${T('Alle schließen', 'Close all', 'إغلاق الكل')}</button>` : ''}</div>
  <div class="rc-list">${list.length ? list.map((x) => `<div class="rc" data-a="recOpen" data-v="${x}"><div class="rh">${appIcon(x, 18)}<span style="flex:1">${appName(x)}</span><button class="ib" style="width:30px;height:30px" data-a="recDel" data-v="${x}" aria-label="X">${ic('close', 16)}</button></div><div class="rb">${appIcon(x, 60)}</div></div>`).join('') : `<div class="empty" style="color:#A6A6AE;margin:auto">${T('Keine Apps geöffnet', 'No open apps', 'لا توجد تطبيقات مفتوحة')}</div>`}</div>
  <div style="text-align:center;color:#8E8E97;font-size:12px;padding-bottom:16px">${T('Tippen zum Wechseln · ✕ zum Schließen', 'Tap to switch · ✕ to close', 'اضغط للتبديل · ✕ للإغلاق')}</div></div>`;
};
A.recOpen = (v) => { REC.close(); openApp(v); };
A.recDel = (v, el, sf, ev) => { ev.stopPropagation(); S.recents = S.recents.filter((x) => x !== v); REC.close(); A.recents(); };
A.recClear = () => { S.recents = []; REC.close(); home(SF.p); };
const _home = A.home; A.home = () => { REC.close(); SH.close(); _home(); };
const _back = A.back; A.back = (v, el, sf) => { if (sf.id === 'p') { if ($('#recHost').innerHTML) return REC.close(); if (SH.open) return SH.close(); if (closeTop()) return; } _back(v, el, sf); };

// ---------- Bildschirmtastatur ----------
const KB = {
  t: null, lay: null, shift: false,
  layouts: {
    de: ['qwertzuiopü', 'asdfghjklöä', '⇧yxcvbnm⌫'], en: ['qwertyuiop', 'asdfghjkl', '⇧zxcvbnm⌫'],
    ar: ['ضصثقفغعهخحج', 'شسيبلاتنمكط', 'ذءؤرىةوزظد⌫'], sym: ['-/:;()€&@"', '[]{}#%^*+=', '⇧.,?!\'_⌫'],
  },
  show(el) {
    if (S.desktop || !el) return; this.t = el; if (!this.lay) this.lay = S.lang === 'ar' ? 'ar' : S.lang === 'en' ? 'en' : 'de';
    this.render(); this.fit();
  },
  hide() { this.t = null; const h = $('#kbHost'); if (h) h.innerHTML = ''; this.fit(); },
  // Seite über der Tastatur einpassen: Ansicht endet an der Tastaturoberkante, fokussiertes Feld wird sichtbar gerollt
  fit() {
    const pv = $('#pv'), kb = $('#kbEl'), nav = $('#navbar'); if (!pv) return;
    const sc = scaleOf();
    const pad = kb ? Math.max(0, kb.getBoundingClientRect().height / sc - (nav ? nav.getBoundingClientRect().height / sc : 0)) : 0;
    pv.style.marginBottom = pad ? pad + 'px' : '';
    const scr = $('#screen'); if (scr) { scr.classList.toggle('kbo', !!kb); scr.style.setProperty('--kbh', kb ? kb.getBoundingClientRect().height / sc + 'px' : '0px'); }
    if (typeof HLP !== 'undefined') HLP.place();
    const el = this.t; if (!el || !kb) return;
    requestAnimationFrame(() => {
      const box = el.closest('.sheet, .scroll'); if (!box) return;
      const r = el.getBoundingClientRect(), b = box.getBoundingClientRect(), m = 16 * sc;
      // Feld und etwas darunter (z. B. „Speichern") zeigen, aber das Feld selbst nie nach oben herausschieben
      const extra = Math.min(76 * sc, Math.max(0, b.height - r.height - 2 * m));
      if (r.bottom + extra + m > b.bottom) box.scrollTop += Math.min(r.bottom + extra + m - b.bottom, r.top - b.top - m);
      else if (r.top - m < b.top) box.scrollTop -= b.top - (r.top - m);
    });
  },
  render() {
    const h = $('#kbHost'); if (!h) return; const L2 = this.layouts[this.lay];
    const key = (k) => { if (k === '⇧') return `<button class="fn" data-k="shift" style="flex:1.4">${ic('up', 18, 2)}</button>`; if (k === '⌫') return `<button class="fn" data-k="bs" style="flex:1.4">${ic('back', 18, 2)}</button>`; const c = this.shift ? k.toUpperCase() : k; return `<button data-k="${esc(c)}">${esc(c)}</button>`; };
    const clips = S.clips.slice(0, 6);
    // Telefonnummern: Ziffernblock wie auf dem Gerät (1 2 3 ⌫ · 4 5 6 + · 7 8 9 * · # 0 ␣ ✓)
    if (this.t && this.t.dataset.kb === 'tel') {
      const k = (c) => c === '⌫' ? `<button class="fn" data-k="bs">${ic('back', 18, 2)}</button>` : c === '✓' ? `<button class="ent" data-k="enter">${ic('check', 18, 2.4)}</button>` : c === '␣' ? `<button class="fn" data-k=" ">␣</button>` : `<button data-k="${c}" style="font-size:20px">${c}</button>`;
      h.innerHTML = `<div class="kb tel" id="kbEl" dir="ltr"><div class="clip"><button class="act" data-k="paste">${ic('paste', 15)} ${T('Einfügen', 'Paste', 'لصق')}</button><span style="flex:1"></span><button class="act" data-k="hide" aria-label="Hide">${ic('down', 16, 2)}</button></div>${['123⌫', '456+', '789*', '#0␣✓'].map((r) => `<div class="kr">${[...r].map(k).join('')}</div>`).join('')}</div>`;
      $('#kbEl').addEventListener('pointerdown', (e) => { e.preventDefault(); const b = e.target.closest('[data-k]'); if (b) this.press(b.dataset.k); });
      return;
    }
    h.innerHTML = `<div class="kb" id="kbEl" dir="${this.lay === 'ar' ? 'rtl' : 'ltr'}">
      <div class="clip"><button class="act" data-k="copy">${ic('copy', 15)} ${T('Kopieren', 'Copy', 'نسخ')}</button><button class="act" data-k="cut">${ic('cut', 15)}</button><button class="act" data-k="paste">${ic('paste', 15)} ${T('Einfügen', 'Paste', 'لصق')}</button>${clips.map((c, i) => `<button data-k="clip${i}">${esc(c)}</button>`).join('')}<span style="flex:1"></span><button class="act" data-k="hide" aria-label="Hide">${ic('down', 16, 2)}</button></div>
      <div class="kr num">${'1234567890'.split('').map((k) => `<button data-k="${k}">${k}</button>`).join('')}</div>
      ${L2.map((r) => `<div class="kr">${[...r].map(key).join('')}</div>`).join('')}
      <div class="kr"><button class="fn" data-k="sym" style="flex:1.4">${this.lay === 'sym' ? 'abc' : '?123'}</button><button class="fn" data-k="globe" aria-label="Language">${ic('globe', 18)}</button><button data-k="${this.lay === 'ar' ? '،' : ','}">${this.lay === 'ar' ? '،' : ','}</button><button data-k=" " style="flex:4;font-size:12px;color:var(--mt)">${{ de: 'Deutsch', en: 'English', ar: 'العربية', sym: '' }[this.lay]}</button><button data-k=".">.</button><button class="ent" data-k="enter" style="flex:1.4">${ic('check', 18, 2.4)}</button></div></div>`;
    const kb = $('#kbEl');
    kb.addEventListener('pointerdown', (e) => { e.preventDefault(); const b = e.target.closest('[data-k]'); if (b) this.press(b.dataset.k); });
  },
  ins(txt) { const el = this.t; if (!el) return; const s = el.selectionStart ?? el.value.length, e = el.selectionEnd ?? el.value.length; el.setRangeText(txt, s, e, 'end'); el.dispatchEvent(new Event('input', { bubbles: true })); },
  press(k) {
    const el = this.t; if (!el) return; beep([1200], 0.02, 0.015); vib();
    if (k === 'shift') { this.shift = !this.shift; return this.render(); }
    if (k === 'hide') { el.blur(); return this.hide(); }
    if (k === 'sym') { this.lay = this.lay === 'sym' ? (S.lang === 'ar' ? 'ar' : S.lang === 'en' ? 'en' : 'de') : 'sym'; return this.render(); }
    if (k === 'globe') { const o = ['de', 'ar', 'en']; this.lay = o[(o.indexOf(this.lay) + 1) % 3]; return this.render(); }
    if (k === 'bs') { const s = el.selectionStart, e = el.selectionEnd; if (s !== e) el.setRangeText('', s, e, 'end'); else if (s > 0) el.setRangeText('', s - 1, s, 'end'); el.dispatchEvent(new Event('input', { bubbles: true })); return; }
    if (k === 'enter') { if (el.dataset.enter) { A[el.dataset.enter](el.value, el, sfOf(el)); } else if (el.tagName === 'TEXTAREA') this.ins('\n'); else { el.blur(); this.hide(); } return; }
    if (k === 'copy' || k === 'cut') { const s = el.selectionStart, e = el.selectionEnd; const txt = s !== e ? el.value.slice(s, e) : el.value; if (txt) { addClip(txt); toast(T('Kopiert', 'Copied', 'تم النسخ')); } if (k === 'cut') { if (s !== e) el.setRangeText('', s, e, 'end'); else el.value = ''; el.dispatchEvent(new Event('input', { bubbles: true })); } return this.render(); }
    if (k === 'paste') { if (S.clips[0]) this.ins(S.clips[0]); return; }
    if (k.startsWith('clip')) { this.ins(S.clips[+k.slice(4)] || ''); return; }
    this.ins(k); if (this.shift) { this.shift = false; this.render(); }
  },
};
function addClip(t) { t = String(t).slice(0, 200); S.clips = [t, ...S.clips.filter((x) => x !== t)].slice(0, 8); try { navigator.clipboard && navigator.clipboard.writeText(t); } catch (e) {} }
document.addEventListener('focusin', (e) => { const el = e.target; if (!(el.matches && el.matches('#screen input:not([type=range]):not([type=checkbox]), #screen textarea'))) return; if (el.closest('.term') && !S.desktop) { KB.show(el); return; } KB.show(el); });
document.addEventListener('focusout', () => { setTimeout(() => { const a = document.activeElement; if (!a || !a.matches || !a.matches('#screen input, #screen textarea')) KB.hide(); }, 120); });

// ---------- KM-Helfer ----------
const HLP = {
  el: null, x: null, y: null, state: '', drag: null, tips: {},
  host() { return $('#hlpHost'); },
  visible() {
    if (S.desktop || !S.helper || S.locked || screenOff) return false;
    const [n] = parse(cur(SF.p)); if (n === 'camera' || n === 'helper') return false;
    if ($('#recHost') && $('#recHost').innerHTML) return false; if (typeof KB !== 'undefined' && KB.t && $('#kbEl')) return false; return true;
  },
  place() {
    const h = this.host(); if (!h) return;
    if (!this.visible()) { h.innerHTML = ''; this.el = null; return; }
    if (!this.el) {
      h.innerHTML = `<div class="hlp" id="hlp" role="button" aria-label="${T('KM-Helfer öffnen', 'Open KM helper', 'افتح مساعد KM')}" tabindex="0">${figure(this.state, 60)}</div>`;
      this.el = $('#hlp'); this.bind();
    }
    if (!this.moved) { const [n] = parse(cur(SF.p)); this.x = (S.lang === 'ar' ? 10 : 318) + (this.ox || 0); this.y = n === 'home' ? 116 + Math.min(0, this.oy || 0) / 4 : 702 + (this.oy || 0); }
    this.el.style.left = this.x + 'px'; this.el.style.top = this.y + 'px';
  },
  bind() {
    const el = this.el; let sx, sy, ox, oy, moved = false;
    el.addEventListener('pointerdown', (e) => { el.setPointerCapture(e.pointerId); sx = e.clientX; sy = e.clientY; ox = this.x; oy = this.y; moved = false; el.style.transition = 'none'; this.drag = true; });
    el.addEventListener('pointermove', (e) => { if (!this.drag) return; const sc = scaleOf(); const dx = (e.clientX - sx) / sc, dy = (e.clientY - sy) / sc; if (Math.hypot(dx, dy) > 6) moved = true; if (moved) { this.moved = true; this.x = clamp(ox + dx, 0, 330); this.y = clamp(oy + dy, 44, 740); el.style.left = this.x + 'px'; el.style.top = this.y + 'px'; } });
    el.addEventListener('pointerup', () => { this.drag = false; el.style.transition = ''; if (!moved) this.openChat(); });
    el.addEventListener('keydown', (e) => { if (e.key === 'Enter') this.openChat(); });
  },
  set(state, ms) {
    this.state = state || ''; $$('#hlp .kmo, #hfig .kmo, .dhlp .kmo').forEach((k) => { k.className = 'kmo ' + this.state; });
    clearTimeout(this._st); if (ms) this._st = setTimeout(() => this.set(''), ms);
  },
  say(text, ms = 4200, state = 'speak') {
    if (!this.el) return; this.set(state, Math.min(ms, 2400));
    $$('.bub', this.el).forEach((b) => b.remove());
    const b = document.createElement('div'); b.className = 'bub'; b.textContent = text;
    if (this.x < 180) { b.style.insetInlineEnd = 'auto'; b.style.left = '-4px'; b.style.right = 'auto'; } else { b.style.right = '-6px'; b.style.left = 'auto'; } if (this.y < 300) { b.style.bottom = 'auto'; b.style.top = '72px'; }
    this.el.appendChild(b); clearTimeout(this._bt); this._bt = setTimeout(() => b.remove(), ms);
  },
  onUnlock() {
    this.place();
    if (!S.hlpIntro) { S.hlpIntro = true; setTimeout(() => { this.set('hello', 3000); this.say(T('Hallo! Ich bin dein KM-Helfer. Tipp mich an – ich zeige dir alles.', 'Hi! I am your KM helper. Tap me – I\'ll show you around.', 'أنا KM Code Craft مساعدك الشخصي، أعمل على جهازك وأحفظ بياناتك وأبقيها آمنة. اضغط عليّ.'), 6500, 'hello'); }, 500); }
  },
  tip(app) {
    if (this.tips[app] || !this.el) return; const m = TIPS[app]; if (!m) return; this.tips[app] = 1;
    setTimeout(() => this.say(L(m), 5200), 600);
  },
  wander() {
    if (!this.el || this.drag || this.state || $('#layers').children.length || SH.open) return;
    if (Math.random() < 0.5) return;
    if (this.moved) return; this.ox = Math.round(Math.random() * 40 - (S.lang === 'ar' ? 0 : 40)); this.oy = Math.round(Math.random() * -50);
    this.el.style.transition = 'left 1.6s cubic-bezier(.45,0,.2,1), top 1.6s cubic-bezier(.45,0,.2,1)'; this.place();
    setTimeout(() => { if (this.el) this.el.style.transition = ''; }, 1700);
  },
  openChat(prefill) {
    const html = `<div style="display:flex;align-items:center;gap:12px;margin-bottom:4px"><div id="hfig" style="width:70px;height:78px;flex:none">${figure(this.state || 'hello', 68)}</div><div style="flex:1"><b style="font-size:17px">${appName('helper')}</b><div style="font-size:12px;color:var(--ok);display:flex;align-items:center;gap:6px"><span style="width:6px;height:6px;border-radius:3px;background:var(--ok)"></span>${T('Offline · läuft auf dem Gerät', 'Offline · runs on the device', 'دون إنترنت · يعمل على الجهاز')}</div></div><button class="ib" data-a="closeSheet" aria-label="X">${ic('close')}</button></div>
      <div class="chat" id="hchat"></div>
      <div class="chips" id="hchips">${SUGG().map((s) => `<button class="pill" data-a="hSugg" data-v="${esc(s)}">${esc(s)}</button>`).join('')}</div>
      <div style="display:flex;gap:8px;align-items:center">${inp(`id="hin" data-enter="hSend" placeholder="${T('Frag mich etwas …', 'Ask me something …', 'اسألني شيئاً …')}"`)}<button class="ib fill" data-a="hMic" aria-label="Mic" style="background:var(--ac);color:var(--onac)">${ic('mic', 20)}</button></div>`;
    const d = sheet(html, { id: 'hsheet' }); d.querySelector('.sheet').style.height = '78%';
    if (!S.hchat.length) S.hchat.push({ me: 0, x: T('Hallo! Ich kenne das ganze System und arbeite offline. Probier einen Vorschlag unten oder schreib mir.', 'Hi! I know the whole system and work offline. Try a suggestion below or type to me.', 'مرحباً! أعرف النظام كله وأعمل دون إنترنت. جرّب اقتراحاً بالأسفل أو اكتب لي.') });
    this.renderChat(); this.set('hello', 1800);
    if (prefill) { setTimeout(() => A.hSend(prefill), 300); }
  },
  renderChat(typing) {
    const c = $('#hchat'); if (!c) return;
    c.innerHTML = S.hchat.map((m) => `<div class="msg ${m.me ? 'me' : 'it'}">${esc(m.x)}</div>`).join('') + (typing ? '<div class="msg it"><span class="typing"><i></i><i></i><i></i></span></div>' : '');
    c.scrollTop = c.scrollHeight;
  },
};
setInterval(() => HLP.wander(), 7000);
const TIPS = {
  camera: { de: 'Tipp: Im Modus „Scan“ erkenne ich Dokumente und speichere sie als PDF.', en: 'Tip: in "Scan" mode I detect documents and save them as PDF.', ar: 'نصيحة: في وضع «مسح» أتعرف على المستندات وأحفظها PDF.' },
  settings: { de: 'Alles lässt sich durchsuchen – oben ins Suchfeld tippen.', en: 'Everything is searchable – tap the search field.', ar: 'كل شيء قابل للبحث – اضغط على حقل البحث.' },
  browser: { de: 'Werbung und Tracker sind hier überall gesperrt. Gefährliche Links prüfe ich vorher.', en: 'Ads and trackers are blocked everywhere. I check dangerous links first.', ar: 'الإعلانات والمتتبعات محجوبة. أفحص الروابط الخطيرة أولاً.' },
  messages: { de: 'Da ist ein verdächtiger Link in einer SMS – tipp ihn an, ich prüfe ihn.', en: 'There\'s a suspicious link in an SMS – tap it and I\'ll check it.', ar: 'هناك رابط مشبوه في رسالة – اضغط عليه وسأفحصه.' },
  terminal: { de: 'Tippe „help“ – hier läuft auch Ubuntu.', en: 'Type "help" – Ubuntu runs here too.', ar: 'اكتب «help» – أوبونتو يعمل هنا أيضاً.' },
  tools: { de: 'Gebetszeiten, Qibla und Hijri-Datum sind eingebaut.', en: 'Prayer times, Qibla and Hijri date are built in.', ar: 'أوقات الصلاة والقبلة والتاريخ الهجري مدمجة.' },
  store: { de: 'Jede App ist signiert – ohne gültige Signatur keine Installation.', en: 'Every app is signed – no valid signature, no install.', ar: 'كل تطبيق موقّع – دون توقيع صالح لا تثبيت.' },
  monitor: { de: 'Achte auf den Upload – ich warne, wenn etwas heimlich sendet.', en: 'Watch the upload – I warn you if something sends secretly.', ar: 'راقب الرفع – أنبهك إن أرسل شيء خفية.' },
};
const SUGG = () => [T('Taschenlampe an', 'Torch on', 'شغّل المصباح'), T('Wecker um 7:30', 'Alarm at 7:30', 'منبه الساعة 7:30'), T('Ist paket-zustellung-de.example/login sicher?', 'Is paket-zustellung-de.example/login safe?', 'هل paket-zustellung-de.example/login آمن؟'), T('Notiz: Milch kaufen', 'Note: buy milk', 'ملاحظة: شراء حليب'), T('Was steht auf dem Bildschirm?', 'What is on the screen?', 'ماذا على الشاشة؟'), T('Öffne Kamera', 'Open camera', 'افتح الكاميرا'), T('Hell-Modus', 'Light mode', 'الوضع الفاتح'), T('Ruf Ahmad an', 'Call Ahmad', 'اتصل بأحمد'), T('Was kannst du?', 'What can you do?', 'ماذا تستطيع؟')];
A.hSugg = (v) => A.hSend(v);
A.hMic = () => {
  HLP.set('listen'); const c = $('#hchat'); if (c) { c.insertAdjacentHTML('beforeend', `<div class="msg sys" id="hlisten">🎙 ${T('Hört zu … (Demo: Sprache wird simuliert)', 'Listening … (demo: speech is simulated)', 'أستمع … (عرض: الصوت محاكى)')}</div>`); c.scrollTop = c.scrollHeight; }
  setTimeout(() => { const l = $('#hlisten'); l && l.remove(); const s = SUGG(); A.hSend(s[Math.floor(Math.random() * 6)]); }, 1700);
};
A.hSend = (v, el) => {
  const text = String(v || ($('#hin') || {}).value || '').trim(); if (!text) return;
  const i = $('#hin'); if (i) i.value = '';
  S.hchat.push({ me: 1, x: text }); HLP.renderChat(true); HLP.set('think');
  setTimeout(() => {
    let r; try { r = hcmd(text); } catch (e) { r = { say: 'Fehler: ' + e.message }; }
    S.hchat.push({ me: 0, x: r.say }); HLP.renderChat(); HLP.set(r.state || 'speak', 1800); beep([988], 0.05, 0.03);
    if (r.after) setTimeout(r.after, 700);
  }, 750);
};
const norm = (s) => s.toLowerCase().replace(/[إأآا]/g, 'ا').replace(/ى/g, 'ي').replace(/ة/g, 'ه').replace(/[ًٌٍَُِّْ]/g, '');
function linkVerdict(url) {
  const u = url.toLowerCase(); const bad = [];
  if (/login|verify|bestaetig|bestätig|konto|account|passwort|password/.test(u)) bad.push(T('fragt nach Anmeldedaten', 'asks for login details', 'يطلب بيانات الدخول'));
  if (/paket|dhl|post|zustell|bank|paypal|apple|whatsapp-|gift|gewinn|free/.test(u)) bad.push(T('ahmt eine bekannte Marke nach', 'imitates a known brand', 'يقلّد علامة معروفة'));
  if (/bit\.ly|tinyurl|t\.co\/|is\.gd/.test(u)) bad.push(T('Kurzlink – Ziel verschleiert', 'short link – target hidden', 'رابط مختصر – الوجهة مخفية'));
  if (/xn--|[а-я]/.test(u)) bad.push(T('Täuschungszeichen (fremde Schrift)', 'look-alike characters', 'أحرف مخادعة'));
  if (/\.(zip|apk|exe)(\b|$)/.test(u)) bad.push(T('lädt eine Programmdatei', 'downloads a program file', 'ينزّل ملفاً تنفيذياً'));
  if (/example|-de\.|\.top|\.xyz/.test(u)) bad.push(T('Domain erst wenige Tage alt', 'domain only days old', 'النطاق عمره أيام'));
  return bad;
}
function hcmd(raw) {
  const t = norm(raw);
  const off = /\b(aus|off|stop)\b|ausschalten|اطفئ|اطفي|ايقاف|اوقف/.test(t);
  const url = raw.match(/(https?:\/\/)?([a-z0-9-]+\.)+[a-z]{2,}(\/[^\s?]*)?/i);
  if (url && /sicher|safe|امن|prüf|check|افحص|link|رابط/.test(t + ' ' + raw)) {
    const v = linkVerdict(url[0]);
    if (!v.length) return { say: T(`✅ ${url[0]} sieht unbedenklich aus. In der abgeschotteten Box: keine Weiterleitung, keine Anmeldemaske.`, `✅ ${url[0]} looks fine. In the sandbox: no redirects, no login form.`, `✅ ${url[0]} يبدو آمناً. في الصندوق المعزول: لا تحويل ولا نموذج دخول.`), state: 'hello' };
    return { say: T(`⚠️ Gefährlich – bitte nicht öffnen.\n• ${v.join('\n• ')}\nGeprüft in einer abgeschotteten Box, auf deinem Gerät wurde nichts geöffnet.`, `⚠️ Dangerous – please don't open.\n• ${v.join('\n• ')}\nChecked in a sandbox, nothing was opened on your device.`, `⚠️ خطير – لا تفتحه.\n• ${v.join('\n• ')}\nتم الفحص في صندوق معزول، لم يُفتح شيء على جهازك.`), state: 'alert' };
  }
  if (/taschenlampe|lampe|torch|flashlight|مصباح|كشاف|الضوء/.test(t)) { S.torch = !off; chrome(); SH.render(); return { say: S.torch ? T('Taschenlampe ist an 🔦', 'Torch is on 🔦', 'المصباح يعمل 🔦') : T('Taschenlampe aus.', 'Torch off.', 'أطفأت المصباح.') }; }
  if (/wlan|wifi|wi-fi|واي ?فاي/.test(t)) { S.wifi = !off; if (!off) S.flight = false; chrome(); R(SF.p); return { say: S.wifi ? T('WLAN ist an, verbunden mit KM-Office.', 'Wi-Fi is on, connected to KM-Office.', 'الواي فاي يعمل ومتصل بـ KM-Office.') : T('WLAN ist aus.', 'Wi-Fi is off.', 'أوقفت الواي فاي.') }; }
  if (/bluetooth|بلوتوث/.test(t)) { S.bt = !off; chrome(); return { say: S.bt ? T('Bluetooth an.', 'Bluetooth on.', 'شغّلت البلوتوث.') : T('Bluetooth aus.', 'Bluetooth off.', 'أوقفت البلوتوث.') }; }
  if (/flugmodus|flight|airplane|طيران/.test(t)) { S.flight = !off; chrome(); return { say: S.flight ? T('Flugmodus an – alle Funkverbindungen aus.', 'Airplane mode on.', 'وضع الطيران يعمل.') : T('Flugmodus aus.', 'Airplane mode off.', 'أوقفت وضع الطيران.') }; }
  if (/hell|light mode|\blight\b|فاتح/.test(t)) { S.theme = 'light'; RA(); return { say: T('Hell-Modus ist an ☀️', 'Light mode on ☀️', 'الوضع الفاتح يعمل ☀️') }; }
  if (/dunkel|dark|داكن|ليلي/.test(t)) { S.theme = 'dark'; RA(); return { say: T('Dunkel-Modus ist an 🌙', 'Dark mode on 🌙', 'الوضع الداكن يعمل 🌙') }; }
  if (/wecker|alarm|منبه|نبهني|ايقظني/.test(t)) {
    const m = raw.match(/(\d{1,2})[:.](\d{2})/) || raw.match(/(\d{1,2})\s*(uhr|am|pm|h)?/i); let h = 7, mi = 0; if (m) { h = +m[1]; mi = m[2] && /^\d+$/.test(m[2]) ? +m[2] : 0; if (/pm/i.test(raw) && h < 12) h += 12; }
    S.alarms.push({ id: uid(), h: h % 24, m: mi % 60, on: true, days: '12345' }); chrome();
    return { say: T(`Wecker gestellt: ${pad2(h)}:${pad2(mi)} ⏰`, `Alarm set: ${pad2(h)}:${pad2(mi)} ⏰`, `ضبطت المنبه: ${pad2(h)}:${pad2(mi)} ⏰`), state: 'hello' };
  }
  if (/timer|مؤقت/.test(t)) { const m = raw.match(/(\d+)/); const min = m ? +m[1] : 5; CLK.timerStart(min * 60); return { say: T(`Timer läuft: ${min} Minuten.`, `Timer running: ${min} minutes.`, `المؤقت يعمل: ${min} دقائق.`) }; }
  if (/notiz|note|ملاحظه/.test(t)) { const txt = raw.split(/[:：]/).slice(1).join(':').trim() || raw; S.notes.unshift({ id: uid(), t: txt.slice(0, 24), b: txt }); return { say: T(`Notiz gespeichert: „${txt}“`, `Note saved: "${txt}"`, `حفظت الملاحظة: «${txt}»`), state: 'hello' }; }
  if (/ruf|anruf|call|اتصل/.test(t)) { const c = S.contacts.find((c) => t.includes(norm(c.n.split(' ')[0])) || (S.lang === 'ar' && /احمد/.test(t) && c.n.startsWith('Ahmad')) || (/ماما|mama|mom/.test(t) && c.n === 'Mama')); if (c) return { say: T(`Ich rufe ${c.n} an …`, `Calling ${c.n} …`, `أتصل بـ ${c.n} …`), after: () => { closeLayers(); CALL.start(c.n); } }; return { say: T('Wen soll ich anrufen? Sag z. B. „Ruf Ahmad an“.', 'Whom should I call? Say e.g. "Call Ahmad".', 'بمن أتصل؟ قل مثلاً «اتصل بأحمد».') }; }
  if (/was steht|bildschirm|what.*screen|on the screen|read the screen|ماذا علي الشاشه|اقرا الشاشه|الشاشه/.test(t)) {
    const [n] = parse(cur(SF.p)); const title = ($('#pv h1') || {}).textContent || (n === 'home' ? T('Startbildschirm', 'Home screen', 'الشاشة الرئيسية') : appName(n));
    const txt = ($('#pv .view') || {}).innerText || ''; const words = txt.replace(/\s+/g, ' ').trim().slice(0, 140);
    return { say: T(`Du bist auf: ${title}. Ich lese: „${words} …“ – ohne Bildschirmfoto, weil Ultar jeden Text selbst zeichnet.`, `You are on: ${title}. I read: "${words} …" – no screenshot needed, Ultar draws every text itself.`, `أنت في: ${title}. أقرأ: «${words} …» – دون لقطة شاشة لأن Ultar يرسم كل نص بنفسه.`) };
  }
  if (/akku|batter|بطاريه/.test(t)) return { say: T(`Akku: ${Math.round(S.battery)} %, Restlaufzeit etwa ${Math.round(S.battery / 6)} Std.`, `Battery: ${Math.round(S.battery)}%, about ${Math.round(S.battery / 6)} h left.`, `البطارية: ${Math.round(S.battery)}%، تكفي نحو ${Math.round(S.battery / 6)} ساعة.`) };
  if (/uhrzeit|wie spät|time|الوقت|الساعه كم|datum|date|تاريخ|hijri|هجري/.test(t)) return { say: `${fmtTime()} · ${fmtDate()} · ${hijri()}` };
  if (/arabisch|arabic|عربي/.test(t)) return { say: 'تم! النظام بالعربية الآن.', after: () => setLang('ar') };
  if (/englisch|english|انجليز/.test(t)) return { say: 'Done! The system is in English now.', after: () => setLang('en') };
  if (/deutsch|german|الماني/.test(t)) return { say: 'Erledigt! Das System ist jetzt auf Deutsch.', after: () => setLang('de') };
  if (/desktop|سطح المكتب/.test(t)) return { say: T('Ich schalte in den Desktop-Modus.', 'Switching to desktop mode.', 'أنتقل إلى وضع سطح المكتب.'), after: () => { closeLayers(); setDesktop(true); } };
  const opener = /öffne|offne|oeffne|open|start|zeig|show|افتح|شغل|اعرض/.test(t);
  for (const id of Object.keys(APPS)) { const names = APPS[id].n.map(norm); if (names.some((nm) => t.includes(nm)) || (opener && t.includes(id))) { if (id === 'helper') continue; return { say: T(`Ich öffne ${appName(id)}.`, `Opening ${appName(id)}.`, `أفتح ${appName(id)}.`), after: () => { closeLayers(); openApp(id); } }; } }
  if (/hilfe|help|was kannst|what can|مساعده|ماذا تستطيع/.test(t)) return { say: T('Ich kann z. B.:\n• Taschenlampe, WLAN, Bluetooth, Flugmodus schalten\n• Wecker, Timer, Notizen anlegen\n• Apps öffnen, Kontakte anrufen\n• Links in einer Box prüfen\n• vorlesen, was auf dem Bildschirm steht\n• Sprache und Hell/Dunkel wechseln', 'I can e.g.:\n• switch torch, Wi-Fi, Bluetooth, airplane mode\n• set alarms, timers, notes\n• open apps, call contacts\n• check links in a sandbox\n• read what is on the screen\n• change language and light/dark', 'أستطيع مثلاً:\n• تشغيل المصباح والواي فاي والبلوتوث ووضع الطيران\n• ضبط المنبه والمؤقت والملاحظات\n• فتح التطبيقات والاتصال بجهات الاتصال\n• فحص الروابط في صندوق معزول\n• قراءة ما على الشاشة\n• تغيير اللغة والوضع الفاتح/الداكن'), state: 'hello' };
  if (/hallo|hello|\bhi\b|hey|مرحبا|السلام|اهلا/.test(t)) return { say: T('Hallo! Schön, dass du da bist 👋', 'Hello! Nice to see you 👋', 'أهلاً! سعيد بوجودك 👋'), state: 'hello' };
  if (/danke|thanks|thank you|شكرا/.test(t)) return { say: T('Gern geschehen! 😊', 'You\'re welcome! 😊', 'على الرحب والسعة! 😊'), state: 'hello' };
  return { say: T('Das kann ich in der Demo noch nicht. Probier z. B. „Taschenlampe an“, „Wecker um 7“ oder „Was kannst du?“.', 'I can\'t do that in the demo yet. Try "torch on", "alarm at 7" or "what can you do?".', 'لا أستطيع ذلك في العرض بعد. جرّب «شغّل المصباح» أو «منبه الساعة 7» أو «ماذا تستطيع؟».'), state: 'think' };
}
function setLang(l) { S.lang = l; KB.lay = null; HLP.moved = false; RA(); renderLock(); SH.render(); updBar(); if (S.desktop) DESK.render(); }

// ================= Startbildschirm =================
const HOME_P1 = 12, HOME_PN = 20;
let homePage = 0;
function homePages() { const ids = homeApps(); const pages = [ids.slice(0, HOME_P1)]; for (let i = HOME_P1; i < ids.length; i += HOME_PN) pages.push(ids.slice(i, i + HOME_PN)); return pages; }
const appBtn = (id) => `<button class="app" data-a="open" data-v="${id}" data-lp="appLong"><span class="ic">${appIcon(id)}${badge(id) ? `<span class="badge">${badge(id)}</span>` : ''}</span><span>${appName(id)}</span></button>`;
SC.home = {
  cls: () => 'home',
  b(sf) {
    const ev = S.events.filter((e) => e.d >= 0).sort((a, b) => a.d - b.d)[0];
    const pages = homePages();
    const head = `<div style="display:flex;justify-content:space-between;align-items:flex-start;margin-top:18px">
        <div><div class="h-clock num dots" data-clock>${fmtTime()}</div><div class="muted" style="font-size:14px;margin-top:6px">${fmtDate(new Date(), { weekday: 'short', day: 'numeric', month: 'short' })} · ${hijri()}</div></div>
        <img src="${LOGO}" alt="KM Code Craft" style="height:38px;width:auto;margin-top:6px">
      </div>
      <div class="grid2" style="margin-top:16px">
        <div class="w-card" data-a="open" data-v="monitor"><div class="muted" style="font-size:12px;margin-bottom:9px">${T('Gerät', 'Device', 'الجهاز')}</div><div id="wmeters" style="display:flex;flex-direction:column;gap:7px">${meters()}</div></div>
        <div class="w-card" data-a="open" data-v="calendar" style="display:flex;flex-direction:column;justify-content:space-between"><div class="muted" style="font-size:12px">${T('Als Nächstes', 'Up next', 'التالي')}</div>${ev ? `<div><div style="font-size:17px;font-weight:650;line-height:1.25">${esc(L(ev.t))}</div><div class="muted" style="font-size:13px;margin-top:3px">${ev.d === 0 ? T('Heute', 'Today', 'اليوم') : ev.d === 1 ? T('Morgen', 'Tomorrow', 'غداً') : `+${ev.d} ${T('Tage', 'days', 'أيام')}`} · <span class="ltr">${ev.h}</span></div></div>` : `<div class="muted">—</div>`}</div>
      </div>
      <div class="search" style="margin-top:14px" data-a="go" data-v="search">${ic('search', 18)}<span class="muted" style="flex:1;font-size:14.5px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${T('Apps, Dateien, Einstellungen suchen', 'Search apps, files, settings', 'ابحث في التطبيقات والملفات والإعدادات')}</span><button class="ib" style="background:color-mix(in srgb,var(--ac) 18%,transparent);color:var(--ac);width:38px;height:38px" data-a="hlpOpen" aria-label="Mic">${ic('mic', 18)}</button></div>`;
    return `<div class="hpages" id="hpages">${pages.map((p, i) => `<section class="hpage" aria-label="${T('Seite', 'Page', 'صفحة')} ${i + 1}">${i === 0 ? head : '<div style="height:18px"></div>'}<div class="apps" style="margin-top:${i === 0 ? 20 : 6}px">${p.map(appBtn).join('')}</div></section>`).join('')}</div>
      <div class="hdots" id="hdots">${pages.map((_, i) => `<button data-a="homePg" data-v="${i}" class="${i === homePage ? 'on' : ''}" aria-label="${T('Seite', 'Page', 'صفحة')} ${i + 1}"></button>`).join('')}</div>
      <div class="dock">${DOCK.map((id) => `<button class="app" data-a="open" data-v="${id}" aria-label="${appName(id)}"><span class="ic" style="${id === 'phone' ? 'background:#173A24;border-color:transparent' : ''}">${appIcon(id)}${badge(id) ? `<span class="badge">${badge(id)}</span>` : ''}</span></button>`).join('')}</div>`;
  },
  m(el) {
    const t = () => { const w = $('#wmeters', el); if (w) w.innerHTML = meters(); }; TICKS.push(t);
    const hp = $('#hpages', el); const W = () => hp.clientWidth;
    const sync = () => { const p = Math.round(Math.abs(hp.scrollLeft) / W()); if (p !== homePage) { homePage = p; $$('#hdots button', el).forEach((b, i) => b.classList.toggle('on', i === p)); } };
    hp.scrollLeft = (S.lang === 'ar' ? -1 : 1) * homePage * W();
    hp.addEventListener('scroll', sync, { passive: true });
    // Maus-/Touch-Wischen auch am Desktop (Rad + Ziehen)
    let x0 = null, s0 = 0, moved = false;
    hp.addEventListener('pointerdown', (e) => { if (e.pointerType === 'touch') return; x0 = e.clientX; s0 = hp.scrollLeft; moved = false; });
    hp.addEventListener('pointermove', (e) => { if (x0 == null) return; const dx = (e.clientX - x0) / scaleOf(); if (Math.abs(dx) > 8) { moved = true; hp.style.scrollSnapType = 'none'; hp.scrollLeft = s0 - dx; } });
    const end = (e) => { if (x0 == null) return; const dx = (e.clientX - x0) / scaleOf(); x0 = null; hp.style.scrollSnapType = ''; if (moved) { const fwd = S.lang === 'ar' ? dx > 40 : dx < -40, bwd = S.lang === 'ar' ? dx < -40 : dx > 40; const n = clamp(homePage + (fwd ? 1 : bwd ? -1 : 0), 0, homePages().length - 1); goPage(hp, n); const stop = (ev) => { ev.stopPropagation(); ev.preventDefault(); }; hp.addEventListener('click', stop, { capture: true, once: true }); } };
    hp.addEventListener('pointerup', end); hp.addEventListener('pointerleave', end);
    return () => { TICKS = TICKS.filter((x) => x !== t); };
  },
};
function goPage(hp, n) { homePage = n; hp.scrollTo({ left: (S.lang === 'ar' ? -1 : 1) * n * hp.clientWidth, behavior: 'smooth' }); $$('#hdots button').forEach((b, i) => b.classList.toggle('on', i === n)); }
A.homePg = (v) => { const hp = $('#hpages'); if (hp) goPage(hp, +v); };
const cpu = () => (S.saver ? 4 : 8) + Math.round(Math.random() * 9);
function meters() { const r = [[T('CPU', 'CPU', 'المعالج'), cpu()], ['RAM', 31 + Math.round(Math.random() * 3)], [T('Akku', 'Battery', 'البطارية'), Math.round(S.battery)]]; return r.map(([n, v], i) => `<div style="display:flex;align-items:center;gap:8px;font-size:12px"><span style="width:52px;opacity:.8">${n}</span><div class="bar" style="flex:1;height:6px"><i style="width:${v}%;${i === 2 ? 'background:var(--ok)' : ''}"></i></div><span class="num" style="width:30px;text-align:end">${v}%</span></div>`).join(''); }
function badge(id) { if (id === 'telegram') return S.tg.filter((c) => c.unread !== 0).length ? 1 : 0; if (id === 'messages') return 1; if (id === 'phone') return S.calls.filter((c) => c.k === 'miss').length; return 0; }
A.hlpOpen = (v, el, sf, ev) => { ev.stopPropagation(); HLP.openChat(); };
LP.appLong = (id, el, sf, ev) => {
  const items = [{ i: 'info', t: T('App-Info', 'App info', 'معلومات التطبيق'), f: () => { openApp('settings'); go(SF.p, 'settings:apps'); } }, { i: 'desk', t: T('Im Fenster öffnen', 'Open in window', 'افتح في نافذة'), f: () => { setDesktop(true); DESK.open(id); } }];
  if (APPS[id] && APPS[id].extra) items.push({ i: 'trash', t: T('Deinstallieren', 'Uninstall', 'إلغاء التثبيت'), f: () => uninstall(id) });
  const r = el.getBoundingClientRect(); menu(items, r.left, r.bottom);
};
function uninstall(id) { confirmBox(T('Deinstallieren?', 'Uninstall?', 'إلغاء التثبيت؟'), T(`${appName(id)} und alle Daten der App werden entfernt.`, `${appName(id)} and all its data will be removed.`, `سيُحذف ${appName(id)} وكل بياناته.`), T('Entfernen', 'Remove', 'إزالة'), () => { S.installed = S.installed.filter((x) => x !== id); R(SF.p); toast(T('Entfernt', 'Removed', 'تمت الإزالة')); }, true); }

// ================= Globale Suche =================
SC.search = {
  b(sf) {
    return `${hd(sf, T('Suche', 'Search', 'البحث'))}<div class="pad" style="padding-bottom:8px">${inp(`id="gq" data-in="gSearch" placeholder="${T('Suchen …', 'Search …', 'ابحث …')}"`)}</div><div class="scroll pad" id="gres">${searchRes('')}</div>`;
  },
  m(el) { setTimeout(() => { const i = $('#gq', el); i && i.focus(); }, 250); },
};
IN.gSearch = (v) => { $('#gres').innerHTML = searchRes(v); };
function searchRes(q) {
  const nq = norm(q.trim()); if (!nq) return `<div class="sec">${T('Vorschläge', 'Suggestions', 'اقتراحات')}</div><div class="chips" style="flex-wrap:wrap">${['WLAN', 'VPN', T('Kamera', 'Camera', 'الكاميرا'), T('Akku', 'Battery', 'البطارية'), 'Ahmad', T('Gebetszeiten', 'Prayer times', 'أوقات الصلاة')].map((s) => `<button class="pill" data-a="gFill" data-v="${esc(s)}">${esc(s)}</button>`).join('')}</div><div class="muted" style="font-size:12.5px;margin-top:10px">${T('Arabisch-tolerant: „احمد“ findet auch „أحمد“.', 'Arabic-tolerant: "احمد" also finds "أحمد".', 'بحث متسامح: «احمد» يجد «أحمد» أيضاً.')}</div>`;
  const hit = (s) => norm(String(s)).includes(nq);
  const apps = Object.keys(APPS).filter((id) => (homeApps().includes(id) || DOCK.includes(id) || id === 'helper') && APPS[id].n.some(hit));
  const sets = SETS().filter((s) => hit(s.t) || (s.k && hit(s.k)));
  const cons = S.contacts.filter((c) => hit(c.n) || (S.lang === 'ar' && /احمد/.test(nq) && c.n.startsWith('Ahmad')));
  const notes = S.notes.filter((n) => hit(L(n.t)) || hit(L(n.b)));
  const files = Object.entries(S.files).flatMap(([d, fs]) => fs.filter((f) => hit(f[0])).map((f) => [d, f[0]]));
  const tools = TOOLS().filter((x) => hit(x.t));
  let h = '';
  if (apps.length) h += `<div class="sec">Apps</div><div class="list">${apps.map((id) => row({ t: appName(id), a: 'open', d: id, right: '', i: APPS[id].i, c: '#2A2D35' })).join('')}</div>`;
  if (sets.length) h += `<div class="sec">${appName('settings')}</div><div class="list">${sets.map((s) => row({ i: s.i, c: s.c, t: s.t, a: 'gSet', d: s.r })).join('')}</div>`;
  if (tools.length) h += `<div class="sec">${appName('tools')}</div><div class="list">${tools.map((s) => row({ i: s.i, c: '#2A2D35', t: s.t, a: 'gTool', d: s.k })).join('')}</div>`;
  if (cons.length) h += `<div class="sec">${appName('contacts')}</div><div class="list">${cons.map((c) => row({ t: c.n, s: c.p, a: 'gCon', d: c.id, i: 'user', c: c.c })).join('')}</div>`;
  if (notes.length) h += `<div class="sec">${appName('notes')}</div><div class="list">${notes.map((n) => row({ t: esc(L(n.t)), s: esc(L(n.b)), a: 'gNote', d: n.id, i: 'note', c: '#5A4A1C' })).join('')}</div>`;
  if (files.length) h += `<div class="sec">${appName('files')}</div><div class="list">${files.map(([d, f]) => row({ t: esc(f), s: d, a: 'gFile', d, i: 'file', c: '#2A2D35' })).join('')}</div>`;
  return h || `<div class="empty">${T('Nichts gefunden', 'Nothing found', 'لا نتائج')}</div>`;
}
A.gFill = (v) => { const i = $('#gq'); i.value = v; IN.gSearch(v); };
A.gSet = (r) => { openApp('settings'); if (r) go(SF.p, 'settings:' + r); };
A.gTool = (k) => { openApp('tools'); go(SF.p, 'tool:' + k); };
A.gCon = (id) => { openApp('contacts'); go(SF.p, 'contact:' + id); };
A.gNote = (id) => { openApp('notes'); go(SF.p, 'note:' + id); };
A.gFile = (d) => { openApp('files'); go(SF.p, 'files:' + d); };

// ================= Einstellungen =================
const SETS = () => [
  { g: 1, r: 'wifi', i: 'wifi', c: '#1E3A5F', t: T('WLAN', 'Wi-Fi', 'واي فاي'), v: () => (S.flight ? T('Flugmodus', 'Airplane', 'طيران') : S.wifi ? S.wifiNet : T('Aus', 'Off', 'متوقف')) },
  { g: 1, r: 'bt', i: 'bt', c: '#1E3A5F', t: 'Bluetooth', v: () => (S.bt ? T('An', 'On', 'يعمل') : T('Aus', 'Off', 'متوقف')) },
  { g: 1, r: 'mobile', i: 'cell', c: '#173A24', t: T('Mobilfunk & SIM', 'Mobile & SIM', 'الشبكة الخلوية والشريحة'), k: 'funkturm tower برج', v: () => `${S.sim[S.simData].n} · ${S.rat}` },
  { g: 1, r: 'vpn', i: 'key', c: '#4A421C', t: 'VPN', v: () => (S.vpn ? T('Verbunden', 'Connected', 'متصل') : T('Aus', 'Off', 'متوقف')), gold: () => S.vpn },
  { g: 1, r: 'usage', i: 'data', c: '#1E3A5F', t: T('Datenverkehr', 'Data usage', 'استهلاك البيانات'), v: () => '412 MB' },
  { g: 2, r: 'display', i: 'sun', c: '#2A2D35', t: T('Anzeige', 'Display', 'العرض'), k: 'hell dunkel theme nachtlicht', v: () => (S.theme === 'light' ? T('Hell', 'Light', 'فاتح') : T('Dunkel', 'Dark', 'داكن')) },
  { g: 2, r: 'sound', i: 'vol', c: '#2A2D35', t: T('Töne & Ruhe', 'Sounds & quiet', 'الأصوات والهدوء'), v: () => (S.dnd ? T('Nicht stören', 'Do not disturb', 'عدم الإزعاج') : S.vol.media + ' %') },
  { g: 2, r: 'battery', i: 'bat', c: '#173A24', t: T('Akku & Energie', 'Battery & power', 'البطارية والطاقة'), v: () => Math.round(S.battery) + ' %' },
  { g: 2, r: 'storage', i: 'drive', c: '#2A2D35', t: T('Speicher', 'Storage', 'التخزين'), v: () => '18,4 / 64 GB' },
  { g: 2, r: 'care', i: 'care', c: '#173A24', t: T('Gerätepflege', 'Device care', 'العناية بالجهاز'), v: () => '96' },
  { g: 3, r: 'privacy', i: 'shield', c: '#4A1D1D', t: T('Datenschutz-Zentrum', 'Privacy center', 'مركز الخصوصية'), v: () => (S.privacy.all ? T('Aktiv', 'Active', 'نشط') : T('Gesperrt', 'Blocked', 'محجوب')) },
  { g: 3, r: 'security', i: 'lock', c: '#4A1D1D', t: T('Sicherheit & Sperre', 'Security & lock', 'الأمان والقفل'), k: 'pin fingerabdruck verschlüsselung', v: () => 'PIN · ' + T('Finger', 'Finger', 'بصمة') },
  { g: 3, r: 'helper', i: 'sparkle', c: '#4A421C', t: appName('helper'), k: 'hey km stimme voice', v: () => (S.helper ? T('An', 'On', 'يعمل') : T('Aus', 'Off', 'متوقف')) },
  { g: 3, r: 'apps', i: 'apps', c: '#2A2D35', t: T('Apps', 'Apps', 'التطبيقات'), v: () => String(homeApps().length + DOCK.length) },
  { g: 3, r: 'ubuntu', i: 'ubuntu', c: '#5A2A1C', t: T('Ubuntu-Bereich', 'Ubuntu area', 'منطقة أوبونتو'), v: () => '24.04' },
  { g: 4, r: 'lang', i: 'lang', c: '#2A2D35', t: T('Sprache & Region', 'Language & region', 'اللغة والمنطقة'), v: () => ({ de: 'Deutsch', en: 'English', ar: 'العربية' }[S.lang]) },
  { g: 4, r: 'datetime', i: 'clock', c: '#2A2D35', t: T('Datum & Uhrzeit', 'Date & time', 'التاريخ والوقت'), v: () => T('Automatisch', 'Automatic', 'تلقائي') },
  { g: 4, r: 'backup', i: 'backup', c: '#1E3A5F', t: T('Sicherung', 'Backup', 'النسخ الاحتياطي'), v: () => ago(S.backup.last) },
  { g: 4, r: 'update', i: 'upd', c: '#4A421C', t: T('System-Update', 'System update', 'تحديث النظام'), v: () => (S.update.st === 'ready' ? T('Neu starten', 'Restart', 'أعد التشغيل') : '0.6.0'), gold: () => S.update.st === 'ready' },
  { g: 4, r: 'services', i: 'svc', c: '#2A2D35', t: T('Dienste', 'Services', 'الخدمات'), v: () => S.services.filter((s) => s[1]).length + '/' + S.services.length },
  { g: 4, r: 'desktop', i: 'desk', c: '#2A2D35', t: T('Desktop-Modus', 'Desktop mode', 'وضع سطح المكتب'), v: () => (S.desktop ? T('An', 'On', 'يعمل') : T('Aus', 'Off', 'متوقف')) },
  { g: 4, r: 'about', i: 'info', c: '#2A2D35', t: T('Über das Gerät', 'About device', 'حول الجهاز'), v: () => 'Ultar OS 0.6' },
  { g: 4, r: 'reset', i: 'reset', c: '#7F1D1D', t: T('Zurücksetzen', 'Reset', 'إعادة الضبط'), v: () => '' },
];
let setQ = '';
SC.settings = {
  b(sf, arg) {
    if (arg && SET[arg]) return SET[arg](sf);
    const groups = [[1, T('Verbindungen', 'Connections', 'الاتصالات')], [2, T('Gerät', 'Device', 'الجهاز')], [3, T('Schutz & Apps', 'Protection & apps', 'الحماية والتطبيقات')], [4, T('System', 'System', 'النظام')]];
    const list = SETS().filter((s) => !setQ || norm(s.t).includes(norm(setQ)) || (s.k && norm(s.k).includes(norm(setQ))));
    return `${hd(sf, '', '')}<div class="scroll pad"><div class="big-t">${appName('settings')}</div>
      <div style="margin-bottom:14px">${inp(`data-in="setQ" value="${esc(setQ)}" placeholder="${T('Einstellung suchen', 'Search settings', 'ابحث في الإعدادات')}"`)}</div>
      ${setQ ? '' : `<button class="row card" data-a="go" data-v="settings:account" style="border-radius:22px;margin-bottom:16px;border:1px solid color-mix(in srgb,var(--ac) 35%,transparent);background:linear-gradient(135deg,color-mix(in srgb,var(--ac) 14%,var(--s1)),var(--s1) 70%)"><span class="avatar" style="width:48px;height:48px;background:#121108;border:1px solid rgba(240,232,160,.4)"><img src="${MARK}" alt="" style="width:34px"></span><span class="rt"><b style="font-size:16px;font-weight:600">${T('Ultar-Konto', 'Ultar account', 'حساب Ultar')}</b><small class="ltr">${S.uos}</small></span><span class="chev flip">${ic('chev', 16)}</span></button>`}
      ${groups.map(([g, gt]) => { const rs = list.filter((s) => s.g === g); return rs.length ? `<div class="sec">${gt}</div><div class="list">${rs.map((s) => row({ i: s.i, c: s.c, t: s.t, v: s.v(), gold: s.gold && s.gold(), a: 'setGo', d: s.r })).join('')}</div>` : ''; }).join('')}
      ${list.length ? '' : `<div class="empty">${T('Nichts gefunden', 'Nothing found', 'لا نتائج')}</div>`}</div>`;
  },
};
IN.setQ = (v) => { setQ = v; const sf = SF.p; const pos = v.length; R(sf); const i = $('#pv input[data-in=setQ]'); if (i) { i.focus(); i.setSelectionRange(pos, pos); } };
A.setGo = (r, el, sf) => { if (r === 'privacy') return go(sf, 'privacy'); if (r === 'desktop') { setDesktop(!S.desktop); return; } go(sf, 'settings:' + r); };
const SET = {};
const sub = (sf, title, html) => `${hd(sf, title)}<div class="scroll pad">${html}</div>`;
const tgRow = (i, c, t, s, on, a, d = '') => row({ i, c, t, s, right: tg(on, a, d) });

SET.account = (sf) => sub(sf, T('Ultar-Konto', 'Ultar account', 'حساب Ultar'), `<div class="card" style="padding:18px;text-align:center;margin-bottom:14px"><div class="muted" style="font-size:12px">${T('Deine Ultar-Nummer', 'Your Ultar number', 'رقم Ultar الخاص بك')}</div><div class="ltr num" style="font-size:26px;font-weight:700;margin:6px 0;color:var(--ac)">${S.uos}</div><div class="muted" style="font-size:13px;line-height:1.5">${T('Anrufe zwischen Ultar-Geräten sind Ende-zu-Ende verschlüsselt. Der Server vermittelt nur.', 'Calls between Ultar devices are end-to-end encrypted. The server only connects.', 'المكالمات بين أجهزة Ultar مشفرة من طرف لطرف. الخادم يوصل فقط.')}</div><div style="display:flex;gap:8px;justify-content:center;margin-top:12px"><button class="btn sm" data-a="copyTxt" data-v="${S.uos}">${ic('copy', 16)} ${T('Kopieren', 'Copy', 'نسخ')}</button><button class="btn sm ghost" data-a="open" data-v="phone">${ic('phone', 16)} ${appName('phone')}</button></div></div>
<div class="list">${row({ i: 'server', c: '#2A2D35', t: T('Server', 'Server', 'الخادم'), v: '<span class="ltr">ultraos.code-craft.tech</span>' })}${row({ i: 'shieldOk', c: '#173A24', t: T('Anmeldung', 'Sign-in', 'تسجيل الدخول'), v: T('Aktiv', 'Active', 'نشط') })}${row({ i: 'store', c: '#4A421C', t: 'Ultar Store', a: 'open', d: 'store' })}</div>`);
A.copyTxt = (v) => { addClip(v); toast(T('Kopiert – in der Tastatur-Zwischenablage', 'Copied – in the keyboard clipboard', 'تم النسخ – في حافظة لوحة المفاتيح')); };

const NETS = [['KM-Office', 4, 1], ['KM-Gast', 3, 0], ['Vodafone-7A21', 2, 1], ['Damascus-Cafe', 2, 0], ['FRITZ!Box 7590', 1, 1]];
SET.wifi = (sf) => sub(sf, T('WLAN', 'Wi-Fi', 'واي فاي'), `<div class="list">${tgRow('wifi', '#1E3A5F', T('WLAN verwenden', 'Use Wi-Fi', 'استخدام الواي فاي'), S.flight ? T('Flugmodus ist an', 'Airplane mode is on', 'وضع الطيران يعمل') : '', S.wifi && !S.flight, 'tWifi')}</div>
${S.wifi && !S.flight ? `<div class="sec">${T('Verbunden', 'Connected', 'متصل')}</div><div class="list">${row({ i: 'wifi', c: '#4A421C', t: S.wifiNet, s: T('5 GHz · WPA2 · 433 Mbit/s · IP 192.168.1.42', '5 GHz · WPA2 · 433 Mbit/s · IP 192.168.1.42', '5 غيغاهرتز · WPA2 · 433 ميغابت · IP 192.168.1.42'), a: 'wifiInfo', d: S.wifiNet })}</div>
<div class="sec" style="display:flex;justify-content:space-between">${T('Verfügbare Netze', 'Available networks', 'الشبكات المتاحة')}<button class="pill" data-a="wifiScan">${ic('ref', 14)} ${T('Suchen', 'Scan', 'بحث')}</button></div><div class="list" id="wlist">${NETS.filter((n) => n[0] !== S.wifiNet).map((n) => row({ i: 'wifi', c: '#2A2D35', t: n[0], s: (n[2] ? '🔒 ' : '') + ['', T('schwach', 'weak', 'ضعيف'), T('mittel', 'fair', 'متوسط'), T('gut', 'good', 'جيد'), T('sehr gut', 'excellent', 'ممتاز')][n[1]], a: 'wifiJoin', d: n[0] })).join('')}${row({ i: 'plus', c: '#2A2D35', t: T('Verstecktes Netz hinzufügen', 'Add hidden network', 'إضافة شبكة مخفية'), a: 'wifiJoin', d: '' })}</div>
<div class="sec">${T('Erweitert', 'Advanced', 'متقدم')}</div><div class="list">${row({ i: 'server', c: '#2A2D35', t: T('Eigener DNS-Server', 'Custom DNS', 'خادم DNS مخصص'), v: '<span class="ltr">' + S.dns + '</span>' })}${row({ i: 'pulse', c: '#2A2D35', t: T('Netzdiagnose', 'Network diagnosis', 'تشخيص الشبكة'), a: 'netDiag' })}</div>` : `<div class="empty">${ic('wifiOff', 30)}<br>${T('WLAN ist aus', 'Wi-Fi is off', 'الواي فاي متوقف')}</div>`}`);
A.tWifi = (v, el, sf) => { S.wifi = !S.wifi; if (S.wifi) S.flight = false; chrome(); R(sf); };
A.wifiScan = (v, el) => { el.innerHTML = '<span class="typing"><i></i><i></i><i></i></span>'; setTimeout(() => R(SF.p), 1200); };
A.wifiJoin = (name) => {
  const d = sheet(`<h2>${name ? esc(name) : T('Verstecktes Netz', 'Hidden network', 'شبكة مخفية')}</h2>${name ? '' : `<div style="margin-bottom:10px">${inp(`id="wname" placeholder="SSID"`)}</div>`}<div style="margin-bottom:14px">${inp(`id="wpass" type="password" placeholder="${T('Passwort', 'Password', 'كلمة المرور')}" data-enter="wifiConn"`)}</div><div class="muted" style="font-size:12px;margin:-6px 2px 12px">${T('Demo: jedes Passwort ab 8 Zeichen funktioniert.', 'Demo: any password with 8+ characters works.', 'عرض: أي كلمة مرور من 8 أحرف تعمل.')}</div><div style="display:flex;gap:10px;justify-content:flex-end"><button class="btn ghost sm" data-a="closeSheet">${T('Abbrechen', 'Cancel', 'إلغاء')}</button><button class="btn sm" data-a="wifiConn" data-v="${esc(name)}">${T('Verbinden', 'Connect', 'اتصال')}</button></div>`);
  setTimeout(() => { const p = $('#wpass', d); p && p.focus(); }, 300);
};
A.wifiConn = (v, el) => { const p = $('#wpass'); const n = $('#wname') ? $('#wname').value : v || $('[data-a=wifiConn][data-v]') && $('[data-a=wifiConn][data-v]').dataset.v; if (!p || p.value.length < 8) { p && p.classList.add('shake'); setTimeout(() => p && p.classList.remove('shake'), 400); toast(T('Mindestens 8 Zeichen', 'At least 8 characters', '8 أحرف على الأقل')); return; } const name = n || 'Netz'; closeLayers(); S.wifiNet = name; S.wifi = true; toast(T(`Verbunden mit ${name}`, `Connected to ${name}`, `متصل بـ ${name}`)); chrome(); R(SF.p); };
A.wifiInfo = () => sheet(`<h2>${esc(S.wifiNet)}</h2><div class="card" style="padding:4px 14px">${[[T('Signal', 'Signal', 'الإشارة'), '-54 dBm'], [T('Frequenz', 'Frequency', 'التردد'), '5,18 GHz'], [T('Sicherheit', 'Security', 'الأمان'), 'WPA2-PSK'], ['IP', '192.168.1.42'], ['Gateway', '192.168.1.1'], ['DNS', S.dns], ['MAC', T('zufällig je Netz', 'randomised per network', 'عشوائي لكل شبكة')]].map(([a, b]) => `<div class="kv"><span>${a}</span><span class="ltr">${b}</span></div>`).join('')}</div><button class="btn ghost wide" style="margin-top:14px" data-a="wifiForget">${T('Netz entfernen', 'Forget network', 'نسيان الشبكة')}</button>`);
A.wifiForget = (v, el) => { A.closeSheet(v, el); S.wifiNet = 'KM-Gast'; toast(T('Entfernt – verbunden mit KM-Gast', 'Forgotten – connected to KM-Gast', 'تم النسيان – متصل بـ KM-Gast')); R(SF.p); };
A.netDiag = () => { const d = sheet(`<h2>${T('Netzdiagnose', 'Network diagnosis', 'تشخيص الشبكة')}</h2><div id="ndg" class="card" style="padding:4px 14px"></div>`); const steps = [[T('WLAN-Verbindung', 'Wi-Fi link', 'اتصال الواي فاي'), '✓ -54 dBm'], ['Gateway', '✓ 3 ms'], ['DNS', '✓ 18 ms'], ['VPN', S.vpn ? '✓ WireGuard 41 ms' : '— ' + T('aus', 'off', 'متوقف')], ['Internet', '✓ 87 / 34 Mbit/s']]; steps.forEach((s, i) => setTimeout(() => { const n = $('#ndg', d); if (n) n.insertAdjacentHTML('beforeend', `<div class="kv"><span>${s[0]}</span><span style="color:var(--ok)" class="ltr">${s[1]}</span></div>`); }, 400 * (i + 1))); };

SET.bt = (sf) => sub(sf, 'Bluetooth', `<div class="list">${tgRow('bt', '#1E3A5F', T('Bluetooth verwenden', 'Use Bluetooth', 'استخدام البلوتوث'), T('Gerätename: Ultar-A30', 'Device name: Ultar-A30', 'اسم الجهاز: Ultar-A30'), S.bt && !S.flight, 'tBt')}</div>
${S.bt && !S.flight ? `${S.btOn.length ? `<div class="sec">${T('Gekoppelt', 'Paired', 'مقترن')}</div><div class="list">${S.btOn.map((n) => row({ i: 'bt', c: '#4A421C', t: n, s: T('Verbunden', 'Connected', 'متصل'), a: 'btDrop', d: n })).join('')}</div>` : ''}
<div class="sec" style="display:flex;justify-content:space-between">${T('Geräte in der Nähe', 'Nearby devices', 'الأجهزة القريبة')}<span class="typing"><i></i><i></i><i></i></span></div><div class="list">${['KM Earbuds', 'Toyota Hilux', 'Galaxy Watch', 'JBL Flip 6'].filter((n) => !S.btOn.includes(n)).map((n) => row({ i: 'bt', c: '#2A2D35', t: n, s: T('Zum Koppeln tippen', 'Tap to pair', 'اضغط للاقتران'), a: 'btPair', d: n })).join('')}</div>` : `<div class="empty">${T('Bluetooth ist aus', 'Bluetooth is off', 'البلوتوث متوقف')}</div>`}`);
A.tBt = (v, el, sf) => { S.bt = !S.bt; if (S.bt) S.flight = false; chrome(); R(sf); };
A.btPair = (n) => { const d = sheet(`<h2>${T('Koppeln', 'Pair', 'اقتران')}: ${esc(n)}</h2><p class="muted" style="font-size:14px">${T('Code auf beiden Geräten prüfen:', 'Check the code on both devices:', 'تحقق من الرمز على الجهازين:')}</p><div class="ltr num" style="font-size:34px;font-weight:700;text-align:center;letter-spacing:.2em;margin:10px 0 18px">${100000 + Math.floor(Math.random() * 899999)}</div><div style="display:flex;gap:10px;justify-content:flex-end"><button class="btn ghost sm" data-a="closeSheet">${T('Abbrechen', 'Cancel', 'إلغاء')}</button><button class="btn sm" data-a="btOk" data-v="${esc(n)}">${T('Koppeln', 'Pair', 'اقتران')}</button></div>`, { mid: true }); };
A.btOk = (n, el) => { A.closeSheet(n, el); S.btOn.push(n); toast(T(`${n} verbunden`, `${n} connected`, `${n} متصل`)); R(SF.p); };
A.btDrop = (n) => { S.btOn = S.btOn.filter((x) => x !== n); R(SF.p); };

const CELLS = [{ id: 'C1', x: 62, y: 70, b: 'B3 · 1800 MHz', rsrp: -84, sinr: 18, sp: 62 }, { id: 'C2', x: 175, y: 88, b: 'n78 · 3500 MHz', rsrp: -97, sinr: 11, sp: 214 }, { id: 'C3', x: 210, y: 190, b: 'B20 · 800 MHz', rsrp: -79, sinr: 21, sp: 38 }, { id: 'C4', x: 74, y: 200, b: 'B7 · 2600 MHz', rsrp: -103, sinr: 6, sp: 95 }];
SET.mobile = (sf) => {
  const c = CELLS.find((x) => x.id === S.cell) || CELLS[0];
  return sub(sf, T('Mobilfunk & SIM', 'Mobile & SIM', 'الشبكة الخلوية والشريحة'), `<div class="grid2" style="margin-bottom:14px">${S.sim.map((s, i) => `<div class="card" style="padding:12px;${S.simData === i ? 'border-color:var(--ac)' : ''}"><div style="display:flex;justify-content:space-between;align-items:center"><b>SIM ${i + 1}</b>${tg(s.on, 'simTog', i)}</div><div style="font-size:15px;margin-top:6px">${s.n}</div><div class="muted ltr" style="font-size:11.5px">${s.num}</div></div>`).join('')}</div>
<div class="list">${row({ i: 'data', c: '#173A24', t: T('Mobile Daten', 'Mobile data', 'بيانات الجوال'), right: tg(S.data, 'tData') })}${row({ i: 'sim', c: '#2A2D35', t: T('SIM für Daten', 'SIM for data', 'شريحة البيانات'), v: S.sim[S.simData].n, a: 'simPick', d: 'data' })}${row({ i: 'phone', c: '#2A2D35', t: T('SIM für Anrufe & SMS', 'SIM for calls & SMS', 'شريحة المكالمات والرسائل'), v: S.sim[S.simCall].n, a: 'simPick', d: 'call' })}${row({ i: 'signal', c: '#2A2D35', t: T('Bevorzugte Technik', 'Preferred network', 'التقنية المفضلة'), v: S.rat, a: 'ratPick' })}${row({ i: 'globe', c: '#2A2D35', t: 'Roaming', right: tg(S.roaming, 'tRoam') })}</div>
<div class="sec">${T('Funkturm-Wahl', 'Cell tower selection', 'اختيار برج الاتصال')}</div>
<div class="tabs" style="margin:0 0 10px">${[['auto', 'Auto'], ['smart', 'Smart'], ['manual', T('Manuell', 'Manual', 'يدوي')]].map(([k, n]) => `<button class="${S.net === k ? 'on' : ''}" data-a="netMode" data-v="${k}">${n}</button>`).join('')}</div>
<div class="muted" style="font-size:12.5px;margin:0 4px 6px;line-height:1.45">${{ auto: T('Auto nimmt das stärkste Signal.', 'Auto picks the strongest signal.', 'تلقائي يختار أقوى إشارة.'), smart: T('Smart nimmt die schnellste Zelle – auch bei schwächerem Signal.', 'Smart picks the fastest cell – even with weaker signal.', 'الذكي يختار أسرع خلية – حتى مع إشارة أضعف.'), manual: T('Tippe im Radar auf eine Zelle.', 'Tap a cell in the radar.', 'اضغط على خلية في الرادار.') }[S.net]}</div>
<div class="radar"><div class="sw"></div><div class="me"></div>${CELLS.map((x) => `<button class="cell ${x.id === S.cell ? 'sel' : ''}" style="left:${x.x + 20}px;top:${x.y + 20}px" data-a="cellPick" data-v="${x.id}" aria-label="${x.id}"></button>`).join('')}</div>
<div class="card" style="padding:4px 14px" id="cellinfo">${cellInfo(c)}</div>`);
};
function cellInfo(c) { const j = () => Math.round((Math.random() - 0.5) * 4); return [[T('Zelle', 'Cell', 'الخلية'), `${c.id} · ${c.b}`], ['RSRP', `${c.rsrp + j()} dBm`], ['SINR', `${c.sinr + j()} dB`], [T('Tempo', 'Speed', 'السرعة'), `${c.sp + j() * 3} Mbit/s`], [T('Weg ins Internet', 'Path to internet', 'المسار إلى الإنترنت'), `${S.sim[S.simData].n} → ${S.vpn ? 'VPN → ' : ''}Internet`]].map(([a, b]) => `<div class="kv"><span>${a}</span><span class="ltr num">${b}</span></div>`).join(''); }
SC.settings.m = (el, sf, arg) => { if (arg === 'mobile') { const t = () => { const n = $('#cellinfo', el); if (n) n.innerHTML = cellInfo(CELLS.find((x) => x.id === S.cell)); }; TICKS.push(t); return () => { TICKS = TICKS.filter((x) => x !== t); }; } if (arg === 'battery') return null; };
A.netMode = (k, el, sf) => { S.net = k; if (k === 'auto') S.cell = 'C3'; if (k === 'smart') S.cell = 'C2'; R(sf); };
A.cellPick = (id, el, sf) => { if (S.net !== 'manual') { S.net = 'manual'; } S.cell = id; R(sf); toast(T(`Verbunden mit Zelle ${id}`, `Connected to cell ${id}`, `متصل بالخلية ${id}`)); };
A.simTog = (i, el, sf) => { S.sim[+i].on = !S.sim[+i].on; chrome(); R(sf); };
A.tData = (v, el, sf) => { S.data = !S.data; chrome(); R(sf); };
A.tRoam = (v, el, sf) => { S.roaming = !S.roaming; R(sf); };
A.simPick = (k) => { const d = sheet(`<h2>${k === 'data' ? T('SIM für Daten', 'SIM for data', 'شريحة البيانات') : T('SIM für Anrufe & SMS', 'SIM for calls & SMS', 'شريحة المكالمات')}</h2><div class="list">${S.sim.map((s, i) => row({ t: `SIM ${i + 1} · ${s.n}`, s: s.num, a: 'simSet', d: k + ':' + i, right: (k === 'data' ? S.simData : S.simCall) === i ? `<span class="gold">${ic('check')}</span>` : '' })).join('')}</div>`); };
A.simSet = (v, el) => { const [k, i] = v.split(':'); if (k === 'data') S.simData = +i; else S.simCall = +i; A.closeSheet(v, el); chrome(); R(SF.p); };
A.ratPick = () => sheet(`<h2>${T('Bevorzugte Technik', 'Preferred network', 'التقنية المفضلة')}</h2><div class="list">${['5G', '4G', '3G', '2G'].map((r) => row({ t: r, a: 'ratSet', d: r, right: S.rat === r ? `<span class="gold">${ic('check')}</span>` : '' })).join('')}</div>`);
A.ratSet = (r, el) => { S.rat = r; A.closeSheet(r, el); chrome(); R(SF.p); };

SET.vpn = (sf) => sub(sf, 'VPN', `<div class="card" style="padding:22px;text-align:center;margin-bottom:14px"><div style="width:84px;height:84px;border-radius:42px;margin:0 auto 12px;display:flex;align-items:center;justify-content:center;background:${S.vpn ? 'color-mix(in srgb,var(--ac) 20%,transparent)' : 'var(--s2)'};color:${S.vpn ? 'var(--ac)' : 'var(--mt)'}">${ic(S.vpn ? 'lock' : 'unlock', 38)}</div><div style="font-size:19px;font-weight:650">${S.vpn ? T('Geschützt', 'Protected', 'محمي') : T('Nicht verbunden', 'Not connected', 'غير متصل')}</div><div class="muted" style="font-size:13px;margin:4px 0 14px">${S.vpn ? T('Gesamter Verkehr über WireGuard → ultraos.code-craft.tech', 'All traffic via WireGuard → ultraos.code-craft.tech', 'كل حركة البيانات عبر WireGuard ← ultraos.code-craft.tech') : T('Dein Verkehr geht direkt ins Netz.', 'Your traffic goes straight out.', 'حركة بياناتك تخرج مباشرة.')}</div><button class="btn ${S.vpn ? 'ghost' : ''}" data-a="vpnTog">${S.vpn ? T('Trennen', 'Disconnect', 'قطع الاتصال') : T('Verbinden', 'Connect', 'اتصال')}</button></div>
<div class="list">${tgRow('shield', '#4A1D1D', T('Killswitch', 'Kill switch', 'قاطع الاتصال'), T('Bricht der Tunnel ab, geht nichts ungeschützt hinaus.', 'If the tunnel drops, nothing leaves unprotected.', 'إذا انقطع النفق لا يخرج شيء دون حماية.'), S.ks, 'tKs')}${row({ i: 'globe', c: '#2A2D35', t: T('Öffentliche IP', 'Public IP', 'العنوان العام'), v: `<span class="ltr">${S.vpn ? '185.12.64.20' : '5.0.113.7'}</span>` })}${row({ i: 'server', c: '#2A2D35', t: T('Interne Adresse', 'Internal address', 'العنوان الداخلي'), v: '<span class="ltr">10.80.12.34</span>' })}${row({ i: 'key', c: '#2A2D35', t: T('Protokoll', 'Protocol', 'البروتوكول'), v: 'WireGuard' })}</div>`);
A.vpnTog = (v, el, sf) => { S.vpn = !S.vpn; chrome(); if (S.vpn) { el.innerHTML = '<span class="typing"><i></i><i></i><i></i></span>'; setTimeout(() => R(sf), 900); } else R(sf); };
A.tKs = (v, el, sf) => { S.ks = !S.ks; R(sf); };

SET.usage = (sf) => { const days = [210, 380, 160, 520, 290, 440, 412]; const mx = 600; return sub(sf, T('Datenverkehr', 'Data usage', 'استهلاك البيانات'), `<div class="card" style="padding:16px;margin-bottom:14px"><div class="muted" style="font-size:12px">${T('Heute', 'Today', 'اليوم')}</div><div style="font-size:28px;font-weight:700" class="num">412 MB</div><div class="muted" style="font-size:13px">↑ 38 MB · ↓ 374 MB</div><div style="display:flex;align-items:flex-end;gap:8px;height:120px;margin-top:14px">${days.map((d, i) => `<div style="flex:1;display:flex;flex-direction:column;align-items:center;gap:4px"><div style="width:100%;height:${(d / mx) * 100}px;border-radius:6px;background:${i === 6 ? 'var(--ac)' : 'var(--s3)'}"></div><span class="muted" style="font-size:10px">${new Intl.DateTimeFormat(LOC(), { weekday: 'narrow' }).format(new Date(Date.now() - (6 - i) * 864e5))}</span></div>`).join('')}</div></div>
<div class="list">${row({ i: 'warn', c: '#4A421C', t: T('Datenlimit mit Warnung', 'Data limit warning', 'تحذير حد البيانات'), v: '10 GB / ' + T('Monat', 'month', 'شهر') })}${row({ i: 'pulse', c: '#2A2D35', t: T('Upload-Wächter', 'Upload guard', 'مراقب الرفع'), s: T('Warnt, wenn eine App heimlich viel sendet', 'Warns when an app sends a lot secretly', 'ينبه عند إرسال تطبيق كمية كبيرة خفية'), right: tg(true, 'noop') })}</div>
<div class="sec">${T('Nach App', 'By app', 'حسب التطبيق')}</div><div class="list">${[['browser', 188], ['telegram', 96], ['youtube', 71], ['store', 42], ['terminal', 15]].map(([a, m]) => row({ t: appName(a), v: m + ' MB', i: APPS[a].i, c: '#2A2D35' })).join('')}</div>`); };

SET.display = (sf) => sub(sf, T('Anzeige', 'Display', 'العرض'), `<div class="card" style="padding:14px;margin-bottom:14px"><div style="display:flex;justify-content:space-between;margin-bottom:8px"><span>${T('Helligkeit', 'Brightness', 'السطوع')}</span><span class="muted num">${S.bright} %</span></div><input type="range" class="range" min="8" max="100" value="${S.bright}" data-in="bright"></div>
<div class="sec">${T('Design', 'Theme', 'المظهر')}</div><div class="grid3" style="margin-bottom:14px">${[['dark', T('Dunkel', 'Dark', 'داكن'), '#0A0B0E'], ['light', T('Hell', 'Light', 'فاتح'), '#F4F2EC'], ['auto', 'Auto', 'linear-gradient(135deg,#F4F2EC 50%,#0A0B0E 50%)']].map(([k, n, bg]) => `<button class="card" data-a="setTheme" data-v="${k}" style="padding:10px;display:flex;flex-direction:column;align-items:center;gap:8px;${(S.theme === k) ? 'border-color:var(--ac)' : ''}"><span style="width:100%;height:70px;border-radius:12px;background:${bg};border:1px solid var(--ln)"></span><span style="font-size:13px">${n}</span></button>`).join('')}</div>
<div class="sec">${T('Akzentfarbe', 'Accent colour', 'لون التمييز')}</div><div style="display:flex;gap:12px;margin:4px 4px 16px">${['#D8C870', '#F0F090', '#B08838', '#F80000', '#5B8DEF', '#4ADE80'].map((c) => `<button data-a="setAcc" data-v="${c}" aria-label="${c}" style="width:40px;height:40px;border-radius:20px;border:${S.accent === c ? '3px solid var(--tx)' : '1px solid var(--ln)'};background:${c}"></button>`).join('')}</div>
<div class="list">${tgRow('night', '#5A3A1C', T('Nachtlicht', 'Night light', 'الإضاءة الليلية'), T('Wärmere Farben ab 21:00', 'Warmer colours from 21:00', 'ألوان أدفأ من 21:00'), S.night, 'tNight')}${tgRow('sun', '#2A2D35', T('Automatische Helligkeit', 'Adaptive brightness', 'سطوع تلقائي'), '', S.autoBright, 'tAutoB')}${tgRow('type', '#2A2D35', T('Große Schrift', 'Large text', 'خط كبير'), '', S.big, 'tBig')}${tgRow('eye', '#2A2D35', T('Hoher Kontrast', 'High contrast', 'تباين عالٍ'), '', S.contrast, 'tContrast')}${tgRow('rotate', '#2A2D35', T('Automatisch drehen', 'Auto-rotate', 'تدوير تلقائي'), '', S.rotate, 'tRotate')}${row({ i: 'img', c: '#2A2D35', t: T('Hintergrundbild', 'Wallpaper', 'الخلفية'), s: T('In der Galerie ein Foto öffnen → Hintergrund', 'Open a photo in the gallery → wallpaper', 'افتح صورة في المعرض ← خلفية'), a: 'open', d: 'gallery' })}</div>`);
IN.bright = (v) => { S.bright = +v; chrome(); const s = $('#pv .card .muted.num'); if (s) s.textContent = v + ' %'; };
A.setTheme = (k, el, sf) => { S.theme = k === 'auto' ? (new Date().getHours() >= 19 || new Date().getHours() < 7 ? 'dark' : 'light') : k; RA(); };
A.setAcc = (c) => { S.accent = c; RA(); };
A.tNight = (v, el, sf) => { S.night = !S.night; chrome(); R(sf); };
A.tAutoB = (v, el, sf) => { S.autoBright = !S.autoBright; R(sf); };
A.tBig = (v, el, sf) => { S.big = !S.big; RA(); };
A.tContrast = (v, el, sf) => { S.contrast = !S.contrast; $('#screen').style.filter = S.contrast ? 'contrast(1.25)' : ''; R(sf); };
A.tRotate = (v, el, sf) => { S.rotate = !S.rotate; R(sf); };

SET.sound = (sf) => sub(sf, T('Töne & Ruhe', 'Sounds & quiet', 'الأصوات والهدوء'), `<div class="tabs" style="margin:0 0 14px">${[['normal', T('Ton', 'Sound', 'صوت')], ['vibrate', T('Vibration', 'Vibrate', 'اهتزاز')], ['silent', T('Lautlos', 'Silent', 'صامت')]].map(([k, n]) => `<button class="${S.profile === k ? 'on' : ''}" data-a="setProf" data-v="${k}">${n}</button>`).join('')}</div>
<div class="card" style="padding:14px;margin-bottom:14px">${[['media', T('Medien', 'Media', 'الوسائط')], ['ring', T('Klingelton', 'Ringtone', 'النغمة')], ['alarm', T('Wecker', 'Alarm', 'المنبه')]].map(([k, n]) => `<div style="margin:6px 0 12px"><div style="display:flex;justify-content:space-between;font-size:14px"><span>${n}</span><span class="muted num">${S.vol[k]}</span></div><input type="range" class="range" min="0" max="100" value="${S.vol[k]}" data-in="vol" data-v="${k}"></div>`).join('')}<button class="btn sm dark" data-a="testTone">${ic('play', 16)} ${T('Testton', 'Test tone', 'نغمة اختبار')}</button></div>
<div class="list">${tgRow('moon', '#2A2D35', T('Nicht stören', 'Do not disturb', 'عدم الإزعاج'), T('Zeitplan 22:00–07:00', 'Schedule 22:00–07:00', 'جدول 22:00–07:00'), S.dnd, 'tDnd')}${tgRow('bell', '#2A2D35', T('Stündliches Zeitsignal', 'Hourly chime', 'تنبيه كل ساعة'), '', S.chime, 'tChime')}${row({ i: 'phoneOff', c: '#2A2D35', t: T('Sperrliste für Anrufer', 'Blocked callers', 'قائمة الحظر'), v: '2' })}${row({ i: 'hand', c: '#2A2D35', t: T('Taschen-Schutz', 'Pocket protection', 'حماية الجيب'), right: tg(true, 'noop') })}</div>`);
IN.vol = (v, el) => { S.vol[el.dataset.v] = +v; const s = el.previousElementSibling && el.previousElementSibling.querySelector('.num'); if (s) s.textContent = v; };
A.setProf = (k, el, sf) => { S.profile = k; S.sound = k === 'normal'; chrome(); R(sf); if (k === 'vibrate') vib(); };
A.testTone = () => { const o = S.sound; S.sound = true; const p = S.profile; S.profile = 'normal'; beep([880, 1175, 1568], 0.18, 0.12); S.sound = o; S.profile = p; };
A.tDnd = (v, el, sf) => { S.dnd = !S.dnd; chrome(); R(sf); };
A.tChime = (v, el, sf) => { S.chime = !S.chime; R(sf); };

SET.battery = (sf) => { const hist = Array.from({ length: 24 }, (_, i) => clamp(100 - i * 2.2 + (i > 15 ? 30 : 0) + Math.sin(i) * 3, 5, 100)); return sub(sf, T('Akku & Energie', 'Battery & power', 'البطارية والطاقة'), `<div class="card" style="padding:16px;margin-bottom:14px"><div style="display:flex;align-items:baseline;gap:10px"><span style="font-size:44px;font-weight:800" class="num">${Math.round(S.battery)} %</span><span class="muted">${S.charging ? T('lädt', 'charging', 'يشحن') : T(`≈ ${Math.round(S.battery / 6)} Std. übrig`, `≈ ${Math.round(S.battery / 6)} h left`, `≈ ${Math.round(S.battery / 6)} ساعة متبقية`)}</span></div>
<div class="muted" style="font-size:12px;margin:12px 0 6px">${T('Letzte 24 Stunden', 'Last 24 hours', 'آخر 24 ساعة')}</div><div style="display:flex;align-items:flex-end;gap:3px;height:90px">${hist.map((h) => `<i style="flex:1;height:${h}%;border-radius:3px;background:${h < 20 ? 'var(--bad)' : 'color-mix(in srgb,var(--ok) 70%,transparent)'}"></i>`).join('')}</div></div>
<div class="list">${tgRow('bolt', '#173A24', T('Ladegerät simulieren', 'Simulate charger', 'محاكاة الشاحن'), '', S.charging, 'tChg')}${tgRow('leaf', '#173A24', T('Energiesparmodus', 'Battery saver', 'توفير الطاقة'), T(`automatisch ab ${S.saverAt} %`, `automatically below ${S.saverAt}%`, `تلقائياً تحت ${S.saverAt}%`), S.saver, 'tSaver')}${tgRow('heart', '#2A2D35', T('Akkuschonung', 'Battery care', 'حماية البطارية'), T('Hinweis bei 80 %', 'Notify at 80%', 'تنبيه عند 80%'), S.care80, 'tCare')}${row({ i: 'chip', c: '#2A2D35', t: T('Leistungsprofil', 'Performance profile', 'ملف الأداء'), v: { eco: 'Eco', balanced: T('Ausgewogen', 'Balanced', 'متوازن'), perf: T('Leistung', 'Performance', 'أداء') }[S.perf], a: 'perfPick' })}${row({ i: 'warn', c: '#2A2D35', t: T('Hitzewarnung', 'Heat warning', 'تحذير الحرارة'), v: '34 °C' })}</div>`); };
A.tChg = (v, el, sf) => { S.charging = !S.charging; chrome(); R(sf); };
A.tSaver = (v, el, sf) => { S.saver = !S.saver; R(sf); };
A.tCare = (v, el, sf) => { S.care80 = !S.care80; R(sf); };
A.perfPick = () => sheet(`<h2>${T('Leistungsprofil', 'Performance profile', 'ملف الأداء')}</h2><div class="list">${[['eco', 'Eco'], ['balanced', T('Ausgewogen', 'Balanced', 'متوازن')], ['perf', T('Leistung', 'Performance', 'أداء')]].map(([k, n]) => row({ t: n, a: 'perfSet', d: k, right: S.perf === k ? `<span class="gold">${ic('check')}</span>` : '' })).join('')}</div>`);
A.perfSet = (k, el) => { S.perf = k; A.closeSheet(k, el); R(SF.p); };

SET.storage = (sf) => { const seg = [[T('System', 'System', 'النظام'), 2.1, '#D8C870'], ['Ubuntu', 6.2, '#E95420'], [T('Apps', 'Apps', 'التطبيقات'), 3.4, '#5B8DEF'], [T('Bilder', 'Images', 'الصور'), 4.8, '#4ADE80'], [T('Andere', 'Other', 'أخرى'), 1.9, '#A6A6AE']]; return sub(sf, T('Speicher', 'Storage', 'التخزين'), `<div class="card" style="padding:16px;margin-bottom:14px"><div style="font-size:28px;font-weight:700" class="num">18,4 GB <span class="muted" style="font-size:15px;font-weight:400">/ 64 GB</span></div><div style="display:flex;height:14px;border-radius:7px;overflow:hidden;margin:12px 0;gap:2px">${seg.map((s) => `<i style="width:${(s[1] / 64) * 100}%;background:${s[2]}"></i>`).join('')}<i style="flex:1;background:var(--s3)"></i></div>${seg.map((s) => `<div class="kv"><span style="display:flex;gap:8px;align-items:center"><i style="width:10px;height:10px;border-radius:3px;background:${s[2]}"></i>${s[0]}</span><span class="num">${String(s[1]).replace('.', S.lang === 'en' ? '.' : ',')} GB</span></div>`).join('')}</div><button class="btn wide" data-a="anaStore">${ic('search', 18)} ${T('Speicher analysieren', 'Analyse storage', 'تحليل التخزين')}</button>`); };
A.anaStore = () => sheet(`<h2>${T('Analyse', 'Analysis', 'التحليل')}</h2><div class="list">${row({ i: 'copy', c: '#2A2D35', t: T('Doppelte Fotos', 'Duplicate photos', 'صور مكررة'), v: '6 · 41 MB', right: `<button class="btn sm" data-a="cleanDone">${T('Löschen', 'Delete', 'حذف')}</button>` })}${row({ i: 'dl', c: '#2A2D35', t: T('Alte Downloads', 'Old downloads', 'تنزيلات قديمة'), v: '2 · 24 MB', right: `<button class="btn sm" data-a="cleanDone">${T('Löschen', 'Delete', 'حذف')}</button>` })}${row({ i: 'layers', c: '#2A2D35', t: 'Cache', v: '312 MB', right: `<button class="btn sm" data-a="cleanDone">${T('Leeren', 'Clear', 'مسح')}</button>` })}</div>`);
A.cleanDone = (v, el) => { el.outerHTML = `<span class="gold">${ic('check')}</span>`; };

SET.care = (sf) => sub(sf, T('Gerätepflege', 'Device care', 'العناية بالجهاز'), `<div class="ring-score" id="score" style="background:conic-gradient(var(--ok) ${S.careScore || 92}%,var(--s3) 0)"><div style="width:146px;height:146px;border-radius:50%;background:var(--bg);display:flex;flex-direction:column;align-items:center;justify-content:center"><span style="font-size:44px;font-weight:800" class="num" id="scv">${S.careScore || 92}</span><span class="muted" style="font-size:12px">${T('Zustand', 'Health', 'الحالة')}</span></div></div>
<button class="btn wide" data-a="careRun" style="margin:8px 0 16px">${T('Jetzt optimieren', 'Optimise now', 'تحسين الآن')}</button><div class="list" id="carelist">${[['bat', T('Akku', 'Battery', 'البطارية'), T('gut', 'good', 'جيد')], ['drive', T('Speicher', 'Storage', 'التخزين'), '29 %'], ['chip', 'RAM', '65 MB ' + T('Oberfläche', 'interface', 'الواجهة')], ['shieldOk', T('Sicherheit', 'Security', 'الأمان'), T('keine Funde', 'no issues', 'لا مشاكل')], ['svc', T('Dienste', 'Services', 'الخدمات'), T('alle laufen', 'all running', 'كلها تعمل')]].map(([i, t, v]) => row({ i, c: '#173A24', t, v })).join('')}</div>`);
A.careRun = (v, el) => { el.disabled = true; el.innerHTML = '<span class="typing"><i></i><i></i><i></i></span>'; let s = S.careScore || 92; const iv = setInterval(() => { s++; const n = $('#scv'); if (n) { n.textContent = s; $('#score').style.background = `conic-gradient(var(--ok) ${s}%,var(--s3) 0)`; } if (s >= 98) { clearInterval(iv); S.careScore = 98; el.disabled = false; el.textContent = T('Optimiert ✓', 'Optimised ✓', 'تم التحسين ✓'); } }, 160); };

SET.security = (sf) => sub(sf, T('Sicherheit & Sperre', 'Security & lock', 'الأمان والقفل'), `<div class="list">${row({ i: 'lock', c: '#4A1D1D', t: T('Bildschirmsperre', 'Screen lock', 'قفل الشاشة'), s: T('PIN · Sperre nach 5 Fehlversuchen', 'PIN · locks after 5 failed attempts', 'رمز · قفل بعد 5 محاولات خاطئة'), a: 'pinChange' })}${row({ i: 'fp', c: '#4A1D1D', t: T('Fingerabdruck', 'Fingerprint', 'بصمة الإصبع'), s: S.fp ? T('1 Finger eingerichtet', '1 finger enrolled', 'إصبع واحد مسجل') : T('Nicht eingerichtet', 'Not set up', 'غير مضبوط'), a: 'fpEnroll' })}${row({ i: 'face', c: '#4A1D1D', t: T('Gesichtserkennung', 'Face unlock', 'التعرف على الوجه'), s: T('rechnet offline auf dem Gerät', 'computed offline on the device', 'تعمل دون إنترنت على الجهاز'), right: tg(S.face, 'tFace') })}${row({ i: 'lock', c: '#2A2D35', t: T('Jetzt sperren', 'Lock now', 'اقفل الآن'), a: 'lockNowA' })}</div>
<div class="sec">${T('Systemschutz', 'System protection', 'حماية النظام')}</div><div class="list">${row({ i: 'shieldOk', c: '#173A24', t: T('Geräteverschlüsselung', 'Device encryption', 'تشفير الجهاز'), s: 'LUKS2 · AES-XTS 512 · Argon2id', v: T('An', 'On', 'يعمل'), gold: true })}${row({ i: 'check', c: '#173A24', t: T('Verifizierter Start', 'Verified boot', 'إقلاع موثّق'), s: T('Prüfsumme beim letzten Start: gültig', 'Checksum at last boot: valid', 'المجموع عند آخر إقلاع: صالح'), v: '✓' })}${row({ i: 'key', c: '#173A24', t: T('App-Signaturen', 'App signatures', 'توقيعات التطبيقات'), s: 'Ed25519 · ' + T('nur vertrauenswürdige Herausgeber', 'trusted publishers only', 'ناشرون موثوقون فقط'), v: '✓' })}${row({ i: 'link', c: '#2A2D35', t: T('Link-Prüfung', 'Link check', 'فحص الروابط'), right: tg(S.linkcheck, 'tLinkc') })}</div>`);
A.lockNowA = () => lockNow();
A.tFace = (v, el, sf) => { if (!S.face) { const d = sheet(`<h2>${T('Gesicht einrichten', 'Set up face', 'إعداد الوجه')}</h2><div class="center" style="flex-direction:column;gap:12px;padding:16px"><div style="width:150px;height:150px;border-radius:50%;border:3px dashed var(--ac);display:flex;align-items:center;justify-content:center;color:var(--ac);animation:kmc-spin 4s linear infinite">${ic('face', 64, 1.4)}</div><div class="muted" id="fmsg" style="font-size:14px">${T('Kopf langsam im Kreis bewegen …', 'Move your head slowly in a circle …', 'حرك رأسك ببطء في دائرة …')}</div></div>`); setTimeout(() => { const m = $('#fmsg', d); if (m) m.textContent = T('Fertig ✓ – alles bleibt auf dem Gerät.', 'Done ✓ – everything stays on the device.', 'تم ✓ – كل شيء يبقى على الجهاز.'); S.face = true; R(sf); }, 2200); } else { S.face = false; R(sf); } };
A.tLinkc = (v, el, sf) => { S.linkcheck = !S.linkcheck; R(sf); };
A.pinChange = () => { const d = sheet(`<h2>${T('PIN ändern', 'Change PIN', 'تغيير الرمز')}</h2><div style="margin-bottom:10px">${inp(`id="pin1" placeholder="${T('Neue PIN (4 Ziffern)', 'New PIN (4 digits)', 'رمز جديد (4 أرقام)')}" maxlength="4"`)}</div><div style="display:flex;gap:10px;justify-content:flex-end"><button class="btn ghost sm" data-a="closeSheet">${T('Abbrechen', 'Cancel', 'إلغاء')}</button><button class="btn sm" data-a="pinSave">${T('Speichern', 'Save', 'حفظ')}</button></div>`, { mid: true }); setTimeout(() => $('#pin1', d).focus(), 200); };
A.pinSave = (v, el) => { const p = $('#pin1').value.trim(); if (!/^\d{4}$/.test(p)) { toast(T('Bitte 4 Ziffern', 'Please 4 digits', 'أدخل 4 أرقام')); return; } S.pin = p; A.closeSheet(v, el); toast(T('PIN gespeichert', 'PIN saved', 'تم حفظ الرمز')); };
A.fpEnroll = () => { const d = sheet(`<h2>${T('Fingerabdruck einrichten', 'Set up fingerprint', 'إعداد البصمة')}</h2><div class="center" style="flex-direction:column;gap:14px;padding:12px"><button class="fp" id="fpe" style="width:110px;height:110px;border-radius:55px" data-a="fpTouch">${ic('fp', 56, 1.3)}</button><div class="bar" style="width:200px"><i id="fpp" style="width:0"></i></div><div class="muted" id="fpm" style="font-size:14px">${T('Tippe mehrmals auf den Sensor', 'Tap the sensor several times', 'اضغط على المستشعر عدة مرات')}</div></div>`); d.dataset.n = 0; };
A.fpTouch = (v, el) => { const d = el.closest('.scrim'); let n = +d.dataset.n + 1; d.dataset.n = n; el.classList.add('scan'); setTimeout(() => el.classList.remove('scan'), 400); vib(); $('#fpp').style.width = Math.min(100, n * 20) + '%'; if (n >= 5) { $('#fpm').textContent = T('Fingerabdruck gespeichert ✓', 'Fingerprint saved ✓', 'تم حفظ البصمة ✓'); S.fp = true; setTimeout(() => { d.remove(); R(SF.p); }, 900); } };

SET.helper = (sf) => sub(sf, appName('helper'), `<div class="card center" style="padding:16px;flex-direction:column;gap:6px;margin-bottom:14px"><div style="width:110px;height:120px">${figure(S.helper ? 'hello' : 'sleep', 100)}</div><div style="font-weight:650">${S.helper ? T('Bereit', 'Ready', 'جاهز') : T('Schläft', 'Sleeping', 'نائم')}</div><button class="btn sm" data-a="hlpOpen2">${ic('sparkle', 16)} ${T('Mit dem Helfer sprechen', 'Talk to the helper', 'تحدث مع المساعد')}</button></div>
<div class="list">${tgRow('sparkle', '#4A421C', T('Helfer anzeigen', 'Show helper', 'إظهار المساعد'), T('Figur über allen Apps', 'Character above all apps', 'شخصية فوق كل التطبيقات'), S.helper, 'qHelperS')}${tgRow('mic', '#4A421C', T('Weckwort „Hey KM“', 'Wake word "Hey KM"', 'كلمة التنبيه «هاي KM»'), T('auch bei gesperrtem Bildschirm mit geheimem Wort', 'also when locked, with secret word', 'حتى مع القفل بكلمة سرية'), S.wake, 'tWake')}${row({ i: 'user', c: '#4A421C', t: T('Meine Stimme', 'My voice', 'صوتي'), s: S.voice ? T('Gelernt – andere Sprecher werden abgewiesen', 'Learned – other speakers are rejected', 'تم التعلم – يُرفض المتحدثون الآخرون') : T('Noch nicht gelernt', 'Not learned yet', 'لم يتم التعلم بعد'), a: 'voiceLearn' })}${row({ i: 'key', c: '#4A421C', t: T('Geheimes Wort', 'Secret word', 'الكلمة السرية'), v: S.secret ? '••••' : '—', a: 'secretSet' })}${row({ i: 'chip', c: '#2A2D35', t: T('Sprachmodell', 'Language model', 'النموذج اللغوي'), v: S.model === 'local' ? T('Lokal (Qwen3 1.7B)', 'Local (Qwen3 1.7B)', 'محلي (Qwen3 1.7B)') : 'Claude (Online)', a: 'modelPick' })}</div>
<div class="muted" style="font-size:12.5px;line-height:1.5;padding:0 6px">${T('Lokal: nichts verlässt das Gerät. Ist die Stimme verändert (z. B. krank), fragt der Helfer nach Fingerabdruck oder Gesicht.', 'Local: nothing leaves the device. If your voice changes (e.g. ill), the helper asks for fingerprint or face.', 'محلي: لا شيء يغادر الجهاز. إذا تغير صوتك (مثلاً مرض) يطلب المساعد البصمة أو الوجه.')}</div>`);
A.hlpOpen2 = () => HLP.openChat();
A.qHelperS = (v, el, sf) => { S.helper = !S.helper; HLP.place(); R(sf); };
A.tWake = (v, el, sf) => { S.wake = !S.wake; R(sf); };
A.voiceLearn = () => { const d = sheet(`<h2>${T('Stimme lernen', 'Learn voice', 'تعلم الصوت')}</h2><p class="muted" style="font-size:14px">${T('Lies diesen Satz laut vor:', 'Read this sentence aloud:', 'اقرأ هذه الجملة بصوت عالٍ:')}</p><div class="card" style="padding:14px;font-size:17px;line-height:1.5;margin-bottom:14px">${T('„Hey KM, das ist meine Stimme. Nur ich darf dich wecken.“', '"Hey KM, this is my voice. Only I may wake you."', '«هاي KM، هذا صوتي. أنا فقط من يوقظك.»')}</div><div class="center" style="gap:4px;height:40px" id="vwave">${Array.from({ length: 24 }, (_, i) => `<i style="width:4px;border-radius:2px;background:var(--ac);height:${8 + Math.random() * 28}px;animation:kmc-eq ${0.5 + Math.random() * 0.5}s ${i * 0.03}s ease-in-out infinite;transform-origin:center"></i>`).join('')}</div><div class="muted center" id="vmsg" style="margin-top:10px;font-size:13px">${T('Aufnahme läuft … (Demo)', 'Recording … (demo)', 'جارٍ التسجيل … (عرض)')}</div>`); setTimeout(() => { const m = $('#vmsg', d); if (m) { m.textContent = T('Stimme gespeichert ✓ Tonlage, Dialekt, Tempo', 'Voice saved ✓ pitch, dialect, pace', 'تم حفظ الصوت ✓ النبرة واللهجة والسرعة'); $('#vwave', d).style.opacity = '.3'; } S.voice = true; R(SF.p); }, 2600); };
A.secretSet = () => { const d = sheet(`<h2>${T('Geheimes Wort', 'Secret word', 'الكلمة السرية')}</h2><p class="muted" style="font-size:13.5px">${T('Damit spricht der Helfer auch bei gesperrtem Bildschirm mit dir.', 'Lets the helper talk to you even when locked.', 'يسمح للمساعد بالتحدث معك حتى مع القفل.')}</p><div style="margin-bottom:12px">${inp(`id="sec1" type="password" placeholder="${T('Wort', 'Word', 'الكلمة')}"`)}</div><button class="btn wide" data-a="secretSave">${T('Speichern', 'Save', 'حفظ')}</button>`, { mid: true }); setTimeout(() => $('#sec1', d).focus(), 200); };
A.secretSave = (v, el) => { S.secret = $('#sec1').value || 'x'; A.closeSheet(v, el); R(SF.p); };
A.modelPick = () => sheet(`<h2>${T('Sprachmodell', 'Language model', 'النموذج اللغوي')}</h2><div class="list">${row({ t: T('Lokal · Qwen3 1.7B', 'Local · Qwen3 1.7B', 'محلي · Qwen3 1.7B'), s: T('offline, nichts verlässt das Gerät', 'offline, nothing leaves the device', 'دون إنترنت، لا شيء يغادر الجهاز'), a: 'modelSet', d: 'local', right: S.model === 'local' ? `<span class="gold">${ic('check')}</span>` : '' })}${row({ t: 'Claude (Anthropic)', s: T('online, API-Schlüssel nötig', 'online, API key required', 'عبر الإنترنت، يتطلب مفتاح API'), a: 'modelSet', d: 'claude', right: S.model === 'claude' ? `<span class="gold">${ic('check')}</span>` : '' })}</div>`);
A.modelSet = (k, el) => { S.model = k; A.closeSheet(k, el); R(SF.p); };

SET.apps = (sf) => sub(sf, T('Apps', 'Apps', 'التطبيقات'), `<div class="sec">${T('Installiert', 'Installed', 'مثبتة')}</div><div class="list">${S.installed.map((id) => row({ i: APPS[id].i, c: '#4A421C', t: appName(id), s: T('Signiert · KM Code Craft', 'Signed · KM Code Craft', 'موقّع · KM Code Craft'), right: `<button class="btn sm ghost" data-a="unin" data-v="${id}">${T('Entfernen', 'Remove', 'إزالة')}</button>` })).join('') || `<div class="empty">—</div>`}</div><div class="sec">${T('Eingebaut', 'Built in', 'مدمجة')}</div><div class="list">${[...DOCK, ...HOME_GRID].map((id) => row({ i: APPS[id].i, c: '#2A2D35', t: appName(id), v: T('System', 'System', 'النظام') })).join('')}</div>`);
A.unin = (id) => uninstall(id);

SET.ubuntu = (sf) => sub(sf, T('Ubuntu-Bereich', 'Ubuntu area', 'منطقة أوبونتو'), `<div class="card" style="padding:16px;margin-bottom:14px;display:flex;gap:14px;align-items:center"><span style="width:52px;height:52px;border-radius:16px;background:#E95420;display:flex;align-items:center;justify-content:center;color:#fff">${ic('ubuntu', 30)}</span><div><b>Ubuntu 24.04 LTS</b><div class="muted" style="font-size:13px">${T('läuft abgeschottet auf demselben Kernel – keine VM', 'runs isolated on the same kernel – no VM', 'يعمل معزولاً على النواة نفسها – دون آلة افتراضية')}</div></div></div>
<div class="list">${row({ i: 'box', c: '#2A2D35', t: T('Installierte Pakete', 'Installed packages', 'الحزم المثبتة'), v: '412' })}${row({ i: 'drive', c: '#2A2D35', t: T('Belegt', 'Used', 'المستخدم'), v: '6,2 GB' })}${row({ i: 'term', c: '#2A2D35', t: T('Terminal öffnen', 'Open terminal', 'افتح الطرفية'), a: 'open', d: 'terminal' })}${row({ i: 'desk', c: '#2A2D35', t: T('Grafische Programme im Desktop', 'Graphical apps in desktop', 'برامج رسومية في سطح المكتب'), a: 'deskOn' })}${row({ i: 'dl', c: '#2A2D35', t: T('.deb offline installieren (USB)', 'Install .deb offline (USB)', 'تثبيت .deb دون إنترنت (USB)'), a: 'debUsb' })}</div>`);
A.deskOn = () => setDesktop(true);
A.debUsb = () => { const d = sheet(`<h2>USB</h2><div class="list">${row({ i: 'file', c: '#2A2D35', t: 'kmpos-server_2.4_arm64.deb', s: '6,1 MB', right: `<button class="btn sm" data-a="debInst">${T('Installieren', 'Install', 'تثبيت')}</button>` })}</div>`); };
A.debInst = (v, el) => { el.outerHTML = '<span class="typing"><i></i><i></i><i></i></span>'; setTimeout(() => { closeLayers(); toast(T('Installiert über dpkg (offline)', 'Installed via dpkg (offline)', 'تم التثبيت عبر dpkg دون إنترنت')); }, 1400); };

SET.lang = (sf) => sub(sf, T('Sprache & Region', 'Language & region', 'اللغة والمنطقة'), `<div class="list">${[['ar', 'العربية', T('Rechts nach links', 'Right to left', 'من اليمين لليسار')], ['de', 'Deutsch', ''], ['en', 'English', '']].map(([k, n, s]) => row({ t: n, s, a: 'langSet', d: k, right: S.lang === k ? `<span class="gold">${ic('check')}</span>` : '' })).join('')}</div>
<div class="list">${row({ i: 'calc', c: '#2A2D35', t: T('Ziffern', 'Digits', 'الأرقام'), v: '0–9' })}${row({ i: 'clock', c: '#2A2D35', t: T('24-Stunden-Format', '24-hour format', 'نظام 24 ساعة'), right: tg(true, 'noop') })}${row({ i: 'cal', c: '#2A2D35', t: T('Hijri-Datum anzeigen', 'Show Hijri date', 'إظهار التاريخ الهجري'), right: tg(true, 'noop') })}${row({ i: 'kbd', c: '#2A2D35', t: T('Tastatur', 'Keyboard', 'لوحة المفاتيح'), s: T('Arabisch (Gboard-Belegung), Deutsch, Englisch · Zwischenablage mit Verlauf', 'Arabic (Gboard layout), German, English · clipboard history', 'العربية (تخطيط Gboard) والألمانية والإنجليزية · حافظة مع سجل') })}</div>`);
A.langSet = (k) => setLang(k);

SET.datetime = (sf) => sub(sf, T('Datum & Uhrzeit', 'Date & time', 'التاريخ والوقت'), `<div class="card" style="padding:16px;margin-bottom:14px;text-align:center"><div class="num" style="font-size:40px;font-weight:800" data-clock>${fmtTime()}</div><div class="muted">${fmtDate()} · ${hijri()}</div></div><div class="list">${row({ i: 'globe', c: '#2A2D35', t: T('Zeitabgleich übers Netz', 'Network time sync', 'مزامنة الوقت عبر الشبكة'), right: tg(true, 'noop') })}${row({ i: 'loc', c: '#2A2D35', t: T('Zeitzone', 'Time zone', 'المنطقة الزمنية'), v: Intl.DateTimeFormat().resolvedOptions().timeZone })}${row({ i: 'sun', c: '#2A2D35', t: T('Sommerzeit automatisch', 'Automatic DST', 'التوقيت الصيفي تلقائياً'), right: tg(true, 'noop') })}${row({ i: 'globe', c: '#2A2D35', t: T('Weltuhr', 'World clock', 'الساعة العالمية'), a: 'open', d: 'clock' })}</div>`);

SET.backup = (sf) => sub(sf, T('Sicherung', 'Backup', 'النسخ الاحتياطي'), `<div class="card" style="padding:16px;margin-bottom:14px"><b>${T('Letzte Sicherung', 'Last backup', 'آخر نسخة')}</b><div class="muted" style="font-size:13px">${ago(S.backup.last)} · ${T('verschlüsselt', 'encrypted', 'مشفرة')}</div>${S.backup.st === 'run' ? `<div class="bar" style="margin-top:12px"><i style="width:${S.backup.p}%"></i></div>` : ''}<button class="btn wide" style="margin-top:14px" data-a="backupRun" ${S.backup.st === 'run' ? 'disabled' : ''}>${S.backup.st === 'run' ? S.backup.p + ' %' : T('Jetzt sichern', 'Back up now', 'انسخ الآن')}</button></div><div class="list">${[['note', T('Notizen & Kontakte', 'Notes & contacts', 'الملاحظات وجهات الاتصال')], ['img', T('Fotos', 'Photos', 'الصور')], ['gear', T('Einstellungen', 'Settings', 'الإعدادات')], ['apps', T('Apps & Daten', 'Apps & data', 'التطبيقات والبيانات')]].map(([i, t]) => row({ i, c: '#1E3A5F', t, right: tg(true, 'noop') })).join('')}${row({ i: 'drive', c: '#2A2D35', t: T('Ziel', 'Destination', 'الوجهة'), v: T('USB-Stick / Ultar-Cloud', 'USB stick / Ultar cloud', 'ذاكرة USB / سحابة Ultar') })}</div>`);
A.backupRun = () => { S.backup.st = 'run'; S.backup.p = 0; const iv = setInterval(() => { S.backup.p += 10; if (S.backup.p >= 100) { clearInterval(iv); S.backup = { st: 'idle', p: 0, last: Date.now() }; notify({ app: 'settings', title: T('Sicherung fertig', 'Backup complete', 'اكتمل النسخ'), body: '1,2 GB · ' + T('verschlüsselt', 'encrypted', 'مشفرة') }); } if (cur(SF.p) === 'settings:backup') R(SF.p); }, 300); R(SF.p); };

SET.update = (sf) => { const u = S.update; return sub(sf, T('System-Update', 'System update', 'تحديث النظام'), `<div class="card center" style="padding:20px;flex-direction:column;gap:8px;margin-bottom:14px;text-align:center"><span style="color:var(--ac)">${ic('upd', 44, 1.5)}</span><b style="font-size:18px">${{ idle: T('Ultar OS 0.6.0 ist aktuell', 'Ultar OS 0.6.0 is up to date', 'Ultar OS 0.6.0 محدث'), check: T('Suche nach Updates …', 'Checking for updates …', 'جارٍ البحث عن تحديثات …'), found: T('Ultar OS 0.6.1 verfügbar', 'Ultar OS 0.6.1 available', 'Ultar OS 0.6.1 متاح'), dl: T('Wird geladen und geprüft …', 'Downloading and verifying …', 'جارٍ التنزيل والتحقق …'), ready: T('Bereit zum Neustart', 'Ready to restart', 'جاهز لإعادة التشغيل') }[u.st]}</b>
${u.st === 'found' ? `<div class="muted" style="font-size:13px;line-height:1.5;text-align:start">• ${T('Kamera: schnellerer Sucher', 'Camera: faster viewfinder', 'الكاميرا: معاينة أسرع')}<br>• ${T('Helfer: neue Gesten', 'Helper: new gestures', 'المساعد: إيماءات جديدة')}<br>• ${T('Sicherheitskorrekturen', 'Security fixes', 'إصلاحات أمنية')} · 18,4 MB</div>` : ''}${u.st === 'dl' ? `<div class="bar" style="width:100%"><i style="width:${u.p}%"></i></div><div class="muted" style="font-size:12px">${u.p < 80 ? T('Laden', 'Downloading', 'تنزيل') : T('Signatur prüfen (Ed25519) …', 'Verifying signature (Ed25519) …', 'التحقق من التوقيع (Ed25519) …')}</div>` : ''}
<button class="btn" data-a="updStep" ${u.st === 'check' || u.st === 'dl' ? 'disabled' : ''}>${{ idle: T('Nach Updates suchen', 'Check for updates', 'البحث عن تحديثات'), check: '…', found: T('Herunterladen', 'Download', 'تنزيل'), dl: u.p + ' %', ready: T('Jetzt neu starten', 'Restart now', 'أعد التشغيل الآن') }[u.st]}</button></div>
<div class="list">${row({ i: 'layers', c: '#2A2D35', t: T('Kanal', 'Channel', 'القناة'), v: u.ch === 'stable' ? T('Stabil', 'Stable', 'مستقر') : 'Beta', a: 'updCh' })}${row({ i: 'dl', c: '#2A2D35', t: T('Offline per USB', 'Offline via USB', 'دون إنترنت عبر USB'), s: T('Update-Datei vom Stick einspielen', 'Install update file from stick', 'تثبيت ملف التحديث من الذاكرة') })}${row({ i: 'reset', c: '#2A2D35', t: T('Rückfall', 'Fallback', 'الرجوع'), s: T('alte Fassung bleibt erhalten', 'previous version is kept', 'تبقى النسخة السابقة') })}</div>`); };
A.updStep = () => { const u = S.update; if (u.st === 'idle') { u.st = 'check'; R(SF.p); setTimeout(() => { u.st = 'found'; R(SF.p); }, 1400); } else if (u.st === 'found') { u.st = 'dl'; u.p = 0; R(SF.p); const iv = setInterval(() => { u.p += 8; if (u.p >= 100) { clearInterval(iv); u.st = 'ready'; notify({ app: 'settings', title: T('Update bereit', 'Update ready', 'التحديث جاهز'), body: T('Signatur gültig · Neustart nötig', 'Signature valid · restart needed', 'التوقيع صالح · يلزم إعادة التشغيل') }); } if (cur(SF.p) === 'settings:update') R(SF.p); }, 220); } else if (u.st === 'ready') { u.st = 'idle'; reboot(); setTimeout(() => notify({ app: 'settings', title: 'Ultar OS 0.6.1', body: T('Update installiert ✓', 'Update installed ✓', 'تم تثبيت التحديث ✓') }, true), 3000); } };
A.updCh = () => { S.update.ch = S.update.ch === 'stable' ? 'beta' : 'stable'; R(SF.p); };

SET.services = (sf) => sub(sf, T('Dienste', 'Services', 'الخدمات'), `<div class="muted" style="font-size:12.5px;margin:0 4px 10px;line-height:1.5">${T('ultar-init startet jeden Dienst mit eigenen Grenzen für Speicher und Rechenzeit und startet ihn bei Fehlern neu.', 'ultar-init starts every service with its own memory and CPU limits and restarts it on failure.', 'يشغّل ultar-init كل خدمة بحدود خاصة للذاكرة والمعالج ويعيد تشغيلها عند الخطأ.')}</div><div class="list">${S.services.map((s, i) => row({ i: 'svc', c: s[1] ? '#173A24' : '#2A2D35', t: `<span class="ltr">${s[0]}</span>`, s: s[1] ? T('läuft', 'running', 'يعمل') + ` · ${(2 + i * 3) % 40 + 2} MB` : T('gestoppt', 'stopped', 'متوقف'), right: tg(!!s[1], 'svcTog', i) })).join('')}</div>`);
A.svcTog = (i, el, sf) => { const s = S.services[+i]; if (i < 2 && s[1]) { toast(T('Systemdienst – kann nicht gestoppt werden', 'System service – cannot be stopped', 'خدمة نظام – لا يمكن إيقافها')); return; } s[1] = s[1] ? 0 : 1; R(sf); };

SET.about = (sf) => sub(sf, T('Über das Gerät', 'About device', 'حول الجهاز'), `<div class="card center" style="padding:20px;flex-direction:column;gap:10px;margin-bottom:14px;text-align:center"><img src="${LOGO}" alt="KM Code Craft" style="width:180px"><b style="font-size:20px">Ultar OS 0.6.0</b><div class="muted" style="font-size:13px;line-height:1.5">${T('Entwickelt von', 'Developed by', 'من تطوير')} Mohamad Anas Kara Mohamad<br>محمد أنس قرة محمد · <span class="ltr">code-craft.tech</span></div></div>
<div class="card" style="padding:4px 14px">${[[T('Modell', 'Model', 'الطراز'), 'Samsung Galaxy A30 (SM-A305F)'], ['Kernel', 'Linux 4.4.177'], [T('Prozessor', 'Processor', 'المعالج'), 'Exynos 7904 · 8 ' + T('Kerne', 'cores', 'أنوية')], ['RAM', '3 GB · ' + T('Oberfläche ≈ 65 MB', 'interface ≈ 65 MB', 'الواجهة ≈ 65 ميغابايت')], [T('Bildschirm', 'Display', 'الشاشة'), '1080 × 2340'], [T('Ultar-Nummer', 'Ultar number', 'رقم Ultar'), S.uos], [T('Startzeit', 'Boot time', 'زمن الإقلاع'), '2,4 s'], [T('Bausteine', 'Components', 'المكونات'), T('18 eigene Rust-Crates', '18 own Rust crates', '18 مكوّناً بلغة Rust')]].map(([a, b]) => `<div class="kv"><span>${a}</span><span class="ltr">${b}</span></div>`).join('')}</div>`);

SET.reset = (sf) => sub(sf, T('Zurücksetzen', 'Reset', 'إعادة الضبط'), `<div class="list">${row({ i: 'wifi', c: '#2A2D35', t: T('Netzwerkeinstellungen zurücksetzen', 'Reset network settings', 'إعادة ضبط الشبكة'), a: 'resetNet' })}${row({ i: 'reset', c: '#7F1D1D', t: T('Werkseinstellungen', 'Factory reset', 'ضبط المصنع'), s: T('Dreifache Bestätigung · Demo startet neu', 'Triple confirmation · demo restarts', 'تأكيد ثلاثي · يعاد تشغيل العرض'), a: 'factory', d: '1' })}</div>`);
A.resetNet = () => { S.wifiNet = 'KM-Office'; S.btOn = []; S.vpn = true; toast(T('Netzwerk zurückgesetzt', 'Network reset', 'تمت إعادة ضبط الشبكة')); };
A.factory = (n) => { n = +n; const msg = [T('Alle Daten werden gelöscht.', 'All data will be erased.', 'ستُمحى كل البيانات.'), T('Wirklich? Das kann nicht rückgängig gemacht werden.', 'Really? This cannot be undone.', 'حقاً؟ لا يمكن التراجع.'), T('Letzte Bestätigung.', 'Final confirmation.', 'التأكيد الأخير.')][n - 1]; confirmBox(`${T('Werkseinstellungen', 'Factory reset', 'ضبط المصنع')} (${n}/3)`, msg, T('Weiter', 'Continue', 'متابعة'), () => { if (n < 3) A.factory(n + 1); else reboot(true); }, true); };

// ================= Datenschutz-Zentrum =================
SC.privacy = {
  b(sf) {
    const P = S.privacy; const g = (k, i, n, s) => tgRow(i, P.all && P[k] ? '#173A24' : '#4A1D1D', n, s, P[k], 'privTog', k);
    return `${hd(sf, T('Datenschutz-Zentrum', 'Privacy center', 'مركز الخصوصية'))}<div class="scroll pad">
    <div class="card" style="padding:18px;margin-bottom:14px;display:flex;gap:14px;align-items:center;${P.all ? '' : 'border-color:var(--bad)'}"><span style="width:56px;height:56px;border-radius:18px;display:flex;align-items:center;justify-content:center;background:${P.all ? 'color-mix(in srgb,var(--ok) 18%,transparent)' : 'color-mix(in srgb,var(--bad) 18%,transparent)'};color:${P.all ? 'var(--ok)' : 'var(--bad)'}">${ic(P.all ? 'shieldOk' : 'shield', 30)}</span><div style="flex:1"><b style="font-size:16px">${T('Gerät aktiv', 'Device active', 'الجهاز نشط')}</b><div class="muted" style="font-size:12.5px">${P.all ? T('Ein Klick schaltet Netz, Kamera, Mikrofon, Standort und Sensoren ab.', 'One tap turns off network, camera, mic, location and sensors.', 'ضغطة واحدة توقف الشبكة والكاميرا والميكروفون والموقع والمستشعرات.') : T('Alles gesperrt – nichts kann senden oder aufnehmen.', 'Everything blocked – nothing can send or record.', 'كل شيء محجوب – لا شيء يرسل أو يسجل.')}</div></div>${tg(P.all, 'qPriv2')}</div>
    <div class="grid2" style="margin-bottom:14px"><div class="card" style="padding:14px"><div class="muted" style="font-size:12px">${T('Tracker gesperrt', 'Trackers blocked', 'متتبعات محجوبة')}</div><div style="font-size:26px;font-weight:700" class="num" id="trk">${S.trackers}</div></div><div class="card" style="padding:14px"><div class="muted" style="font-size:12px">${T('Links geprüft', 'Links checked', 'روابط مفحوصة')}</div><div style="font-size:26px;font-weight:700" class="num">37</div></div></div>
    <div class="sec">${T('Einzeln schalten', 'Individual switches', 'مفاتيح منفصلة')}</div><div class="list">${g('net', 'globe', T('Netzwerk', 'Network', 'الشبكة'), 'WLAN · ' + T('Mobilfunk', 'mobile', 'خلوي'))}${g('cam', 'cam', T('Kamera', 'Camera', 'الكاميرا'), '')}${g('mic', 'mic', T('Mikrofon', 'Microphone', 'الميكروفون'), '')}${g('loc', 'loc', T('Standort', 'Location', 'الموقع'), 'GPS')}${g('sens', 'compass', T('Sensoren', 'Sensors', 'المستشعرات'), T('Bewegung, Licht, Nähe', 'motion, light, proximity', 'الحركة والضوء والقرب'))}${g('bt', 'bt', 'Bluetooth', '')}</div>
    <div class="sec">${T('Schutz', 'Protection', 'الحماية')}</div><div class="list">${tgRow('shield', '#2A2D35', T('Werbe- & Trackersperre systemweit', 'System-wide ad & tracker block', 'حجب الإعلانات والمتتبعات على مستوى النظام'), T('48 213 Einträge', '48,213 entries', '48213 إدخالاً'), S.adblock, 'tAdb')}${tgRow('link', '#2A2D35', T('Links vor dem Öffnen prüfen', 'Check links before opening', 'فحص الروابط قبل الفتح'), '', S.linkcheck, 'tLinkc')}${row({ i: 'link', c: '#4A421C', t: T('Link jetzt prüfen', 'Check a link now', 'افحص رابطاً الآن'), a: 'linkAsk' })}${row({ i: 'box', c: '#2A2D35', t: T('Android-Käfig', 'Android cage', 'قفص أندرويد'), s: T('geplant · standardmäßig aus', 'planned · off by default', 'مخطط · متوقف افتراضياً'), v: T('Aus', 'Off', 'متوقف') })}</div>
    <div class="sec">${T('Zugriffe heute', 'Access today', 'الوصول اليوم')}</div><div class="list">${[['camera', 'cam', '09:12'], ['helper', 'mic', '10:41'], ['browser', 'loc', T('verweigert', 'denied', 'مرفوض')]].map(([a, i, t]) => row({ i, c: '#2A2D35', t: appName(a), v: t })).join('')}</div></div>`;
  },
  m(el) { const t = () => { if (S.adblock && Math.random() < 0.4) { S.trackers++; const n = $('#trk', el); if (n) n.textContent = S.trackers; } }; TICKS.push(t); return () => { TICKS = TICKS.filter((x) => x !== t); }; },
};
A.privTog = (k, el, sf) => { S.privacy[k] = !S.privacy[k]; R(sf); };
A.qPriv2 = (v, el, sf) => { A.qPriv(); R(sf); };
A.tAdb = (v, el, sf) => { S.adblock = !S.adblock; R(sf); };
A.linkAsk = () => { const d = sheet(`<h2>${T('Link prüfen', 'Check link', 'فحص رابط')}</h2><div style="margin-bottom:12px">${inp(`id="lk" value="paket-zustellung-de.example/login" data-enter="linkGo"`)}</div><button class="btn wide" data-a="linkGo">${ic('search', 18)} ${T('In der Box prüfen', 'Check in sandbox', 'افحص في الصندوق')}</button><div id="lres" style="margin-top:14px"></div>`); };
A.linkGo = () => { const u = $('#lk').value; const r = $('#lres'); r.innerHTML = `<div class="muted center" style="gap:8px">${figure('think', 40)} ${T('Prüfe in abgeschotteter Box …', 'Checking in sandbox …', 'أفحص في صندوق معزول …')}</div>`; setTimeout(() => { const v = linkVerdict(u); r.innerHTML = v.length ? `<div class="card" style="padding:14px;border-color:var(--bad)"><b style="color:var(--bad)">⚠️ ${T('Gefährlich', 'Dangerous', 'خطير')}</b><ul style="margin:8px 0 0;padding-inline-start:18px;font-size:14px;line-height:1.5">${v.map((x) => `<li>${x}</li>`).join('')}</ul></div>` : `<div class="card" style="padding:14px;border-color:var(--ok)"><b style="color:var(--ok)">✅ ${T('Unbedenklich', 'Looks safe', 'يبدو آمناً')}</b></div>`; }, 1300); };

// ================= Telefon =================
let dial = '', phoneTab = 'dial';
const avatar = (name, size = 40, color) => { const c = color || (S.contacts.find((x) => x.n === name) || {}).c || '#2A2D35'; const ini = String(name).replace(/[^A-Za-z؀-ۿ ]/g, '').split(' ').filter(Boolean).map((w) => w[0]).slice(0, 2).join('') || '#'; return `<span class="avatar" style="width:${size}px;height:${size}px;background:${c};font-size:${size * 0.38}px">${esc(ini)}</span>`; };
SC.phone = {
  b(sf) {
    const tabs = `<div class="tabs">${[['dial', T('Wählen', 'Keypad', 'لوحة الأرقام')], ['log', T('Verlauf', 'Recents', 'السجل')], ['fav', T('Kontakte', 'Contacts', 'جهات الاتصال')]].map(([k, n]) => `<button class="${phoneTab === k ? 'on' : ''}" data-a="phTab" data-v="${k}">${n}</button>`).join('')}</div>`;
    let body = '';
    if (phoneTab === 'dial') {
      const m = S.contacts.find((c) => dial && c.p.replace(/\s/g, '').includes(dial));
      body = `<div style="flex:1;display:flex;flex-direction:column;justify-content:flex-end;padding-bottom:12px"><div class="ltr num" style="text-align:center;font-size:34px;min-height:46px;letter-spacing:.04em">${esc(dial) || '&nbsp;'}</div><div class="muted" style="text-align:center;font-size:13px;min-height:20px">${m ? esc(m.n) : dial.startsWith('UOS') ? T('Ultar-Nummer · verschlüsselt', 'Ultar number · encrypted', 'رقم Ultar · مشفر') : ''}</div></div>
      <div class="keypad ltr">${[['1', ''], ['2', 'ABC'], ['3', 'DEF'], ['4', 'GHI'], ['5', 'JKL'], ['6', 'MNO'], ['7', 'PQRS'], ['8', 'TUV'], ['9', 'WXYZ'], ['*', ''], ['0', '+'], ['#', '']].map(([k, s]) => `<button data-a="dk" data-v="${k}" ${k === '0' ? 'data-lp="dkPlus"' : ''}>${k}<small>${s || '&nbsp;'}</small></button>`).join('')}</div>
      <div style="display:flex;justify-content:center;align-items:center;gap:40px;padding:16px 0 18px"><button class="ib" data-a="dkUos" aria-label="UOS" style="font-size:11px;font-weight:700;color:var(--ac)">UOS</button><button class="callbtn" data-a="dialCall" aria-label="Call">${ic('phone', 28, 2)}</button><button class="ib" data-a="dk" data-v="del" aria-label="Delete"><span class="flip">${ic('back', 24)}</span></button></div>`;
    } else if (phoneTab === 'log') {
      body = `<div class="scroll pad"><div style="display:flex;justify-content:flex-end;margin-bottom:8px"><button class="pill" data-a="simIncoming">${ic('phone', 14)} ${T('Eingehenden Anruf testen', 'Test incoming call', 'تجربة مكالمة واردة')}</button></div><div class="list">${S.calls.map((c, i) => row({ t: `<span style="${c.k === 'miss' ? 'color:var(--bad)' : ''}">${esc(c.n)}</span>`, s: `${{ in: '↙ ' + T('eingehend', 'incoming', 'واردة'), out: '↗ ' + T('ausgehend', 'outgoing', 'صادرة'), miss: '✕ ' + T('verpasst', 'missed', 'فائتة') }[c.k]} · ${ago(c.t)}`, a: 'callN', d: c.n, right: `<span class="gold">${ic('phone', 18)}</span>` })).join('')}</div></div>`;
    } else {
      body = `<div class="scroll pad"><div class="list">${S.contacts.map((c) => `<button class="row" data-a="callN" data-v="${esc(c.n)}">${avatar(c.n, 38, c.c)}<span class="rt"><b>${esc(c.n)}</b><small class="ltr" style="text-align:start">${esc(c.p)}</small></span><span class="gold">${ic('phone', 18)}</span></button>`).join('')}</div></div>`;
    }
    return `${hd(sf, appName('phone'))}${tabs}${body}`;
  },
};
A.phTab = (k, el, sf) => { phoneTab = k; R(sf); };
A.dk = (k, el, sf) => { if (k === 'del') dial = dial.slice(0, -1); else if (dial.length < 18) dial += k; beep([[941, 1336], [697, 1209]][dial.length % 2][0], 0.05, 0.04); R(sf); };
LP.dkPlus = (v, el, sf) => { dial += '+'; R(sf); };
A.dkUos = (v, el, sf) => { dial = 'UOS-1000-0001'; R(sf); };
A.dialCall = () => { if (!dial) { dial = S.calls[0] ? '' : ''; toast(T('Nummer eingeben', 'Enter a number', 'أدخل رقماً')); return; } const m = S.contacts.find((c) => c.p.replace(/\s/g, '').includes(dial)); CALL.start(m ? m.n : dial); dial = ''; };
A.callN = (n) => CALL.start(n);
A.simIncoming = () => { setTimeout(() => CALL.incoming('Lina Saleh'), 900); toast(T('Anruf kommt in 1 Sekunde …', 'Call arrives in 1 second …', 'المكالمة بعد ثانية …')); };
const CALL = {
  t0: 0, iv: null, name: '', muted: false, spk: false,
  host() { return S.desktop ? DESK.layerHost() : $('#layers'); },
  start(name) {
    if (S.locked) unlock(); this.name = name; this.t0 = 0; const h = this.host(); const uos = /^UOS/.test(name) || name === 'KM Support';
    h.insertAdjacentHTML('beforeend', `<div class="callscr" id="callEl"><div style="height:70px"></div>${avatar(name, 104)}<div style="font-size:26px;font-weight:600;margin-top:16px">${esc(name)}</div><div id="cst" style="opacity:.75;margin-top:6px">${T('Wird angerufen …', 'Calling …', 'جارٍ الاتصال …')}</div><div style="font-size:12px;opacity:.6;margin-top:6px">${uos ? '🔒 ' + T('Ende-zu-Ende verschlüsselt · Ultar', 'End-to-end encrypted · Ultar', 'مشفرة من طرف لطرف · Ultar') : `SIM ${S.simCall + 1} · ${S.sim[S.simCall].n}`}</div><div style="flex:1"></div>
      <div class="grid3" style="gap:22px 34px;margin-bottom:40px">${[['mute', 'mute', T('Stumm', 'Mute', 'كتم')], ['kbd', 'kbd', T('Tasten', 'Keypad', 'لوحة')], ['spk', 'vol', T('Lautsprecher', 'Speaker', 'مكبر')], ['add', 'plus', T('Hinzufügen', 'Add', 'إضافة')], ['vid', 'cam', 'Video'], ['hold', 'pause', T('Halten', 'Hold', 'انتظار')]].map(([k, i, n]) => `<button data-a="callOpt" data-v="${k}" style="border:0;background:transparent;color:#F2F0EA;display:flex;flex-direction:column;align-items:center;gap:6px;font-size:12px"><span style="width:60px;height:60px;border-radius:30px;background:rgba(255,255,255,.1);display:flex;align-items:center;justify-content:center">${ic(i, 24)}</span>${n}</button>`).join('')}</div>
      <button class="callbtn end" data-a="callEnd" style="margin-bottom:46px" aria-label="End">${ic('phone', 28, 2, 'style="transform:rotate(135deg)"')}</button></div>`);
    beep([440], 0.3, 0.03);
    setTimeout(() => { if (!$('#callEl')) return; this.t0 = Date.now(); this.iv = setInterval(() => { const s = Math.floor((Date.now() - this.t0) / 1000); const e = $('#cst'); if (e) e.textContent = `${pad2(Math.floor(s / 60))}:${pad2(s % 60)}`; }, 500); }, 1800);
    HLP.set('call', 1500);
  },
  incoming(name) {
    if (S.dnd) { S.calls.unshift({ n: name, k: 'miss', t: Date.now(), d: 0 }); notify({ app: 'phone', title: T('Verpasster Anruf', 'Missed call', 'مكالمة فائتة'), body: name + ' · ' + T('Nicht stören', 'Do not disturb', 'عدم الإزعاج') }); return; }
    const h = this.host(); beep([880, 660, 880, 660], 0.2, 0.08);
    h.insertAdjacentHTML('beforeend', `<div class="callscr" id="incEl"><div style="height:80px"></div><div style="opacity:.7">${T('Eingehender Anruf', 'Incoming call', 'مكالمة واردة')}</div>${avatar(name, 110)}<div style="font-size:28px;font-weight:600;margin-top:16px">${esc(name)}</div><div style="opacity:.6;margin-top:4px" class="ltr">+49 151 2233 4455</div><div style="flex:1"></div><div style="display:flex;gap:90px;margin-bottom:70px"><button class="callbtn end" data-a="incNo" aria-label="Decline">${ic('phone', 28, 2, 'style="transform:rotate(135deg)"')}</button><button class="callbtn" data-a="incYes" aria-label="Accept" style="animation:kmc-hop 1s infinite">${ic('phone', 28, 2)}</button></div></div>`);
    HLP.set('call', 4000);
  },
};
A.callEnd = () => { clearInterval(CALL.iv); const d = CALL.t0 ? Math.floor((Date.now() - CALL.t0) / 1000) : 0; S.calls.unshift({ n: CALL.name, k: 'out', t: Date.now(), d }); const e = $('#callEl'); if (e) { e.style.transition = 'opacity .25s'; e.style.opacity = '0'; setTimeout(() => e.remove(), 260); } beep([480, 380], 0.1, 0.04); if (cur(SF.p) === 'phone') R(SF.p); };
A.callOpt = (k, el) => { const s = el.querySelector('span'); const on = s.style.background.includes('255, 255, 255, 0.1') || s.style.background.includes('.1'); s.style.background = on ? 'var(--ac)' : 'rgba(255,255,255,.1)'; s.style.color = on ? '#10100A' : ''; if (k === 'vid') toast(T('Video nur zwischen Ultar-Geräten (verschlüsselt)', 'Video only between Ultar devices (encrypted)', 'الفيديو بين أجهزة Ultar فقط (مشفر)')); };
A.incNo = () => { const e = $('#incEl'); e && e.remove(); S.calls.unshift({ n: 'Lina Saleh', k: 'miss', t: Date.now(), d: 0 }); notify({ app: 'phone', title: T('Verpasster Anruf', 'Missed call', 'مكالمة فائتة'), body: 'Lina Saleh' }, true); };
A.incYes = () => { const e = $('#incEl'); e && e.remove(); CALL.start('Lina Saleh'); const s = $('#cst'); if (s) s.textContent = '00:00'; };

// ================= Nachrichten & Telegram =================
function chatList(sf, key, app) {
  const arr = S[key];
  return `${hd(sf, appName(app), `<button class="ib" data-a="chatNew" data-v="${key}" aria-label="New">${ic('edit', 20)}</button>`)}<div class="scroll pad"><div class="list">${arr.map((c) => { const last = c.m[c.m.length - 1]; return `<button class="row" data-a="go" data-v="chat:${key}:${c.id}">${avatar(c.n, 44, app === 'telegram' ? (c.ch ? '#5A4A1C' : '#2B6CB0') : undefined)}<span class="rt"><b>${esc(c.n)}${c.ch ? ' · ' + T('Kanal', 'channel', 'قناة') : ''}</b><small>${last.me ? T('Du: ', 'You: ', 'أنت: ') : ''}${esc(L(last.x))}</small></span><span class="rv" style="font-size:11px">${ago(last.t)}</span></button>`; }).join('')}</div></div>`;
}
SC.messages = { b: (sf) => chatList(sf, 'sms', 'messages') };
SC.telegram = { b: (sf) => chatList(sf, 'tg', 'telegram') };
SC.chat = {
  b(sf, arg) {
    const [key, id] = arg.split(':'); const c = S[key].find((x) => x.id === id); if (!c) return hd(sf, '—');
    c.unread = 0;
    const msgs = c.m.map((m) => { const x = L(m.x); const u = x.match(/([a-z0-9-]+\.)+[a-z]{2,}(\/\S*)?/i); const html = u ? esc(x).replace(esc(u[0]), `<a href="#" data-a="msgLink" data-v="${esc(u[0])}" style="color:${m.me ? 'inherit' : '#8AB4F8'};text-decoration:underline">${esc(u[0])}</a>`) : esc(x); return `<div class="msg ${m.me ? 'me' : 'it'}">${html}<div style="font-size:10px;opacity:.6;text-align:end;margin-top:2px">${fmtTime(new Date(m.t))}${m.me ? ' ✓✓' : ''}</div></div>`; }).join('');
    return `<div class="hd">${'<button class="ib" data-a="back" aria-label="Back"><span class="flip">' + ic('back') + '</span></button>'}${avatar(c.n, 36, key === 'tg' ? '#2B6CB0' : undefined)}<div style="flex:1;min-width:0"><b style="font-size:16px">${esc(c.n)}</b><div class="muted" style="font-size:12px">${key === 'tg' ? 'Telegram · MTProto' : 'SMS · ' + S.sim[S.simCall].n}</div></div>${c.ch ? '' : `<button class="ib" data-a="callN" data-v="${esc(c.n)}" aria-label="Call">${ic('phone', 20)}</button>`}</div>
      <div class="chat scroll" id="msgs" style="padding:8px 14px">${msgs}</div>
      ${c.ch ? `<div class="muted" style="text-align:center;padding:12px;font-size:13px">${T('Nur Admins können schreiben', 'Only admins can post', 'المشرفون فقط يمكنهم النشر')}</div>` : `<div style="display:flex;gap:8px;padding:8px 12px 10px;align-items:center">${inp(`id="msgin" data-enter="msgSend" data-v="${arg}" placeholder="${key === 'tg' ? T('Nachricht', 'Message', 'رسالة') : 'SMS'}"`)}<button class="ib" style="background:var(--ac);color:var(--onac)" data-a="msgSend" data-v="${arg}" aria-label="Send"><span class="flip">${ic('send', 20)}</span></button></div>`}`;
  },
  m(el) { const m = $('#msgs', el); if (m) m.scrollTop = m.scrollHeight; },
};
A.msgSend = (v, el, sf) => {
  const arg = el.dataset.v; const [key, id] = arg.split(':'); const i = $('#msgin', sf.el); const txt = i.value.trim(); if (!txt) return;
  const c = S[key].find((x) => x.id === id); c.m.push({ me: 1, x: txt, t: Date.now() }); R(sf); beep([1318], 0.05, 0.03);
  setTimeout(() => { const ans = [T('Alles klar 👍', 'Alright 👍', 'تمام 👍'), T('Danke dir!', 'Thanks!', 'شكراً لك!'), T('Ich melde mich gleich.', 'I\'ll get back to you.', 'سأرد عليك قريباً.')][Math.floor(Math.random() * 3)]; c.m.push({ me: 0, x: ans, t: Date.now() }); if (cur(sf) === 'chat:' + arg) R(sf); else notify({ app: key === 'tg' ? 'telegram' : 'messages', title: c.n, body: ans }); }, 1800);
  setTimeout(() => { const ni = $('#msgin', sf.el); ni && ni.focus(); }, 50);
};
A.msgLink = (u) => { if (S.linkcheck && linkVerdict(u).length) { HLP.openChat(T(`Ist ${u} sicher?`, `Is ${u} safe?`, `هل ${u} آمن؟`)); } else { openApp('browser'); S.browserUrl = u; R(SF.p); } };
A.chatNew = (key) => { const d = sheet(`<h2>${T('Neue Nachricht', 'New message', 'رسالة جديدة')}</h2><div class="list">${S.contacts.map((c) => `<button class="row" data-a="chatStart" data-v="${key}:${c.id}">${avatar(c.n, 36, c.c)}<span class="rt"><b>${esc(c.n)}</b></span></button>`).join('')}</div>`); };
A.chatStart = (v, el) => { const [key, cid] = v.split(':'); const c = S.contacts.find((x) => x.id === cid); let ch = S[key].find((x) => x.n === c.n); if (!ch) { ch = { id: uid(), n: c.n, m: [{ me: 0, x: T('Hallo!', 'Hi!', 'مرحباً!'), t: Date.now() - 6e4 }] }; S[key].unshift(ch); } A.closeSheet(v, el); go(SF.p, `chat:${key}:${ch.id}`); };

// ================= Kamera =================
let camMode = 'photo', camTimer = 0, camGrid = false, camZoom = 1, camFront = false, scanPages = 0, camRec = null;
SC.camera = {
  full: true, cls: () => 'cam',
  b(sf) {
    const modes = [['video', 'Video'], ['photo', T('Foto', 'Photo', 'صورة')], ['scan', T('Scan', 'Scan', 'مسح')], ['square', T('Quadrat', 'Square', 'مربع')]];
    const last = S.gallery[0];
    const blocked = !S.privacy.all || !S.privacy.cam;
    return `<div style="position:absolute;inset:0;background:#000;display:flex;flex-direction:column;color:#F2F0EA">
      <div style="height:52px;display:flex;align-items:center;justify-content:space-between;padding:0 14px">
        <button class="ib" data-a="back" aria-label="Back" style="color:#fff"><span class="flip">${ic('back')}</span></button>
        <button class="ib" data-a="qTorch" aria-label="Flash" style="color:${S.torch ? '#F0E8A0' : '#fff'}">${ic('bolt', 20)}</button>
        <button class="ib" data-a="camTimer" aria-label="Timer" style="color:${camTimer ? '#F0E8A0' : '#fff'};font-size:11px;font-weight:700">${camTimer ? camTimer + 's' : ic('timer', 20)}</button>
        <button class="ib" data-a="camGrid" aria-label="Grid" style="color:${camGrid ? '#F0E8A0' : '#fff'}">${ic('grid', 20)}</button>
        <button class="ib" data-a="camZoom" aria-label="Zoom" style="color:#fff;font-size:13px;font-weight:700">${camZoom}×</button>
      </div>
      <div class="vf" id="vf" style="${camMode === 'square' ? 'flex:none;height:374px;margin:auto 8px' : ''}">
        ${blocked ? `<div class="center" style="position:absolute;inset:0;flex-direction:column;gap:10px;color:#A6A6AE">${ic('eyeOff', 40)}<div>${T('Kamera im Datenschutz-Zentrum gesperrt', 'Camera blocked in the privacy center', 'الكاميرا محجوبة في مركز الخصوصية')}</div></div>` : camMode === 'scan' ? `<div style="position:absolute;inset:0;background:radial-gradient(90% 70% at 40% 40%,#3A3630,#16140F)"></div><div class="doc">${'<i style="width:60%;height:10px;background:#7B776C"></i><i style="width:90%"></i><i style="width:85%"></i><i style="width:92%"></i><i style="width:70%"></i><i style="height:30px;background:transparent"></i><i style="width:88%"></i><i style="width:80%"></i><i style="width:60%"></i>'}</div><svg style="position:absolute;inset:0" width="100%" height="100%" viewBox="0 0 374 500" fill="none"><polygon points="50,82 280,62 306,382 76,402" stroke="#F0E8A0" stroke-width="2.5" fill="rgba(216,200,112,.10)"><animate attributeName="stroke-opacity" values="1;.4;1" dur="1.4s" repeatCount="indefinite"/></polygon>${[[50, 82], [280, 62], [306, 382], [76, 402]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="7" fill="#F0E8A0"/>`).join('')}</svg><div style="position:absolute;left:50%;top:14px;transform:translateX(-50%);height:32px;padding:0 14px;border-radius:16px;background:rgba(10,11,14,.75);display:flex;align-items:center;gap:8px;font-size:13px;white-space:nowrap"><span style="width:8px;height:8px;border-radius:4px;background:#4ADE80"></span>${T('Dokument erkannt · Ecken werden entzerrt', 'Document detected · straightening corners', 'تم اكتشاف مستند · تصحيح الزوايا')}</div>` : `<div class="scene" style="transform:scale(${camZoom}) ${camFront ? 'scaleX(-1)' : ''}"><div class="sun"></div><div class="cl" style="top:18%"></div><div class="cl" style="top:30%;animation-delay:-8s;width:80px"></div><div class="hill"></div></div>`}
        ${camGrid ? '<div style="position:absolute;inset:0;background:linear-gradient(90deg,transparent 33%,rgba(255,255,255,.35) 33.3%,transparent 33.6%,transparent 66.4%,rgba(255,255,255,.35) 66.7%,transparent 67%),linear-gradient(transparent 33%,rgba(255,255,255,.35) 33.3%,transparent 33.6%,transparent 66.4%,rgba(255,255,255,.35) 66.7%,transparent 67%)"></div>' : ''}
        ${camRec ? `<div style="position:absolute;top:14px;left:50%;transform:translateX(-50%);background:#C62828;border-radius:14px;padding:4px 12px;font-size:13px;font-weight:600" id="recT">● 00:00</div>` : ''}
        <div id="camCount" class="center" style="position:absolute;inset:0;font-size:90px;font-weight:800;color:#fff;pointer-events:none;text-shadow:0 4px 20px #000"></div>
        <div style="position:absolute;bottom:10px;inset-inline-start:12px;font-size:11px;color:rgba(255,255,255,.6)">${T('Demo-Kamerabild', 'Demo camera feed', 'صورة كاميرا تجريبية')}</div>
      </div>
      <div style="display:flex;justify-content:center;gap:20px;padding:14px 0 8px;font-size:14px;font-weight:500">${modes.map(([k, n]) => `<button data-a="camMode" data-v="${k}" style="border:0;background:transparent;color:${camMode === k ? '#F0E8A0' : '#8E8E97'};display:flex;flex-direction:column;align-items:center;gap:4px">${n}${camMode === k ? '<span style="width:4px;height:4px;border-radius:2px;background:#F0E8A0"></span>' : '<span style="height:4px"></span>'}</button>`).join('')}</div>
      <div style="height:116px;display:flex;align-items:center;justify-content:space-between;padding:0 32px 10px">
        ${camMode === 'scan' ? `<button data-a="${scanPages ? 'scanDone' : 'open'}" data-v="gallery" style="width:52px;height:52px;border-radius:12px;border:2px solid #fff;background:linear-gradient(170deg,#ECE9E0,#B9B5A8);position:relative;padding:0">${scanPages ? `<span class="badge" style="position:absolute;top:-8px;right:-8px;background:#D8C870;color:#10100A">${scanPages}</span>` : ''}</button>` : `<button data-a="open" data-v="gallery" aria-label="${appName('gallery')}" style="width:52px;height:52px;border-radius:26px;border:2px solid #fff;background:${last ? last.g : '#333'};padding:0"></button>`}
        <button class="shutter" data-a="shoot" aria-label="Shutter"><span style="${camMode === 'video' ? `background:#E53935;${camRec ? 'border-radius:8px;transform:scale(.5)' : ''}` : camMode === 'scan' ? 'background:#D8C870' : ''}"></span></button>
        ${camMode === 'scan' && scanPages ? `<button class="btn sm" style="background:#F2F0EA;color:#10100A" data-a="scanDone">${T('PDF', 'PDF', 'PDF')}</button>` : `<button class="ib" data-a="camFlip" aria-label="Flip" style="background:rgba(255,255,255,.12);color:#fff;width:52px;height:52px;border-radius:26px">${ic('flip', 22)}</button>`}
      </div></div>`;
  },
  m() { HLP.tip('camera'); return () => { if (camRec) { clearInterval(camRec.iv); camRec = null; } }; },
};
A.camMode = (k, el, sf) => { if (camRec) return; camMode = k; R(sf); };
A.camTimer = (v, el, sf) => { camTimer = { 0: 3, 3: 10, 10: 0 }[camTimer]; R(sf); };
A.camGrid = (v, el, sf) => { camGrid = !camGrid; R(sf); };
A.camZoom = (v, el, sf) => { camZoom = { 1: 2, 2: 4, 4: 1 }[camZoom]; R(sf); };
A.camFlip = (v, el, sf) => { camFront = !camFront; R(sf); toast(camFront ? T('Frontkamera', 'Front camera', 'الكاميرا الأمامية') : T('Rückkamera', 'Rear camera', 'الكاميرا الخلفية')); };
A.shoot = async (v, el, sf) => {
  if (!S.privacy.all || !S.privacy.cam) return;
  if (camMode === 'video') {
    if (camRec) { clearInterval(camRec.iv); const d = Math.floor((Date.now() - camRec.t) / 1000); camRec = null; S.gallery.unshift({ id: uid(), g: 'linear-gradient(180deg,#F6B26B,#7B4A6E 60%,#283049)', d: 0, vid: true, len: d }); R(sf); toast(T(`Video gespeichert (${d} s)`, `Video saved (${d} s)`, `تم حفظ الفيديو (${d} ث)`)); return; }
    camRec = { t: Date.now() }; R(sf); camRec.iv = setInterval(() => { const s = Math.floor((Date.now() - camRec.t) / 1000); const e = $('#recT'); if (e) e.textContent = `● ${pad2(Math.floor(s / 60))}:${pad2(s % 60)}`; }, 500); return;
  }
  if (camTimer) { for (let i = camTimer; i > 0; i--) { const c = $('#camCount'); if (!c) return; c.textContent = i; beep([880], 0.06, 0.04); await sleep(1000); } const c = $('#camCount'); if (c) c.textContent = ''; }
  const fl = document.createElement('div'); fl.className = 'flash'; ($('#vf') || document.body).appendChild(fl); setTimeout(() => fl.remove(), 400); beep([1600, 1200], 0.04, 0.05);
  if (camMode === 'scan') { scanPages++; R(sf); return; }
  const gs = ['linear-gradient(180deg,#F6B26B,#E58E5A 35%,#7B4A6E 60%,#283049)', 'linear-gradient(180deg,#F7C77E,#E07A5F 40%,#5A4A6E 65%,#1E2538)', 'linear-gradient(180deg,#FFD39A,#EE9B6B 38%,#6C4A72 62%,#232B42)'];
  S.gallery.unshift({ id: uid(), g: gs[Math.floor(Math.random() * 3)], d: 0, sq: camMode === 'square' }); S.files.Bilder.unshift([`IMG_${new Date().toISOString().slice(0, 10).replace(/-/g, '')}_${fmtTime().replace(':', '')}.jpg`, 2600]); R(sf);
};
A.scanDone = () => { const n = `Scan_${new Date().toISOString().slice(0, 10)}_${fmtTime().replace(':', '')}.pdf`; S.files.Dokumente.unshift([n, 180 * scanPages]); notify({ app: 'files', title: T('Scan gespeichert', 'Scan saved', 'تم حفظ المسح'), body: `${n} · ${scanPages} ${T('Seite(n)', 'page(s)', 'صفحة')}` }); scanPages = 0; R(SF.p); };

// ================= Galerie =================
let galTab = 'photos', galSel = null;
SC.gallery = {
  b(sf) {
    const tabs = `<div class="tabs">${[['photos', T('Fotos', 'Photos', 'الصور')], ['albums', T('Alben', 'Albums', 'الألبومات')], ['fav', T('Favoriten', 'Favourites', 'المفضلة')], ['vid', 'Videos']].map(([k, n]) => `<button class="${galTab === k ? 'on' : ''}" data-a="galTab" data-v="${k}">${n}</button>`).join('')}</div>`;
    let items = S.gallery; if (galTab === 'fav') items = items.filter((g) => g.fav); if (galTab === 'vid') items = items.filter((g) => g.vid);
    const grp = (d) => (d === 0 ? T('Heute', 'Today', 'اليوم') : d === 1 ? T('Gestern', 'Yesterday', 'أمس') : d < 8 ? T('Diese Woche', 'This week', 'هذا الأسبوع') : T('Früher', 'Earlier', 'سابقاً'));
    let body = '';
    if (galTab === 'albums') body = `<div class="grid2">${[['Kamera', S.gallery.length, S.gallery[0]], [T('Scans', 'Scans', 'المسوحات'), 3, { g: 'linear-gradient(170deg,#ECE9E0,#B9B5A8)' }], ['WhatsApp', 12, S.gallery[3]], [T('Hintergründe', 'Wallpapers', 'الخلفيات'), 4, S.gallery[5]]].map(([n, c, g]) => `<button class="card" data-a="galTab" data-v="photos" style="padding:8px;text-align:start"><span style="display:block;aspect-ratio:1;border-radius:14px;background:${g ? g.g : '#333'}"></span><b style="display:block;margin:8px 4px 0;font-size:14px">${n}</b><span class="muted" style="font-size:12px;margin:0 4px">${c}</span></button>`).join('')}</div>`;
    else { const groups = {}; items.forEach((g) => { (groups[grp(g.d)] = groups[grp(g.d)] || []).push(g); }); body = Object.keys(groups).length ? Object.entries(groups).map(([k, gs]) => `<div class="sec">${k}</div><div class="gal">${gs.map((g) => `<button style="background:${g.g}" data-a="go" data-v="photo:${g.id}" data-lp="galLong">${g.vid ? `<span class="h">▶ ${g.len ? g.len + 's' : '0:12'}</span>` : g.fav ? `<span class="h">♥</span>` : ''}</button>`).join('')}</div>`).join('') : `<div class="empty">${T('Keine Einträge', 'Nothing here', 'لا يوجد شيء')}</div>`; }
    return `${hd(sf, appName('gallery'), `<button class="ib" data-a="open" data-v="camera" aria-label="Camera">${ic('cam', 20)}</button>`)}${tabs}<div class="scroll pad">${body}</div>`;
  },
};
A.galTab = (k, el, sf) => { galTab = k; R(sf); };
LP.galLong = (v, el) => { const id = el.dataset.v.split(':')[1]; const r = el.getBoundingClientRect(); menu([{ i: 'heart', t: T('Favorit', 'Favourite', 'مفضلة'), f: () => { const g = S.gallery.find((x) => x.id === id); g.fav = !g.fav; R(SF.p); } }, { i: 'share', t: T('Teilen', 'Share', 'مشاركة'), f: () => toast(T('Teilen über Telegram, Bluetooth …', 'Share via Telegram, Bluetooth …', 'مشاركة عبر تيليجرام، بلوتوث …')) }, { i: 'trash', t: T('Löschen', 'Delete', 'حذف'), f: () => { S.gallery = S.gallery.filter((x) => x.id !== id); R(SF.p); } }], r.left, r.bottom); };
SC.photo = {
  full: true,
  b(sf, id) {
    const i = S.gallery.findIndex((g) => g.id === id); const g = S.gallery[i]; if (!g) return hd(sf, '—');
    return `<div style="position:absolute;inset:0;background:#000;color:#fff;display:flex;flex-direction:column" id="phv"><div class="hd" style="color:#fff"><button class="ib" data-a="back" style="color:#fff" aria-label="Back"><span class="flip">${ic('back')}</span></button><h1 style="font-size:15px;font-weight:500">${i + 1} / ${S.gallery.length}</h1><button class="ib" style="color:#fff" data-a="phInfo" data-v="${id}" aria-label="Info">${ic('info', 20)}</button></div>
    <div style="flex:1;display:flex;align-items:center;justify-content:center;overflow:hidden;touch-action:none" id="phstage"><div id="phimg" style="width:${g.sq ? 360 : 380}px;height:${g.sq ? 360 : 500}px;background:${g.g};border-radius:4px;transition:transform .25s;position:relative">${g.vid ? `<button data-a="vidPlay" style="position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);width:70px;height:70px;border-radius:35px;border:0;background:rgba(0,0,0,.5);color:#fff">${ic('play', 30)}</button>` : ''}</div></div>
    <div style="display:flex;justify-content:space-around;padding:10px 0 14px">${[['phFav', g.fav ? 'heart' : 'heart', T('Favorit', 'Favourite', 'مفضلة'), g.fav ? '#F87171' : '#fff'], ['phRot', 'rotate', T('Drehen', 'Rotate', 'تدوير'), '#fff'], ['phWall', 'img', T('Hintergrund', 'Wallpaper', 'خلفية'), '#fff'], ['phShare', 'share', T('Teilen', 'Share', 'مشاركة'), '#fff'], ['phDel', 'trash', T('Löschen', 'Delete', 'حذف'), '#fff']].map(([a, i2, n, c]) => `<button data-a="${a}" data-v="${id}" style="border:0;background:transparent;color:${c};display:flex;flex-direction:column;align-items:center;gap:4px;font-size:11px">${ic(i2, 22)}${n}</button>`).join('')}</div></div>`;
  },
  m(el, sf, id) {
    const st = $('#phstage', el); let x0 = null, y0 = null; let zoom = 1;
    st.addEventListener('pointerdown', (e) => { x0 = e.clientX; y0 = e.clientY; });
    st.addEventListener('pointerup', (e) => { if (x0 == null) return; const dx = e.clientX - x0, dy = e.clientY - y0; x0 = null; const i = S.gallery.findIndex((g) => g.id === id); if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy)) { const n = S.gallery[i + ((dx < 0) !== (S.lang === 'ar') ? 1 : -1)]; if (n) replace(sf, 'photo:' + n.id); } else if (dy > 90) back(sf); });
    st.addEventListener('dblclick', () => { zoom = zoom === 1 ? 2 : 1; $('#phimg', el).style.transform = `scale(${zoom})`; });
  },
};
A.phFav = (id, el, sf) => { const g = S.gallery.find((x) => x.id === id); g.fav = !g.fav; R(sf); };
A.phRot = () => { const e = $('#phimg'); const r = ((+e.dataset.r || 0) + 90) % 360; e.dataset.r = r; e.style.transform = `rotate(${r}deg) scale(${r % 180 ? 0.75 : 1})`; };
A.phWall = (id) => { const g = S.gallery.find((x) => x.id === id); S.wall = g.g; toast(T('Als Hintergrund gesetzt', 'Set as wallpaper', 'تم تعيينها خلفية')); };
A.phShare = () => sheet(`<h2>${T('Teilen', 'Share', 'مشاركة')}</h2><div class="grid4" style="padding:6px 0 10px">${[['telegram', 'tg'], ['messages', 'msg'], ['whatsapp', 'wa']].map(([a, i]) => `<button class="app" data-a="closeSheet">${'<span class="ic">' + appIcon(a) + '</span>'}<span>${appName(a)}</span></button>`).join('')}<button class="app" data-a="closeSheet"><span class="ic">${ic('bt', 24)}</span><span>Bluetooth</span></button></div>`);
A.phDel = (id, el, sf) => confirmBox(T('Foto löschen?', 'Delete photo?', 'حذف الصورة؟'), T('Es landet 30 Tage im Papierkorb.', 'It goes to the bin for 30 days.', 'ستبقى في سلة المحذوفات 30 يوماً.'), T('Löschen', 'Delete', 'حذف'), () => { S.gallery = S.gallery.filter((x) => x.id !== id); back(sf); }, true);
A.phInfo = (id) => { const g = S.gallery.find((x) => x.id === id); sheet(`<h2>${T('Details', 'Details', 'التفاصيل')}</h2><div class="card" style="padding:4px 14px">${[[T('Datei', 'File', 'الملف'), `IMG_${id}.jpg`], [T('Ordner', 'Folder', 'المجلد'), '/data/DCIM/Camera'], [T('Größe', 'Size', 'الحجم'), '2,6 MB'], [T('Auflösung', 'Resolution', 'الدقة'), g.sq ? '3000 × 3000' : '4000 × 3000'], [T('Kamera', 'Camera', 'الكاميرا'), 'Samsung S5KGM1 · f/1.7']].map(([a, b]) => `<div class="kv"><span>${a}</span><span class="ltr">${b}</span></div>`).join('')}</div>`); };
A.vidPlay = (v, el) => { el.innerHTML = ic('pause', 30); const im = $('#phimg'); im.animate([{ filter: 'brightness(1)' }, { filter: 'brightness(1.3) hue-rotate(20deg)' }, { filter: 'brightness(1)' }], { duration: 3000, iterations: 1 }); setTimeout(() => { if (el.isConnected) el.innerHTML = ic('play', 30); }, 3000); };

// ================= Dateien =================
let clipFile = null;
SC.files = {
  b(sf, dir) {
    if (!dir) return `${hd(sf, appName('files'))}<div class="scroll pad"><div class="card" style="padding:14px;margin-bottom:14px"><div style="display:flex;justify-content:space-between;font-size:14px"><span>${T('Interner Speicher', 'Internal storage', 'التخزين الداخلي')}</span><span class="muted">18,4 / 64 GB</span></div><div class="bar" style="margin-top:8px"><i style="width:29%"></i></div></div>
      <div class="grid3" style="margin-bottom:14px">${[['img', T('Bilder', 'Images', 'الصور'), 'Bilder'], ['pdf', T('Dokumente', 'Documents', 'المستندات'), 'Dokumente'], ['dl', 'Downloads', 'Downloads']].map(([i, n, d]) => `<button class="card" data-a="go" data-v="files:${d}" style="padding:14px 8px;display:flex;flex-direction:column;align-items:center;gap:8px"><span class="gold">${ic(i, 26)}</span><span style="font-size:13px">${n}</span></button>`).join('')}</div>
      <div class="list">${Object.keys(S.files).map((d) => row({ i: d === 'Ubuntu' ? 'ubuntu' : 'folder', c: d === 'Ubuntu' ? '#5A2A1C' : '#4A421C', t: dname(d), s: `${S.files[d].length} ${T('Einträge', 'items', 'عناصر')}`, a: 'go', d: 'files:' + d })).join('')}${row({ i: 'drive', c: '#2A2D35', t: T('USB-Stick', 'USB stick', 'ذاكرة USB'), s: T('nicht verbunden', 'not connected', 'غير متصلة') })}</div></div>`;
    const fs = S.files[dir] || [];
    return `${hd(sf, dname(dir), `<button class="ib" data-a="fNewDir" data-v="${dir}" aria-label="New folder">${ic('plus', 20)}</button>`)}<div class="scroll pad">${clipFile ? `<div class="card" style="padding:10px 14px;display:flex;align-items:center;gap:10px;margin-bottom:10px;border-color:var(--ac)">${ic(clipFile.mv ? 'cut' : 'copy', 18)}<span style="flex:1;font-size:13px">${esc(clipFile.n)}</span><button class="btn sm" data-a="fPaste" data-v="${dir}">${T('Hier einfügen', 'Paste here', 'الصق هنا')}</button></div>` : ''}<div class="muted" style="font-size:12px;margin:0 4px 8px">${T('Langer Druck für Kopieren, Verschieben, Umbenennen, Löschen', 'Long-press to copy, move, rename, delete', 'اضغط مطولاً للنسخ أو النقل أو إعادة التسمية أو الحذف')}</div><div class="list">${fs.length ? fs.map(([n, kb], i) => `<button class="row" data-a="fOpen" data-v="${dir}|${i}" data-lp="fLong">${`<span class="ri" style="background:#2A2D35">${ic(kb === 0 ? 'folder' : /\.pdf$/.test(n) ? 'pdf' : /\.(jpg|png)$/.test(n) ? 'img' : /\.uap$/.test(n) ? 'box' : 'file', 18)}</span>`}<span class="rt"><b class="ltr" style="text-align:start">${esc(n)}</b><small>${kb === 0 ? T('Ordner', 'Folder', 'مجلد') : kb >= 1000 ? (kb / 1000).toFixed(1) + ' MB' : kb + ' KB'}</small></span></button>`).join('') : `<div class="empty">${T('Leer', 'Empty', 'فارغ')}</div>`}</div></div>`;
  },
};
const dname = (d) => ({ Dokumente: T('Dokumente', 'Documents', 'المستندات'), Bilder: T('Bilder', 'Images', 'الصور'), Downloads: 'Downloads', Musik: T('Musik', 'Music', 'الموسيقى'), Ubuntu: 'Ubuntu (/home)' }[d] || d);
A.fOpen = (v) => { const [d, i] = v.split('|'); const f = S.files[d][+i]; if (/\.(jpg|png)$/.test(f[0])) { openApp('gallery'); return; } sheet(`<h2 class="ltr" style="text-align:start">${esc(f[0])}</h2><div class="card" style="padding:18px;min-height:160px;font-size:14px;line-height:1.6;color:var(--mt)">${/\.pdf$/.test(f[0]) ? `<div style="background:#ECE9E0;border-radius:6px;padding:18px;color:#333">${'<div style="height:8px;background:#999;border-radius:2px;margin:8px 0;width:80%"></div>'.repeat(6)}</div>` : /\.uap$/.test(f[0]) ? T('Ultar-Paket · Signatur Ed25519 gültig · Herausgeber KM Code Craft', 'Ultar package · Ed25519 signature valid · publisher KM Code Craft', 'حزمة Ultar · توقيع Ed25519 صالح · الناشر KM Code Craft') : T('Inhalt der Datei (Demo)', 'File contents (demo)', 'محتوى الملف (عرض)')}</div>`); };
LP.fLong = (v, el, sf, ev) => {
  const [d, i] = v.split('|'); const f = S.files[d][+i]; const r = el.getBoundingClientRect();
  menu([{ i: 'file', t: T('Öffnen', 'Open', 'فتح'), f: () => A.fOpen(v) }, { i: 'copy', t: T('Kopieren', 'Copy', 'نسخ'), f: () => { clipFile = { n: f[0], kb: f[1], from: d, mv: false }; R(sf); } }, { i: 'cut', t: T('Verschieben', 'Move', 'نقل'), f: () => { clipFile = { n: f[0], kb: f[1], from: d, mv: true }; R(sf); } }, { i: 'edit', t: T('Umbenennen', 'Rename', 'إعادة تسمية'), f: () => fRename(d, +i) }, { i: 'trash', t: T('Löschen', 'Delete', 'حذف'), f: () => confirmBox(T('Löschen?', 'Delete?', 'حذف؟'), esc(f[0]), T('Löschen', 'Delete', 'حذف'), () => { S.files[d].splice(+i, 1); R(sf); }, true) }], r.left + 40, r.top + 30);
};
function fRename(d, i) { const f = S.files[d][i]; const s = sheet(`<h2>${T('Umbenennen', 'Rename', 'إعادة تسمية')}</h2><div style="margin-bottom:12px">${inp(`id="fren" value="${esc(f[0])}"`)}</div><button class="btn wide" id="frok">${T('Speichern', 'Save', 'حفظ')}</button>`, { mid: true }); $('#frok', s).onclick = () => { f[0] = $('#fren').value || f[0]; s.remove(); KB.hide(); R(SF.p); }; setTimeout(() => $('#fren', s).focus(), 200); }
A.fPaste = (dir, el, sf) => { let n = clipFile.n; while (S.files[dir].some((f) => f[0] === n)) n = n.replace(/(\.\w+)?$/, ' (2)$1'); S.files[dir].unshift([n, clipFile.kb]); if (clipFile.mv) S.files[clipFile.from] = S.files[clipFile.from].filter((f) => f[0] !== clipFile.n); clipFile = null; R(sf); toast(T('Eingefügt', 'Pasted', 'تم اللصق')); };
A.fNewDir = (dir, el, sf) => { S.files[dir].unshift([T('Neuer Ordner', 'New folder', 'مجلد جديد'), 0]); R(sf); };

// ================= Uhr =================
let clkTab = 'alarm';
const CLK = {
  timer: { total: 0, left: 0, run: false, t: 0 }, sw: { run: false, t0: 0, acc: 0, laps: [] },
  timerStart(sec) { this.timer = { total: sec, left: sec, run: true, t: Date.now() }; },
  tLeft() { const t = this.timer; if (!t.run) return t.left; return Math.max(0, t.left - (Date.now() - t.t) / 1000); },
  swNow() { const s = this.sw; return s.acc + (s.run ? Date.now() - s.t0 : 0); },
};
setInterval(() => { const t = CLK.timer; if (t.run && CLK.tLeft() <= 0) { t.run = false; t.left = 0; beep([880, 1175, 880, 1175], 0.2, 0.1); notify({ app: 'clock', title: T('Timer abgelaufen', 'Timer finished', 'انتهى المؤقت'), body: `${Math.round(t.total / 60)} min` }); HLP.set('call', 2500); } }, 500);
const fmtMs = (ms) => { const s = Math.floor(ms / 1000); return `${pad2(Math.floor(s / 60))}:${pad2(s % 60)},${Math.floor((ms % 1000) / 100)}`; };
const fmtS = (sec) => { sec = Math.ceil(sec); return `${pad2(Math.floor(sec / 3600))}:${pad2(Math.floor((sec % 3600) / 60))}:${pad2(sec % 60)}`; };
SC.clock = {
  b(sf) {
    const tabs = `<div class="tabs">${[['alarm', T('Wecker', 'Alarm', 'المنبه')], ['world', T('Weltuhr', 'World', 'العالمية')], ['timer', 'Timer'], ['sw', T('Stoppuhr', 'Stopwatch', 'ساعة الإيقاف')]].map(([k, n]) => `<button class="${clkTab === k ? 'on' : ''}" data-a="clkTab" data-v="${k}">${n}</button>`).join('')}</div>`;
    let b = '';
    if (clkTab === 'alarm') b = `<div class="list">${S.alarms.map((a) => `<div class="row"><span class="rt"><b class="num" style="font-size:34px;font-weight:300">${pad2(a.h)}:${pad2(a.m)}</b><small>${a.days === '12345' ? T('Mo–Fr', 'Mon–Fri', 'الإثنين–الجمعة') : a.days === '67' ? T('Wochenende', 'Weekend', 'عطلة الأسبوع') : T('Einmal', 'Once', 'مرة')}</small></span><button class="ib" data-a="alDel" data-v="${a.id}" aria-label="Delete">${ic('trash', 18)}</button>${tg(a.on, 'alTog', a.id)}</div>`).join('')}</div><button class="btn wide" data-a="alAdd">${ic('plus', 18)} ${T('Wecker hinzufügen', 'Add alarm', 'إضافة منبه')}</button>`;
    if (clkTab === 'world') b = `<div class="list" id="wc">${worldRows()}</div>`;
    if (clkTab === 'timer') { const t = CLK.timer; b = `<div class="center" style="flex-direction:column;gap:18px;padding-top:20px"><div class="ring-score" style="width:240px;height:240px;background:conic-gradient(var(--ac) ${t.total ? (CLK.tLeft() / t.total) * 100 : 0}%,var(--s3) 0)" id="tring"><div style="width:216px;height:216px;border-radius:50%;background:var(--bg);display:flex;align-items:center;justify-content:center"><span class="num" style="font-size:40px;font-weight:300" id="tval">${fmtS(CLK.tLeft())}</span></div></div>${t.total ? `<div style="display:flex;gap:12px"><button class="btn" data-a="tmPause">${t.run ? T('Pause', 'Pause', 'إيقاف مؤقت') : T('Weiter', 'Resume', 'متابعة')}</button><button class="btn ghost" data-a="tmReset">${T('Zurücksetzen', 'Reset', 'إعادة')}</button></div>` : `<div class="chips" style="flex-wrap:wrap;justify-content:center">${[1, 3, 5, 10, 15, 25].map((m) => `<button class="pill" data-a="tmSet" data-v="${m}">${m} min</button>`).join('')}</div>`}</div>`; }
    if (clkTab === 'sw') b = `<div class="center" style="flex-direction:column;gap:18px;padding-top:30px"><span class="num" style="font-size:58px;font-weight:300" id="swv">${fmtMs(CLK.swNow())}</span><div style="display:flex;gap:12px"><button class="btn" data-a="swGo">${CLK.sw.run ? T('Stopp', 'Stop', 'إيقاف') : T('Start', 'Start', 'ابدأ')}</button><button class="btn ghost" data-a="swLap">${CLK.sw.run ? T('Runde', 'Lap', 'لفة') : T('Zurücksetzen', 'Reset', 'إعادة')}</button></div><div class="list" style="width:100%">${CLK.sw.laps.map((l, i) => `<div class="kv" style="padding:10px 14px"><span>${T('Runde', 'Lap', 'لفة')} ${CLK.sw.laps.length - i}</span><span class="num">${fmtMs(l)}</span></div>`).join('')}</div></div>`;
    return `${hd(sf, appName('clock'))}${tabs}<div class="scroll pad">${b}</div>`;
  },
  m(el) { const iv = setInterval(() => { const tv = $('#tval', el); if (tv) { tv.textContent = fmtS(CLK.tLeft()); const t = CLK.timer; $('#tring', el).style.background = `conic-gradient(var(--ac) ${t.total ? (CLK.tLeft() / t.total) * 100 : 0}%,var(--s3) 0)`; } const sw = $('#swv', el); if (sw) sw.textContent = fmtMs(CLK.swNow()); const wc = $('#wc', el); if (wc && Math.random() < 0.05) wc.innerHTML = worldRows(); }, 100); return () => clearInterval(iv); },
};
function worldRows() { return [['Europe/Berlin', T('Berlin', 'Berlin', 'برلين')], ['Asia/Damascus', T('Damaskus', 'Damascus', 'دمشق')], ['Asia/Dubai', T('Dubai', 'Dubai', 'دبي')], ['Asia/Riyadh', T('Riad', 'Riyadh', 'الرياض')], ['America/New_York', 'New York']].map(([z, n]) => { const t = new Intl.DateTimeFormat('en-GB', { timeZone: z, hour: '2-digit', minute: '2-digit' }).format(new Date()); return `<div class="row"><span class="rt"><b>${n}</b><small>${new Intl.DateTimeFormat(LOC(), { timeZone: z, weekday: 'long' }).format(new Date())}</small></span><span class="num" style="font-size:30px;font-weight:300">${t}</span></div>`; }).join(''); }
A.clkTab = (k, el, sf) => { clkTab = k; R(sf); };
A.alTog = (id, el, sf) => { const a = S.alarms.find((x) => x.id === id); a.on = !a.on; chrome(); R(sf); };
A.alDel = (id, el, sf) => { S.alarms = S.alarms.filter((x) => x.id !== id); chrome(); R(sf); };
A.alAdd = () => { let h = 7, m = 0; const d = sheet(`<h2>${T('Neuer Wecker', 'New alarm', 'منبه جديد')}</h2><div class="center ltr" style="gap:16px;margin:10px 0 18px">${['h', 'm'].map((k) => `<div style="display:flex;flex-direction:column;align-items:center;gap:6px"><button class="ib fill" data-k="${k}+">${ic('up')}</button><span class="num" id="al${k}" style="font-size:48px;font-weight:300">${k === 'h' ? '07' : '00'}</span><button class="ib fill" data-k="${k}-">${ic('down')}</button></div>`).join('<span style="font-size:48px">:</span>')}</div><button class="btn wide" id="alok">${T('Speichern', 'Save', 'حفظ')}</button>`, { mid: true });
  d.addEventListener('click', (e) => { const b = e.target.closest('[data-k]'); if (!b) return; const k = b.dataset.k; if (k[0] === 'h') h = (h + (k[1] === '+' ? 1 : 23)) % 24; else m = (m + (k[1] === '+' ? 5 : 55)) % 60; $('#alh', d).textContent = pad2(h); $('#alm', d).textContent = pad2(m); });
  $('#alok', d).onclick = () => { S.alarms.push({ id: uid(), h, m, on: true, days: '' }); d.remove(); chrome(); R(SF.p); const diff = ((h * 60 + m) - (new Date().getHours() * 60 + new Date().getMinutes()) + 1440) % 1440; toast(T(`Wecker in ${Math.floor(diff / 60)} Std. ${diff % 60} Min.`, `Alarm in ${Math.floor(diff / 60)} h ${diff % 60} min`, `المنبه بعد ${Math.floor(diff / 60)} س ${diff % 60} د`)); };
};
A.tmSet = (m, el, sf) => { CLK.timerStart(+m * 60); R(sf); };
A.tmPause = (v, el, sf) => { const t = CLK.timer; if (t.run) { t.left = CLK.tLeft(); t.run = false; } else { t.t = Date.now(); t.run = true; } R(sf); };
A.tmReset = (v, el, sf) => { CLK.timer = { total: 0, left: 0, run: false, t: 0 }; R(sf); };
A.swGo = (v, el, sf) => { const s = CLK.sw; if (s.run) { s.acc += Date.now() - s.t0; s.run = false; } else { s.t0 = Date.now(); s.run = true; } R(sf); };
A.swLap = (v, el, sf) => { const s = CLK.sw; if (s.run) s.laps.unshift(CLK.swNow()); else CLK.sw = { run: false, t0: 0, acc: 0, laps: [] }; R(sf); };

// ================= Kalender =================
let calOff = 0, calSel = 0;
SC.calendar = {
  b(sf) {
    const now = new Date(); const base = new Date(now.getFullYear(), now.getMonth() + calOff, 1); const first = (base.getDay() + 6) % 7; const days = new Date(base.getFullYear(), base.getMonth() + 1, 0).getDate();
    const wd = Array.from({ length: 7 }, (_, i) => new Intl.DateTimeFormat(LOC(), { weekday: 'narrow' }).format(new Date(2024, 0, 1 + i)));
    const evDays = S.events.map((e) => new Date(now.getFullYear(), now.getMonth(), now.getDate() + e.d).toDateString());
    const hd2 = (d) => { try { return new Intl.DateTimeFormat('en-u-ca-islamic-umalqura', { day: 'numeric' }).format(d); } catch (e) { return ''; } };
    const cells = []; for (let i = 0; i < first; i++) cells.push('<span></span>'); for (let d = 1; d <= days; d++) { const dt = new Date(base.getFullYear(), base.getMonth(), d); const isT = dt.toDateString() === now.toDateString(); const off = Math.round((dt - new Date(now.getFullYear(), now.getMonth(), now.getDate())) / 864e5); cells.push(`<button class="${isT ? 'today' : ''} ${off === calSel && !isT ? 'sel' : ''} ${evDays.includes(dt.toDateString()) ? 'ev' : ''}" data-a="calPick" data-v="${off}"><span class="num">${d}</span><small class="num">${hd2(dt)}</small></button>`); }
    const sel = S.events.filter((e) => e.d === calSel);
    return `${hd(sf, appName('calendar'), `<button class="ib" data-a="calAdd" aria-label="Add">${ic('plus', 22)}</button>`)}<div class="scroll pad">
      <div style="display:flex;align-items:center;justify-content:space-between;margin:0 4px 6px"><button class="ib" data-a="calNav" data-v="-1"><span class="flip">${ic('back', 20)}</span></button><div style="text-align:center"><b style="font-size:17px">${new Intl.DateTimeFormat(LOC(), { month: 'long', year: 'numeric' }).format(base)}</b><div class="muted" style="font-size:12px">${hijri(base)}</div></div><button class="ib" data-a="calNav" data-v="1"><span class="flip">${ic('fwd', 20)}</span></button></div>
      <div class="cal">${wd.map((w) => `<b>${w}</b>`).join('')}${cells.join('')}</div>
      <div class="sec" style="margin-top:12px">${fmtDate(new Date(Date.now() + calSel * 864e5), { weekday: 'long', day: 'numeric', month: 'long' })}</div>
      <div class="list">${sel.length ? sel.map((e) => row({ i: 'cal', c: '#5A4A1C', t: esc(L(e.t)), s: `<span class="ltr">${e.h}</span> · ${T('Erinnerung 15 Min. vorher – der Helfer ruft an', 'Reminder 15 min before – the helper calls', 'تذكير قبل 15 دقيقة – المساعد يتصل')}`, a: 'calRem', d: e.id })).join('') : `<div class="empty">${T('Keine Termine', 'No events', 'لا مواعيد')}</div>`}</div></div>`;
  },
};
A.calNav = (d, el, sf) => { calOff += +d; R(sf); };
A.calPick = (d, el, sf) => { calSel = +d; R(sf); };
A.calRem = () => { closeLayers(); HLP.set('call', 3000); HLP.say(T('Erinnerung: Teammeeting in 15 Minuten! 📞', 'Reminder: team meeting in 15 minutes! 📞', 'تذكير: اجتماع الفريق بعد 15 دقيقة! 📞'), 4500, 'call'); beep([880, 1046, 1318], 0.15, 0.06); };
A.calAdd = () => { const d = sheet(`<h2>${T('Neuer Termin', 'New event', 'موعد جديد')}</h2><div style="margin-bottom:10px">${inp(`id="evt" placeholder="${T('Titel', 'Title', 'العنوان')}"`)}</div><div style="margin-bottom:14px">${inp(`id="evh" value="09:00" placeholder="09:00"`)}</div><button class="btn wide" data-a="calSave">${T('Speichern', 'Save', 'حفظ')}</button>`); setTimeout(() => $('#evt', d).focus(), 250); };
A.calSave = (v, el) => { const t = $('#evt').value.trim() || T('Termin', 'Event', 'موعد'); S.events.push({ id: uid(), d: calSel, h: $('#evh').value, t }); A.closeSheet(v, el); R(SF.p); };

// ================= Rechner =================
let calcE = '', calcR = '', calcTab = 'std', calcHist = [], conv = { k: 'len', v: '1', f: 0, t: 1 }, nbase = '255';
const CONV = { len: [['m', 1], ['km', 1000], ['cm', 0.01], ['mi', 1609.344], ['ft', 0.3048], ['in', 0.0254]], mass: [['kg', 1], ['g', 0.001], ['lb', 0.45359237], ['oz', 0.0283495]], temp: [['°C'], ['°F'], ['K']] };
function calcEval(e) {
  // kleiner Rechenkern ohne eval (CSP-sicher): + − × ÷ %, Klammern, Punkt vor Strich
  const src = e.replace(/×/g, '*').replace(/÷/g, '/').replace(/−/g, '-'); let i = 0;
  const peek = () => src[i], eat = (c) => (src[i] === c ? (i++, true) : false);
  const num = () => { let j = i; while (/[\d.]/.test(src[i] || '')) i++; if (j === i) throw 0; let v = parseFloat(src.slice(j, i)); if (eat('%')) v /= 100; return v; };
  const fac = () => { if (eat('-')) return -fac(); if (eat('+')) return fac(); if (eat('(')) { const v = add(); eat(')'); return eat('%') ? v / 100 : v; } return num(); };
  const mul = () => { let v = fac(); for (;;) { if (eat('*')) v *= fac(); else if (eat('/')) v /= fac(); else return v; } };
  const add = () => { let v = mul(); for (;;) { if (eat('+')) v += mul(); else if (eat('-')) v -= mul(); else return v; } };
  try { if (!src) return ''; const r = add(); if (i < src.length) return ''; return Number.isFinite(r) ? String(+r.toFixed(10)) : ''; } catch (x) { return ''; }
}
SC.calc = {
  b(sf) {
    const tabs = `<div class="tabs">${[['std', T('Standard', 'Standard', 'عادي')], ['conv', T('Einheiten', 'Units', 'الوحدات')], ['base', T('Zahlensysteme', 'Bases', 'أنظمة العد')]].map(([k, n]) => `<button class="${calcTab === k ? 'on' : ''}" data-a="calcTab" data-v="${k}">${n}</button>`).join('')}</div>`;
    if (calcTab === 'conv') { const u = CONV[conv.k]; const val = parseFloat(conv.v) || 0; let res; if (conv.k === 'temp') { const c = conv.f === 0 ? val : conv.f === 1 ? (val - 32) / 1.8 : val - 273.15; res = conv.t === 0 ? c : conv.t === 1 ? c * 1.8 + 32 : c + 273.15; } else res = (val * u[conv.f][1]) / u[conv.t][1]; return `${hd(sf, appName('calc'))}${tabs}<div class="scroll pad"><div class="chips">${[['len', T('Länge', 'Length', 'الطول')], ['mass', T('Gewicht', 'Weight', 'الوزن')], ['temp', T('Temperatur', 'Temperature', 'الحرارة')]].map(([k, n]) => `<button class="pill ${conv.k === k ? 'on' : ''}" data-a="convK" data-v="${k}">${n}</button>`).join('')}</div><div class="card" style="padding:16px">${inp(`data-in="convV" value="${esc(conv.v)}" class="inp num" style="font-size:24px;height:56px"`)}<div class="chips" style="margin-top:10px">${u.map((x, i) => `<button class="pill ${conv.f === i ? 'on' : ''}" data-a="convF" data-v="${i}">${x[0]}</button>`).join('')}</div><div style="text-align:center;margin:6px 0;color:var(--mt)">${ic('down', 22)}</div><div class="num" style="font-size:34px;font-weight:600;text-align:center" id="convR">${+res.toFixed(6)} ${u[conv.t][0]}</div><div class="chips" style="margin-top:10px">${u.map((x, i) => `<button class="pill ${conv.t === i ? 'on' : ''}" data-a="convT" data-v="${i}">${x[0]}</button>`).join('')}</div></div></div>`; }
    if (calcTab === 'base') { const n = parseInt(nbase, 10) || 0; return `${hd(sf, appName('calc'))}${tabs}<div class="scroll pad"><div class="card" style="padding:16px">${inp(`data-in="nbase" value="${esc(nbase)}" class="inp num" style="font-size:24px;height:56px"`)}<div style="margin-top:12px" id="nbr">${baseRows(n)}</div></div></div>`; }
    return `${hd(sf, appName('calc'), `<button class="ib" data-a="calcHist" aria-label="History">${ic('clock', 20)}</button>`)}${tabs}<div style="flex:1;display:flex;flex-direction:column;justify-content:flex-end;padding:0 22px 12px;text-align:end" class="ltr"><div class="num" style="font-size:${calcE.length > 12 ? 30 : 44}px;word-break:break-all">${esc(calcE) || '0'}</div><div class="num muted" style="font-size:22px;min-height:30px">${calcR ? '= ' + calcR : ''}</div></div>
      <div class="calc ltr">${['C', '(', ')', '÷', '7', '8', '9', '×', '4', '5', '6', '−', '1', '2', '3', '+', '%', '0', '.', '='].map((k) => `<button class="${'÷×−+'.includes(k) ? 'op' : k === '=' ? 'eq' : k === 'C' ? 'c' : ''}" data-a="ck" data-v="${k}">${k}</button>`).join('')}</div><div class="calc ltr" style="grid-template-columns:1fr;padding-top:0"><button data-a="ck" data-v="⌫" style="height:44px;font-size:16px">${ic('back', 20)}</button></div>`;
  },
};
function baseRows(n) { return [['DEC', n.toString(10)], ['HEX', n.toString(16).toUpperCase()], ['OCT', n.toString(8)], ['BIN', n.toString(2)]].map(([a, b]) => `<div class="kv"><span>${a}</span><span class="ltr num" style="color:var(--tx);font-size:16px">${b}</span></div>`).join(''); }
A.calcTab = (k, el, sf) => { calcTab = k; R(sf); };
A.ck = (k, el, sf) => { if (k === 'C') { calcE = ''; calcR = ''; } else if (k === '⌫') calcE = calcE.slice(0, -1); else if (k === '=') { if (calcR) { calcHist.unshift(`${calcE} = ${calcR}`); calcE = calcR; calcR = ''; } } else calcE += k; if (k !== '=') calcR = calcEval(calcE); R(sf); };
A.calcHist = () => sheet(`<h2>${T('Verlauf', 'History', 'السجل')}</h2><div class="list">${calcHist.length ? calcHist.map((h) => `<div class="kv ltr" style="padding:12px 14px"><span class="num">${esc(h)}</span></div>`).join('') : `<div class="empty">—</div>`}</div>`);
A.convK = (k, el, sf) => { conv.k = k; conv.f = 0; conv.t = 1; R(sf); };
A.convF = (i, el, sf) => { conv.f = +i; R(sf); };
A.convT = (i, el, sf) => { conv.t = +i; R(sf); };
IN.convV = (v) => { conv.v = v; const u = CONV[conv.k]; const val = parseFloat(v) || 0; let res; if (conv.k === 'temp') { const c = conv.f === 0 ? val : conv.f === 1 ? (val - 32) / 1.8 : val - 273.15; res = conv.t === 0 ? c : conv.t === 1 ? c * 1.8 + 32 : c + 273.15; } else res = (val * u[conv.f][1]) / u[conv.t][1]; $('#convR').textContent = `${+res.toFixed(6)} ${u[conv.t][0]}`; };
IN.nbase = (v) => { nbase = v; $('#nbr').innerHTML = baseRows(parseInt(v, 10) || 0); };

// ================= Notizen =================
SC.notes = {
  b(sf) {
    const ns = [...S.notes].sort((a, b) => (b.pin ? 1 : 0) - (a.pin ? 1 : 0));
    return `${hd(sf, appName('notes'))}<div class="scroll pad"><div class="grid2">${ns.map((n) => `<button class="card" data-a="go" data-v="note:${n.id}" style="padding:14px;text-align:start;min-height:120px;display:flex;flex-direction:column;gap:6px;${n.pin ? 'border-color:color-mix(in srgb,var(--ac) 50%,transparent)' : ''}"><b style="font-size:15px">${n.pin ? '📌 ' : ''}${esc(L(n.t))}</b><span class="muted" style="font-size:13px;line-height:1.45;display:-webkit-box;-webkit-line-clamp:4;-webkit-box-orient:vertical;overflow:hidden">${esc(L(n.b))}</span></button>`).join('')}</div></div><button class="btn" data-a="noteNew" style="position:absolute;bottom:16px;inset-inline-end:16px;width:58px;height:58px;border-radius:20px;padding:0" aria-label="New">${ic('plus', 26)}</button>`;
  },
};
A.noteNew = (v, el, sf) => { const n = { id: uid(), t: '', b: '' }; S.notes.unshift(n); go(sf, 'note:' + n.id); };
SC.note = {
  b(sf, id) {
    const n = S.notes.find((x) => x.id === id); if (!n) return hd(sf, '—');
    return `${hd(sf, '', `<button class="ib" data-a="notePin" data-v="${id}" aria-label="Pin" style="${n.pin ? 'color:var(--ac)' : ''}">${ic('flag', 20)}</button><button class="ib" data-a="noteCopy" data-v="${id}" aria-label="Copy">${ic('copy', 20)}</button><button class="ib" data-a="noteDel" data-v="${id}" aria-label="Delete">${ic('trash', 20)}</button>`)}<div class="scroll pad" style="display:flex;flex-direction:column;gap:10px"><input class="inp" inputmode="${S.desktop ? 'text' : 'none'}" style="font-size:22px;font-weight:650;border:0;background:transparent;padding:0 4px" data-in="noteT" data-v="${id}" value="${esc(L(n.t))}" placeholder="${T('Titel', 'Title', 'العنوان')}"><textarea class="inp" inputmode="${S.desktop ? 'text' : 'none'}" style="flex:1;min-height:420px;border:0;background:transparent;padding:4px;font-size:16px" data-in="noteB" data-v="${id}" placeholder="${T('Notiz …', 'Note …', 'ملاحظة …')}">${esc(L(n.b))}</textarea><div class="muted" style="font-size:12px">${T('Wird fortlaufend gespeichert', 'Saved automatically', 'يُحفظ تلقائياً')} ✓</div></div>`;
  },
  m(el, sf, id) { const n = S.notes.find((x) => x.id === id); if (n && !n.t && !n.b) setTimeout(() => { const t = $('textarea', el); t && t.focus(); }, 250); },
};
IN.noteT = (v, el) => { const n = S.notes.find((x) => x.id === el.dataset.v); if (n) n.t = v; };
IN.noteB = (v, el) => { const n = S.notes.find((x) => x.id === el.dataset.v); if (n) { n.b = v; if (!L(n.t)) n.t = ''; } };
A.notePin = (id, el, sf) => { const n = S.notes.find((x) => x.id === id); n.pin = !n.pin; R(sf); };
A.noteDel = (id, el, sf) => { S.notes = S.notes.filter((x) => x.id !== id); back(sf); };
A.noteCopy = (id) => { const n = S.notes.find((x) => x.id === id); A.copyTxt(L(n.b) || L(n.t)); };

// ================= Kontakte =================
SC.contacts = {
  b(sf) {
    const cs = [...S.contacts].sort((a, b) => a.n.localeCompare(b.n)); let last = '';
    return `${hd(sf, appName('contacts'), `<button class="ib" data-a="conNew" aria-label="Add">${ic('plus', 22)}</button>`)}<div class="scroll pad"><div class="card" style="padding:14px;display:flex;gap:12px;align-items:center;margin-bottom:14px">${avatar('Ich', 46, '#5A4A1C')}<div><b>${T('Mein Profil', 'My profile', 'ملفي')}</b><div class="muted ltr" style="font-size:13px">${S.uos}</div></div></div>${cs.map((c) => { const l = c.n[0].toUpperCase(); const h = l !== last ? `<div class="sec">${l}</div>` : ''; last = l; return h + `<button class="row card" style="border-radius:16px;margin-bottom:6px" data-a="go" data-v="contact:${c.id}">${avatar(c.n, 40, c.c)}<span class="rt"><b>${esc(c.n)}</b></span></button>`; }).join('')}</div>`;
  },
};
SC.contact = {
  b(sf, id) {
    const c = S.contacts.find((x) => x.id === id); if (!c) return hd(sf, '—');
    return `${hd(sf, '', `<button class="ib" data-a="conDel" data-v="${id}" aria-label="Delete">${ic('trash', 20)}</button>`)}<div class="scroll pad"><div class="center" style="flex-direction:column;gap:10px;margin:10px 0 20px">${avatar(c.n, 96, c.c)}<b style="font-size:24px">${esc(c.n)}</b></div><div class="grid3" style="margin-bottom:16px">${[['callN', 'phone', T('Anrufen', 'Call', 'اتصال'), c.n], ['conMsg', 'msg', 'SMS', c.id], ['copyTxt', 'copy', T('Kopieren', 'Copy', 'نسخ'), c.p]].map(([a, i, n, v]) => `<button class="card" data-a="${a}" data-v="${esc(v)}" style="padding:12px;display:flex;flex-direction:column;align-items:center;gap:6px;color:var(--ac)">${ic(i, 22)}<span style="font-size:12px;color:var(--tx)">${n}</span></button>`).join('')}</div><div class="list">${row({ i: 'phone', c: '#2A2D35', t: `<span class="ltr">${esc(c.p)}</span>`, s: /^UOS/.test(c.p) ? T('Ultar-Nummer · verschlüsselt', 'Ultar number · encrypted', 'رقم Ultar · مشفر') : T('Mobil', 'Mobile', 'جوال') })}</div></div>`;
  },
};
A.conMsg = (id) => { const c = S.contacts.find((x) => x.id === id); let ch = S.sms.find((x) => x.n === c.n); if (!ch) { ch = { id: uid(), n: c.n, m: [{ me: 0, x: '👋', t: Date.now() }] }; S.sms.unshift(ch); } openApp('messages'); go(SF.p, `chat:sms:${ch.id}`); };
A.conDel = (id, el, sf) => confirmBox(T('Kontakt löschen?', 'Delete contact?', 'حذف جهة الاتصال؟'), '', T('Löschen', 'Delete', 'حذف'), () => { S.contacts = S.contacts.filter((x) => x.id !== id); back(sf); }, true);
A.conNew = () => { const d = sheet(`<h2>${T('Neuer Kontakt', 'New contact', 'جهة اتصال جديدة')}</h2><div style="margin-bottom:10px">${inp(`id="cn" placeholder="${T('Name', 'Name', 'الاسم')}"`)}</div><div style="margin-bottom:14px">${inp(`id="cp" data-kb="tel" dir="ltr" placeholder="+963 …"`)}</div><button class="btn wide" data-a="conSave">${T('Speichern', 'Save', 'حفظ')}</button>`); setTimeout(() => $('#cn', d).focus(), 250); };
A.conSave = (v, el) => { const n = $('#cn').value.trim(); if (!n) return; S.contacts.push({ id: uid(), n, p: $('#cp').value || '—', c: ['#2B6CB0', '#9B2C6C', '#2F855A', '#B7791F'][S.contacts.length % 4] }); A.closeSheet(v, el); R(SF.p); };

// ================= Werkzeuge =================
const TOOLS = () => [
  { k: 'compass', i: 'compass', t: T('Kompass', 'Compass', 'البوصلة') }, { k: 'level', i: 'level', t: T('Wasserwaage', 'Spirit level', 'ميزان الماء') },
  { k: 'qibla', i: 'kaaba', t: T('Qibla', 'Qibla', 'القبلة') }, { k: 'prayer', i: 'mosque', t: T('Gebetszeiten', 'Prayer times', 'أوقات الصلاة') },
  { k: 'hijri', i: 'cal', t: T('Hijri-Datum', 'Hijri date', 'التاريخ الهجري') }, { k: 'sos', i: 'sos2', t: T('SOS-Licht', 'SOS light', 'ضوء الاستغاثة') },
  { k: 'focus', i: 'focus', t: T('Fokus-Timer', 'Focus timer', 'مؤقت التركيز') }, { k: 'todo', i: 'list', t: T('Aufgaben', 'Tasks', 'المهام') },
  { k: 'torch', i: 'torch', t: T('Taschenlampe', 'Torch', 'المصباح') }, { k: 'ice', i: 'heart', t: T('Notfall-Seite', 'Emergency info', 'معلومات الطوارئ') },
  { k: 'usage', i: 'pulse', t: T('Nutzungszeit', 'Screen time', 'وقت الاستخدام') }, { k: 'modes', i: 'layers', t: T('Modi', 'Modes', 'الأوضاع') },
];
SC.tools = { b: (sf) => `${hd(sf, appName('tools'))}<div class="scroll pad"><div class="grid3">${TOOLS().map((x) => `<button class="card" data-a="go" data-v="tool:${x.k}" style="padding:16px 6px;display:flex;flex-direction:column;align-items:center;gap:10px"><span class="gold">${ic(x.i, 28, 1.6)}</span><span style="font-size:12.5px;text-align:center">${x.t}</span></button>`).join('')}</div></div>` };
let heading = 0, todoIn = '';
const PRAYER = { Berlin: ['06:12', '07:53', '12:06', '14:01', '16:14', '17:48'], Damaskus: ['05:01', '06:24', '11:36', '14:29', '16:52', '18:11'], Mekka: ['05:21', '06:39', '12:08', '15:09', '17:37', '18:55'] };
let prCity = 'Berlin', focusT = null;
SC.tool = {
  b(sf, k) {
    const t = TOOLS().find((x) => x.k === k) || { t: '' }; let b = '';
    if (k === 'compass' || k === 'qibla') { const q = k === 'qibla'; b = `<div class="cmp"><div class="dial" id="dial" style="transform:rotate(${-heading}deg)">${['N', 'O', 'S', 'W'].map((d, i) => `<b style="top:${[8, 103, 198, 103][i]}px;left:${[115, 205, 115, 20][i]}px;transform:none;${i === 0 ? 'color:var(--km)' : ''}">${S.lang === 'en' ? 'NESW'[i] : S.lang === 'ar' ? 'شجق غ'.replace(' ', '')[i] || 'غ' : d}</b>`).join('')}${q ? `<span style="position:absolute;left:50%;top:50%;width:0;height:0;transform:rotate(136deg)"><span style="position:absolute;left:-14px;top:-108px;color:var(--ac)">${ic('kaaba', 28)}</span></span>` : ''}</div><div class="ndl" style="${q ? 'background:var(--ac)' : ''}"></div></div><div style="text-align:center"><div class="num" style="font-size:40px;font-weight:300" id="hdg">${Math.round(heading)}°</div><div class="muted">${q ? T('Richtung Mekka von Berlin: 136° (Südost)', 'Direction of Mecca from Berlin: 136° (south-east)', 'اتجاه مكة من برلين: 136° (جنوب شرق)') : T('Handy drehen – in der Demo dreht sich die Nadel selbst', 'Rotate the phone – in the demo the needle moves itself', 'أدر الهاتف – في العرض تتحرك الإبرة تلقائياً')}</div></div>`; }
    if (k === 'level') b = `<div class="lvl"><div style="position:absolute;left:50%;top:0;bottom:0;width:1px;background:var(--ln)"></div><div style="position:absolute;top:50%;left:0;right:0;height:1px;background:var(--ln)"></div><div style="position:absolute;left:90px;top:90px;width:80px;height:80px;border-radius:50%;border:2px solid var(--ok)"></div><div class="bbl" id="bbl"></div></div><div class="center num" style="font-size:28px" id="lvd">0,0°</div>`;
    if (k === 'prayer') { const p = PRAYER[prCity]; const names = [T('Fadschr', 'Fajr', 'الفجر'), T('Sonnenaufgang', 'Sunrise', 'الشروق'), T('Dhuhr', 'Dhuhr', 'الظهر'), T('Asr', 'Asr', 'العصر'), T('Maghrib', 'Maghrib', 'المغرب'), T('Ischa', 'Isha', 'العشاء')]; const nowM = new Date().getHours() * 60 + new Date().getMinutes(); const nx = p.findIndex((x) => +x.slice(0, 2) * 60 + +x.slice(3) > nowM); b = `<div class="chips">${Object.keys(PRAYER).map((c) => `<button class="pill ${prCity === c ? 'on' : ''}" data-a="prCity" data-v="${c}">${{ Berlin: T('Berlin', 'Berlin', 'برلين'), Damaskus: T('Damaskus', 'Damascus', 'دمشق'), Mekka: T('Mekka', 'Mecca', 'مكة') }[c]}</button>`).join('')}</div><div class="card" style="padding:16px;margin-bottom:12px;text-align:center"><div class="muted" style="font-size:13px">${hijri()}</div><div style="font-size:20px;font-weight:650;margin-top:4px">${nx >= 0 ? T(`Nächstes: ${names[nx]} um ${p[nx]}`, `Next: ${names[nx]} at ${p[nx]}`, `التالي: ${names[nx]} الساعة ${p[nx]}`) : T('Morgen: Fadschr', 'Tomorrow: Fajr', 'غداً: الفجر')}</div></div><div class="list">${p.map((x, i) => row({ i: i === 1 ? 'sun' : 'mosque', c: i === nx ? '#4A421C' : '#2A2D35', t: names[i], v: `<span class="num ${i === nx ? 'gold' : ''}">${x}</span>`, right: i === 1 ? '' : tg(i !== 1, 'noop') })).join('')}</div><div class="muted" style="font-size:12px;margin:10px 4px">${T('Beispielwerte für den 20. November, Berechnung nach Umm al-Qura.', 'Sample values for 20 November, Umm al-Qura method.', 'قيم مثال ليوم 20 نوفمبر، حسب أم القرى.')}</div>`; }
    if (k === 'hijri') b = `<div class="card center" style="padding:30px 16px;flex-direction:column;gap:10px;text-align:center"><span class="gold">${ic('cal', 40, 1.4)}</span><div style="font-size:26px;font-weight:700">${hijri()}</div><div class="muted">${fmtDate(new Date(), { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</div><div style="font-family:'IBM Plex Sans Arabic',sans-serif;font-size:20px;margin-top:8px" dir="rtl">${(() => { try { return new Intl.DateTimeFormat('ar-SA-u-ca-islamic-umalqura-nu-latn', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }).format(new Date()); } catch (e) { return ''; } })()}</div></div>`;
    if (k === 'sos') b = `<div class="center" style="flex-direction:column;gap:16px;padding:30px 10px;text-align:center"><span style="color:var(--bad)">${ic('sos2', 70, 1.3)}</span><div class="muted">${T('Blinkt ··· — — — ··· im Morsecode über Bildschirm und Taschenlampe.', 'Flashes ··· — — — ··· in Morse code via screen and torch.', 'يومض ··· — — — ··· بشفرة مورس عبر الشاشة والمصباح.')}</div><button class="btn red" data-a="sosGo">${T('SOS starten', 'Start SOS', 'ابدأ الاستغاثة')}</button></div>`;
    if (k === 'focus') b = `<div class="center" style="flex-direction:column;gap:16px;padding-top:20px"><div class="ring-score" style="width:220px;height:220px;background:conic-gradient(var(--km) ${focusT ? ((focusT.left / 1500) * 100) : 100}%,var(--s3) 0)" id="fring"><div style="width:196px;height:196px;border-radius:50%;background:var(--bg);display:flex;flex-direction:column;align-items:center;justify-content:center"><span class="num" style="font-size:44px;font-weight:300" id="fval">${focusT ? fmtS(focusT.left).slice(3) : '25:00'}</span><span class="muted" style="font-size:12px">${T('Fokus', 'Focus', 'تركيز')}</span></div></div><button class="btn" data-a="focusGo">${focusT ? T('Beenden', 'Stop', 'إنهاء') : T('25 Min. fokussieren', 'Focus 25 min', 'ركّز 25 دقيقة')}</button><div class="muted" style="font-size:13px;text-align:center;max-width:280px">${T('Während des Fokus sind Benachrichtigungen stumm.', 'Notifications are muted during focus.', 'الإشعارات صامتة أثناء التركيز.')}</div></div>`;
    if (k === 'todo') b = `<div style="display:flex;gap:8px;margin-bottom:12px">${inp(`id="tdin" data-enter="todoAdd" placeholder="${T('Neue Aufgabe', 'New task', 'مهمة جديدة')}"`)}<button class="ib" style="background:var(--ac);color:var(--onac)" data-a="todoAdd" aria-label="Add">${ic('plus', 22)}</button></div><div class="list">${S.todos.map((d) => `<div class="row"><button class="tg" data-a="todoTog" data-v="${d.id}" style="width:26px;height:26px;border-radius:8px;${d.ok ? 'background:var(--ac)' : ''}" aria-label="done">${d.ok ? `<span style="color:var(--onac);position:absolute;inset:0;display:flex;align-items:center;justify-content:center">${ic('check', 16, 2.6)}</span>` : ''}</button><span class="rt"><b style="${d.ok ? 'text-decoration:line-through;opacity:.5' : ''}">${esc(L(d.t))}</b></span><button class="ib" data-a="todoDel" data-v="${d.id}" aria-label="Delete">${ic('trash', 18)}</button></div>`).join('')}</div>`;
    if (k === 'torch') b = `<div class="center" style="flex-direction:column;gap:24px;padding-top:40px"><button data-a="qTorch2" style="width:160px;height:160px;border-radius:80px;border:0;background:${S.torch ? 'radial-gradient(circle,#FFF8D8,#F0E8A0 60%,#D8C870)' : 'var(--s2)'};color:${S.torch ? '#10100A' : 'var(--tx)'};box-shadow:${S.torch ? '0 0 80px rgba(240,232,160,.6)' : 'none'}">${ic('torch', 60, 1.4)}</button><div class="muted">${S.torch ? T('An – Licht am Gerät oben', 'On – light at the top of the device', 'يعمل – الضوء أعلى الجهاز') : T('Aus', 'Off', 'متوقف')}</div></div>`;
    if (k === 'ice') b = `<div class="card" style="padding:16px;border-color:var(--bad)"><b style="color:var(--bad)">${T('Notfall-Informationen', 'Emergency information', 'معلومات الطوارئ')}</b><div class="muted" style="font-size:13px;margin:4px 0 10px">${T('auch auf dem Sperrbildschirm sichtbar', 'also visible on the lock screen', 'مرئية أيضاً على شاشة القفل')}</div>${[[T('Blutgruppe', 'Blood type', 'فصيلة الدم'), '[—]'], [T('Allergien', 'Allergies', 'الحساسية'), '[—]'], [T('Notfallkontakt', 'Emergency contact', 'جهة اتصال الطوارئ'), 'Mama']].map(([a, b2]) => `<div class="kv"><span>${a}</span><span>${b2}</span></div>`).join('')}</div><div class="grid2" style="margin-top:14px"><button class="btn red" data-a="callN" data-v="112">${ic('phone', 18)} 112</button><button class="btn dark" data-a="callN" data-v="Mama">${ic('phone', 18)} Mama</button></div>`;
    if (k === 'usage') b = `<div class="card" style="padding:16px;margin-bottom:12px"><div class="muted" style="font-size:12px">${T('Heute', 'Today', 'اليوم')}</div><div style="font-size:30px;font-weight:700">2 ${T('Std.', 'h', 'س')} 12 min</div></div><div class="list">${S.usage.map(([a, m]) => `<div class="row"><span class="ri" style="background:#2A2D35">${ic(APPS[a].i, 18)}</span><span class="rt"><b>${appName(a)}</b><div class="bar" style="margin-top:6px"><i style="width:${(m / 52) * 100}%"></i></div></span><span class="rv num">${m} min</span></div>`).join('')}</div>`;
    if (k === 'modes') b = `<div class="list">${[['moon', T('Schlafmodus', 'Sleep mode', 'وضع النوم'), T('Graustufen, Nicht stören, Wecker bleibt', 'Greyscale, DND, alarm stays', 'تدرج رمادي، عدم إزعاج، يبقى المنبه')], ['focus', T('Arbeit', 'Work', 'العمل'), T('Nur Arbeits-Apps melden sich', 'Only work apps notify', 'تطبيقات العمل فقط')], ['cam', T('Kiosk', 'Kiosk', 'الكشك'), T('Eine App im Vollbild, gesperrt', 'One app full-screen, locked', 'تطبيق واحد بملء الشاشة مقفل')], ['leaf', T('Reise', 'Travel', 'السفر'), T('Roaming aus, Energiesparen an', 'Roaming off, saver on', 'التجوال متوقف، التوفير يعمل')]].map(([i, t2, s]) => row({ i, c: '#2A2D35', t: t2, s, right: tg(false, 'modeTog') })).join('')}</div>`;
    return `${hd(sf, t.t)}<div class="scroll pad">${b}</div>`;
  },
  m(el, sf, k) {
    if (k === 'compass' || k === 'qibla') { const iv = setInterval(() => { heading = (heading + (Math.random() * 6 - 2) + 360) % 360; const d = $('#dial', el); if (d) { d.style.transform = `rotate(${-heading}deg)`; $('#hdg', el).textContent = Math.round(heading) + '°'; } }, 400); return () => clearInterval(iv); }
    if (k === 'level') { let t = 0; const iv = setInterval(() => { t += 0.15; const x = Math.sin(t) * 30, y = Math.cos(t * 0.7) * 20; const b = $('#bbl', el); if (b) { b.style.transform = `translate(${x}px,${y}px)`; $('#lvd', el).textContent = (Math.hypot(x, y) / 10).toFixed(1).replace('.', S.lang === 'en' ? '.' : ',') + '°'; } }, 200); return () => clearInterval(iv); }
    if (k === 'focus') { const iv = setInterval(() => { if (!focusT) return; focusT.left = Math.max(0, 1500 - (Date.now() - focusT.t0) / 1000); const v = $('#fval', el); if (v) { v.textContent = fmtS(focusT.left).slice(3); $('#fring', el).style.background = `conic-gradient(var(--km) ${(focusT.left / 1500) * 100}%,var(--s3) 0)`; } }, 500); return () => clearInterval(iv); }
  },
};
A.prCity = (c, el, sf) => { prCity = c; R(sf); };
A.qTorch2 = (v, el, sf) => { A.qTorch(); R(sf); };
A.modeTog = (v, el) => { el.classList.toggle('on'); };
A.focusGo = (v, el, sf) => { if (focusT) { focusT = null; S.dnd = false; } else { focusT = { t0: Date.now(), left: 1500 }; S.dnd = true; } chrome(); R(sf); };
A.todoAdd = () => { const i = $('#tdin'); const v = i.value.trim(); if (!v) return; S.todos.unshift({ id: uid(), t: v, ok: false }); R(SF.p); setTimeout(() => { const n = $('#tdin'); n && n.focus(); }, 60); };
A.todoTog = (id, el, sf) => { const d = S.todos.find((x) => x.id === id); d.ok = !d.ok; R(sf); };
A.todoDel = (id, el, sf) => { S.todos = S.todos.filter((x) => x.id !== id); R(sf); };
A.sosGo = () => {
  const host = S.desktop ? DESK.layerHost() : $('#layers'); const d = document.createElement('div'); d.className = 'sos'; d.innerHTML = `<div style="font-size:60px;font-weight:900">SOS</div><button class="btn" style="background:#000;color:#fff" id="sosx">${T('Beenden', 'Stop', 'إيقاف')}</button>`; host.appendChild(d);
  const seq = [1, 0, 1, 0, 1, 0, 0, 3, 0, 3, 0, 3, 0, 0, 1, 0, 1, 0, 1, 0, 0, 0]; let i = 0; let on = true;
  const step = () => { if (!on) return; const v = seq[i % seq.length]; d.style.background = v ? '#fff' : '#111'; S.torch = !!v; chrome(); i++; setTimeout(step, v === 3 ? 600 : 220); }; step();
  $('#sosx', d).onclick = () => { on = false; S.torch = false; chrome(); d.remove(); };
};

// ================= Browser =================
let tabs2 = 1, bQ = '';
const PAGES = {
  start: () => `<div style="padding:26px 18px;display:flex;flex-direction:column;gap:18px"><div style="text-align:center"><img src="${LOGO}" alt="" style="width:170px"></div>${inp(`id="bsearch" data-enter="bGo" placeholder="${T('Suchen oder Adresse eingeben', 'Search or type address', 'ابحث أو اكتب العنوان')}"`)}<div class="grid4">${[['code-craft.tech', 'globe'], ['wikipedia.org', 'file'], ['youtube.com', 'yt'], ['web.whatsapp.com', 'wa'], ['maps.code-craft.tech', 'loc'], ['news.example', 'note'], ['paket-zustellung-de.example/login', 'warn'], ['github.com', 'term']].map(([u, i]) => `<button class="app" data-a="bOpen" data-v="${u}"><span class="ic" style="width:52px;height:52px">${ic(i, 22)}</span><span style="max-width:76px">${u.split('/')[0].replace(/\.(tech|org|com|example)$/, '')}</span></button>`).join('')}</div><div class="card" style="padding:14px;display:flex;gap:12px;align-items:center"><span class="gold">${ic('shieldOk', 26)}</span><div><b>${S.trackers} ${T('Tracker gesperrt', 'trackers blocked', 'متتبعاً محجوباً')}</b><div class="muted" style="font-size:12.5px">${T('Keine Werbung, kein Verfolgen – auf jeder Seite.', 'No ads, no tracking – on every site.', 'لا إعلانات ولا تتبع – في كل موقع.')}</div></div></div></div>`,
  'code-craft.tech': () => `<div style="background:#0b1220;color:#E8E6E0;min-height:100%;padding:22px 18px"><img src="${LOGO}" alt="" style="width:140px"><h2 style="font-size:24px;margin:22px 0 8px">${T('Technologie. Handgemacht.', 'Technology. Crafted.', 'تقنية. بإتقان.')}</h2><p style="opacity:.75;line-height:1.6;font-size:14px">${T('KM Code Craft entwickelt Software, Hardware und Ultar OS – ein eigenes Betriebssystem in Rust.', 'KM Code Craft builds software, hardware and Ultar OS – our own operating system in Rust.', 'تطوّر KM Code Craft البرمجيات والعتاد ونظام Ultar OS – نظام تشغيل خاص بلغة Rust.')}</p><div class="card" style="padding:14px;margin-top:16px;background:#121a2b;border-color:#24304a"><b>Ultar OS 0.6</b><div style="opacity:.7;font-size:13px;margin-top:4px">${T('Sie testen gerade die Demo 😉', 'You are testing the demo right now 😉', 'أنت تجرب العرض الآن 😉')}</div></div></div>`,
  'news.example': () => `<div style="padding:18px"><h2 style="font-size:22px;margin:0 0 8px">${T('Nachrichten des Tages', 'Today\'s news', 'أخبار اليوم')}</h2>${[1, 2, 3].map((i) => `<div class="card" style="padding:14px;margin-bottom:10px"><div style="height:120px;border-radius:12px;background:${S.gallery[i].g};margin-bottom:10px"></div><b>${T('Beispielartikel', 'Sample article', 'مقال تجريبي')} ${i}</b><div class="muted" style="font-size:13px;margin-top:4px">${T('Text der Seite (Demo).', 'Page text (demo).', 'نص الصفحة (عرض).')}</div></div>${i === 1 ? `<div style="border:1px dashed var(--ln);border-radius:12px;padding:10px;text-align:center;font-size:12px;color:var(--mt);margin-bottom:10px">${ic('shield', 14)} ${T('Werbung entfernt', 'Ad removed', 'تمت إزالة إعلان')}</div>` : ''}`).join('')}</div>`,
};
SC.browser = {
  b(sf) {
    const u = S.browserUrl; const page = PAGES[u] ? PAGES[u]() : `<div class="center" style="flex-direction:column;gap:12px;padding:50px 24px;text-align:center"><span class="muted">${ic('globe', 44, 1.3)}</span><b class="ltr">${esc(u)}</b><div class="muted" style="font-size:13.5px;line-height:1.5">${T('Im echten Ultar OS wird die Seite hier mit der Web-Engine geladen. In der Demo zeigen wir nur die Oberfläche.', 'In the real Ultar OS the page loads here with the web engine. The demo only shows the interface.', 'في Ultar OS الحقيقي تُحمّل الصفحة هنا بمحرك الويب. العرض يُظهر الواجهة فقط.')}</div></div>`;
    return `<div style="display:flex;gap:6px;align-items:center;padding:6px 10px"><button class="ib" data-a="bBack" aria-label="Back"><span class="flip">${ic('back', 20)}</span></button><div style="flex:1;height:42px;border-radius:21px;background:var(--s1);border:1px solid var(--ln);display:flex;align-items:center;gap:8px;padding:0 12px" data-a="bAddr"><span style="color:${u === 'start' ? 'var(--mt)' : 'var(--ok)'}">${ic(u === 'start' ? 'search' : 'lock', 15)}</span><span class="ltr" style="flex:1;font-size:13.5px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;text-align:start">${u === 'start' ? T('Suchen oder Adresse', 'Search or address', 'ابحث أو العنوان') : esc(u)}</span><span class="gold" style="display:flex;align-items:center;gap:2px;font-size:11px">${ic('shield', 14)}${Math.floor(S.trackers % 17) + 3}</span></div><button class="ib" data-a="bTabs" aria-label="Tabs" style="border:1.5px solid var(--tx);width:28px;height:28px;border-radius:8px;font-size:12px;font-weight:700">${tabs2}</button><button class="ib" data-a="bMenu" aria-label="Menu">${ic('more', 20)}</button></div><div class="scroll" style="background:var(--bg)">${page}</div>`;
  },
  m() { HLP.tip('browser'); },
};
A.bOpen = (u, el, sf) => { if (S.linkcheck && linkVerdict(u).length) { HLP.openChat(T(`Ist ${u} sicher?`, `Is ${u} safe?`, `هل ${u} آمن؟`)); return; } S.browserUrl = u; R(sf); };
A.bGo = (v, el, sf) => { const q = v.trim(); if (!q) return; const u = /\./.test(q) && !/\s/.test(q) ? q.replace(/^https?:\/\//, '') : 'duckduckgo.com/?q=' + q; A.bOpen(u, el, sf || SF.p); };
A.bBack = (v, el, sf) => { if (S.browserUrl !== 'start') { S.browserUrl = 'start'; R(sf); } else A.back(v, el, sf); };
A.bAddr = (v, el, sf) => { S.browserUrl = 'start'; R(sf); setTimeout(() => { const i = $('#bsearch', sf.el); i && i.focus(); }, 100); };
A.bTabs = (v, el, sf) => { tabs2 = tabs2 % 3 + 1; R(sf); };
A.bMenu = (v, el) => { const r = el.getBoundingClientRect(); menu([{ i: 'plus', t: T('Neuer Tab', 'New tab', 'علامة تبويب جديدة'), f: () => { tabs2++; S.browserUrl = 'start'; R(SF.p); } }, { i: 'eyeOff', t: T('Privater Tab', 'Private tab', 'تبويب خاص'), f: () => toast(T('Privater Tab – nichts wird gespeichert', 'Private tab – nothing is saved', 'تبويب خاص – لا يُحفظ شيء')) }, { i: 'star', t: T('Lesezeichen', 'Bookmark', 'إشارة مرجعية'), f: () => toast(T('Gespeichert', 'Saved', 'تم الحفظ')) }, { i: 'link', t: T('Link prüfen', 'Check link', 'افحص الرابط'), f: () => HLP.openChat(T(`Ist ${S.browserUrl} sicher?`, `Is ${S.browserUrl} safe?`, `هل ${S.browserUrl} آمن؟`)) }, { i: 'desk', t: T('Desktop-Ansicht', 'Desktop site', 'نسخة سطح المكتب'), f: () => toast('OK') }], r.left - 150, r.bottom); };

// Web-Apps
const webApp = (name, icn, col, url, txt) => ({ b: (sf) => `${hd(sf, name)}<div class="scroll pad center" style="flex-direction:column;gap:14px;text-align:center;padding-top:40px"><span style="width:90px;height:90px;border-radius:28px;background:${col}22;color:${col};display:flex;align-items:center;justify-content:center">${ic(icn, 48, 1.5)}</span><b style="font-size:20px">${name}</b><div class="muted" style="font-size:14px;line-height:1.55;max-width:300px">${txt()}</div><div class="card" style="padding:12px 14px;font-size:13px;display:flex;gap:10px;align-items:center;text-align:start"><span class="gold">${ic('shieldOk', 20)}</span>${T('Eigenes, dauerhaftes Profil – nur einmal anmelden. Werbung gesperrt.', 'Own persistent profile – sign in once. Ads blocked.', 'ملف خاص دائم – سجّل الدخول مرة واحدة. الإعلانات محجوبة.')}</div><button class="btn" data-a="bOpenApp" data-v="${url}">${ic('globe', 18)} ${T('Öffnen', 'Open', 'فتح')} <span class="ltr">${url}</span></button></div>` });
SC.whatsapp = webApp('WhatsApp', 'wa', '#25D366', 'web.whatsapp.com', () => T('Läuft als Web-App mit getrenntem Profil.', 'Runs as a web app with a separate profile.', 'يعمل كتطبيق ويب بملف منفصل.'));
SC.youtube = webApp('YouTube', 'yt', '#FF4E45', 'youtube.com', () => T('Ohne Werbung, ohne Verfolgung, mit Hintergrund-Wiedergabe.', 'No ads, no tracking, with background playback.', 'دون إعلانات ودون تتبع، مع التشغيل في الخلفية.'));
SC.spotify = webApp('Spotify', 'spot', '#1DB954', 'open.spotify.com', () => T('Offizielles Spotify Connect: das Gerät erscheint als Lautsprecher „Ultar“.', 'Official Spotify Connect: the device appears as speaker "Ultar".', 'Spotify Connect الرسمي: يظهر الجهاز كمكبر «Ultar».'));
A.bOpenApp = (u) => { openApp('browser'); S.browserUrl = u; R(SF.p); };
SC.kmpos = { b: (sf) => `${hd(sf, 'KM POS')}<div class="scroll pad"><div class="card" style="padding:16px;margin-bottom:12px;display:flex;justify-content:space-between;align-items:center"><div><div class="muted" style="font-size:12px">${T('Umsatz heute', 'Sales today', 'مبيعات اليوم')}</div><div style="font-size:28px;font-weight:700" class="num">[—]</div></div><span class="pill on">${T('Server läuft', 'Server running', 'الخادم يعمل')}</span></div><div class="grid3">${[['box', T('Artikel', 'Items', 'الأصناف')], ['calc', T('Kasse', 'Checkout', 'الصندوق')], ['list', T('Lager', 'Stock', 'المخزون')], ['users', T('Kunden', 'Customers', 'العملاء')], ['pulse', T('Berichte', 'Reports', 'التقارير')], ['gear', T('Einstellungen', 'Settings', 'الإعدادات')]].map(([i, n]) => `<button class="card" data-a="noop" style="padding:16px 6px;display:flex;flex-direction:column;align-items:center;gap:8px"><span class="gold">${ic(i, 26)}</span><span style="font-size:12.5px">${n}</span></button>`).join('')}</div><div class="muted" style="font-size:12.5px;margin:14px 4px;line-height:1.5">${T('Kassen-, Lager- und ERP-System von KM Code Craft – als signiertes Paket aus dem Ultar Store.', 'POS, stock and ERP system by KM Code Craft – as a signed package from the Ultar Store.', 'نظام الكاشير والمخزون وERP من KM Code Craft – كحزمة موقّعة من متجر Ultar.')}</div></div>` };
const deskApp = (name) => ({ b: (sf) => `${hd(sf, name)}<div class="scroll pad center" style="flex-direction:column;gap:14px;text-align:center;padding-top:50px"><span class="muted">${ic('desk', 50, 1.3)}</span><div class="muted" style="max-width:290px;line-height:1.55">${T(`${name} ist ein Ubuntu-Programm mit Fenster – es läuft im Desktop-Modus.`, `${name} is a windowed Ubuntu program – it runs in desktop mode.`, `${name} برنامج أوبونتو بنافذة – يعمل في وضع سطح المكتب.`)}</div><button class="btn" data-a="deskOn">${ic('desk', 18)} ${T('Desktop-Modus starten', 'Start desktop mode', 'تشغيل وضع سطح المكتب')}</button></div>` });
SC.libre = deskApp('LibreOffice'); SC.vscode = deskApp('VS Code');
SC.android = { b: (sf) => `${hd(sf, appName('android'))}<div class="scroll pad center" style="flex-direction:column;gap:14px;text-align:center;padding-top:40px"><span class="muted">${ic('box', 56, 1.3)}</span><b>${T('Geplant', 'Planned', 'مخطط')}</b><div class="muted" style="max-width:300px;line-height:1.55">${T('Android-Apps optional in einem streng abgeschotteten Bereich – ohne Google-Dienste, standardmäßig aus, jederzeit vollständig löschbar.', 'Android apps optionally in a strictly isolated area – no Google services, off by default, fully removable at any time.', 'تطبيقات أندرويد اختيارياً في منطقة معزولة تماماً – دون خدمات Google، متوقفة افتراضياً، قابلة للحذف بالكامل.')}</div></div>` };

// ================= Ultar Store =================
const STORE = [
  { id: 'kmpos', d: () => T('Kasse, Lager, ERP', 'POS, stock, ERP', 'كاشير، مخزون، ERP'), sz: '6,2 MB', by: 'KM Code Craft' },
  { id: 'spotify', d: () => T('Musik über Spotify Connect', 'Music via Spotify Connect', 'موسيقى عبر Spotify Connect'), sz: '1,1 MB', by: 'KM Code Craft' },
  { id: 'libre', d: () => T('Office-Paket (Ubuntu)', 'Office suite (Ubuntu)', 'حزمة مكتبية (أوبونتو)'), sz: '412 MB', by: 'Ubuntu · The Document Foundation' },
  { id: 'vscode', d: () => T('Code-Editor (Ubuntu)', 'Code editor (Ubuntu)', 'محرر برمجي (أوبونتو)'), sz: '98 MB', by: 'Ubuntu · Microsoft' },
  { id: 'android', d: () => T('Abgeschottete Android-Apps', 'Isolated Android apps', 'تطبيقات أندرويد معزولة'), sz: '—', by: 'KM Code Craft', soon: 1 },
];
const instState = {};
SC.store = {
  b(sf) {
    return `${hd(sf, appName('store'))}<div class="scroll pad"><div class="card" style="padding:18px;margin-bottom:14px;background:linear-gradient(135deg,color-mix(in srgb,var(--ac) 22%,var(--s1)),var(--s1) 70%)"><div class="muted" style="font-size:12px">${T('Empfohlen', 'Featured', 'مميز')}</div><b style="font-size:20px">KM POS 2.4</b><div class="muted" style="font-size:13px;margin-top:4px">${T('Jede App ist mit Ed25519 signiert und wird auf dem Gerät geprüft.', 'Every app is signed with Ed25519 and verified on the device.', 'كل تطبيق موقّع بـ Ed25519 ويُتحقق منه على الجهاز.')}</div></div>
    <div class="list">${STORE.map((a) => { const inst = S.installed.includes(a.id); const st = instState[a.id]; return `<div class="row"><span class="ri" style="background:#2A2D35;width:46px;height:46px;border-radius:14px">${appIcon(a.id, 24)}</span><span class="rt"><b>${appName(a.id)}</b><small>${a.d()} · ${a.sz}</small>${st ? `<div class="bar" style="margin-top:6px"><i style="width:${st.p}%"></i></div><small style="color:var(--ac)">${st.msg}</small>` : ''}</span>${a.soon ? `<span class="pill">${T('Bald', 'Soon', 'قريباً')}</span>` : inst ? `<button class="btn sm ghost" data-a="open" data-v="${a.id}">${T('Öffnen', 'Open', 'فتح')}</button>` : st ? '' : `<button class="btn sm" data-a="stInst" data-v="${a.id}">${T('Installieren', 'Install', 'تثبيت')}</button>`}</div>`; }).join('')}</div>
    <div class="sec">Ubuntu (apt)</div><div class="list">${['htop', 'ffmpeg', 'python3', 'git', 'gimp'].map((p) => row({ i: 'ubuntu', c: '#5A2A1C', t: `<span class="ltr">${p}</span>`, s: 'Ubuntu 24.04', right: `<button class="btn sm ghost" data-a="aptInst" data-v="${p}">apt</button>` })).join('')}</div></div>`;
  },
  m() { HLP.tip('store'); },
};
A.stInst = (id, el, sf) => {
  const steps = [[20, T('Laden …', 'Downloading …', 'تنزيل …')], [55, T('Laden …', 'Downloading …', 'تنزيل …')], [75, T('Signatur prüfen (Ed25519) …', 'Verifying signature (Ed25519) …', 'التحقق من التوقيع (Ed25519) …')], [92, T('Installieren …', 'Installing …', 'تثبيت …')], [100, T('Fertig ✓', 'Done ✓', 'تم ✓')]];
  steps.forEach(([p, msg], i) => setTimeout(() => { instState[id] = { p, msg }; if (cur(SF.p) === 'store') R(SF.p); if (p === 100) setTimeout(() => { delete instState[id]; S.installed.push(id); R(SF.p); notify({ app: 'store', title: T(`${appName(id)} installiert`, `${appName(id)} installed`, `تم تثبيت ${appName(id)}`), body: T('Signatur geprüft · auf dem Startbildschirm', 'Signature verified · on the home screen', 'تم التحقق من التوقيع · على الشاشة الرئيسية') }); }, 500); }, 500 * (i + 1)));
  instState[id] = { p: 5, msg: T('Warte …', 'Waiting …', 'انتظار …') }; R(sf);
};
A.aptInst = (p) => { openApp('terminal'); setTimeout(() => TERM.run(`sudo apt install ${p}`), 300); };

// ================= Monitor =================
let monTab = 'load';
const MON = { cpu: Array(60).fill(10), up: Array(60).fill(2), down: Array(60).fill(20) };
setInterval(() => { MON.cpu.push(cpu() + (Math.random() < 0.1 ? 30 : 0)); MON.cpu.shift(); MON.up.push(Math.random() * 6 + (Math.random() < 0.05 ? 40 : 0)); MON.up.shift(); MON.down.push(Math.random() * 60 + 10); MON.down.shift(); }, 1000);
function spark(arr, max, color, h = 90) { const w = 340; const pts = arr.map((v, i) => `${(i / (arr.length - 1)) * w},${h - (Math.min(v, max) / max) * (h - 6) - 3}`).join(' '); return `<svg viewBox="0 0 ${w} ${h}" width="100%" height="${h}" preserveAspectRatio="none" style="display:block"><polyline points="0,${h} ${pts} ${w},${h}" fill="${color}22" stroke="none"/><polyline points="${pts}" fill="none" stroke="${color}" stroke-width="2" vector-effect="non-scaling-stroke"/></svg>`; }
SC.monitor = {
  b(sf) {
    const tabs = `<div class="tabs">${[['load', T('Auslastung', 'Load', 'الحمل')], ['net', T('Datenverkehr', 'Traffic', 'حركة البيانات')], ['proc', T('Prozesse', 'Processes', 'العمليات')]].map(([k, n]) => `<button class="${monTab === k ? 'on' : ''}" data-a="monTab" data-v="${k}">${n}</button>`).join('')}</div>`;
    return `${hd(sf, appName('monitor'))}${tabs}<div class="scroll pad" id="monb">${monBody()}</div>`;
  },
  m(el) { HLP.tip('monitor'); const iv = setInterval(() => { const b = $('#monb', el); if (b) b.innerHTML = monBody(); }, 1000); return () => clearInterval(iv); },
};
function monBody() {
  const c = MON.cpu[MON.cpu.length - 1];
  if (monTab === 'load') return `<div class="card" style="padding:14px;margin-bottom:12px"><div style="display:flex;justify-content:space-between"><b>${T('Prozessor', 'Processor', 'المعالج')}</b><span class="num gold">${c} %</span></div>${spark(MON.cpu, 100, '#D8C870')}<div class="grid4" style="gap:6px;margin-top:8px">${Array.from({ length: 8 }, (_, i) => { const v = Math.max(1, Math.round(c * (0.4 + Math.random()))); return `<div style="font-size:10px" class="muted">C${i}<div class="bar" style="height:5px"><i style="width:${Math.min(v, 100)}%"></i></div></div>`; }).join('')}</div></div>
    <div class="grid2" style="margin-bottom:12px">${[['RAM', '1,02 / 2,8 GB', 36], ['GPU (Mali-G71)', `${Math.round(c / 3)} %`, c / 3], ['NPU', '0 %', 0], [T('Temperatur', 'Temperature', 'الحرارة'), '34 °C', 34]].map(([n, v, p]) => `<div class="card" style="padding:12px"><div class="muted" style="font-size:12px">${n}</div><div class="num" style="font-size:18px;font-weight:650;margin:2px 0 6px">${v}</div><div class="bar" style="height:5px"><i style="width:${p}%"></i></div></div>`).join('')}</div><div class="muted" style="font-size:12.5px;line-height:1.5">${T('Die Oberfläche selbst braucht ≈ 65 MB RAM – Android über 1 GB.', 'The interface itself needs ≈ 65 MB RAM – Android over 1 GB.', 'الواجهة نفسها تحتاج ≈ 65 ميغابايت – أندرويد أكثر من 1 غيغابايت.')}</div>`;
  if (monTab === 'net') { const u = MON.up[MON.up.length - 1], d = MON.down[MON.down.length - 1]; return `<div class="card" style="padding:14px;margin-bottom:12px"><div style="display:flex;justify-content:space-between"><b>↑ Upload</b><span class="num" style="color:${u > 30 ? 'var(--bad)' : 'var(--ac)'}">${u.toFixed(1)} KB/s</span></div>${spark(MON.up, 50, u > 30 ? '#F87171' : '#D8C870', 70)}</div><div class="card" style="padding:14px;margin-bottom:12px"><div style="display:flex;justify-content:space-between"><b>↓ Download</b><span class="num" style="color:#5B8DEF">${d.toFixed(0)} KB/s</span></div>${spark(MON.down, 80, '#5B8DEF', 70)}</div><div class="list">${[['browser', '1,2 MB', '18 MB'], ['telegram', '310 KB', '2,4 MB'], ['terminal', '12 KB', '640 KB']].map(([a, up, dn]) => row({ i: APPS[a].i, c: '#2A2D35', t: appName(a), v: `<span class="ltr num">↑${up} ↓${dn}</span>` })).join('')}</div>`; }
  return `<div class="list">${[['ultar-shell', 9.2, 1.4], ['llm (Qwen3)', 640, 0.2], ['ultar-net', 2.1, 0.1], ['ultar-audio', 3.4, 0.3], ['ultar-ril', 2.8, 0.2], ['wpa_supplicant', 4.1, 0.1], ['ultar-init', 1.5, 0]].map(([n, m, c2]) => `<div class="row"><span class="rt"><b class="ltr" style="text-align:start">${n}</b><small class="num">${m} MB · CPU ${(c2 + Math.random() * 0.4).toFixed(1)} %</small></span><button class="pill" data-a="procKill" data-v="${n}">${T('Beenden', 'Kill', 'إنهاء')}</button></div>`).join('')}</div>`;
}
A.monTab = (k, el, sf) => { monTab = k; R(sf); };
A.procKill = (n) => toast(n === 'ultar-init' ? T('PID 1 kann nicht beendet werden', 'PID 1 cannot be killed', 'لا يمكن إنهاء PID 1') : T(`${n} beendet – ultar-init startet neu`, `${n} killed – ultar-init restarts it`, `تم إنهاء ${n} – يعيد ultar-init تشغيله`));

// ================= Terminal =================
const TERM = {
  lines: [], cwd: '~',
  init() { if (!this.lines.length) this.lines.push('<b>Ultar OS 0.6.0</b> (Linux 4.4.177 aarch64) · KM Code Craft', T('Tippe „help“ für Befehle.', 'Type "help" for commands.', 'اكتب «help» للأوامر.'), ''); },
  out(s) { this.lines.push(s); },
  async run(cmd) {
    this.init(); this.out(`<span style="color:#D8C870">ultar@a30</span>:<span style="color:#7AB8FF">${this.cwd}</span>$ ${esc(cmd)}`);
    const [c, ...a] = cmd.trim().split(/\s+/); const fsDirs = Object.keys(S.files);
    const map = {
      help: () => 'help ls cd pwd cat uname free df uptime date whoami ultar-ctl ultar-info neofetch apt top ps clear echo exit',
      ls: () => (this.cwd === '~' ? fsDirs.map((d) => `<span style="color:#7AB8FF">${d}/</span>`).join('  ') : (S.files[this.cwd.slice(2)] || []).map((f) => f[0]).join('  ')),
      cd: () => { const d = a[0]; if (!d || d === '~' || d === '..') this.cwd = '~'; else if (fsDirs.includes(d.replace('/', ''))) this.cwd = '~/' + d.replace('/', ''); else return `cd: ${esc(d)}: No such directory`; return ''; },
      pwd: () => '/data/home/ultar' + this.cwd.slice(1), whoami: () => 'ultar', date: () => new Date().toString(), echo: () => esc(a.join(' ')),
      uname: () => 'Linux a30 4.4.177 #1 SMP PREEMPT aarch64 Ultar/GNU',
      free: () => '              total     used     free\nMem:          2.8Gi    1.0Gi    1.8Gi\nSwap:          0B       0B       0B',
      df: () => 'Filesystem     Size  Used Avail Use% Mounted on\n/dev/mmcblk0p25 3.9G  210M  3.7G   6% /\n/dev/mapper/data 51G  18G   33G  35% /data (LUKS2)\n/dev/mmcblk0p26 568M  412M  156M  73% /vendor',
      uptime: () => ` ${fmtTime()} up 3 days,  4:12,  1 user,  load average: 0.08, 0.12, 0.10`,
      'ultar-ctl': () => (a[0] === 'status' || !a[0] ? S.services.map((s) => `${s[1] ? '<span style="color:#4ADE80">●</span>' : '<span style="color:#777">○</span>'} ${s[0].padEnd(28)} ${s[1] ? 'running' : 'stopped'}`).join('\n') : `ultar-ctl: ${esc(a[0])} ok`),
      'ultar-info': () => this.neo(), neofetch: () => this.neo(),
      ps: () => '  PID  RSS   COMMAND\n    1  1.5M  ultar-init\n  212  9.2M  ultar-shell\n  230  2.1M  ultar-net\n  245  3.4M  ultar-audio\n  301  640M  llama-server (compat)',
      top: () => `CPU ${cpu()}%  MEM 36%  TASKS 41\n` + map.ps(),
      cat: () => (a[0] ? `${esc(a[0])}: ${T('Inhalt (Demo)', 'contents (demo)', 'المحتوى (عرض)')}` : 'cat: missing operand'),
      exit: () => { setTimeout(() => back(SF.p), 200); return 'logout'; },
    };
    if (c === 'clear') { this.lines = []; return this.render(); }
    if (c === 'sudo' || c === 'apt') { const args = c === 'sudo' ? a.slice(1) : a; if (args[0] === 'install' && args[1]) { this.render(); const steps = ['Reading package lists... Done', 'Building dependency tree... Done', `The following NEW packages will be installed:\n  ${esc(args[1])}`, `Get:1 http://ports.ubuntu.com noble/main arm64 ${esc(args[1])} [1,204 kB]`, `Unpacking ${esc(args[1])} ...`, `Setting up ${esc(args[1])} ...`, '<span style="color:#4ADE80">✓ installiert im Ubuntu-Bereich (ultar-compat)</span>']; for (const s of steps) { await sleep(380); this.out(s); this.render(); } return; } this.out('apt: usage: apt install &lt;package&gt;'); return this.render(); }
    const f = map[c]; this.out(f ? f() : c ? `${esc(c)}: command not found` : ''); this.render();
  },
  neo() { return `<b>      ▄▄▄▄▄      </b>  ultar@a30\n<b>    ▟█▀   ▀█▙    </b>  ----------\n<b>   ▐█  KM   █▌   </b>  OS: Ultar OS 0.6.0 aarch64\n<b>    ▜█▄   ▄█▛    </b>  Host: Samsung Galaxy A30\n<b>      ▀▀▀▀▀      </b>  Kernel: 4.4.177\n                   Init: ultar-init (Rust, 1.5 MB)\n                   Shell: ultar-shell · RAM 65 MB\n                   Compat: Ubuntu 24.04\n                   By: KM Code Craft · code-craft.tech`; },
  render() { const b = $('#termout'); if (b) { b.innerHTML = this.lines.join('\n'); const w = $('#termwrap'); w.scrollTop = w.scrollHeight; } },
};
SC.terminal = {
  b(sf) { TERM.init(); return `${hd(sf, appName('terminal'), `<button class="ib" data-a="termClear" aria-label="Clear">${ic('trash', 18)}</button>`)}<div class="term" id="termwrap" data-a="termFocus"><div id="termout">${TERM.lines.join('\n')}</div><div class="in"><span style="color:#D8C870">ultar@a30</span>:<span style="color:#7AB8FF">${TERM.cwd}</span>$<input id="tin" inputmode="${S.desktop ? 'text' : 'none'}" data-enter="termRun" autocomplete="off" spellcheck="false" aria-label="Command"></div></div><div class="chips" style="padding:8px 10px">${['help', 'neofetch', 'ultar-ctl status', 'ls', 'df', 'apt install htop', 'top'].map((c) => `<button class="pill ltr" data-a="termCmd" data-v="${c}">${c}</button>`).join('')}</div>`; },
  m(el) { HLP.tip('terminal'); const w = $('#termwrap', el); w.scrollTop = w.scrollHeight; },
};
A.termRun = async (v, el) => { el.value = ''; await TERM.run(v); const i = $('#tin'); if (i) { const w = $('#termwrap'); w.scrollTop = w.scrollHeight; } };
A.termCmd = async (v) => { await TERM.run(v); };
A.termClear = () => { TERM.lines = []; TERM.render(); };
A.termFocus = (v, el, sf, ev) => { const i = $('#tin', sf.el); if (i && ev.target.tagName !== 'INPUT') i.focus(); };

// ================= Helfer (App) =================
SC.helper = {
  b(sf) { return `${hd(sf, appName('helper'))}<div class="scroll pad center" style="flex-direction:column;gap:12px;text-align:center"><div style="width:200px;height:220px;margin-top:10px" id="hbig">${figure('hello', 190)}</div><b style="font-size:20px">${T('Hallo! Wie kann ich helfen?', 'Hi! How can I help?', 'مرحباً! كيف أساعدك؟')}</b><div style="font-family:'IBM Plex Sans Arabic',sans-serif;font-size:15px;color:var(--mt);line-height:1.6;max-width:320px" dir="rtl">أنا KM Code Craft مساعدك الشخصي، أعمل على جهازك وأحفظ بياناتك وأبقيها آمنة</div><div class="grid2" style="width:100%;margin-top:6px">${[['hello', T('Hallo', 'Hello', 'مرحبا')], ['listen', T('Hört zu', 'Listening', 'يستمع')], ['think', T('Denkt', 'Thinking', 'يفكر')], ['speak', T('Spricht', 'Speaking', 'يتحدث')], ['call', T('Ruft an', 'Calling', 'يتصل')], ['alert', T('Fremde Stimme', 'Unknown voice', 'صوت غريب')], ['sleep', T('Schläft', 'Sleeping', 'نائم')], ['', T('Ruhe', 'Idle', 'هادئ')]].map(([k, n]) => `<button class="pill" data-a="hbState" data-v="${k}" style="justify-content:center">${n}</button>`).join('')}</div><button class="btn wide" data-a="hlpOpen2" style="margin-top:8px">${ic('msg', 18)} ${T('Unterhaltung starten', 'Start conversation', 'ابدأ المحادثة')}</button></div>` },
};
A.hbState = (k) => { const f = $('#hbig .kmo'); if (f) f.className = 'kmo ' + k; };

// ================= Desktop-Modus (ultar-wm) =================
const DESK = {
  wins: [], z: 10, n: 0, startOpen: false,
  layerHost() { return $('#dlayers') || document.body; },
  render() {
    $('#scaler').innerHTML = `<div class="desk" id="desk"><div class="screen" id="screen" style="position:absolute;inset:0;width:auto;height:auto;border-radius:0;background:transparent">
      <div style="position:absolute;inset:0;${S.wall ? `background:${S.wall};opacity:.55` : ''}"></div>
      <div class="desk-clock"><div class="num dots" style="font-size:84px;font-weight:800;line-height:.9;color:#F2F0EA" data-clock>${fmtTime()}</div><div style="font-size:16px;color:#A6A6AE;margin-top:6px">${fmtDate()} · ${hijri()}</div><img src="${LOGO}" alt="KM Code Craft" style="width:180px;margin-top:18px;opacity:.9"></div>
      <div class="dicons">${['files', 'browser', 'terminal', 'vscode', 'libre'].map((id) => `<button class="app" data-a="dOpen" data-v="${id}" style="width:84px"><span class="ic">${appIcon(id)}</span><span>${appName(id)}</span></button>`).join('')}</div>
      <div id="wins"></div>
      <div class="dhlp" style="position:absolute;bottom:72px;${S.lang === 'ar' ? 'left' : 'right'}:24px;width:70px;height:78px;cursor:pointer;z-index:800" data-a="dHelper" title="${appName('helper')}">${figure('', 66)}</div>
      <div id="dstart"></div>
      <div id="shadeHost"></div>
      <div class="task" id="task"></div>
      <div id="dlayers" style="position:absolute;inset:0;z-index:960;pointer-events:none"></div>
      <div class="overlay-night" id="nightl" style="display:none"></div><div class="overlay-dim" id="dim" style="opacity:0"></div>
    </div></div>`;
    const st = document.getElementById('deskcss') || document.createElement('style'); st.id = 'deskcss';
    st.textContent = '#dlayers>*{pointer-events:auto}.desk .scrim{justify-content:center;align-items:center}.desk .sheet{width:460px;max-height:80%;border-radius:24px;border:1px solid var(--ln)}.desk .toast{left:auto;right:16px;width:380px;top:16px}.desk .toast.small{bottom:72px}.desk #shadeHost .shade{left:auto;right:10px;top:auto;bottom:66px;width:380px;height:640px;border-radius:20px;border:1px solid var(--ln);box-shadow:0 30px 80px rgba(0,0,0,.6)}.desk #shadeHost .shade>div:first-child{height:12px!important}.desk .callscr{left:50%;width:390px;margin-left:-195px;top:40px;bottom:70px;border-radius:24px}.desk .sos{z-index:2000}';
    document.head.appendChild(st);
    chrome(); this.wins.forEach((w) => this.mountWin(w)); this.task(); setTimeout(scaleStage, 0);
  },
  open(app) {
    let w = this.wins.find((x) => x.app === app);
    if (w) { w.min = false; this.focus(w); this.place(w); this.task(); return; }
    const big = { browser: [900, 600], terminal: [680, 440], vscode: [900, 580], libre: [860, 580], settings: [480, 640], files: [620, 520], monitor: [520, 600], store: [520, 600] }[app] || [400, 640];
    this.n++; const off = (this.wins.length % 6) * 34;
    w = { id: 'w' + this.n, app, x: Math.min(300 + off, 1270 - big[0]), y: 40 + off, w: big[0], h: Math.min(big[1], 640), min: false, max: false, z: ++this.z };
    this.wins.push(w); this.mountWin(w); this.task();
  },
  mountWin(w) {
    const host = $('#wins'); if (!host) return;
    const el = document.createElement('div'); el.className = 'win'; el.id = w.id;
    el.innerHTML = `<div class="wt"><span style="display:flex">${appIcon(w.app, 16)}</span><b id="${w.id}t">${appName(w.app)}</b><button data-wa="back" aria-label="Back"><span class="flip">${ic('back', 15)}</span></button><button data-wa="min" aria-label="Minimise">${ic('minus', 15)}</button><button data-wa="max" aria-label="Maximise">${ic('rec', 13)}</button><button class="cls" data-wa="close" aria-label="Close">${ic('close', 15)}</button></div><div class="wb"><div class="sf" data-sf="${w.id}"></div></div><div class="rz"></div>`;
    host.appendChild(el); w.el = el;
    const sf = SF[w.id] || newSurface(w.id, null, w.app); sf.el = $('.sf', el); sf.win = w; render(sf, 'in');
    this.place(w);
    el.addEventListener('pointerdown', () => this.focus(w));
    const wt = $('.wt', el);
    wt.addEventListener('dblclick', () => { w.max = !w.max; this.place(w); });
    wt.addEventListener('click', (e) => { const b = e.target.closest('[data-wa]'); if (!b) return; const a = b.dataset.wa; if (a === 'close') this.close(w); if (a === 'min') { w.min = true; this.place(w); this.task(); } if (a === 'max') { w.max = !w.max; this.place(w); } if (a === 'back') back(sf); });
    wt.addEventListener('pointerdown', (e) => { if (e.target.closest('button') || w.max) return; const sc = scaleOf(); const sx = e.clientX, sy = e.clientY, ox = w.x, oy = w.y; wt.setPointerCapture(e.pointerId); wt.onpointermove = (ev) => { w.x = clamp(ox + (ev.clientX - sx) / sc, -w.w + 120, 1180); w.y = clamp(oy + (ev.clientY - sy) / sc, 0, 660); this.place(w); }; wt.onpointerup = () => { wt.onpointermove = null; }; });
    const rz = $('.rz', el); rz.addEventListener('pointerdown', (e) => { e.stopPropagation(); const sc = scaleOf(); const sx = e.clientX, sy = e.clientY, ow = w.w, oh = w.h; rz.setPointerCapture(e.pointerId); rz.onpointermove = (ev) => { w.w = clamp(ow + (ev.clientX - sx) / sc, 320, 1260); w.h = clamp(oh + (ev.clientY - sy) / sc, 260, 700); this.place(w); }; rz.onpointerup = () => { rz.onpointermove = null; }; });
  },
  place(w) { const el = w.el; if (!el) return; el.style.display = w.min ? 'none' : 'flex'; el.style.zIndex = w.z; if (w.max) { el.style.left = '0'; el.style.top = '0'; el.style.width = '1280px'; el.style.height = '704px'; el.style.borderRadius = '0'; } else { el.style.left = w.x + 'px'; el.style.top = w.y + 'px'; el.style.width = w.w + 'px'; el.style.height = w.h + 'px'; el.style.borderRadius = ''; } $$('.win').forEach((x) => x.classList.toggle('act', x === el)); },
  focus(w) { w.z = ++this.z; this.place(w); this.task(); },
  close(w) { unmount(SF[w.id]); delete SF[w.id]; w.el && w.el.remove(); this.wins = this.wins.filter((x) => x !== w); this.task(); },
  title(sf) { const t = $('#' + sf.id + 't'); if (t) { const h = $('.hd h1', sf.el); t.textContent = (h && h.textContent) || appName(sf.win.app); } },
  task() {
    const t = $('#task'); if (!t) return; const top = this.wins.filter((w) => !w.min).sort((a, b) => b.z - a.z)[0];
    const pinned = ['files', 'browser', 'terminal', 'settings'];
    const ids = [...new Set([...pinned, ...this.wins.map((w) => w.app)])];
    t.innerHTML = `<button class="tb" data-a="dStart" aria-label="Start" style="background:rgba(216,200,112,.14);padding:0 8px"><img src="${MARK}" alt="" style="width:30px"></button>${ids.map((id) => { const w = this.wins.find((x) => x.app === id); return `<button class="tb ${w && top === w ? 'on' : ''}" data-a="dTask" data-v="${id}" style="${w ? '' : 'opacity:.7'}">${appIcon(id, 18)}<span>${appName(id)}</span></button>`; }).join('')}<span style="flex:1"></span>
      <button class="tb" data-a="dPhone">${ic('phone', 16)} ${T('Handy-Modus', 'Phone mode', 'وضع الهاتف')}</button>
      <button class="tb" data-a="shade" style="gap:10px">${S.vpn ? `<span class="gold">${ic('key', 15)}</span>` : ''}${S.wifi ? ic('wifi', 16) : ic('wifiOff', 16)}<span class="num">${Math.round(S.battery)} %</span><span style="display:flex;flex-direction:column;align-items:flex-end;line-height:1.2;font-size:12px"><b class="num" data-clock>${fmtTime()}</b><span class="muted">${new Intl.DateTimeFormat(LOC(), { day: '2-digit', month: '2-digit' }).format(new Date())}</span></span></button>`;
  },
};
A.dOpen = (id) => DESK.open(id);
A.dTask = (id) => { const w = DESK.wins.find((x) => x.app === id); if (!w) return DESK.open(id); const top = DESK.wins.filter((x) => !x.min).sort((a, b) => b.z - a.z)[0]; if (top === w && !w.min) { w.min = true; DESK.place(w); DESK.task(); } else { w.min = false; DESK.focus(w); } };
A.dPhone = () => setDesktop(false);
A.dHelper = () => HLP.openChat();
A.dStart = () => {
  const h = $('#dstart'); if (h.innerHTML) { h.innerHTML = ''; return; }
  const all = [...DOCK, ...homeApps(), 'vscode', 'libre'].filter((v, i, a) => a.indexOf(v) === i);
  h.innerHTML = `<div class="start" data-sf="p"><input class="inp" id="dsq" placeholder="${T('Programme suchen', 'Search programs', 'ابحث في البرامج')}" autocomplete="off" style="background:#0A0B0E"><div class="sec" style="padding:0 4px">${T('Alle Programme', 'All programs', 'كل البرامج')}</div><div class="apps" id="dsa">${all.map((id) => `<button class="app" data-a="dSOpen" data-v="${id}" data-n="${esc(norm(appName(id)))}"><span class="ic" style="width:52px;height:52px">${appIcon(id, 22)}</span><span style="color:#E8E6E0">${appName(id)}</span></button>`).join('')}</div><div style="flex:1"></div><div style="display:flex;justify-content:space-between;align-items:center;border-top:1px solid rgba(255,255,255,.08);padding-top:12px"><span style="display:flex;gap:10px;align-items:center;color:#E8E6E0">${avatar('KM', 34, '#5A4A1C')}<span style="font-size:13px">ultar · <span class="ltr">${S.uos}</span></span></span><button class="btn sm ghost" data-a="dPhone" style="color:#E8E6E0">${ic('power', 16)} ${T('Zurück zu Ultar', 'Back to Ultar', 'العودة إلى Ultar')}</button></div></div>`;
  const q = $('#dsq'); q.focus(); q.addEventListener('input', () => { const v = norm(q.value); $$('#dsa .app').forEach((b) => { b.style.display = !v || b.dataset.n.includes(v) || b.dataset.v.includes(v) ? '' : 'none'; }); });
  q.addEventListener('keydown', (e) => { if (e.key === 'Enter') { const f = $$('#dsa .app').find((b) => b.style.display !== 'none'); if (f) A.dSOpen(f.dataset.v); } });
};
A.dSOpen = (id) => { $('#dstart').innerHTML = ''; DESK.open(id); };

// Ubuntu-Programme im Fenster
const _vs = SC.vscode.b; SC.vscode.b = (sf, a) => (sf.win ? `<div style="display:flex;flex:1;min-height:0;background:#1E1E1E;color:#D4D4D4;font-family:ui-monospace,Menlo,Consolas,monospace;font-size:13px;direction:ltr"><div style="width:48px;background:#2C2C2C;display:flex;flex-direction:column;align-items:center;gap:16px;padding-top:12px;color:#8a8a8a">${ic('file', 22)}${ic('search', 22)}${ic('layers', 22)}</div><div style="width:190px;background:#252526;padding:10px;font-family:Inter,sans-serif;font-size:12.5px;line-height:1.9;color:#ccc"><b style="font-size:11px;letter-spacing:.1em">ULTAR-OS</b><br>▾ crates<br>&nbsp;&nbsp;▾ ultar-shell<br>&nbsp;&nbsp;&nbsp;&nbsp;<span style="color:#E3C766">theme.rs</span><br>&nbsp;&nbsp;&nbsp;&nbsp;ui.rs<br>&nbsp;&nbsp;▸ ultar-wm<br>▸ docs<br>▸ rootfs</div><div style="flex:1;padding:14px 18px;line-height:1.8;white-space:pre;overflow:auto"><span style="color:#6A9955">// Ultar Noir – Grundfarben</span>
<span style="color:#569CD6">pub const</span> BG: <span style="color:#4EC9B0">Rgb</span> = rgb(<span style="color:#B5CEA8">0x0A0B0E</span>);
<span style="color:#569CD6">pub const</span> GOLD: <span style="color:#4EC9B0">Rgb</span> = rgb(<span style="color:#B5CEA8">0xD8C870</span>);
<span style="color:#569CD6">pub const</span> KM_RED: <span style="color:#4EC9B0">Rgb</span> = rgb(<span style="color:#B5CEA8">0xF80000</span>);

<span style="color:#569CD6">pub fn</span> <span style="color:#DCDCAA">theme</span>(dark: <span style="color:#4EC9B0">bool</span>) -> <span style="color:#4EC9B0">Theme</span> {
    <span style="color:#C586C0">if</span> dark { Theme::noir() } <span style="color:#C586C0">else</span> { Theme::light() }
}</div></div>` : _vs(sf, a));
const _lo = SC.libre.b; SC.libre.b = (sf, a) => (sf.win ? `<div style="flex:1;min-height:0;background:#E8E8E8;display:flex;flex-direction:column;direction:ltr"><div style="height:36px;background:#F5F5F5;border-bottom:1px solid #ccc;display:flex;align-items:center;gap:14px;padding:0 12px;color:#333;font-size:12.5px;font-family:Inter,sans-serif"><b>Writer</b><span>Datei</span><span>Bearbeiten</span><span>Ansicht</span><span>Einfügen</span><span>Format</span><span style="flex:1"></span><b>B</b><i>I</i><u>U</u></div><div style="flex:1;overflow:auto;padding:22px"><div style="background:#fff;width:560px;margin:0 auto;min-height:600px;padding:50px 60px;color:#222;font-family:Georgia,serif;box-shadow:0 2px 10px rgba(0,0,0,.15)"><h2 style="margin:0 0 6px;font-family:Inter,sans-serif">Angebot KM POS</h2><div style="color:#777;font-size:13px;margin-bottom:20px">KM Code Craft · code-craft.tech</div><p style="line-height:1.7;font-size:14px">${T('Dieses Dokument läuft in LibreOffice aus dem Ubuntu-Bereich – im Fenstersystem von Ultar OS.', 'This document runs in LibreOffice from the Ubuntu area – in the Ultar OS window system.', 'يعمل هذا المستند في ليبر أوفيس من منطقة أوبونتو – داخل نظام نوافذ Ultar OS.')}</p></div></div></div>` : _lo(sf, a));

function setDesktop(on) {
  S.desktop = on; closeLayers(); SH.close();
  if (on) { if (S.locked) S.locked = false; DESK.render(); toast(T('Desktop-Modus · Fenster verschieben, vergrößern, Startmenü unten links', 'Desktop mode · move and resize windows, start menu bottom-left', 'وضع سطح المكتب · حرّك النوافذ وغيّر حجمها، قائمة البدء أسفل اليسار')); }
  else { Object.keys(SF).filter((k) => k !== 'p').forEach((k) => delete SF[k]); buildPhone(true); }
  updBar(); scaleStage();
}

// ================= Start, Leiste, Skalierung =================
function updBar() {
  const b = $('#bar'); if (!b) return;
  b.innerHTML = `<a class="home" href="/">${S.lang === 'ar' ? '→' : '←'} ${T('Zur Webseite', 'Back to website', 'العودة إلى الموقع')}</a><span class="sep"></span>${['ar', 'de', 'en'].map((l) => `<button class="${S.lang === l ? 'on' : ''}" data-a="barLang" data-v="${l}">${{ ar: 'العربية', de: 'Deutsch', en: 'English' }[l]}</button>`).join('')}<span class="sep"></span><button class="${!S.desktop ? 'on' : ''}" data-a="barMode" data-v="0">${T('Handy', 'Phone', 'الهاتف')}</button><button class="${S.desktop ? 'on' : ''}" data-a="barMode" data-v="1">Desktop</button><span class="sep"></span><button data-a="barReset">${T('Neu starten', 'Restart', 'إعادة')}</button>`;
  const h = $('#hint'); if (h) { h.dir = S.lang === 'ar' ? 'rtl' : 'ltr'; h.textContent = S.desktop ? T('Fenster ziehen, vergrößern, über die Leiste wechseln. Der Helfer sitzt unten rechts.', 'Drag and resize windows, switch via the taskbar. The helper sits bottom-right.', 'اسحب النوافذ وغيّر حجمها وبدّل عبر الشريط. المساعد في الأسفل.') : T('Alles ist bedienbar: tippen, wischen, lange drücken. Statusleiste antippen = Schnelleinstellungen. Tasten am Gehäuse: Ein/Aus, Lauter, Leiser – Lauter + Leiser kurz nacheinander = Notausstieg.', 'Everything works: tap, swipe, long-press. Tap the status bar for quick settings. Side keys: power, volume up, volume down – up + down in quick succession = emergency restart.', 'كل شيء قابل للاستخدام: اضغط واسحب واضغط مطولاً. اضغط شريط الحالة للإعدادات السريعة. أزرار الجانب: التشغيل ورفع وخفض الصوت – الرفع ثم الخفض بسرعة = خروج طارئ.'); }
}
A.barLang = (l) => setLang(l);
A.barMode = (v) => { if (!!+v !== S.desktop) setDesktop(!!+v); };
A.barReset = () => { if (S.desktop) setDesktop(false); reboot(true); };
function scaleStage() {
  const sc = $('#scaler'); if (!sc || !sc.firstElementChild) return;
  const w = S.desktop ? 1302 : 420, h = S.desktop ? 782 : 870;
  const top = ($('#bar') ? $('#bar').offsetHeight : 0) + ($('#hint') ? $('#hint').offsetHeight : 0) + 34;
  const s = Math.min(1.15, (innerHeight - top) / h, (innerWidth - 16) / w);
  sc.style.transform = `scale(${s})`; sc.style.width = w + 'px'; sc.style.height = h + 'px'; sc.style.marginBottom = `${(s - 1) * h}px`; sc.style.marginLeft = sc.style.marginRight = `${((s - 1) * w) / 2}px`;
}
addEventListener('resize', scaleStage);
window.addEventListener('DOMContentLoaded', () => {
  if (QS.get('embed') === '1') { const h = $('#hint'); if (h) h.style.display = 'none'; }
  buildPhone(); updBar(); chrome(); scaleStage(); setTimeout(scaleStage, 50);
  if (QS.get('mode') === 'desktop') setTimeout(() => setDesktop(true), 2700);
});
// Fehler sichtbar machen (nur Konsole)
window.addEventListener('error', (e) => console.error('Demo-Fehler:', e.message));

