import {
  arrayUnion,
  doc,
  getFirestore,
  onSnapshot,
  setDoc,
  waitForPendingWrites,
} from "@react-native-firebase/firestore";

import {
  MAX_PROGRESS_ID_LENGTH,
  MAX_PROGRESS_ID_LIST_LENGTH,
  unionQuestionIds,
} from "@/domain/progress";

export interface ProgressSnapshot {
  readonly solvedQuestionIds: readonly string[];
  readonly fromCache: boolean;
  readonly hasPendingWrites: boolean;
  readonly dataError: boolean;
}

export type ProgressSnapshotObserver = (snapshot: ProgressSnapshot) => void;
export type ProgressErrorObserver = (error: unknown) => void;

export interface ProgressRepository {
  readonly observeProfile: (
    uid: string,
    observer: ProgressSnapshotObserver,
    onError: ProgressErrorObserver,
  ) => () => void;
  readonly unionSolvedQuestionIds: (
    uid: string,
    questionIds: readonly string[],
  ) => Promise<void>;
  readonly awaitPendingWrites: () => Promise<void>;
}

export interface ProgressRepositoryDriver {
  readonly observeProfile: (
    uid: string,
    observer: (snapshot: {
      readonly data: unknown;
      readonly fromCache: boolean;
      readonly hasPendingWrites: boolean;
    }) => void,
    onError: ProgressErrorObserver,
  ) => () => void;
  readonly mergeAnswered: (
    uid: string,
    questionIds: readonly string[],
  ) => Promise<void>;
  readonly awaitPendingWrites: () => Promise<void>;
}

const decodeAnswered = (
  value: unknown,
): { readonly solvedQuestionIds: readonly string[]; readonly dataError: boolean } => {
  if (value === undefined) {
    return { solvedQuestionIds: [], dataError: false };
  }

  if (
    typeof value !== "object" ||
    value === null ||
    !("answered" in value) ||
    !Array.isArray(value.answered) ||
    value.answered.length > MAX_PROGRESS_ID_LIST_LENGTH ||
    !value.answered.every(
      (id) =>
        typeof id === "string" &&
        id !== "" &&
        id.trim() === id &&
        id.length <= MAX_PROGRESS_ID_LENGTH,
    )
  ) {
    return { solvedQuestionIds: [], dataError: true };
  }

  return {
    solvedQuestionIds: [...new Set(value.answered)],
    dataError: false,
  };
};

const nativeDriver: ProgressRepositoryDriver = {
  observeProfile: (uid, observer, onError) => {
    const profile = doc(getFirestore(), "profile", uid);

    return onSnapshot(
      profile,
      { includeMetadataChanges: true },
      (snapshot) => {
        observer({
          data: snapshot.data(),
          fromCache: snapshot.metadata.fromCache,
          hasPendingWrites: snapshot.metadata.hasPendingWrites,
        });
      },
      onError,
    );
  },
  mergeAnswered: async (uid, questionIds) => {
    const profile = doc(getFirestore(), "profile", uid);

    await setDoc(
      profile,
      { answered: arrayUnion(...questionIds) },
      { merge: true },
    );
  },
  awaitPendingWrites: () => waitForPendingWrites(getFirestore()),
};

export const createProgressRepository = (
  driver: ProgressRepositoryDriver = nativeDriver,
): ProgressRepository => ({
  observeProfile: (uid, observer, onError) =>
    driver.observeProfile(
      uid,
      (snapshot) => {
        const decoded = decodeAnswered(snapshot.data);
        observer({
          solvedQuestionIds: decoded.solvedQuestionIds,
          fromCache: snapshot.fromCache,
          hasPendingWrites: snapshot.hasPendingWrites,
          dataError: decoded.dataError,
        });
      },
      onError,
    ),
  unionSolvedQuestionIds: async (uid, questionIds) => {
    const normalizedQuestionIds = unionQuestionIds([], questionIds);

    if (normalizedQuestionIds.length === 0) {
      return;
    }

    await driver.mergeAnswered(uid, normalizedQuestionIds);
  },
  awaitPendingWrites: driver.awaitPendingWrites,
});

export const firebaseProgressRepository = createProgressRepository();
