export const API_BASE = "https://v3.football.api-sports.io";

export function todayKey(timezone) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).formatToParts(new Date());
  const get = (t) => parts.find((p) => p.type === t).value;
  return `${get("year")}-${get("month")}-${get("day")}`;
}

export function normalizeFixture(item) {
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

export function jsonError(error) {
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
