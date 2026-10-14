/* Service worker de Imperio Store Barber: avisos push y app instalable.
   No guarda páginas en caché a propósito: así el sitio siempre se actualiza solo. */
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", e => e.waitUntil(self.clients.claim()));
self.addEventListener("fetch", () => {});

self.addEventListener("push", e => {
  let d = {};
  try { d = e.data ? e.data.json() : {}; } catch (_) { d = { body: e.data && e.data.text() }; }
  e.waitUntil(self.registration.showNotification(d.title || "Imperio Store Barber", {
    body: d.body || "",
    icon: "img/icon-192.png",
    badge: "img/icon-192.png",
    tag: d.tag || "imperio",
    renotify: true,
    vibrate: [120, 60, 120],
    data: { url: d.url || "./?app=1" }
  }));
});

self.addEventListener("notificationclick", e => {
  e.notification.close();
  const destino = new URL((e.notification.data && e.notification.data.url) || "./?app=1", self.registration.scope).href;
  e.waitUntil(self.clients.matchAll({ type: "window", includeUncontrolled: true }).then(lista => {
    for (const c of lista) {
      if (c.url.startsWith(self.registration.scope) && "focus" in c) { c.postMessage({ tipo: "ir-admin" }); return c.focus(); }
    }
    return self.clients.openWindow(destino);
  }));
});
