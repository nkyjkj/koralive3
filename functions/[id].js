import { callFootballApi, jsonError } from "../../_lib/football.js";

export async function onRequestGet(context) {
  const { request, env, params } = context;
  const timezone = env.TIMEZONE || "Africa/Cairo";
  const id = params.id;

  const cache = caches.default;
  const cacheKey = new Request(request.url, request);
  const cached = await cache.match(cacheKey);
  if (cached) return cached;

  try {
    const data = await callFootballApi("fixtures", { id, timezone }, env);
    const payload = {
      success: true,
      cached: false,
      result: (data.response && data.response[0]) || null
    };

    const response = new Response(JSON.stringify(payload), {
      headers: {
        "content-type": "application/json; charset=utf-8",
        "Cache-Control": "public, max-age=600"
      }
    });

    context.waitUntil(cache.put(cacheKey, response.clone()));
    return response;
  } catch (error) {
    return jsonError(error);
  }
}
