/* ---------------- i18n ---------------- */
const DICT = {
  ar: {
    brand: "كورة لايف",
    eyebrow_hero: "لوحة النتائج المباشرة",
    hero_title: "نتائج مباريات كرة القدم، لحظة بلحظة.",
    hero_desc: "تابع مباريات اليوم والنتائج المباشرة من مصدر بيانات رياضي موثوق.",
    hero_stat_label: "مباراة اليوم",
    live_now: "مباراة مباشرة الآن",
    date_label: "التاريخ",
    today: "اليوم",
    search_placeholder: "ابحث عن فريق...",
    section_eyebrow: "مركز المباريات",
    section_title: "مباريات اليوم",
    filter_all: "الكل",
    filter_live: "مباشر",
    filter_scheduled: "لم تبدأ",
    filter_finished: "انتهت",
    state_loading: "جاري تحميل المباريات...",
    state_empty: "لا توجد مباريات مطابقة لهذا البحث أو الفلتر.",
    state_error: "تعذّر تحميل المباريات، حاول مرة أخرى.",
    status_live: "مباشر",
    status_finished: "انتهت",
    venue_label: "الملعب",
    referee_label: "الحكم",
    footer_tag: "منصة نتائج مباريات كرة القدم مباشرة",
    theme_toggle: "تبديل المظهر",
    lang_toggle: "English",
    league_fallback: "بطولة",
    team_fallback: "الفريق",
  },
  en: {
    brand: "Kora Live",
    eyebrow_hero: "LIVE SCOREBOARD",
    hero_title: "Football scores, live.",
    hero_desc: "Follow today's fixtures and live scores from a trusted sports data source.",
    hero_stat_label: "matches today",
    live_now: "matches live now",
    date_label: "Date",
    today: "Today",
    search_placeholder: "Search a team...",
    section_eyebrow: "MATCH CENTER",
    section_title: "Today's Fixtures",
    filter_all: "All",
    filter_live: "Live",
    filter_scheduled: "Upcoming",
    filter_finished: "Finished",
    state_loading: "Loading fixtures…",
    state_empty: "No matches for this search or filter.",
    state_error: "Couldn't load fixtures, please try again.",
    status_live: "LIVE",
    status_finished: "FT",
    venue_label: "Venue",
    referee_label: "Referee",
    footer_tag: "Live football scores platform",
    theme_toggle: "Toggle theme",
    lang_toggle: "العربية",
    league_fallback: "League",
    team_fallback: "Team",
  }
};

const state = {
  lang: localStorage.getItem("lang") || "ar",
  date: localDate(),
  filter: "all",
  query: "",
  matches: [],
  favLeagues: JSON.parse(localStorage.getItem("favLeagues") || "[]")
};

function t(key) {
  return DICT[state.lang][key] || DICT.ar[key] || key;
}

function applyLang() {
  const dir = state.lang === "ar" ? "rtl" : "ltr";
  document.documentElement.lang = state.lang;
  document.documentElement.dir = dir;
  document.title = state.lang === "ar"
    ? "كورة لايف | نتائج مباريات كرة القدم"
    : "Kora Live | Football Scores";

  document.querySelectorAll("[data-i18n]").forEach(el => {
    el.textContent = t(el.dataset.i18n);
  });
  document.querySelectorAll("[data-i18n-placeholder]").forEach(el => {
    el.placeholder = t(el.dataset.i18nPlaceholder);
  });
  document.querySelectorAll("[data-i18n-aria]").forEach(el => {
    el.setAttribute("aria-label", t(el.dataset.i18nAria));
  });

  document.getElementById("selectedDate").textContent = formatDate(state.date);
}

/* ---------------- Date helpers ---------------- */
function localDate(d = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Africa/Cairo",
    year: "numeric", month: "2-digit", day: "2-digit"
  }).formatToParts(d);
  const get = t => parts.find(x => x.type === t).value;
  return `${get("year")}-${get("month")}-${get("day")}`;
}

function shiftDate(date, days) {
  const d = new Date(`${date}T12:00:00`);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

function formatDate(date) {
  const locale = state.lang === "ar" ? "ar-EG" : "en-GB";
  return new Intl.DateTimeFormat(locale, {
    timeZone: "Africa/Cairo", weekday: "long", day: "numeric", month: "long"
  }).format(new Date(`${date}T12:00:00`));
}

function formatTime(iso) {
  const locale = state.lang === "ar" ? "ar-EG" : "en-GB";
  return new Intl.DateTimeFormat(locale, {
    timeZone: "Africa/Cairo", hour: "2-digit", minute: "2-digit"
  }).format(new Date(iso));
}

/* ---------------- Utils ---------------- */
function esc(s = "") {
  return String(s).replace(/[&<>"']/g, c => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;"
  }[c]));
}

function statusType(s) {
  const live = ["1H", "2H", "ET", "BT", "P", "LIVE", "HT"];
  const finished = ["FT", "AET", "PEN", "AWD", "WO", "CANC", "ABD"];
  if (live.includes(s)) return "live";
  if (finished.includes(s)) return "finished";
  return "scheduled";
}

function statusLabel(m) {
  const type = statusType(m.status.short);
  if (type === "live") return `● ${m.status.elapsed ? m.status.elapsed + "'" : t("status_live")}`;
  if (type === "finished") return t("status_finished");
  return formatTime(m.date);
}

/* ---------------- Data loading ---------------- */
async function loadMatches() {
  const stateEl = document.getElementById("state");
  const grid = document.getElementById("matchesGrid");
  stateEl.textContent = t("state_loading");
  stateEl.style.display = "block";
  grid.innerHTML = "";

  try {
    const res = await fetch(`/api/fixtures?date=${encodeURIComponent(state.date)}`);
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || t("state_error"));

    state.matches = data.results || [];
    document.getElementById("selectedDate").textContent = formatDate(state.date);

    document.getElementById("matchCount").textContent = state.matches.length.toLocaleString("en-US");

    const liveCount = state.matches.filter(m => statusType(m.status.short) === "live").length;
    const liveBadge = document.getElementById("liveBadge");
    if (liveCount > 0) {
      liveBadge.hidden = false;
      document.getElementById("liveCount").textContent = liveCount.toLocaleString("en-US");
    } else {
      liveBadge.hidden = true;
    }

    render();
  } catch (e) {
    stateEl.textContent = e.message || t("state_error");
  }
}

/* ---------------- Render ---------------- */
function render() {
  const grid = document.getElementById("matchesGrid");
  const stateEl = document.getElementById("state");
  const q = state.query.trim().toLowerCase();

  let list = state.matches.filter(m => {
    const type = statusType(m.status.short);
    const matchesFilter = state.filter === "all" || state.filter === type;
    const matchesQuery = !q ||
      (m.home.name || "").toLowerCase().includes(q) ||
      (m.away.name || "").toLowerCase().includes(q);
    return matchesFilter && matchesQuery;
  });

  if (!list.length) {
    grid.innerHTML = "";
    stateEl.textContent = t("state_empty");
    stateEl.style.display = "block";
    return;
  }
  stateEl.style.display = "none";

  const groups = new Map();
  for (const m of list) {
    const key = `${m.league.id}-${m.league.name}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(m);
  }

  const sortedGroups = [...groups.values()].sort((a, b) => {
    const aFav = state.favLeagues.includes(a[0].league.id) ? 0 : 1;
    const bFav = state.favLeagues.includes(b[0].league.id) ? 0 : 1;
    return aFav - bFav;
  });

  grid.innerHTML = sortedGroups.map(group => {
    const league = group[0].league;
    const isFav = state.favLeagues.includes(league.id);
    return `
      <article class="league-card">
        <div class="league-head">
          ${league.logo ? `<img src="${esc(league.logo)}" alt="" loading="lazy">` : ""}
          <div class="league-names">
            <strong>${esc(league.name || t("league_fallback"))}</strong>
            <small>${esc(league.country || "")}</small>
          </div>
          <button class="fav-btn ${isFav ? "active" : ""}" data-league="${league.id}" aria-label="favorite">★</button>
        </div>
        ${group.map(matchRow).join("")}
      </article>
    `;
  }).join("");

  grid.querySelectorAll(".fav-btn").forEach(btn => {
    btn.onclick = () => {
      const id = Number(btn.dataset.league);
      const idx = state.favLeagues.indexOf(id);
      if (idx === -1) state.favLeagues.push(id); else state.favLeagues.splice(idx, 1);
      localStorage.setItem("favLeagues", JSON.stringify(state.favLeagues));
      render();
    };
  });
}

function matchRow(m) {
  const type = statusType(m.status.short);
  const homeLogo = m.home.logo ? `<img src="${esc(m.home.logo)}" alt="" loading="lazy">` : "";
  const awayLogo = m.away.logo ? `<img src="${esc(m.away.logo)}" alt="" loading="lazy">` : "";

  const score = m.goals.home == null && m.goals.away == null
    ? "—"
    : `${m.goals.home ?? 0} - ${m.goals.away ?? 0}`;

  const details = [];
  if (m.venue && m.venue.name) details.push(`<span><b>${t("venue_label")}</b>${esc(m.venue.name)}</span>`);
  if (m.referee) details.push(`<span><b>${t("referee_label")}</b>${esc(m.referee)}</span>`);

  return `
    <details class="match" data-id="${m.id}">
      <summary>
        <div class="side home">
          <span class="team-name">${esc(m.home.name || t("team_fallback"))}</span>
          ${homeLogo}
        </div>
        <div class="score-box">
          <span class="score">${score}</span>
          <span class="status ${type}">${statusLabel(m)}</span>
        </div>
        <div class="side away">
          ${awayLogo}
          <span class="team-name">${esc(m.away.name || t("team_fallback"))}</span>
        </div>
      </summary>
      ${details.length ? `<div class="match-detail">${details.join("")}</div>` : ""}
    </details>
  `;
}

/* ---------------- Events ---------------- */
document.getElementById("prevDay").onclick = () => { state.date = shiftDate(state.date, -1); loadMatches(); };
document.getElementById("nextDay").onclick = () => { state.date = shiftDate(state.date, 1); loadMatches(); };
document.getElementById("todayBtn").onclick = () => { state.date = localDate(); loadMatches(); };

document.querySelectorAll(".filter").forEach(btn => {
  btn.onclick = () => {
    document.querySelectorAll(".filter").forEach(b => b.classList.remove("active"));
    btn.classList.add("active");
    state.filter = btn.dataset.filter;
    render();
  };
});

let searchTimer;
document.getElementById("searchInput").oninput = (e) => {
  clearTimeout(searchTimer);
  searchTimer = setTimeout(() => { state.query = e.target.value; render(); }, 150);
};

document.getElementById("themeBtn").onclick = () => {
  document.documentElement.classList.toggle("dark");
  localStorage.setItem("dark", document.documentElement.classList.contains("dark") ? "1" : "0");
};
if (localStorage.getItem("dark") === "1") document.documentElement.classList.add("dark");

document.getElementById("langBtn").onclick = () => {
  state.lang = state.lang === "ar" ? "en" : "ar";
  localStorage.setItem("lang", state.lang);
  applyLang();
  render();
};

/* ---------------- Init ---------------- */
applyLang();
loadMatches();

// Gentle auto-refresh for live matches on today's view.
setInterval(() => {
  if (state.date === localDate()) loadMatches();
}, 60000);
