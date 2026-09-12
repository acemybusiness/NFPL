const CACHE='nfpl-phone-v3.7.6-icon-v3771';
const ASSETS=['/phone/','/phone/index.html','/phone/app-v376.html?v=3771','/phone/manifest.webmanifest?v=3771','/phone/icon-192.png?v=3771','/phone/icon-512.png?v=3771','/phone/favicon.png?v=3771','/phone/apple-touch-icon.png?v=3771'];
self.addEventListener('install',event=>{self.skipWaiting();event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(ASSETS)))});
self.addEventListener('activate',event=>{event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim()))});
self.addEventListener('fetch',event=>{if(event.request.method!=='GET')return;event.respondWith(fetch(event.request,{cache:'no-store'}).then(response=>{const copy=response.clone();caches.open(CACHE).then(cache=>cache.put(event.request,copy));return response}).catch(()=>caches.match(event.request)))});
