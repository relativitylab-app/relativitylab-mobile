import React from "react";
import { act, create, ReactTestRenderer } from "react-test-renderer";

import {
  ProgressErrorObserver,
  ProgressRepository,
  ProgressSnapshot,
  ProgressSnapshotObserver,
} from "@/infrastructure/firebase/progressRepository";
import {
  KeyValueStorage,
  saveGuestProgress,
  storageKeys,
} from "@/infrastructure/storage/keyValueStorage";
import {
  ProgressAuthState,
  ProgressContextValue,
  ProgressProviderCore,
  useProgress,
} from "@/providers/ProgressProvider";

jest.mock("@react-native-async-storage/async-storage", () => ({
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
}));

class MemoryStorage implements KeyValueStorage {
  readonly values = new Map<string, string>();
  readonly getItem = jest.fn(async (key: string) => this.values.get(key) ?? null);
  readonly setItem = jest.fn(async (key: string, value: string) => {
    this.values.set(key, value);
  });
  readonly removeItem = jest.fn(async (key: string) => {
    this.values.delete(key);
  });
}

class Deferred<T> {
  readonly promise: Promise<T>;
  private resolveValue!: (value: T) => void;
  private rejectValue!: (reason?: unknown) => void;

  constructor() {
    this.promise = new Promise<T>((resolve, reject) => {
      this.resolveValue = resolve;
      this.rejectValue = reject;
    });
  }

  resolve(value: T): void {
    this.resolveValue(value);
  }

  reject(reason?: unknown): void {
    this.rejectValue(reason);
  }
}

class FakeProgressRepository implements ProgressRepository {
  readonly observers = new Map<
    string,
    { observer: ProgressSnapshotObserver; onError: ProgressErrorObserver }
  >();
  readonly unsubscribe = jest.fn();
  readonly observeProfile = jest.fn(
    (
      uid: string,
      observer: ProgressSnapshotObserver,
      onError: ProgressErrorObserver,
    ) => {
      this.observers.set(uid, { observer, onError });
      return this.unsubscribe;
    },
  );
  readonly unionSolvedQuestionIds: jest.MockedFunction<
    ProgressRepository["unionSolvedQuestionIds"]
  > = jest.fn(async (_uid: string, _questionIds: readonly string[]) => undefined);
  readonly awaitPendingWrites: jest.MockedFunction<
    ProgressRepository["awaitPendingWrites"]
  > = jest.fn(async () => undefined);

  emit(uid: string, snapshot: ProgressSnapshot): void {
    this.observers.get(uid)?.observer(snapshot);
  }

  fail(uid: string, error: unknown = new Error("unavailable")): void {
    this.observers.get(uid)?.onError(error);
  }
}

const flush = async (): Promise<void> => {
  await Promise.resolve();
  await Promise.resolve();
  await Promise.resolve();
};

const auth = (status: ProgressAuthState["status"], uid: string | null = null) =>
  ({ status, uid }) satisfies ProgressAuthState;

const renderProgress = async (
  authState: ProgressAuthState,
  repository: ProgressRepository,
  storage: KeyValueStorage,
) => {
  const states: ProgressContextValue[] = [];
  const Probe = () => {
    states.push(useProgress());
    return null;
  };
  const renderTree = (nextAuth: ProgressAuthState) => (
    <ProgressProviderCore
      auth={nextAuth}
      repository={repository}
      storage={storage}
      now={() => "2026-08-13T00:00:00.000Z"}
    >
      <Probe />
    </ProgressProviderCore>
  );

  let renderer: ReactTestRenderer;
  await act(async () => {
    renderer = create(renderTree(authState));
    await flush();
  });

  return {
    renderer: renderer!,
    states,
    updateAuth: async (nextAuth: ProgressAuthState) => {
      await act(async () => {
        renderer.update(renderTree(nextAuth));
        await flush();
      });
    },
  };
};

const latest = (states: ProgressContextValue[]) => states.at(-1)!;

describe("ProgressProviderCore", () => {
  it("loads, records, persists, and coalesces guest progress", async () => {
    const repository = new FakeProgressRepository();
    const storage = new MemoryStorage();
    await saveGuestProgress(storage, ["q1"], "2026-08-12T00:00:00.000Z");
    storage.setItem.mockClear();
    const { states } = await renderProgress(auth("guest"), repository, storage);

    let first!: Promise<void>;
    let second!: Promise<void>;
    await act(async () => {
      first = latest(states).recordSolved("q2");
      second = latest(states).recordSolved("q2");
      await Promise.all([first, second]);
      await flush();
    });

    expect(first).toBe(second);
    expect([...latest(states).solvedQuestionIds]).toEqual(["q1", "q2"]);
    expect(latest(states).syncStatus).toBe("synced");
    expect(storage.setItem).toHaveBeenCalledTimes(1);
    expect(JSON.parse(storage.values.get(storageKeys.guestProgress)!)).toEqual({
      schemaVersion: 1,
      solvedQuestionIds: ["q1", "q2"],
      updatedAt: "2026-08-13T00:00:00.000Z",
    });
  });

  it("serializes guest hydration with a solve so neither ID is lost", async () => {
    const repository = new FakeProgressRepository();
    const storage = new MemoryStorage();
    const delayedRead = new Deferred<string | null>();
    storage.getItem.mockImplementationOnce(() => delayedRead.promise);
    const { states } = await renderProgress(auth("guest"), repository, storage);

    let recording!: Promise<void>;
    await act(async () => {
      recording = latest(states).recordSolved("new-q");
      await flush();
    });

    delayedRead.resolve(
      JSON.stringify({
        schemaVersion: 1,
        solvedQuestionIds: ["saved-q"],
        updatedAt: "2026-08-12T00:00:00.000Z",
      }),
    );
    await act(async () => {
      await recording;
      await flush();
    });

    expect([...latest(states).solvedQuestionIds]).toEqual(["new-q", "saved-q"]);
    expect(JSON.parse(storage.values.get(storageKeys.guestProgress)!)).toEqual({
      schemaVersion: 1,
      solvedQuestionIds: ["new-q", "saved-q"],
      updatedAt: "2026-08-13T00:00:00.000Z",
    });
  });

  it("orders an in-progress guest write before account merge and clear", async () => {
    const repository = new FakeProgressRepository();
    const storage = new MemoryStorage();
    const writeStarted = new Deferred<void>();
    const finishWrite = new Deferred<void>();
    const { states, updateAuth } = await renderProgress(
      auth("guest"),
      repository,
      storage,
    );
    storage.setItem.mockImplementationOnce(async (key: string, value: string) => {
      writeStarted.resolve();
      await finishWrite.promise;
      storage.values.set(key, value);
    });

    let recording!: Promise<void>;
    act(() => {
      recording = latest(states).recordSolved("guest-q");
    });
    await writeStarted.promise;
    await updateAuth(auth("authenticated", "user-1"));

    await act(async () => {
      finishWrite.resolve();
      await recording;
      await flush();
      await flush();
    });

    expect(repository.unionSolvedQuestionIds).toHaveBeenCalledWith("user-1", ["guest-q"]);
    expect(storage.values.has(storageKeys.guestProgress)).toBe(false);
    expect(latest(states).solvedQuestionIds.has("guest-q")).toBe(true);
  });

  it("keeps an authenticated solve pending after enqueue until metadata acknowledges it", async () => {
    const repository = new FakeProgressRepository();
    const storage = new MemoryStorage();
    const { states } = await renderProgress(
      auth("authenticated", "user-1"),
      repository,
      storage,
    );

    await act(async () => {
      repository.emit("user-1", {
        solvedQuestionIds: ["q1"],
        fromCache: false,
        hasPendingWrites: false,
        dataError: false,
      });
      await latest(states).recordSolved("q2");
      await flush();
    });

    expect(repository.unionSolvedQuestionIds).toHaveBeenCalledWith("user-1", ["q2"]);
    expect(repository.awaitPendingWrites).not.toHaveBeenCalled();
    expect([...latest(states).solvedQuestionIds]).toEqual(["q1", "q2"]);
    expect([...latest(states).pendingQuestionIds]).toEqual(["q2"]);
    expect(latest(states).syncStatus).toBe("pending");

    await act(async () => {
      repository.emit("user-1", {
        solvedQuestionIds: ["q1", "q2"],
        fromCache: false,
        hasPendingWrites: false,
        dataError: false,
      });
      await flush();
    });

    expect([...latest(states).pendingQuestionIds]).toEqual([]);
    expect(latest(states).syncStatus).toBe("synced");
  });

  it("coalesces concurrent authenticated writes for the same question", async () => {
    const repository = new FakeProgressRepository();
    const enqueue = new Deferred<void>();
    repository.unionSolvedQuestionIds.mockImplementation(() => enqueue.promise);
    const { states } = await renderProgress(
      auth("authenticated", "user-1"),
      repository,
      new MemoryStorage(),
    );

    let first!: Promise<void>;
    let second!: Promise<void>;
    await act(async () => {
      first = latest(states).recordSolved("q1");
      second = latest(states).recordSolved("q1");
      await flush();
    });
    expect(first).toBe(second);
    expect(repository.unionSolvedQuestionIds).toHaveBeenCalledTimes(1);

    await act(async () => {
      enqueue.resolve();
      await first;
      await flush();
    });
  });

  it("does not enqueue another write for acknowledged or locally pending IDs", async () => {
    const repository = new FakeProgressRepository();
    const { states } = await renderProgress(
      auth("authenticated", "user-1"),
      repository,
      new MemoryStorage(),
    );

    act(() => {
      repository.emit("user-1", {
        solvedQuestionIds: ["done-q"],
        fromCache: false,
        hasPendingWrites: false,
        dataError: false,
      });
    });
    await act(async () => {
      await latest(states).recordSolved("done-q");
      await latest(states).recordSolved("pending-q");
      await latest(states).recordSolved("pending-q");
      await flush();
    });

    expect(repository.unionSolvedQuestionIds).toHaveBeenCalledTimes(1);
    expect(repository.unionSolvedQuestionIds).toHaveBeenCalledWith("user-1", ["pending-q"]);
  });

  it("keeps a rejected ID failed across rollback metadata and coalesces Retry", async () => {
    const repository = new FakeProgressRepository();
    repository.unionSolvedQuestionIds.mockRejectedValueOnce(new Error("denied"));
    const retryWrite = new Deferred<void>();
    repository.unionSolvedQuestionIds.mockImplementationOnce(() => retryWrite.promise);
    const { states } = await renderProgress(
      auth("authenticated", "user-1"),
      repository,
      new MemoryStorage(),
    );

    await act(async () => {
      await latest(states).recordSolved("q1");
      await flush();
    });
    act(() => {
      repository.emit("user-1", {
        solvedQuestionIds: [],
        fromCache: false,
        hasPendingWrites: false,
        dataError: false,
      });
    });
    expect(latest(states).syncStatus).toBe("failed");

    let first!: Promise<void>;
    let second!: Promise<void>;
    await act(async () => {
      first = latest(states).retrySync();
      second = latest(states).retrySync();
      await flush();
    });
    expect(first).toBe(second);
    expect(repository.unionSolvedQuestionIds).toHaveBeenCalledTimes(2);

    await act(async () => {
      retryWrite.resolve();
      await first;
      await flush();
    });
  });

  it("retains safe cloud progress on malformed data and does not false-sync an observer failure", async () => {
    const repository = new FakeProgressRepository();
    const { states } = await renderProgress(
      auth("authenticated", "user-1"),
      repository,
      new MemoryStorage(),
    );

    act(() => {
      repository.emit("user-1", {
        solvedQuestionIds: ["safe-q"],
        fromCache: false,
        hasPendingWrites: false,
        dataError: false,
      });
      repository.emit("user-1", {
        solvedQuestionIds: [],
        fromCache: false,
        hasPendingWrites: false,
        dataError: true,
      });
    });
    expect(latest(states).solvedQuestionIds.has("safe-q")).toBe(true);
    expect(latest(states).syncStatus).toBe("failed");

    act(() => {
      repository.emit("user-1", {
        solvedQuestionIds: ["safe-q"],
        fromCache: false,
        hasPendingWrites: false,
        dataError: false,
      });
      repository.fail("user-1");
    });
    expect(latest(states).syncStatus).toBe("failed");

    await act(async () => {
      await latest(states).retrySync();
      await flush();
    });
    expect(repository.awaitPendingWrites).toHaveBeenCalledTimes(1);
    expect(latest(states).syncStatus).toBe("failed");
  });

  it("does not clear guest progress until the backend acknowledgement completes", async () => {
    const repository = new FakeProgressRepository();
    const acknowledgement = new Deferred<void>();
    repository.awaitPendingWrites.mockImplementation(() => acknowledgement.promise);
    const storage = new MemoryStorage();
    await saveGuestProgress(storage, ["guest-q"], "2026-08-12T00:00:00.000Z");
    storage.removeItem.mockClear();
    const { states } = await renderProgress(
      auth("authenticated", "user-1"),
      repository,
      storage,
    );

    expect(repository.unionSolvedQuestionIds).toHaveBeenCalledWith("user-1", ["guest-q"]);
    expect(repository.awaitPendingWrites).toHaveBeenCalledTimes(1);
    expect(storage.removeItem).not.toHaveBeenCalledWith(storageKeys.guestProgress);
    expect(latest(states).syncStatus).toBe("pending");
    expect(latest(states).solvedQuestionIds.has("guest-q")).toBe(true);

    await act(async () => {
      acknowledgement.resolve();
      await flush();
    });

    expect(storage.removeItem).toHaveBeenCalledWith(storageKeys.guestProgress);
    expect(storage.values.has(storageKeys.guestProgress)).toBe(false);
    expect(latest(states).syncStatus).toBe("synced");
    expect(latest(states).solvedQuestionIds.has("guest-q")).toBe(true);
  });

  it("retains local IDs and exposes retry after merge acknowledgement fails", async () => {
    const repository = new FakeProgressRepository();
    repository.awaitPendingWrites.mockRejectedValueOnce(new Error("offline"));
    const storage = new MemoryStorage();
    await saveGuestProgress(storage, ["guest-q"], "2026-08-12T00:00:00.000Z");
    const { states } = await renderProgress(
      auth("authenticated", "user-1"),
      repository,
      storage,
    );

    expect(latest(states).syncStatus).toBe("failed");
    expect(latest(states).solvedQuestionIds.has("guest-q")).toBe(true);
    expect(storage.values.has(storageKeys.guestProgress)).toBe(true);

    await act(async () => {
      await latest(states).retrySync();
      await flush();
    });

    expect(repository.unionSolvedQuestionIds).toHaveBeenCalledTimes(2);
    expect(repository.awaitPendingWrites).toHaveBeenCalledTimes(2);
    expect(storage.values.has(storageKeys.guestProgress)).toBe(false);
    expect(latest(states).syncStatus).toBe("synced");
  });

  it("isolates account state and cannot clear guest data from a stale acknowledgement", async () => {
    const repository = new FakeProgressRepository();
    const acknowledgement = new Deferred<void>();
    repository.awaitPendingWrites.mockImplementation(() => acknowledgement.promise);
    const storage = new MemoryStorage();
    await saveGuestProgress(storage, ["guest-q"], "2026-08-12T00:00:00.000Z");
    const { states, updateAuth } = await renderProgress(
      auth("authenticated", "user-1"),
      repository,
      storage,
    );

    await updateAuth(auth("authenticated", "user-2"));
    await act(async () => {
      repository.emit("user-2", {
        solvedQuestionIds: ["user-2-q"],
        fromCache: false,
        hasPendingWrites: false,
        dataError: false,
      });
      acknowledgement.resolve();
      await flush();
    });

    expect(repository.unionSolvedQuestionIds).toHaveBeenCalledTimes(1);
    expect(repository.unionSolvedQuestionIds).toHaveBeenCalledWith("user-1", ["guest-q"]);
    expect(storage.values.has(storageKeys.guestProgress)).toBe(true);
    expect([...latest(states).solvedQuestionIds]).toEqual(["user-2-q"]);
    expect(latest(states).source).toBe("firebase");
  });

  it("discards account-scoped state on logout without creating guest progress", async () => {
    const repository = new FakeProgressRepository();
    const storage = new MemoryStorage();
    const { states, updateAuth } = await renderProgress(
      auth("authenticated", "user-1"),
      repository,
      storage,
    );

    await act(async () => {
      repository.emit("user-1", {
        solvedQuestionIds: ["private-q"],
        fromCache: false,
        hasPendingWrites: false,
        dataError: false,
      });
      await flush();
    });
    await updateAuth(auth("signedOut"));

    expect(latest(states).source).toBe("none");
    expect([...latest(states).solvedQuestionIds]).toEqual([]);
    expect(storage.values.has(storageKeys.guestProgress)).toBe(false);
    expect(repository.unsubscribe).toHaveBeenCalled();
  });
});
