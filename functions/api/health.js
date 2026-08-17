import { todayKey } from "../_lib/football.js";

export async function onRequestGet({ env }) {
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
