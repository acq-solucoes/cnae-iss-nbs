const CACHE_NAME = 'busca-fiscal-v1';
const ASSETS = [
    './',
    './index.html.html',
    './app-enhancements.js',
    './logo-pwa.png',
    './manifest.json',
    './utils/validators.js',
    './utils/formatters.js',
    './services/ncmService.js',
    './services/cnaeService.js',
    './services/cestService.js',
    './services/openaiService.js',
    './components/SearchBox.js',
    './components/ResultCard.js',
    './components/HierarchyView.js',
    './components/RelatedItems.js'
];

self.addEventListener('install', (e) => {
    e.waitUntil(
        caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS))
    );
});

self.addEventListener('fetch', (e) => {
    e.respondWith(
        caches.match(e.request).then((res) => res || fetch(e.request))
    );
});
