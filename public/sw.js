const CACHE_NAME = 'law-tracker-v3';
const PRECACHE = ['/', '/index.html', '/manifest.json', '/icon.svg'];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((c)=>c.addAll(PRECACHE)));
});

self.addEventListener('fetch', (event) => {
  event.respondWith(
    fetch(event.request)
      .then((res) => {
        const clone = res.clone();
        if (event.request.method === 'GET' && res.ok) {
          caches.open(CACHE_NAME).then((c)=>c.put(event.request, clone)).catch(()=>{});
        }
        return res;
      })
      .catch(() => caches.match(event.request).then((r)=> r || caches.match('/index.html')))
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.map((k) => (k !== CACHE_NAME ? caches.delete(k) : undefined))))
  );
});


