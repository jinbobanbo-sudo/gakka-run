// 画面ファイルをキャッシュしてオフラインでも開けるようにする。
// 問題データと学習記録はアプリ側（端末内の保存領域）で持つので、ここではキャッシュしない。
// 画面（HTML）はネット優先：つながっていれば常に最新を表示し、圏外のときだけキャッシュを使う。
const CACHE = "gakka-v5";
const SHELL = ["./", "./index.html", "./manifest.webmanifest", "./icon-192.png", "./icon-512.png", "./apple-touch-icon.png"];

self.addEventListener("install", e => {
  // ブラウザのHTTPキャッシュを通さずに取り直す（古い画面がキャッシュに入るのを防ぐ）
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL.map(u => new Request(u, { cache: "reload" })))).then(() => self.skipWaiting()));
});
self.addEventListener("activate", e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener("fetch", e => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  const isShell = url.origin === location.origin;
  const isFont = /fonts\.(googleapis|gstatic)\.com$/.test(url.hostname);
  if (!isShell && !isFont) return;
  const isPage = req.mode === "navigate" || (isShell && /\/$|\.html$/.test(url.pathname));
  if (isPage) {
    // ネット優先
    e.respondWith(caches.open(CACHE).then(c =>
      fetch(req, { cache: "no-cache" }).then(res => { if (res && res.ok) c.put(req, res.clone()); return res; })
        .catch(async () => (await c.match(req, { ignoreSearch: true })) || c.match("./index.html"))));
    return;
  }
  // アイコン・フォントはキャッシュ優先（裏で取り直す）
  e.respondWith(caches.open(CACHE).then(async c => {
    const hit = await c.match(req, { ignoreSearch: isShell });
    const net = fetch(req).then(res => { if (res && (res.ok || res.type === "opaque")) c.put(req, res.clone()); return res; }).catch(() => hit);
    return hit || net;
  }));
});
