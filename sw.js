/* 아이언 케이지 — 서비스 워커 (오프라인 실행)
   게임 파일을 바꿔 올릴 때는 아래 VERSION 숫자를 하나 올려 주세요. 그래야 폰에 있는 옛 버전이 새 버전으로 바뀝니다. */
const VERSION = 'iron-cage-pwa-v23';
const FONT_CACHE = 'iron-cage-fonts';
const APP_FILES = [
  './',
  './index.html',
  './data.js',
  './engine.js',
  './draw.js',
  './gif.js',
  './title.jpg',
  './ui.js',
  './manifest.json',
  './apple-touch-icon.png',
  './icon-192.png',
  './icon-512.png',
  './icon-maskable-512.png'
];

self.addEventListener('install', event => {
  event.waitUntil(caches.open(VERSION).then(c => c.addAll(APP_FILES.map(u => new Request(u, { cache: 'reload' })))).then(() => self.skipWaiting()));
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys => Promise.all(keys.filter(k => k !== VERSION && k !== FONT_CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  // Google 폰트: 한 번 받아 두면 오프라인에서도 같은 글꼴로 표시
  if (url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com') {
    event.respondWith(caches.open(FONT_CACHE).then(async cache => {
      const hit = await cache.match(req);
      const net = fetch(req).then(res => { if (res && (res.ok || res.type === 'opaque')) cache.put(req, res.clone()); return res; }).catch(() => hit);
      return hit || net;
    }));
    return;
  }

  if (url.origin !== self.location.origin) return;

  // 게임 파일: 이번 VERSION으로 저장해 둔 파일을 사용 (인터넷 없이도 실행).
  // 새 버전은 sw.js의 VERSION을 바꿔 올리면 다음 실행 때 통째로 교체됩니다.
  if (req.mode === 'navigate') {
    event.respondWith(caches.match('./index.html').then(hit => hit || fetch(req)));
    return;
  }
  event.respondWith(caches.match(req, { ignoreSearch: true }).then(hit => hit || fetch(req).then(res => {
    if (res && res.ok) { const copy = res.clone(); caches.open(VERSION).then(c => c.put(req, copy)); }
    return res;
  })));
});
