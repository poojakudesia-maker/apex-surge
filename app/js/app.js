import {
  auth, googleProvider, signInWithPopup, fbSignOut, onAuthStateChanged,
} from "./firebase.js";
import { ensureUserDoc, watchUser, watchCollection, watchBooks, todayId, watchMission } from "./api.js";
import { STATE, clearSubs, resetSessionState } from "./state.js";
import { SCREENS } from "./screens.js";

const screensEl = document.getElementById("screens");
const tabbarEl = document.getElementById("tabbar");
const captionEl = document.getElementById("stageCaption");
const acctBox = document.getElementById("acctBox");
const signOutBtn = document.getElementById("signOutBtn");

export function go(id, opts = {}) {
  if (!SCREENS[id]) { console.warn("Unknown screen", id); return; }
  const cur = STATE.nav.current;
  if (!opts.root && !opts.replace && cur && cur !== id) STATE.nav.stack.push(cur);
  if (opts.root) STATE.nav.stack = [];
  STATE.nav.current = id;
  renderScreen(id);
}

export function goBack() {
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

// re-render the currently visible screen (used after async data arrives)
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

signOutBtn.addEventListener("click", () => fbSignOut(auth));

function subscribeUserData(uid) {
  STATE.unsubs.push(
    watchUser(uid, (profile) => {
      STATE.profile = profile;
      if (profile?.onboardingComplete) {
        watchMissionForToday(uid);
        subscribeCollections(uid);
      }
      routeForAuthState();
    })
  );
}

let missionUnsub = null;
function watchMissionForToday(uid) {
  if (missionUnsub) missionUnsub();
  missionUnsub = watchMission(uid, todayId(), (mission) => {
    STATE.todayMission = mission;
    refresh();
  });
  STATE.unsubs.push(missionUnsub);
}

function subscribeCollections(uid) {
  STATE.unsubs.push(
    watchCollection(uid, "journeys", (list) => { STATE.journeys = list; refresh(); }),
    watchCollection(uid, "experiments", (list) => { STATE.experiments = list; refresh(); }),
    watchCollection(uid, "playbookInsights", (list) => { STATE.playbookInsights = list; refresh(); }, { orderByField: "createdAt" }),
    watchCollection(uid, "playbookPrinciples", (list) => { STATE.playbookPrinciples = list; refresh(); }),
    watchCollection(uid, "worksForMe", (list) => { STATE.worksForMe = list; refresh(); }),
    watchBooks((list) => { STATE.books = list; refresh(); })
  );
}

function routeForAuthState() {
  if (!STATE.user) { go("auth", { root: true }); return; }
  if (!STATE.profile) { go("loading", { root: true }); return; }
  if (!STATE.profile.onboardingComplete) {
    if (!SCREENS[STATE.nav.current] || SCREENS[STATE.nav.current].tab || STATE.nav.current === "auth" || STATE.nav.current === "loading") {
      go("onboard-why", { root: true });
    }
    return;
  }
  if (STATE.nav.current === "auth" || STATE.nav.current === "loading" || !STATE.nav.current) {
    go("today", { root: true });
  } else {
    refresh();
  }
}

onAuthStateChanged(auth, async (user) => {
  if (user) {
    acctBox.textContent = user.displayName || user.email || "Signed in";
    signOutBtn.style.display = "block";
    STATE.user = user;
    const { data } = await ensureUserDoc(user);
    if (data) STATE.profile = data;
    subscribeUserData(user.uid);
    routeForAuthState();
  } else {
    acctBox.textContent = "Not signed in";
    signOutBtn.style.display = "none";
    resetSessionState();
    STATE.user = null;
    go("auth", { root: true });
  }
});

export async function doGoogleSignIn(btn) {
  try {
    btn?.setAttribute("data-loading", "1");
    await signInWithPopup(auth, googleProvider);
  } catch (err) {
    console.error(err);
    alert("Sign-in failed: " + (err?.message || err));
  } finally {
    btn?.removeAttribute("data-loading");
  }
}

// initial paint
renderScreen("loading");
