// Apex Surge — client-side session state (MySQL via the PHP API is the
// source of truth; this just caches the latest fetch for synchronous
// screen rendering).
export const STATE = {
  user: null, // { id, email, displayName }
  profile: null, // same shape as user right now — kept separate for clarity
  todayMission: null,
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
};

export function resetSessionState() {
  Object.assign(STATE, {
    user: null, profile: null, todayMission: null, journeys: [], activeJourney: null,
    experiments: [], playbookInsights: [], playbookPrinciples: [], worksForMe: [],
    coachThreadId: null, coachMessages: [], roleplayId: null, roleplayScenario: null,
    roleplayTranscript: [],
  });
}
