// Minimal in-memory sliding-window rate limiter.
//
// This lives in the Worker's isolate memory, so it resets whenever the
// isolate is recycled and is only per-isolate, not global across Cloudflare's
// edge. That's an acceptable trade-off here: the goal is to blunt accidental
// or lightly-abusive loops hammering the AI endpoint from a single session,
// not to provide hard security guarantees. A durable/shared limiter (e.g.
// backed by the ChatSession Durable Object itself, or Cloudflare Rate
// Limiting rules) would be needed for a stricter guarantee.

const hits = new Map(); // key -> array of timestamps (ms)

export function isRateLimited(key, { maxRequests, windowMs }) {
  const now = Date.now();
  const cutoff = now - windowMs;

  const existing = hits.get(key) || [];
  const recent = existing.filter((ts) => ts > cutoff);

  if (recent.length >= maxRequests) {
    hits.set(key, recent);
    return true;
  }

  recent.push(now);
  hits.set(key, recent);
  return false;
}

// Exposed for tests only.
export function _resetRateLimitState() {
  hits.clear();
}
