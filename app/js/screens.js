// Apex Surge — real app screens (PHP + MySQL backed)
import { STATE } from "./state.js";
import {
  generateGrowthProfile, generateDailyMission, diagnoseReflection,
  markExperimentDayFn, adaptExperiment, completeMission, applyBookToLife,
  generateRoadmap, generateJourneyTask, advanceJourneyWeek, coachReply,
  roleplayReply, roleplayFeedback, synthesizeWeeklyReview, toggleExperimentDay,
  addPrinciple, addWorksForMe, submitQuizAnswer, fetchJourneys, fetchExperiments,
  fetchPrinciples, fetchWorksForMe, me,
} from "./api.js";
import { doLogin, doSignupStart, doSignupVerify, doSignupResend, loadAppData, signOutUser } from "./app.js";

// go/refresh are attached lazily to avoid a circular-import race
let _nav = null;
async function nav() {
  if (!_nav) _nav = await import("./app.js");
  return _nav;
}
function go(id, opts) { nav().then((m) => m.go(id, opts)); }
function refresh() { nav().then((m) => m.refresh()); }

function topbar(title, opts = {}) {
  return `<div class="topbar">
    ${opts.back ? `<button class="back-btn" data-back>‹</button>` : `<div class="topbar-spacer"></div>`}
    <div class="topbar-title">${title}</div>
    <div class="topbar-spacer"></div>
  </div>`;
}
function ring(pct, size = 118, stroke = 10, color = "var(--accent)") {
  const r = (size - stroke) / 2, c = 2 * Math.PI * r, off = c * (1 - pct / 100);
  return `<svg width="${size}" height="${size}">
    <circle cx="${size/2}" cy="${size/2}" r="${r}" stroke="var(--card-soft)" stroke-width="${stroke}" fill="none"/>
    <circle cx="${size/2}" cy="${size/2}" r="${r}" stroke="${color}" stroke-width="${stroke}" fill="none"
      stroke-linecap="round" stroke-dasharray="${c}" stroke-dashoffset="${off}" style="transition:stroke-dashoffset .6s ease"/>
  </svg>`;
}
function bookCover(b, w = 52, h = 70) {
  const initials = (b.title || "??").split(" ").map((w) => w[0]).slice(0, 2).join("").toUpperCase();
  return `<div class="book-cover" style="width:${w}px;height:${h}px;background:linear-gradient(160deg,${b.color||'#7c5cff'},#00000055)">${initials}</div>`;
}
function errorHtml(msg) { return `<div class="error-banner">${msg}</div>`; }

// ---- lesson audio (browser text-to-speech, no extra backend/cost) ----
const speech = {
  utterance: null,
  state: "idle", // idle | playing | paused
  supported: typeof window !== "undefined" && "speechSynthesis" in window,
  stop() {
    if (this.supported) window.speechSynthesis.cancel();
    this.utterance = null;
    this.state = "idle";
  },
  play(text, onEnd) {
    if (!this.supported) return;
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.rate = 0.98;
    u.onend = () => { this.state = "idle"; onEnd?.(); };
    u.onerror = () => { this.state = "idle"; onEnd?.(); };
    this.utterance = u;
    this.state = "playing";
    window.speechSynthesis.speak(u);
  },
  pause() { if (this.supported && this.state === "playing") { window.speechSynthesis.pause(); this.state = "paused"; } },
  resume() { if (this.supported && this.state === "paused") { window.speechSynthesis.resume(); this.state = "playing"; } },
};
function loadingSpinner() { return `<div class="center-col" style="padding-top:80px;"><div class="loader-ring"></div></div>`; }

async function withLoading(btn, fn) {
  if (!btn) return fn();
  const original = btn.innerHTML;
  btn.setAttribute("data-loading", "1");
  btn.innerHTML = `<span class="inline-spinner"></span>`;
  try { await fn(); }
  catch (e) {
    console.error(e);
    alert("Something went wrong: " + (e?.message || e));
  } finally {
    btn.removeAttribute("data-loading");
    btn.innerHTML = original;
  }
}

const AREAS = [
  { id: "career", label: "Career", ico: "💼" }, { id: "confidence", label: "Confidence", ico: "⚡" },
  { id: "relationships", label: "Relationships", ico: "🤝" }, { id: "money", label: "Money", ico: "💰" },
  { id: "health", label: "Health", ico: "🌿" }, { id: "leadership", label: "Leadership", ico: "🧭" },
  { id: "productivity", label: "Productivity", ico: "⏱" }, { id: "communication", label: "Communication", ico: "💬" },
  { id: "mindset", label: "Mindset", ico: "🧠" },
];
const TIME_OPTS = [3, 5, 10, 15, 30];
const STYLE_OPTS = [
  { id: "text", label: "Text", dsc: "Read short lessons", ico: "📄" },
  { id: "audio", label: "Audio", dsc: "Listen on the go", ico: "🎧" },
  { id: "interactive", label: "Interactive", dsc: "Practice as you go", ico: "🎛" },
];
const GROWTH_GOALS = [
  { id: "leader", title: "Become a Better Leader", ico: "🧭", dsc: "Delegation, difficult conversations, executive presence", weeks: 8 },
  { id: "confidence", title: "Build Real Confidence", ico: "⚡", dsc: "Speak up, ask for what you want, handle pushback", weeks: 6 },
  { id: "focus", title: "Reclaim Deep Focus", ico: "🎯", dsc: "Fewer distractions, more meaningful output", weeks: 4 },
  { id: "newjob", title: "Nail Your New Job", ico: "🚀", dsc: "A 30-day plan for your first month", weeks: 4 },
];
const ROLEPLAY_SCENARIOS = [
  { id: "manager", label: "Your Manager", dsc: "Practice asking for a promotion", ico: "🧑‍💼" },
  { id: "report", label: "A Direct Report", dsc: "Practice giving hard feedback", ico: "🧑‍🤝‍🧑" },
  { id: "client", label: "A Difficult Client", dsc: "Practice holding a boundary", ico: "🗂" },
];

export const SCREENS = {};

/* ================= LOADING / AUTH ================= */

SCREENS["loading"] = {
  render() {
    return `<div class="full-bleed">
      <div class="loader-ring"></div>
      <div class="h2">Apex Surge</div>
      <p class="sub">Loading your account…</p>
    </div>`;
  },
};

function authHeader() {
  return `<div class="center-col" style="margin-bottom:22px;">
    <div style="width:64px;height:64px;border-radius:18px;background:linear-gradient(135deg,var(--accent),#4a34c9);display:flex;align-items:center;justify-content:center;font-weight:800;font-size:22px;box-shadow:0 16px 40px rgba(124,92,255,.4);margin-bottom:14px;">AS</div>
    <div style="font-size:22px;font-weight:800;margin-bottom:6px;">Apex Surge</div>
    <div style="color:var(--text-dim);font-size:13px;line-height:1.6;max-width:260px;text-align:center;">Don't just learn what the world's best books say. Turn their ideas into a program that helps you actually change.</div>
  </div>`;
}

SCREENS["auth"] = {
  render() {
    const mode = STATE.ui.authMode || "login";

    if (mode === "verify") {
      return `<div class="auth-screen" style="text-align:left;align-items:stretch;">
        ${authHeader()}
        <div id="authError"></div>
        <p class="sub" style="text-align:center;">We sent a 6-digit code to<br><b style="color:var(--text);">${STATE.ui.pendingSignupEmail || "your email"}</b></p>
        <div class="field-label" style="margin-top:0;text-align:center;">Verification code</div>
        <input type="text" id="authCode" inputmode="numeric" pattern="[0-9]*" maxlength="6" placeholder="000000" class="pin-input" />
        <button class="btn" id="authSubmit" style="margin-top:18px;">Verify & create account</button>
        <p class="sub" style="text-align:center;margin-top:16px;">
          Didn't get it? <a href="#" id="authResend" style="color:var(--accent);font-weight:600;">Resend code</a>
          &nbsp;·&nbsp; <a href="#" id="authBack" style="color:var(--text-faint);">Use a different email</a>
        </p>
      </div>`;
    }

    return `<div class="auth-screen" style="text-align:left;align-items:stretch;">
      ${authHeader()}
      <div id="authError"></div>
      ${mode === "register" ? `<div class="field-label" style="margin-top:0;">Name</div><input type="text" id="authName" placeholder="What should we call you?" />` : ""}
      <div class="field-label" style="margin-top:${mode === "register" ? "14" : "0"}px;">Email</div>
      <input type="email" id="authEmail" placeholder="you@example.com" />
      <div class="field-label">${mode === "register" ? "Choose a 4-digit PIN" : "PIN"}</div>
      <input type="text" id="authPin" inputmode="numeric" pattern="[0-9]*" maxlength="4" placeholder="${mode === "register" ? "4 digits" : "••••"}" class="pin-input" />
      <button class="btn" id="authSubmit" style="margin-top:18px;">${mode === "register" ? "Send verification code" : "Sign in"}</button>
      <p class="sub" style="text-align:center;margin-top:16px;">
        ${mode === "register" ? "Already have an account?" : "New here?"}
        <a href="#" id="authToggle" style="color:var(--accent);font-weight:600;">${mode === "register" ? "Sign in" : "Create one"}</a>
      </p>
    </div>`;
  },
  after(el) {
    const mode = STATE.ui.authMode || "login";

    if (mode === "verify") {
      el.querySelector("#authCode").focus();
      el.querySelector("#authBack").addEventListener("click", (e) => {
        e.preventDefault();
        STATE.ui.authMode = "register";
        refresh();
      });
      el.querySelector("#authResend").addEventListener("click", (e) => {
        e.preventDefault();
        doSignupResend().catch((err) => { el.querySelector("#authError").innerHTML = errorHtml(err.message); });
      });
      const submit = el.querySelector("#authSubmit");
      submit.addEventListener("click", () => withLoading(submit, async () => {
        el.querySelector("#authError").innerHTML = "";
        const code = el.querySelector("#authCode").value.trim();
        try {
          await doSignupVerify(code);
        } catch (e) {
          el.querySelector("#authError").innerHTML = errorHtml(e.message || "Something went wrong.");
        }
      }));
      return;
    }

    el.querySelector("#authToggle").addEventListener("click", (e) => {
      e.preventDefault();
      STATE.ui.authMode = mode === "register" ? "login" : "register";
      refresh();
    });
    const submit = el.querySelector("#authSubmit");
    submit.addEventListener("click", () => withLoading(submit, async () => {
      el.querySelector("#authError").innerHTML = "";
      const email = el.querySelector("#authEmail").value.trim();
      const pin = el.querySelector("#authPin").value.trim();
      try {
        if (mode === "register") {
          const name = el.querySelector("#authName").value.trim();
          await doSignupStart(email, pin, name);
          STATE.ui.pendingSignupEmail = email;
          STATE.ui.authMode = "verify";
          refresh();
        } else {
          await doLogin(email, pin);
        }
      } catch (e) {
        el.querySelector("#authError").innerHTML = errorHtml(e.message || "Something went wrong.");
      }
    }));
  },
};

/* ================= ONBOARDING ================= */

SCREENS["onboard-why"] = {
  render() {
    return `<div class="steps-row"><div class="done"></div><div></div><div></div><div></div><div></div></div>
    <div class="eyebrow">Step 1 of 5</div>
    <div class="h1">Why do you want to grow right now?</div>
    <p class="sub">There's no wrong answer — this just helps us understand what's on your mind.</p>
    <textarea id="whyInput" rows="5" placeholder="e.g. I keep putting off important things and I want that to change...">${STATE.ui.onboarding.why}</textarea>
    <button class="btn" style="margin-top:20px;" id="whyNext">Continue</button>`;
  },
  after(el) {
    const ta = el.querySelector("#whyInput");
    ta.addEventListener("input", () => { STATE.ui.onboarding.why = ta.value; });
    el.querySelector("#whyNext").addEventListener("click", () => go("onboard-areas"));
  },
};

SCREENS["onboard-areas"] = {
  render() {
    return `<div class="steps-row"><div class="done"></div><div class="done"></div><div></div><div></div><div></div></div>
    <div class="eyebrow">Step 2 of 5</div>
    <div class="h1">Choose 1–3 life areas to focus on</div>
    <p class="sub">We'll build your Growth Journeys around these.</p>
    <div class="chip-row">${AREAS.map((a) => `<button class="chip ${STATE.ui.onboarding.areas.includes(a.id)?'selected':''}" data-area="${a.id}">${a.ico} ${a.label}</button>`).join("")}</div>
    <button class="btn" style="margin-top:22px;" id="areasNext">Continue</button>`;
  },
  after(el) {
    el.querySelectorAll("[data-area]").forEach((c) => c.addEventListener("click", () => {
      const id = c.dataset.area, arr = STATE.ui.onboarding.areas, idx = arr.indexOf(id);
      if (idx > -1) arr.splice(idx, 1); else if (arr.length < 3) arr.push(id);
      c.classList.toggle("selected");
    }));
    el.querySelector("#areasNext").addEventListener("click", () => {
      if (STATE.ui.onboarding.areas.length === 0) { alert("Pick at least 1 area to continue."); return; }
      go("onboard-challenge");
    });
  },
};

SCREENS["onboard-challenge"] = {
  render() {
    return `<div class="steps-row"><div class="done"></div><div class="done"></div><div class="done"></div><div></div><div></div></div>
    <div class="eyebrow">Step 3 of 5</div>
    <div class="h1">What's your biggest challenge right now?</div>
    <p class="sub">Be specific — this becomes the seed of your first Growth Journey.</p>
    <textarea id="challengeInput" rows="4" placeholder="e.g. I avoid difficult conversations with my team">${STATE.ui.onboarding.challenge}</textarea>
    <div class="chip-row">${["Procrastination","Confidence","Delegation","Focus","Difficult conversations"].map((t) => `<button class="chip" data-fill="${t}">${t}</button>`).join("")}</div>
    <button class="btn" style="margin-top:16px;" id="challengeNext">Continue</button>`;
  },
  after(el) {
    const ta = el.querySelector("#challengeInput");
    ta.addEventListener("input", () => { STATE.ui.onboarding.challenge = ta.value; });
    el.querySelectorAll("[data-fill]").forEach((c) => c.addEventListener("click", () => { ta.value = c.dataset.fill; STATE.ui.onboarding.challenge = c.dataset.fill; }));
    el.querySelector("#challengeNext").addEventListener("click", () => go("onboard-time"));
  },
};

SCREENS["onboard-time"] = {
  render() {
    return `<div class="steps-row"><div class="done"></div><div class="done"></div><div class="done"></div><div class="done"></div><div></div></div>
    <div class="eyebrow">Step 4 of 5</div>
    <div class="h1">How much time can you give daily?</div>
    <div class="chip-row">${TIME_OPTS.map((t) => `<button class="chip ${STATE.ui.onboarding.time===t?'selected':''}" data-time="${t}">${t} min</button>`).join("")}</div>
    <button class="btn" style="margin-top:22px;" id="timeNext">Continue</button>`;
  },
  after(el) {
    el.querySelectorAll("[data-time]").forEach((c) => c.addEventListener("click", () => {
      STATE.ui.onboarding.time = Number(c.dataset.time);
      el.querySelectorAll("[data-time]").forEach((x) => x.classList.remove("selected"));
      c.classList.add("selected");
    }));
    el.querySelector("#timeNext").addEventListener("click", () => go("onboard-style"));
  },
};

SCREENS["onboard-style"] = {
  render() {
    return `<div class="steps-row"><div class="done"></div><div class="done"></div><div class="done"></div><div class="done"></div><div class="done"></div></div>
    <div class="eyebrow">Step 5 of 5</div>
    <div class="h1">Choose your learning style</div>
    ${STYLE_OPTS.map((s) => `<div class="select-card ${STATE.ui.onboarding.style===s.id?'selected':''}" data-style="${s.id}">
      <div class="ico">${s.ico}</div><div class="txt"><div class="ttl">${s.label}</div><div class="dsc">${s.dsc}</div></div><div class="check-circle">✓</div></div>`).join("")}
    <button class="btn" style="margin-top:14px;" id="createProfileBtn">Create my Growth Profile</button>`;
  },
  after(el) {
    el.querySelectorAll("[data-style]").forEach((c) => c.addEventListener("click", () => {
      STATE.ui.onboarding.style = c.dataset.style;
      el.querySelectorAll("[data-style]").forEach((x) => x.classList.remove("selected"));
      c.classList.add("selected");
    }));
    el.querySelector("#createProfileBtn").addEventListener("click", async (e) => {
      go("onboard-generating");
      try {
        const result = await generateGrowthProfile(STATE.ui.onboarding);
        STATE.ui.generatedProfile = result;
        STATE.profile = await me();
        STATE.user = { ...STATE.user, ...STATE.profile };
        await loadAppData();
        go("onboard-ready", { replace: true });
      } catch (err) {
        console.error(err);
        go("onboard-style", { replace: true });
        alert("Couldn't generate your Growth Profile: " + (err?.message || err));
      }
    });
  },
};

SCREENS["onboard-generating"] = {
  render() {
    return `<div class="center-col" style="padding-top:80px;">
      <div class="loader-ring"></div>
      <div class="h2">Building your Growth Profile…</div>
      <p class="sub">Claude is reading what you told us and writing your first lesson.</p>
    </div>`;
  },
};

SCREENS["onboard-ready"] = {
  render() {
    const r = STATE.ui.generatedProfile;
    if (!r) return loadingSpinner();
    return `<div class="center-col" style="padding-top:16px;">
      <div class="eyebrow">Your Growth Profile is ready</div>
      <div class="h1">${r.journeyTitle}</div>
      <p class="sub">${r.summary}</p>
      <div class="card" style="width:100%;text-align:left;">
        <div class="tag">Day 1</div>
        <div style="font-weight:800;margin:10px 0 4px;font-size:15px;">${r.firstMission.lessonTitle}</div>
        <div class="sub" style="margin-bottom:0;">Based on ${r.firstMission.bookTitle} by ${r.firstMission.bookAuthor}</div>
      </div>
      <button class="btn" style="width:100%;" data-go="today" data-root="1">Enter Apex Surge</button>
    </div>`;
  },
};

/* ================= TODAY ================= */

SCREENS["today"] = {
  tab: "today",
  render() {
    const m = STATE.todayMission;
    const p = STATE.profile || {};
    const activeJourney = STATE.journeys.find((j) => j.status === "active");
    return `
    <div class="card-row" style="margin-bottom:18px;">
      <div><div style="font-size:12px;color:var(--text-faint);">Good to see you 👋</div><div class="h2" style="margin:2px 0 0;">Your Today</div></div>
      <div class="pill-score">🔥 ${p.streak ?? 0} day streak</div>
    </div>
    ${!m ? `
      <div class="card">
        <div class="eyebrow">No mission yet today</div>
        <div class="sub" style="margin-bottom:12px;">Generate today's lesson — grounded in your goals and what you've learned so far.</div>
        <button class="btn" id="genMissionBtn">Generate today's mission</button>
      </div>` : `
      <div class="card" style="background:linear-gradient(160deg,#241a3d,#171b24);border-color:#3a2c66;">
        <div class="eyebrow">Today's Mission · ${m.durationMin || 10} min</div>
        <div style="font-weight:800;font-size:17px;margin-bottom:6px;">${m.status==='complete' ? 'Mission complete ✓' : m.lessonTitle}</div>
        <div class="sub" style="margin-bottom:14px;">Based on ${m.bookTitle} · ${m.bookAuthor}</div>
        ${m.status==='complete'
          ? `<button class="btn secondary" data-go="playbook" data-root="1">See it in your Playbook</button>`
          : m.experiment
            ? `<button class="btn secondary" data-go="today-experiment-active">Review your experiment</button>`
            : `<button class="btn" data-go="today-lesson">Start</button>`}
      </div>`}
    <div class="stat-grid">
      <div class="stat-box"><div class="stat-num">${p.growthScore ?? 50}</div><div class="stat-lbl">Growth Score</div></div>
      <div class="stat-box"><div class="stat-num">${STATE.experiments.filter(e=>e.status==='active').length}</div><div class="stat-lbl">Active experiments</div></div>
    </div>
    ${activeJourney ? `
    <div class="field-label">Continue your journey</div>
    <div class="card card-soft" data-go="growth-detail" data-journey="${activeJourney.id}">
      <div class="card-row"><div><div style="font-weight:700;font-size:13.5px;">${activeJourney.goalTitle}</div><div class="sub" style="margin:4px 0 8px;">Week ${activeJourney.currentWeek} of ${activeJourney.weeks.length}</div></div><div style="font-size:13px;color:var(--text-faint);">${activeJourney.progressPct}%</div></div>
      <div class="progressbar"><div style="width:${activeJourney.progressPct}%"></div></div>
    </div>` : `
    <div class="field-label">Start a transformation</div>
    <div class="card card-soft" data-go="growth-list" data-root="1"><div class="card-row"><span style="font-size:13.5px;">◆ Begin a Growth Journey</span><span>›</span></div></div>`}
    <div class="field-label">Quick actions</div>
    <div class="card card-soft" data-go="coach-chat" data-root="1" style="margin-bottom:8px;"><div class="card-row"><span style="font-size:13.5px;">✦ Ask the AI Coach something</span><span>›</span></div></div>
    <div class="card card-soft" data-go="weekly-intro"><div class="card-row"><span style="font-size:13.5px;">📝 Start your Weekly Review</span><span>›</span></div></div>
    `;
  },
  after(el) {
    const btn = el.querySelector("#genMissionBtn");
    if (btn) btn.addEventListener("click", () => withLoading(btn, async () => {
      STATE.todayMission = await generateDailyMission();
      refresh();
    }));
    el.querySelectorAll("[data-journey]").forEach((c) => c.addEventListener("click", () => {
      STATE.activeJourney = STATE.journeys.find((j) => j.id === Number(c.dataset.journey));
    }));
  },
};

SCREENS["today-lesson"] = {
  back: true,
  render() {
    const m = STATE.todayMission;
    if (!m) return loadingSpinner();
    const mode = STATE.ui.lessonMode || "listen";

    if (mode === "read") {
      return `${topbar("Lesson", { back: true })}
      <div class="tag">${m.bookTitle} · ${m.durationMin || 10} min</div>
      <div class="h1" style="margin-top:10px;">${m.lessonTitle}</div>
      ${(m.lessonBody||[]).map((p) => `<p class="sub">${p}</p>`).join("")}
      ${speech.supported ? `<button class="btn ghost small" id="toListen" style="margin-bottom:10px;">🔊 Listen instead</button>` : ""}
      <button class="btn" id="lessonContinue">Continue</button>`;
    }

    return `${topbar("Lesson", { back: true })}
    <div class="tag">${m.bookTitle} · ${m.durationMin || 10} min</div>
    <div class="h1" style="margin-top:10px;">${m.lessonTitle}</div>
    <div class="card" style="text-align:center;padding:28px 18px;">
      <div style="font-size:11px;color:var(--text-faint);text-transform:uppercase;letter-spacing:.05em;font-weight:700;margin-bottom:14px;">Audio summary</div>
      <button class="avatar-ring" id="playBtn" style="width:64px;height:64px;font-size:22px;margin:0 auto 14px;border-color:var(--accent);cursor:pointer;">▶</button>
      <div class="sub" id="playStatus" style="margin-bottom:0;">${speech.supported ? "Tap play to listen" : "Audio isn't supported in this browser"}</div>
    </div>
    ${speech.supported ? `<button class="btn ghost small" id="toRead" style="margin-bottom:10px;">📄 Read instead</button>` : `<button class="btn ghost small" id="toRead" style="margin-bottom:10px;">📄 Show text</button>`}
    <button class="btn" id="lessonContinue">Continue</button>`;
  },
  after(el) {
    const m = STATE.todayMission;
    const bodyText = `${m.lessonTitle}. From ${m.bookTitle} by ${m.bookAuthor}. ${(m.lessonBody||[]).join(" ")}`;

    const toRead = el.querySelector("#toRead");
    if (toRead) toRead.addEventListener("click", () => { speech.stop(); STATE.ui.lessonMode = "read"; refresh(); });
    const toListen = el.querySelector("#toListen");
    if (toListen) toListen.addEventListener("click", () => { STATE.ui.lessonMode = "listen"; refresh(); });

    const playBtn = el.querySelector("#playBtn");
    if (playBtn) {
      const status = el.querySelector("#playStatus");
      const setIcon = () => {
        playBtn.textContent = speech.state === "playing" ? "⏸" : "▶";
        status.textContent = speech.state === "playing" ? "Playing…" : speech.state === "paused" ? "Paused" : "Tap play to listen";
      };
      setIcon();
      playBtn.addEventListener("click", () => {
        if (speech.state === "idle") speech.play(bodyText, () => { setIcon(); });
        else if (speech.state === "playing") speech.pause();
        else if (speech.state === "paused") speech.resume();
        setIcon();
      });
    }

    el.querySelector("#lessonContinue").addEventListener("click", () => { speech.stop(); go("today-lesson-q"); });
  },
};

SCREENS["today-lesson-q"] = {
  back: true,
  render() {
    const m = STATE.todayMission;
    if (!m) return loadingSpinner();
    return `${topbar("Check your understanding", { back: true })}
    <div class="eyebrow">Quick check</div>
    <div class="h2">${m.quizQuestion}</div>
    <div style="margin-top:14px;" id="qOpts">
      ${(m.quizOptions||[]).map((o, i) => `<div class="select-card" data-opt="${i}"><div class="txt"><div class="ttl" style="font-weight:600;font-size:13.5px;">${o}</div></div><div class="check-circle">✓</div></div>`).join("")}
    </div>
    <div id="qFeedback"></div>
    <button class="btn" id="qNext" style="margin-top:8px;" disabled>Continue</button>`;
  },
  after(el) {
    const m = STATE.todayMission;
    const next = el.querySelector("#qNext");
    el.querySelectorAll("[data-opt]").forEach((card) => card.addEventListener("click", async () => {
      el.querySelectorAll("[data-opt]").forEach((c) => c.classList.remove("selected"));
      card.classList.add("selected");
      const chosen = Number(card.dataset.opt);
      const correct = chosen === m.quizCorrectIndex;
      el.querySelector("#qFeedback").innerHTML = `<div class="card card-soft" style="margin-top:14px;border-color:${correct?'var(--accent-3)':'var(--danger)'}">
        <div style="font-weight:700;font-size:13px;color:${correct?'var(--accent-3)':'var(--danger)'};margin-bottom:4px;">${correct?'Correct':'Not quite'}</div>
        <div class="sub" style="margin-bottom:0;">${m.quizExplain}</div></div>`;
      next.removeAttribute("disabled");
      try { await submitQuizAnswer(m.id, chosen); } catch (e) { console.error(e); }
    }));
    next.addEventListener("click", () => go("today-reflection"));
  },
};

SCREENS["today-reflection"] = {
  back: true,
  render() {
    return `${topbar("Apply this to you", { back: true })}
    <div class="eyebrow">Make it personal</div>
    <div class="h1">What are you currently struggling with related to this?</div>
    <p class="sub">Be honest — the more specific, the better your experiment will be.</p>
    <textarea id="reflectInput" rows="4" placeholder="e.g. I keep postponing my presentation prep">${STATE.ui.reflectInput}</textarea>
    <button class="btn" style="margin-top:18px;" id="reflectNext" ${STATE.ui.reflectInput.trim().length<4?'disabled':''}>Show me my pattern</button>`;
  },
  after(el) {
    const ta = el.querySelector("#reflectInput");
    const btn = el.querySelector("#reflectNext");
    ta.addEventListener("input", () => { STATE.ui.reflectInput = ta.value; btn.toggleAttribute("disabled", ta.value.trim().length<4); });
    btn.addEventListener("click", () => withLoading(btn, async () => {
      const m = STATE.todayMission;
      const result = await diagnoseReflection({ missionId: m.id, reflectionText: STATE.ui.reflectInput });
      STATE.todayMission = { ...m, reflection: STATE.ui.reflectInput, pattern: result.pattern, experiment: { ...result.experiment, days: new Array(result.experiment.durationDays).fill(false) }, status: "reflected" };
      go("today-personal-example");
    }));
  },
};

SCREENS["today-personal-example"] = {
  back: true,
  render() {
    const m = STATE.todayMission;
    if (!m?.pattern) return loadingSpinner();
    return `${topbar("Your pattern", { back: true })}
    <div class="eyebrow">AI diagnosis</div>
    <div class="h1">Your Pattern</div>
    <div class="card card-soft">
      <div class="card-row" style="margin-bottom:10px;"><span style="color:var(--text-faint);font-size:12px;">TRIGGER</span><span style="font-size:13px;font-weight:700;">${m.pattern.trigger}</span></div>
      <div class="card-row" style="margin-bottom:10px;"><span style="color:var(--text-faint);font-size:12px;">BEHAVIOR</span><span style="font-size:13px;font-weight:700;">${m.pattern.behavior}</span></div>
      <div class="card-row"><span style="color:var(--text-faint);font-size:12px;">UNDERLYING ISSUE</span><span style="font-size:13px;font-weight:700;">${m.pattern.underlyingIssue}</span></div>
    </div>
    <div class="quote-block">"${m.reflection}" — logged just now</div>
    <div class="field-label">Based on ideas you've learned</div>
    <div class="chip-row">${(m.pattern.relatedBooks||[]).map((b) => `<span class="chip">📕 ${b}</span>`).join("")}</div>
    <button class="btn" style="margin-top:16px;" data-go="today-experiment">See my experiment</button>`;
  },
};

SCREENS["today-experiment"] = {
  back: true,
  render() {
    const m = STATE.todayMission;
    if (!m?.experiment) return loadingSpinner();
    return `${topbar("Your experiment", { back: true })}
    <div class="eyebrow">Behavior experiment</div>
    <div class="h1">${m.experiment.timeOfDay}</div>
    <div class="card"><div style="font-weight:700;font-size:15px;margin-bottom:8px;">${m.experiment.title}</div><div class="sub" style="margin-bottom:0;">${m.experiment.description} · ${m.experiment.durationDays}-day experiment</div></div>
    <p class="sub">We'll track whether it happens, and adapt if it doesn't.</p>
    <button class="btn success" data-go="today-experiment-active">Start Experiment</button>`;
  },
};

SCREENS["today-experiment-active"] = {
  back: true,
  render() {
    const m = STATE.todayMission;
    if (!m?.experiment) return loadingSpinner();
    const days = m.experiment.days || [];
    const nextIdx = days.findIndex((d) => !d);
    return `${topbar("Experiment tracker", { back: true })}
    <div class="eyebrow">Day ${Math.min(nextIdx<0?days.length:nextIdx+1, days.length)} of ${days.length}</div>
    <div class="h1">${m.experiment.title}</div>
    <div class="day-track">${days.map((d, i) => d ? `<div class="day-dot done">✓</div>` : (i===nextIdx ? `<div class="day-dot today" data-todaydot>${i+1}</div>` : `<div class="day-dot">${i+1}</div>`)).join("")}</div>
    ${m.experiment.adaptedStrategy ? `<div class="card card-soft"><div style="font-weight:700;font-size:13px;margin-bottom:6px;">Adapted strategy</div><div class="sub" style="margin-bottom:0;">${m.experiment.adaptedStrategy}</div></div>` : ""}
    <div class="card card-soft">
      <div class="card-row"><span style="font-size:13.5px;">Did you complete today's step?</span>
        <button class="btn small success" id="markDone" ${nextIdx<0?'disabled':''}>${nextIdx<0?'All done ✓':'Mark done'}</button></div>
    </div>
    <div class="card card-soft" style="margin-top:8px;">
      <div class="sub" style="margin-bottom:8px;">Missed a day? Tell us what happened and we'll adapt the plan.</div>
      <div class="chip-row">${['I came home late','I forgot','It felt pointless','Something urgent came up'].map((o) => `<button class="chip" data-reason="${o}">${o}</button>`).join("")}</div>
    </div>
    <button class="btn" style="margin-top:10px;" id="finishBtn">Finish experiment</button>`;
  },
  after(el) {
    const m = STATE.todayMission;
    const days = m.experiment.days || [];
    const nextIdx = days.findIndex((d) => !d);
    const markBtn = el.querySelector("#markDone");
    if (markBtn) markBtn.addEventListener("click", () => withLoading(markBtn, async () => {
      const res = await markExperimentDayFn({ missionId: m.id, dayIndex: nextIdx, done: true });
      STATE.todayMission = { ...m, experiment: { ...m.experiment, days: res.days } };
      refresh();
    }));
    el.querySelectorAll("[data-reason]").forEach((c) => c.addEventListener("click", () => withLoading(c, async () => {
      const res = await adaptExperiment({ missionId: m.id, missedReason: c.dataset.reason });
      STATE.todayMission = { ...m, experiment: { ...m.experiment, adaptedStrategy: res.adaptedStrategy } };
      refresh();
    })));
    el.querySelector("#finishBtn").addEventListener("click", () => withLoading(el.querySelector("#finishBtn"), async () => {
      const res = await completeMission({ missionId: m.id });
      STATE.todayMission = { ...m, status: "complete" };
      STATE.profile = { ...STATE.profile, streak: res.streak, growthScore: res.growthScore };
      go("today-complete");
    }));
  },
};

SCREENS["today-complete"] = {
  render() {
    const p = STATE.profile || {};
    return `<div class="center-col" style="padding-top:50px;">
      <div style="font-size:52px;margin-bottom:10px;">🌱</div>
      <div class="h1">Mission complete</div>
      <p class="sub">Your Playbook has been updated with what this taught us about you.</p>
      <div class="stat-grid" style="width:100%;">
        <div class="stat-box"><div class="stat-num">${p.growthScore ?? 50}</div><div class="stat-lbl">Growth Score</div></div>
        <div class="stat-box"><div class="stat-num">${p.streak ?? 0}🔥</div><div class="stat-lbl">Day streak</div></div>
      </div>
      <button class="btn" style="width:100%;margin-top:18px;" data-go="today" data-root="1">Back to Today</button>
    </div>`;
  },
};

/* ================= EXPLORE ================= */

SCREENS["explore"] = {
  tab: "explore",
  render() {
    if (!STATE.books.length) return `<div class="h2">Explore</div><div class="empty-state">Loading books…</div>`;
    return `<div class="h2">Explore</div><p class="sub">Books and ideas, matched to what you're working on.</p>
    ${STATE.books.map((b) => `<div class="list-item" data-go="book-detail" data-book="${b.id}">${bookCover(b)}
      <div style="flex:1;"><div style="font-weight:700;font-size:14px;">${b.title}</div><div class="sub" style="margin:2px 0 6px;">${b.author}</div><span class="tag">${b.tag}</span></div>
      <span style="color:var(--text-faint);">›</span></div>`).join("")}`;
  },
  after(el) {
    el.querySelectorAll("[data-book]").forEach((c) => c.addEventListener("click", () => {
      STATE.currentBook = STATE.books.find((b) => b.id === c.dataset.book);
    }));
  },
};

SCREENS["book-detail"] = {
  back: true,
  render() {
    const b = STATE.currentBook;
    if (!b) return loadingSpinner();
    const challenge = STATE.profile?.onboarding?.challenge || "what you're working on";
    return `${topbar("Book", { back: true })}
    <div style="display:flex;gap:14px;align-items:center;margin-bottom:14px;">${bookCover(b, 64, 86)}
      <div><div style="font-weight:800;font-size:17px;">${b.title}</div><div class="sub" style="margin:2px 0 0;">${b.author}</div></div></div>
    <div class="card" style="border-color:#3a2c66;background:linear-gradient(160deg,#241a3d,#171b24);">
      <div class="eyebrow">Why this is relevant to you</div>
      <div style="font-size:13.5px;line-height:1.55;">Connects directly to "${challenge}" — one of the ideas Apex Surge is building your journey around.</div>
    </div>
    <div class="field-label">Key idea</div><p class="sub">${b.keyIdea}</p>
    <div class="field-label">Example</div><p class="sub">${b.example}</p>
    <div class="btn-stack"><button class="btn" data-go="book-apply">Apply this to my life</button></div>`;
  },
};

SCREENS["book-apply"] = {
  back: true,
  render() {
    return `${topbar("Apply this", { back: true })}
    <div class="eyebrow">Make it real</div>
    <div class="h1">Where would you like to apply it?</div>
    <div class="chip-row">${AREAS.map((a) => `<button class="chip ${STATE.ui.bookApply.area===a.id?'selected':''}" data-applyarea="${a.id}">${a.ico} ${a.label}</button>`).join("")}</div>
    <div class="field-label">What behavior are you trying to change?</div>
    <textarea id="applyBehavior" rows="3" placeholder="e.g. Checking Slack constantly">${STATE.ui.bookApply.behavior}</textarea>
    <button class="btn" style="margin-top:16px;" id="applyNext" ${!STATE.ui.bookApply.area||STATE.ui.bookApply.behavior.trim().length<3?'disabled':''}>Build my experiment</button>`;
  },
  after(el) {
    const btn = el.querySelector("#applyNext");
    const ta = el.querySelector("#applyBehavior");
    const sync = () => btn.toggleAttribute("disabled", !STATE.ui.bookApply.area || ta.value.trim().length < 3);
    el.querySelectorAll("[data-applyarea]").forEach((c) => c.addEventListener("click", () => {
      STATE.ui.bookApply.area = c.dataset.applyarea;
      el.querySelectorAll("[data-applyarea]").forEach((x) => x.classList.remove("selected"));
      c.classList.add("selected"); sync();
    }));
    ta.addEventListener("input", () => { STATE.ui.bookApply.behavior = ta.value; sync(); });
    btn.addEventListener("click", () => withLoading(btn, async () => {
      const b = STATE.currentBook;
      const result = await applyBookToLife({ bookTitle: b.title, bookAuthor: b.author, keyIdea: b.keyIdea, area: STATE.ui.bookApply.area, behavior: STATE.ui.bookApply.behavior });
      STATE.ui.lastAppliedExperiment = result;
      STATE.experiments = await fetchExperiments();
      go("book-apply-saved");
    }));
  },
};

SCREENS["book-apply-saved"] = {
  render() {
    const r = STATE.ui.lastAppliedExperiment;
    return `<div class="center-col" style="padding-top:40px;">
      <div style="font-size:48px;margin-bottom:10px;">✅</div>
      <div class="h1">Saved to your Playbook</div>
      ${r ? `<div class="card" style="width:100%;text-align:left;"><div style="font-weight:700;font-size:14px;margin-bottom:6px;">${r.title}</div><div class="sub" style="margin-bottom:0;">${r.description} · ${r.durationDays} days</div></div>` : ""}
      <p class="sub">This experiment now lives in your Playbook and will check in with you daily.</p>
      <div class="btn-stack" style="width:100%;">
        <button class="btn" data-go="playbook" data-root="1">Go to Playbook</button>
        <button class="btn secondary" data-go="explore" data-root="1">Keep exploring</button>
      </div>
    </div>`;
  },
};

/* ================= MY GROWTH ================= */

const MAX_ACTIVE_JOURNEYS = 3;

SCREENS["growth-list"] = {
  tab: "growth-list",
  render() {
    const active = STATE.journeys.filter((j) => j.status === "active");
    const atCap = active.length >= MAX_ACTIVE_JOURNEYS;
    return `<div class="card-row" style="margin-bottom:2px;"><div class="h2" style="margin-bottom:0;">My Growth</div><span class="pill-score">${active.length}/${MAX_ACTIVE_JOURNEYS} active</span></div>
    <p class="sub">Your active transformation journeys.</p>
    ${active.length ? active.map((j) => `
      <div class="card" data-go="growth-detail" data-journey="${j.id}" style="border-color:#3a2c66;background:linear-gradient(160deg,#241a3d,#171b24);">
        <div class="card-row" style="margin-bottom:10px;"><div><span class="tag">Active</span><div style="font-weight:800;font-size:16px;margin-top:6px;">${j.goalTitle}</div></div>
        <div class="ring-wrap" style="width:56px;height:56px;">${ring(j.progressPct,56,7)}<div class="ring-center"><div style="font-size:13px;font-weight:800;">${j.progressPct}%</div></div></div></div>
        <div class="sub" style="margin-bottom:0;">Week ${j.currentWeek} of ${j.weeks.length}</div>
      </div>`).join("") : `<div class="empty-state">No active journeys yet — start one below.</div>`}
    <div class="field-label">Start something new</div>
    ${atCap ? `<div class="card card-soft"><div class="sub" style="margin-bottom:0;">You've reached the limit of ${MAX_ACTIVE_JOURNEYS} active journeys. Complete one above to start another — finished journeys move to your Playbook.</div></div>` : `
    <div class="list-item" data-go="growth-new" data-goal="custom">
      <div class="avatar-ring">✏️</div><div style="flex:1;"><div style="font-weight:700;font-size:14px;">Start a custom journey</div><div class="sub" style="margin:2px 0 0;">Tell us what you want to work on</div></div>
      <span style="color:var(--text-faint);">›</span></div>
    ${GROWTH_GOALS.map((g) => `<div class="list-item" data-go="growth-new" data-goal="${g.id}">
      <div class="avatar-ring">${g.ico}</div><div style="flex:1;"><div style="font-weight:700;font-size:14px;">${g.title}</div><div class="sub" style="margin:2px 0 0;">${g.dsc}</div></div>
      <span style="color:var(--text-faint);">›</span></div>`).join("")}`}`;
  },
  after(el) {
    el.querySelectorAll("[data-journey]").forEach((c) => c.addEventListener("click", () => { STATE.activeJourney = STATE.journeys.find((j) => j.id === Number(c.dataset.journey)); }));
    el.querySelectorAll("[data-goal]").forEach((c) => c.addEventListener("click", () => {
      STATE.ui.selectedGoal = c.dataset.goal === "custom" ? null : GROWTH_GOALS.find((g) => g.id === c.dataset.goal);
      STATE.ui.assessment = null;
    }));
  },
};

SCREENS["growth-new"] = {
  back: true,
  render() {
    const goal = STATE.ui.selectedGoal;
    STATE.ui.customGoal = STATE.ui.customGoal || { title: goal?.title || "", dsc: goal?.dsc || "" };
    STATE.ui.assessment = STATE.ui.assessment || [
      { id: "a1", label: "Where you are today (1)", v: 5 }, { id: "a2", label: "Where you are today (2)", v: 5 },
      { id: "a3", label: "Where you are today (3)", v: 5 }, { id: "a4", label: "Where you are today (4)", v: 5 },
    ];
    return `${topbar("New Journey", { back: true })}
    <div class="eyebrow">Step 1 of 2</div>
    <div class="h1">${goal ? goal.title : "What do you want to work on?"}</div>
    ${!goal ? `
    <p class="sub">Name the topic — we'll build a whole roadmap around it.</p>
    <input type="text" id="customTitle" placeholder="e.g. Becoming a better public speaker" value="${STATE.ui.customGoal.title}" />
    <div class="field-label">What does success look like?</div>
    <textarea id="customDsc" rows="2" placeholder="Briefly describe what you're hoping changes">${STATE.ui.customGoal.dsc}</textarea>
    ` : ""}
    <p class="sub" style="margin-top:16px;">Rate yourself honestly — this is your baseline so we can measure real change.</p>
    ${STATE.ui.assessment.map((a) => `<div class="slider-row"><div class="slider-top"><span>${a.label}</span><b data-val="${a.id}">${a.v}</b>/10</div><input type="range" min="1" max="10" value="${a.v}" data-slider="${a.id}" /></div>`).join("")}
    <button class="btn" style="margin-top:8px;" id="roadmapBtn" ${!goal && !STATE.ui.customGoal.title.trim() ? "disabled" : ""}>See my roadmap</button>`;
  },
  after(el) {
    const titleInput = el.querySelector("#customTitle");
    const dscInput = el.querySelector("#customDsc");
    const btn = el.querySelector("#roadmapBtn");
    if (titleInput) titleInput.addEventListener("input", () => {
      STATE.ui.customGoal.title = titleInput.value;
      btn.toggleAttribute("disabled", !titleInput.value.trim());
    });
    if (dscInput) dscInput.addEventListener("input", () => { STATE.ui.customGoal.dsc = dscInput.value; });
    el.querySelectorAll("[data-slider]").forEach((s) => s.addEventListener("input", () => {
      el.querySelector(`[data-val="${s.dataset.slider}"]`).textContent = s.value;
      const a = STATE.ui.assessment.find((x) => x.id === s.dataset.slider);
      if (a) a.v = Number(s.value);
    }));
    btn.addEventListener("click", () => withLoading(btn, async () => {
      const goal = STATE.ui.selectedGoal || { title: STATE.ui.customGoal.title, dsc: STATE.ui.customGoal.dsc || STATE.ui.customGoal.title, weeks: 6 };
      try {
        const result = await generateRoadmap({ goalTitle: goal.title, goalDescription: goal.dsc, weeks: goal.weeks, assessment: STATE.ui.assessment });
        STATE.ui.generatedRoadmap = result;
        STATE.ui.roadmapGoalTitle = goal.title;
        STATE.ui.customGoal = null;
        STATE.journeys = await fetchJourneys();
        go("growth-roadmap");
      } catch (e) {
        if (e?.status === 409) alert(e.message);
        else throw e;
      }
    }));
  },
};

SCREENS["growth-roadmap"] = {
  back: true,
  render() {
    const r = STATE.ui.generatedRoadmap;
    if (!r) return loadingSpinner();
    return `${topbar("Your Roadmap", { back: true })}
    <div class="eyebrow">Step 2 of 2 · AI generated</div>
    <div class="h1">${STATE.ui.roadmapGoalTitle || "Your journey"}</div>
    <p class="sub">Drawing from: ${(r.bookRefs||[]).join(", ")}</p>
    ${r.weeks.map((w) => `<div class="card card-soft" style="margin-bottom:8px;"><div class="card-row"><div><span class="tag">Week ${w.week}</span><div style="font-weight:700;font-size:13.5px;margin-top:6px;">${w.theme}</div><div class="sub" style="margin:2px 0 0;">${w.focus}</div></div></div></div>`).join("")}
    <button class="btn" style="margin-top:6px;" data-go="growth-list" data-root="1">Start this journey</button>`;
  },
};

SCREENS["growth-detail"] = {
  back: true,
  render() {
    const j = STATE.activeJourney;
    if (!j) return loadingSpinner();
    return `${topbar(j.goalTitle, { back: true })}
    <div class="center-col" style="margin-bottom:6px;"><div class="ring-wrap">${ring(j.progressPct)}<div class="ring-center"><div class="ring-val">${j.progressPct}%</div><div class="ring-lbl">Week ${j.currentWeek} of ${j.weeks.length}</div></div></div></div>
    <div class="field-label">Focus areas</div>
    <div class="chip-row">${(j.focusAreas||[]).map((f) => `<span class="chip selected">${f}</span>`).join("")}</div>
    <div class="card" style="background:linear-gradient(160deg,#241a3d,#171b24);border-color:#3a2c66;" id="journeyTaskCard">
      <div class="eyebrow">This week's focus</div>
      <div style="font-weight:800;font-size:15px;margin-bottom:8px;">${j.weeks[j.currentWeek-1]?.theme}</div>
      <div class="sub" style="margin-bottom:12px;">${j.weeks[j.currentWeek-1]?.focus}</div>
      <button class="btn" id="genTaskBtn">Generate today's task</button>
      <div id="taskResult"></div>
    </div>
    <div class="field-label">Roadmap</div>
    <div class="card card-soft">${j.weeks.map((w) => `<div class="card-row" style="margin-bottom:6px;"><span style="font-size:12.5px;">Week ${w.week}: ${w.theme}</span><span>${w.done?'✅':(w.week===j.currentWeek?'▶':'')}</span></div>`).join("")}</div>
    <button class="btn secondary" id="advanceBtn" style="margin-top:8px;">Complete this week & advance</button>`;
  },
  after(el) {
    const j = STATE.activeJourney;
    el.querySelector("#genTaskBtn").addEventListener("click", () => withLoading(el.querySelector("#genTaskBtn"), async () => {
      const task = await generateJourneyTask({ journeyId: j.id });
      el.querySelector("#taskResult").innerHTML = `<div class="card card-soft" style="margin-top:10px;"><div style="font-weight:700;font-size:13.5px;margin-bottom:4px;">${task.title}</div><div class="sub" style="margin-bottom:0;">${task.durationMin} min · Based on ${(task.bookRefs||[]).join(", ")}</div></div>`;
    }));
    el.querySelector("#advanceBtn").addEventListener("click", () => withLoading(el.querySelector("#advanceBtn"), async () => {
      const res = await advanceJourneyWeek({ journeyId: j.id });
      STATE.journeys = await fetchJourneys();
      STATE.activeJourney = STATE.journeys.find((x) => x.id === j.id) || null;
      if (res.status === "complete") go("growth-complete");
      else refresh();
    }));
  },
};

SCREENS["growth-complete"] = {
  render() {
    const j = STATE.activeJourney;
    return `<div class="center-col" style="padding-top:24px;">
      <div style="font-size:52px;margin-bottom:8px;">🏆</div>
      <div class="h1">Journey complete</div>
      <p class="sub">${j?.goalTitle || ""} is now saved in your Playbook. Start another whenever you're ready.</p>
      <button class="btn" style="width:100%;margin-top:16px;" id="toPlaybookBtn">View my Playbook</button>
      <button class="btn secondary" style="width:100%;margin-top:10px;" data-go="growth-list" data-root="1">Start a new journey</button>
    </div>`;
  },
  after(el) {
    el.querySelector("#toPlaybookBtn").addEventListener("click", () => {
      STATE.ui.playbookTab = "journeys";
      go("playbook", { root: true });
    });
  },
};

/* ================= AI COACH + ROLEPLAY ================= */

SCREENS["coach-chat"] = {
  tab: "coach-chat",
  render() {
    const started = STATE.coachMessages.length > 0;
    return `<div class="h2">AI Coach</div><p class="sub">Grounded in what you've actually learned — not a generic chatbot.</p>
    <div id="chatLog">${!started ? `<div class="msg system">Try one of these, or type your own</div>` : STATE.coachMessages.map((m) => `<div class="msg ${m.role==='user'?'user':'ai'}">${m.text}</div>`).join("")}</div>
    ${!started ? `<div class="chip-row">${["I'm afraid to ask my manager for a promotion.","I keep procrastinating on my presentation.","I feel overwhelmed by everything on my plate."].map((o) => `<button class="chip" data-opener="${o}">${o}</button>`).join("")}</div>` : ""}
    <div style="display:flex;gap:8px;margin-top:14px;position:sticky;bottom:0;"><input type="text" id="chatInput" placeholder="Type what's on your mind..." /><button class="btn small" id="chatSend" style="width:auto;">→</button></div>`;
  },
  after(el) {
    const log = el.querySelector("#chatLog");
    const input = el.querySelector("#chatInput");
    function scrollDown() { el.closest(".screens").scrollTop = el.closest(".screens").scrollHeight; }
    async function userSend(text) {
      if (!text.trim()) return;
      STATE.coachMessages.push({ role: "user", text });
      log.insertAdjacentHTML("beforeend", `<div class="msg user">${text}</div>`);
      log.insertAdjacentHTML("beforeend", `<div class="msg ai thinking" id="thinkingBubble"><span></span><span></span><span></span></div>`);
      scrollDown();
      try {
        const res = await coachReply({ threadId: STATE.coachThreadId, message: text });
        STATE.coachThreadId = res.threadId;
        STATE.coachMessages.push({ role: "assistant", text: res.reply });
        el.querySelector("#thinkingBubble")?.remove();
        log.insertAdjacentHTML("beforeend", `<div class="msg ai">${res.reply}</div>`);
        log.insertAdjacentHTML("beforeend", `<div style="margin-top:10px;"><button class="btn small" data-go="coach-roleplay-offer">Practice this with me →</button></div>`);
        scrollDown();
      } catch (e) {
        console.error(e);
        el.querySelector("#thinkingBubble")?.remove();
        log.insertAdjacentHTML("beforeend", `<div class="msg ai">Sorry, something went wrong reaching Claude. Try again?</div>`);
      }
    }
    el.querySelectorAll("[data-opener]").forEach((c) => c.addEventListener("click", () => userSend(c.dataset.opener)));
    el.querySelector("#chatSend").addEventListener("click", () => { userSend(input.value); input.value = ""; });
    input.addEventListener("keydown", (e) => { if (e.key === "Enter") { userSend(input.value); input.value = ""; } });
  },
};

SCREENS["coach-roleplay-offer"] = {
  back: true,
  render() {
    return `${topbar("Practice mode", { back: true })}
    <div class="eyebrow">Roleplay</div><div class="h1">Want to practice the conversation?</div>
    <p class="sub">Choose who you'd like to practice with. Claude will play the role and score your response.</p>
    ${ROLEPLAY_SCENARIOS.map((s) => `<div class="select-card" data-scenario="${s.id}"><div class="ico">${s.ico}</div><div class="txt"><div class="ttl">${s.label}</div><div class="dsc">${s.dsc}</div></div><div class="check-circle">✓</div></div>`).join("")}
    <button class="btn" id="rpStart" disabled>Start roleplay</button>`;
  },
  after(el) {
    const btn = el.querySelector("#rpStart");
    el.querySelectorAll("[data-scenario]").forEach((c) => c.addEventListener("click", () => {
      el.querySelectorAll("[data-scenario]").forEach((x) => x.classList.remove("selected"));
      c.classList.add("selected");
      STATE.roleplayScenario = c.dataset.scenario;
      btn.removeAttribute("disabled");
    }));
    btn.addEventListener("click", () => { STATE.roleplayId = null; STATE.roleplayTranscript = []; go("roleplay-chat"); });
  },
};

SCREENS["roleplay-chat"] = {
  back: true,
  render() {
    const scenario = ROLEPLAY_SCENARIOS.find((s) => s.id === STATE.roleplayScenario) || ROLEPLAY_SCENARIOS[0];
    return `${topbar("Roleplay · " + scenario.label, { back: true })}
    <div class="msg system">You are speaking with ${scenario.label.toLowerCase()}. Say your opening line.</div>
    <div id="rpLog">${STATE.roleplayTranscript.map((t) => `<div class="msg ${t.role==='user'?'user':'ai'}">${t.text}</div>`).join("")}</div>
    <div style="display:flex;gap:8px;margin-top:14px;"><input type="text" id="rpInput" placeholder="Type your response..." /><button class="btn small" id="rpSend" style="width:auto;">→</button></div>
    ${STATE.roleplayTranscript.length >= 4 ? `<button class="btn secondary" style="margin-top:10px;" data-go="roleplay-feedback">See my feedback →</button>` : ""}`;
  },
  after(el) {
    const log = el.querySelector("#rpLog");
    const input = el.querySelector("#rpInput");
    function scrollDown() { el.closest(".screens").scrollTop = el.closest(".screens").scrollHeight; }
    async function send() {
      const text = input.value.trim();
      if (!text) return;
      input.value = "";
      STATE.roleplayTranscript.push({ role: "user", text });
      log.insertAdjacentHTML("beforeend", `<div class="msg user">${text}</div>`);
      log.insertAdjacentHTML("beforeend", `<div class="msg ai thinking" id="rpThinking"><span></span><span></span><span></span></div>`);
      scrollDown();
      try {
        const res = await roleplayReply({ roleplayId: STATE.roleplayId, scenario: STATE.roleplayScenario, message: text });
        STATE.roleplayId = res.roleplayId;
        STATE.roleplayTranscript.push({ role: "assistant", text: res.reply });
        el.querySelector("#rpThinking")?.remove();
        log.insertAdjacentHTML("beforeend", `<div class="msg ai">${res.reply}</div>`);
        scrollDown();
        refresh();
      } catch (e) {
        console.error(e);
        el.querySelector("#rpThinking")?.remove();
      }
    }
    el.querySelector("#rpSend").addEventListener("click", send);
    input.addEventListener("keydown", (e) => { if (e.key === "Enter") send(); });
  },
};

SCREENS["roleplay-feedback"] = {
  back: true,
  render() {
    return `${topbar("Your performance", { back: true })}
    <div class="eyebrow">Roleplay feedback</div><div class="h1" id="fbTitle">Scoring your conversation…</div>
    <div id="fbBody">${loadingSpinner()}</div>`;
  },
  after(el) {
    (async () => {
      try {
        const fb = await roleplayFeedback({ roleplayId: STATE.roleplayId });
        el.querySelector("#fbTitle").textContent = "Nice work — here's the breakdown";
        el.querySelector("#fbBody").innerHTML = `
          <div class="card card-soft">${[["Clarity",fb.clarity],["Confidence",fb.confidence],["Evidence",fb.evidence],["Assertiveness",fb.assertiveness]].map(([k,v]) => `
            <div class="slider-row" style="margin-bottom:12px;"><div class="slider-top"><span>${k}</span><b>${v}/10</b></div><div class="progressbar"><div style="width:${v*10}%"></div></div></div>`).join("")}</div>
          <div class="card"><div style="font-weight:700;font-size:13.5px;margin-bottom:6px;">Where to improve</div><div class="sub" style="margin-bottom:0;">${fb.note}</div></div>
          <div class="btn-stack"><button class="btn" data-go="roleplay-chat">Try again</button><button class="btn secondary" data-go="coach-chat" data-root="1">Back to Coach</button></div>`;
      } catch (e) {
        console.error(e);
        el.querySelector("#fbBody").innerHTML = errorHtml("Couldn't score this roleplay. Try again from the coach.");
      }
    })();
  },
};

/* ================= PLAYBOOK ================= */

SCREENS["playbook"] = {
  tab: "playbook",
  render() {
    const tab = STATE.ui.playbookTab || "principles";
    const tabs = [["principles","Principles"],["insights","Insights"],["experiments","Experiments"],["works","What works"],["journeys","Journeys"]];
    let body = "";
    if (tab === "principles") {
      body = STATE.playbookPrinciples.length
        ? STATE.playbookPrinciples.map((p) => `<div class="card card-soft">${p.text}</div>`).join("")
        : `<div class="empty-state">No principles yet.</div>`;
      body += `<div style="display:flex;gap:8px;margin-top:8px;"><input type="text" id="newPrinciple" placeholder="Add a principle you believe in..." /><button class="btn small" id="addPrinciple" style="width:auto;">Add</button></div>`;
    } else if (tab === "insights") {
      body = STATE.playbookInsights.length
        ? STATE.playbookInsights.map((i) => `<div class="card card-soft"><span class="tag">${i.book||''}</span><div style="margin-top:8px;font-size:13.5px;">${i.text}</div></div>`).join("")
        : `<div class="empty-state">Complete missions to build insights about yourself.</div>`;
    } else if (tab === "experiments") {
      body = STATE.experiments.length ? STATE.experiments.map((e) => {
        const streak = (e.days||[]).filter(Boolean).length;
        return `<div class="card card-soft" data-exp="${e.id}">
          <div class="card-row"><span style="font-size:13.5px;font-weight:600;flex:1;">${e.title}</span><span class="tag ${e.status==='adopted'?'green':'gold'}">${e.status}</span></div>
          <div class="day-track" style="margin:10px 0 4px;">${(e.days||[]).map((d,i)=>`<div class="day-dot ${d?'done':''}" data-daytoggle="${i}">${d?'✓':i+1}</div>`).join("")}</div>
          <div class="sub" style="margin:4px 0 0;">${streak}/${(e.days||[]).length} days done</div></div>`;
      }).join("") : `<div class="empty-state">No standalone experiments yet — apply a book idea from Explore.</div>`;
    } else if (tab === "works") {
      body = STATE.worksForMe.length
        ? STATE.worksForMe.map((w) => `<div class="card card-soft">✓ ${w.text}</div>`).join("")
        : `<div class="empty-state">Nothing recorded yet.</div>`;
      body += `<div style="display:flex;gap:8px;margin-top:8px;"><input type="text" id="newWorks" placeholder="What's working for you?..." /><button class="btn small" id="addWorks" style="width:auto;">Add</button></div>`;
    } else {
      const completed = STATE.journeys.filter((j) => j.status === "complete");
      const active = STATE.journeys.filter((j) => j.status === "active");
      body = (completed.length === 0 && active.length === 0) ? `<div class="empty-state">No journeys yet — start one from My Growth.</div>` : `
        ${completed.length ? `<div class="field-label" style="margin-top:0;">Completed</div>${completed.map((j) => `
          <div class="card card-soft"><div class="card-row"><span style="font-weight:700;font-size:13.5px;">${j.goalTitle}</span><span class="tag green">✓ Completed</span></div>
          <div class="sub" style="margin:6px 0 0;">${j.weeks.length} weeks · ${(j.bookRefs||[]).join(", ")}</div></div>`).join("")}` : ""}
        ${active.length ? `<div class="field-label">In progress</div>${active.map((j) => `
          <div class="card card-soft" data-go="growth-detail" data-journey="${j.id}"><div class="card-row"><span style="font-weight:700;font-size:13.5px;">${j.goalTitle}</span><span class="tag gold">Week ${j.currentWeek}/${j.weeks.length}</span></div>
          <div class="progressbar" style="margin-top:8px;"><div style="width:${j.progressPct}%"></div></div></div>`).join("")}` : ""}`;
    }
    return `<div class="card-row" style="margin-bottom:2px;"><div class="h2" style="margin-bottom:0;">My Playbook</div>
      <button class="btn ghost small" id="signOutLink" style="width:auto;">Sign out</button></div>
    <p class="sub">Signed in as ${STATE.profile?.email || ""} · Everything Apex Surge has learned about you.</p>
    <div class="playbook-tabs">${tabs.map(([id,label]) => `<button class="pb-tab ${tab===id?'active':''}" data-pbtab="${id}">${label}</button>`).join("")}</div>
    <div id="pbBody">${body}</div>`;
  },
  after(el) {
    el.querySelector("#signOutLink").addEventListener("click", () => { if (confirm("Sign out?")) signOutUser(); });
    el.querySelectorAll("[data-pbtab]").forEach((t) => t.addEventListener("click", () => { STATE.ui.playbookTab = t.dataset.pbtab; refresh(); }));
    const addP = el.querySelector("#addPrinciple");
    if (addP) addP.addEventListener("click", () => withLoading(addP, async () => {
      const input = el.querySelector("#newPrinciple");
      if (!input.value.trim()) return;
      await addPrinciple(input.value.trim());
      input.value = "";
      STATE.playbookPrinciples = await fetchPrinciples();
      refresh();
    }));
    const addW = el.querySelector("#addWorks");
    if (addW) addW.addEventListener("click", () => withLoading(addW, async () => {
      const input = el.querySelector("#newWorks");
      if (!input.value.trim()) return;
      await addWorksForMe(input.value.trim());
      input.value = "";
      STATE.worksForMe = await fetchWorksForMe();
      refresh();
    }));
    el.querySelectorAll("[data-daytoggle]").forEach((d) => d.addEventListener("click", async () => {
      const card = d.closest("[data-exp]");
      const exp = STATE.experiments.find((e) => e.id === Number(card.dataset.exp));
      if (!exp) return;
      exp.days = await toggleExperimentDay(exp.id, Number(d.dataset.daytoggle));
      refresh();
    }));
    el.querySelectorAll("[data-journey]").forEach((c) => c.addEventListener("click", () => {
      STATE.activeJourney = STATE.journeys.find((j) => j.id === Number(c.dataset.journey));
    }));
  },
};

/* ================= WEEKLY REVIEW ================= */

SCREENS["weekly-intro"] = {
  back: true,
  render() {
    return `${topbar("Weekly Review", { back: true })}
    <div class="center-col"><div style="font-size:44px;margin-bottom:10px;">📝</div><div class="h1">Your week in review</div>
    <p class="sub">Five quick questions. This is how Apex Surge adapts next week's plan to you.</p></div>
    <button class="btn" data-go="weekly-q1">Start (2 min)</button>`;
  },
};

SCREENS["weekly-q1"] = {
  back: true,
  render() {
    return `${topbar("1 of 3", { back: true })}<div class="h1">What did you learn this week?</div>
    <div class="chip-row">${['Habit design','Delegation','Difficult conversations','Focus','Confidence'].map((o) => `<button class="chip ${STATE.ui.weeklyLearned.includes(o)?'selected':''}" data-wk="${o}">${o}</button>`).join("")}</div>
    <button class="btn" style="margin-top:20px;" data-go="weekly-q2">Continue</button>`;
  },
  after(el) {
    el.querySelectorAll("[data-wk]").forEach((c) => c.addEventListener("click", () => {
      const t = c.dataset.wk, arr = STATE.ui.weeklyLearned, i = arr.indexOf(t);
      if (i > -1) arr.splice(i, 1); else arr.push(t);
      c.classList.toggle("selected");
    }));
  },
};

SCREENS["weekly-q2"] = {
  back: true,
  render() {
    return `${topbar("2 of 3", { back: true })}<div class="h1">What did you actually apply?</div>
    <textarea id="weeklyApplied" rows="4" placeholder="e.g. Tried the Slack check-window experiment">${STATE.ui.weeklyApplied}</textarea>
    <button class="btn" style="margin-top:18px;" id="wq2Next">Continue</button>`;
  },
  after(el) {
    const ta = el.querySelector("#weeklyApplied");
    ta.addEventListener("input", () => { STATE.ui.weeklyApplied = ta.value; });
    el.querySelector("#wq2Next").addEventListener("click", () => go("weekly-q3"));
  },
};

SCREENS["weekly-q3"] = {
  back: true,
  render() {
    return `${topbar("3 of 3", { back: true })}<div class="h1">What didn't work, and why?</div>
    <textarea id="weeklyFailed" rows="4" placeholder="e.g. Missed the evening habit — came home late">${STATE.ui.weeklyFailed}</textarea>
    <button class="btn" style="margin-top:18px;" id="wq3Next">See my patterns</button>`;
  },
  after(el) {
    const ta = el.querySelector("#weeklyFailed");
    ta.addEventListener("input", () => { STATE.ui.weeklyFailed = ta.value; });
    el.querySelector("#wq3Next").addEventListener("click", () => withLoading(el.querySelector("#wq3Next"), async () => {
      const result = await synthesizeWeeklyReview({ learnedTags: STATE.ui.weeklyLearned, applied: STATE.ui.weeklyApplied, failedReason: STATE.ui.weeklyFailed });
      STATE.ui.weeklyResult = result;
      STATE.profile = { ...STATE.profile, growthScore: result.growthScore };
      STATE.ui.weeklyLearned = []; STATE.ui.weeklyApplied = ""; STATE.ui.weeklyFailed = "";
      go("weekly-summary");
    }));
  },
};

SCREENS["weekly-summary"] = {
  render() {
    const r = STATE.ui.weeklyResult;
    if (!r) return loadingSpinner();
    return `<div class="center-col" style="padding-top:6px;"><div class="eyebrow">Pattern detected</div><div class="h1">Here's what we noticed</div></div>
    <div class="card" style="background:linear-gradient(160deg,#241a3d,#171b24);border-color:#3a2c66;"><div style="font-size:13.5px;line-height:1.6;">${r.pattern}</div></div>
    <div class="field-label">Next week's plan</div>
    <div class="card card-soft"><div class="sub" style="margin-bottom:0;">${r.nextWeekPlan}</div></div>
    <button class="btn" style="width:100%;margin-top:14px;" data-go="today" data-root="1">Back to Today</button>`;
  },
};
