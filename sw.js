// 統測刷題 Service Worker
// 原則：批改、登入、頭像等 Supabase 請求一律走網路，絕不快取（避免舊答案、舊登入狀態）。
// 網頁本體：有網路就拿最新版；沒網路才用上次存的版本。
const VERSION = 'v1';                 // 改了圖示或這支檔案時，把 v1 改成 v2、v3…
const SHELL = 'shell-' + VERSION;
const RUNTIME = 'runtime-' + VERSION;
const SHELL_FILES = ['./', './index.html', './manifest.webmanifest', './icons/icon-192.png', './icons/icon-512.png'];
const CDN_HOSTS = ['cdn.tailwindcss.com', 'cdn.jsdelivr.net', 'fonts.googleapis.com', 'fonts.gstatic.com'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(SHELL).then(c => c.addAll(SHELL_FILES)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => ![SHELL, RUNTIME].includes(k)).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.hostname.endsWith('.supabase.co')) return;

  if (req.mode === 'navigate') {
    e.respondWith(
      fetch(req).then(res => {
        if (res.ok) { const copy = res.clone(); caches.open(SHELL).then(c => c.put('./index.html', copy)); }
        return res;
      }).catch(() => caches.match('./index.html'))
    );
    return;
  }

  if (url.origin === self.location.origin || CDN_HOSTS.includes(url.hostname)) {
    e.respondWith(
      caches.open(RUNTIME).then(async cache => {
        const hit = await cache.match(req);
        const net = fetch(req).then(res => {
          if (res.ok || res.type === 'opaque') cache.put(req, res.clone());
          return res;
        }).catch(() => hit);
        return hit || net;
      })
    );
  }
});
