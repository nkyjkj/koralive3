const express = require("express");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 3000;
const API_KEY = process.env.API_FOOTBALL_KEY;
const API_BASE = "https://v3.football.api-sports.io";
const TIMEZONE = process.env.TIMEZONE || "Africa/Cairo";

const DAILY_BUDGET = Number(process.env.DAILY_API_BUDGET || 90);
const FIXTURES_CACHE_MS = Number(process.env.FIXTURES_CACHE_MS || 1800000);
const LIVE_CACHE_MS = Number(process.env.LIVE_CACHE_MS || 600000);

const cache = new Map();
let quota = { day: "", used: 0 };

function todayKey() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).format(new Date());
}

function resetQuotaIfNeeded() {
  const day = todayKey();
  if (quota.day !== day) quota = { day, used: 0 };
}

function canCallApi() {
  resetQuotaIfNeeded();
  return quota.used < DAILY_BUDGET;
}

async function footballApi(endpoint, params = {}, cacheKey, ttl) {
  const cached = cache.get(cacheKey);
  if (cached && Date.now() - cached.time < ttl) {
    return { data: cached.data, cached: true };
  }

  if (!API_KEY) {
    const err = new Error("API_FOOTBALL_KEY is missing. Add it to Railway Variables.");
    err.status = 500;
    throw err;
  }

  if (!canCallApi()) {
    if (cached) return { data: cached.data, cached: true, quotaLimited: true };
    const err = new Error("Daily API budget reached. Cached data is unavailable.");
    err.status = 429;
    throw err;
  }

  const qs = new URLSearchParams(params).toString();
  const url = `${API_BASE}/${endpoint}${qs ? `?${qs}` : ""}`;

  const response = await fetch(url, {
    headers: {
      "x-apisports-key": API_KEY,
      "Accept": "application/json"
    }
  });

  const data = await response.json();
  quota.used += 1;

  if (!response.ok || (data.errors && Object.keys(data.errors).length)) {
    const err = new Error("API-Football returned an error.");
    err.status = response.status || 502;
    err.details = data.errors || data;
    throw err;
  }

  cache.set(cacheKey, { time: Date.now(), data });
  return { data, cached: false };
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

app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

app.get("/api/health", (req, res) => {
  resetQuotaIfNeeded();
  res.json({
    ok: true,
    apiConfigured: Boolean(API_KEY),
    quotaUsed: quota.used,
    quotaBudget: DAILY_BUDGET,
    timezone: TIMEZONE
  });
});

app.get("/api/fixtures", async (req, res) => {
  try {
    const date = req.query.date || todayKey();
    const result = await footballApi(
      "fixtures",
      { date, timezone: TIMEZONE },
      `fixtures:${date}`,
      FIXTURES_CACHE_MS
    );

    res.json({
      success: true,
      date,
      cached: result.cached,
      quotaLimited: Boolean(result.quotaLimited),
      results: (result.data.response || []).map(normalizeFixture)
    });
  } catch (error) {
    res.status(error.status || 500).json({
      success: false,
      message: error.message,
      details: error.details || null
    });
  }
});

app.get("/api/live", async (req, res) => {
  try {
    const result = await footballApi(
      "fixtures",
      { live: "all", timezone: TIMEZONE },
      "live:all",
      LIVE_CACHE_MS
    );

    res.json({
      success: true,
      cached: result.cached,
      quotaLimited: Boolean(result.quotaLimited),
      results: (result.data.response || []).map(normalizeFixture)
    });
  } catch (error) {
    res.status(error.status || 500).json({
      success: false,
      message: error.message,
      details: error.details || null
    });
  }
});

app.get("/api/fixture/:id", async (req, res) => {
  try {
    const id = String(req.params.id);
    const result = await footballApi(
      "fixtures",
      { id, timezone: TIMEZONE },
      `fixture:${id}`,
      600000
    );

    res.json({
      success: true,
      cached: result.cached,
      result: result.data.response?.[0] || null
    });
  } catch (error) {
    res.status(error.status || 500).json({
      success: false,
      message: error.message,
      details: error.details || null
    });
  }
});

app.get("/api/quota", (req, res) => {
  resetQuotaIfNeeded();
  res.json({
    day: quota.day,
    used: quota.used,
    budget: DAILY_BUDGET,
    remaining: Math.max(0, DAILY_BUDGET - quota.used)
  });
});

// Frontend fallback
app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

app.listen(PORT, () => {
  console.log(`Football Results running on port ${PORT}`);
});
