import {
  me, login, register, logout,
  fetchTodayMission, fetchJourneys, fetchExperiments, fetchBooks,
  fetchPrinciples, fetchInsights, fetchWorksForMe,
} from "./api.js";
import { STATE, resetSessionState } from "./state.js";
import { SCREENS } from "./screens.js";

const screensEl = document.getElementById("screens");
const tabbarEl = document.getElementById("tabbar");
const captionEl = document.getElementById("stageCaption");
const acctBox = document.getElementById("acctBox");
const signOutBtn = document.getElementById("signOutBtn");

function stopAnyLessonAudio() {
  try { window.speechSynthesis?.cancel(); } catch (e) {}
}

export function go(id, opts = {}) {
  if (!SCREENS[id]) { console.warn("Unknown screen", id); return; }
  stopAnyLessonAudio();
  const cur = STATE.nav.current;
  if (!opts.root && !opts.replace && cur && cur !== id) STATE.nav.stack.push(cur);
  if (opts.root) STATE.nav.stack = [];
  STATE.nav.current = id;
  renderScreen(id);
}

export function goBack() {
  stopAnyLessonAudio();
  const prev = STATE.nav.stack.pop();
  if (prev) { STATE.nav.current = prev; renderScreen(prev); }
  else {
    const s = SCREENS[STATE.nav.current];
    if (!s || !s.tab) go("today", { root: true });
  }
}

export function renderScreen(id) {
  const def = SCREENS[id];
  if (!def) return;
  const wrap = document.createElement("div");
  wrap.className = "screen active";
  wrap.innerHTML = def.render();
  screensEl.innerHTML = "";
  screensEl.appendChild(wrap);
  screensEl.scrollTop = 0;
  if (def.after) def.after(wrap);

  if (def.tab) {
    tabbarEl.classList.add("visible");
    tabbarEl.querySelectorAll(".tab").forEach((t) => t.classList.toggle("active", t.dataset.tab === def.tab));
  } else {
    tabbarEl.classList.remove("visible");
  }
  captionEl.textContent = `Screen: ${id}${STATE.nav.stack.length ? "  ·  depth " + STATE.nav.stack.length : ""}`;
}

export function refresh() {
  if (STATE.nav.current) renderScreen(STATE.nav.current);
}

screensEl.addEventListener("click", (e) => {
  const backBtn = e.target.closest("[data-back]");
  if (backBtn) { goBack(); return; }
  const goBtn = e.target.closest("[data-go]");
  if (goBtn) go(goBtn.dataset.go, { root: goBtn.dataset.root === "1" });
});

tabbarEl.addEventListener("click", (e) => {
  const tab = e.target.closest(".tab");
  if (tab) go(tab.dataset.tab, { root: true });
});

signOutBtn.addEventListener("click", async () => {
  try { await logout(); } catch (e) {}
  resetSessionState();
  acctBox.textContent = "Not signed in";
  signOutBtn.style.display = "none";
  go("auth", { root: true });
});

/** Fetches everything the app needs after sign-in, once. Individual
 * screens refetch just their own slice after an action changes it. */
export async function loadAppData() {
  const [mission, journeys, experiments, books, principles, insights, works] = await Promise.all([
    fetchTodayMission(), fetchJourneys(), fetchExperiments(), fetchBooks(),
    fetchPrinciples(), fetchInsights(), fetchWorksForMe(),
  ]);
  STATE.todayMission = mission;
  STATE.journeys = journeys;
  STATE.experiments = experiments;
  STATE.books = books;
  STATE.playbookPrinciples = principles;
  STATE.playbookInsights = insights;
  STATE.worksForMe = works;
}

export async function afterSignedIn(user) {
  STATE.user = { id: user.id, email: user.email, displayName: user.displayName };
  STATE.profile = user;
  acctBox.textContent = user.displayName || user.email || "Signed in";
  signOutBtn.style.display = "block";

  if (!user.onboardingComplete) {
    go("onboard-why", { root: true });
    return;
  }
  await loadAppData();
  go("today", { root: true });
}

export async function doLogin(email, password) {
  const user = await login(email, password);
  await afterSignedIn(user);
}

export async function doRegister(email, password, displayName) {
  const user = await register(email, password, displayName);
  await afterSignedIn(user);
}

// ---- boot ----
(async function boot() {
  renderScreen("loading");
  try {
    const user = await me();
    await afterSignedIn(user);
  } catch (e) {
    go("auth", { root: true });
  }
})();
