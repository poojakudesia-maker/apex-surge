// Apex Surge — client-side session state (Firestore is the source of truth;
// this just caches the latest snapshots for synchronous screen rendering).
export const STATE = {
  user: null, // firebase auth user
  profile: null, // users/{uid} doc
  todayMission: null, // users/{uid}/missions/{today}
  journeys: [],
  activeJourney: null,
  experiments: [],
  books: [],
  currentBook: null,
  playbookInsights: [],
  playbookPrinciples: [],
  worksForMe: [],
  coachThreadId: null,
  coachMessages: [],
  roleplayId: null,
  roleplayScenario: null,
  roleplayTranscript: [],
  ui: {
    onboarding: { why: "", areas: [], challenge: "", time: 10, style: "interactive" },
    bookApply: { area: null, behavior: "" },
    reflectInput: "",
    weeklyLearned: [],
    weeklyApplied: "",
    weeklyFailed: "",
  },
  nav: { current: "loading", stack: [] },
  unsubs: [],
};

export function clearSubs() {
  STATE.unsubs.forEach((u) => {
    try { u(); } catch (e) {}
  });
  STATE.unsubs = [];
}

export function resetSessionState() {
  clearSubs();
  Object.assign(STATE, {
    user: null, profile: null, todayMission: null, journeys: [], activeJourney: null,
    experiments: [], playbookInsights: [], playbookPrinciples: [], worksForMe: [],
    coachThreadId: null, coachMessages: [], roleplayId: null, roleplayScenario: null,
    roleplayTranscript: [],
  });
}
