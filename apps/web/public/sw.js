// Service Worker: Push-Benachrichtigungen (auch bei geschlossenem Portal) und Klick → richtige Seite.
// Keine Zwischenspeicherung von Seiten – das Portal lädt immer frisch.
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (e) => e.waitUntil(self.clients.claim()));

self.addEventListener("push", (event) => {
  let d = {};
  try { d = event.data ? event.data.json() : {}; } catch { d = { title: "KM Code Craft", body: event.data && event.data.text() }; }
  event.waitUntil((async () => {
    const wins = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
    // Portal ist sichtbar und im Vordergrund → dort erscheint die Meldung schon (Ton, Hinweis)
    if (!d.call && wins.some((w) => w.visibilityState === "visible" && w.focused)) return;
    const call = !!d.call;
    await self.registration.showNotification(d.title || "KM Code Craft", {
      body: d.body || "",
      tag: d.tag || undefined,
      renotify: call,
      requireInteraction: call || !!d.requireInteraction,
      icon: "/brand/icon-192.png",
      badge: "/brand/icon-192.png",
      vibrate: call ? [400, 200, 400, 200, 400, 200, 400] : [120, 60, 120],
      data: { url: d.url || "/portal/mitteilungen", call, room: d.room, from: d.from },
      actions: call ? [{ action: "answer", title: "Annehmen · Accept · قبول" }, { action: "decline", title: "Ablehnen · Decline · رفض" }] : [],
    });
  })());
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const data = event.notification.data || {};
  let url = data.url || "/portal";
  if (data.call && event.action === "decline") url = url + (url.includes("?") ? "&" : "?") + "decline=1";
  event.waitUntil((async () => {
    const wins = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
    const portal = wins.find((w) => new URL(w.url).pathname.startsWith("/portal"));
    if (portal) {
      await portal.focus();
      portal.postMessage({ type: "open", url });
      return;
    }
    await self.clients.openWindow(url);
  })());
});

// Abo vom Browser erneuert → Portal meldet es beim nächsten Start neu an
self.addEventListener("pushsubscriptionchange", () => {});
