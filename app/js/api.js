// Apex Surge — API client for the PHP + MySQL backend (no Firebase)

async function request(path, opts = {}) {
  const res = await fetch(path, {
    credentials: "include",
    headers: opts.body ? { "Content-Type": "application/json" } : undefined,
    ...opts,
  });
  let data = null;
  try { data = await res.json(); } catch (e) { /* empty body */ }
  if (!res.ok) {
    const err = new Error((data && data.error) || `Request failed (${res.status})`);
    err.status = res.status;
    throw err;
  }
  return data;
}

function post(path, body) {
  return request(path, { method: "POST", body: JSON.stringify(body ?? {}) });
}
function get(path) {
  return request(path, { method: "GET" });
}

// ---- auth ----
export const register = (email, password, displayName) =>
  post("api/auth.php?action=register", { email, password, displayName }).then((r) => r.user);
export const login = (email, password) =>
  post("api/auth.php?action=login", { email, password }).then((r) => r.user);
export const logout = () => post("api/auth.php?action=logout", {});
export const me = () => get("api/auth.php?action=me").then((r) => r.user);

// ---- onboarding / missions ----
export const generateGrowthProfile = (data) => post("api/onboarding.php", data);
export const fetchTodayMission = () => get("api/missions.php?action=today").then((r) => r.mission);
export const generateDailyMission = () => post("api/missions.php?action=generateDaily", {}).then((r) => r.mission);
export const submitQuizAnswer = (missionId, answer) => post("api/missions.php?action=quizAnswer", { missionId, answer });
export const diagnoseReflection = ({ missionId, reflectionText }) =>
  post("api/missions.php?action=diagnose", { missionId, reflectionText });
export const markExperimentDayFn = ({ missionId, dayIndex, done }) =>
  post("api/missions.php?action=markDay", { missionId, dayIndex, done });
export const adaptExperiment = ({ missionId, missedReason }) =>
  post("api/missions.php?action=adapt", { missionId, missedReason });
export const completeMission = ({ missionId }) => post("api/missions.php?action=complete", { missionId });

// ---- explore / books ----
export const fetchBooks = () => get("api/explore.php?action=books").then((r) => r.books);
export const applyBookToLife = (data) => post("api/explore.php?action=applyToLife", data);

// ---- growth journeys ----
export const fetchJourneys = () => get("api/growth.php?action=list").then((r) => r.journeys);
export const generateRoadmap = (data) => post("api/growth.php?action=generateRoadmap", data);
export const generateJourneyTask = ({ journeyId }) => post("api/growth.php?action=generateTask", { journeyId });
export const advanceJourneyWeek = ({ journeyId }) => post("api/growth.php?action=advanceWeek", { journeyId });

// ---- coach + roleplay ----
export const coachReply = ({ threadId, message }) => post("api/coach.php?action=reply", { threadId, message });
export const roleplayReply = ({ roleplayId, scenario, message }) =>
  post("api/roleplay.php?action=reply", { roleplayId, scenario, message });
export const roleplayFeedback = ({ roleplayId }) => post("api/roleplay.php?action=feedback", { roleplayId });

// ---- playbook ----
export const fetchPrinciples = () => get("api/playbook.php?action=principles").then((r) => r.items);
export const addPrinciple = (text) => post("api/playbook.php?action=addPrinciple", { text });
export const fetchInsights = () => get("api/playbook.php?action=insights").then((r) => r.items);
export const fetchWorksForMe = () => get("api/playbook.php?action=works").then((r) => r.items);
export const addWorksForMe = (text) => post("api/playbook.php?action=addWorks", { text });
export const fetchExperiments = () => get("api/playbook.php?action=experiments").then((r) => r.items);
export const toggleExperimentDay = (experimentId, dayIndex) =>
  post("api/playbook.php?action=toggleExperimentDay", { experimentId, dayIndex }).then((r) => r.days);

// ---- weekly review ----
export const synthesizeWeeklyReview = (data) => post("api/weekly.php?action=synthesize", data);

export function todayId() {
  return new Date().toISOString().slice(0, 10);
}
