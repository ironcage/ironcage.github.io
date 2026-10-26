/* 아이언 케이지 — 서비스 워커 (오프라인 실행)
   게임 파일을 바꿔 올릴 때는 아래 VERSION 숫자를 하나 올려 주세요. 그래야 폰에 있는 옛 버전이 새 버전으로 바뀝니다. */
const VERSION = 'iron-cage-pwa-v123';
const FONT_CACHE = 'iron-cage-fonts';
const APP_FILES = [
  './',
  './index.html',
  './data.js',
  './engine.js',
  './mocap.js',
  './draw.js',
  './gif.js',
  './art/belt.webp',
  './art/ch_fly.jpg',
  './art/ch_fw.jpg',
  './art/ch_lw.jpg',
  './art/ch_ww.jpg',
  './art/ch_mw.jpg',
  './art/ch_hw.jpg',
  './art/head/asian_long_b.png',
  './art/head/asian_long_n.png',
  './art/head/asian_shaved_b.png',
  './art/head/asian_shaved_n.png',
  './art/head/asian_short_b.png',
  './art/head/black_long_b.png',
  './art/head/black_long_n.png',
  './art/head/black_shaved_b.png',
  './art/head/black_shaved_n.png',
  './art/head/cauc_short_n.png',
  './art/head/ch_fly.png',
  './art/head/ch_fw.png',
  './art/head/ch_hw.png',
  './art/head/ch_lw.png',
  './art/head/ch_mw.png',
  './art/head/ch_ww.png',
  './art/head/latin_long_b.png',
  './art/head/latin_long_n.png',
  './art/head/latin_shaved_b.png',
  './art/head/latin_shaved_n.png',
  './art/head/latin_short_b.png',
  './art/head/latin_short_n.png',
  './art/head/white_long_b.png',
  './art/head/white_long_n.png',
  './art/head/white_mohawk_b.png',
  './art/head/white_mohawk_n.png',
  './art/head/white_shaved_b.png',
  './art/head/white_shaved_n.png',
  './art/head/white_short_b.png',
  './art/head/white_short_n.png',
  './title.jpg',
  './ui.js',
  './i18n.js',
  './manifest.json',
  './apple-touch-icon.png',
  './icon-192.png',
  './icon-512.png',
  './icon-maskable-512.png',
  './sfx/index.json',
  './sfx/punch0.mp3',
  './sfx/punch1.mp3',
  './sfx/punch2.mp3',
  './sfx/punch3.mp3',
  './sfx/punch4.mp3',
  './sfx/heavy0.mp3',
  './sfx/heavy1.mp3',
  './sfx/heavy2.mp3',
  './sfx/heavy3.mp3',
  './sfx/heavy4.mp3',
  './sfx/body0.mp3',
  './sfx/body1.mp3',
  './sfx/body2.mp3',
  './sfx/body3.mp3',
  './sfx/body4.mp3',
  './sfx/block0.mp3',
  './sfx/block1.mp3',
  './sfx/block2.mp3',
  './sfx/block3.mp3',
  './sfx/block4.mp3',
  './sfx/bell0.mp3',
  './sfx/bell1.mp3',
  './sfx/cage0.mp3',
  './sfx/cage1.mp3'
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
  // 3D 시험판(/3d/)은 별도 저장소의 다른 게임: 이 서비스워커는 손대지 않음 (2D 게임 저장본을 덮어쓰지 않게)
  if (url.pathname.startsWith('/3d/') || url.pathname === '/3d') return;

  // 게임 파일: 이번 VERSION으로 저장해 둔 파일을 사용 (인터넷 없이도 실행).
  // 새 버전은 sw.js의 VERSION을 바꿔 올리면 다음 실행 때 통째로 교체됩니다.
  // 온라인이면 항상 최신 파일(네트워크 우선), 오프라인이면 저장해 둔 파일 사용
  const key = req.mode === 'navigate' ? './index.html' : req;
  // 페이지 이동(앱 시작): 브라우저 기본 요청을 그대로 보내고, 실패(오프라인)할 때만 저장본 사용 — 흰 화면 방지
  if (req.mode === 'navigate') {
    event.respondWith(fetch(req).then(res => {
      // 게임 페이지만 저장 (소개 페이지 about.html 같은 다른 페이지가 게임 저장본을 덮어쓰지 않게)
      if (res && res.ok && !res.redirected && /\/(index\.html)?$/.test(url.pathname)) { const copy = res.clone(); caches.open(VERSION).then(c => c.put('./index.html', copy)).catch(() => {}); }
      return res;
    }).catch(() => caches.match('./index.html').then(hit => hit || Response.error())));
    return;
  }
  // 나머지 게임 파일: 온라인이면 항상 최신(네트워크 우선), 오프라인이면 저장해 둔 파일
  event.respondWith(fetch(req, { cache: 'no-cache' }).then(res => {
    if (res && res.ok) { const copy = res.clone(); caches.open(VERSION).then(c => c.put(req, copy)).catch(() => {}); }
    return res;
  }).catch(() => caches.match(req, { ignoreSearch: true }).then(hit => hit || fetch(req))));
});
