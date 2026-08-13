import React, {
  ReactNode,
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import { AuthStatus } from "@/domain/auth";
import { unionQuestionIds } from "@/domain/progress";
import {
  ProgressRepository,
  firebaseProgressRepository,
} from "@/infrastructure/firebase/progressRepository";
import { asyncStorageAdapter } from "@/infrastructure/storage/asyncStorageAdapter";
import {
  KeyValueStorage,
  clearGuestProgress,
  loadGuestProgress,
  saveGuestProgress,
} from "@/infrastructure/storage/keyValueStorage";
import { useAuth } from "@/providers/AuthProvider";

export type ProgressSource = "none" | "guest" | "firebase";
export type ProgressSyncStatus = "pending" | "synced" | "failed";

export interface ProgressContextValue {
  readonly source: ProgressSource;
  readonly solvedQuestionIds: ReadonlySet<string>;
  readonly pendingQuestionIds: ReadonlySet<string>;
  readonly syncStatus: ProgressSyncStatus;
  readonly isLoading: boolean;
  readonly recordSolved: (questionId: string) => Promise<void>;
  readonly retrySync: () => Promise<void>;
}

export interface ProgressAuthState {
  readonly status: AuthStatus;
  readonly uid: string | null;
}

export interface ProgressProviderDependencies {
  readonly repository?: ProgressRepository;
  readonly storage?: KeyValueStorage;
  readonly now?: () => string;
}

export interface ProgressProviderCoreProps extends ProgressProviderDependencies {
  readonly auth: ProgressAuthState;
  readonly children: ReactNode;
}

interface ViewState {
  readonly source: ProgressSource;
  readonly cloudIds: readonly string[];
  readonly localIds: readonly string[];
  readonly pendingIds: readonly string[];
  readonly syncStatus: ProgressSyncStatus;
  readonly isLoading: boolean;
}

interface RetryFlight {
  readonly key: string;
  readonly promise: Promise<void>;
}

const initialViewState: ViewState = {
  source: "none",
  cloudIds: [],
  localIds: [],
  pendingIds: [],
  syncStatus: "synced",
  isLoading: false,
};

const ProgressContext = createContext<ProgressContextValue | undefined>(
  undefined,
);

const assertQuestionId = (questionId: string): string => {
  const normalized = unionQuestionIds([], [questionId]);

  if (normalized.length !== 1 || normalized[0] !== questionId) {
    throw new TypeError("invalid question ID");
  }

  return questionId;
};

export const ProgressProviderCore = ({
  auth,
  children,
  repository = firebaseProgressRepository,
  storage = asyncStorageAdapter,
  now = () => new Date().toISOString(),
}: ProgressProviderCoreProps) => {
  const [view, setViewState] = useState<ViewState>(initialViewState);
  const viewRef = useRef(view);
  const generationRef = useRef(0);
  const uidRef = useRef<string | null>(null);
  const metadataPendingRef = useRef(false);
  const failedIdsRef = useRef(new Set<string>());
  const observationFailedRef = useRef(false);
  const storageFailedRef = useRef(false);
  const guestMergeIdsRef = useRef(new Set<string>());
  const guestMergeOwnerRef = useRef<string | null>(null);
  const inFlightRef = useRef(new Map<string, Promise<void>>());
  const retryFlightRef = useRef<RetryFlight | null>(null);
  const storageTailRef = useRef<Promise<void>>(Promise.resolve());

  const setView = useCallback(
    (update: (current: ViewState) => ViewState): void => {
      const next = update(viewRef.current);
      viewRef.current = next;
      setViewState(next);
    },
    [],
  );

  const isCurrentAccount = useCallback(
    (uid: string, generation: number): boolean =>
      generationRef.current === generation && uidRef.current === uid,
    [],
  );

  const enqueueStorage = useCallback(<T,>(operation: () => Promise<T>): Promise<T> => {
    const result = storageTailRef.current.then(operation, operation);
    storageTailRef.current = result.then(
      () => undefined,
      () => undefined,
    );
    return result;
  }, []);

  const deriveSyncStatus = useCallback(
    (pendingIds: readonly string[]): ProgressSyncStatus => {
      if (
        observationFailedRef.current ||
        storageFailedRef.current ||
        failedIdsRef.current.size > 0
      ) {
        return "failed";
      }

      return pendingIds.length > 0 || metadataPendingRef.current
        ? "pending"
        : "synced";
    },
    [],
  );

  const syncAuthenticatedIds = useCallback(
    async (
      uid: string,
      ids: readonly string[],
      generation: number,
      clearGuestAfterAcknowledgement: boolean,
    ): Promise<void> => {
      const normalizedIds = unionQuestionIds([], ids);

      if (normalizedIds.length === 0 || !isCurrentAccount(uid, generation)) {
        return;
      }

      if (
        clearGuestAfterAcknowledgement &&
        guestMergeOwnerRef.current !== null &&
        guestMergeOwnerRef.current !== uid
      ) {
        return;
      }

      normalizedIds.forEach((id) => failedIdsRef.current.delete(id));

      setView((current) => ({
        ...current,
        localIds: unionQuestionIds(current.localIds, normalizedIds),
        pendingIds: unionQuestionIds(current.pendingIds, normalizedIds),
        syncStatus: deriveSyncStatus(
          unionQuestionIds(current.pendingIds, normalizedIds),
        ),
      }));

      if (clearGuestAfterAcknowledgement) {
        guestMergeOwnerRef.current = uid;
        normalizedIds.forEach((id) => guestMergeIdsRef.current.add(id));
      }

      try {
        await repository.unionSolvedQuestionIds(uid, normalizedIds);

        if (!isCurrentAccount(uid, generation)) {
          return;
        }

        if (!clearGuestAfterAcknowledgement) {
          return;
        }

        await repository.awaitPendingWrites();

        if (!isCurrentAccount(uid, generation)) {
          return;
        }

        const cleared = await enqueueStorage(async () => {
          if (!isCurrentAccount(uid, generation)) {
            return false;
          }

          await clearGuestProgress(storage);
          return true;
        });

        if (!cleared || !isCurrentAccount(uid, generation)) {
          return;
        }

        guestMergeOwnerRef.current = null;

        const acknowledged = new Set(normalizedIds);
        normalizedIds.forEach((id) => guestMergeIdsRef.current.delete(id));
        normalizedIds.forEach((id) => failedIdsRef.current.delete(id));
        setView((current) => {
          const pendingIds = current.pendingIds.filter(
            (id) => !acknowledged.has(id),
          );

          return {
            ...current,
            cloudIds: unionQuestionIds(current.cloudIds, normalizedIds),
            localIds: clearGuestAfterAcknowledgement
              ? current.localIds.filter((id) => !acknowledged.has(id))
              : current.localIds,
            pendingIds,
            syncStatus: deriveSyncStatus(pendingIds),
          };
        });
      } catch {
        if (!isCurrentAccount(uid, generation)) {
          return;
        }

        normalizedIds.forEach((id) => failedIdsRef.current.add(id));
        setView((current) => ({
          ...current,
          syncStatus: "failed",
        }));
      }
    },
    [deriveSyncStatus, enqueueStorage, isCurrentAccount, repository, setView, storage],
  );

  useEffect(() => {
    const generation = generationRef.current + 1;
    generationRef.current = generation;
    const previous = viewRef.current;
    const previousGuestIds =
      previous.source === "guest"
        ? unionQuestionIds(previous.localIds, previous.pendingIds)
        : [];
    const uid = auth.status === "authenticated" ? auth.uid : null;
    uidRef.current = uid;
    metadataPendingRef.current = false;
    failedIdsRef.current.clear();
    observationFailedRef.current = false;
    storageFailedRef.current = false;
    guestMergeIdsRef.current.clear();
    inFlightRef.current.clear();
    retryFlightRef.current = null;
    const invalidateGeneration = (): void => {
      if (generationRef.current === generation) {
        generationRef.current += 1;
        uidRef.current = null;
      }
    };

    if (auth.status === "guest") {
      setView(() => ({
        ...initialViewState,
        source: "guest",
        syncStatus: "pending",
        isLoading: true,
      }));

      void enqueueStorage(() => loadGuestProgress(storage))
        .then((record) => {
          if (generationRef.current !== generation || uidRef.current !== null) {
            return;
          }

          storageFailedRef.current = false;
          setView((current) => {
            const localIds = unionQuestionIds(
              unionQuestionIds(
                previousGuestIds,
                unionQuestionIds(current.localIds, current.pendingIds),
              ),
              record?.solvedQuestionIds ?? [],
            );

            return {
              ...current,
              localIds,
              pendingIds: current.pendingIds,
              syncStatus: deriveSyncStatus(current.pendingIds),
              isLoading: false,
            };
          });
        })
        .catch(() => {
          if (generationRef.current !== generation || uidRef.current !== null) {
            return;
          }

          storageFailedRef.current = true;
          setView((current) => ({
            ...current,
            localIds: unionQuestionIds(current.localIds, previousGuestIds),
            pendingIds: unionQuestionIds(current.pendingIds, previousGuestIds),
            syncStatus: "failed",
            isLoading: false,
          }));
        });

      return invalidateGeneration;
    }

    if (uid === null) {
      setView(() => initialViewState);
      return invalidateGeneration;
    }

    setView(() => ({
      ...initialViewState,
      source: "firebase",
      syncStatus: "pending",
      isLoading: true,
    }));

    const unsubscribe = repository.observeProfile(
      uid,
      (snapshot) => {
        if (!isCurrentAccount(uid, generation)) {
          return;
        }

        metadataPendingRef.current = snapshot.hasPendingWrites;

        if (snapshot.dataError) {
          observationFailedRef.current = true;
          setView((current) => ({
            ...current,
            syncStatus: "failed",
            isLoading: false,
          }));
          return;
        }

        observationFailedRef.current = false;
        setView((current) => {
          const cloudIds = snapshot.solvedQuestionIds;
          const cloudSet = new Set(cloudIds);
          const pendingIds = snapshot.hasPendingWrites
            ? current.pendingIds
            : current.pendingIds.filter(
                (id) =>
                  !cloudSet.has(id) || guestMergeIdsRef.current.has(id),
              );
          const localIds = snapshot.hasPendingWrites
            ? current.localIds
            : current.localIds.filter(
                (id) =>
                  !cloudSet.has(id) || guestMergeIdsRef.current.has(id),
              );

          if (!snapshot.hasPendingWrites) {
            cloudIds.forEach((id) => failedIdsRef.current.delete(id));
          }

          return {
            ...current,
            cloudIds,
            localIds,
            pendingIds,
            syncStatus: deriveSyncStatus(pendingIds),
            isLoading: false,
          };
        });
      },
      () => {
        if (!isCurrentAccount(uid, generation)) {
          return;
        }

        observationFailedRef.current = true;
        setView((current) => ({
          ...current,
          syncStatus: "failed",
          isLoading: false,
        }));
      },
    );

    void enqueueStorage(() => loadGuestProgress(storage))
      .then((record) => {
        if (!isCurrentAccount(uid, generation)) {
          return;
        }

        const guestIds = unionQuestionIds(
          previousGuestIds,
          record?.solvedQuestionIds ?? [],
        );

        if (guestIds.length > 0) {
          if (
            guestMergeOwnerRef.current === null ||
            guestMergeOwnerRef.current === uid
          ) {
            void syncAuthenticatedIds(uid, guestIds, generation, true);
          }
        }
      })
      .catch(() => {
        if (!isCurrentAccount(uid, generation)) {
          return;
        }

        storageFailedRef.current = true;
        setView((current) => ({
          ...current,
          localIds: previousGuestIds,
          pendingIds: previousGuestIds,
          syncStatus: "failed",
        }));
      });

    return () => {
      invalidateGeneration();
      unsubscribe();
    };
  }, [
    auth.status,
    auth.uid,
    deriveSyncStatus,
    enqueueStorage,
    isCurrentAccount,
    repository,
    setView,
    storage,
    syncAuthenticatedIds,
  ]);

  const recordSolved = useCallback(
    (rawQuestionId: string): Promise<void> => {
      const questionId = assertQuestionId(rawQuestionId);
      const source = viewRef.current.source;
      const uid = uidRef.current;
      const generation = generationRef.current;
      const scope = source === "firebase" && uid !== null ? uid : source;
      const operationKey = `${scope}:${questionId}`;
      const existing = inFlightRef.current.get(operationKey);

      if (existing !== undefined) {
        return existing;
      }

      const visibleIds = unionQuestionIds(
        unionQuestionIds(viewRef.current.cloudIds, viewRef.current.localIds),
        viewRef.current.pendingIds,
      );
      if (visibleIds.includes(questionId)) {
        return Promise.resolve();
      }

      let operation: Promise<void>;

      if (source === "guest") {
        setView((current) => ({
          ...current,
          localIds: unionQuestionIds(current.localIds, [questionId]),
          pendingIds: unionQuestionIds(current.pendingIds, [questionId]),
          syncStatus: "pending",
        }));

        operation = enqueueStorage(async () => {
          if (generationRef.current !== generation || viewRef.current.source !== "guest") {
            return;
          }

          const solvedIds = unionQuestionIds(
            viewRef.current.localIds,
            viewRef.current.pendingIds,
          );

          try {
            await saveGuestProgress(storage, solvedIds, now());
          } catch (error) {
            if (generationRef.current === generation) {
              storageFailedRef.current = true;
              failedIdsRef.current.add(questionId);
              setView((current) => ({ ...current, syncStatus: "failed" }));
            }
            throw error;
          }

          if (generationRef.current === generation) {
            storageFailedRef.current = false;
            solvedIds.forEach((id) => failedIdsRef.current.delete(id));
            setView((current) => ({
              ...current,
              pendingIds: current.pendingIds.filter(
                (id) => !solvedIds.includes(id),
              ),
              syncStatus: deriveSyncStatus(
                current.pendingIds.filter((id) => !solvedIds.includes(id)),
              ),
            }));
          }
        });
      } else if (source === "firebase" && uid !== null) {
        operation = syncAuthenticatedIds(uid, [questionId], generation, false);
      } else {
        operation = Promise.reject(new Error("progress is not available"));
      }

      const trackedOperation = operation.finally(() => {
        if (inFlightRef.current.get(operationKey) === trackedOperation) {
          inFlightRef.current.delete(operationKey);
        }
      });
      inFlightRef.current.set(operationKey, trackedOperation);

      return trackedOperation;
    },
    [deriveSyncStatus, enqueueStorage, now, setView, storage, syncAuthenticatedIds],
  );

  const retrySync = useCallback((): Promise<void> => {
    const current = viewRef.current;
    const generation = generationRef.current;
    const uid = uidRef.current;
    const retryKey = `${generation}:${current.source}:${uid ?? "none"}`;
    const existing = retryFlightRef.current;

    if (existing?.key === retryKey) {
      return existing.promise;
    }

    const operation = (async (): Promise<void> => {
      if (current.source === "guest") {
        const solvedIds = unionQuestionIds(current.localIds, current.pendingIds);
        storageFailedRef.current = false;
        failedIdsRef.current.clear();
        setView((state) => ({ ...state, syncStatus: "pending" }));

        try {
          await enqueueStorage(() => saveGuestProgress(storage, solvedIds, now()));
          if (
            generationRef.current === generation &&
            viewRef.current.source === "guest"
          ) {
            storageFailedRef.current = false;
            failedIdsRef.current.clear();
            setView((state) => ({
              ...state,
              localIds: solvedIds,
              pendingIds: [],
              syncStatus: deriveSyncStatus([]),
            }));
          }
        } catch {
          if (generationRef.current === generation) {
            storageFailedRef.current = true;
            solvedIds.forEach((id) => failedIdsRef.current.add(id));
            setView((state) => ({ ...state, syncStatus: "failed" }));
          }
        }
        return;
      }

      if (current.source !== "firebase" || uid === null) {
        return;
      }

      let guestRecord;
      try {
        guestRecord = await enqueueStorage(() => loadGuestProgress(storage));
        storageFailedRef.current = false;
      } catch {
        if (isCurrentAccount(uid, generation)) {
          storageFailedRef.current = true;
          setView((state) => ({ ...state, syncStatus: "failed" }));
        }
        return;
      }

      const ids = unionQuestionIds(
        current.pendingIds,
        guestRecord?.solvedQuestionIds ?? [],
      );

      if (ids.length > 0) {
        await syncAuthenticatedIds(
          uid,
          ids,
          generation,
          (guestRecord?.solvedQuestionIds.length ?? 0) > 0,
        );
        return;
      }

      setView((state) => ({ ...state, syncStatus: "pending" }));
      try {
        await repository.awaitPendingWrites();
        if (isCurrentAccount(uid, generation)) {
          metadataPendingRef.current = false;
          setView((state) => ({
            ...state,
            syncStatus: deriveSyncStatus(state.pendingIds),
          }));
        }
      } catch {
        if (isCurrentAccount(uid, generation)) {
          observationFailedRef.current = true;
          setView((state) => ({ ...state, syncStatus: "failed" }));
        }
      }
    })();

    const trackedOperation = operation.finally(() => {
      if (retryFlightRef.current?.promise === trackedOperation) {
        retryFlightRef.current = null;
      }
    });
    retryFlightRef.current = { key: retryKey, promise: trackedOperation };

    return trackedOperation;
  }, [
    deriveSyncStatus,
    enqueueStorage,
    isCurrentAccount,
    now,
    repository,
    setView,
    storage,
    syncAuthenticatedIds,
  ]);

  const value = useMemo<ProgressContextValue>(() => {
    const solvedQuestionIds = new Set(
      unionQuestionIds(view.cloudIds, view.localIds),
    );

    view.pendingIds.forEach((id) => solvedQuestionIds.add(id));

    return {
      source: view.source,
      solvedQuestionIds,
      pendingQuestionIds: new Set(view.pendingIds),
      syncStatus: view.syncStatus,
      isLoading: view.isLoading,
      recordSolved,
      retrySync,
    };
  }, [recordSolved, retrySync, view]);

  return (
    <ProgressContext.Provider value={value}>
      {children}
    </ProgressContext.Provider>
  );
};

const AuthenticatedProgressProvider = ({
  children,
  ...dependencies
}: ProgressProviderDependencies & { readonly children: ReactNode }) => {
  const auth = useAuth();

  return (
    <ProgressProviderCore
      {...dependencies}
      auth={{ status: auth.status, uid: auth.user?.uid ?? null }}
    >
      {children}
    </ProgressProviderCore>
  );
};

export const ProgressProvider = (
  props: ProgressProviderDependencies & { readonly children: ReactNode },
) => <AuthenticatedProgressProvider {...props} />;

export const useProgress = (): ProgressContextValue => {
  const context = useContext(ProgressContext);

  if (context === undefined) {
    throw new Error("useProgress must be used within a ProgressProvider");
  }

  return context;
};
