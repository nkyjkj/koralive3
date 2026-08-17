import { normalizeFixture, callFootballApi, jsonError } from "../_lib/football.js";

export async function onRequestGet(context) {
  const { request, env } = context;
  const timezone = env.TIMEZONE || "Africa/Cairo";
  const ttl = Number(env.LIVE_CACHE_S || 60); // 1 min default, live data changes fast

  const cache = caches.default;
  const cacheKey = new Request(request.url, request);
  const cached = await cache.match(cacheKey);
  if (cached) return cached;

  try {
    const data = await callFootballApi("fixtures", { live: "all", timezone }, env);
    const payload = {
      success: true,
      cached: false,
      results: (data.response || []).map(normalizeFixture)
    };

    const response = new Response(JSON.stringify(payload), {
      headers: {
        "content-type": "application/json; charset=utf-8",
        "Cache-Control": `public, max-age=${ttl}`
      }
    });

    context.waitUntil(cache.put(cacheKey, response.clone()));
    return response;
  } catch (error) {
    return jsonError(error);
  }
}
