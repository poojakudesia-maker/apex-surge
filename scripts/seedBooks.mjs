// One-time seed script for the public `books` collection.
// Run once after `firebase deploy` (or against the emulator) with:
//   cd scripts && npm install && node seedBooks.mjs
// Auth: uses Application Default Credentials. Easiest path:
//   gcloud auth application-default login
// or set GOOGLE_APPLICATION_CREDENTIALS to a service-account key file.

import { initializeApp, applicationDefault } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

const PROJECT_ID = "thrive-9a736";

initializeApp({ credential: applicationDefault(), projectId: PROJECT_ID });
const db = getFirestore();

const books = [
  {
    id: "atomic-habits",
    title: "Atomic Habits",
    author: "James Clear",
    tag: "Habits",
    color: "#7c5cff",
    keyIdea: "Make the first step of a habit so small it's almost impossible to say no to.",
    example:
      "Instead of 'work on the presentation for 2 hours,' the rule becomes 'open the file and write one slide title.' Motivation follows the start, not the other way around.",
  },
  {
    id: "deep-work",
    title: "Deep Work",
    author: "Cal Newport",
    tag: "Focus",
    color: "#2ee6a6",
    keyIdea: "Schedule blocks of undistracted, cognitively demanding work as deliberately as meetings.",
    example: "Block 90 minutes before 11am, phone in another room, one task only.",
  },
  {
    id: "essentialism",
    title: "Essentialism",
    author: "Greg McKeown",
    tag: "Priorities",
    color: "#ff8a5c",
    keyIdea: "If it isn't a clear yes, it's a clear no. Do less, but better.",
    example: "Audit your current commitments and cut the ones that aren't a 'hell yes.'",
  },
  {
    id: "radical-candor",
    title: "Radical Candor",
    author: "Kim Scott",
    tag: "Leadership",
    color: "#ffcf5c",
    keyIdea: "Care personally and challenge directly, at the same time.",
    example: "Give feedback that names the specific behavior and why it matters to the person, not just the business.",
  },
  {
    id: "never-split-the-difference",
    title: "Never Split the Difference",
    author: "Chris Voss",
    tag: "Negotiation",
    color: "#ff5c7a",
    keyIdea: "Ask calibrated 'how' and 'what' questions instead of making direct asks.",
    example: "Replace 'I need a raise' with 'How would you feel about revisiting my level this quarter?'",
  },
  {
    id: "mindset",
    title: "Mindset",
    author: "Carol Dweck",
    tag: "Growth",
    color: "#5cc8ff",
    keyIdea: "Ability grows with effort; treat setbacks as data, not verdicts.",
    example: "Replace 'I'm bad at this' with 'I'm not good at this yet.'",
  },
  {
    id: "confidence-code",
    title: "The Confidence Code",
    author: "Katty Kay & Claire Shipman",
    tag: "Confidence",
    color: "#c084fc",
    keyIdea: "Confidence is built through action, not thought - it follows doing, not the reverse.",
    example: "Take the small uncomfortable action before you feel ready, not after.",
  },
  {
    id: "eat-that-frog",
    title: "Eat That Frog",
    author: "Brian Tracy",
    tag: "Productivity",
    color: "#34d399",
    keyIdea: "Do your hardest, most important task first thing, before anything else.",
    example: "Identify tomorrow's 'frog' tonight, and do nothing else until it's done.",
  },
];

const batch = db.batch();
for (const b of books) {
  const { id, ...data } = b;
  batch.set(db.collection("books").doc(id), data);
}
await batch.commit();
console.log(`Seeded ${books.length} books into project ${PROJECT_ID}.`);
