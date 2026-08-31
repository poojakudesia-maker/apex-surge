// Apex Surge — typed wrappers around Cloud Functions + direct Firestore reads/writes
import {
  db, functions, httpsCallable,
  doc, getDoc, setDoc, updateDoc, onSnapshot,
  collection, addDoc, query, orderBy, limit, where, serverTimestamp,
} from "./firebase.js";

export { db, doc, updateDoc };

function call(name) {
  const fn = httpsCallable(functions, name);
  return (data) => fn(data).then((r) => r.data);
}

export const generateGrowthProfile = call("generateGrowthProfile");
export const generateDailyMission = call("generateDailyMission");
export const diagnoseReflection = call("diagnoseReflection");
export const markExperimentDayFn = call("markExperimentDay");
export const adaptExperiment = call("adaptExperiment");
export const completeMission = call("completeMission");
export const applyBookToLife = call("applyBookToLife");
export const generateRoadmap = call("generateRoadmap");
export const generateJourneyTask = call("generateJourneyTask");
export const advanceJourneyWeek = call("advanceJourneyWeek");
export const coachReply = call("coachReply");
export const roleplayReply = call("roleplayReply");
export const roleplayFeedback = call("roleplayFeedback");
export const synthesizeWeeklyReview = call("synthesizeWeeklyReview");

function todayId() {
  return new Date().toISOString().slice(0, 10);
}
export { todayId };

export function userDocRef(uid) {
  return doc(db, "users", uid);
}

export async function ensureUserDoc(user) {
  const ref = userDocRef(user.uid);
  const snap = await getDoc(ref);
  if (!snap.exists()) {
    await setDoc(ref, {
      displayName: user.displayName || "",
      email: user.email || "",
      photoURL: user.photoURL || "",
      onboardingComplete: false,
      createdAt: serverTimestamp(),
    });
    return { exists: false, data: null };
  }
  return { exists: true, data: snap.data() };
}

export function watchUser(uid, cb) {
  return onSnapshot(userDocRef(uid), (snap) => cb(snap.exists() ? snap.data() : null));
}

export function watchMission(uid, missionId, cb) {
  return onSnapshot(doc(db, "users", uid, "missions", missionId), (snap) =>
    cb(snap.exists() ? { id: snap.id, ...snap.data() } : null)
  );
}

export function watchCollection(uid, sub, cb, opts = {}) {
  let ref = collection(db, "users", uid, sub);
  let q = ref;
  if (opts.orderByField) q = query(ref, orderBy(opts.orderByField, opts.direction || "desc"));
  if (opts.whereField) q = query(ref, where(opts.whereField, "==", opts.whereValue));
  if (opts.limitTo) q = query(q, limit(opts.limitTo));
  return onSnapshot(q, (snap) => cb(snap.docs.map((d) => ({ id: d.id, ...d.data() }))));
}

export function watchBooks(cb) {
  return onSnapshot(collection(db, "books"), (snap) => cb(snap.docs.map((d) => ({ id: d.id, ...d.data() }))));
}

export async function getBook(id) {
  const snap = await getDoc(doc(db, "books", id));
  return snap.exists() ? { id: snap.id, ...snap.data() } : null;
}

export async function toggleExperimentDay(uid, experimentId, dayIndex, days) {
  const newDays = [...days];
  newDays[dayIndex] = !newDays[dayIndex];
  await updateDoc(doc(db, "users", uid, "experiments", experimentId), { days: newDays });
  return newDays;
}

export async function addPrinciple(uid, text) {
  await addDoc(collection(db, "users", uid, "playbookPrinciples"), { text, createdAt: serverTimestamp() });
}

export async function addWorksForMe(uid, text) {
  await addDoc(collection(db, "users", uid, "worksForMe"), { text, createdAt: serverTimestamp() });
}

export function watchThreadMessages(uid, threadId, cb) {
  const ref = query(
    collection(db, "users", uid, "coachThreads", threadId, "messages"),
    orderBy("createdAt", "asc")
  );
  return onSnapshot(ref, (snap) => cb(snap.docs.map((d) => ({ id: d.id, ...d.data() }))));
}
