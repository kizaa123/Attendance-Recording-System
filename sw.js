/* Attendify service worker — API always network; HTML network-first; assets stale-while-revalidate */
var CACHE_VERSION = "attendify-assets-v3";

function isCacheableAsset(url) {
  var path = url.pathname || "";
  if (path.indexOf("/api/") === 0) return false;
  if (path === "/sw.js" || path === "/manifest.webmanifest") return false;
  return (
    /\.(js|css|svg|png|jpg|jpeg|webp|woff2?|ico)$/i.test(path) ||
    path.indexOf("/icons/") === 0
  );
}

function isNetworkFirstAsset(url) {
  var path = url.pathname || "";
  return /\.(js|css)$/i.test(path);
}

self.addEventListener("install", function (event) {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_VERSION).then(function (cache) {
      return cache
        .addAll([
          "/manifest.webmanifest",
          "/icons/icon-192.svg",
          "/icons/icon-512.svg",
          "/css/standalone.css",
          "/splash.html"
        ])
        .catch(function () {});
    })
  );
});

self.addEventListener("activate", function (event) {
  event.waitUntil(
    caches
      .keys()
      .then(function (keys) {
        return Promise.all(
          keys
            .filter(function (k) {
              return k.indexOf("attendify-") === 0 && k !== CACHE_VERSION;
            })
            .map(function (k) {
              return caches.delete(k);
            })
        );
      })
      .then(function () {
        return self.clients.claim();
      })
  );
});

self.addEventListener("fetch", function (event) {
  if (event.request.method !== "GET") return;
  var url;
  try {
    url = new URL(event.request.url);
  } catch (e) {
    return;
  }
  if (url.origin !== self.location.origin) return;
  if (url.pathname.indexOf("/api/") === 0) return;

  if (/\.html$/i.test(url.pathname) || url.pathname === "/" || url.pathname === "") {
    event.respondWith(
      fetch(event.request).catch(function () {
        return caches.match("/splash.html");
      })
    );
    return;
  }

  if (!isCacheableAsset(url)) return;

  if (isNetworkFirstAsset(url)) {
    event.respondWith(
      fetch(event.request)
        .then(function (response) {
          if (response && response.ok) {
            caches.open(CACHE_VERSION).then(function (cache) {
              cache.put(event.request, response.clone());
            });
          }
          return response;
        })
        .catch(function () {
          return caches.match(event.request);
        })
    );
    return;
  }

  event.respondWith(
    caches.open(CACHE_VERSION).then(function (cache) {
      return cache.match(event.request).then(function (cached) {
        var network = fetch(event.request)
          .then(function (response) {
            if (response && response.ok) {
              cache.put(event.request, response.clone());
            }
            return response;
          })
          .catch(function () {
            return cached;
          });
        return cached || network;
      });
    })
  );
});