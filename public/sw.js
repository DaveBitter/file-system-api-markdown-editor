/*** Constants ***/

// NOTE: Ensure that all files are present. One wrong path and the caching breaks for all.
const getResourcesToCache = () => [];

/*** Helpers ***/

const getGuards = (event) => ({
  isGET: event.request.method === "GET" || false,
  isSameOrigin: event.target.location.origin === location.origin || false,
  isHTTPRequest: event.request.url.indexOf("http") === 0 || false,
});

/*** Service Worker ***/

self.addEventListener("install", (e) =>
  e.waitUntil(
    caches
      .open("md-editor")
      .then((cache) => cache.addAll(getResourcesToCache()))
  )
);

// Cache every resources that is requested and allowed by Guard
self.addEventListener("fetch", (e) => {
  const { isGET, isSameOrigin, isHTTPRequest } = getGuards(e);
  if (!isGET || !isSameOrigin || !isHTTPRequest) {
    return;
  }

  e.respondWith(
    caches.open("md-editor").then((cache) =>
      cache.match(e.request).then((response) => {
        return fetch(e.request)
          .then((res) => {
            cache.put(e.request, res.clone());
            return res;
          })
          .catch(() => response);
      })
    )
  );
});
