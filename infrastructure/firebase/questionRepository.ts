import type { QuerySnapshot } from "@react-native-firebase/firestore";
import {
  collection,
  getDocsFromServer,
  getFirestore,
  onSnapshot,
} from "@react-native-firebase/firestore";

import { Question, decodeQuestions } from "@/domain/questions";
import { asyncStorageAdapter } from "@/infrastructure/storage/asyncStorageAdapter";
import {
  KeyValueStorage,
  loadQuestionCache,
  saveQuestionCache,
} from "@/infrastructure/storage/keyValueStorage";

export type QuestionSource =
  | "current"
  | "firestore-cache"
  | "fallback-cache";

export type QuestionState =
  | { readonly kind: "loading" }
  | {
      readonly kind: "ready";
      readonly questions: readonly Question[];
      readonly source: QuestionSource;
      readonly invalidCount: number;
      readonly cachedAt: string | null;
      readonly refreshing: boolean;
      readonly refreshError: boolean;
    }
  | { readonly kind: "empty-offline"; readonly retryable: true }
  | {
      readonly kind: "error";
      readonly reason: "data" | "network";
      readonly retryable: boolean;
    };

export type QuestionStateListener = (state: QuestionState) => void;

export interface QuestionRepository {
  readonly subscribe: (listener: QuestionStateListener) => () => void;
  readonly refresh: () => Promise<void>;
}

export interface QuestionSnapshotDocument {
  readonly id: string;
  readonly data: () => unknown;
}

export interface QuestionSnapshot {
  readonly docs: readonly QuestionSnapshotDocument[];
  readonly metadata: { readonly fromCache: boolean };
}

export interface QuestionFirestoreGateway {
  readonly subscribe: (
    next: (snapshot: QuestionSnapshot) => void,
    error: (error: unknown) => void,
  ) => () => void;
  readonly refresh: () => Promise<QuestionSnapshot>;
}

export interface CreateQuestionRepositoryOptions {
  readonly gateway?: QuestionFirestoreGateway;
  readonly storage?: KeyValueStorage;
  readonly now?: () => string;
}

type QuestionPayload = Parameters<
  typeof decodeQuestions
>[0][number]["data"];

export const createFirebaseQuestionGateway = (): QuestionFirestoreGateway => {
  const questionsQuery = collection(getFirestore(), "questions");

  return {
    subscribe: (next, error) =>
      onSnapshot(
        questionsQuery,
        { includeMetadataChanges: true },
        (snapshot: QuerySnapshot) => next(snapshot),
        error,
      ),
    refresh: async () => getDocsFromServer(questionsQuery),
  };
};

const decodeSnapshot = (snapshot: QuestionSnapshot) =>
  decodeQuestions(
    snapshot.docs.map((document) => ({
      id: document.id,
      data: document.data() as QuestionPayload,
    })),
  );

const isReadyState = (
  state: QuestionState,
): state is Extract<QuestionState, { readonly kind: "ready" }> =>
  state.kind === "ready";

export const createQuestionRepository = (
  options: CreateQuestionRepositoryOptions = {},
): QuestionRepository => {
  let gateway = options.gateway;
  const storage = options.storage ?? asyncStorageAdapter;
  const now = options.now ?? (() => new Date().toISOString());
  const listeners = new Set<QuestionStateListener>();
  let state: QuestionState = { kind: "loading" };
  let unsubscribe: (() => void) | null = null;
  let cacheResolved = false;
  let firstSnapshotResolved = false;
  let disposed = false;
  let generation = 0;
  let snapshotRevision = 0;
  let latestCacheRevision = 0;
  let cacheWriteTail: Promise<void> = Promise.resolve();
  let refreshPromise: Promise<void> | null = null;
  let authoritativeDataError = false;
  let pendingUnavailable: {
    readonly reason: "data" | "network";
    readonly retryable: boolean;
  } | null = null;

  const getGateway = (): QuestionFirestoreGateway => {
    gateway ??= createFirebaseQuestionGateway();
    return gateway;
  };

  const emit = (nextState: QuestionState): void => {
    if (disposed) {
      return;
    }

    state = nextState;
    listeners.forEach((listener) => listener(state));
  };

  const emitUnavailable = (
    reason: "data" | "network",
    retryable: boolean,
  ): void => {
    if (reason === "data") {
      authoritativeDataError = true;
      pendingUnavailable = null;
      emit({ kind: "error", reason, retryable });
      return;
    }

    if (authoritativeDataError) {
      emit({ kind: "error", reason: "data", retryable: false });
      return;
    }

    if (isReadyState(state)) {
      emit({
        ...state,
        refreshing: false,
        refreshError: true,
      });
      return;
    }

    if (cacheResolved && firstSnapshotResolved) {
      emit(
        reason === "network"
          ? { kind: "empty-offline", retryable: true }
          : { kind: "error", reason, retryable },
      );
      pendingUnavailable = null;
    } else {
      pendingUnavailable = { reason, retryable };
    }
  };

  const emitPendingUnavailableAfterCache = (): void => {
    if (!firstSnapshotResolved || state.kind !== "loading") {
      return;
    }

    const unavailable = pendingUnavailable;
    pendingUnavailable = null;
    emit(
      unavailable?.reason === "data"
        ? {
            kind: "error",
            reason: "data",
            retryable: unavailable.retryable,
          }
        : { kind: "empty-offline", retryable: true },
    );
  };

  const applySnapshot = async (
    snapshot: QuestionSnapshot,
    snapshotGeneration: number,
  ): Promise<void> => {
    const decoded = decodeSnapshot(snapshot);
    const revision = snapshotRevision + 1;
    snapshotRevision = revision;

    if (disposed || snapshotGeneration !== generation) {
      return;
    }

    firstSnapshotResolved = true;

    if (decoded.questions.length === 0) {
      if (
        snapshot.docs.length > 0 &&
        decoded.invalidCount === snapshot.docs.length
      ) {
        emitUnavailable("data", false);
      } else if (!snapshot.metadata.fromCache) {
        emitUnavailable("data", true);
      } else if (cacheResolved) {
        emitUnavailable("network", true);
      }

      return;
    }

    authoritativeDataError = false;
    pendingUnavailable = null;
    const cachedAt = now();
    const source: QuestionSource = snapshot.metadata.fromCache
      ? "firestore-cache"
      : "current";

    emit({
      kind: "ready",
      questions: decoded.questions,
      source,
      invalidCount: decoded.invalidCount,
      cachedAt,
      refreshing: false,
      refreshError: false,
    });

    latestCacheRevision = revision;
    const cacheWrite = cacheWriteTail.then(async () => {
      if (revision !== latestCacheRevision) {
        return;
      }

      await saveQuestionCache(storage, decoded.questions, cachedAt);
    });
    cacheWriteTail = cacheWrite.catch(() => undefined);
    await cacheWrite.catch(() => undefined);
  };

  const start = (): void => {
    disposed = false;
    generation += 1;
    const activeGeneration = generation;
    authoritativeDataError = false;

    void loadQuestionCache(storage)
      .then((cache) => {
        if (disposed || activeGeneration !== generation) {
          return;
        }

        cacheResolved = true;

        if (
          cache !== null &&
          !isReadyState(state) &&
          !authoritativeDataError
        ) {
          pendingUnavailable = null;
          emit({
            kind: "ready",
            questions: cache.questions,
            source: "fallback-cache",
            invalidCount: 0,
            cachedAt: cache.cachedAt,
            refreshing: false,
            refreshError: false,
          });
          return;
        }

        emitPendingUnavailableAfterCache();
      })
      .catch(() => {
        if (disposed || activeGeneration !== generation) {
          return;
        }

        cacheResolved = true;
        emitPendingUnavailableAfterCache();
      });

    unsubscribe = getGateway().subscribe(
      (snapshot) => {
        void applySnapshot(snapshot, activeGeneration);
      },
      () => {
        if (disposed || activeGeneration !== generation) {
          return;
        }

        firstSnapshotResolved = true;
        emitUnavailable("network", true);
      },
    );
  };

  return {
    subscribe: (listener) => {
      listeners.add(listener);
      listener(state);

      if (unsubscribe === null) {
        start();
      }

      return () => {
        listeners.delete(listener);

        if (listeners.size === 0) {
          disposed = true;
          generation += 1;
          unsubscribe?.();
          unsubscribe = null;
          cacheResolved = false;
          firstSnapshotResolved = false;
          pendingUnavailable = null;
          state = { kind: "loading" };
          authoritativeDataError = false;
        }
      };
    },

    refresh: () => {
      if (refreshPromise !== null) {
        return refreshPromise;
      }

      if (isReadyState(state)) {
        emit({ ...state, refreshing: true, refreshError: false });
      }

      const activeGeneration = generation;
      refreshPromise = getGateway()
        .refresh()
        .then((snapshot) => applySnapshot(snapshot, activeGeneration))
        .catch(() => {
          if (!disposed && activeGeneration === generation) {
            firstSnapshotResolved = true;
            emitUnavailable("network", true);
          }
        })
        .finally(() => {
          refreshPromise = null;
        });

      return refreshPromise;
    },
  };
};

export const firebaseQuestionRepository = createQuestionRepository();
