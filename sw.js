const CACHE_NAME = "nfpl-restore-1717-unknown-ko-v1";
const STATIC_ASSETS = [
  "./",
  "./index.html",
  "./manifest.webmanifest",
  "./icon-192.png",
  "./icon-512.png",
  "./apple-touch-icon.png",
  "./favicon-32.png",
  "./unknown-knockout-fix.js"
];

self.addEventListener("install", event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(STATIC_ASSETS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

async function injectUnknownKnockout(response){
  if(!response) return response;
  const type=response.headers.get("content-type")||"";
  if(!type.includes("text/html")) return response;
  let html=await response.text();
  const tag='<script src="./unknown-knockout-fix.js?v=1"></script>';
  if(!html.includes('unknown-knockout-fix.js')){
    html=html.includes('</body>')?html.replace('</body>',tag+'</body>'):html+tag;
  }
  const headers=new Headers(response.headers);
  headers.delete('content-length');
  return new Response(html,{status:response.status,statusText:response.statusText,headers});
}

self.addEventListener("fetch", event => {
  const request = event.request;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  if (request.mode === "navigate") {
    event.respondWith((async()=>{
      try{
        const response=await fetch(request,{cache:"no-store"});
        const copy=response.clone();
        caches.open(CACHE_NAME).then(cache=>cache.put("./index.html",copy)).catch(()=>{});
        return injectUnknownKnockout(response);
      }catch(e){
        const cached=await caches.match("./index.html");
        return cached?injectUnknownKnockout(cached):Response.error();
      }
    })());
    return;
  }

  event.respondWith(caches.match(request).then(cached => cached || fetch(request)));
});
