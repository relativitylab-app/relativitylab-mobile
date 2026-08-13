import {
  QuestionFirestoreGateway,
  QuestionSnapshot,
  QuestionState,
  createFirebaseQuestionGateway,
  createQuestionRepository,
} from "@/infrastructure/firebase/questionRepository";
import {
  KeyValueStorage,
  saveQuestionCache,
  storageKeys,
} from "@/infrastructure/storage/keyValueStorage";
import {
  collection,
  getDocsFromServer,
  getFirestore,
  onSnapshot,
} from "@react-native-firebase/firestore";

jest.mock("@react-native-async-storage/async-storage", () => ({
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
}));

jest.mock("@react-native-firebase/firestore", () => ({
  collection: jest.fn(),
  getDocsFromServer: jest.fn(),
  getFirestore: jest.fn(),
  onSnapshot: jest.fn(),
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

const flush = async (): Promise<void> => {
  await Promise.resolve();
  await Promise.resolve();
  await Promise.resolve();
};

const snapshot = (
  documents: readonly { readonly id: string; readonly data: unknown }[],
  fromCache = false,
): QuestionSnapshot => ({
  docs: documents.map((document) => ({
    id: document.id,
    data: () => document.data,
  })),
  metadata: { fromCache },
});

const createGateway = () => {
  let nextSnapshot: ((value: QuestionSnapshot) => void) | null = null;
  let nextError: ((error: unknown) => void) | null = null;
  const unsubscribe = jest.fn();
  const refresh = jest.fn<ReturnType<QuestionFirestoreGateway["refresh"]>, []>();
  const gateway: QuestionFirestoreGateway = {
    subscribe: jest.fn((next, error) => {
      nextSnapshot = next;
      nextError = error;
      return unsubscribe;
    }),
    refresh,
  };

  return {
    gateway,
    refresh,
    unsubscribe,
    emit: (value: QuestionSnapshot) => nextSnapshot?.(value),
    fail: (error: unknown = new Error("offline")) => nextError?.(error),
  };
};

const observe = (
  repository: ReturnType<typeof createQuestionRepository>,
): { readonly states: QuestionState[]; readonly unsubscribe: () => void } => {
  const states: QuestionState[] = [];
  const unsubscribe = repository.subscribe((state) => states.push(state));
  return { states, unsubscribe };
};

describe("question repository", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("keeps loading stable until Firestore or the fallback cache resolves", async () => {
    const { gateway } = createGateway();
    const storage = new MemoryStorage();
    const cacheRead = new Deferred<string | null>();
    storage.getItem.mockImplementationOnce(() => cacheRead.promise);
    const repository = createQuestionRepository({ gateway, storage });
    const { states } = observe(repository);

    await flush();
    expect(states).toEqual([{ kind: "loading" }]);

    cacheRead.resolve(null);
    await flush();
    expect(states).toEqual([{ kind: "loading" }]);
  });

  it("excludes malformed documents, sorts deterministically, and caches current data", async () => {
    const { gateway, emit } = createGateway();
    const storage = new MemoryStorage();
    const cachedAt = "2026-08-13T00:00:00.000Z";
    const repository = createQuestionRepository({
      gateway,
      storage,
      now: () => cachedAt,
    });
    const { states } = observe(repository);
    await flush();

    emit(
      snapshot([
        { id: "b", data: { number: "2", question: " Second ", answer: "4" } },
        { id: "z", data: { number: 1, question: "", answer: 1 } },
        { id: "c", data: { number: 1, question: "Tie C", answer: 3 } },
        { id: "a", data: { number: 1, question: "Tie A", answer: 2 } },
      ]),
    );
    await flush();

    expect(states.at(-1)).toEqual(
      expect.objectContaining({
        kind: "ready",
        source: "current",
        invalidCount: 1,
        cachedAt,
        questions: [
          { id: "a", number: 1, question: "Tie A", answer: 2 },
          { id: "c", number: 1, question: "Tie C", answer: 3 },
          { id: "b", number: 2, question: "Second", answer: 4 },
        ],
      }),
    );
    expect(JSON.parse(storage.values.get(storageKeys.questionCache)!)).toEqual(
      expect.objectContaining({
        schemaVersion: 1,
        cachedAt,
      }),
    );
  });

  it("identifies Firestore cached snapshots and promotes metadata-only current events", async () => {
    const { gateway, emit } = createGateway();
    const storage = new MemoryStorage();
    const repository = createQuestionRepository({
      gateway,
      storage,
      now: () => "2026-08-13T00:00:00.000Z",
    });
    const { states } = observe(repository);
    await flush();
    const documents = [
      { id: "q1", data: { number: 1, question: "Question", answer: 1 } },
    ];

    emit(snapshot(documents, true));
    await flush();
    expect(states.at(-1)).toEqual(
      expect.objectContaining({ kind: "ready", source: "firestore-cache" }),
    );

    emit(snapshot(documents, false));
    await flush();
    expect(states.at(-1)).toEqual(
      expect.objectContaining({ kind: "ready", source: "current" }),
    );
  });

  it("uses the versioned fallback on first-run listener failure", async () => {
    const { gateway, fail } = createGateway();
    const storage = new MemoryStorage();
    await saveQuestionCache(
      storage,
      [{ id: "saved", number: 5, question: "Saved", answer: 8 }],
      "2026-08-12T00:00:00.000Z",
    );
    const repository = createQuestionRepository({ gateway, storage });
    const { states } = observe(repository);

    fail();
    await flush();

    expect(states.at(-1)).toEqual({
      kind: "ready",
      questions: [{ id: "saved", number: 5, question: "Saved", answer: 8 }],
      source: "fallback-cache",
      invalidCount: 0,
      cachedAt: "2026-08-12T00:00:00.000Z",
      refreshing: false,
      refreshError: false,
    });
  });

  it("retains fallback data when the active listener later fails", async () => {
    const { gateway, fail } = createGateway();
    const storage = new MemoryStorage();
    await saveQuestionCache(
      storage,
      [{ id: "saved", number: 5, question: "Saved", answer: 8 }],
      "2026-08-12T00:00:00.000Z",
    );
    const repository = createQuestionRepository({ gateway, storage });
    const { states } = observe(repository);
    await flush();

    fail();
    await flush();

    expect(states.at(-1)).toEqual(
      expect.objectContaining({
        kind: "ready",
        questions: [expect.objectContaining({ id: "saved" })],
        source: "fallback-cache",
        refreshing: false,
        refreshError: true,
      }),
    );
  });

  it("emits first-run offline only after confirming no fallback exists", async () => {
    const { gateway, fail } = createGateway();
    const storage = new MemoryStorage();
    const cacheRead = new Deferred<string | null>();
    storage.getItem.mockImplementationOnce(() => cacheRead.promise);
    const repository = createQuestionRepository({ gateway, storage });
    const { states } = observe(repository);

    fail();
    await flush();
    expect(states.at(-1)).toEqual({ kind: "loading" });

    cacheRead.resolve(null);
    await flush();
    expect(states.at(-1)).toEqual({ kind: "empty-offline", retryable: true });
  });

  it("reports a data error when every Firestore document is malformed", async () => {
    const { gateway, emit } = createGateway();
    const storage = new MemoryStorage();
    const repository = createQuestionRepository({ gateway, storage });
    const { states } = observe(repository);
    await flush();

    emit(snapshot([{ id: "bad", data: { question: "Missing numbers" } }]));
    await flush();

    expect(states.at(-1)).toEqual({
      kind: "error",
      reason: "data",
      retryable: false,
    });
  });

  it("does not let fallback data mask an authoritative malformed snapshot", async () => {
    const { gateway, emit } = createGateway();
    const storage = new MemoryStorage();
    const cacheRead = new Deferred<string | null>();
    storage.getItem.mockImplementationOnce(() => cacheRead.promise);
    const repository = createQuestionRepository({ gateway, storage });
    const { states } = observe(repository);

    emit(snapshot([{ id: "bad", data: { question: "Missing numbers" } }]));
    await flush();
    cacheRead.resolve(
      JSON.stringify({
        schemaVersion: 1,
        cachedAt: "2026-08-12T00:00:00.000Z",
        questions: [
          { id: "stale", number: 1, question: "Stale", answer: 1 },
        ],
      }),
    );
    await flush();

    expect(states.at(-1)).toEqual({
      kind: "error",
      reason: "data",
      retryable: false,
    });
  });

  it("orders fallback cache writes so an older snapshot cannot win", async () => {
    const { gateway, emit } = createGateway();
    const storage = new MemoryStorage();
    const firstWrite = new Deferred<void>();
    let writeCount = 0;
    storage.setItem.mockImplementation(async (key: string, value: string) => {
      writeCount += 1;
      if (writeCount === 1) {
        await firstWrite.promise;
      }
      storage.values.set(key, value);
    });
    const repository = createQuestionRepository({ gateway, storage });
    observe(repository);
    await flush();

    emit(snapshot([{ id: "old", data: { number: 1, question: "Old", answer: 1 } }]));
    await flush();
    expect(storage.setItem).toHaveBeenCalledTimes(1);

    emit(snapshot([{ id: "new", data: { number: 2, question: "New", answer: 2 } }]));
    await flush();
    expect(storage.setItem).toHaveBeenCalledTimes(1);

    firstWrite.resolve();
    await flush();
    await flush();

    expect(storage.setItem).toHaveBeenCalledTimes(2);
    expect(JSON.parse(storage.values.get(storageKeys.questionCache)!)).toEqual(
      expect.objectContaining({
        questions: [expect.objectContaining({ id: "new" })],
      }),
    );
  });

  it("preserves the last usable dataset while refresh is pending or fails", async () => {
    const { gateway, emit, refresh } = createGateway();
    const storage = new MemoryStorage();
    const repository = createQuestionRepository({ gateway, storage });
    const { states } = observe(repository);
    await flush();
    emit(snapshot([{ id: "q1", data: { number: 1, question: "One", answer: 1 } }]));
    await flush();
    const refreshResult = new Deferred<QuestionSnapshot>();
    refresh.mockReturnValueOnce(refreshResult.promise);

    const firstRefresh = repository.refresh();
    const duplicateRefresh = repository.refresh();
    expect(firstRefresh).toBe(duplicateRefresh);
    expect(states.at(-1)).toEqual(
      expect.objectContaining({
        kind: "ready",
        questions: [expect.objectContaining({ id: "q1" })],
        refreshing: true,
        refreshError: false,
      }),
    );

    refreshResult.reject(new Error("offline"));
    await firstRefresh;
    expect(states.at(-1)).toEqual(
      expect.objectContaining({
        kind: "ready",
        questions: [expect.objectContaining({ id: "q1" })],
        refreshing: false,
        refreshError: true,
      }),
    );
    expect(refresh).toHaveBeenCalledTimes(1);
  });

  it("unsubscribes once and ignores late events after the final listener leaves", async () => {
    const { gateway, emit, unsubscribe } = createGateway();
    const storage = new MemoryStorage();
    const repository = createQuestionRepository({ gateway, storage });
    const observed = observe(repository);
    await flush();
    const countBeforeUnmount = observed.states.length;

    observed.unsubscribe();
    emit(snapshot([{ id: "late", data: { number: 1, question: "Late", answer: 1 } }]));
    await flush();

    expect(unsubscribe).toHaveBeenCalledTimes(1);
    expect(observed.states).toHaveLength(countBeforeUnmount);
  });

  it("ignores a fallback read that resolves after unsubscribe", async () => {
    const { gateway, unsubscribe } = createGateway();
    const storage = new MemoryStorage();
    const cacheRead = new Deferred<string | null>();
    storage.getItem.mockImplementationOnce(() => cacheRead.promise);
    const repository = createQuestionRepository({ gateway, storage });
    const observed = observe(repository);

    observed.unsubscribe();
    cacheRead.resolve(
      JSON.stringify({
        schemaVersion: 1,
        cachedAt: "2026-08-12T00:00:00.000Z",
        questions: [
          { id: "late", number: 1, question: "Late", answer: 1 },
        ],
      }),
    );
    await flush();

    expect(unsubscribe).toHaveBeenCalledTimes(1);
    expect(observed.states).toEqual([{ kind: "loading" }]);
  });

  it("restarts acquisition when a new subscriber arrives after disposal", async () => {
    const { gateway, emit, unsubscribe } = createGateway();
    const storage = new MemoryStorage();
    const repository = createQuestionRepository({ gateway, storage });
    const first = observe(repository);
    await flush();
    first.unsubscribe();

    const second = observe(repository);
    await flush();
    emit(snapshot([{ id: "q2", data: { number: 2, question: "Two", answer: 2 } }]));
    await flush();

    expect(gateway.subscribe).toHaveBeenCalledTimes(2);
    expect(unsubscribe).toHaveBeenCalledTimes(1);
    expect(second.states.at(-1)).toEqual(
      expect.objectContaining({
        kind: "ready",
        questions: [expect.objectContaining({ id: "q2" })],
      }),
    );
  });

  it("requests metadata events and refreshes only from the server", async () => {
    const firestore = { name: "firestore" };
    const questionsQuery = { path: "questions" };
    const unsubscribe = jest.fn();
    const serverSnapshot = snapshot([]);
    jest.mocked(getFirestore).mockReturnValue(firestore as never);
    jest.mocked(collection).mockReturnValue(questionsQuery as never);
    jest.mocked(onSnapshot).mockReturnValue(unsubscribe);
    jest.mocked(getDocsFromServer).mockResolvedValue(serverSnapshot as never);
    const gateway = createFirebaseQuestionGateway();
    const next = jest.fn();
    const error = jest.fn();

    expect(gateway.subscribe(next, error)).toBe(unsubscribe);
    expect(getFirestore).toHaveBeenCalledTimes(1);
    expect(collection).toHaveBeenCalledWith(firestore, "questions");
    expect(onSnapshot).toHaveBeenCalledWith(
      questionsQuery,
      { includeMetadataChanges: true },
      expect.any(Function),
      error,
    );
    await expect(gateway.refresh()).resolves.toBe(serverSnapshot);
    expect(getDocsFromServer).toHaveBeenCalledWith(questionsQuery);
  });
});
