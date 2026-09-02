// Версия кэша. Меняй эту строку при каждом обновлении файлов игры,
// иначе у игроков на телефонах может застрять старая версия.
const CACHE_VERSION = 'door-game-v4';

const ASSETS = [
  './',
  './index.html',
  './style.css',
  './app.js',
  './snake.js',
  './minesweeper.js',
  './tetris.js',
  './sokoban.js',
  './arkanoid.js',
  './pacman.js',
  './bubbleshooter.js',
  './collapse.js',
  './bejeweled.js',
  './lines.js',
  './xonix.js',
  './digger.js',
  './manifest.json',
  './icon-192.png',
  './icon-512.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_VERSION).then((cache) => cache.addAll(ASSETS))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_VERSION).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  event.respondWith(
    caches.match(event.request).then((cached) => {
      const network = fetch(event.request)
        .then((response) => {
          if (response.ok) {
            const copy = response.clone();
            caches.open(CACHE_VERSION).then((cache) => cache.put(event.request, copy));
          }
          return response;
        })
        .catch(() => cached);
      return cached || network;
    })
  );
});
