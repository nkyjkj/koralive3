// ============================================================
//  Kora Live - Cloudflare Worker (API only)
//  Static files (index.html/style.css/app.js) are served
//  automatically from the "public" folder via the ASSETS
//  binding configured in wrangler.toml - no need to embed
//  them here.
// ============================================================

const API_BASE = "https://v3.football.api-sports.io";

function todayKey(timezone) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).formatToParts(new Date());
  const get = (t) => parts.find((p) => p.type === t).value;
  return `${get("year")}-${get("month")}-${get("day")}`;
}

function normalizeFixture(item) {
  const f = item.fixture || {};
  const league = item.league || {};
  const teams = item.teams || {};
  const goals = item.goals || {};
  const status = f.status || {};

  return {
    id: f.id,
    date: f.date,
    timestamp: f.timestamp,
    referee: f.referee,
    venue: f.venue || {},
    status: {
      short: status.short,
      long: status.long,
      elapsed: status.elapsed,
      extra: status.extra
    },
    league: {
      id: league.id,
      name: league.name,
      country: league.country,
      logo: league.logo,
      flag: league.flag
    },
    home: teams.home || {},
    away: teams.away || {},
    goals: {
      home: goals.home,
      away: goals.away
    }
  };
}

export async function callFootballApi(endpoint, params, env) {
  if (!env.API_FOOTBALL_KEY) {
    const err = new Error("API_FOOTBALL_KEY is missing. Add it in Cloudflare Pages > Settings > Environment variables.");
    err.status = 500;
    throw err;
  }

  const qs = new URLSearchParams(params).toString();
  const url = `${API_BASE}/${endpoint}${qs ? `?${qs}` : ""}`;

  const res = await fetch(url, {
    headers: {
      "x-apisports-key": env.API_FOOTBALL_KEY,
      "Accept": "application/json"
    }
  });

  const data = await res.json();

  if (!res.ok || (data.errors && Object.keys(data.errors).length)) {
    const err = new Error("API-Football returned an error.");
    err.status = res.status || 502;
    err.details = data.errors || data;
    throw err;
  }

  return data;
}

function jsonError(error) {
  return new Response(
    JSON.stringify({
      success: false,
      message: error.message || "Unexpected error.",
      details: error.details || null
    }),
    {
      status: error.status || 500,
      headers: { "content-type": "application/json; charset=utf-8" }
    }
  );
}


function jsonError(error) {
  return new Response(
    JSON.stringify({
      success: false,
      message: error.message || "Unexpected error.",
      details: error.details || null
    }),
    {
      status: error.status || 500,
      headers: { "content-type": "application/json; charset=utf-8" }
    }
  );
}

async function handleHealth(env) {
  const timezone = env.TIMEZONE || "Africa/Cairo";
  return new Response(
    JSON.stringify({
      ok: true,
      apiConfigured: Boolean(env.API_FOOTBALL_KEY),
      timezone,
      today: todayKey(timezone)
    }),
    { headers: { "content-type": "application/json; charset=utf-8" } }
  );
}

async function handleFixtures(request, env, ctx) {
  const timezone = env.TIMEZONE || "Africa/Cairo";
  const ttl = Number(env.FIXTURES_CACHE_S || 1800);
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
    ctx.waitUntil(cache.put(cacheKey, response.clone()));
    return response;
  } catch (error) {
    return jsonError(error);
  }
}

async function handleLive(request, env, ctx) {
  const timezone = env.TIMEZONE || "Africa/Cairo";
  const ttl = Number(env.LIVE_CACHE_S || 60);

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
    ctx.waitUntil(cache.put(cacheKey, response.clone()));
    return response;
  } catch (error) {
    return jsonError(error);
  }
}

async function handleFixtureById(request, env, ctx, id) {
  const timezone = env.TIMEZONE || "Africa/Cairo";

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
    ctx.waitUntil(cache.put(cacheKey, response.clone()));
    return response;
  } catch (error) {
    return jsonError(error);
  }
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const path = url.pathname;

    if (path === "/api/health") return handleHealth(env);
    if (path === "/api/fixtures") return handleFixtures(request, env, ctx);
    if (path === "/api/live") return handleLive(request, env, ctx);
    if (path.startsWith("/api/fixture/")) {
      const id = path.split("/").pop();
      return handleFixtureById(request, env, ctx, id);
    }

    // Everything else (index.html, style.css, app.js, ...) is
    // served automatically from the "public" folder.
    return env.ASSETS.fetch(request);
  }
};
