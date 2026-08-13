const fs = require("node:fs");
const path = require("node:path");
const {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
} = require("@firebase/rules-unit-testing");
const firebase = require("firebase/compat/app");
require("firebase/compat/firestore");

let testEnv;

const projectId = "relativitylab-test";

function firestoreFor(uid) {
  if (!uid) {
    return testEnv.unauthenticatedContext().firestore();
  }

  return testEnv.authenticatedContext(uid).firestore();
}

function questionRef(db) {
  return db.doc("questions/length-contraction");
}

function profileRef(db, uid) {
  return db.doc(`profile/${uid}`);
}

function arrayUnion(...values) {
  return firebase.firestore.FieldValue.arrayUnion(...values);
}

async function seedData(context) {
  const db = context.firestore();

  await questionRef(db).set({
    number: 1,
    prompt: "Length contraction",
    answer: "0.8",
  });
  await profileRef(db, "alice").set({
    answered: ["intro"],
  });
}

beforeAll(async () => {
  testEnv = await initializeTestEnvironment({
    projectId,
    firestore: {
      rules: fs.readFileSync(path.join(__dirname, "../../firestore.rules"), "utf8"),
      host: "127.0.0.1",
      port: 8085,
    },
  });

  await testEnv.withSecurityRulesDisabled(seedData);
});

afterEach(async () => {
  await testEnv.clearFirestore();
  await testEnv.withSecurityRulesDisabled(seedData);
});

afterAll(async () => {
  await testEnv.cleanup();
});

test("R-01 allows unauthenticated question reads", async () => {
  await assertSucceeds(questionRef(firestoreFor(null)).get());
});

test("R-02 allows authenticated question reads", async () => {
  await assertSucceeds(questionRef(firestoreFor("alice")).get());
});

test("R-03 denies ordinary client question writes", async () => {
  await assertFails(firestoreFor("alice").doc("questions/new").set({ answer: "1" }));
});

test("R-04 denies unauthenticated profile reads and writes", async () => {
  await assertFails(profileRef(firestoreFor(null), "alice").get());
  await assertFails(profileRef(firestoreFor(null), "guest").set({ answered: [] }));
});

test("R-05 allows users to read, create, and update only their answered field", async () => {
  const db = firestoreFor("bob");

  await assertSucceeds(profileRef(db, "bob").set({ answered: [] }));
  await assertSucceeds(profileRef(db, "bob").get());
  await assertSucceeds(profileRef(db, "bob").update({ answered: arrayUnion("q1") }));
});

test("R-06 denies reads and writes for another UID", async () => {
  const db = firestoreFor("mallory");

  await assertFails(profileRef(db, "alice").get());
  await assertFails(profileRef(db, "alice").update({ answered: arrayUnion("q2") }));
});

test("R-07 denies malformed or unsafe profile writes", async () => {
  const db = firestoreFor("alice");
  const longId = "x".repeat(129);
  const tooManyIds = Array.from({ length: 1001 }, (_, index) => `q${index}`);

  await assertFails(profileRef(db, "alice").delete());
  await assertFails(profileRef(db, "alice").set({ answered: [], role: "admin" }));
  await assertFails(profileRef(db, "alice").set({ answered: "q1" }));
  await assertFails(profileRef(db, "alice").set({ answered: ["intro", 7] }));
  await assertFails(profileRef(db, "alice").set({ answered: ["intro", longId] }));
  await assertFails(profileRef(db, "alice").set({ answered: tooManyIds }));
  await assertFails(profileRef(db, "alice").set({ answered: ["intro", "intro"] }));
  await assertFails(profileRef(db, "alice").set({ answered: ["q2"] }));
  await assertFails(profileRef(db, "alice").set({ answered: ["q2", "intro"] }));
  await assertFails(profileRef(db, "alice").set({ answered: ["intro", "q2", "q3"] }));
});

test("R-08 allows missing-document and repeated arrayUnion progress writes", async () => {
  const db = firestoreFor("carol");
  const carolRef = profileRef(db, "carol");

  await assertSucceeds(carolRef.set({ answered: arrayUnion("q1") }, { merge: true }));
  await assertSucceeds(carolRef.update({ answered: arrayUnion("q1") }));
  await assertSucceeds(carolRef.update({ answered: arrayUnion("q2") }));
});
