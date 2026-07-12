// Deduplicates identical GET requests across indicator modules.
// Multiple indicators awaiting the same URL share one in-flight promise.
// On failure the entry is evicted so a future run can retry.

const inflight = new Map();

export function fetchJSON(url) {
  if (!inflight.has(url)) {
    const promise = fetch(url)
      .then(res => {
        if (!res.ok) throw new Error(`${url} returned HTTP ${res.status}`);
        return res.json();
      })
      .catch(err => {
        inflight.delete(url);
        throw err;
      });
    inflight.set(url, promise);
  }
  return inflight.get(url);
}
