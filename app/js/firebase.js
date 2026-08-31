// Apex Surge — Firebase bootstrap (ESM, no bundler required)
import { initializeApp } from "https://www.gstatic.com/firebasejs/12.18.0/firebase-app.js";
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signOut as fbSignOut,
  onAuthStateChanged,
  connectAuthEmulator,
} from "https://www.gstatic.com/firebasejs/12.18.0/firebase-auth.js";
import {
  getFirestore,
  doc,
  getDoc,
  setDoc,
  updateDoc,
  onSnapshot,
  collection,
  addDoc,
  query,
  orderBy,
  limit,
  where,
  serverTimestamp,
  connectFirestoreEmulator,
} from "https://www.gstatic.com/firebasejs/12.18.0/firebase-firestore.js";
import {
  getFunctions,
  httpsCallable,
  connectFunctionsEmulator,
} from "https://www.gstatic.com/firebasejs/12.18.0/firebase-functions.js";

const firebaseConfig = {
  apiKey: "AIzaSyCH6vyHOyd3EabivPrDmr2yl8BxL5G1dns",
  authDomain: "thrive-9a736.firebaseapp.com",
  projectId: "thrive-9a736",
  storageBucket: "thrive-9a736.appspot.com",
  messagingSenderId: "721030776076",
  appId: "1:721030776076:web:75c44f380ba92a96643529",
};

export const fbApp = initializeApp(firebaseConfig);
export const auth = getAuth(fbApp);
export const db = getFirestore(fbApp);
export const functions = getFunctions(fbApp);

export const googleProvider = new GoogleAuthProvider();

// Auto-connect to local emulators when running the app from localhost so
// `firebase emulators:start` + a static server gives a fully local dev loop.
// Deployed Hosting traffic never hits this branch (different hostname).
if (typeof location !== "undefined" && ["localhost", "127.0.0.1"].includes(location.hostname)) {
  try {
    connectAuthEmulator(auth, "http://127.0.0.1:9099", { disableWarnings: true });
    connectFirestoreEmulator(db, "127.0.0.1", 8080);
    connectFunctionsEmulator(functions, "127.0.0.1", 5001);
    console.info("[Apex Surge] Connected to local Firebase emulators.");
  } catch (e) {
    console.warn("[Apex Surge] Emulator connection skipped:", e);
  }
}

export {
  signInWithPopup,
  fbSignOut,
  onAuthStateChanged,
  doc,
  getDoc,
  setDoc,
  updateDoc,
  onSnapshot,
  collection,
  addDoc,
  query,
  orderBy,
  limit,
  where,
  serverTimestamp,
  httpsCallable,
};
