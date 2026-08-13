import {
  KeyValueStorage,
  addPendingRecords,
  acknowledgePendingRecords,
  clearGuestChoice,
  clearGuestProgress,
  clearPendingRecords,
  clearProgress,
  clearQuestionCache,
  loadGuestChoice,
  loadGuestProgress,
  loadPendingRecords,
  loadProgress,
  loadQuestionCache,
  saveGuestChoice,
  saveGuestProgress,
  savePendingRecords,
  saveProgress,
  saveQuestionCache,
  storageKeys,
  unionPendingRecords,
} from "@/infrastructure/storage/keyValueStorage";

class MemoryStorage implements KeyValueStorage {
  readonly values = new Map<string, string>();

  async getItem(key: string): Promise<string | null> {
    return this.values.get(key) ?? null;
  }

  async setItem(key: string, value: string): Promise<void> {
    this.values.set(key, value);
  }

  async removeItem(key: string): Promise<void> {
    this.values.delete(key);
  }
}

describe("key value storage", () => {
  it("uses namespaced versioned keys", () => {
    expect(Object.values(storageKeys)).toEqual([
      "relativitylab:v1:guest-choice",
      "relativitylab:v1:guest-progress",
      "relativitylab:v1:progress",
      "relativitylab:v1:question-cache",
      "relativitylab:v1:pending-records",
    ]);
  });

  it("saves, loads, and clears strict guest progress records", async () => {
    const storage = new MemoryStorage();
    const updatedAt = "2026-08-13T00:00:00.000Z";

    await saveGuestProgress(storage, [" a ", "a", "unknown"], updatedAt);
    expect(await loadGuestProgress(storage)).toEqual({
      schemaVersion: 1,
      solvedQuestionIds: ["a", "unknown"],
      updatedAt,
    });

    await clearGuestProgress(storage);
    expect(await loadGuestProgress(storage)).toBeNull();
  });

  it("saves, loads, and clears guest choices", async () => {
    const storage = new MemoryStorage();

    await saveGuestChoice(storage, "guest");
    expect(await loadGuestChoice(storage)).toBe("guest");

    await clearGuestChoice(storage);
    expect(await loadGuestChoice(storage)).toBeNull();
  });

  it("saves, loads, and clears normalized progress", async () => {
    const storage = new MemoryStorage();

    await saveProgress(storage, {
      acknowledgedQuestionIds: ["a", "a"],
      pendingQuestionIds: ["b", "a"],
    });
    expect(await loadProgress(storage)).toEqual({
      acknowledgedQuestionIds: ["a"],
      pendingQuestionIds: ["b"],
    });

    await clearProgress(storage);
    expect(await loadProgress(storage)).toBeNull();
  });

  it("saves, loads, and clears question caches", async () => {
    const storage = new MemoryStorage();
    const cachedAt = "2026-08-13T00:00:00.000Z";

    await saveQuestionCache(
      storage,
      [{ id: "a", number: 1, question: "A", answer: 1 }],
      cachedAt,
    );
    expect(await loadQuestionCache(storage)).toEqual({
      schemaVersion: 1,
      cachedAt,
      questions: [{ id: "a", number: 1, question: "A", answer: 1 }],
    });

    await clearQuestionCache(storage);
    expect(await loadQuestionCache(storage)).toBeNull();
  });

  it("clears corrupted JSON and schema values safely", async () => {
    const storage = new MemoryStorage();

    storage.values.set(storageKeys.guestChoice, "{");
    storage.values.set(storageKeys.guestProgress, JSON.stringify({ schemaVersion: 2 }));
    storage.values.set(storageKeys.progress, JSON.stringify({ schemaVersion: 2 }));
    storage.values.set(storageKeys.questionCache, JSON.stringify({ schemaVersion: 1 }));
    storage.values.set(storageKeys.pendingRecords, JSON.stringify({ schemaVersion: 1 }));

    expect(await loadGuestChoice(storage)).toBeNull();
    expect(await loadGuestProgress(storage)).toBeNull();
    expect(await loadProgress(storage)).toBeNull();
    expect(await loadQuestionCache(storage)).toBeNull();
    expect(await loadPendingRecords(storage)).toBeNull();

    expect(storage.values.size).toBe(0);
  });

  it("stores pending records and unions them idempotently by id", async () => {
    const storage = new MemoryStorage();
    const first = {
      id: "one",
      questionId: "q1",
      answer: 1,
      createdAt: 10,
    };
    const duplicate = {
      id: "one",
      questionId: "q1-changed",
      answer: 2,
      createdAt: 11,
    };
    const second = {
      id: "two",
      questionId: "q2",
      answer: 2,
      createdAt: 12,
    };

    expect(unionPendingRecords([first], [duplicate, second])).toEqual([
      first,
      second,
    ]);
    expect(await addPendingRecords(storage, [first, first, second])).toEqual([
      first,
      second,
    ]);
    expect(await addPendingRecords(storage, [duplicate])).toEqual([
      first,
      second,
    ]);
  });

  it("rejects malformed pending records from strict storage schemas", async () => {
    const storage = new MemoryStorage();
    const validRecord = {
      id: "one",
      questionId: "q1",
      answer: 1,
      createdAt: 10,
    };

    storage.values.set(
      storageKeys.pendingRecords,
      JSON.stringify({
        schemaVersion: 1,
        records: [{ ...validRecord, extra: true }],
      }),
    );
    expect(await loadPendingRecords(storage)).toBeNull();

    storage.values.set(
      storageKeys.pendingRecords,
      JSON.stringify({
        schemaVersion: 1,
        records: [{ ...validRecord, id: "x".repeat(129) }],
      }),
    );
    expect(await loadPendingRecords(storage)).toBeNull();

    storage.values.set(
      storageKeys.pendingRecords,
      JSON.stringify({
        schemaVersion: 1,
        records: Array.from({ length: 1001 }, (_, index) => ({
          ...validRecord,
          id: `record-${index}`,
        })),
      }),
    );
    expect(await loadPendingRecords(storage)).toBeNull();
    expect(() =>
      unionPendingRecords(
        [],
        Array.from({ length: 1001 }, (_, index) => ({
          ...validRecord,
          id: `record-${index}`,
        })),
      ),
    ).not.toThrow();
    expect(
      unionPendingRecords(
        [],
        Array.from({ length: 1001 }, (_, index) => ({
          ...validRecord,
          id: `record-${index}`,
        })),
      ),
    ).toHaveLength(1000);
  });

  it("acknowledges pending records before clearing and remains idempotent", async () => {
    const storage = new MemoryStorage();
    const records = [
      { id: "one", questionId: "q1", answer: 1, createdAt: 10 },
      { id: "two", questionId: "q2", answer: 2, createdAt: 11 },
    ];

    await savePendingRecords(storage, records);

    expect(await acknowledgePendingRecords(storage, ["one", "one"])).toEqual([
      records[1],
    ]);
    expect(await acknowledgePendingRecords(storage, ["one"])).toEqual([
      records[1],
    ]);

    await clearPendingRecords(storage);
    expect(await loadPendingRecords(storage)).toBeNull();
  });
});
