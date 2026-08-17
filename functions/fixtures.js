import { normalizeFixture, callFootballApi, todayKey, jsonError } from "../_lib/football.js";

export async function onRequestGet(context) {
  const { request, env } = context;
  const timezone = env.TIMEZONE || "Africa/Cairo";
  const ttl = Number(env.FIXTURES_CACHE_S || 1800); // 30 min default

  const url = new URL(request.url);
  const date = url.searchParams.get("date") || todayKey(timezone);

  const cache = caches.default;
  const cacheKey = new Request(url.toString(), request);
  const cached = await cache.match(cacheKey);
  if (cached) return cached;

  try {
    const data = await callFootballApi("fixtures", { date, timezone }, env);
    const payload = {
      success: true,
      date,
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
